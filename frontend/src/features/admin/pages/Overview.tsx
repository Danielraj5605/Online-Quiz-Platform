import { Link } from 'react-router-dom';
import { Activity, FileQuestion, Flag, GraduationCap, Percent, Users } from 'lucide-react';
import { adminApi } from '@/lib/api';
import { keys } from '@/lib/query/keys';
import { useApiQuery } from '@/lib/query/hooks';
import { useDocumentTitle } from '@/lib/hooks';
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle, EmptyState, PageHeader, Skeleton, SkeletonGroup, StatCard, StatusBadge } from '@/components/ui';
import { DailyChart } from '../components/DailyChart';

const ROLE_LABEL = { ADMIN: 'Admins', ORGANIZER: 'Organizers', PARTICIPANT: 'Participants' } as const;

export default function Overview() {
  useDocumentTitle('Platform overview');
  const { data, isPending, isError, refetch } = useApiQuery(keys.admin.analytics, () => adminApi.analytics(), { staleTime: 60_000 });

  return (
    <>
      <PageHeader eyebrow="Admin" title="Platform overview" description="Activity across every organizer and participant." />
      {isError ? (
        <EmptyState title="Couldn’t load analytics" description="Check your connection and try again." action={<button className="text-accent underline" onClick={() => void refetch()}>Retry</button>} />
      ) : isPending || !data ? (
        <SkeletonGroup label="Loading analytics">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-28" />)}</div>
          <div className="mt-6 grid gap-4 lg:grid-cols-2"><Skeleton className="h-72" /><Skeleton className="h-72" /></div>
        </SkeletonGroup>
      ) : (
        <div className="grid gap-6">
          <section aria-label="Key figures" className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-6">
            <StatCard label="Users" value={data.totals.users.toLocaleString()} hint={`+${data.totals.newUsers7d} this week`} icon={<Users />} />
            <StatCard label="Quizzes" value={data.totals.quizzes.toLocaleString()} icon={<FileQuestion />} />
            <StatCard label="Attempts" value={data.totals.attempts.toLocaleString()} icon={<Activity />} />
            <StatCard label="Graded results" value={data.totals.finalResults.toLocaleString()} icon={<GraduationCap />} />
            <StatCard label="Average score" value={`${data.totals.avgScorePct}%`} icon={<Percent />} />
            <Link to="/admin/moderation" className="rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2" aria-label={`${data.totals.openFlags} open reports, go to moderation`}>
              <StatCard label="Open reports" value={data.totals.openFlags} hint="Review queue →" icon={<Flag />} className={data.totals.openFlags ? 'border-warning' : undefined} />
            </Link>
          </section>

          <section aria-label="Daily activity" className="grid gap-4 lg:grid-cols-2">
            <DailyChart title="Attempts per day" data={data.attemptsPerDay} unit="attempts" tone="accent" />
            <DailyChart title="Sign-ups per day" data={data.signupsPerDay} unit="sign-ups" tone="teal" />
          </section>

          <section className="grid gap-4 lg:grid-cols-3">
            <Card>
              <CardHeader><CardTitle>Users by role</CardTitle></CardHeader>
              <CardContent>
                <ul className="grid gap-3">
                  {data.usersByRole.map((r) => (
                    <li key={r.role} className="flex items-center justify-between text-sm">
                      <span>{ROLE_LABEL[r.role]}</span>
                      <span className="num font-medium">{r.count}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Quizzes by status</CardTitle></CardHeader>
              <CardContent>
                <ul className="grid gap-3">
                  {data.quizzesByStatus.map((r) => (
                    <li key={r.status} className="flex items-center justify-between text-sm">
                      <StatusBadge status={r.status} />
                      <span className="num font-medium">{r.count}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Most attempted</CardTitle>
                <CardDescription>Top quizzes by attempts</CardDescription>
              </CardHeader>
              <CardContent>
                {data.topQuizzes.length === 0 ? (
                  <p className="text-sm text-muted">No attempts yet.</p>
                ) : (
                  <ol className="grid gap-3">
                    {data.topQuizzes.map((q, i) => (
                      <li key={q.id} className="flex items-start gap-3 text-sm">
                        <Badge tone="neutral" className="num mt-0.5 w-6 justify-center">{i + 1}</Badge>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">{q.title}</p>
                          <p className="truncate text-xs text-muted">by {q.owner}</p>
                        </div>
                        <span className="num shrink-0 font-medium">{q.attempts}</span>
                      </li>
                    ))}
                  </ol>
                )}
              </CardContent>
            </Card>
          </section>
        </div>
      )}
    </>
  );
}
