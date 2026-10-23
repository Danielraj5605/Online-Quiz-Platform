import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Clock, EyeOff, Hourglass, RotateCcw, Users } from 'lucide-react';
import { attemptsApi } from '@/lib/api/attempts';
import { reviewsApi } from '@/lib/api/reviews';
import { ApiError } from '@/lib/api/client';
import { useApiMutation, useApiQuery } from '@/lib/query/hooks';
import { keys } from '@/lib/query/keys';
import { useDocumentTitle } from '@/lib/hooks';
import { fmtDate, fmtDuration, fmtPct } from '@/lib/utils';
import { Badge, Button, Card, CardContent, EmptyState, PageHeader, ScoreRing, Skeleton, SkeletonGroup, StatCard, Textarea } from '@/components/ui';
import { QuestionReviewCard } from '../components/QuestionReviewCard';
import { RatingInput } from '../components/Rating';

function ReviewForm({ quizId }: { quizId: string }) {
  const mine = useApiQuery(keys.reviews.list(quizId), () => reviewsApi.list(quizId, { pageSize: 1 }));
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const existing = mine.data?.mine;
  const save = useApiMutation(() => reviewsApi.save(quizId, { rating: rating || existing?.rating || 5, comment }), {
    invalidate: [keys.reviews.list(quizId), keys.catalog.all], success: 'Thanks for the review',
  });
  const r = rating || existing?.rating || 0;
  return (
    <Card>
      <CardContent className="grid gap-4">
        <h2 className="text-xl font-semibold">{existing ? 'Update your review' : 'How was this quiz?'}</h2>
        <RatingInput value={r} onChange={setRating} />
        <div className="grid gap-1.5">
          <label htmlFor="rv-comment" className="text-sm font-medium">Comment <span className="font-normal text-muted">(optional)</span></label>
          <Textarea id="rv-comment" rows={3} maxLength={1000} value={comment || (rating === 0 ? existing?.comment ?? '' : '')} onChange={(e) => setComment(e.target.value)} />
        </div>
        <div><Button disabled={!r} loading={save.isPending} onClick={() => save.mutate()}>{existing ? 'Update review' : 'Post review'}</Button></div>
      </CardContent>
    </Card>
  );
}

function TimeAnalysis({ rows }: { rows: { text: string; ms: number }[] }) {
  const total = rows.reduce((s, r) => s + r.ms, 0);
  const max = Math.max(1, ...rows.map((r) => r.ms));
  if (total === 0) return null;
  const slow = rows.reduce((a, b) => (b.ms > a.ms ? b : a));
  return (
    <section aria-labelledby="time-h">
      <h2 id="time-h" className="mb-1 text-xl font-semibold">Time per question</h2>
      <p className="mb-3 text-sm text-muted">Slowest: Q{rows.indexOf(slow) + 1} at <span className="num">{fmtDuration(Math.round(slow.ms / 1000))}</span>. Average <span className="num">{fmtDuration(Math.round(total / rows.length / 1000))}</span>.</p>
      <Card className="p-4">
        <ol className="grid gap-2">
          {rows.map((r, i) => (
            <li key={i} className="grid grid-cols-[2.5rem_1fr_4rem] items-center gap-3 text-sm">
              <span className="num text-muted">Q{i + 1}</span>
              <span className="h-2.5 overflow-hidden rounded-sm bg-surface-2" aria-hidden="true"><span className="block h-full rounded-sm bg-teal" style={{ width: `${(r.ms / max) * 100}%` }} /></span>
              <span className="num text-right">{fmtDuration(Math.round(r.ms / 1000))}<span className="sr-only"> on question {i + 1}</span></span>
            </li>
          ))}
        </ol>
      </Card>
    </section>
  );
}

export default function Results() {
  const { attemptId = '' } = useParams();
  const res = useApiQuery(keys.attempts.result(attemptId), () => attemptsApi.result(attemptId), { retry: false });
  useDocumentTitle(res.data ? `Results · ${res.data.quizTitle}` : 'Results');

  if (res.isPending) return <SkeletonGroup label="Loading results"><Skeleton className="mb-4 h-10 w-1/2" /><Skeleton className="h-56 w-full" /></SkeletonGroup>;
  if (res.isError) {
    const e = res.error;
    const running = e instanceof ApiError && e.code === 'NOT_SUBMITTED';
    return (
      <EmptyState
        title={running ? 'This attempt is still in progress' : e instanceof ApiError && e.status === 404 ? 'Result not found' : 'Could not load results'}
        description={running ? 'Finish and submit the quiz to see your results.' : e.message}
        action={running ? <Button asChild><Link to={`/attempt/${attemptId}`}>Continue quiz</Link></Button> : <Button asChild><Link to="/">Back to home</Link></Button>}
      />
    );
  }
  const r = res.data;
  const pending = !r.isFinal;
  const timeRows = r.review.map((q) => ({ text: q.text, ms: q.timeSpentMs }));

  return (
    <>
      <PageHeader
        eyebrow="Results"
        title={r.quizTitle}
        description={r.submittedAt ? `Submitted ${fmtDate(r.submittedAt)}` : undefined}
        actions={<Button variant="outline" asChild><Link to={`/quizzes/${r.quizId}`}><RotateCcw aria-hidden="true" /> Quiz page</Link></Button>}
      />

      {pending && (
        <div role="status" className="mb-6 flex items-start gap-3 rounded-lg border border-warning bg-warning-soft p-4 text-sm text-warning">
          <Hourglass className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
          <p><strong className="font-semibold">Some answers are waiting for manual grading.</strong> The score below only counts questions that are already graded and may change.</p>
        </div>
      )}

      <Card className="mb-6">
        <CardContent className="flex flex-col items-center gap-6 sm:flex-row">
          <ScoreRing value={r.percentage} size={150} stroke={12} passed={pending ? undefined : r.passed} label="Score" />
          <div className="grid flex-1 gap-3 text-center sm:text-left">
            <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              {pending ? <Badge tone="warning">Provisional</Badge> : r.passed ? <Badge tone="success">Passed</Badge> : <Badge tone="danger">Not passed</Badge>}
              {r.band && !pending && <Badge tone="teal">Grade {r.band}</Badge>}
            </div>
            <p className="font-display text-4xl font-semibold"><span className="num">{Number.isInteger(r.score) ? r.score : r.score.toFixed(1)}</span><span className="text-muted"> / <span className="num">{r.maxScore}</span> points</span></p>
            <p className="inline-flex items-center justify-center gap-1.5 text-sm text-muted sm:justify-start"><Clock className="size-4" aria-hidden="true" /> Finished in <span className="num">{fmtDuration(r.durationSec)}</span></p>
          </div>
        </CardContent>
      </Card>

      {(r.cohortAvgPct != null || r.percentile != null) && (
        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <StatCard label="Your score" value={fmtPct(r.percentage, 1)} icon={<Users />} />
          <StatCard label="Average of everyone" value={fmtPct(r.cohortAvgPct, 1)} hint={r.cohortAvgPct != null ? `${r.percentage >= r.cohortAvgPct ? 'You’re above' : 'You’re below'} the average` : undefined} />
          <StatCard label="Percentile" value={r.percentile != null ? `${r.percentile}th` : '—'} hint="Share of results you beat" />
        </div>
      )}

      <div className="grid gap-8">
        <TimeAnalysis rows={timeRows} />

        <section aria-labelledby="review-h">
          <h2 id="review-h" className="mb-3 text-xl font-semibold">Question review</h2>
          {!r.answersRevealed && (
            <div className="mb-4 flex items-start gap-3 rounded-lg border border-border-strong bg-surface-2 p-4 text-sm">
              <EyeOff className="mt-0.5 size-5 shrink-0 text-muted" aria-hidden="true" />
              <p>The organizer hasn’t released correct answers for this quiz yet, so right and wrong marks are hidden. Check back later — it may open once the quiz closes.</p>
            </div>
          )}
          <ol className="grid gap-3">
            {r.review.map((q, i) => <li key={q.questionId}><QuestionReviewCard r={q} index={i} /></li>)}
          </ol>
        </section>

        {!pending && <ReviewForm quizId={r.quizId} />}
      </div>
    </>
  );
}
