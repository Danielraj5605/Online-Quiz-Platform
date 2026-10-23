import { Link, useParams } from 'react-router-dom';
import { CalendarClock, CheckCircle2, Clock, HelpCircle, Info, ListChecks, Target, Trophy } from 'lucide-react';
import { attemptsApi } from '@/lib/api/attempts';
import { catalogApi } from '@/lib/api/catalog';
import { reviewsApi } from '@/lib/api/reviews';
import { ApiError } from '@/lib/api/client';
import { useApiQuery } from '@/lib/query/hooks';
import { keys } from '@/lib/query/keys';
import { useDocumentTitle } from '@/lib/hooks';
import { fmtDate, fmtDuration, fmtPct } from '@/lib/utils';
import { Avatar, Badge, Button, Card, CardContent, EmptyState, PageHeader, Skeleton, SkeletonGroup, StatusBadge } from '@/components/ui';
import { DifficultyBadge, StartButton } from '../components/QuizCard';
import { Rating } from '../components/Rating';

function Fact({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 text-muted [&_svg]:size-5" aria-hidden="true">{icon}</span>
      <div><dt className="text-xs text-muted">{label}</dt><dd className="num font-semibold">{value}</dd></div>
    </div>
  );
}

export default function QuizOverview() {
  const { id = '' } = useParams();
  const quiz = useApiQuery(keys.catalog.detail(id), () => catalogApi.get(id), { retry: false });
  useDocumentTitle(quiz.data?.title ?? 'Quiz');
  const reviews = useApiQuery(keys.reviews.list(id), () => reviewsApi.list(id, { pageSize: 5 }), { enabled: !!quiz.data });
  const history = useApiQuery(keys.attempts.history({ quizId: id }), async () => (await attemptsApi.history({ pageSize: 100 })).data.filter((a) => a.quizId === id), { enabled: !!quiz.data });

  if (quiz.isPending) {
    return <SkeletonGroup label="Loading quiz"><Skeleton className="mb-4 h-10 w-2/3" /><Skeleton className="h-48 w-full" /></SkeletonGroup>;
  }
  if (quiz.isError) {
    const gone = quiz.error instanceof ApiError && quiz.error.status === 404;
    return (
      <EmptyState
        title={gone ? 'Quiz not found' : 'Could not load this quiz'}
        description={gone ? 'It may be private, closed, or removed. If you have an access code, enter it instead.' : quiz.error.message}
        action={<Button asChild><Link to={gone ? '/join' : '/discover'}>{gone ? 'Enter a code' : 'Back to discover'}</Link></Button>}
      />
    );
  }
  const q = quiz.data;
  const left = Math.max(0, q.maxAttempts - q.attemptsUsed);

  return (
    <>
      <PageHeader
        eyebrow={q.category ?? 'Quiz'}
        title={q.title}
        description={q.description || undefined}
        actions={<StartButton quiz={q} size="lg" />}
      />
      <div className="-mt-3 mb-6 flex flex-wrap items-center gap-2 text-sm text-muted">
        <DifficultyBadge d={q.difficulty} />
        {q.tags.map((t) => <Badge key={t}>#{t}</Badge>)}
        <span>by {q.owner.name ?? q.owner.username}</span>
        <Rating value={q.avgRating} count={q.ratingCount} />
      </div>

      {!q.canStart && q.reason && (
        <div role="status" className="mb-6 flex items-start gap-3 rounded-lg border border-warning bg-warning-soft p-4 text-sm text-warning">
          <Info className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
          <p><strong className="font-semibold">You can’t start this quiz right now.</strong> {q.reason}.</p>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="grid gap-6">
          <Card>
            <CardContent>
              <h2 className="mb-4 text-xl font-semibold">Before you begin</h2>
              <dl className="grid gap-4 sm:grid-cols-2">
                <Fact icon={<HelpCircle />} label="Questions" value={q.questionCount} />
                <Fact icon={<Target />} label="Total points" value={q.totalPoints} />
                <Fact icon={<Clock />} label="Time limit" value={q.timeLimitSec ? fmtDuration(q.timeLimitSec) : 'Untimed'} />
                <Fact icon={<CheckCircle2 />} label="Pass mark" value={`${q.passMarkPct}%`} />
                <Fact icon={<ListChecks />} label="Attempts left" value={`${left} of ${q.maxAttempts}`} />
                {q.closesAt && <Fact icon={<CalendarClock />} label="Closes" value={fmtDate(q.closesAt)} />}
              </dl>
              <ul className="mt-5 grid gap-1.5 border-t border-border pt-4 text-sm text-muted">
                {q.timeLimitSec && <li>The timer is controlled by the server and keeps running if you leave.</li>}
                <li>Your answers autosave as you go, and you can resume if your connection drops.</li>
                <li>Switching tabs is recorded and shown to the organizer.</li>
                <li>You can flag questions and review everything before submitting.</li>
              </ul>
            </CardContent>
          </Card>

          <section aria-labelledby="reviews-h">
            <h2 id="reviews-h" className="mb-3 text-xl font-semibold">Reviews</h2>
            {reviews.isPending ? <Skeleton className="h-24 w-full" /> : reviews.data?.items.length ? (
              <ul className="grid gap-3">
                {reviews.data.items.map((r) => (
                  <li key={r.id}>
                    <Card className="flex gap-3 p-4">
                      <Avatar name={r.user.name ?? r.user.username} src={r.user.avatarUrl} />
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{r.user.name ?? r.user.username} <span className="ml-1 font-normal text-muted">{fmtDate(r.createdAt, { dateStyle: 'medium' })}</span></p>
                        <Rating value={r.rating} count={1} />
                        {r.comment && <p className="mt-1 whitespace-pre-wrap text-sm">{r.comment}</p>}
                      </div>
                    </Card>
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-muted">No reviews yet. Finish the quiz to leave the first one.</p>}
          </section>
        </div>

        <aside className="grid content-start gap-6">
          <Card>
            <CardContent>
              <h2 className="mb-3 flex items-center gap-2 text-xl font-semibold"><Trophy className="size-5 text-warning" aria-hidden="true" /> Your attempts</h2>
              {history.isPending ? <Skeleton className="h-16 w-full" /> : history.data?.length ? (
                <ul className="grid gap-2">
                  {history.data.map((a) => (
                    <li key={a.attemptId} className="flex items-center justify-between gap-3 rounded-md bg-surface-2 px-3 py-2 text-sm">
                      <span><span className="num font-semibold">#{a.number}</span> <span className="text-muted">{fmtDate(a.startedAt, { dateStyle: 'medium' })}</span></span>
                      <span className="flex items-center gap-2">
                        {a.status === 'IN_PROGRESS' ? <StatusBadge kind="attempt" status={a.status} /> : <span className="num font-semibold">{a.isFinal ? fmtPct(a.percentage) : '…'}</span>}
                        {a.status !== 'IN_PROGRESS' && <Link to={`/results/${a.attemptId}`} className="font-medium text-accent underline-offset-2 hover:underline">View</Link>}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : <p className="text-sm text-muted">You haven’t attempted this quiz yet.</p>}
              <Button variant="outline" className="mt-4 w-full" asChild><Link to={`/leaderboard?quiz=${q.id}`}>View leaderboard</Link></Button>
            </CardContent>
          </Card>
        </aside>
      </div>
    </>
  );
}
