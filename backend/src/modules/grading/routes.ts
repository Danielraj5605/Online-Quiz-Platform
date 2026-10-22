import { Router } from 'express';
import { bulkGradeSchema, gradeAnswersSchema, pageQuery } from '@quiz/shared';
import { z } from 'zod';
import { me } from '../../core/auth';
import { body, idParam, ok, pageMeta, query, wrap } from '../../core/http';
import { writeLimiter } from '../../core/rateLimit';
import { requireQuizOwner } from '../../core/policy';
import * as svc from './service';

export const gradingRouter = Router();

const listQuery = pageQuery.extend({ status: z.enum(['pending', 'graded', 'all']).default('pending') });

gradingRouter.get('/quizzes/:id/grading/submissions', wrap(async (req, res) => {
  const quiz = await requireQuizOwner(me(req), idParam(req));
  const q = query(listQuery, req);
  const { items, total } = await svc.listSubmissions(quiz.id, q.status, q);
  ok(res, items, pageMeta(q.page, q.pageSize, total));
}));

gradingRouter.get('/attempts/:id/grading', wrap(async (req, res) => {
  ok(res, await svc.getGradingView(me(req), idParam(req)));
}));

gradingRouter.put('/attempts/:id/grading', writeLimiter, wrap(async (req, res) => {
  ok(res, await svc.submitGrades(req, me(req), idParam(req), body(gradeAnswersSchema, req)));
}));

gradingRouter.post('/quizzes/:id/grading/bulk', writeLimiter, wrap(async (req, res) => {
  const quiz = await requireQuizOwner(me(req), idParam(req));
  ok(res, await svc.bulkGrade(req, me(req), quiz.id, body(bulkGradeSchema, req)));
}));

gradingRouter.get('/quizzes/:id/monitor', wrap(async (req, res) => {
  const quiz = await requireQuizOwner(me(req), idParam(req));
  res.setHeader('Cache-Control', 'no-store');
  ok(res, await svc.monitor(quiz.id));
}));
