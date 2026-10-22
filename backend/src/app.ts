import express, { type NextFunction, type Request, type Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { ZodError } from 'zod';
import { env } from './core/env';
import { prisma } from './core/db';
import { AppError } from './core/errors';
import { readLimiter } from './core/rateLimit';
import { apiRouter } from './routes';

export function createApp() {
  const app = express();
  if (env.TRUST_PROXY) app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({
    origin(origin, cb) {
      // same-origin / curl / server-to-server have no Origin header
      if (!origin || env.corsOrigins.includes(origin)) return cb(null, true);
      cb(null, false);
    },
    credentials: true,
    exposedHeaders: ['ETag', 'Content-Disposition'],
  }));
  app.use(express.json({ limit: '256kb' }));
  app.use(cookieParser());

  app.get('/health', async (_req, res) => {
    try { await prisma.$queryRaw`SELECT 1`; res.json({ status: 'ok' }); }
    catch { res.status(503).json({ status: 'degraded' }); }
  });

  app.use('/api/v1', readLimiter, apiRouter);
  app.use('/api', (_req, res) => { res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Unknown endpoint' } }); });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof AppError) {
      return res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } });
    }
    if (err instanceof ZodError) {
      return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Invalid input', details: err.issues } });
    }
    const e = err as { type?: string; status?: number; code?: string };
    if (e?.type === 'entity.parse.failed') return res.status(400).json({ error: { code: 'BAD_JSON', message: 'Malformed JSON' } });
    if (e?.type === 'entity.too.large') return res.status(413).json({ error: { code: 'TOO_LARGE', message: 'Payload too large' } });
    if (e?.code === 'P2025') return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Resource not found' } });
    if (e?.code === 'P2002') return res.status(409).json({ error: { code: 'CONFLICT', message: 'Already exists' } });
    console.error(`[${req.method} ${req.path}]`, err);
    res.status(500).json({ error: { code: 'INTERNAL', message: 'Something went wrong' } });
  });
  return app;
}
