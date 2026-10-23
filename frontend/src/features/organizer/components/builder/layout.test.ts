import { describe, expect, it } from 'vitest';
import type { QuestionAuthorDto } from '@quiz/shared';
import { applyLayout, buildLayout, layoutToReorder, moveQuestion, moveSection } from './layout';

const q = (id: string, sectionId: string | null, position: number) => ({ id, sectionId, position }) as unknown as QuestionAuthorDto;
const detail = {
  sections: [{ id: 's2', title: 'B', description: '', position: 1 }, { id: 's1', title: 'A', description: '', position: 0 }],
  questions: [q('a', null, 0), q('b', 's1', 1), q('c', 's1', 0), q('d', 's2', 0)],
};

describe('layout', () => {
  it('groups questions by container, ordered by position, with unsectioned first', () => {
    expect(buildLayout(detail)).toEqual([
      { id: null, questionIds: ['a'] }, { id: 's1', questionIds: ['c', 'b'] }, { id: 's2', questionIds: ['d'] },
    ]);
  });

  it('produces a reorder payload with per-container positions', () => {
    const r = layoutToReorder(buildLayout(detail));
    expect(r.items).toContainEqual({ id: 'b', sectionId: 's1', position: 1 });
    expect(r.sections).toEqual([{ id: 's1', position: 0 }, { id: 's2', position: 1 }]);
  });

  it('moves a question within its container, and hops sections at the edge', () => {
    const l = buildLayout(detail);
    expect(moveQuestion(l, 'b', -1)![1]!.questionIds).toEqual(['b', 'c']);
    expect(moveQuestion(l, 'b', 1)![2]!.questionIds).toEqual(['b', 'd']);
    expect(moveQuestion(l, 'a', -1)).toBeNull();
  });

  it('reorders sections but never moves the unsectioned bucket', () => {
    const l = buildLayout(detail);
    expect(moveSection(l, 's1', 1)!.map((c) => c.id)).toEqual([null, 's2', 's1']);
    expect(moveSection(l, 's1', -1)).toBeNull();
  });

  it('applies a layout to cached detail (optimistic update)', () => {
    const moved = moveQuestion(buildLayout(detail), 'd', -1)!;
    const out = applyLayout(detail as never, moved);
    expect(out.questions.find((x) => x.id === 'd')!.sectionId).toBe('s1');
  });
});
