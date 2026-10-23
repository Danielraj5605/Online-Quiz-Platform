import { describe, expect, it } from 'vitest';
import { blankDraft, changeType, optKey, validateDraft } from './question-draft';

const filled = (type: Parameters<typeof blankDraft>[0]) => ({ ...blankDraft(type), text: 'What is 2+2?' });

describe('validateDraft', () => {
  it('rejects an empty question', () => {
    const v = validateDraft(blankDraft('MCQ_SINGLE'));
    expect(v.valid).toBe(false);
    expect(v.errors.text).toBeTruthy();
    expect(v.errors['options.0.text']).toBeTruthy();
  });

  it('accepts a complete single-choice question', () => {
    const d = filled('MCQ_SINGLE');
    d.options = d.options.map((o, i) => ({ ...o, text: String(i + 3), isCorrect: i === 1 }));
    expect(validateDraft(d).valid).toBe(true);
  });

  it('requires exactly one correct answer for single choice', () => {
    const d = filled('MCQ_SINGLE');
    d.options = d.options.map((o, i) => ({ ...o, text: `o${i}`, isCorrect: true }));
    expect(validateDraft(d).errors.options).toMatch(/exactly 1 correct/);
  });

  it('requires at least one correct answer for multiple choice', () => {
    const d = filled('MCQ_MULTI');
    d.options = d.options.map((o, i) => ({ ...o, text: `o${i}`, isCorrect: false }));
    expect(validateDraft(d).valid).toBe(false);
    d.options[0]!.isCorrect = true;
    expect(validateDraft(d).valid).toBe(true);
  });

  it('true/false ships with True and False and is valid once it has text', () => {
    const d = filled('TRUE_FALSE');
    expect(d.options.map((o) => o.text)).toEqual(['True', 'False']);
    expect(validateDraft(d).valid).toBe(true);
  });

  it('short answer needs an accepted answer', () => {
    const d = filled('SHORT_ANSWER');
    expect(validateDraft(d).errors['config.acceptedAnswers']).toBeTruthy();
    d.config = { ...d.config, acceptedAnswers: ['four'] };
    expect(validateDraft(d).valid).toBe(true);
  });

  it('numeric needs a correct number (0 is allowed)', () => {
    const d = filled('NUMERIC');
    expect(validateDraft(d).errors['config.numericAnswer']).toBeTruthy();
    d.config = { ...d.config, numericAnswer: 0 };
    expect(validateDraft(d).valid).toBe(true);
  });

  it('long answer is valid without options; warns when the rubric total differs from the points', () => {
    const d = filled('LONG_ANSWER');
    d.config = { ...d.config, rubric: [{ criterion: 'Argument', maxPoints: 2 }] };
    const v = validateDraft(d);
    expect(v.valid).toBe(true);
    expect(v.warnings.join(' ')).toMatch(/Rubric totals 2/);
  });

  it('warns about zero points on auto-graded questions', () => {
    const d = { ...filled('TRUE_FALSE'), points: 0 };
    expect(validateDraft(d).warnings[0]).toMatch(/greater than 0/);
  });
});

describe('changeType', () => {
  it('keeps the text and keeps options between single and multiple choice', () => {
    const d = filled('MCQ_MULTI');
    d.options = [
      { key: optKey(), text: 'a', isCorrect: true }, { key: optKey(), text: 'b', isCorrect: true }, { key: optKey(), text: 'c', isCorrect: false },
    ];
    const s = changeType(d, 'MCQ_SINGLE');
    expect(s.text).toBe(d.text);
    expect(s.options.map((o) => o.text)).toEqual(['a', 'b', 'c']);
    expect(s.options.filter((o) => o.isCorrect)).toHaveLength(1);
  });

  it('resets the option model for true/false and drops it for text types', () => {
    const d = filled('MCQ_SINGLE');
    expect(changeType(d, 'TRUE_FALSE').options.map((o) => o.text)).toEqual(['True', 'False']);
    expect(changeType(d, 'NUMERIC').options).toHaveLength(0);
  });

  it('is a no-op for the same type', () => {
    const d = filled('MCQ_SINGLE');
    expect(changeType(d, 'MCQ_SINGLE')).toBe(d);
  });
});
