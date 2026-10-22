import { Router, type Response } from 'express';
import { loginSchema, registerSchema } from '@quiz/shared';
import { authLimiter } from '../../core/rateLimit';
import { authenticate, me, REFRESH_TTL_MS } from '../../core/auth';
import { env } from '../../core/env';
import { body, created, noContent, ok, wrap } from '../../core/http';
import { prisma } from '../../core/db';
import { notFound } from '../../core/errors';
import { audit } from '../../core/audit';
import * as svc from './service';

export const authRouter = Router();
const COOKIE = 'rt';
const cookieOpts = { httpOnly: true, secure: env.isProd, sameSite: 'strict' as const, path: '/api/v1/auth', maxAge: REFRESH_TTL_MS };
const setCookie = (res: Response, token: string) => res.cookie(COOKIE, token, cookieOpts);

authRouter.post('/register', authLimiter, wrap(async (req, res) => {
  const { result, refresh } = await svc.register(body(registerSchema, req));
  setCookie(res, refresh);
  await audit(req, result.user.id, 'auth.register', 'User', result.user.id);
  created(res, result);
}));

authRouter.post('/login', authLimiter, wrap(async (req, res) => {
  const { result, refresh } = await svc.login(body(loginSchema, req));
  setCookie(res, refresh);
  ok(res, result);
}));

authRouter.post('/refresh', wrap(async (req, res) => {
  try {
    const { result, refresh } = await svc.refresh(req.cookies?.[COOKIE]);
    setCookie(res, refresh);
    ok(res, result);
  } catch (e) {
    res.clearCookie(COOKIE, { ...cookieOpts, maxAge: undefined });
    throw e;
  }
}));

authRouter.post('/logout', wrap(async (req, res) => {
  await svc.logout(req.cookies?.[COOKIE]);
  res.clearCookie(COOKIE, { ...cookieOpts, maxAge: undefined });
  noContent(res);
}));

authRouter.get('/me', authenticate, wrap(async (req, res) => {
  const u = await prisma.user.findUnique({ where: { id: me(req).id } });
  if (!u) throw notFound('User');
  ok(res, svc.toUserDto(u));
}));
