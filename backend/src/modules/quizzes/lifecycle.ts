import type { QuizStatus } from '@quiz/shared';
import { prisma } from '../../core/db';
import { cache } from '../../core/cache';

interface Lifecycle { status: QuizStatus; opensAt: Date | null; closesAt: Date | null }

/** Status as it should be right now, without waiting for the 30 s sweeper. DRAFT/ARCHIVED never auto-change. */
export function effectiveStatus(q: Lifecycle, now = new Date()): QuizStatus {
  if (q.status !== 'SCHEDULED' && q.status !== 'LIVE' && q.status !== 'CLOSED') return q.status;
  if (q.status === 'CLOSED') return 'CLOSED';
  if (q.closesAt && q.closesAt <= now) return 'CLOSED';
  if (q.status === 'SCHEDULED' && (!q.opensAt || q.opensAt <= now)) return 'LIVE';
  return q.status;
}

/** Status a quiz should take when (re)published or when its schedule changes. */
export function statusForSchedule(opensAt: Date | null, closesAt: Date | null, now = new Date()): QuizStatus {
  if (closesAt && closesAt <= now) return 'CLOSED';
  if (opensAt && opensAt > now) return 'SCHEDULED';
  return 'LIVE';
}

/** Periodic job: SCHEDULED→LIVE at opensAt, LIVE/SCHEDULED→CLOSED at closesAt. */
export async function advanceQuizLifecycle() {
  const now = new Date();
  const closed = await prisma.quiz.updateMany({
    where: { status: { in: ['LIVE', 'SCHEDULED'] }, closesAt: { lte: now }, deletedAt: null },
    data: { status: 'CLOSED' },
  });
  const opened = await prisma.quiz.updateMany({
    where: { status: 'SCHEDULED', opensAt: { lte: now }, deletedAt: null, OR: [{ closesAt: null }, { closesAt: { gt: now } }] },
    data: { status: 'LIVE' },
  });
  if (closed.count || opened.count) await cache.invalidateTags('catalog');
}
