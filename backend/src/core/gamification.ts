import type { Tx } from './db';
import { prisma } from './db';
import { tierFor } from '@quiz/shared';

/** XP for the first final result of a quiz. */
export function calcXp(pct: number, passed: boolean, durationSec: number | null, timeLimitSec: number | null): number {
  let xp = 30 + Math.round(pct / 2);
  if (passed) xp += 20;
  if (pct >= 100) xp += 50;
  if (durationSec != null && timeLimitSec && durationSec < timeLimitSec / 2) xp += 20;
  return xp;
}

export const BADGES = [
  { key: 'first_quiz', name: 'First Steps', description: 'Complete your first quiz', icon: 'footprints' },
  { key: 'perfect', name: 'Flawless', description: 'Score 100% on a quiz', icon: 'sparkles' },
  { key: 'five_quizzes', name: 'Regular', description: 'Complete 5 quizzes', icon: 'repeat' },
  { key: 'ten_quizzes', name: 'Dedicated', description: 'Complete 10 quizzes', icon: 'flame' },
  { key: 'streak_3', name: 'On a Roll', description: 'Be active 3 days in a row', icon: 'zap' },
  { key: 'streak_7', name: 'Week Warrior', description: 'Be active 7 days in a row', icon: 'calendar-check' },
  { key: 'speedster', name: 'Speedster', description: 'Finish in under half the time limit with a pass', icon: 'timer' },
  { key: 'high_achiever', name: 'High Achiever', description: 'Pass 3 quizzes with 90%+', icon: 'trophy' },
] as const;

const dayStart = (d = new Date()) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

/** Atomic XP increment + streak maintenance + badge awarding. Call once per first-final result. */
export async function awardForResult(tx: Tx, userId: string, o: { pct: number; passed: boolean; durationSec: number | null; timeLimitSec: number | null }) {
  const xp = calcXp(o.pct, o.passed, o.durationSec, o.timeLimitSec);
  const u = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { lastActiveOn: true, streakDays: true } });
  const today = dayStart();
  let streak = u.streakDays;
  if (!u.lastActiveOn) streak = 1;
  else {
    const diff = Math.round((today.getTime() - dayStart(u.lastActiveOn).getTime()) / 86400000);
    if (diff === 1) streak += 1; else if (diff > 1) streak = 1;
  }
  const updated = await tx.user.update({ where: { id: userId }, data: { xp: { increment: xp }, streakDays: streak, lastActiveOn: today } });
  const tier = tierFor(updated.xp);
  if (tier !== updated.tier) await tx.user.update({ where: { id: userId }, data: { tier } });

  const [done, high] = await Promise.all([
    tx.result.count({ where: { userId, isFinal: true, attempt: { number: { gt: 0 } } } }),
    tx.result.count({ where: { userId, isFinal: true, passed: true, percentage: { gte: 90 } } }),
  ]);
  const earned: string[] = [];
  if (done >= 1) earned.push('first_quiz');
  if (done >= 5) earned.push('five_quizzes');
  if (done >= 10) earned.push('ten_quizzes');
  if (o.pct >= 100) earned.push('perfect');
  if (streak >= 3) earned.push('streak_3');
  if (streak >= 7) earned.push('streak_7');
  if (high >= 3) earned.push('high_achiever');
  if (o.passed && o.durationSec != null && o.timeLimitSec && o.durationSec < o.timeLimitSec / 2) earned.push('speedster');
  const badges = await tx.badge.findMany({ where: { key: { in: earned } } });
  if (badges.length) await tx.userBadge.createMany({ data: badges.map((b) => ({ userId, badgeId: b.id })), skipDuplicates: true });
  return { xp, streak, tier };
}

export async function ensureBadges() {
  for (const b of BADGES) await prisma.badge.upsert({ where: { key: b.key }, update: { name: b.name, description: b.description, icon: b.icon }, create: b });
}
