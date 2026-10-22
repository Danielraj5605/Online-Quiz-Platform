import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import type { Role } from '@quiz/shared';
import { env } from './env';
import { prisma } from './db';
import { cache } from './cache';
import { forbidden, unauthorized } from './errors';

export interface AuthUser { id: string; role: Role; username: string }
declare module 'express-serve-static-core' {
  interface Request { user?: AuthUser }
}

export const ACCESS_TTL_SEC = 15 * 60;
export const REFRESH_TTL_MS = 14 * 24 * 3600 * 1000;

export const signAccess = (u: { id: string }) =>
  jwt.sign({ sub: u.id }, env.JWT_SECRET, { algorithm: 'HS256', expiresIn: ACCESS_TTL_SEC, issuer: 'quizzo' });
export const sha256 = (s: string) => crypto.createHash('sha256').update(s).digest('hex');
export const newRefreshToken = () => crypto.randomBytes(48).toString('base64url');

async function loadUser(id: string): Promise<AuthUser | null> {
  const hit = await cache.get<AuthUser | { gone: true }>(`authuser:${id}`);
  if (hit) return 'gone' in hit ? null : hit;
  const u = await prisma.user.findUnique({ where: { id }, select: { id: true, role: true, username: true, disabled: true, deletedAt: true } });
  if (!u || u.disabled || u.deletedAt) { await cache.set(`authuser:${id}`, { gone: true }, 30, [`user:${id}`]); return null; }
  const au: AuthUser = { id: u.id, role: u.role, username: u.username };
  await cache.set(`authuser:${id}`, au, 30, [`user:${id}`]); // role changes/disable invalidate tag `user:<id>`
  return au;
}

function bearer(req: Request) {
  const h = req.headers.authorization;
  return h?.startsWith('Bearer ') ? h.slice(7) : null;
}

/** Requires a valid access token. Role is re-read from DB (30 s cache), never trusted from the token. */
export async function authenticate(req: Request, _res: Response, next: NextFunction) {
  try {
    const t = bearer(req);
    if (!t) throw unauthorized();
    let sub: string;
    try {
      const p = jwt.verify(t, env.JWT_SECRET, { algorithms: ['HS256'], issuer: 'quizzo' }) as jwt.JwtPayload;
      sub = String(p.sub);
    } catch { throw unauthorized('Invalid or expired token'); }
    const u = await loadUser(sub);
    if (!u) throw unauthorized('Account unavailable');
    req.user = u;
    next();
  } catch (e) { next(e); }
}

export const requireRole = (...roles: Role[]) => (req: Request, _res: Response, next: NextFunction) => {
  if (!req.user) return next(unauthorized());
  if (!roles.includes(req.user.role)) return next(forbidden());
  next();
};
export const organizerOrAdmin = requireRole('ORGANIZER', 'ADMIN');
export const adminOnly = requireRole('ADMIN');
export const me = (req: Request): AuthUser => { if (!req.user) throw unauthorized(); return req.user; };
