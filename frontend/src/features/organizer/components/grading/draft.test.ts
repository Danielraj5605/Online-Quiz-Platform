import { describe, expect, it } from 'vitest';
import type { GradingItem } from '@/lib/api/types';
import { applyLevel, draftError, draftScore, initDraft, toGradePayload } from './draft';

const rubricItem = {
  questionId: 'q1', type: 'LONG_ANSWER', text: 'Explain', points: 10, explanation: '', options: [],
  config: { rubric: [{ criterion: 'Clarity', maxPoints: 4 }, { criterion: 'Accuracy', maxPoints: 6 }] },
  answerId: 'a1', value: { text: 'hi' }, timeSpentMs: 0, flagged: false,
  grade: { autoScore: null, manualScore: null, needsManual: true, isCorrect: null, maxScore: 10, feedback: '', rubricScores: null, gradedAt: null, effective: 0 },
} as unknown as GradingItem;
const plainItem = { ...rubricItem, config: { rubric: [] }, points: 5 } as unknown as GradingItem;

describe('grading drafts', () => {
  it('starts empty and unscored', () => {
    const d = initDraft(rubricItem);
    expect(d.rubric).toEqual([null, null]);
    expect(draftScore(rubricItem, d)).toBeNull();
  });

  it('caps a digit shortcut at the criterion maximum and sums rubric points', () => {
    let d = initDraft(rubricItem);
    d = applyLevel(rubricItem, d, 0, 9); // Clarity max 4
    d = applyLevel(rubricItem, d, 1, 5);
    expect(d.rubric).toEqual([4, 5]);
    expect(draftScore(rubricItem, d)).toBe(9);
    expect(d.dirty).toBe(true);
  });

  it('applies digits directly to questions without a rubric, capped at the question points', () => {
    const d = applyLevel(plainItem, initDraft(plainItem), 0, 9);
    expect(draftScore(plainItem, d)).toBe(5);
  });

  it('flags scores above the question maximum', () => {
    const d = { ...initDraft(plainItem), score: '6' };
    expect(draftError(plainItem, d)).toMatch(/exceed 5/);
    expect(draftError(plainItem, { ...d, score: '3.5' })).toBeNull();
  });

  it('builds the payload with full-length rubric scores', () => {
    const d = applyLevel(rubricItem, initDraft(rubricItem), 1, 3);
    d.feedback = ' good ';
    expect(toGradePayload(rubricItem, d)).toEqual({ answerId: 'a1', score: 3, feedback: 'good', rubricScores: [0, 3] });
  });
});
