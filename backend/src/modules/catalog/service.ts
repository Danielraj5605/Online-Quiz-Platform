import crypto from 'node:crypto';
import type { Prisma } from '@prisma/client';
import type { PublishedQuiz, QuizOverviewDto, Difficulty } from '@quiz/shared';
import { prisma } from '../../core/db';
import { cached } from '../../core/cache';
import { canAccessQuiz, isAdmin } from '../../core/policy';
import { notFound } from '../../core/errors';
import type { AuthUser } from '../../core/auth';
import { effectiveStatus } from '../quizzes/lifecycle';
import { quizInclude, type QuizRow } from '../quizzes/mappers';

type Base = Omit<QuizOverviewDto, 'attemptsUsed' | 'activeAttemptId' | 'canStart' | 'reason'> & { hasVersion: boolean; ownerId: string };

/** User-independent part of the overview, derived from the published snapshot (never the draft, never the key). */
async function baseOverviews(rows: QuizRow[]): Promise<Base[]> {
  if (!rows.length) return [];
  const versionIds = rows.map((r) => r.currentVersionId).filter((v): v is string => !!v);
  const [versions, ratings] = await Promise.all([
    versionIds.length ? prisma.quizVersion.findMany({ where: { id: { in: versionIds } }, select: { id: true, snapshot: true } }) : Promise.resolve([]),
    prisma.review.groupBy({ by: ['quizId'], where: { quizId: { in: rows.map((r) => r.id) }, deletedAt: null }, _avg: { rating: true }, _count: { _all: true } }),
  ]);
  const vm = new Map(versions.map((v) => [v.id, v.snapshot as unknown as PublishedQuiz]));
  const rm = new Map(ratings.map((r) => [r.quizId, r]));
  return rows.map((r) => {
    const snap = r.currentVersionId ? vm.get(r.currentVersionId) : undefined;
    const rt = rm.get(r.id);
    return {
      id: r.id, title: r.title, description: r.description, difficulty: r.difficulty as Difficulty, category: r.category?.name ?? null,
      tags: r.tags.map((t) => t.tag.name), owner: { username: r.owner.username, name: r.owner.name }, status: effectiveStatus(r),
      opensAt: r.opensAt?.toISOString() ?? null, closesAt: r.closesAt?.toISOString() ?? null,
      questionCount: snap?.questions.length ?? 0, totalPoints: snap?.totalPoints ?? 0,
      timeLimitSec: snap?.settings.timeLimitSec ?? null, maxAttempts: snap?.settings.maxAttempts ?? 1, passMarkPct: snap?.settings.passMarkPct ?? 50,
      avgRating: rt?._avg.rating != null ? Math.round(rt._avg.rating * 10) / 10 : null, ratingCount: rt?._count._all ?? 0,
      hasVersion: !!snap, ownerId: r.ownerId,
    };
  });
}

/** Adds the viewer-specific attempt state and the can-start decision. */
export async function toOverviews(user: AuthUser, bases: Base[]): Promise<QuizOverviewDto[]> {
  if (!bases.length) return [];
  const ids = bases.map((b) => b.id);
  const [used, active] = await Promise.all([
    prisma.attempt.groupBy({ by: ['quizId'], where: { userId: user.id, quizId: { in: ids }, number: { gt: 0 }, status: { not: 'IN_PROGRESS' } }, _count: { _all: true } }),
    prisma.attempt.findMany({ where: { userId: user.id, quizId: { in: ids }, number: { gt: 0 }, status: 'IN_PROGRESS' }, select: { id: true, quizId: true } }),
  ]);
  const um = new Map(used.map((u) => [u.quizId, u._count._all]));
  const am = new Map(active.map((a) => [a.quizId, a.id]));
  return bases.map(({ hasVersion, ownerId, ...b }) => {
    const attemptsUsed = um.get(b.id) ?? 0;
    const activeAttemptId = am.get(b.id) ?? null;
    let canStart = true;
    let reason: string | undefined;
    if (ownerId === user.id || isAdmin(user)) {
      if (!hasVersion) { canStart = false; reason = 'Publish the quiz to preview it'; }
    } else if (!hasVersion || b.status === 'DRAFT') { canStart = false; reason = 'Not published'; }
    else if (b.status === 'SCHEDULED') { canStart = false; reason = 'Not open yet'; }
    else if (b.status !== 'LIVE') { canStart = false; reason = 'This quiz is closed'; }
    else if (!activeAttemptId && attemptsUsed >= b.maxAttempts) { canStart = false; reason = 'No attempts left'; }
    return { ...b, attemptsUsed, activeAttemptId, canStart, ...(reason ? { reason } : {}) };
  });
}

export const loadRows = (where: Prisma.QuizWhereInput, extra: { take?: number; skip?: number; orderBy?: Prisma.QuizOrderByWithRelationInput } = {}) =>
  prisma.quiz.findMany({ where: { deletedAt: null, isFlagged: false, ...where }, include: quizInclude, ...extra });

export const overviewsFor = async (user: AuthUser, rows: QuizRow[]) => toOverviews(user, await baseOverviews(rows));

export interface CatalogFilters { q?: string; categoryId?: string; difficulty?: string; tag?: string; page: number; pageSize: number }

export async function catalogList(user: AuthUser, f: CatalogFilters) {
  const now = new Date();
  const key = `catalog:${crypto.createHash('sha1').update(JSON.stringify(f)).digest('hex')}`;
  // quiz metadata is shared between users and cached for a minute; attempt state is merged per viewer below
  const page = await cached(key, 60, ['catalog'], async () => {
    const where: Prisma.QuizWhereInput = {
      visibility: 'PUBLIC', status: 'LIVE', currentVersionId: { not: null },
      AND: [{ OR: [{ opensAt: null }, { opensAt: { lte: now } }] }, { OR: [{ closesAt: null }, { closesAt: { gt: now } }] }],
      ...(f.categoryId ? { categoryId: f.categoryId } : {}), ...(f.difficulty ? { difficulty: f.difficulty } : {}),
      ...(f.tag ? { tags: { some: { tag: { name: f.tag.toLowerCase() } } } } : {}),
      ...(f.q ? { OR: [{ title: { contains: f.q, mode: 'insensitive' } }, { description: { contains: f.q, mode: 'insensitive' } }] } : {}),
    };
    const [total, rows] = await Promise.all([
      prisma.quiz.count({ where: { deletedAt: null, isFlagged: false, ...where } }),
      loadRows(where, { skip: (f.page - 1) * f.pageSize, take: f.pageSize, orderBy: { updatedAt: 'desc' } }),
    ]);
    return { total, bases: await baseOverviews(rows) };
  });
  return { total: page.total, items: await toOverviews(user, page.bases) };
}

export async function catalogDetail(user: AuthUser, quizId: string) {
  const row = await prisma.quiz.findFirst({ where: { id: quizId, deletedAt: null }, include: quizInclude });
  if (!row || !(await canAccessQuiz(user, row))) throw notFound('Quiz');
  return (await overviewsFor(user, [row]))[0];
}

/** Redeem an access code: records an invitation so the quiz shows up under the user's assignments. */
export async function joinByCode(user: AuthUser, code: string) {
  const row = await prisma.quiz.findFirst({
    where: { accessCode: code.trim().toUpperCase(), deletedAt: null, isFlagged: false, status: { in: ['LIVE', 'SCHEDULED'] } }, include: quizInclude,
  });
  if (!row) throw notFound('Quiz for that code');
  if (row.ownerId !== user.id) await prisma.invitation.upsert({ where: { quizId_userId: { quizId: row.id, userId: user.id } }, update: {}, create: { quizId: row.id, userId: user.id } });
  return (await overviewsFor(user, [row]))[0];
}

export async function myAssignments(user: AuthUser) {
  const now = new Date();
  const [activeAttempts, invited] = await Promise.all([
    prisma.attempt.findMany({ where: { userId: user.id, status: 'IN_PROGRESS', number: { gt: 0 }, quiz: { deletedAt: null } }, select: { quizId: true } }),
    loadRows({
      status: { in: ['LIVE', 'SCHEDULED'] }, currentVersionId: { not: null },
      OR: [
        { invitations: { some: { userId: user.id } } },
        { assignments: { some: { cohort: { deletedAt: null, members: { some: { userId: user.id } } } } } },
      ],
    }, { orderBy: { opensAt: 'asc' }, take: 200 }),
  ]);
  const inProgressIds = new Set(activeAttempts.map((a) => a.quizId));
  const inProgressRows = inProgressIds.size ? await loadRows({ id: { in: [...inProgressIds] } }) : [];
  const [inProgress, rest] = await Promise.all([overviewsFor(user, inProgressRows), overviewsFor(user, invited.filter((r) => !inProgressIds.has(r.id)))]);
  return {
    inProgress,
    assigned: rest.filter((q) => q.status === 'LIVE' && q.canStart && (!q.closesAt || new Date(q.closesAt) > now)),
    upcoming: rest.filter((q) => q.status === 'SCHEDULED'),
  };
}
