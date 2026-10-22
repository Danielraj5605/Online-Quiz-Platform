/** Registry of periodic jobs. Feature modules export a `tick` and register it here. */
import { sweepExpiredAttempts } from './modules/attempts/sweeper';
import { advanceQuizLifecycle } from './modules/quizzes/lifecycle';

export function startBackgroundJobs() {
  const run = (name: string, fn: () => Promise<unknown>) => () => fn().catch((e) => console.error(`[job:${name}]`, e));
  setInterval(run('attempts', sweepExpiredAttempts), 30_000).unref();
  setInterval(run('lifecycle', advanceQuizLifecycle), 30_000).unref();
}
