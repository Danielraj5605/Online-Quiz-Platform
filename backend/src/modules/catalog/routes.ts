import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { DIFFICULTIES } from '@quiz/shared';
import { me } from '../../core/auth';
import { env } from '../../core/env';
import { body, idParam, ok, pageMeta, query, wrap } from '../../core/http';
import { etagJson } from '../../core/etag';
import * as svc from './service';

export const catalogRouter = Router();

// access codes are guessable by brute force: keep this tighter than the global limiter
const joinLimiter = rateLimit({
  windowMs: 10 * 60_000, limit: 30, standardHeaders: 'draft-7', legacyHeaders: false, skip: () => env.NODE_ENV === 'test',
  handler: (_req, res) => { res.status(429).json({ error: { code: 'RATE_LIMITED', message: 'Too many code attempts, try again later' } }); },
});

const catalogQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(12),
  q: z.string().trim().max(100).optional(),
  categoryId: z.string().max(40).optional(),
  difficulty: z.enum(DIFFICULTIES).optional(),
  tag: z.string().trim().max(30).optional(),
});

catalogRouter.get('/catalog', wrap(async (req, res) => {
  const f = query(catalogQuery, req);
  const { items, total } = await svc.catalogList(me(req), f);
  etagJson(req, res, items, pageMeta(f.page, f.pageSize, total));
}));

catalogRouter.post('/catalog/join', joinLimiter, wrap(async (req, res) => {
  const { code } = body(z.object({ code: z.string().trim().min(4).max(20) }), req);
  ok(res, await svc.joinByCode(me(req), code));
}));

catalogRouter.get('/catalog/:id', wrap(async (req, res) => ok(res, await svc.catalogDetail(me(req), idParam(req)))));

catalogRouter.get('/me/assignments', wrap(async (req, res) => ok(res, await svc.myAssignments(me(req)))));
