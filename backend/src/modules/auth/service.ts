import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import type { LoginInput, RegisterInput, UserDto } from '@quiz/shared';
import type { User } from '@prisma/client';
import { prisma } from '../../core/db';
import { cache } from '../../core/cache';
import { conflict, unauthorized, AppError } from '../../core/errors';
import { clean } from '../../core/sanitize';
import { newRefreshToken, sha256, signAccess, REFRESH_TTL_MS } from '../../core/auth';

const MAX_FAILS = 5;
const LOCK_MS = 15 * 60_000;
// Compared against when the account does not exist so timing does not reveal registered emails.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);

export const toUserDto = (u: User): UserDto => ({
  id: u.id, username: u.username, email: u.email, name: u.name, avatarUrl: u.avatarUrl, role: u.role,
  xp: u.xp, tier: u.tier, streakDays: u.streakDays, createdAt: u.createdAt.toISOString(),
});

async function issueTokens(user: User, familyId: string = crypto.randomUUID()) {
  const refresh = newRefreshToken();
  await prisma.refreshToken.create({
    data: { userId: user.id, tokenHash: sha256(refresh), familyId, expiresAt: new Date(Date.now() + REFRESH_TTL_MS) },
  });
  return { accessToken: signAccess(user), refresh };
}

export async function register(input: RegisterInput) {
  const exists = await prisma.user.findFirst({
    where: { OR: [{ email: input.email }, { username: { equals: input.username, mode: 'insensitive' } }] },
    select: { id: true },
  });
  if (exists) throw conflict('An account with that email or username already exists', 'ACCOUNT_EXISTS');
  const user = await prisma.user.create({
    data: {
      username: input.username, email: input.email, name: input.name ? clean(input.name) : null,
      passwordHash: await bcrypt.hash(input.password, 11), role: input.role,
    },
  });
  const { accessToken, refresh } = await issueTokens(user);
  return { result: { user: toUserDto(user), accessToken }, refresh };
}

export async function login(input: LoginInput) {
  const id = input.identifier.toLowerCase();
  const user = await prisma.user.findFirst({
    where: { deletedAt: null, OR: [{ email: id }, { username: { equals: input.identifier, mode: 'insensitive' } }] },
  });
  if (!user) { await bcrypt.compare(input.password, DUMMY_HASH); throw unauthorized('Invalid credentials'); }
  if (user.disabled) throw new AppError(403, 'ACCOUNT_DISABLED', 'This account has been disabled');
  if (user.lockUntil && user.lockUntil > new Date()) throw new AppError(423, 'LOCKED', 'Too many failed attempts. Try again in a few minutes.');
  if (!(await bcrypt.compare(input.password, user.passwordHash))) {
    const fails = user.failedLogins + 1;
    await prisma.user.update({
      where: { id: user.id },
      data: fails >= MAX_FAILS ? { failedLogins: 0, lockUntil: new Date(Date.now() + LOCK_MS) } : { failedLogins: fails },
    });
    throw unauthorized('Invalid credentials');
  }
  if (user.failedLogins || user.lockUntil) await prisma.user.update({ where: { id: user.id }, data: { failedLogins: 0, lockUntil: null } });
  const { accessToken, refresh } = await issueTokens(user);
  return { result: { user: toUserDto(user), accessToken }, refresh };
}

/** Rotates the refresh token. Presenting an already-rotated token revokes the whole family (theft signal). */
export async function refresh(token: string | undefined) {
  if (!token) throw unauthorized('No session');
  const row = await prisma.refreshToken.findUnique({ where: { tokenHash: sha256(token) }, include: { user: true } });
  if (!row) throw unauthorized('Invalid session');
  if (row.revokedAt) {
    await prisma.refreshToken.updateMany({ where: { familyId: row.familyId, revokedAt: null }, data: { revokedAt: new Date() } });
    throw unauthorized('Session reuse detected, please sign in again');
  }
  if (row.expiresAt < new Date() || row.user.disabled || row.user.deletedAt) throw unauthorized('Session expired');
  const next = await issueTokens(row.user, row.familyId);
  await prisma.refreshToken.update({ where: { id: row.id }, data: { revokedAt: new Date(), replacedBy: sha256(next.refresh) } });
  return { result: { user: toUserDto(row.user), accessToken: next.accessToken }, refresh: next.refresh };
}

export async function logout(token: string | undefined) {
  if (!token) return;
  const row = await prisma.refreshToken.findUnique({ where: { tokenHash: sha256(token) } });
  if (row) await prisma.refreshToken.updateMany({ where: { familyId: row.familyId, revokedAt: null }, data: { revokedAt: new Date() } });
}

export async function revokeAllSessions(userId: string) {
  await prisma.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
  await cache.invalidateTags(`user:${userId}`);
}
