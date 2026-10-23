import { Flag } from 'lucide-react';
import type { AttemptQuestionDto } from '@quiz/shared';
import { cn } from '@/lib/utils';
import { isAnswered, type AnswerMap } from './answerState';

/** Grid of numbered chips. State is conveyed by fill + flag icon + the accessible name, never colour alone. */
export function Navigator({ questions, answers, current, onGo }: {
  questions: AttemptQuestionDto[]; answers: AnswerMap; current: number; onGo: (i: number) => void;
}) {
  return (
    <div>
      <ol className="grid grid-cols-5 gap-2 sm:grid-cols-8 lg:grid-cols-5" aria-label="Questions">
        {questions.map((q, i) => {
          const a = answers[q.id];
          const answered = isAnswered(a?.value);
          const flagged = !!a?.flagged;
          const label = `Question ${i + 1}, ${answered ? 'answered' : 'not answered'}${flagged ? ', flagged for review' : ''}${i === current ? ', current' : ''}`;
          return (
            <li key={q.id}>
              <button
                type="button"
                onClick={() => onGo(i)}
                aria-label={label}
                aria-current={i === current ? 'step' : undefined}
                className={cn(
                  'num relative grid size-11 w-full place-items-center rounded-md border text-sm font-semibold transition-colors',
                  answered ? 'border-text bg-text text-bg' : 'border-border-strong bg-surface text-text hover:bg-surface-2',
                  i === current && 'outline-2 outline-offset-2 outline-accent',
                )}
              >
                {i + 1}
                {flagged && <Flag className="absolute -right-1 -top-1 size-4 fill-warning text-warning" aria-hidden="true" />}
              </button>
            </li>
          );
        })}
      </ol>
      <dl className="mt-4 grid gap-1.5 text-xs text-muted" aria-label="Legend">
        <div className="flex items-center gap-2"><span className="size-4 rounded-sm bg-text" aria-hidden="true" /><dt className="sr-only">Filled</dt><dd>Answered</dd></div>
        <div className="flex items-center gap-2"><span className="size-4 rounded-sm border border-border-strong" aria-hidden="true" /><dt className="sr-only">Outlined</dt><dd>Not answered</dd></div>
        <div className="flex items-center gap-2"><Flag className="size-4 fill-warning text-warning" aria-hidden="true" /><dt className="sr-only">Flag</dt><dd>Flagged for review</dd></div>
      </dl>
    </div>
  );
}
