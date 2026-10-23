import type { QuestionAuthorDto, QuizDetailDto, SectionDto } from '@quiz/shared';
import type { ReorderInput } from '@/lib/api/structure';

/** Ordered containers: the implicit "unsectioned" bucket (id null) first, then sections by position. */
export interface Container { id: string | null; questionIds: string[] }
export type Layout = Container[];

export function buildLayout(d: Pick<QuizDetailDto, 'sections' | 'questions'>): Layout {
  const sections = [...d.sections].sort((a, b) => a.position - b.position);
  const byContainer = new Map<string | null, QuestionAuthorDto[]>([[null, []], ...sections.map((s) => [s.id, []] as [string, QuestionAuthorDto[]])]);
  for (const q of d.questions) (byContainer.get(q.sectionId) ?? byContainer.get(null)!).push(q);
  return [null, ...sections.map((s) => s.id)].map((id) => ({
    id,
    questionIds: byContainer.get(id)!.sort((a, b) => a.position - b.position).map((q) => q.id),
  }));
}

export function layoutToReorder(layout: Layout): ReorderInput {
  const items: ReorderInput['items'] = [];
  const sections: NonNullable<ReorderInput['sections']> = [];
  layout.forEach((c) => {
    if (c.id) sections.push({ id: c.id, position: sections.length });
    c.questionIds.forEach((id, i) => items.push({ id, sectionId: c.id, position: i }));
  });
  return { items, sections };
}

/** Apply a layout to a cached quiz detail (used for optimistic updates). */
export function applyLayout(d: QuizDetailDto, layout: Layout): QuizDetailDto {
  const r = layoutToReorder(layout);
  const place = new Map(r.items.map((i) => [i.id, i]));
  const spos = new Map((r.sections ?? []).map((s) => [s.id, s.position]));
  return {
    ...d,
    sections: d.sections.map((s) => ({ ...s, position: spos.get(s.id) ?? s.position })).sort((a, b) => a.position - b.position),
    questions: d.questions
      .map((q) => ({ ...q, sectionId: place.get(q.id)?.sectionId ?? q.sectionId, position: place.get(q.id)?.position ?? q.position }))
      .sort((a, b) => a.position - b.position),
  };
}

const clone = (l: Layout): Layout => l.map((c) => ({ ...c, questionIds: [...c.questionIds] }));
const flatIndex = (l: Layout, qid: string) => {
  for (let ci = 0; ci < l.length; ci++) { const i = l[ci]!.questionIds.indexOf(qid); if (i >= 0) return { ci, i }; }
  return null;
};

/** Move a question one step up/down. At a container edge it hops into the neighbouring section. */
export function moveQuestion(layout: Layout, qid: string, dir: -1 | 1): Layout | null {
  const pos = flatIndex(layout, qid);
  if (!pos) return null;
  const l = clone(layout);
  const { ci, i } = pos;
  const here = l[ci]!.questionIds;
  const j = i + dir;
  if (j >= 0 && j < here.length) { [here[i], here[j]] = [here[j]!, here[i]!]; return l; }
  const ni = ci + dir;
  if (ni < 0 || ni >= l.length) return null;
  here.splice(i, 1);
  if (dir === -1) l[ni]!.questionIds.push(qid); else l[ni]!.questionIds.unshift(qid);
  return l;
}

/** Move a section one step; the unsectioned bucket (index 0) is fixed. */
export function moveSection(layout: Layout, sectionId: string, dir: -1 | 1): Layout | null {
  const idx = layout.findIndex((c) => c.id === sectionId);
  const to = idx + dir;
  if (idx < 1 || to < 1 || to >= layout.length) return null;
  const l = clone(layout);
  [l[idx], l[to]] = [l[to]!, l[idx]!];
  return l;
}

export const sameLayout = (a: Layout, b: Layout) => JSON.stringify(a) === JSON.stringify(b);

export function sectionTitle(sections: SectionDto[], id: string | null) {
  return id ? sections.find((s) => s.id === id)?.title ?? 'Section' : 'Unsectioned';
}
