import type { Prisma } from '@prisma/client';
import type { Request } from 'express';
import { ROLES, QUIZ_STATUSES, type PageQuery, type QuizStatus, type Role } from '@quiz/shared';
import { z } from 'zod';
import { prisma } from '../../core/db';
import { cache, cached } from '../../core/cache';
import { audit } from '../../core/audit';
import { AppError, conflict, notFound } from '../../core/errors';
import { orderBy, skipTake } from '../../core/http';
import type { AuthUser } from '../../core/auth';
import { revokeAllSessions } from '../auth/service';

export const adminUsersQuery = z.object({
  role: z.enum(ROLES).optional(),
  disabled: z.enum(['true', 'false']).optional(),
});
export const adminQuizzesQuery = z.object({
  status: z.enum(QUIZ_STATUSES).optional(),
  flagged: z.enum(['true', 'false']).optional(),
});
export const patchQuizSchema = z.object({ isFlagged: z.boolean().optional(), status: z.enum(QUIZ_STATUSES).optional() });
export const moderationQuery = z.object({ status: z.enum(['OPEN', 'DISMISSED', 'ACTIONED']).optional() });
export const resolveSchema = z.object({ action: z.enum(['DISMISS', 'REMOVE']), note: z.string().trim().max(500).optional() });
export const auditQuery = z.object({
  action: z.string().max(60).optional(), actorId: z.string().max(40).optional(),
  from: z.string().datetime().optional(), to: z.string().datetime().optional(),
});

/* ───── users ───── */
export async function listUsers(p: PageQuery, f: z.infer<typeof adminUsersQuery>) {
  const where: Prisma.UserWhereInput = { deletedAt: null };
  if (f.role) where.role = f.role;
  if (f.disabled) where.disabled = f.disabled === 'true';
  if (p.q) where.OR = [{ username: { contains: p.q, mode: 'insensitive' } }, { email: { contains: p.q, mode: 'insensitive' } }, { name: { contains: p.q, mode: 'insensitive' } }];
  const [rows, total] = await Promise.all([
    prisma.user.findMany({
      where, ...skipTake(p), orderBy: orderBy(p.sort, ['createdAt', 'username', 'xp', 'role'] as const, { createdAt: 'desc' }),
      select: { id: true, username: true, email: true, name: true, role: true, disabled: true, xp: true, tier: true, createdAt: true, _count: { select: { attempts: true, quizzes: true } } },
    }),
    prisma.user.count({ where }),
  ]);
  return { rows: rows.map(({ _count, ...u }) => ({ ...u, attemptCount: _count.attempts, quizCount: _count.quizzes })), total };
}

export async function updateUser(req: Request, actor: AuthUser, id: string, patch: { role?: Role; disabled?: boolean }) {
  if (id === actor.id && (patch.role !== undefined || patch.disabled !== undefined)) {
    throw new AppError(400, 'SELF_MODIFY', 'You cannot change your own role or disable your own account');
  }
  const before = await prisma.user.findFirst({ where: { id, deletedAt: null } });
  if (!before) throw notFound('User');
  const u = await prisma.user.update({ where: { id }, data: { role: patch.role, disabled: patch.disabled } });
  await cache.invalidateTags(`user:${id}`);
  if (patch.disabled) await revokeAllSessions(id);
  await audit(req, actor.id, 'admin.user_update', 'User', id, { from: { role: before.role, disabled: before.disabled }, to: patch });
  return { id: u.id, username: u.username, email: u.email, name: u.name, role: u.role, disabled: u.disabled, xp: u.xp, tier: u.tier, createdAt: u.createdAt };
}

/* ───── analytics ───── */
async function dailySeries(table: 'User' | 'Attempt' | 'Result', days: number) {
  const col = table === 'Attempt' ? 'startedAt' : 'createdAt';
  const since = new Date(Date.now() - (days - 1) * 86400000);
  since.setUTCHours(0, 0, 0, 0);
  const rows = await prisma.$queryRawUnsafe<{ d: Date; n: number }[]>(
    `SELECT date_trunc('day', "${col}" AT TIME ZONE 'UTC') AS d, count(*)::int AS n FROM "${table}" WHERE "${col}" >= $1 GROUP BY 1 ORDER BY 1`,
    since,
  );
  const map = new Map(rows.map((r) => [new Date(r.d).toISOString().slice(0, 10), r.n]));
  return Array.from({ length: days }, (_, i) => {
    const date = new Date(since.getTime() + i * 86400000).toISOString().slice(0, 10);
    return { date, count: map.get(date) ?? 0 };
  });
}

export const analytics = () => cached('admin:analytics', 60, ['admin:analytics'], async () => {
  const [usersByRole, quizzesByStatus, attempts, results, avg, newUsers, attemptsSeries, signups, topQuizzes, openFlags] = await Promise.all([
    prisma.user.groupBy({ by: ['role'], where: { deletedAt: null }, _count: true }),
    prisma.quiz.groupBy({ by: ['status'], where: { deletedAt: null }, _count: true }),
    prisma.attempt.count({ where: { number: { gt: 0 } } }),
    prisma.result.count({ where: { isFinal: true } }),
    prisma.result.aggregate({ where: { isFinal: true }, _avg: { percentage: true } }),
    prisma.user.count({ where: { createdAt: { gte: new Date(Date.now() - 7 * 86400000) } } }),
    dailySeries('Attempt', 30),
    dailySeries('User', 30),
    prisma.quiz.findMany({
      where: { deletedAt: null }, take: 5, orderBy: { attempts: { _count: 'desc' } },
      select: { id: true, title: true, owner: { select: { username: true } }, _count: { select: { attempts: true } } },
    }),
    prisma.flaggedContent.count({ where: { status: 'OPEN' } }),
  ]);
  return {
    totals: {
      users: usersByRole.reduce((a, r) => a + r._count, 0), quizzes: quizzesByStatus.reduce((a, r) => a + r._count, 0),
      attempts, finalResults: results, newUsers7d: newUsers, avgScorePct: Math.round((avg._avg.percentage ?? 0) * 10) / 10, openFlags,
    },
    usersByRole: usersByRole.map((r) => ({ role: r.role, count: r._count })),
    quizzesByStatus: quizzesByStatus.map((r) => ({ status: r.status, count: r._count })),
    attemptsPerDay: attemptsSeries,
    signupsPerDay: signups,
    topQuizzes: topQuizzes.map((q) => ({ id: q.id, title: q.title, owner: q.owner.username, attempts: q._count.attempts })),
  };
});

/* ───── quizzes ───── */
export async function listQuizzes(p: PageQuery, f: z.infer<typeof adminQuizzesQuery>) {
  const where: Prisma.QuizWhereInput = { deletedAt: null };
  if (f.status) where.status = f.status;
  if (f.flagged) where.isFlagged = f.flagged === 'true';
  if (p.q) where.OR = [{ title: { contains: p.q, mode: 'insensitive' } }, { owner: { username: { contains: p.q, mode: 'insensitive' } } }];
  const [rows, total] = await Promise.all([
    prisma.quiz.findMany({
      where, ...skipTake(p), orderBy: orderBy(p.sort, ['createdAt', 'title', 'status'] as const, { createdAt: 'desc' }),
      select: { id: true, title: true, status: true, visibility: true, isFlagged: true, createdAt: true, owner: { select: { id: true, username: true } }, _count: { select: { attempts: true, questions: true } } },
    }),
    prisma.quiz.count({ where }),
  ]);
  return { rows: rows.map(({ _count, ...q }) => ({ ...q, attemptCount: _count.attempts, questionCount: _count.questions })), total };
}

export async function patchQuiz(req: Request, actor: AuthUser, id: string, patch: z.infer<typeof patchQuizSchema>) {
  const quiz = await prisma.quiz.findFirst({ where: { id, deletedAt: null } });
  if (!quiz) throw notFound('Quiz');
  const updated = await prisma.quiz.update({ where: { id }, data: { isFlagged: patch.isFlagged, status: patch.status as QuizStatus | undefined } });
  await cache.invalidateTags(`quiz:${id}`, 'catalog');
  await audit(req, actor.id, 'admin.quiz_update', 'Quiz', id, { from: { status: quiz.status, isFlagged: quiz.isFlagged }, to: patch });
  return { id: updated.id, title: updated.title, status: updated.status, isFlagged: updated.isFlagged };
}

/* ───── moderation ───── */
export async function listFlags(p: PageQuery, f: z.infer<typeof moderationQuery>) {
  const where: Prisma.FlaggedContentWhereInput = { status: f.status ?? 'OPEN' };
  const [rows, total] = await Promise.all([
    prisma.flaggedContent.findMany({
      where, ...skipTake(p), orderBy: { createdAt: 'desc' },
      include: { reporter: { select: { id: true, username: true } } },
    }),
    prisma.flaggedContent.count({ where }),
  ]);
  // attach a short label for the flagged entity (best effort, batched)
  const ids = (t: string) => rows.filter((r) => r.entityType === t).map((r) => r.entityId);
  const [quizzes, reviews, users] = await Promise.all([
    prisma.quiz.findMany({ where: { id: { in: ids('QUIZ') } }, select: { id: true, title: true } }),
    prisma.review.findMany({ where: { id: { in: ids('REVIEW') } }, select: { id: true, comment: true, quiz: { select: { title: true } } } }),
    prisma.user.findMany({ where: { id: { in: ids('USER') } }, select: { id: true, username: true } }),
  ]);
  const label = new Map<string, string>([
    ...quizzes.map((q) => [q.id, q.title] as const),
    ...reviews.map((r) => [r.id, `“${r.comment.slice(0, 80)}” on ${r.quiz.title}`] as const),
    ...users.map((u) => [u.id, `@${u.username}`] as const),
  ]);
  return { rows: rows.map((r) => ({ ...r, entityLabel: label.get(r.entityId) ?? null })), total };
}

export async function resolveFlag(req: Request, actor: AuthUser, id: string, input: z.infer<typeof resolveSchema>) {
  const flag = await prisma.flaggedContent.findUnique({ where: { id } });
  if (!flag) throw notFound('Flag');
  if (flag.status !== 'OPEN') throw conflict('This report has already been resolved');
  if (input.action === 'REMOVE') {
    const now = new Date();
    if (flag.entityType === 'QUIZ') {
      await prisma.quiz.updateMany({ where: { id: flag.entityId }, data: { deletedAt: now, isFlagged: true } });
      await cache.invalidateTags(`quiz:${flag.entityId}`, 'catalog');
    } else if (flag.entityType === 'REVIEW') {
      const r = await prisma.review.findUnique({ where: { id: flag.entityId }, select: { quizId: true } });
      await prisma.review.updateMany({ where: { id: flag.entityId }, data: { deletedAt: now } });
      if (r) await cache.invalidateTags(`quiz:${r.quizId}`);
    } else if (flag.entityType === 'USER') {
      if (flag.entityId === actor.id) throw new AppError(400, 'SELF_MODIFY', 'You cannot remove your own account');
      await prisma.user.updateMany({ where: { id: flag.entityId }, data: { disabled: true } });
      await revokeAllSessions(flag.entityId);
    }
  }
  const updated = await prisma.flaggedContent.update({
    where: { id },
    data: { status: input.action === 'REMOVE' ? 'ACTIONED' : 'DISMISSED', resolvedById: actor.id, resolution: input.note ?? input.action },
  });
  await cache.invalidateTags('admin:analytics');
  await audit(req, actor.id, `moderation.${input.action.toLowerCase()}`, flag.entityType, flag.entityId, { flagId: id, note: input.note });
  return updated;
}

/* ───── audit log ───── */
export async function listAudit(p: PageQuery, f: z.infer<typeof auditQuery>) {
  const where: Prisma.AuditLogWhereInput = {};
  if (f.action) where.action = { startsWith: f.action };
  if (f.actorId) where.actorId = f.actorId;
  if (f.from || f.to) where.createdAt = { ...(f.from ? { gte: new Date(f.from) } : {}), ...(f.to ? { lte: new Date(f.to) } : {}) };
  const [rows, total] = await Promise.all([
    prisma.auditLog.findMany({ where, ...skipTake(p), orderBy: { createdAt: 'desc' }, include: { actor: { select: { id: true, username: true } } } }),
    prisma.auditLog.count({ where }),
  ]);
  return { rows, total };
}
