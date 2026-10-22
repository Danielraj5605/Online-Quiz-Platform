import type { Quiz } from '@prisma/client';
import type { Difficulty, QuizOverviewDto } from '@quiz/shared';
import { prisma } from '../../core/db';
import { canAccessQuiz, isAdmin } from '../../core/policy';
import type { AuthUser } from '../../core/auth';
import { loadVersion } from './versions';

/** Participant-facing overview (no answer key). Used by the daily challenge; mirrors QuizOverviewDto. */
export async function buildOverview(user: AuthUser, quiz: Quiz): Promise<QuizOverviewDto | null> {
  if (!quiz.currentVersionId) return null;
  const [v, owner, cat, tags, used, active, rating] = await Promise.all([
    loadVersion(quiz.currentVersionId),
    prisma.user.findUniqueOrThrow({ where: { id: quiz.ownerId }, select: { username: true, name: true } }),
    quiz.categoryId ? prisma.category.findUnique({ where: { id: quiz.categoryId }, select: { name: true } }) : null,
    prisma.quizTag.findMany({ where: { quizId: quiz.id }, select: { tag: { select: { name: true } } } }),
    prisma.attempt.count({ where: { quizId: quiz.id, userId: user.id, number: { gt: 0 }, status: { not: 'IN_PROGRESS' } } }),
    prisma.attempt.findFirst({ where: { quizId: quiz.id, userId: user.id, status: 'IN_PROGRESS', number: { gt: 0 } }, select: { id: true } }),
    prisma.review.aggregate({ where: { quizId: quiz.id, deletedAt: null }, _avg: { rating: true }, _count: { _all: true } }),
  ]);
  const now = new Date();
  let reason: string | undefined;
  if (quiz.ownerId === user.id || isAdmin(user)) reason = 'Owners can only preview their own quizzes';
  else if (!(await canAccessQuiz(user, quiz))) reason = 'No access';
  else if (quiz.status !== 'LIVE') reason = 'Quiz is not live';
  else if (quiz.opensAt && quiz.opensAt > now) reason = 'Quiz has not opened yet';
  else if (quiz.closesAt && quiz.closesAt <= now) reason = 'Quiz has closed';
  else if (!active && used >= v.settings.maxAttempts) reason = 'No attempts left';
  return {
    id: quiz.id, title: quiz.title, description: quiz.description, difficulty: quiz.difficulty as Difficulty, category: cat?.name ?? null,
    tags: tags.map((t) => t.tag.name), owner: owner, status: quiz.status, opensAt: quiz.opensAt?.toISOString() ?? null,
    closesAt: quiz.closesAt?.toISOString() ?? null, questionCount: v.questions.length, totalPoints: v.totalPoints,
    timeLimitSec: v.settings.timeLimitSec, maxAttempts: v.settings.maxAttempts, attemptsUsed: used, passMarkPct: v.settings.passMarkPct,
    avgRating: rating._avg.rating, ratingCount: rating._count._all, activeAttemptId: active?.id ?? null,
    canStart: !reason || (!!active && reason === 'No attempts left'), ...(reason ? { reason } : {}),
  };
}
