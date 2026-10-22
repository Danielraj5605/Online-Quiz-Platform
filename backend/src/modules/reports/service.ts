import type { PublishedQuiz, QuestionType } from '@quiz/shared';
import { hasOptions } from '@quiz/shared';
import { prisma } from '../../core/db';
import { cached } from '../../core/cache';

/** Hard caps keep in-memory work bounded regardless of quiz popularity. */
const MAX_RESULTS = 50_000;
const MAX_ANSWERS = 250_000;
const TTL = 60;

const tags = (quizId: string) => [`quiz:${quizId}`];
const round = (n: number, d = 1) => Math.round(n * 10 ** d) / 10 ** d;
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/** Result rows for non-preview attempts (number > 0) of a quiz. */
async function loadResults(quizId: string) {
  return prisma.result.findMany({
    where: { quizId, attempt: { number: { gt: 0 } } },
    select: {
      attemptId: true, userId: true, score: true, maxScore: true, percentage: true, band: true, passed: true, isFinal: true,
      createdAt: true, attempt: { select: { number: true, durationSec: true, submittedAt: true } },
    },
    orderBy: { createdAt: 'asc' },
    take: MAX_RESULTS,
  });
}
type ResultRow = Awaited<ReturnType<typeof loadResults>>[number];

export function summary(quizId: string) {
  return cached(`report:summary:${quizId}`, TTL, tags(quizId), async () => {
    const rows = await loadResults(quizId);
    const pcts = rows.map((r) => r.percentage);
    const durations = rows.map((r) => r.attempt.durationSec).filter((d): d is number => d != null);
    const distribution = Array.from({ length: 10 }, (_, i) => ({ bucket: i === 9 ? '90-100' : `${i * 10}-${i * 10 + 9}`, count: 0 }));
    for (const p of pcts) distribution[Math.min(9, Math.floor(p / 10))].count++;
    const bandMap = new Map<string, number>();
    for (const r of rows) if (r.band) bandMap.set(r.band, (bandMap.get(r.band) ?? 0) + 1);
    return {
      attempts: rows.length,
      participants: new Set(rows.map((r) => r.userId)).size,
      avgPct: round(avg(pcts)),
      medianPct: round(median(pcts)),
      passRate: rows.length ? round((rows.filter((r) => r.passed).length / rows.length) * 100) : 0,
      avgDurationSec: Math.round(avg(durations)),
      distribution,
      bands: [...bandMap].map(([label, count]) => ({ label, count })),
      gradedPending: rows.filter((r) => !r.isFinal).length,
    };
  });
}

const answerScore = (g: { autoScore: number | null; manualScore: number | null } | null) => g?.manualScore ?? g?.autoScore ?? 0;
const isEmptyValue = (v: unknown) => {
  const x = v as { optionIds?: string[]; text?: string; number?: number } | null;
  if (!x) return true;
  return !(x.optionIds?.length || (x.text && x.text.trim()) || typeof x.number === 'number');
};

export function items(quizId: string) {
  return cached(`report:items:${quizId}`, TTL, tags(quizId), async () => {
    const results = await loadResults(quizId);
    const total = results.length;
    const pctByAttempt = new Map(results.map((r) => [r.attemptId, r.percentage]));

    // upper / lower 27% groups by total score
    const sorted = [...results].sort((a, b) => b.percentage - a.percentage);
    const k = Math.max(1, Math.round(total * 0.27));
    const upper = new Set(sorted.slice(0, k).map((r) => r.attemptId));
    const lower = new Set(sorted.slice(-k).map((r) => r.attemptId));

    // question metadata from snapshots, newest version wins
    const versions = await prisma.quizVersion.findMany({ where: { quizId }, orderBy: { number: 'desc' }, select: { snapshot: true } });
    const meta = new Map<string, { text: string; type: QuestionType; points: number; options: { id: string; text: string; isCorrect: boolean }[]; order: number }>();
    for (const v of versions) {
      const snap = v.snapshot as unknown as PublishedQuiz;
      snap.questions.forEach((q, i) => {
        if (!meta.has(q.id)) meta.set(q.id, { text: q.text, type: q.type, points: q.points, options: q.options, order: i });
      });
    }

    const answers = await prisma.answer.findMany({
      where: { attempt: { quizId, number: { gt: 0 }, result: { isNot: null } } },
      select: { attemptId: true, questionId: true, value: true, timeSpentMs: true, grade: { select: { autoScore: true, manualScore: true, maxScore: true, needsManual: true } } },
      take: MAX_ANSWERS,
    });

    interface Acc { ratios: number[]; up: number[]; lo: number[]; times: number[]; answered: number; opt: Map<string, number> }
    const acc = new Map<string, Acc>();
    for (const a of answers) {
      if (!pctByAttempt.has(a.attemptId)) continue;
      const m = meta.get(a.questionId);
      if (!m) continue;
      const s: Acc = acc.get(a.questionId) ?? { ratios: [], up: [], lo: [], times: [], answered: 0, opt: new Map() };
      acc.set(a.questionId, s);
      const pending = a.grade?.needsManual && a.grade.manualScore == null;
      if (!pending) {
        const max = a.grade?.maxScore || m.points || 1;
        const ratio = max > 0 ? Math.max(0, answerScore(a.grade)) / max : 0;
        s.ratios.push(ratio);
        if (upper.has(a.attemptId)) s.up.push(ratio);
        if (lower.has(a.attemptId)) s.lo.push(ratio);
      }
      if (!isEmptyValue(a.value)) s.answered++;
      s.times.push(a.timeSpentMs);
      for (const id of (a.value as { optionIds?: string[] } | null)?.optionIds ?? []) s.opt.set(id, (s.opt.get(id) ?? 0) + 1);
    }

    return [...meta.entries()]
      .sort((a, b) => a[1].order - b[1].order)
      .map(([questionId, m]) => {
        const s = acc.get(questionId);
        return {
          questionId, text: m.text, type: m.type, points: m.points,
          responses: s?.ratios.length ?? 0,
          difficulty: s ? round(avg(s.ratios), 3) : null,
          discrimination: s && s.up.length && s.lo.length ? round(avg(s.up) - avg(s.lo), 3) : null,
          avgTimeMs: s ? Math.round(avg(s.times)) : 0,
          omitRate: total ? round(1 - (s?.answered ?? 0) / total, 3) : 0,
          distractors: hasOptions(m.type)
            ? m.options.map((o) => ({ optionId: o.id, text: o.text, count: s?.opt.get(o.id) ?? 0, isCorrect: o.isCorrect }))
            : [],
        };
      });
  });
}

async function participantRows(quizId: string) {
  return cached(`report:participants:${quizId}`, TTL, tags(quizId), async () => {
    const rows = await loadResults(quizId);
    const byUser = new Map<string, ResultRow[]>();
    for (const r of rows) (byUser.get(r.userId) ?? byUser.set(r.userId, []).get(r.userId)!).push(r);
    const users = await prisma.user.findMany({ where: { id: { in: [...byUser.keys()] } }, select: { id: true, username: true, name: true } });
    const uname = new Map(users.map((u) => [u.id, u]));
    return [...byUser].map(([userId, rs]) => {
      const best = rs.reduce((a, b) => (b.percentage > a.percentage ? b : a));
      const last = rs[rs.length - 1];
      const durs = rs.map((r) => r.attempt.durationSec).filter((d): d is number => d != null);
      return {
        userId, username: uname.get(userId)?.username ?? '—', name: uname.get(userId)?.name ?? null,
        attempts: rs.length, bestPct: round(best.percentage), lastPct: round(last.percentage), passed: rs.some((r) => r.passed),
        avgDurationSec: Math.round(avg(durs)),
      };
    });
  });
}

const PARTICIPANT_SORTS = ['username', 'attempts', 'bestPct', 'lastPct', 'avgDurationSec'] as const;
export async function participants(quizId: string, o: { page: number; pageSize: number; sort?: string; q?: string }) {
  let rows = await participantRows(quizId);
  if (o.q) { const q = o.q.toLowerCase(); rows = rows.filter((r) => r.username.toLowerCase().includes(q) || (r.name ?? '').toLowerCase().includes(q)); }
  const desc = o.sort?.startsWith('-');
  const f = ((desc ? o.sort!.slice(1) : o.sort) ?? 'bestPct') as (typeof PARTICIPANT_SORTS)[number];
  const field = PARTICIPANT_SORTS.includes(f) ? f : 'bestPct';
  const dir = o.sort ? (desc ? -1 : 1) : -1;
  rows = [...rows].sort((a, b) => (a[field] < b[field] ? -1 : a[field] > b[field] ? 1 : 0) * dir);
  return { rows: rows.slice((o.page - 1) * o.pageSize, o.page * o.pageSize), total: rows.length };
}

export function cohorts(quizId: string) {
  return cached(`report:cohorts:${quizId}`, TTL, tags(quizId), async () => {
    const assigned = await prisma.quizAssignment.findMany({
      where: { quizId, cohort: { deletedAt: null } },
      select: { cohort: { select: { id: true, name: true, members: { select: { userId: true } } } } },
    });
    if (!assigned.length) return [];
    const stats = new Map((await participantRows(quizId)).map((p) => [p.userId, p]));
    return assigned.map(({ cohort }) => {
      const ps = cohort.members.map((m) => stats.get(m.userId)).filter((p): p is NonNullable<typeof p> => !!p);
      return {
        cohortId: cohort.id, name: cohort.name, members: cohort.members.length, attempted: ps.length,
        avgPct: round(avg(ps.map((p) => p.bestPct))),
        passRate: ps.length ? round((ps.filter((p) => p.passed).length / ps.length) * 100) : 0,
      };
    });
  });
}

/** Cursor-paged per-attempt rows for streaming export. */
export async function* exportRows(quizId: string, batch = 500) {
  let cursor: string | undefined;
  for (;;) {
    const rs = await prisma.result.findMany({
      where: { quizId, attempt: { number: { gt: 0 } } },
      orderBy: { id: 'asc' }, take: batch, ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      select: {
        id: true, score: true, maxScore: true, percentage: true, band: true, passed: true, isFinal: true,
        user: { select: { username: true, name: true, email: true } },
        attempt: { select: { number: true, durationSec: true, submittedAt: true, tabSwitches: true } },
      },
    });
    if (!rs.length) return;
    yield* rs;
    cursor = rs[rs.length - 1].id;
    if (rs.length < batch) return;
  }
}

export async function quizTitle(quizId: string) {
  return (await prisma.quiz.findUniqueOrThrow({ where: { id: quizId }, select: { title: true } })).title;
}
