import type { Prisma } from '@prisma/client';
import {
  questionConfigSchema, quizSettingsSchema,
  type PublishedQuestion, type PublishedQuiz, type QuestionAuthorDto, type QuizDetailDto, type QuizSummaryDto, type Difficulty,
} from '@quiz/shared';
import { prisma } from '../../core/db';

export const quizInclude = {
  category: { select: { id: true, name: true } },
  tags: { select: { tag: { select: { name: true } } } },
  owner: { select: { id: true, username: true, name: true } },
} satisfies Prisma.QuizInclude;
export type QuizRow = Prisma.QuizGetPayload<{ include: typeof quizInclude }>;

export const questionInclude = { options: { orderBy: { position: 'asc' } } } satisfies Prisma.QuestionInclude;
type QuestionRow = Prisma.QuestionGetPayload<{ include: typeof questionInclude }>;

export const toAuthorQuestion = (q: QuestionRow): QuestionAuthorDto => ({
  id: q.id, type: q.type, text: q.text, explanation: q.explanation, points: q.points, position: q.position,
  sectionId: q.sectionId, config: questionConfigSchema.parse(q.config ?? {}),
  options: q.options.map((o) => ({ id: o.id, text: o.text, isCorrect: o.isCorrect, position: o.position })),
});

/** Batched aggregates (question count, points, attempts, ratings, version number) for a page of quizzes. */
export async function summaries(rows: QuizRow[]): Promise<QuizSummaryDto[]> {
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const versionIds = rows.map((r) => r.currentVersionId).filter((v): v is string => !!v);
  const [qAgg, attempts, ratings, versions] = await Promise.all([
    prisma.question.groupBy({ by: ['quizId'], where: { quizId: { in: ids }, deletedAt: null }, _count: { _all: true }, _sum: { points: true } }),
    prisma.attempt.groupBy({ by: ['quizId'], where: { quizId: { in: ids }, number: { gt: 0 } }, _count: { _all: true } }),
    prisma.review.groupBy({ by: ['quizId'], where: { quizId: { in: ids }, deletedAt: null }, _avg: { rating: true }, _count: { _all: true } }),
    versionIds.length ? prisma.quizVersion.findMany({ where: { id: { in: versionIds } }, select: { id: true, number: true } }) : Promise.resolve([]),
  ]);
  const qm = new Map(qAgg.map((a) => [a.quizId, a]));
  const am = new Map(attempts.map((a) => [a.quizId, a._count._all]));
  const rm = new Map(ratings.map((a) => [a.quizId, a]));
  const vm = new Map(versions.map((v) => [v.id, v.number]));
  return rows.map((r) => {
    const q = qm.get(r.id);
    const rt = rm.get(r.id);
    return {
      id: r.id, title: r.title, description: r.description, status: r.status, visibility: r.visibility,
      difficulty: r.difficulty as Difficulty, category: r.category, tags: r.tags.map((t) => t.tag.name), owner: r.owner,
      opensAt: r.opensAt?.toISOString() ?? null, closesAt: r.closesAt?.toISOString() ?? null,
      questionCount: q?._count._all ?? 0, totalPoints: q?._sum.points ?? 0, attemptCount: am.get(r.id) ?? 0,
      avgRating: rt?._avg.rating != null ? Math.round(rt._avg.rating * 10) / 10 : null, ratingCount: rt?._count._all ?? 0,
      dirty: r.dirty, currentVersion: r.currentVersionId ? vm.get(r.currentVersionId) ?? null : null,
      settings: quizSettingsSchema.parse(r.settings ?? {}), createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString(),
    };
  });
}

export async function loadDetail(quizId: string): Promise<QuizDetailDto | null> {
  const row = await prisma.quiz.findFirst({
    where: { id: quizId, deletedAt: null },
    include: {
      ...quizInclude,
      sections: { where: { deletedAt: null }, orderBy: { position: 'asc' } },
      questions: { where: { deletedAt: null }, orderBy: { position: 'asc' }, include: questionInclude },
    },
  });
  if (!row) return null;
  const [summary] = await summaries([row]);
  return {
    ...summary,
    accessCode: row.accessCode,
    sections: row.sections.map((s) => ({ id: s.id, title: s.title, description: s.description, position: s.position })),
    questions: row.questions.map(toAuthorQuestion),
  };
}

/** Immutable snapshot of the current draft content incl. answer key. */
export function buildSnapshot(
  quiz: { id: string; title: string; settings: unknown },
  number: number,
  sections: { id: string; title: string; position: number }[],
  questions: QuestionRow[],
): PublishedQuiz {
  const sectionPos = new Map(sections.map((s) => [s.id, s.position]));
  const ordered = [...questions].sort(
    (a, b) => (a.sectionId ? sectionPos.get(a.sectionId) ?? 0 : -1) - (b.sectionId ? sectionPos.get(b.sectionId) ?? 0 : -1) || a.position - b.position,
  );
  const pq: PublishedQuestion[] = ordered.map((q) => ({
    id: q.id, type: q.type, text: q.text, explanation: q.explanation, points: q.points,
    sectionId: q.sectionId && sectionPos.has(q.sectionId) ? q.sectionId : null, position: q.position,
    config: questionConfigSchema.parse(q.config ?? {}),
    options: q.options.map((o) => ({ id: o.id, text: o.text, isCorrect: o.isCorrect, position: o.position })),
  }));
  return {
    quizId: quiz.id, number, title: quiz.title, settings: quizSettingsSchema.parse(quiz.settings ?? {}),
    sections: sections.map((s) => ({ id: s.id, title: s.title, position: s.position })).sort((a, b) => a.position - b.position),
    questions: pq, totalPoints: pq.reduce((s, q) => s + q.points, 0),
  };
}
