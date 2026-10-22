import type { PublishedQuiz } from '@quiz/shared';
import { prisma } from '../../core/db';
import { cached } from '../../core/cache';

/** Published snapshots are immutable, so they can be cached for a long time. */
export function loadVersion(versionId: string): Promise<PublishedQuiz> {
  return cached(`ver:${versionId}`, 3600, [], async () => {
    const row = await prisma.quizVersion.findUniqueOrThrow({ where: { id: versionId }, select: { snapshot: true } });
    return row.snapshot as unknown as PublishedQuiz;
  });
}
