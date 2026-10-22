import { Router } from 'express';
import crypto from 'node:crypto';
import { TIERS, flagSchema, pageQuery } from '@quiz/shared';
import { me } from '../../core/auth';
import { prisma } from '../../core/db';
import { cached } from '../../core/cache';
import { body, created, idParam, ok, pageMeta, query, skipTake, wrap } from '../../core/http';
import { writeLimiter } from '../../core/rateLimit';
import { ensureBadges } from '../../core/gamification';
import { clean } from '../../core/sanitize';
import { notFound } from '../../core/errors';
import { requireQuizAccess } from '../../core/policy';
import { buildOverview } from '../attempts/overview';

export const gamificationRouter = Router();

let badgesReady: Promise<void> | null = null;
const readyBadges = () => (badgesReady ??= ensureBadges().catch((e) => { badgesReady = null; throw e; }));

const todayUtc = () => { const d = new Date(); return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())); };

gamificationRouter.get('/me/gamification', wrap(async (req, res) => {
  await readyBadges();
  const user = me(req);
  const [u, earned, all] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { xp: true, tier: true, streakDays: true } }),
    prisma.userBadge.findMany({ where: { userId: user.id }, select: { awardedAt: true, badgeId: true } }),
    prisma.badge.findMany({ orderBy: { name: 'asc' } }),
  ]);
  const at = new Map(earned.map((e) => [e.badgeId, e.awardedAt.toISOString()]));
  const idx = TIERS.findIndex((t) => t.name === u.tier);
  const next = TIERS[idx + 1] ?? null;
  ok(res, {
    xp: u.xp, tier: u.tier, streakDays: u.streakDays, nextTier: next,
    badges: all.map((b) => ({ key: b.key, name: b.name, description: b.description, icon: b.icon, earned: at.has(b.id), awardedAt: at.get(b.id) ?? null })),
  });
}));

gamificationRouter.get('/leaderboard', wrap(async (_req, res) => {
  const rows = await cached('leaderboard:global:top50', 60, ['leaderboard:global'], async () => {
    const users = await prisma.user.findMany({
      where: { disabled: false, deletedAt: null, xp: { gt: 0 } }, orderBy: [{ xp: 'desc' }, { createdAt: 'asc' }], take: 50,
      select: { id: true, username: true, name: true, avatarUrl: true, xp: true, tier: true },
    });
    return users.map((u, i) => ({ rank: i + 1, userId: u.id, username: u.username, name: u.name, avatarUrl: u.avatarUrl, xp: u.xp, tier: u.tier }));
  });
  ok(res, rows);
}));

gamificationRouter.get('/quizzes/:id/leaderboard', wrap(async (req, res) => {
  const quiz = await requireQuizAccess(me(req), idParam(req));
  const rows = await cached(`lb:quiz:${quiz.id}`, 60, [`quiz:${quiz.id}`], async () => {
    const results = await prisma.result.findMany({
      where: { quizId: quiz.id, isFinal: true, user: { disabled: false, deletedAt: null } },
      orderBy: [{ percentage: 'desc' }, { createdAt: 'asc' }], take: 300,
      select: { percentage: true, score: true, maxScore: true, user: { select: { id: true, username: true, name: true, avatarUrl: true } }, attempt: { select: { durationSec: true } } },
    });
    const best = new Map<string, (typeof results)[number]>();
    for (const r of results) {
      const cur = best.get(r.user.id);
      if (!cur || r.percentage > cur.percentage || (r.percentage === cur.percentage && (r.attempt.durationSec ?? 1e9) < (cur.attempt.durationSec ?? 1e9))) best.set(r.user.id, r);
    }
    return [...best.values()]
      .sort((a, b) => b.percentage - a.percentage || (a.attempt.durationSec ?? 1e9) - (b.attempt.durationSec ?? 1e9))
      .slice(0, 20)
      .map((r, i) => ({ rank: i + 1, userId: r.user.id, username: r.user.username, name: r.user.name, avatarUrl: r.user.avatarUrl, percentage: r.percentage, score: r.score, maxScore: r.maxScore, durationSec: r.attempt.durationSec }));
  });
  ok(res, rows);
}));

gamificationRouter.get('/daily-challenge', wrap(async (req, res) => {
  const user = me(req);
  const date = todayUtc();
  let ch = await prisma.dailyChallenge.findUnique({ where: { date } });
  if (!ch) {
    const candidates = await prisma.quiz.findMany({
      where: { deletedAt: null, status: 'LIVE', visibility: 'PUBLIC', isFlagged: false, currentVersionId: { not: null }, OR: [{ closesAt: null }, { closesAt: { gt: new Date() } }] },
      orderBy: { id: 'asc' }, select: { id: true },
    });
    if (!candidates.length) return ok(res, null);
    // deterministic per date: everyone (and every server) picks the same quiz
    const h = crypto.createHash('sha256').update(date.toISOString().slice(0, 10)).digest().readUInt32BE(0);
    const pick = candidates[h % candidates.length];
    try { ch = await prisma.dailyChallenge.create({ data: { date, quizId: pick.id } }); }
    catch { ch = await prisma.dailyChallenge.findUnique({ where: { date } }); } // lost the race
  }
  if (!ch) return ok(res, null);
  const quiz = await prisma.quiz.findFirst({ where: { id: ch.quizId, deletedAt: null } });
  const overview = quiz ? await buildOverview(user, quiz) : null;
  if (!overview) return ok(res, null);
  const done = await prisma.result.count({ where: { userId: user.id, quizId: ch.quizId, isFinal: true, createdAt: { gte: date } } });
  ok(res, { ...overview, xpBonus: ch.xpBonus, date: date.toISOString().slice(0, 10), completedToday: done > 0 });
}));

gamificationRouter.get('/me/attempts', wrap(async (req, res) => {
  const user = me(req);
  const p = query(pageQuery, req);
  const where = { userId: user.id, number: { gt: 0 } };
  const [total, rows] = await Promise.all([
    prisma.attempt.count({ where }),
    prisma.attempt.findMany({
      where, orderBy: { startedAt: 'desc' }, ...skipTake(p),
      select: { id: true, quizId: true, number: true, status: true, submittedAt: true, startedAt: true, quiz: { select: { title: true } }, result: { select: { percentage: true, passed: true, band: true, isFinal: true } } },
    }),
  ]);
  ok(res, rows.map((a) => ({
    attemptId: a.id, quizId: a.quizId, quizTitle: a.quiz.title, number: a.number, status: a.status,
    percentage: a.result?.percentage ?? null, passed: a.result?.passed ?? null, band: a.result?.band ?? null, isFinal: a.result?.isFinal ?? false,
    startedAt: a.startedAt.toISOString(), submittedAt: a.submittedAt?.toISOString() ?? null,
  })), pageMeta(p.page, p.pageSize, total));
}));

gamificationRouter.get('/me/progress', wrap(async (req, res) => {
  const user = me(req);
  const rows = await prisma.result.findMany({
    where: { userId: user.id, isFinal: true }, orderBy: { createdAt: 'asc' },
    select: { percentage: true, passed: true, createdAt: true, quiz: { select: { category: { select: { name: true } } } } },
  });
  const byCat = new Map<string, { sum: number; count: number }>();
  for (const r of rows) {
    const k = r.quiz.category?.name ?? 'Uncategorised';
    const c = byCat.get(k) ?? { sum: 0, count: 0 };
    c.sum += r.percentage; c.count++; byCat.set(k, c);
  }
  const n = rows.length;
  ok(res, {
    trend: rows.slice(-50).map((r) => ({ date: r.createdAt.toISOString(), pct: r.percentage })),
    byCategory: [...byCat.entries()].map(([category, c]) => ({ category, avgPct: Math.round((c.sum / c.count) * 10) / 10, count: c.count })),
    totals: {
      attempts: n, passed: rows.filter((r) => r.passed).length,
      avgPct: n ? Math.round((rows.reduce((s, r) => s + r.percentage, 0) / n) * 10) / 10 : 0,
      bestPct: n ? Math.max(...rows.map((r) => r.percentage)) : 0,
    },
  });
}));

gamificationRouter.post('/reports', writeLimiter, wrap(async (req, res) => {
  const user = me(req);
  const input = body(flagSchema, req);
  const exists =
    input.entityType === 'QUIZ' ? await prisma.quiz.findFirst({ where: { id: input.entityId, deletedAt: null }, select: { id: true } })
    : input.entityType === 'REVIEW' ? await prisma.review.findFirst({ where: { id: input.entityId, deletedAt: null }, select: { id: true } })
    : await prisma.user.findFirst({ where: { id: input.entityId, deletedAt: null }, select: { id: true } });
  if (!exists) throw notFound(input.entityType.charAt(0) + input.entityType.slice(1).toLowerCase());
  const open = await prisma.flaggedContent.findFirst({ where: { reporterId: user.id, entityType: input.entityType, entityId: input.entityId, status: 'OPEN' }, select: { id: true } });
  if (open) return ok(res, { id: open.id });
  const f = await prisma.flaggedContent.create({
    data: { reporterId: user.id, entityType: input.entityType, entityId: input.entityId, reason: clean(input.reason) }, select: { id: true },
  });
  created(res, f);
}));
