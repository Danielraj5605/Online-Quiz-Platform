import { Router } from 'express';
import { z } from 'zod';
import { createQuizSchema, questionInputSchema, reorderSchema } from '@quiz/shared';
import { me, organizerOrAdmin } from '../../core/auth';
import { writeLimiter } from '../../core/rateLimit';
import { body, created, idParam, noContent, ok, query, wrap } from '../../core/http';
import { etagJson } from '../../core/etag';
import { audit } from '../../core/audit';
import { requireQuizOwner } from '../../core/policy';
import * as svc from './service';
import { loadDetail } from './mappers';

export const quizzesRouter = Router();
const staff = [organizerOrAdmin];
const write = [organizerOrAdmin, writeLimiter];

quizzesRouter.get('/quizzes', ...staff, wrap(async (req, res) => {
  const { items, meta } = await svc.listQuizzes(me(req), query(svc.listQuery, req));
  etagJson(req, res, items, meta);
}));
quizzesRouter.post('/quizzes', ...write, wrap(async (req, res) => {
  created(res, await svc.createQuiz(me(req), body(createQuizSchema, req)));
}));
quizzesRouter.get('/quizzes/:id', ...staff, wrap(async (req, res) => {
  const user = me(req);
  const id = idParam(req);
  await requireQuizOwner(user, id);
  ok(res, await loadDetail(id));
}));
quizzesRouter.patch('/quizzes/:id', ...write, wrap(async (req, res) => {
  ok(res, await svc.updateQuiz(me(req), idParam(req), req.body));
}));
quizzesRouter.delete('/quizzes/:id', ...write, wrap(async (req, res) => {
  const id = idParam(req);
  await svc.deleteQuiz(me(req), id);
  await audit(req, me(req).id, 'quiz.delete', 'Quiz', id);
  noContent(res);
}));
quizzesRouter.post('/quizzes/:id/duplicate', ...write, wrap(async (req, res) => {
  created(res, await svc.duplicateQuiz(me(req), idParam(req)));
}));

// lifecycle
quizzesRouter.post('/quizzes/:id/publish', ...write, wrap(async (req, res) => ok(res, await svc.publishQuiz(me(req), idParam(req)))));
quizzesRouter.post('/quizzes/:id/close', ...write, wrap(async (req, res) => ok(res, await svc.closeQuiz(me(req), idParam(req)))));
quizzesRouter.post('/quizzes/:id/archive', ...write, wrap(async (req, res) => ok(res, await svc.archiveQuiz(me(req), idParam(req)))));
quizzesRouter.post('/quizzes/:id/reopen', ...write, wrap(async (req, res) => ok(res, await svc.reopenQuiz(me(req), idParam(req)))));
quizzesRouter.get('/quizzes/:id/versions', ...staff, wrap(async (req, res) => ok(res, await svc.listVersions(me(req), idParam(req)))));
quizzesRouter.post('/quizzes/:id/regrade', ...write, wrap(async (req, res) => {
  const { versionId } = body(z.object({ versionId: z.string().max(40).optional() }), req);
  ok(res, await svc.regrade(me(req), idParam(req), versionId));
}));

// sections
quizzesRouter.post('/quizzes/:id/sections', ...write, wrap(async (req, res) => {
  created(res, await svc.addSection(me(req), idParam(req), body(svc.sectionSchemas.create, req)));
}));
quizzesRouter.patch('/sections/:id', ...write, wrap(async (req, res) => {
  ok(res, await svc.patchSection(me(req), idParam(req), body(svc.sectionSchemas.patch, req)));
}));
quizzesRouter.delete('/sections/:id', ...write, wrap(async (req, res) => {
  await svc.deleteSection(me(req), idParam(req));
  noContent(res);
}));

// questions (PATCH replaces the whole question: send the full question input)
quizzesRouter.post('/quizzes/:id/questions', ...write, wrap(async (req, res) => {
  created(res, await svc.addQuestion(me(req), idParam(req), body(questionInputSchema, req)));
}));
quizzesRouter.patch('/questions/:id', ...write, wrap(async (req, res) => {
  ok(res, await svc.replaceQuestion(me(req), idParam(req), body(questionInputSchema, req)));
}));
quizzesRouter.delete('/questions/:id', ...write, wrap(async (req, res) => {
  await svc.deleteQuestion(me(req), idParam(req));
  noContent(res);
}));
quizzesRouter.post('/quizzes/:id/reorder', ...write, wrap(async (req, res) => {
  ok(res, await svc.reorder(me(req), idParam(req), body(reorderSchema, req)));
}));
quizzesRouter.post('/quizzes/:id/import-bank', ...write, wrap(async (req, res) => {
  const { bankIds, sectionId } = body(z.object({ bankIds: z.array(z.string().max(40)).min(1).max(100), sectionId: z.string().nullable().optional() }), req);
  ok(res, await svc.importBank(me(req), idParam(req), bankIds, sectionId));
}));

// access
quizzesRouter.get('/quizzes/:id/access', ...staff, wrap(async (req, res) => ok(res, await svc.getAccess(me(req), idParam(req)))));
quizzesRouter.put('/quizzes/:id/access', ...write, wrap(async (req, res) => {
  ok(res, await svc.updateAccess(me(req), idParam(req), body(svc.accessUpdate, req)));
}));
