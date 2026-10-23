import { describe, expect, it } from 'vitest';
import type { ItemAnalysisRow } from '@/lib/api/types';
import { itemFlags } from './item-flags';

const row = (o: Partial<ItemAnalysisRow> = {}): ItemAnalysisRow => ({
  questionId: 'q', text: 'Q', type: 'MCQ_SINGLE', points: 1, responses: 20, difficulty: 0.6, discrimination: 0.3,
  avgTimeMs: 10000, omitRate: 0, distractors: [], ...o,
});
const ids = (r: ItemAnalysisRow) => itemFlags(r).map((f) => f.id);

describe('itemFlags', () => {
  it('holds judgement until there are enough responses', () => {
    expect(ids(row({ responses: 3, difficulty: 1, discrimination: -1 }))).toEqual(['few']);
  });

  it('flags questions that are too easy or very hard', () => {
    expect(ids(row({ difficulty: 0.95 }))).toContain('easy');
    expect(ids(row({ difficulty: 0.2 }))).toContain('hard');
    expect(ids(row({ difficulty: 0.6 }))).not.toContain('easy');
  });

  it('flags negative discrimination as a possible wrong key', () => {
    const f = itemFlags(row({ discrimination: -0.15 })).find((x) => x.id === 'negative');
    expect(f?.tone).toBe('danger');
  });

  it('flags poor discrimination but not when ceiling/floor effects explain it', () => {
    expect(ids(row({ discrimination: 0.05, difficulty: 0.6 }))).toContain('poor');
    expect(ids(row({ discrimination: 0.05, difficulty: 0.97 }))).not.toContain('poor');
  });

  it('praises strongly discriminating questions', () => {
    expect(ids(row({ discrimination: 0.55 }))).toContain('great');
  });

  it('flags skipped questions', () => {
    expect(ids(row({ omitRate: 0.35 }))).toContain('skipped');
  });

  it('flags unused distractors and distractors that beat the key', () => {
    const r = row({
      type: 'MCQ_SINGLE',
      distractors: [
        { optionId: 'a', text: 'Right', count: 4, isCorrect: true },
        { optionId: 'b', text: 'Tempting', count: 12, isCorrect: false },
        { optionId: 'c', text: 'Silly', count: 0, isCorrect: false },
      ],
    });
    expect(ids(r)).toEqual(expect.arrayContaining(['unused', 'magnet']));
    expect(itemFlags(r).find((f) => f.id === 'magnet')?.detail).toContain('Tempting');
  });

  it('copes with null statistics', () => {
    expect(() => itemFlags(row({ difficulty: null, discrimination: null }))).not.toThrow();
  });
});
