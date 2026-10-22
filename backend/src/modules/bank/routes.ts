import { Router } from 'express';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { bankQuestionSchema, pageQuery, questionInputSchema, QUESTION_TYPES, type QuestionInput } from '@quiz/shared';
import { me, organizerOrAdmin } from '../../core/auth';
import { prisma } from '../../core/db';
import { body, created, idParam, noContent, ok, orderBy, pageMeta, query, skipTake, wrap } from '../../core/http';
import { etagJson } from '../../core/etag';
import { badRequest, notFound } from '../../core/errors';
import { clean } from '../../core/sanitize';
import { isAdmin } from '../../core/policy';
import { writeLimiter } from '../../core/rateLimit';

export const bankRouter = Router();
bankRouter.use('/bank', organizerOrAdmin);

const listQuery = pageQuery.extend({
  type: z.enum(QUESTION_TYPES).optional(),
  categoryId: z.string().max(40).optional(),
  tag: z.string().max(30).optional(),
});

type Row = Prisma.BankQuestionGetPayload<object>;
const dto = (b: Row) => ({
  id: b.id, type: b.type, text: b.text, explanation: b.explanation, points: b.points, tags: b.tags, categoryId: b.categoryId,
  options: b.options as { text: string; isCorrect: boolean }[], config: b.config, createdAt: b.createdAt.toISOString(),
});

/** Same cross-field rules as quiz questions (e.g. exactly one correct option). */
function validated(input: z.infer<typeof bankQuestionSchema>): QuestionInput {
  const r = questionInputSchema.safeParse({ type: input.type, text: input.text, explanation: input.explanation, points: input.points, options: input.options, config: input.config });
  if (!r.success) throw badRequest('Invalid question', r.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })));
  return r.data;
}

function data(input: z.infer<typeof bankQuestionSchema>) {
  const q = validated(input);
  return {
    type: q.type, text: clean(q.text), explanation: clean(q.explanation), points: q.points,
    tags: [...new Set(input.tags.map((t) => clean(t).toLowerCase()).filter(Boolean))],
    categoryId: input.categoryId ?? null,
    options: q.options.map((o) => ({ text: clean(o.text), isCorrect: o.isCorrect })) as Prisma.InputJsonValue,
    config: { ...q.config, acceptedAnswers: q.config.acceptedAnswers.map(clean), rubric: q.config.rubric.map((r) => ({ ...r, criterion: clean(r.criterion) })) } as Prisma.InputJsonValue,
  };
}

async function owned(req: Parameters<typeof me>[0], id: string) {
  const b = await prisma.bankQuestion.findFirst({ where: { id, deletedAt: null } });
  if (!b || (b.ownerId !== me(req).id && !isAdmin(me(req)))) throw notFound('Bank question');
  return b;
}
async function checkCategory(id: string | null | undefined) {
  if (id && !(await prisma.category.findUnique({ where: { id }, select: { id: true } }))) throw badRequest('Unknown category');
}

bankRouter.get('/bank', wrap(async (req, res) => {
  const u = me(req);
  const q = query(listQuery, req);
  const where: Prisma.BankQuestionWhereInput = {
    deletedAt: null, ...(isAdmin(u) ? {} : { ownerId: u.id }),
    ...(q.type ? { type: q.type } : {}), ...(q.categoryId ? { categoryId: q.categoryId } : {}), ...(q.tag ? { tags: { has: q.tag.toLowerCase() } } : {}),
    ...(q.q ? { text: { contains: q.q, mode: 'insensitive' } } : {}),
  };
  const [total, rows] = await Promise.all([
    prisma.bankQuestion.count({ where }),
    prisma.bankQuestion.findMany({ where, ...skipTake(q), orderBy: orderBy(q.sort, ['createdAt', 'points', 'type'] as const, { createdAt: 'desc' }) }),
  ]);
  etagJson(req, res, rows.map(dto), pageMeta(q.page, q.pageSize, total));
}));

bankRouter.post('/bank', writeLimiter, wrap(async (req, res) => {
  const input = body(bankQuestionSchema, req);
  await checkCategory(input.categoryId);
  created(res, dto(await prisma.bankQuestion.create({ data: { ownerId: me(req).id, ...data(input) } })));
}));

bankRouter.patch('/bank/:id', writeLimiter, wrap(async (req, res) => {
  const b = await owned(req, idParam(req));
  const input = body(bankQuestionSchema, req);
  await checkCategory(input.categoryId);
  ok(res, dto(await prisma.bankQuestion.update({ where: { id: b.id }, data: data(input) })));
}));

bankRouter.delete('/bank/:id', writeLimiter, wrap(async (req, res) => {
  const b = await owned(req, idParam(req));
  await prisma.bankQuestion.update({ where: { id: b.id }, data: { deletedAt: new Date() } });
  noContent(res);
}));
