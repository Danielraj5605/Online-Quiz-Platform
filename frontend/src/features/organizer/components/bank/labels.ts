import type { QuestionType } from '@quiz/shared';

export const TYPE_LABEL: Record<QuestionType, string> = {
  MCQ_SINGLE: 'Single choice', MCQ_MULTI: 'Multiple choice', TRUE_FALSE: 'True / False',
  SHORT_ANSWER: 'Short answer', NUMERIC: 'Numeric', LONG_ANSWER: 'Long answer (manual grading)',
};
