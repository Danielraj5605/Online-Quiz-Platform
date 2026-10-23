import { Link } from 'react-router-dom';
import { Award, CalendarClock, Compass, Flame, KeyRound, Sparkles, Zap } from 'lucide-react';
import { TIERS, type QuizOverviewDto } from '@quiz/shared';
import { useAuth } from '@/app/auth';
import { catalogApi } from '@/lib/api/catalog';
import { gamificationApi } from '@/lib/api/gamification';
import { useApiQuery } from '@/lib/query/hooks';
import { keys } from '@/lib/query/keys';
import { useDocumentTitle } from '@/lib/hooks';
import { fmtDate, fmtDuration } from '@/lib/utils';
import { Badge, Button, Card, CardContent, EmptyState, PageHeader, Progress, Skeleton, SkeletonGroup } from '@/components/ui';
import { QuizCard, StartButton } from '../components/QuizCard';
import { BadgeIcon } from '../components/BadgeIcon';

function Section({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="mt-10" aria-label={title}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-2xl font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function ContinueCard({ quiz }: { quiz: QuizOverviewDto }) {
  return (
    <Card className="flex flex-col gap-3 border-accent bg-accent-soft p-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-accent">Pick up where you left off</p>
        <h3 className="mt-1 truncate font-display text-xl font-semibold">{quiz.title}</h3>
        <p className="text-sm text-muted">{quiz.questionCount} questions{quiz.timeLimitSec ? ` · ${fmtDuration(quiz.timeLimitSec)} limit` : ''}</p>
      </div>
      <StartButton quiz={quiz} size="lg" />
    </Card>
  );
}

function ProgressCard() {
  const { data, isPending } = useApiQuery(keys.gamification.me, () => gamificationApi.me());
  if (isPending || !data) return <Card className="p-5"><SkeletonGroup label="Loading progress"><Skeleton className="h-6 w-1/2" /><Skeleton className="mt-4 h-2 w-full" /><Skeleton className="mt-4 h-10 w-full" /></SkeletonGroup></Card>;
  const cur = TIERS.find((t) => t.name === data.tier) ?? TIERS[0];
  const next = data.nextTier;
  const pct = next ? ((data.xp - cur.minXp) / (next.minXp - cur.minXp)) * 100 : 100;
  const earned = data.badges.filter((b) => b.earned);
  return (
    <Card>
      <CardContent className="grid gap-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm text-muted">Your tier</p>
            <p className="font-display text-2xl font-semibold">{data.tier}</p>
          </div>
          <div className="flex items-center gap-1.5 rounded-md bg-surface-2 px-2.5 py-1.5 text-sm font-medium" title="Consecutive days with a finished quiz">
            <Flame className="size-4 text-accent" aria-hidden="true" />
            <span className="num">{data.streakDays}</span> day streak
          </div>
        </div>
        <div>
          <div className="mb-1.5 flex items-center justify-between text-sm">
            <span className="inline-flex items-center gap-1.5"><Zap className="size-4 text-teal" aria-hidden="true" /><span className="num font-semibold">{data.xp.toLocaleString()}</span> XP</span>
            <span className="text-muted">{next ? <><span className="num">{(next.minXp - data.xp).toLocaleString()}</span> XP to {next.name}</> : 'Top tier reached'}</span>
          </div>
          <Progress value={pct} label={next ? `Progress to ${next.name}` : 'Top tier'} tone="teal" className="h-2" />
        </div>
        <div>
          <p className="mb-2 text-sm font-medium">Badges <span className="num font-normal text-muted">({earned.length}/{data.badges.length})</span></p>
          {earned.length ? (
            <ul className="flex flex-wrap gap-2">
              {earned.map((b) => (
                <li key={b.key} title={`${b.name} — ${b.description}`} className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface-2 px-2 py-1 text-xs font-medium">
                  <BadgeIcon name={b.icon} className="size-3.5 text-accent" /> {b.name}
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-muted">Finish a quiz to earn your first badge.</p>}
        </div>
      </CardContent>
    </Card>
  );
}

function DailyChallengeCard() {
  const { data, isPending } = useApiQuery(keys.catalog.daily, () => catalogApi.dailyChallenge());
  if (isPending) return <Card className="p-5"><Skeleton className="h-24 w-full" /></Card>;
  if (!data) return (
    <Card className="grid place-items-center p-5 text-center"><Sparkles className="mb-2 size-6 text-muted" aria-hidden="true" /><p className="text-sm text-muted">No daily challenge today — check back tomorrow.</p></Card>
  );
  return (
    <Card className="flex flex-col p-5">
      <p className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-[0.14em] text-teal"><Sparkles className="size-3.5" aria-hidden="true" /> Daily challenge</p>
      <h3 className="mt-1 font-display text-xl font-semibold"><Link to={`/quizzes/${data.id}`} className="hover:text-accent">{data.title}</Link></h3>
      <p className="mt-1 line-clamp-2 text-sm text-muted">{data.description}</p>
      <p className="mt-2 text-sm"><Badge tone="teal">+{data.xpBonus} bonus XP</Badge></p>
      <div className="mt-auto pt-4">
        {data.completedToday ? <Badge tone="success">Completed today</Badge> : <StartButton quiz={data} />}
      </div>
    </Card>
  );
}

export default function Home() {
  useDocumentTitle('Home');
  const { user } = useAuth();
  const { data, isPending } = useApiQuery(keys.catalog.assignments, () => catalogApi.assignments());
  const first = (user?.name ?? user?.username ?? '').split(' ')[0];
  const nothing = data && !data.inProgress.length && !data.assigned.length && !data.upcoming.length;

  return (
    <>
      <PageHeader
        eyebrow="Home"
        title={<>Welcome back, <span className="text-accent">{first}</span></>}
        description="Pick up a quiz, check your streak, or find something new to practise."
        actions={<>
          <Button variant="outline" asChild><Link to="/join"><KeyRound aria-hidden="true" /> Enter code</Link></Button>
          <Button asChild><Link to="/discover"><Compass aria-hidden="true" /> Discover</Link></Button>
        </>}
      />

      {data?.inProgress.length ? <div className="grid gap-3">{data.inProgress.map((q) => <ContinueCard key={q.id} quiz={q} />)}</div> : null}

      <div className="mt-6 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <ProgressCard />
        <DailyChallengeCard />
      </div>

      <Section title="Assigned to you">
        {isPending ? (
          <SkeletonGroup label="Loading assigned quizzes"><div className="grid gap-4 sm:grid-cols-2"><Skeleton className="h-44" /><Skeleton className="h-44" /></div></SkeletonGroup>
        ) : data?.assigned.length ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{data.assigned.map((q) => <QuizCard key={q.id} quiz={q} />)}</div>
        ) : nothing ? (
          <EmptyState
            icon={<Award />}
            title="Nothing assigned yet"
            description="When an organizer invites you or you join with a code, quizzes show up here."
            action={<div className="flex flex-wrap justify-center gap-2"><Button asChild><Link to="/discover">Browse public quizzes</Link></Button><Button variant="outline" asChild><Link to="/join">Enter an access code</Link></Button></div>}
          />
        ) : <p className="text-sm text-muted">No new assignments.</p>}
      </Section>

      {data?.upcoming.length ? (
        <Section title="Coming up">
          <ul className="grid gap-3 sm:grid-cols-2">
            {data.upcoming.map((q) => (
              <li key={q.id}>
                <Card className="flex items-center gap-3 p-4">
                  <span className="grid size-10 shrink-0 place-items-center rounded-md bg-surface-2 text-muted"><CalendarClock className="size-5" aria-hidden="true" /></span>
                  <div className="min-w-0">
                    <Link to={`/quizzes/${q.id}`} className="block truncate font-medium hover:text-accent">{q.title}</Link>
                    <p className="text-sm text-muted">Opens {fmtDate(q.opensAt)}</p>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
    </>
  );
}
