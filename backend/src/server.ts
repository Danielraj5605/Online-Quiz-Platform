import { createApp } from './app';
import { env } from './core/env';
import { prisma } from './core/db';
import { startBackgroundJobs } from './jobs';

const app = createApp();
const server = app.listen(env.PORT, () => {
  console.log(`API listening on :${env.PORT} (${env.NODE_ENV})`);
  startBackgroundJobs();
});

const shutdown = async () => {
  server.close();
  await prisma.$disconnect();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
