import { forwardRef, useState } from 'react';
import { Check } from 'lucide-react';
import type { AttemptQuestionDto } from '@quiz/shared';
import { cn } from '@/lib/utils';
import { Input, Textarea } from '@/components/ui';
import type { AnswerEntry } from './answerState';
import { optionLetter } from './optionLetter';

const TYPE_HINT: Record<AttemptQuestionDto['type'], string> = {
  MCQ_SINGLE: 'Choose one answer',
  TRUE_FALSE: 'Choose true or false',
  MCQ_MULTI: 'Choose all that apply',
  SHORT_ANSWER: 'Type a short answer',
  NUMERIC: 'Enter a number',
  LONG_ANSWER: 'Write your answer',
};

interface Props {
  question: AttemptQuestionDto;
  index: number;
  total: number;
  entry: AnswerEntry | undefined;
  onSelect: (optionId: string) => void;
  onText: (text: string) => void;
  onNumber: (n: number | undefined) => void;
}

/** One question. The heading receives focus when the question changes (see QuizTaker). */
export const QuestionView = forwardRef<HTMLHeadingElement, Props>(function QuestionView({ question: q, index, total, entry, onSelect, onText, onNumber }, headingRef) {
  const multi = q.type === 'MCQ_MULTI';
  const hasOptions = q.type === 'MCQ_SINGLE' || q.type === 'MCQ_MULTI' || q.type === 'TRUE_FALSE';
  const selected = new Set(entry?.value.optionIds ?? []);
  const [raw, setRaw] = useState(() => (typeof entry?.value.number === 'number' ? String(entry.value.number) : ''));
  const max = q.maxLength ?? 5000;
  const text = entry?.value.text ?? '';

  return (
    <section aria-labelledby={`q-${q.id}-title`}>
      <p className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
        <span className="num font-semibold text-text">Question {index + 1} of {total}</span>
        {q.sectionTitle && <span>{q.sectionTitle}</span>}
        <span className="num">{q.points} {q.points === 1 ? 'point' : 'points'}</span>
      </p>
      <h1 ref={headingRef} tabIndex={-1} id={`q-${q.id}-title`} className="mb-5 whitespace-pre-wrap font-display text-2xl font-semibold leading-snug outline-none sm:text-3xl">
        {q.text}
      </h1>

      {hasOptions ? (
        <fieldset className="grid gap-3">
          <legend className="mb-3 text-sm text-muted">{TYPE_HINT[q.type]}</legend>
          {q.options.map((o, i) => (
            <label
              key={o.id}
              className={cn(
                'group flex min-h-14 cursor-pointer items-center gap-3 rounded-lg border border-border-strong bg-surface p-3.5 transition-colors',
                'hover:border-text has-[:checked]:border-accent has-[:checked]:bg-accent-soft has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus',
              )}
            >
              <input
                type={multi ? 'checkbox' : 'radio'}
                name={`q-${q.id}`}
                value={o.id}
                checked={selected.has(o.id)}
                onChange={() => onSelect(o.id)}
                className="sr-only"
              />
              <span aria-hidden="true" className={cn('num grid size-8 shrink-0 place-items-center border border-border-strong bg-surface-2 text-sm font-semibold group-has-[:checked]:border-accent group-has-[:checked]:bg-accent group-has-[:checked]:text-on-accent', multi ? 'rounded-sm' : 'rounded-full')}>
                <span className="group-has-[:checked]:hidden">{optionLetter(i)}</span>
                <Check className="hidden size-4 group-has-[:checked]:block" strokeWidth={3} />
              </span>
              <span className="text-base leading-snug">{o.text}</span>
            </label>
          ))}
        </fieldset>
      ) : q.type === 'SHORT_ANSWER' ? (
        <div className="grid gap-2">
          <label htmlFor={`a-${q.id}`} className="text-sm text-muted">{TYPE_HINT[q.type]}</label>
          <Input id={`a-${q.id}`} className="h-12 text-base" value={text} maxLength={500} autoComplete="off" onChange={(e) => onText(e.target.value)} />
        </div>
      ) : q.type === 'NUMERIC' ? (
        <div className="grid gap-2">
          <label htmlFor={`a-${q.id}`} className="text-sm text-muted">{TYPE_HINT[q.type]}</label>
          <Input
            id={`a-${q.id}`}
            className="num h-12 max-w-xs text-lg"
            inputMode="decimal"
            autoComplete="off"
            value={raw}
            onChange={(e) => {
              const v = e.target.value;
              if (!/^-?\d*[.,]?\d*$/.test(v)) return;
              setRaw(v);
              const n = Number(v.replace(',', '.'));
              onNumber(v.trim() === '' || v === '-' || !Number.isFinite(n) ? undefined : n);
            }}
          />
        </div>
      ) : (
        <div className="grid gap-2">
          <label htmlFor={`a-${q.id}`} className="text-sm text-muted">{TYPE_HINT[q.type]}</label>
          <Textarea id={`a-${q.id}`} rows={9} className="min-h-48 text-base" value={text} maxLength={max} onChange={(e) => onText(e.target.value)} aria-describedby={`a-${q.id}-count`} />
          <p id={`a-${q.id}-count`} className="num text-right text-xs text-muted">{text.length} / {max}</p>
        </div>
      )}
    </section>
  );
});
