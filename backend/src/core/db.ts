import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { env } from './env';

const adapter = new PrismaPg({
  connectionString: env.DATABASE_URL,
  max: 8,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 20_000,
});

export const prisma = new PrismaClient({ adapter, log: env.isProd ? ['error'] : ['error', 'warn'] });
export type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];
