import { describe, expect, it } from 'vitest';
import { answerReducer, isAnswered, summarize, type AnswerMap } from './answerState';

describe('answerReducer', () => {
  it('single choice replaces, multi choice toggles', () => {
    let s: AnswerMap = {};
    s = answerReducer(s, { type: 'selectOption', questionId: 'q', optionId: 'a', multi: false });
    s = answerReducer(s, { type: 'selectOption', questionId: 'q', optionId: 'b', multi: false });
    expect(s.q!.value.optionIds).toEqual(['b']);
    s = answerReducer({}, { type: 'selectOption', questionId: 'm', optionId: 'a', multi: true });
    s = answerReducer(s, { type: 'selectOption', questionId: 'm', optionId: 'b', multi: true });
    s = answerReducer(s, { type: 'selectOption', questionId: 'm', optionId: 'a', multi: true });
    expect(s.m!.value.optionIds).toEqual(['b']);
  });

  it('number and text answers; clearing a number unanswers it', () => {
    let s = answerReducer({}, { type: 'setNumber', questionId: 'n', number: 3.5 });
    expect(isAnswered(s.n!.value)).toBe(true);
    s = answerReducer(s, { type: 'setNumber', questionId: 'n', number: undefined });
    expect(isAnswered(s.n!.value)).toBe(false);
    s = answerReducer(s, { type: 'setText', questionId: 't', text: '   ' });
    expect(isAnswered(s.t!.value)).toBe(false);
  });

  it('0 counts as an answered number', () => {
    expect(isAnswered({ number: 0 })).toBe(true);
  });

  it('flag toggles independently of the value and time accumulates', () => {
    let s = answerReducer({}, { type: 'toggleFlag', questionId: 'q' });
    expect(s.q!.flagged).toBe(true);
    s = answerReducer(s, { type: 'addTime', questionId: 'q', ms: 1500 });
    s = answerReducer(s, { type: 'addTime', questionId: 'q', ms: 500 });
    expect(s.q!.timeSpentMs).toBe(2000);
    s = answerReducer(s, { type: 'toggleFlag', questionId: 'q' });
    expect(s.q!.flagged).toBe(false);
  });

  it('init maps the server payload and restore lets unsent local edits win', () => {
    let s = answerReducer({}, { type: 'init', answers: { q1: { value: { text: 'server' }, flagged: false } } });
    s = answerReducer(s, { type: 'restore', items: [{ questionId: 'q1', value: { text: 'local' }, flagged: true, timeSpentMs: 5 }] });
    expect(s.q1).toMatchObject({ value: { text: 'local' }, flagged: true, timeSpentMs: 5 });
  });

  it('summarize reports answered, unanswered and flagged', () => {
    let s: AnswerMap = {};
    s = answerReducer(s, { type: 'selectOption', questionId: 'a', optionId: 'x', multi: false });
    s = answerReducer(s, { type: 'toggleFlag', questionId: 'b' });
    expect(summarize(['a', 'b', 'c'], s)).toEqual({ total: 3, answered: 1, unansweredIds: ['b', 'c'], flaggedIds: ['b'] });
  });
});
