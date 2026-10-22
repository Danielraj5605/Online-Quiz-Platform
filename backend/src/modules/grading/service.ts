import type { AnswerValue, PageQuery, PublishedQuiz } from '@quiz/shared';
import { z } from 'zod';
import { bulkGradeSchema, gradeAnswersSchema } from '@quiz/shared';
import { prisma } from '../../core/db';
import type { AuthUser } from '../../core/auth';
import { badRequest, notFound } from '../../core/errors';
import { audit } from '../../core/audit';
import { clean } from '../../core/sanitize';
import { effectiveScore, round2 } from './engine';
import { finalizeAttempt } from '../attempts/finalize';
import { loadVersion } from '../attempts/versions';
import { requireAttemptGrader } from '../../core/policy';
import type { Request } from 'express';

export const submissionsQuery = z.object({ status: z.enum(['pending', 'graded', 'all']).default('pending') });

const pendingWhere = { needsManual: true, manualScore: null } as const;

export async function listSubmissions(quizId: string, status: 'pending' | 'graded' | 'all', p: PageQuery) {
  const where = {
    quizId, number: { gt: 0 }, status: { in: ['SUBMITTED', 'GRADED'] as ('SUBMITTED' | 'GRADED')[] },
    answers: { some: { grade: { needsManual: true } } }, // only attempts that contain manually graded items
    ...(status === 'pending' ? { answers: { some: { grade: pendingWhere } } } : {}),
    ...(status === 'graded' ? { status: 'GRADED' as const } : {}),
    ...(p.q ? { user: { OR: [{ username: { contains: p.q, mode: 'insensitive' as const } }, { name: { contains: p.q, mode: 'insensitive' as const } }] } } : {}),
  };
  const [total, rows] = await Promise.all([
    prisma.attempt.count({ where }),
    prisma.attempt.findMany({
      where, orderBy: { submittedAt: 'asc' }, skip: (p.page - 1) * p.pageSize, take: p.pageSize,
      select: {
        id: true, status: true, number: true, submittedAt: true,
        user: { select: { id: true, username: true, name: true } },
        result: { select: { percentage: true } },
        answers: { select: { grade: { select: { needsManual: true, manualScore: true } } } },
      },
    }),
  ]);
  const items = rows.map((a) => {
    const manual = a.answers.filter((x) => x.grade?.needsManual);
    return {
      attemptId: a.id, attemptNumber: a.number, status: a.status, submittedAt: a.submittedAt?.toISOString() ?? null, user: a.user,
      pendingCount: manual.filter((x) => x.grade!.manualScore === null).length, manualCount: manual.length, percentage: a.result?.percentage ?? null,
    };
  });
  return { items, total };
}

/** Organizer view of an attempt: answers + key + rubric + grades. */
export async function getGradingView(user: AuthUser, attemptId: string) {
  const base = await requireAttemptGrader(user, attemptId);
  const attempt = await prisma.attempt.findUniqueOrThrow({
    where: { id: attemptId },
    include: { user: { select: { id: true, username: true, name: true, avatarUrl: true } }, answers: { include: { grade: true } } },
  });
  const v: PublishedQuiz = await loadVersion(base.versionId);
  const byQ = new Map(attempt.answers.map((a) => [a.questionId, a]));
  const order = attempt.questionOrder as string[];
  const rank = new Map(order.map((id, i) => [id, i]));
  const questions = [...v.questions].sort((a, b) => (rank.get(a.id) ?? 9999) - (rank.get(b.id) ?? 9999));
  return {
    attemptId, quizId: attempt.quizId, status: attempt.status, user: attempt.user, submittedAt: attempt.submittedAt?.toISOString() ?? null,
    durationSec: attempt.durationSec, tabSwitches: attempt.tabSwitches, blurSeconds: attempt.blurSeconds,
    items: questions.map((q) => {
      const a = byQ.get(q.id);
      const g = a?.grade;
      return {
        questionId: q.id, type: q.type, text: q.text, points: q.points, explanation: q.explanation, config: q.config, options: q.options,
        answerId: a?.id ?? null, value: (a?.value ?? null) as AnswerValue | null, timeSpentMs: a?.timeSpentMs ?? 0, flagged: a?.flagged ?? false,
        grade: g ? {
          autoScore: g.autoScore, manualScore: g.manualScore, needsManual: g.needsManual, isCorrect: g.isCorrect, maxScore: g.maxScore,
          feedback: g.feedback, rubricScores: g.rubricScores as number[] | null, gradedAt: g.gradedAt?.toISOString() ?? null,
          effective: effectiveScore(g).score,
        } : null,
      };
    }),
  };
}

export async function submitGrades(req: Request, user: AuthUser, attemptId: string, input: z.infer<typeof gradeAnswersSchema>) {
  const attempt = await requireAttemptGrader(user, attemptId);
  if (attempt.status === 'IN_PROGRESS') throw badRequest('Attempt is still in progress');
  const answers = await prisma.answer.findMany({ where: { attemptId, id: { in: input.grades.map((g) => g.answerId) } }, include: { grade: true } });
  const byId = new Map(answers.map((a) => [a.id, a]));
  const ops = input.grades.map((g) => {
    const a = byId.get(g.answerId);
    if (!a?.grade) throw notFound('Answer');
    if (!a.grade.needsManual) throw badRequest('Only manually graded answers can be scored by hand');
    if (g.score > a.grade.maxScore) throw badRequest(`Score cannot exceed ${a.grade.maxScore}`);
    return prisma.grade.update({
      where: { id: a.grade.id },
      data: { manualScore: round2(g.score), feedback: clean(g.feedback), rubricScores: g.rubricScores ?? undefined, graderId: user.id, gradedAt: new Date() },
    });
  });
  await prisma.$transaction(ops);
  const totals = await finalizeAttempt(attemptId);
  await audit(req, user.id, 'grading.grade', 'Attempt', attemptId, { answers: input.grades.length, final: !totals.pending });
  return { attemptId, isFinal: !totals.pending, score: totals.score, maxScore: totals.maxScore, percentage: totals.percentage };
}

export async function bulkGrade(req: Request, user: AuthUser, quizId: string, input: z.infer<typeof bulkGradeSchema>) {
  const answers = await prisma.answer.findMany({
    where: { id: { in: input.answerIds }, attempt: { quizId, number: { gt: 0 }, status: { in: ['SUBMITTED', 'GRADED'] } }, grade: { needsManual: true } },
    include: { grade: true },
  });
  if (!answers.length) throw notFound('Answers');
  const feedback = clean(input.feedback);
  await prisma.$transaction(answers.map((a) => prisma.grade.update({
    where: { id: a.grade!.id },
    data: { manualScore: round2((input.scorePct / 100) * a.grade!.maxScore), feedback, graderId: user.id, gradedAt: new Date() },
  })));
  const attemptIds = [...new Set(answers.map((a) => a.attemptId))];
  let finalized = 0;
  for (const id of attemptIds) { const t = await finalizeAttempt(id); if (!t.pending) finalized++; }
  await audit(req, user.id, 'grading.bulk', 'Quiz', quizId, { answers: answers.length, scorePct: input.scorePct, attempts: attemptIds.length });
  return { graded: answers.length, attempts: attemptIds.length, finalized };
}

export async function monitor(quizId: string) {
  const [attempts, invited, assigned, quiz] = await Promise.all([
    prisma.attempt.findMany({
      where: { quizId, number: { gt: 0 } }, orderBy: { number: 'desc' },
      select: {
        id: true, userId: true, status: true, number: true, startedAt: true, expiresAt: true, submittedAt: true, tabSwitches: true,
        lastSeenAt: true, questionOrder: true, user: { select: { username: true, name: true } }, _count: { select: { answers: true } },
      },
    }),
    prisma.invitation.findMany({ where: { quizId }, select: { userId: true } }),
    prisma.cohortMember.findMany({ where: { cohort: { deletedAt: null, assignments: { some: { quizId } } } }, select: { userId: true } }),
    prisma.quiz.findUniqueOrThrow({ where: { id: quizId }, select: { currentVersionId: true } }),
  ]);
  void quiz;
  const latest = new Map<string, (typeof attempts)[number]>();
  for (const a of attempts) if (!latest.has(a.userId)) latest.set(a.userId, a); // ordered by number desc
  const participants = [...latest.values()].map((a) => ({
    userId: a.userId, username: a.user.username, name: a.user.name, attemptId: a.id, attemptNumber: a.number, status: a.status,
    startedAt: a.startedAt.toISOString(), expiresAt: a.expiresAt?.toISOString() ?? null, submittedAt: a.submittedAt?.toISOString() ?? null,
    answered: a._count.answers, total: (a.questionOrder as string[]).length, tabSwitches: a.tabSwitches, lastSeenAt: a.lastSeenAt.toISOString(),
  }));
  const audience = new Set([...invited.map((i) => i.userId), ...assigned.map((m) => m.userId)]);
  const notStarted = [...audience].filter((id) => !latest.has(id)).length;
  return {
    participants,
    counts: {
      inProgress: participants.filter((p) => p.status === 'IN_PROGRESS').length,
      submitted: participants.filter((p) => p.status !== 'IN_PROGRESS').length,
      notStarted,
    },
  };
}
