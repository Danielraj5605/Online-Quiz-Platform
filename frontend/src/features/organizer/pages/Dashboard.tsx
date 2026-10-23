import { Link } from 'react-router-dom';
import { Activity, ArrowRight, ClipboardCheck, FilePlus2, Radio, Target, Users } from 'lucide-react';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, EmptyState, PageHeader, SkeletonGroup, Skeleton, StatCard, StatusBadge } from '@/components/ui';
import { useAuth } from '@/app/auth';
import { organizerApi } from '@/lib/api';
import { keys } from '@/lib/query/keys';
import { useApiQuery } from '@/lib/query/hooks';
import { useDocumentTitle } from '@/lib/hooks';
import { fmtDate } from '@/lib/utils';
import type { OrganizerDashboard } from '@/lib/api/types';

const verb: Record<string, string> = { IN_PROGRESS: 'started', SUBMITTED: 'submitted', GRADED: 'finished', EXPIRED: 'timed out on' };

export default function Dashboard() {
  useDocumentTitle('Studio');
  const { user } = useAuth();
  const { data, isPending, isError, refetch } = useApiQuery(keys.organizer.dashboard, () => organizerApi.dashboard(), { refetchInterval: 30_000 });

  return (
    <>
      <PageHeader
        eyebrow="Studio"
        title={`Welcome back${user?.name ? `, ${user.name.split(' ')[0]}` : ''}`}
        description="What's live, what needs your marking pen, and what happened recently."
        actions={<Button asChild><Link to="/studio/quizzes?new=1"><FilePlus2 aria-hidden="true" /> New quiz</Link></Button>}
      />
      {isPending ? <DashboardSkeleton /> : isError || !data ? (
        <EmptyState title="Couldn't load your dashboard" description="Check your connection and try again." action={<Button onClick={() => void refetch()}>Retry</Button>} />
      ) : <DashboardBody d={data} />}
    </>
  );
}

function DashboardBody({ d }: { d: OrganizerDashboard }) {
  const brandNew = d.kpis.liveQuizzes === 0 && d.recentActivity.length === 0 && d.needsGrading.length === 0;
  return (
    <div className="grid gap-6">
      <section aria-label="Key figures" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Live quizzes" value={d.kpis.liveQuizzes} icon={<Radio />} />
        <StatCard label="Participants" value={d.kpis.participants} icon={<Users />} hint="unique people who attempted" />
        <StatCard label="Average score" value={`${d.kpis.avgScorePct}%`} icon={<Target />} hint="final results only" />
        <StatCard label="Needs grading" value={d.kpis.needsGrading} icon={<ClipboardCheck />} hint={d.kpis.needsGrading ? 'answers waiting for you' : 'all caught up'} className={d.kpis.needsGrading ? 'border-accent' : undefined} />
      </section>

      {brandNew && (
        <EmptyState
          icon={<FilePlus2 />}
          title="Your studio is empty"
          description="Create a quiz, add a few questions and publish it — participants can join with a code or from the public catalog."
          action={<Button asChild><Link to="/studio/quizzes?new=1">Create your first quiz</Link></Button>}
        />
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between"><CardTitle>Needs grading</CardTitle></CardHeader>
          <CardContent>
            {d.needsGrading.length === 0 ? (
              <p className="text-sm text-muted">Nothing is waiting for manual grading.</p>
            ) : (
              <ul className="divide-y divide-border">
                {d.needsGrading.map((g) => (
                  <li key={g.quizId} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                    <span className="min-w-0 truncate font-medium">{g.title}</span>
                    <span className="flex shrink-0 items-center gap-3">
                      <Badge tone="warning"><span className="num">{g.count}</span> to grade</Badge>
                      <Button asChild size="sm" variant="outline"><Link to={`/studio/quizzes/${g.quizId}/grading`}>Open <ArrowRight aria-hidden="true" /></Link></Button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between"><CardTitle>Live now</CardTitle></CardHeader>
          <CardContent>
            {d.liveQuizzes.length === 0 ? (
              <p className="text-sm text-muted">No quizzes are live. <Link className="text-accent underline" to="/studio/quizzes">Publish one</Link> to open it to participants.</p>
            ) : (
              <ul className="divide-y divide-border">
                {d.liveQuizzes.map((q) => (
                  <li key={q.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{q.title}</p>
                      <p className="text-xs text-muted"><span className="num">{q.attempts}</span> attempts{q.closesAt ? ` · closes ${fmtDate(q.closesAt)}` : ''}</p>
                    </div>
                    <span className="flex shrink-0 items-center gap-2">
                      <StatusBadge status="LIVE" />
                      <Button asChild size="sm" variant="outline"><Link to={`/studio/quizzes/${q.id}/monitor`}>Monitor</Link></Button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Activity className="size-4 text-muted" aria-hidden="true" /> Recent activity</CardTitle></CardHeader>
        <CardContent>
          {d.recentActivity.length === 0 ? (
            <p className="text-sm text-muted">Activity appears here as participants start and submit attempts.</p>
          ) : (
            <ul className="divide-y divide-border">
              {d.recentActivity.map((a) => (
                <li key={a.attemptId} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm first:pt-0 last:pb-0">
                  <span>
                    <strong className="font-medium">{a.name ?? a.username}</strong> {verb[a.status] ?? 'updated'}{' '}
                    <Link className="text-accent underline-offset-2 hover:underline" to={`/studio/quizzes/${a.quizId}/reports`}>{a.quizTitle}</Link>
                  </span>
                  <time className="text-xs text-muted" dateTime={a.at}>{fmtDate(a.at)}</time>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <SkeletonGroup label="Loading dashboard">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-28" />)}</div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2"><Skeleton className="h-52" /><Skeleton className="h-52" /></div>
      <Skeleton className="mt-6 h-64" />
    </SkeletonGroup>
  );
}
