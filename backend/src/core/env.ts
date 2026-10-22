import 'dotenv/config';
import { z } from 'zod';
import crypto from 'node:crypto';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(5000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  REDIS_URL: z.string().optional().transform((v) => v || undefined),
  JWT_SECRET: z.string().optional().transform((v) => v || undefined),
  CORS_ORIGINS: z.string().default('http://localhost:5173'),
  TRUST_PROXY: z.string().default('false').transform((v) => v === 'true'),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}
const e = parsed.data;
if (e.NODE_ENV === 'production' && (!e.JWT_SECRET || e.JWT_SECRET.length < 32)) {
  console.error('JWT_SECRET (>=32 chars) is required in production');
  process.exit(1);
}

export const env = {
  ...e,
  // dev/test convenience only: ephemeral secret (tokens die on restart) instead of a hard-coded fallback
  JWT_SECRET: e.JWT_SECRET ?? crypto.randomBytes(48).toString('hex'),
  corsOrigins: e.CORS_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean),
  isProd: e.NODE_ENV === 'production',
};
