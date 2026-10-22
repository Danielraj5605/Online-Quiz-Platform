import { prisma } from '../../core/db';
import { GRACE_MS, submitAttempt } from './service';

/** Auto-submits attempts whose deadline (plus the autosave grace) has passed. Runs every 30 s. */
export async function sweepExpiredAttempts() {
  const rows = await prisma.attempt.findMany({
    where: { status: 'IN_PROGRESS', expiresAt: { lt: new Date(Date.now() - GRACE_MS) } },
    select: { id: true },
    take: 100,
  });
  for (const r of rows) {
    try { await submitAttempt(r.id); } catch (e) { console.error('[sweeper] failed to submit', r.id, e); }
  }
  return rows.length;
}
