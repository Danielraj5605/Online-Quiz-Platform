import type { AnswerValue, AttemptViewDto } from '@quiz/shared';

export interface AnswerEntry { value: AnswerValue; flagged: boolean; timeSpentMs: number }
export type AnswerMap = Record<string, AnswerEntry>;

export type AnswerAction =
  | { type: 'init'; answers: AttemptViewDto['answers'] }
  | { type: 'selectOption'; questionId: string; optionId: string; multi: boolean }
  | { type: 'setText'; questionId: string; text: string }
  | { type: 'setNumber'; questionId: string; number: number | undefined }
  | { type: 'toggleFlag'; questionId: string }
  | { type: 'addTime'; questionId: string; ms: number }
  | { type: 'restore'; items: { questionId: string; value: AnswerValue; flagged: boolean; timeSpentMs: number }[] };

const blank = (): AnswerEntry => ({ value: {}, flagged: false, timeSpentMs: 0 });

export function isAnswered(v: AnswerValue | undefined): boolean {
  if (!v) return false;
  if (v.optionIds?.length) return true;
  if (typeof v.number === 'number' && Number.isFinite(v.number)) return true;
  return !!v.text?.trim();
}

function patch(state: AnswerMap, id: string, fn: (e: AnswerEntry) => AnswerEntry): AnswerMap {
  return { ...state, [id]: fn(state[id] ?? blank()) };
}

export function answerReducer(state: AnswerMap, a: AnswerAction): AnswerMap {
  switch (a.type) {
    case 'init': {
      const out: AnswerMap = {};
      for (const [id, v] of Object.entries(a.answers)) out[id] = { value: v.value, flagged: v.flagged, timeSpentMs: 0 };
      return out;
    }
    case 'restore': {
      // unsent local edits win over what the server returned
      let s = state;
      for (const i of a.items) s = patch(s, i.questionId, (e) => ({ value: i.value, flagged: i.flagged, timeSpentMs: Math.max(e.timeSpentMs, i.timeSpentMs) }));
      return s;
    }
    case 'selectOption':
      return patch(state, a.questionId, (e) => {
        const cur = e.value.optionIds ?? [];
        const next = a.multi ? (cur.includes(a.optionId) ? cur.filter((x) => x !== a.optionId) : [...cur, a.optionId]) : [a.optionId];
        return { ...e, value: { optionIds: next } };
      });
    case 'setText':
      return patch(state, a.questionId, (e) => ({ ...e, value: { text: a.text } }));
    case 'setNumber':
      return patch(state, a.questionId, (e) => ({ ...e, value: a.number === undefined ? {} : { number: a.number } }));
    case 'toggleFlag':
      return patch(state, a.questionId, (e) => ({ ...e, flagged: !e.flagged }));
    case 'addTime':
      return a.ms > 0 ? patch(state, a.questionId, (e) => ({ ...e, timeSpentMs: e.timeSpentMs + a.ms })) : state;
  }
}

export interface Summary { total: number; answered: number; unansweredIds: string[]; flaggedIds: string[] }
export function summarize(questionIds: string[], answers: AnswerMap): Summary {
  const unansweredIds = questionIds.filter((id) => !isAnswered(answers[id]?.value));
  const flaggedIds = questionIds.filter((id) => answers[id]?.flagged);
  return { total: questionIds.length, answered: questionIds.length - unansweredIds.length, unansweredIds, flaggedIds };
}
