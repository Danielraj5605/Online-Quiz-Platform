import { Router } from 'express';
import { z } from 'zod';
import { attemptEventSchema, saveAnswersSchema } from '@quiz/shared';
import { me } from '../../core/auth';
import { body, idParam, ok, query, wrap } from '../../core/http';
import { attemptLimiter } from '../../core/rateLimit';
import { requireAttemptTaker } from '../../core/policy';
import * as svc from './service';

export const attemptsRouter = Router();

const startQuery = z.object({ preview: z.enum(['1', 'true', '0', 'false']).optional() });
const submitBody = z.object({ answers: saveAnswersSchema.shape.answers.optional() }).default({});

attemptsRouter.post('/quizzes/:id/attempts', attemptLimiter, wrap(async (req, res) => {
  const preview = ['1', 'true'].includes(query(startQuery, req).preview ?? '');
  const view = await svc.startAttempt(me(req), idParam(req), preview);
  ok(res, view, undefined, 200);
}));

attemptsRouter.get('/attempts/:id', wrap(async (req, res) => {
  const a = await requireAttemptTaker(me(req), idParam(req));
  res.setHeader('Cache-Control', 'no-store');
  ok(res, await svc.getAttemptView(a));
}));

attemptsRouter.put('/attempts/:id/answers', attemptLimiter, wrap(async (req, res) => {
  const a = await requireAttemptTaker(me(req), idParam(req));
  ok(res, await svc.saveAnswers(a, body(saveAnswersSchema, req)));
}));

attemptsRouter.post('/attempts/:id/events', attemptLimiter, wrap(async (req, res) => {
  const a = await requireAttemptTaker(me(req), idParam(req));
  ok(res, await svc.recordEvent(a, body(attemptEventSchema, req)));
}));

attemptsRouter.post('/attempts/:id/submit', attemptLimiter, wrap(async (req, res) => {
  const user = me(req);
  const a = await requireAttemptTaker(user, idParam(req));
  const { answers } = body(submitBody, req);
  // optional final flush of unsaved answers (e.g. after an offline spell); ignored once the attempt is closed
  if (answers?.length && a.status === 'IN_PROGRESS') {
    try { await svc.saveAnswers(a, { answers }); } catch (e) { if ((e as { code?: string }).code !== 'ATTEMPT_EXPIRED') throw e; }
  }
  await svc.submitAttempt(a.id);
  res.setHeader('Cache-Control', 'no-store');
  ok(res, await svc.getResult(user, a.id));
}));

attemptsRouter.get('/attempts/:id/result', wrap(async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  ok(res, await svc.getResult(me(req), idParam(req)));
}));

