import { Check, CircleDashed, Clock, Minus, X } from 'lucide-react';
import type { ResultQuestionReview } from '@quiz/shared';
import { cn, fmtDuration } from '@/lib/utils';
import { Badge, Card } from '@/components/ui';
import { optionLetter } from './QuizTaker/optionLetter';

function Verdict({ r }: { r: ResultQuestionReview }) {
  if (r.needsManual) return <Badge tone="warning"><CircleDashed className="size-3" aria-hidden="true" /> Awaiting grading</Badge>;
  if (r.isCorrect === null) return <Badge><Minus className="size-3" aria-hidden="true" /> Answer hidden</Badge>;
  return r.isCorrect
    ? <Badge tone="success"><Check className="size-3" aria-hidden="true" /> Correct</Badge>
    : <Badge tone="danger"><X className="size-3" aria-hidden="true" /> {r.score != null && r.score > 0 ? 'Partly correct' : 'Incorrect'}</Badge>;
}

/** One reviewed question. Never assumes the key is present — `correct` / `explanation` / scores can all be absent or null. */
export function QuestionReviewCard({ r, index }: { r: ResultQuestionReview; index: number }) {
  const mine = new Set(r.yourAnswer?.optionIds ?? []);
  const key = new Set(r.correct?.optionIds ?? []);
  const unanswered = !r.yourAnswer || (!mine.size && r.yourAnswer.text == null && r.yourAnswer.number == null);
  return (
    <Card className="p-4 sm:p-5">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="num text-sm font-semibold text-muted">Q{index + 1}</span>
        <Verdict r={r} />
        <span className="num ml-auto text-sm text-muted">
          {r.score != null ? <><span className="font-semibold text-text">{Number.isInteger(r.score) ? r.score : r.score.toFixed(2)}</span> / {r.points}</> : <>{r.points} pts</>}
        </span>
      </div>
      <h3 className="whitespace-pre-wrap font-display text-lg font-semibold leading-snug">{r.text}</h3>

      {r.options.length > 0 ? (
        <ul className="mt-3 grid gap-2">
          {r.options.map((o, i) => {
            const picked = mine.has(o.id);
            const isKey = key.has(o.id);
            return (
              <li
                key={o.id}
                className={cn(
                  'flex items-center gap-3 rounded-md border p-2.5 text-sm',
                  isKey ? 'border-success bg-success-soft' : picked && r.correct ? 'border-danger bg-danger-soft' : picked ? 'border-accent bg-accent-soft' : 'border-border',
                )}
              >
                <span className="num grid size-6 shrink-0 place-items-center rounded-sm bg-surface-2 text-xs font-semibold" aria-hidden="true">{optionLetter(i)}</span>
                <span className="flex-1">{o.text}</span>
                <span className="flex shrink-0 gap-1.5 text-xs font-medium">
                  {picked && <span className="rounded-sm bg-text px-1.5 py-0.5 text-bg">Your answer</span>}
                  {isKey && <span className="inline-flex items-center gap-1 text-success"><Check className="size-3.5" aria-hidden="true" /> Correct</span>}
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="mt-3 grid gap-2 text-sm">
          <div className="rounded-md border border-border bg-surface-2 p-3">
            <p className="mb-1 text-xs font-medium text-muted">Your answer</p>
            {unanswered ? <p className="italic text-muted">No answer given</p> : <p className="whitespace-pre-wrap">{r.yourAnswer?.number ?? r.yourAnswer?.text}</p>}
          </div>
          {r.correct?.acceptedAnswers?.length ? (
            <div className="rounded-md border border-success bg-success-soft p-3"><p className="mb-1 text-xs font-medium text-success">Accepted answers</p><p>{r.correct.acceptedAnswers.join(' · ')}</p></div>
          ) : null}
          {r.correct?.numericAnswer != null ? (
            <div className="rounded-md border border-success bg-success-soft p-3"><p className="mb-1 text-xs font-medium text-success">Correct answer</p><p className="num">{r.correct.numericAnswer}</p></div>
          ) : null}
        </div>
      )}

      {r.options.length > 0 && unanswered && <p className="mt-2 text-sm italic text-muted">You did not answer this question.</p>}
      {r.explanation && <p className="mt-3 rounded-md bg-surface-2 p-3 text-sm"><strong className="font-semibold">Explanation. </strong>{r.explanation}</p>}
      {r.feedback && <p className="mt-3 rounded-md border border-teal bg-teal-soft p-3 text-sm"><strong className="font-semibold">Organizer feedback. </strong>{r.feedback}</p>}
      <p className="num mt-3 inline-flex items-center gap-1.5 text-xs text-muted"><Clock className="size-3.5" aria-hidden="true" /> {r.timeSpentMs ? fmtDuration(Math.round(r.timeSpentMs / 1000)) : 'No time recorded'}</p>
    </Card>
  );
}
