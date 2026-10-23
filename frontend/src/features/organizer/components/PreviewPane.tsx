import { Clock } from 'lucide-react';
import type { AttemptQuestionDto } from '@quiz/shared';
import { Badge, Card, Input, Textarea } from '@/components/ui';
import { fmtDuration } from '@/lib/utils';

/**
 * Read-only, participant-style rendering of a quiz. It only ever receives the key-free shape (`AttemptQuestionDto`),
 * so what you see is exactly what a participant sees — never the answers.
 */
export function PreviewPane({ title, questions, timeLimitSec, maxAttempts, source }: {
  title: string; questions: AttemptQuestionDto[]; timeLimitSec: number | null; maxAttempts: number; source: string;
}) {
  return (
    <div className="mx-auto grid max-w-2xl gap-4" aria-label="Participant preview">
      <div className="rounded-md bg-teal-soft px-3 py-2 text-sm text-teal" role="note">{source}</div>
      <header className="rounded-lg border border-border bg-surface p-5">
        <h2 className="font-display text-2xl font-semibold">{title}</h2>
        <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
          <span>{questions.length} question{questions.length === 1 ? '' : 's'}</span>
          <span className="inline-flex items-center gap-1"><Clock className="size-3.5" aria-hidden="true" /> {timeLimitSec ? fmtDuration(timeLimitSec) : 'No time limit'}</span>
          <span>{maxAttempts} attempt{maxAttempts === 1 ? '' : 's'}</span>
        </p>
      </header>
      {questions.length === 0 && <p className="text-center text-sm text-muted">Add questions to see them here.</p>}
      {questions.map((q, i) => {
        const showSection = q.sectionTitle && q.sectionTitle !== questions[i - 1]?.sectionTitle;
        return (
          <div key={q.id} className="grid gap-3">
            {showSection && <h3 className="mt-2 font-display text-lg font-semibold">{q.sectionTitle}</h3>}
            <Card>
              <fieldset className="p-5" disabled>
                <legend className="mb-3 flex w-full items-start gap-3">
                  <span className="num grid size-7 shrink-0 place-items-center rounded-sm bg-surface-2 text-sm font-medium">{i + 1}</span>
                  <span className="flex-1 font-medium">{q.text || <span className="text-muted">Untitled question</span>}</span>
                  <Badge tone="accent"><span className="num">{q.points}</span> pt</Badge>
                </legend>
                {(q.type === 'MCQ_SINGLE' || q.type === 'TRUE_FALSE' || q.type === 'MCQ_MULTI') && (
                  <ul className="grid gap-2 pl-10">
                    {q.options.map((o) => (
                      <li key={o.id}>
                        <label className="flex items-center gap-3 rounded-md border border-border px-3 py-2.5 text-sm">
                          <input type={q.type === 'MCQ_MULTI' ? 'checkbox' : 'radio'} disabled className="size-4" aria-label={o.text} /> {o.text}
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
                {q.type === 'MCQ_MULTI' && <p className="mt-2 pl-10 text-xs text-muted">Select all that apply.</p>}
                {q.type === 'SHORT_ANSWER' && <div className="pl-10"><Input disabled placeholder="Type your answer" aria-label="Answer" /></div>}
                {q.type === 'NUMERIC' && <div className="pl-10"><Input disabled type="number" placeholder="Enter a number" aria-label="Answer" className="max-w-48" /></div>}
                {q.type === 'LONG_ANSWER' && <div className="pl-10"><Textarea disabled rows={4} placeholder="Write your answer" aria-label="Answer" /></div>}
              </fieldset>
            </Card>
          </div>
        );
      })}
    </div>
  );
}
