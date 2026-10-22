import { Router } from 'express';
import { me, organizerOrAdmin } from '../../core/auth';
import { cached } from '../../core/cache';
import { prisma } from '../../core/db';
import { etagJson } from '../../core/etag';
import { wrap } from '../../core/http';

export const organizerRouter = Router();

async function buildDashboard(userId: string, isAdmin: boolean) {
  const mine = { deletedAt: null, ...(isAdmin ? {} : { ownerId: userId }) };
  const attemptScope = { number: { gt: 0 }, quiz: mine };

  const [live, participantRows, avg, pendingGrades, recent] = await Promise.all([
    prisma.quiz.findMany({
      where: { ...mine, status: 'LIVE' }, orderBy: { updatedAt: 'desc' }, take: 6,
      select: { id: true, title: true, closesAt: true, _count: { select: { attempts: { where: { number: { gt: 0 } } } } } },
    }),
    prisma.attempt.groupBy({ by: ['userId'], where: attemptScope }),
    prisma.result.aggregate({ where: { isFinal: true, attempt: attemptScope }, _avg: { percentage: true } }),
    prisma.grade.findMany({
      where: { needsManual: true, manualScore: null, answer: { attempt: { ...attemptScope, status: 'SUBMITTED' } } },
      select: { answer: { select: { attempt: { select: { quizId: true, quiz: { select: { title: true } } } } } } },
      take: 20_000,
    }),
    prisma.attempt.findMany({
      where: attemptScope, orderBy: { lastSeenAt: 'desc' }, take: 10,
      select: { id: true, status: true, startedAt: true, submittedAt: true, user: { select: { username: true, name: true } }, quiz: { select: { id: true, title: true } } },
    }),
  ]);

  const byQuiz = new Map<string, { quizId: string; title: string; count: number }>();
  for (const g of pendingGrades) {
    const a = g.answer.attempt;
    const e = byQuiz.get(a.quizId) ?? { quizId: a.quizId, title: a.quiz.title, count: 0 };
    e.count++;
    byQuiz.set(a.quizId, e);
  }
  const needsGrading = [...byQuiz.values()].sort((a, b) => b.count - a.count);

  return {
    kpis: {
      liveQuizzes: await prisma.quiz.count({ where: { ...mine, status: 'LIVE' } }),
      participants: participantRows.length,
      avgScorePct: Math.round((avg._avg.percentage ?? 0) * 10) / 10,
      needsGrading: pendingGrades.length,
    },
    liveQuizzes: live.map((q) => ({ id: q.id, title: q.title, closesAt: q.closesAt, attempts: q._count.attempts })),
    needsGrading,
    recentActivity: recent.map((a) => ({
      attemptId: a.id, quizId: a.quiz.id, quizTitle: a.quiz.title, username: a.user.username, name: a.user.name,
      status: a.status, at: (a.submittedAt ?? a.startedAt).toISOString(),
    })),
  };
}

organizerRouter.get('/organizer/dashboard', organizerOrAdmin, wrap(async (req, res) => {
  const u = me(req);
  // short TTL; quiz-scoped invalidation is not practical for a cross-quiz rollup
  const data = await cached(`organizer:dashboard:${u.id}`, 20, [`user:${u.id}`], () => buildDashboard(u.id, u.role === 'ADMIN'));
  etagJson(req, res, data);
}));
