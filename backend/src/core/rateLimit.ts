import rateLimit from 'express-rate-limit';
import { env } from './env';

const make = (windowMs: number, limit: number, message: string) =>
  rateLimit({
    windowMs, limit, standardHeaders: 'draft-7', legacyHeaders: false,
    skip: () => env.NODE_ENV === 'test',
    handler: (_req, res) => { res.status(429).json({ error: { code: 'RATE_LIMITED', message } }); },
  });

export const authLimiter = make(15 * 60_000, 20, 'Too many attempts, try again later');
export const attemptLimiter = make(60_000, 240, 'Slow down');
export const writeLimiter = make(60_000, 120, 'Too many changes, slow down');
export const readLimiter = make(60_000, 600, 'Too many requests');
