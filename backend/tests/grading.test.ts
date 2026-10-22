import { describe, expect, it } from 'vitest';
import { questionConfigSchema, type PublishedQuestion, type QuizSettings } from '@quiz/shared';
import { effectiveScore, gradeAnswer, isBlank, normalizeText, scoreAttempt } from '../src/modules/grading/engine';

const cfg = (o: object = {}) => questionConfigSchema.parse(o);
const opts = (...c: boolean[]) => c.map((isCorrect, i) => ({ id: `o${i}`, text: `Option ${i}`, isCorrect, position: i }));
const q = (type: PublishedQuestion['type'], options: ReturnType<typeof opts> = [], config: object = {}, points = 2) =>
  ({ type, points, options, config: cfg(config) });
const neg = (n: number): Pick<QuizSettings, 'negativeMarking'> => ({ negativeMarking: n });
const none = neg(0);

describe('normalizeText / isBlank', () => {
  it('trims, collapses whitespace and lowercases', () => expect(normalizeText('  Hello   World ')).toBe('hello world'));
  it('keeps case when case sensitive', () => expect(normalizeText(' A  b ', true)).toBe('A b'));
  it('normalises unicode forms', () => expect(normalizeText('ｆｕｌｌ')).toBe('full'));
  it('detects blanks', () => {
    expect(isBlank(null)).toBe(true);
    expect(isBlank({})).toBe(true);
    expect(isBlank({ optionIds: [] })).toBe(true);
    expect(isBlank({ text: '   ' })).toBe(true);
    expect(isBlank({ number: 0 })).toBe(false);
    expect(isBlank({ optionIds: ['a'] })).toBe(false);
  });
});

describe('MCQ_SINGLE / TRUE_FALSE', () => {
  const single = q('MCQ_SINGLE', opts(false, true, false));
  it('awards points for the right option', () => expect(gradeAnswer(single, { optionIds: ['o1'] }, none)).toMatchObject({ score: 2, isCorrect: true }));
  it('zero for wrong with no negative marking', () => expect(gradeAnswer(single, { optionIds: ['o0'] }, none)).toMatchObject({ score: 0, isCorrect: false }));
  it('deducts negative marking for wrong', () => expect(gradeAnswer(single, { optionIds: ['o0'] }, neg(0.25)).score).toBe(-0.5));
  it('never penalises unanswered', () => expect(gradeAnswer(single, null, neg(0.5))).toMatchObject({ score: 0, isCorrect: false }));
  it('treats multiple selections as wrong', () => expect(gradeAnswer(single, { optionIds: ['o1', 'o0'] }, none).isCorrect).toBe(false));
  it('ignores unknown option ids as wrong', () => expect(gradeAnswer(single, { optionIds: ['zzz'] }, none).isCorrect).toBe(false));
  it('grades true/false', () => {
    const tf = q('TRUE_FALSE', opts(true, false), {}, 1);
    expect(gradeAnswer(tf, { optionIds: ['o0'] }, none).score).toBe(1);
    expect(gradeAnswer(tf, { optionIds: ['o1'] }, neg(1)).score).toBe(-1);
  });
});

describe('MCQ_MULTI', () => {
  const all = q('MCQ_MULTI', opts(true, true, false, false), { partialCredit: 'none' });
  const prop = q('MCQ_MULTI', opts(true, true, false, false), { partialCredit: 'proportional' });
  it('all-or-nothing: exact set wins', () => expect(gradeAnswer(all, { optionIds: ['o1', 'o0'] }, none)).toMatchObject({ score: 2, isCorrect: true }));
  it('all-or-nothing: subset gets nothing', () => expect(gradeAnswer(all, { optionIds: ['o0'] }, none).score).toBe(0));
  it('all-or-nothing: extra wrong gets nothing', () => expect(gradeAnswer(all, { optionIds: ['o0', 'o1', 'o2'] }, none).score).toBe(0));
  it('proportional: half right gives half points', () => expect(gradeAnswer(prop, { optionIds: ['o0'] }, none)).toMatchObject({ score: 1, isCorrect: false }));
  it('proportional: wrong selection reduces credit', () => expect(gradeAnswer(prop, { optionIds: ['o0', 'o2'] }, none).score).toBe(0));
  it('proportional: floor at zero then negative marking applies only when nothing earned', () => {
    expect(gradeAnswer(prop, { optionIds: ['o2', 'o3'] }, neg(0.5)).score).toBe(-1);
    expect(gradeAnswer(prop, { optionIds: ['o0'] }, neg(0.5)).score).toBe(1);
  });
  it('proportional: exact is full marks', () => expect(gradeAnswer(prop, { optionIds: ['o0', 'o1'] }, none).score).toBe(2));
  it('negative marking applies to wrong all-or-nothing answers', () => expect(gradeAnswer(all, { optionIds: ['o0'] }, neg(0.5)).score).toBe(-1));
});

describe('SHORT_ANSWER', () => {
  const sa = q('SHORT_ANSWER', [], { acceptedAnswers: ['Paris', 'City of Light'] });
  it('is case/whitespace insensitive by default', () => expect(gradeAnswer(sa, { text: '  paris ' }, none).isCorrect).toBe(true));
  it('accepts alternates', () => expect(gradeAnswer(sa, { text: 'city  of light' }, none).isCorrect).toBe(true));
  it('rejects other text', () => expect(gradeAnswer(sa, { text: 'Lyon' }, neg(0.5)).score).toBe(-1));
  it('honours case sensitivity', () => {
    const cs = q('SHORT_ANSWER', [], { acceptedAnswers: ['NaCl'], caseSensitive: true });
    expect(gradeAnswer(cs, { text: 'nacl' }, none).isCorrect).toBe(false);
    expect(gradeAnswer(cs, { text: 'NaCl' }, none).isCorrect).toBe(true);
  });
});

describe('NUMERIC', () => {
  const n = q('NUMERIC', [], { numericAnswer: 3.14, tolerance: 0.01 });
  it('accepts within tolerance', () => expect(gradeAnswer(n, { number: 3.145 }, none).isCorrect).toBe(true));
  it('accepts the boundary', () => expect(gradeAnswer(n, { number: 3.15 }, none).isCorrect).toBe(true));
  it('rejects outside tolerance', () => expect(gradeAnswer(n, { number: 3.2 }, none).isCorrect).toBe(false));
  it('parses numeric text with a comma', () => expect(gradeAnswer(n, { text: '3,14' }, none).isCorrect).toBe(true));
  it('treats zero as an answer, not blank', () => {
    const z = q('NUMERIC', [], { numericAnswer: 0, tolerance: 0 });
    expect(gradeAnswer(z, { number: 0 }, none).isCorrect).toBe(true);
  });
  it('rejects non-numeric text', () => expect(gradeAnswer(n, { text: 'abc' }, none).isCorrect).toBe(false));
});

describe('LONG_ANSWER', () => {
  const la = q('LONG_ANSWER', [], {}, 5);
  it('needs manual grading when answered', () => expect(gradeAnswer(la, { text: 'An essay' }, neg(1))).toEqual({ score: 0, maxScore: 5, isCorrect: null, needsManual: true }));
  it('blank is zero without manual grading', () => expect(gradeAnswer(la, { text: ' ' }, none)).toMatchObject({ score: 0, needsManual: false, isCorrect: false }));
});

describe('scoreAttempt', () => {
  const qs = [{ id: 'a', points: 2 }, { id: 'b', points: 3 }, { id: 'c', points: 5 }];
  const settings = { passMarkPct: 50, gradeBands: [{ label: 'A', minPct: 80 }, { label: 'B', minPct: 50 }, { label: 'F', minPct: 0 }] };
  it('sums and bands', () => {
    const t = scoreAttempt(qs, { a: { score: 2, pending: false }, b: { score: 3, pending: false }, c: { score: 3, pending: false } }, settings);
    expect(t).toMatchObject({ score: 8, maxScore: 10, percentage: 80, passed: true, band: 'A', pending: false });
  });
  it('floors the total at zero', () => {
    const t = scoreAttempt(qs, { a: { score: -1, pending: false }, b: { score: -1.5, pending: false } }, settings);
    expect(t).toMatchObject({ score: 0, percentage: 0, passed: false, band: 'F' });
  });
  it('reports pending manual items', () => {
    const t = scoreAttempt(qs, { c: { score: 0, pending: true } }, settings);
    expect(t.pending).toBe(true);
  });
  it('pass mark is inclusive', () => {
    const t = scoreAttempt(qs, { c: { score: 5, pending: false } }, settings);
    expect(t).toMatchObject({ percentage: 50, passed: true, band: 'B' });
  });
  it('handles an empty quiz', () => expect(scoreAttempt([], {}, settings)).toMatchObject({ maxScore: 0, percentage: 0 }));
});

describe('effectiveScore', () => {
  it('manual wins and is not pending once graded', () => expect(effectiveScore({ autoScore: null, manualScore: 3, needsManual: true })).toEqual({ score: 3, pending: false }));
  it('manual ungraded is pending', () => expect(effectiveScore({ autoScore: null, manualScore: null, needsManual: true })).toEqual({ score: 0, pending: true }));
  it('objective uses auto score', () => expect(effectiveScore({ autoScore: -0.5, manualScore: null, needsManual: false })).toEqual({ score: -0.5, pending: false }));
});
