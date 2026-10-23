import { Dialog, DialogContent, DialogDescription, DialogTitle, Badge, ScoreRing, Skeleton } from '@/components/ui';
import { attemptsApi } from '@/lib/api';
import { keys } from '@/lib/query/keys';
import { useApiQuery } from '@/lib/query/hooks';
import { fmtDate, fmtDuration } from '@/lib/utils';

/** Organizer's read-only view of one attempt's result (GET /attempts/:id/result). */
export function ResultDialog({ attemptId, who, onClose }: { attemptId: string | null; who: string; onClose: () => void }) {
  const { data, isPending } = useApiQuery(keys.attempts.result(attemptId ?? ''), () => attemptsApi.result(attemptId!), { enabled: !!attemptId });
  return (
    <Dialog open={!!attemptId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogTitle>{who}</DialogTitle>
        <DialogDescription>{data ? `${data.quizTitle} · submitted ${fmtDate(data.submittedAt)}` : 'Loading result…'}</DialogDescription>
        {isPending || !data ? (
          <div className="grid gap-3" aria-busy="true"><Skeleton className="h-28" /><Skeleton className="h-40" /></div>
        ) : (
          <div className="grid gap-5">
            <div className="flex flex-wrap items-center gap-5">
              <ScoreRing value={data.percentage} passed={data.passed} size={96} stroke={9} />
              <dl className="grid gap-1 text-sm">
                <div className="flex gap-2"><dt className="text-muted">Score</dt><dd className="num font-medium">{data.score} / {data.maxScore}</dd></div>
                <div className="flex gap-2"><dt className="text-muted">Time</dt><dd className="num">{fmtDuration(data.durationSec)}</dd></div>
                <div className="flex flex-wrap gap-2">
                  <dt className="sr-only">Outcome</dt>
                  <dd className="flex gap-2">
                    <Badge tone={data.passed ? 'success' : 'danger'}>{data.passed ? 'Passed' : 'Not passed'}</Badge>
                    {data.band && <Badge>Grade {data.band}</Badge>}
                    {!data.isFinal && <Badge tone="warning">Awaiting grading</Badge>}
                  </dd>
                </div>
              </dl>
            </div>
            <ol className="grid gap-2">
              {data.review.map((q, i) => (
                <li key={q.questionId} className="rounded-md border border-border p-3 text-sm">
                  <div className="flex items-start gap-2">
                    <span className="num mt-0.5 text-muted">{i + 1}.</span>
                    <p className="min-w-0 flex-1 break-words">{q.text}</p>
                    <span className="num shrink-0 font-medium">
                      {q.needsManual && q.score == null ? 'Pending' : `${q.score ?? 0} / ${q.points}`}
                    </span>
                  </div>
                  {q.feedback && <p className="mt-2 rounded-sm bg-surface-2 p-2 text-muted">{q.feedback}</p>}
                </li>
              ))}
            </ol>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
