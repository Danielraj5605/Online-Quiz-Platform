import { Router } from 'express';
import { pageQuery, reviewSchema } from '@quiz/shared';
import { me } from '../../core/auth';
import { prisma } from '../../core/db';
import { body, idParam, noContent, ok, pageMeta, query, skipTake, wrap } from '../../core/http';
import { writeLimiter } from '../../core/rateLimit';
import { cache } from '../../core/cache';
import { clean } from '../../core/sanitize';
import { forbidden } from '../../core/errors';
import { requireQuizAccess } from '../../core/policy';

export const reviewsRouter = Router();

const invalidate = (quizId: string) => cache.invalidateTags(`quiz:${quizId}`, 'catalog');

reviewsRouter.get('/quizzes/:id/reviews', wrap(async (req, res) => {
  const user = me(req);
  const quiz = await requireQuizAccess(user, idParam(req));
  const p = query(pageQuery, req);
  const where = { quizId: quiz.id, deletedAt: null };
  const [total, rows, agg, mine] = await Promise.all([
    prisma.review.count({ where }),
    prisma.review.findMany({
      where, orderBy: { createdAt: 'desc' }, ...skipTake(p),
      select: { id: true, rating: true, comment: true, createdAt: true, user: { select: { id: true, username: true, name: true, avatarUrl: true } } },
    }),
    prisma.review.aggregate({ where, _avg: { rating: true }, _count: { _all: true } }),
    prisma.review.findFirst({ where: { ...where, userId: user.id }, select: { id: true, rating: true, comment: true } }),
  ]);
  ok(res, {
    items: rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })),
    average: agg._avg.rating === null ? null : Math.round(agg._avg.rating * 10) / 10, count: agg._count._all, mine,
  }, pageMeta(p.page, p.pageSize, total));
}));

reviewsRouter.post('/quizzes/:id/reviews', writeLimiter, wrap(async (req, res) => {
  const user = me(req);
  const quiz = await requireQuizAccess(user, idParam(req));
  if (quiz.ownerId === user.id) throw forbidden('You cannot review your own quiz');
  const completed = await prisma.attempt.count({ where: { quizId: quiz.id, userId: user.id, number: { gt: 0 }, status: { in: ['SUBMITTED', 'GRADED'] } } });
  if (!completed) throw forbidden('Complete the quiz before reviewing it');
  const input = body(reviewSchema, req);
  const data = { rating: input.rating, comment: clean(input.comment), deletedAt: null };
  const r = await prisma.review.upsert({
    where: { quizId_userId: { quizId: quiz.id, userId: user.id } },
    create: { quizId: quiz.id, userId: user.id, ...data }, update: data,
    select: { id: true, rating: true, comment: true },
  });
  await invalidate(quiz.id);
  ok(res, r);
}));

reviewsRouter.delete('/quizzes/:id/reviews', writeLimiter, wrap(async (req, res) => {
  const user = me(req);
  const quiz = await requireQuizAccess(user, idParam(req));
  await prisma.review.updateMany({ where: { quizId: quiz.id, userId: user.id, deletedAt: null }, data: { deletedAt: new Date() } });
  await invalidate(quiz.id);
  noContent(res);
}));
