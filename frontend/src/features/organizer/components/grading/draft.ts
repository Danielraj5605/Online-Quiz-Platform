import type { GradingItem } from '@/lib/api/types';

/** Editable grading state for one manually graded answer. */
export interface Draft {
  /** one entry per rubric criterion (null = not scored yet) */
  rubric: (number | null)[];
  /** free score for questions without a rubric (string so the field can be empty) */
  score: string;
  feedback: string;
  dirty: boolean;
}

const round = (n: number) => Math.round(n * 100) / 100;

export function initDraft(item: GradingItem): Draft {
  const rubric = item.config.rubric ?? [];
  const g = item.grade;
  return {
    rubric: rubric.map((_, i) => (g?.rubricScores && g.manualScore != null ? g.rubricScores[i] ?? null : null)),
    score: g?.manualScore != null && rubric.length === 0 ? String(g.manualScore) : '',
    feedback: g?.feedback ?? '',
    dirty: false,
  };
}

/** Total points the draft would award, or null if nothing has been scored. */
export function draftScore(item: GradingItem, d: Draft): number | null {
  if ((item.config.rubric ?? []).length > 0) {
    const set = d.rubric.filter((v): v is number => v != null);
    return set.length ? round(set.reduce((a, b) => a + b, 0)) : null;
  }
  if (d.score.trim() === '') return null;
  const n = Number(d.score);
  return Number.isFinite(n) ? round(n) : null;
}

/** Returns an error message when the draft cannot be saved. */
export function draftError(item: GradingItem, d: Draft): string | null {
  const s = draftScore(item, d);
  if (s == null) return null;
  if (s < 0) return 'Score cannot be negative';
  if (s > item.points) return `Score cannot exceed ${item.points}`;
  return null;
}

/** Digit shortcut: give the criterion `n` points (capped at its maximum); questions without a rubric take the score directly. */
export function applyLevel(item: GradingItem, d: Draft, criterion: number, n: number): Draft {
  const rubric = item.config.rubric ?? [];
  if (rubric.length === 0) return { ...d, score: String(Math.min(n, item.points)), dirty: true };
  const crit = rubric[criterion];
  if (!crit) return d;
  const next = [...d.rubric];
  next[criterion] = Math.min(n, crit.maxPoints);
  return { ...d, rubric: next, dirty: true };
}

/** Payload row for PUT /attempts/:id/grading. */
export function toGradePayload(item: GradingItem, d: Draft) {
  const score = draftScore(item, d) ?? 0;
  const hasRubric = (item.config.rubric ?? []).length > 0;
  return {
    answerId: item.answerId!,
    score,
    feedback: d.feedback.trim(),
    ...(hasRubric ? { rubricScores: d.rubric.map((v) => v ?? 0) } : {}),
  };
}

export const needsManual = (i: GradingItem) => !!i.grade?.needsManual && !!i.answerId;
export const isGraded = (i: GradingItem) => i.grade?.manualScore != null;
