import { Router } from 'express';
import { z } from 'zod';
import { cohortMembersSchema, cohortSchema, pageQuery } from '@quiz/shared';
import { me, organizerOrAdmin } from '../../core/auth';
import { prisma } from '../../core/db';
import { cache } from '../../core/cache';
import { body, created, idParam, noContent, ok, orderBy, pageMeta, query, skipTake, wrap } from '../../core/http';
import { etagJson } from '../../core/etag';
import { notFound } from '../../core/errors';
import { clean } from '../../core/sanitize';
import { isAdmin } from '../../core/policy';
import { writeLimiter } from '../../core/rateLimit';

export const cohortsRouter = Router();
cohortsRouter.use('/cohorts', organizerOrAdmin);

async function owned(req: Parameters<typeof me>[0], id: string) {
  const c = await prisma.cohort.findFirst({ where: { id, deletedAt: null } });
  if (!c || (c.ownerId !== me(req).id && !isAdmin(me(req)))) throw notFound('Cohort');
  return c;
}
const dto = (c: { id: string; name: string; description: string; createdAt: Date; _count: { members: number } }) => ({
  id: c.id, name: c.name, description: c.description, memberCount: c._count.members, createdAt: c.createdAt.toISOString(),
});

const members = async (cohortId: string) =>
  (await prisma.cohortMember.findMany({
    where: { cohortId, user: { deletedAt: null } }, orderBy: { addedAt: 'desc' },
    select: { addedAt: true, user: { select: { id: true, username: true, name: true, email: true, avatarUrl: true } } },
  })).map((m) => ({ ...m.user, addedAt: m.addedAt.toISOString() }));

/** Cohorts feed quiz access, so membership changes must refresh cached catalog/assignment data. */
const touchCohortQuizzes = async (cohortId: string) => {
  const links = await prisma.quizAssignment.findMany({ where: { cohortId }, select: { quizId: true } });
  await cache.invalidateTags('catalog', ...links.map((l) => `quiz:${l.quizId}`));
};

cohortsRouter.get('/cohorts', wrap(async (req, res) => {
  const u = me(req);
  const q = query(pageQuery, req);
  const where = { deletedAt: null, ...(isAdmin(u) ? {} : { ownerId: u.id }), ...(q.q ? { name: { contains: q.q, mode: 'insensitive' as const } } : {}) };
  const [total, rows] = await Promise.all([
    prisma.cohort.count({ where }),
    prisma.cohort.findMany({ where, ...skipTake(q), orderBy: orderBy(q.sort, ['name', 'createdAt'] as const, { createdAt: 'desc' }), include: { _count: { select: { members: true } } } }),
  ]);
  etagJson(req, res, rows.map(dto), pageMeta(q.page, q.pageSize, total));
}));

cohortsRouter.post('/cohorts', writeLimiter, wrap(async (req, res) => {
  const input = body(cohortSchema, req);
  const c = await prisma.cohort.create({
    data: { ownerId: me(req).id, name: clean(input.name), description: clean(input.description) }, include: { _count: { select: { members: true } } },
  });
  created(res, dto(c));
}));

cohortsRouter.get('/cohorts/:id', wrap(async (req, res) => {
  const c = await owned(req, idParam(req));
  const full = await prisma.cohort.findUniqueOrThrow({ where: { id: c.id }, include: { _count: { select: { members: true } } } });
  ok(res, { ...dto(full), members: await members(c.id) });
}));

cohortsRouter.patch('/cohorts/:id', writeLimiter, wrap(async (req, res) => {
  const c = await owned(req, idParam(req));
  const input = body(cohortSchema.partial().extend({ name: z.string().trim().min(2).max(80).optional(), description: z.string().trim().max(500).optional() }), req);
  const u = await prisma.cohort.update({
    where: { id: c.id },
    data: { name: input.name === undefined ? undefined : clean(input.name), description: input.description === undefined ? undefined : clean(input.description) },
    include: { _count: { select: { members: true } } },
  });
  ok(res, dto(u));
}));

cohortsRouter.delete('/cohorts/:id', writeLimiter, wrap(async (req, res) => {
  const c = await owned(req, idParam(req));
  await touchCohortQuizzes(c.id);
  await prisma.$transaction([
    prisma.quizAssignment.deleteMany({ where: { cohortId: c.id } }),
    prisma.cohort.update({ where: { id: c.id }, data: { deletedAt: new Date() } }),
  ]);
  noContent(res);
}));

cohortsRouter.post('/cohorts/:id/members', writeLimiter, wrap(async (req, res) => {
  const c = await owned(req, idParam(req));
  const { identifiers } = body(cohortMembersSchema, req);
  const ids = [...new Set(identifiers.map((s) => s.toLowerCase()))];
  const users = await prisma.user.findMany({
    where: { deletedAt: null, disabled: false, OR: [{ email: { in: ids } }, { username: { in: identifiers, mode: 'insensitive' } }] },
    select: { id: true, username: true, email: true },
  });
  const found = new Set(users.flatMap((u) => [u.email.toLowerCase(), u.username.toLowerCase()]));
  const result = await prisma.cohortMember.createMany({ data: users.map((u) => ({ cohortId: c.id, userId: u.id })), skipDuplicates: true });
  await touchCohortQuizzes(c.id);
  ok(res, { added: result.count, notFound: ids.filter((i) => !found.has(i)), members: await members(c.id) });
}));

cohortsRouter.delete('/cohorts/:id/members/:userId', writeLimiter, wrap(async (req, res) => {
  const c = await owned(req, idParam(req));
  await prisma.cohortMember.deleteMany({ where: { cohortId: c.id, userId: idParam(req, 'userId') } });
  await touchCohortQuizzes(c.id);
  noContent(res);
}));
