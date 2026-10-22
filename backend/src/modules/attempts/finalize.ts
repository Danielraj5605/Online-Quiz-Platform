import type { AnswerValue, PublishedQuiz } from '@quiz/shared';
import { tierFor } from '@quiz/shared';
import { prisma, type Tx } from '../../core/db';
import { cache } from '../../core/cache';
import { awardForResult, ensureBadges } from '../../core/gamification';
import { effectiveScore, gradeAnswer, scoreAttempt, type AttemptTotals } from '../grading/engine';
import { loadVersion } from './versions';

const todayUtc = () => { const d = new Date(); return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())); };

let badgesReady: Promise<void> | null = null;
/** Badge rows must exist before they can be awarded; seeded lazily once per process. */
export const ensureBadgesOnce = () => (badgesReady ??= ensureBadges().catch((e) => { badgesReady = null; throw e; }));

export async function invalidateQuizCaches(quizId: string) {
  await cache.invalidateTags(`quiz:${quizId}`, 'leaderboard:global');
}

/**
 * (Re)creates Grade rows for every saved answer from the version's answer key.
 * Manual scores/feedback are preserved; answers whose question no longer exists in the version lose their grade.
 */
export async function gradeObjective(attemptId: string, version?: PublishedQuiz) {
  const attempt = await prisma.attempt.findUniqueOrThrow({ where: { id: attemptId }, include: { answers: { include: { grade: true } } } });
  const v = version ?? (await loadVersion(attempt.versionId));
  const qmap = new Map(v.questions.map((q) => [q.id, q]));
  const ops = [];
  for (const a of attempt.answers) {
    const q = qmap.get(a.questionId);
    if (!q) {
      if (a.grade) ops.push(prisma.grade.delete({ where: { id: a.grade.id } }));
      continue;
    }
    const o = gradeAnswer(q, a.value as AnswerValue, v.settings);
    const data = { maxScore: o.maxScore, autoScore: o.needsManual ? null : o.score, needsManual: o.needsManual, isCorrect: o.isCorrect };
    ops.push(prisma.grade.upsert({
      where: { answerId: a.id },
      create: { answerId: a.id, ...data },
      update: o.needsManual ? data : { ...data, manualScore: null },
    }));
  }
  if (ops.length) await prisma.$transaction(ops);
}

/** Totals computed live from Grade rows against the attempt's version. */
export async function computeTotals(attemptId: string, version?: PublishedQuiz): Promise<AttemptTotals> {
  const attempt = await prisma.attempt.findUniqueOrThrow({ where: { id: attemptId }, include: { answers: { include: { grade: true } } } });
  const v = version ?? (await loadVersion(attempt.versionId));
  const eff: Record<string, { score: number; pending: boolean }> = {};
  for (const a of attempt.answers) if (a.grade) eff[a.questionId] = effectiveScore(a.grade);
  return scoreAttempt(v.questions, eff, v.settings);
}

/**
 * Recomputes totals, upserts the Result (never for preview attempts, number 0), moves the attempt to
 * SUBMITTED/GRADED, and — once, on the first final result per user+quiz — awards XP/badges.
 */
export async function finalizeAttempt(attemptId: string) {
  const attempt = await prisma.attempt.findUniqueOrThrow({ where: { id: attemptId } });
  const v = await loadVersion(attempt.versionId);
  const totals = await computeTotals(attemptId, v);
  const isFinal = !totals.pending;
  const preview = attempt.number === 0;
  if (isFinal && !preview) await ensureBadgesOnce();

  await prisma.$transaction(async (tx: Tx) => {
    if (attempt.status === 'SUBMITTED' || attempt.status === 'GRADED') {
      await tx.attempt.update({ where: { id: attemptId }, data: { status: isFinal ? 'GRADED' : 'SUBMITTED' } });
    }
    if (preview) return;
    const existing = await tx.result.findUnique({ where: { attemptId } });
    await tx.result.upsert({
      where: { attemptId },
      create: { attemptId, quizId: attempt.quizId, userId: attempt.userId, score: totals.score, maxScore: totals.maxScore, percentage: totals.percentage, band: totals.band, passed: totals.passed, isFinal },
      update: { score: totals.score, maxScore: totals.maxScore, percentage: totals.percentage, band: totals.band, passed: totals.passed, isFinal },
    });
    if (!isFinal || existing?.isFinal) return;
    const otherFinal = await tx.result.count({ where: { userId: attempt.userId, quizId: attempt.quizId, isFinal: true, NOT: { attemptId } } });
    if (otherFinal === 0) {
      await awardForResult(tx, attempt.userId, { pct: totals.percentage, passed: totals.passed, durationSec: attempt.durationSec, timeLimitSec: v.settings.timeLimitSec });
    }
    // daily challenge bonus: first final result on today's challenge quiz, once per day
    const challenge = await tx.dailyChallenge.findUnique({ where: { date: todayUtc() } });
    if (challenge && challenge.quizId === attempt.quizId) {
      const earlierToday = await tx.result.count({
        where: { userId: attempt.userId, quizId: attempt.quizId, isFinal: true, createdAt: { gte: todayUtc() }, NOT: { attemptId } },
      });
      if (earlierToday === 0) {
        const u = await tx.user.update({ where: { id: attempt.userId }, data: { xp: { increment: challenge.xpBonus } } });
        const tier = tierFor(u.xp);
        if (tier !== u.tier) await tx.user.update({ where: { id: attempt.userId }, data: { tier } });
      }
    }
  }, { maxWait: 20_000, timeout: 30_000 });

  await invalidateQuizCaches(attempt.quizId);
  await cache.invalidateTags(`user:${attempt.userId}`);
  return totals;
}
