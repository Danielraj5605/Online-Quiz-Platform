import crypto from 'node:crypto';
import type { Attempt, Answer, Prisma } from '@prisma/client';
import {
  hasOptions, type AnswerValue, type AttemptViewDto, type PublishedQuestion, type PublishedQuiz, type ResultDto,
  type ResultQuestionReview, type saveAnswersSchema,
} from '@quiz/shared';
import type { z } from 'zod';
import { prisma } from '../../core/db';
import type { AuthUser } from '../../core/auth';
import { AppError, badRequest, conflict, forbidden, notFound } from '../../core/errors';
import { canAccessQuiz, isAdmin, requireAttemptViewer } from '../../core/policy';
import { effectiveScore, scoreAttempt } from '../grading/engine';
import { gradeObjective, finalizeAttempt } from './finalize';
import { loadVersion } from './versions';

/** Late saves are tolerated this long after the hard deadline (network jitter). */
export const GRACE_MS = 5_000;

/* ───────────── helpers ───────────── */
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Shuffles questions inside each section, keeping section order. */
function questionOrderFor(v: PublishedQuiz): string[] {
  if (!v.settings.shuffleQuestions) return v.questions.map((q) => q.id);
  const groups = new Map<string, string[]>();
  for (const q of v.questions) {
    const k = q.sectionId ?? '';
    (groups.get(k) ?? groups.set(k, []).get(k)!).push(q.id);
  }
  return [...groups.values()].flatMap(shuffle);
}

function optionOrderFor(v: PublishedQuiz): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  if (!v.settings.shuffleOptions) return out;
  for (const q of v.questions) if (q.type === 'MCQ_SINGLE' || q.type === 'MCQ_MULTI') out[q.id] = shuffle(q.options.map((o) => o.id));
  return out;
}

const orderedQuestions = (v: PublishedQuiz, order: string[]): PublishedQuestion[] => {
  const map = new Map(v.questions.map((q) => [q.id, q]));
  const seen = new Set<string>();
  const out: PublishedQuestion[] = [];
  for (const id of order) { const q = map.get(id); if (q && !seen.has(id)) { out.push(q); seen.add(id); } }
  for (const q of v.questions) if (!seen.has(q.id)) out.push(q); // questions added by a later version
  return out;
};

type AttemptWithAnswers = Attempt & { answers: Answer[] };

export function buildView(a: AttemptWithAnswers, v: PublishedQuiz): AttemptViewDto {
  const optOrder = (a.optionOrder ?? {}) as Record<string, string[]>;
  const sectionTitle = new Map(v.sections.map((s) => [s.id, s.title]));
  const questions = orderedQuestions(v, a.questionOrder as string[]).map((q) => {
    let opts = [...q.options].sort((x, y) => x.position - y.position);
    const ord = optOrder[q.id];
    if (ord) { const idx = new Map(ord.map((id, i) => [id, i])); opts = opts.sort((x, y) => (idx.get(x.id) ?? 0) - (idx.get(y.id) ?? 0)); }
    return {
      id: q.id, type: q.type, text: q.text, points: q.points,
      sectionTitle: q.sectionId ? sectionTitle.get(q.sectionId) ?? null : null,
      // key (isCorrect, accepted answers, numeric answer, explanation) is deliberately omitted
      options: hasOptions(q.type) ? opts.map((o) => ({ id: o.id, text: o.text })) : [],
      ...(q.type === 'LONG_ANSWER' ? { maxLength: q.config.maxLength } : {}),
    };
  });
  const answers: AttemptViewDto['answers'] = {};
  for (const ans of a.answers) answers[ans.questionId] = { value: ans.value as AnswerValue, flagged: ans.flagged };
  return {
    id: a.id, quizId: a.quizId, quizTitle: v.title, status: a.status, startedAt: a.startedAt.toISOString(),
    expiresAt: a.expiresAt?.toISOString() ?? null, serverNow: new Date().toISOString(), questions, answers,
  };
}

/* ───────────── lifecycle ───────────── */
/** Submits an IN_PROGRESS attempt. Idempotent and safe under races (only one caller wins the claim). */
export async function submitAttempt(attemptId: string): Promise<void> {
  const a = await prisma.attempt.findUnique({ where: { id: attemptId } });
  if (!a || a.status !== 'IN_PROGRESS') return;
  const now = new Date();
  const submittedAt = a.expiresAt && now > a.expiresAt ? a.expiresAt : now;
  const durationSec = Math.max(0, Math.round((submittedAt.getTime() - a.startedAt.getTime()) / 1000));
  const claim = await prisma.attempt.updateMany({ where: { id: attemptId, status: 'IN_PROGRESS' }, data: { status: 'SUBMITTED', submittedAt, durationSec } });
  if (claim.count === 0) return;
  await gradeObjective(attemptId);
  await finalizeAttempt(attemptId);
}

const pastDeadline = (a: Attempt) => !!a.expiresAt && Date.now() >= a.expiresAt.getTime() + GRACE_MS;

/** Lazily auto-submits an attempt whose deadline (plus grace) has passed; returns the fresh row. */
async function expireIfNeeded<T extends Attempt>(a: T): Promise<Attempt> {
  if (a.status === 'IN_PROGRESS' && pastDeadline(a)) {
    await submitAttempt(a.id);
    return prisma.attempt.findUniqueOrThrow({ where: { id: a.id } });
  }
  return a;
}

export async function startAttempt(user: AuthUser, quizId: string, preview: boolean): Promise<AttemptViewDto> {
  const quiz = await prisma.quiz.findFirst({ where: { id: quizId, deletedAt: null } });
  if (!quiz) throw notFound('Quiz');
  const isOwner = quiz.ownerId === user.id || isAdmin(user);
  if (preview) { if (!isOwner) throw forbidden('Only the quiz owner can preview'); }
  else {
    if (isOwner) throw forbidden('Owners can only preview their own quizzes');
    if (!(await canAccessQuiz(user, quiz))) throw notFound('Quiz');
  }
  if (!quiz.currentVersionId) throw conflict(preview ? 'Publish the quiz at least once to preview it' : 'Quiz is not available', 'NOT_PUBLISHED');
  const v = await loadVersion(quiz.currentVersionId);

  const findActive = () => prisma.attempt.findFirst({
    where: { quizId, userId: user.id, status: 'IN_PROGRESS', number: preview ? 0 : { gt: 0 } }, include: { answers: true },
  });

  // resume first: a taker keeps access to their running attempt even if the quiz has since closed
  const active = await findActive();
  if (active) {
    const fresh = await expireIfNeeded(active);
    if (fresh.status === 'IN_PROGRESS') return buildView(active, await loadVersion(active.versionId));
  }

  const now = new Date();
  let number = 0;
  if (!preview) {
    if (quiz.status !== 'LIVE') throw conflict('This quiz is not open for attempts', 'NOT_LIVE');
    if (quiz.opensAt && quiz.opensAt > now) throw conflict('This quiz has not opened yet', 'NOT_OPEN');
    if (quiz.closesAt && quiz.closesAt <= now) throw conflict('This quiz has closed', 'CLOSED');
    const used = await prisma.attempt.count({ where: { quizId, userId: user.id, number: { gt: 0 }, status: { not: 'IN_PROGRESS' } } });
    if (used >= v.settings.maxAttempts) throw new AppError(409, 'ATTEMPTS_EXHAUSTED', 'You have used all attempts for this quiz');
    const last = await prisma.attempt.aggregate({ where: { quizId, userId: user.id }, _max: { number: true } });
    number = (last._max.number ?? 0) + 1;
  } else {
    await prisma.attempt.deleteMany({ where: { quizId, userId: user.id, number: 0 } }); // keep one preview row
  }

  let expiresAt: Date | null = null;
  if (v.settings.timeLimitSec) expiresAt = new Date(now.getTime() + v.settings.timeLimitSec * 1000);
  if (quiz.closesAt && !preview && (!expiresAt || quiz.closesAt < expiresAt)) expiresAt = quiz.closesAt;

  try {
    const created = await prisma.attempt.create({
      data: {
        quizId, versionId: quiz.currentVersionId, userId: user.id, number, startedAt: now, expiresAt,
        questionOrder: questionOrderFor(v), optionOrder: optionOrderFor(v),
      },
      include: { answers: true },
    });
    return buildView(created, v);
  } catch (e) {
    if ((e as { code?: string }).code === 'P2002') { // concurrent start: return the winner's attempt
      const again = await findActive();
      if (again) return buildView(again, await loadVersion(again.versionId));
    }
    throw e;
  }
}

export async function getAttemptView(attempt: Attempt): Promise<AttemptViewDto> {
  const fresh = await expireIfNeeded(attempt);
  const full = await prisma.attempt.findUniqueOrThrow({ where: { id: fresh.id }, include: { answers: true } });
  return buildView(full, await loadVersion(full.versionId));
}

/* ───────────── answers & events ───────────── */
type SaveInput = z.infer<typeof saveAnswersSchema>;

export async function saveAnswers(attempt: Attempt, input: SaveInput): Promise<{ savedAt: string; count: number }> {
  if (attempt.status !== 'IN_PROGRESS') throw conflict('This attempt has already been submitted', 'ATTEMPT_CLOSED');
  if (pastDeadline(attempt)) {
    await submitAttempt(attempt.id);
    throw conflict('Time is up — your attempt was submitted', 'ATTEMPT_EXPIRED');
  }
  const v = await loadVersion(attempt.versionId);
  const qmap = new Map(v.questions.map((q) => [q.id, q]));
  const existing = new Map((await prisma.answer.findMany({ where: { attemptId: attempt.id } })).map((a) => [a.questionId, a]));

  const ops: Prisma.PrismaPromise<unknown>[] = [];
  for (const item of input.answers) {
    const q = qmap.get(item.questionId);
    if (!q) throw badRequest(`Unknown question ${item.questionId}`);
    validateValue(q, item.value);
    const prev = existing.get(item.questionId);
    const value = item.value as Prisma.InputJsonValue;
    const timeSpentMs = Math.max(prev?.timeSpentMs ?? 0, item.timeSpentMs ?? 0);
    ops.push(prisma.answer.upsert({
      where: { attemptId_questionId: { attemptId: attempt.id, questionId: item.questionId } },
      create: { attemptId: attempt.id, questionId: item.questionId, value, flagged: item.flagged ?? false, timeSpentMs },
      update: { value, timeSpentMs, ...(item.flagged !== undefined ? { flagged: item.flagged } : {}) },
    }));
  }
  ops.push(prisma.attempt.update({ where: { id: attempt.id }, data: { lastSeenAt: new Date() } }));
  await prisma.$transaction(ops);
  return { savedAt: new Date().toISOString(), count: input.answers.length };
}

function validateValue(q: PublishedQuestion, v: AnswerValue) {
  if (hasOptions(q.type)) {
    const ids = v.optionIds ?? [];
    const valid = new Set(q.options.map((o) => o.id));
    if (ids.some((id) => !valid.has(id))) throw badRequest('Unknown option for this question');
    if (q.type !== 'MCQ_MULTI' && ids.length > 1) throw badRequest('Only one option may be selected');
  } else if (v.optionIds?.length) throw badRequest('This question has no options');
  if (q.type === 'LONG_ANSWER' && (v.text?.length ?? 0) > q.config.maxLength) throw badRequest(`Answer exceeds ${q.config.maxLength} characters`);
  if (q.type === 'SHORT_ANSWER' && (v.text?.length ?? 0) > 500) throw badRequest('Answer is too long');
}

export async function recordEvent(attempt: Attempt, e: { type: 'blur' | 'focus' | 'hidden' | 'visible'; awaySec?: number }) {
  if (attempt.status !== 'IN_PROGRESS') return { tabSwitches: attempt.tabSwitches, blurSeconds: attempt.blurSeconds };
  const leaving = e.type === 'hidden' || e.type === 'blur';
  const u = await prisma.attempt.update({
    where: { id: attempt.id },
    data: { lastSeenAt: new Date(), ...(leaving ? { tabSwitches: { increment: 1 } } : e.awaySec ? { blurSeconds: { increment: e.awaySec } } : {}) },
    select: { tabSwitches: true, blurSeconds: true },
  });
  return u;
}

/* ───────────── result ───────────── */
function revealPolicy(show: PublishedQuiz['settings']['showAnswers'], quizStatus: string, status: string, isOwner: boolean): boolean {
  if (isOwner) return true;
  if (status === 'IN_PROGRESS') return false;
  if (show === 'AFTER_SUBMIT') return true;
  if (show === 'AFTER_CLOSE') return quizStatus === 'CLOSED' || quizStatus === 'ARCHIVED';
  return false;
}

export async function getResult(user: AuthUser, attemptId: string): Promise<ResultDto> {
  const { attempt: base, isQuizOwner } = await requireAttemptViewer(user, attemptId);
  let attempt: Attempt = await expireIfNeeded(base);
  if (attempt.status === 'IN_PROGRESS') throw conflict('This attempt has not been submitted yet', 'NOT_SUBMITTED');
  attempt = await prisma.attempt.findUniqueOrThrow({ where: { id: attempt.id } });

  const [full, quiz] = await Promise.all([
    prisma.attempt.findUniqueOrThrow({ where: { id: attempt.id }, include: { answers: { include: { grade: true } } } }),
    prisma.quiz.findUniqueOrThrow({ where: { id: attempt.quizId }, select: { status: true } }),
  ]);
  const v = await loadVersion(attempt.versionId);
  const eff: Record<string, { score: number; pending: boolean }> = {};
  const byQ = new Map(full.answers.map((a) => [a.questionId, a]));
  for (const a of full.answers) if (a.grade) eff[a.questionId] = effectiveScore(a.grade);
  const totals = scoreAttempt(v.questions, eff, v.settings);

  const revealed = revealPolicy(v.settings.showAnswers, quiz.status, attempt.status, isQuizOwner);
  const optOrder = (attempt.optionOrder ?? {}) as Record<string, string[]>;

  const review: ResultQuestionReview[] = orderedQuestions(v, attempt.questionOrder as string[]).map((q) => {
    const ans = byQ.get(q.id);
    const g = ans?.grade;
    const e = g ? effectiveScore(g) : null;
    let opts = [...q.options].sort((x, y) => x.position - y.position);
    const ord = optOrder[q.id];
    if (ord) { const idx = new Map(ord.map((id, i) => [id, i])); opts = opts.sort((x, y) => (idx.get(x.id) ?? 0) - (idx.get(y.id) ?? 0)); }
    const item: ResultQuestionReview = {
      questionId: q.id, text: q.text, type: q.type, points: q.points,
      // per-question verdicts would leak the key, so they follow the same policy
      score: revealed ? (e && !e.pending ? e.score : g?.needsManual ? null : 0) : null,
      isCorrect: revealed ? (g ? g.isCorrect : false) : null,
      needsManual: !!g && g.needsManual && g.manualScore === null,
      yourAnswer: ans ? (ans.value as AnswerValue) : null, timeSpentMs: ans?.timeSpentMs ?? 0, feedback: g?.feedback ?? '',
      options: hasOptions(q.type) ? opts.map((o) => ({ id: o.id, text: o.text })) : [],
    };
    if (revealed) {
      item.correct = {
        ...(hasOptions(q.type) ? { optionIds: q.options.filter((o) => o.isCorrect).map((o) => o.id) } : {}),
        ...(q.type === 'SHORT_ANSWER' ? { acceptedAnswers: q.config.acceptedAnswers } : {}),
        ...(q.type === 'NUMERIC' ? { numericAnswer: q.config.numericAnswer } : {}),
      };
      if (v.settings.showExplanations || isQuizOwner) item.explanation = q.explanation;
    }
    return item;
  });

  let cohortAvgPct: number | null = null;
  let percentile: number | null = null;
  if (attempt.number > 0 && !totals.pending) {
    const [agg, lower, total] = await Promise.all([
      prisma.result.aggregate({ where: { quizId: attempt.quizId, isFinal: true }, _avg: { percentage: true } }),
      prisma.result.count({ where: { quizId: attempt.quizId, isFinal: true, percentage: { lt: totals.percentage } } }),
      prisma.result.count({ where: { quizId: attempt.quizId, isFinal: true } }),
    ]);
    cohortAvgPct = agg._avg.percentage === null ? null : Math.round(agg._avg.percentage * 100) / 100;
    percentile = total > 0 ? Math.round((lower / total) * 100) : null;
  }

  return {
    attemptId: attempt.id, quizId: attempt.quizId, quizTitle: v.title, status: attempt.status, isFinal: !totals.pending,
    score: totals.score, maxScore: totals.maxScore, percentage: totals.percentage, band: totals.band, passed: totals.passed,
    durationSec: attempt.durationSec, submittedAt: attempt.submittedAt?.toISOString() ?? null, cohortAvgPct, percentile,
    answersRevealed: revealed, review,
  };
}
