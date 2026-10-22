/**
 * Pure grading functions — no DB, no clock. Unit-tested in tests/grading.test.ts.
 * Rules: see docs/API.md §Rules.
 */
import { bandFor, type AnswerValue, type PublishedQuestion, type QuizSettings } from '@quiz/shared';

export interface GradeOutcome {
  score: number;
  maxScore: number;
  /** null when it cannot be decided yet (manual grading pending) */
  isCorrect: boolean | null;
  needsManual: boolean;
}

export const round2 = (n: number) => { const r = Math.round(n * 100) / 100; return r === 0 ? 0 : r; };

/** NFKC, collapse whitespace, trim; lower-case unless case sensitive. */
export function normalizeText(s: string, caseSensitive = false): string {
  const t = s.normalize('NFKC').trim().replace(/\s+/g, ' ');
  return caseSensitive ? t : t.toLowerCase();
}

export function isBlank(v: AnswerValue | null | undefined): boolean {
  if (!v) return true;
  const hasOpts = !!v.optionIds && v.optionIds.length > 0;
  const hasText = typeof v.text === 'string' && v.text.trim().length > 0;
  const hasNum = typeof v.number === 'number' && Number.isFinite(v.number);
  return !hasOpts && !hasText && !hasNum;
}

type Q = Pick<PublishedQuestion, 'type' | 'points' | 'options' | 'config'>;

export function correctOptionIds(q: Pick<PublishedQuestion, 'options'>): string[] {
  return q.options.filter((o) => o.isCorrect).map((o) => o.id);
}

export function gradeAnswer(q: Q, value: AnswerValue | null | undefined, settings: Pick<QuizSettings, 'negativeMarking'>): GradeOutcome {
  const max = q.points;
  const penalty = settings.negativeMarking * q.points;
  const wrong = (): GradeOutcome => ({ score: round2(-penalty), maxScore: max, isCorrect: false, needsManual: false });
  const right = (): GradeOutcome => ({ score: round2(max), maxScore: max, isCorrect: true, needsManual: false });

  if (q.type === 'LONG_ANSWER') {
    if (isBlank(value)) return { score: 0, maxScore: max, isCorrect: false, needsManual: false };
    return { score: 0, maxScore: max, isCorrect: null, needsManual: true };
  }
  // unanswered: never penalised
  if (isBlank(value)) return { score: 0, maxScore: max, isCorrect: false, needsManual: false };
  const v = value as AnswerValue;

  switch (q.type) {
    case 'MCQ_SINGLE':
    case 'TRUE_FALSE': {
      const sel = v.optionIds ?? [];
      const correct = correctOptionIds(q);
      return sel.length === 1 && correct.length === 1 && sel[0] === correct[0] ? right() : wrong();
    }
    case 'MCQ_MULTI': {
      const sel = new Set(v.optionIds ?? []);
      const correct = new Set(correctOptionIds(q));
      let cs = 0;
      let ws = 0;
      for (const id of sel) { if (correct.has(id)) cs++; else ws++; }
      const exact = cs === correct.size && ws === 0;
      if (exact) return right();
      if (q.config.partialCredit === 'proportional' && correct.size > 0) {
        const raw = (cs - ws) / correct.size;
        if (raw > 0) return { score: round2(raw * max), maxScore: max, isCorrect: false, needsManual: false };
      }
      return wrong();
    }
    case 'SHORT_ANSWER': {
      const given = normalizeText(v.text ?? '', q.config.caseSensitive);
      const ok = q.config.acceptedAnswers.some((a) => normalizeText(a, q.config.caseSensitive) === given);
      return ok ? right() : wrong();
    }
    case 'NUMERIC': {
      const target = q.config.numericAnswer;
      let n = v.number;
      if (n === undefined && v.text !== undefined) n = Number(v.text.trim().replace(',', '.'));
      if (target === null || n === undefined || !Number.isFinite(n)) return wrong();
      return Math.abs(n - target) <= q.config.tolerance + 1e-9 ? right() : wrong();
    }
    default:
      return wrong();
  }
}

export interface AttemptTotals {
  score: number;
  maxScore: number;
  percentage: number;
  passed: boolean;
  band: string | null;
  /** at least one manual item has not been graded yet */
  pending: boolean;
}

/**
 * Totals from per-question effective scores. Questions with no entry count as 0.
 * Total is floored at 0 (negative marking can never push an attempt below zero).
 */
export function scoreAttempt(
  questions: Pick<PublishedQuestion, 'id' | 'points'>[],
  effective: Record<string, { score: number; pending: boolean }>,
  settings: Pick<QuizSettings, 'passMarkPct' | 'gradeBands'>,
): AttemptTotals {
  let score = 0;
  let maxScore = 0;
  let pending = false;
  for (const q of questions) {
    maxScore += q.points;
    const e = effective[q.id];
    if (e) { score += e.score; pending ||= e.pending; }
  }
  score = round2(Math.max(0, score));
  maxScore = round2(maxScore);
  const percentage = maxScore > 0 ? round2((score / maxScore) * 100) : 0;
  return { score, maxScore, percentage, passed: percentage >= settings.passMarkPct, band: bandFor(percentage, settings.gradeBands), pending };
}

/** Effective score of a stored grade row: manual score wins, then auto score. */
export function effectiveScore(g: { autoScore: number | null; manualScore: number | null; needsManual: boolean }): { score: number; pending: boolean } {
  if (g.needsManual) return g.manualScore === null ? { score: 0, pending: true } : { score: g.manualScore, pending: false };
  return { score: g.autoScore ?? 0, pending: false };
}
