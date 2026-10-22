import { prisma } from '../../core/db';
import { badRequest, notFound } from '../../core/errors';
import { gradeObjective, finalizeAttempt, invalidateQuizCaches } from './finalize';
import { loadVersion } from './versions';

/**
 * Re-grades every submitted attempt of a quiz against a version (default: the current one).
 * Objective grades are recomputed from that version's key; manual scores are kept.
 * Attempts are moved onto the target version so their review matches the key they were graded with.
 */
export async function regradeQuiz(quizId: string, versionId?: string): Promise<{ regraded: number }> {
  const quiz = await prisma.quiz.findUnique({ where: { id: quizId }, select: { currentVersionId: true } });
  if (!quiz) throw notFound('Quiz');
  const target = versionId ?? quiz.currentVersionId;
  if (!target) throw badRequest('Quiz has no published version');
  const row = await prisma.quizVersion.findFirst({ where: { id: target, quizId }, select: { id: true } });
  if (!row) throw notFound('Version');
  const version = await loadVersion(target);

  const attempts = await prisma.attempt.findMany({
    where: { quizId, number: { gt: 0 }, status: { in: ['SUBMITTED', 'GRADED'] } },
    select: { id: true, versionId: true },
  });
  for (const a of attempts) {
    if (a.versionId !== target) await prisma.attempt.update({ where: { id: a.id }, data: { versionId: target } });
    await gradeObjective(a.id, version);
    await finalizeAttempt(a.id);
  }
  await invalidateQuizCaches(quizId);
  return { regraded: attempts.length };
}
