import { hasOptions, questionConfigSchema, questionInputSchema, type QuestionAuthorDto, type QuestionConfig, type QuestionInput, type QuestionType } from '@quiz/shared';

export interface DraftOption { key: string; text: string; isCorrect: boolean }
export interface QuestionDraft {
  type: QuestionType; text: string; explanation: string; points: number; sectionId: string | null;
  options: DraftOption[]; config: QuestionConfig;
}

let seq = 0;
export const optKey = () => `o${Date.now().toString(36)}${(seq++).toString(36)}`;
const defaultConfig = (): QuestionConfig => questionConfigSchema.parse({});

export const TYPE_LABEL: Record<QuestionType, string> = {
  MCQ_SINGLE: 'Single choice', MCQ_MULTI: 'Multiple choice', TRUE_FALSE: 'True / False',
  SHORT_ANSWER: 'Short answer', NUMERIC: 'Numeric', LONG_ANSWER: 'Long answer (manual)',
};

function defaultOptions(type: QuestionType): DraftOption[] {
  if (type === 'TRUE_FALSE') return [{ key: optKey(), text: 'True', isCorrect: true }, { key: optKey(), text: 'False', isCorrect: false }];
  if (type === 'MCQ_SINGLE' || type === 'MCQ_MULTI') {
    return [{ key: optKey(), text: '', isCorrect: true }, { key: optKey(), text: '', isCorrect: false }, { key: optKey(), text: '', isCorrect: false }];
  }
  return [];
}

export function blankDraft(type: QuestionType = 'MCQ_SINGLE', sectionId: string | null = null): QuestionDraft {
  return { type, text: '', explanation: '', points: type === 'LONG_ANSWER' ? 5 : 1, sectionId, options: defaultOptions(type), config: defaultConfig() };
}

export function fromDto(q: QuestionAuthorDto): QuestionDraft {
  return {
    type: q.type, text: q.text, explanation: q.explanation, points: q.points, sectionId: q.sectionId,
    options: q.options.map((o) => ({ key: o.id, text: o.text, isCorrect: o.isCorrect })), config: { ...defaultConfig(), ...q.config },
  };
}

export function toInput(d: QuestionDraft): QuestionInput {
  return {
    type: d.type, text: d.text, explanation: d.explanation, points: d.points, sectionId: d.sectionId,
    options: hasOptions(d.type) ? d.options.map((o) => ({ text: o.text, isCorrect: o.isCorrect })) : [],
    config: d.config,
  };
}

/** Rebuild an input from a stored DTO (used for undo/redo snapshots). */
export const dtoToInput = (q: QuestionAuthorDto): QuestionInput => toInput(fromDto(q));

/** Switch type, keeping text/points/explanation and resetting the option model. */
export function changeType(d: QuestionDraft, type: QuestionType): QuestionDraft {
  if (type === d.type) return d;
  const keepOptions = hasOptions(d.type) && hasOptions(type) && type !== 'TRUE_FALSE' && d.type !== 'TRUE_FALSE';
  let options = keepOptions ? d.options : defaultOptions(type);
  if (keepOptions && type === 'MCQ_SINGLE') {
    let seen = false;
    options = options.map((o) => { const c = o.isCorrect && !seen; if (o.isCorrect) seen = true; return { ...o, isCorrect: c }; });
    if (!seen && options[0]) options = options.map((o, i) => ({ ...o, isCorrect: i === 0 }));
  }
  return { ...d, type, options, points: type === 'LONG_ANSWER' && d.points <= 1 ? 5 : d.points };
}

export interface DraftValidation { valid: boolean; errors: Record<string, string>; warnings: string[] }

/** Validate with the same zod schema the API uses; errors are keyed by dotted path ("options.1.text"). */
export function validateDraft(d: QuestionDraft): DraftValidation {
  const r = questionInputSchema.safeParse(toInput(d));
  const errors: Record<string, string> = {};
  if (!r.success) for (const i of r.error.issues) { const k = i.path.join('.') || 'form'; errors[k] ??= i.message; }
  const warnings: string[] = [];
  if (d.type !== 'LONG_ANSWER' && d.points <= 0) warnings.push('Points must be greater than 0 before publishing');
  if (d.type === 'LONG_ANSWER' && d.config.rubric.length) {
    const sum = d.config.rubric.reduce((s, x) => s + x.maxPoints, 0);
    if (sum !== d.points) warnings.push(`Rubric totals ${sum} but the question is worth ${d.points}`);
  }
  return { valid: r.success, errors, warnings };
}

/** One-line summary of the correct answer for the collapsed card. */
export function answerHint(q: QuestionAuthorDto): string {
  switch (q.type) {
    case 'MCQ_SINGLE': case 'TRUE_FALSE': return q.options.find((o) => o.isCorrect)?.text ?? '—';
    case 'MCQ_MULTI': return q.options.filter((o) => o.isCorrect).map((o) => o.text).join(', ') || '—';
    case 'SHORT_ANSWER': return q.config.acceptedAnswers.join(' / ') || '—';
    case 'NUMERIC': return q.config.numericAnswer == null ? '—' : `${q.config.numericAnswer}${q.config.tolerance ? ` ± ${q.config.tolerance}` : ''}`;
    case 'LONG_ANSWER': return 'Graded manually';
  }
}
