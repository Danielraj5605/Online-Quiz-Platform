import { Router } from 'express';
import { adminUpdateUserSchema, pageQuery } from '@quiz/shared';
import { adminOnly, me } from '../../core/auth';
import { body, idParam, ok, pageMeta, query, wrap } from '../../core/http';
import { writeLimiter } from '../../core/rateLimit';
import * as svc from './service';

export const adminRouter = Router();

// POST /reports (user-submitted flags) lives in the gamification/social module.
adminRouter.use('/admin', adminOnly);

adminRouter.get('/admin/users', wrap(async (req, res) => {
  const p = query(pageQuery, req);
  const { rows, total } = await svc.listUsers(p, query(svc.adminUsersQuery, req));
  ok(res, rows, pageMeta(p.page, p.pageSize, total));
}));

adminRouter.patch('/admin/users/:id', writeLimiter, wrap(async (req, res) => {
  ok(res, await svc.updateUser(req, me(req), idParam(req), body(adminUpdateUserSchema, req)));
}));

adminRouter.get('/admin/analytics', wrap(async (_req, res) => { ok(res, await svc.analytics()); }));

adminRouter.get('/admin/quizzes', wrap(async (req, res) => {
  const p = query(pageQuery, req);
  const { rows, total } = await svc.listQuizzes(p, query(svc.adminQuizzesQuery, req));
  ok(res, rows, pageMeta(p.page, p.pageSize, total));
}));

adminRouter.patch('/admin/quizzes/:id', writeLimiter, wrap(async (req, res) => {
  ok(res, await svc.patchQuiz(req, me(req), idParam(req), body(svc.patchQuizSchema, req)));
}));

adminRouter.get('/admin/moderation', wrap(async (req, res) => {
  const p = query(pageQuery, req);
  const { rows, total } = await svc.listFlags(p, query(svc.moderationQuery, req));
  ok(res, rows, pageMeta(p.page, p.pageSize, total));
}));

adminRouter.patch('/admin/moderation/:id', writeLimiter, wrap(async (req, res) => {
  ok(res, await svc.resolveFlag(req, me(req), idParam(req), body(svc.resolveSchema, req)));
}));

adminRouter.get('/admin/audit-log', wrap(async (req, res) => {
  const p = query(pageQuery, req);
  const { rows, total } = await svc.listAudit(p, query(svc.auditQuery, req));
  ok(res, rows, pageMeta(p.page, p.pageSize, total));
}));
