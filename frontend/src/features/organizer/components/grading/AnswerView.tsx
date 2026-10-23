import { Check, Circle, CircleDot, Square, SquareCheck } from 'lucide-react';
import { hasOptions } from '@quiz/shared';
import { cn } from '@/lib/utils';
import type { GradingItem } from '@/lib/api/types';

/** Read-only rendering of what the participant answered (text is always rendered as plain text). */
export function AnswerView({ item }: { item: GradingItem }) {
  const v = item.value;
  if (!v || (!v.optionIds?.length && !v.text?.trim() && typeof v.number !== 'number')) {
    return <p className="rounded-md border border-dashed border-border-strong p-3 text-sm italic text-muted">No answer given.</p>;
  }
  if (hasOptions(item.type)) {
    const chosen = new Set(v.optionIds ?? []);
    const multi = item.type === 'MCQ_MULTI';
    return (
      <ul className="grid gap-1.5" aria-label="Participant's selected options">
        {item.options.map((o) => {
          const on = chosen.has(o.id);
          const Icon = multi ? (on ? SquareCheck : Square) : on ? CircleDot : Circle;
          return (
            <li key={o.id} className={cn('flex items-start gap-2 rounded-md border px-3 py-2 text-sm', on ? 'border-text bg-surface-2' : 'border-border')}>
              <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span className="min-w-0 flex-1 break-words">{o.text}</span>
              <span className="sr-only">{on ? 'Selected.' : 'Not selected.'}</span>
              {o.isCorrect && <Check className="size-4 shrink-0 text-success" aria-label="Correct option" />}
            </li>
          );
        })}
      </ul>
    );
  }
  if (typeof v.number === 'number' && item.type === 'NUMERIC') {
    return <p className="num rounded-md border border-border bg-surface-2 px-3 py-2 text-lg">{v.number}</p>;
  }
  return <p className="whitespace-pre-wrap break-words rounded-md border border-border bg-surface-2 p-3 text-sm leading-relaxed">{v.text ?? String(v.number ?? '')}</p>;
}

/** What a correct answer looks like (for the organizer's reference column). */
export function AnswerKey({ item }: { item: GradingItem }) {
  const c = item.config;
  if (hasOptions(item.type)) {
    const correct = item.options.filter((o) => o.isCorrect);
    return (
      <p className="text-sm">
        <span className="text-muted">Correct: </span>
        {correct.map((o) => o.text).join(' · ') || '—'}
      </p>
    );
  }
  if (item.type === 'SHORT_ANSWER') {
    return <p className="text-sm"><span className="text-muted">Accepted: </span>{c.acceptedAnswers.join(' · ') || '—'}</p>;
  }
  if (item.type === 'NUMERIC') {
    return <p className="num text-sm"><span className="font-sans text-muted">Answer: </span>{c.numericAnswer ?? '—'}{c.tolerance ? ` ± ${c.tolerance}` : ''}</p>;
  }
  return null;
}
