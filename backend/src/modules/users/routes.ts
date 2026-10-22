import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { changePasswordSchema, updateProfileSchema } from '@quiz/shared';
import { me } from '../../core/auth';
import { prisma } from '../../core/db';
import { body, idParam, noContent, ok, wrap } from '../../core/http';
import { badRequest, conflict, notFound, unauthorized } from '../../core/errors';
import { clean } from '../../core/sanitize';
import { writeLimiter } from '../../core/rateLimit';
import { audit } from '../../core/audit';
import { cache } from '../../core/cache';
import { revokeAllSessions, toUserDto } from '../auth/service';

export const usersRouter = Router();

usersRouter.patch('/users/me', writeLimiter, wrap(async (req, res) => {
  const u = me(req);
  const input = body(updateProfileSchema, req);
  if (input.username) {
    const taken = await prisma.user.findFirst({ where: { username: { equals: input.username, mode: 'insensitive' }, NOT: { id: u.id } }, select: { id: true } });
    if (taken) throw conflict('Username already taken', 'USERNAME_TAKEN');
  }
  const updated = await prisma.user.update({
    where: { id: u.id },
    data: { username: input.username, name: input.name === undefined ? undefined : clean(input.name), avatarUrl: input.avatarUrl },
  });
  await cache.invalidateTags(`user:${u.id}`);
  ok(res, toUserDto(updated));
}));

usersRouter.put('/users/me/password', writeLimiter, wrap(async (req, res) => {
  const u = me(req);
  const { currentPassword, newPassword } = body(changePasswordSchema, req);
  const row = await prisma.user.findUniqueOrThrow({ where: { id: u.id } });
  if (!(await bcrypt.compare(currentPassword, row.passwordHash))) throw unauthorized('Current password is incorrect');
  if (currentPassword === newPassword) throw badRequest('New password must differ from the current one');
  await prisma.user.update({ where: { id: u.id }, data: { passwordHash: await bcrypt.hash(newPassword, 11) } });
  await revokeAllSessions(u.id);
  await audit(req, u.id, 'auth.password_change', 'User', u.id);
  noContent(res);
}));

usersRouter.get('/users/:id/public', wrap(async (req, res) => {
  const id = idParam(req);
  const user = await prisma.user.findFirst({
    where: { id, deletedAt: null },
    select: {
      id: true, username: true, name: true, avatarUrl: true, xp: true, tier: true, streakDays: true, role: true,
      badges: { select: { awardedAt: true, badge: { select: { key: true, name: true, description: true, icon: true } } } },
      _count: { select: { followers: true, following: true } },
    },
  });
  if (!user) throw notFound('User');
  const isFollowing = !!(await prisma.follow.findUnique({ where: { followerId_followingId: { followerId: me(req).id, followingId: id } } }));
  ok(res, { ...user, followerCount: user._count.followers, followingCount: user._count.following, isFollowing });
}));

usersRouter.post('/users/:id/follow', writeLimiter, wrap(async (req, res) => {
  const id = idParam(req);
  const u = me(req);
  if (id === u.id) throw badRequest('You cannot follow yourself');
  if (!(await prisma.user.findFirst({ where: { id, deletedAt: null }, select: { id: true } }))) throw notFound('User');
  await prisma.follow.upsert({ where: { followerId_followingId: { followerId: u.id, followingId: id } }, update: {}, create: { followerId: u.id, followingId: id } });
  noContent(res);
}));

usersRouter.delete('/users/:id/follow', writeLimiter, wrap(async (req, res) => {
  await prisma.follow.deleteMany({ where: { followerId: me(req).id, followingId: idParam(req) } });
  noContent(res);
}));
