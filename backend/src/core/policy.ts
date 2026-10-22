/**
 * Centralised authorization. Every service that touches a quiz/attempt/result calls one of these —
 * never inline ownership checks.
 */
import type { Quiz } from '@prisma/client';
import { prisma } from './db';
import { forbidden, notFound } from './errors';
import type { AuthUser } from './auth';

export const isAdmin = (u: AuthUser) => u.role === 'ADMIN';

/** Loads a non-deleted quiz the user owns (or any quiz for Admin). 404 for others to avoid probing. */
export async function requireQuizOwner(user: AuthUser, quizId: string): Promise<Quiz> {
  const quiz = await prisma.quiz.findFirst({ where: { id: quizId, deletedAt: null } });
  if (!quiz) throw notFound('Quiz');
  if (quiz.ownerId !== user.id && !isAdmin(user)) throw notFound('Quiz');
  return quiz;
}

/** Can the user see/start this quiz as a participant? (Owner/Admin always can.) */
export async function canAccessQuiz(user: AuthUser, quiz: Pick<Quiz, 'id' | 'ownerId' | 'visibility' | 'status'>): Promise<boolean> {
  if (quiz.ownerId === user.id || isAdmin(user)) return true;
  if (quiz.status !== 'LIVE' && quiz.status !== 'SCHEDULED' && quiz.status !== 'CLOSED') return false;
  if (quiz.visibility === 'PUBLIC') return true;
  const [inv, assigned] = await Promise.all([
    prisma.invitation.findUnique({ where: { quizId_userId: { quizId: quiz.id, userId: user.id } }, select: { userId: true } }),
    prisma.quizAssignment.findFirst({ where: { quizId: quiz.id, cohort: { deletedAt: null, members: { some: { userId: user.id } } } }, select: { quizId: true } }),
  ]);
  return !!(inv || assigned);
}

export async function requireQuizAccess(user: AuthUser, quizId: string): Promise<Quiz> {
  const quiz = await prisma.quiz.findFirst({ where: { id: quizId, deletedAt: null } });
  if (!quiz || !(await canAccessQuiz(user, quiz))) throw notFound('Quiz');
  return quiz;
}

/** Attempt visible to its taker, the quiz owner, or Admin. */
export async function requireAttemptViewer(user: AuthUser, attemptId: string) {
  const a = await prisma.attempt.findUnique({ where: { id: attemptId }, include: { quiz: { select: { ownerId: true, deletedAt: true } } } });
  if (!a) throw notFound('Attempt');
  const isTaker = a.userId === user.id;
  const isQuizOwner = a.quiz.ownerId === user.id;
  if (!isTaker && !isQuizOwner && !isAdmin(user)) throw notFound('Attempt');
  return { attempt: a, isTaker, isQuizOwner: isQuizOwner || isAdmin(user) };
}

export async function requireAttemptTaker(user: AuthUser, attemptId: string) {
  const a = await prisma.attempt.findUnique({ where: { id: attemptId } });
  if (!a || a.userId !== user.id) throw notFound('Attempt');
  return a;
}

/** Quiz owner (or Admin) of the quiz an attempt belongs to — for grading. */
export async function requireAttemptGrader(user: AuthUser, attemptId: string) {
  const a = await prisma.attempt.findUnique({ where: { id: attemptId }, include: { quiz: true } });
  if (!a) throw notFound('Attempt');
  if (a.quiz.ownerId !== user.id && !isAdmin(user)) throw notFound('Attempt');
  return a;
}

export function assertCan(cond: boolean, msg?: string): asserts cond {
  if (!cond) throw forbidden(msg);
}
