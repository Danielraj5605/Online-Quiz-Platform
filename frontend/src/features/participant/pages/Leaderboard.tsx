import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Medal, Trophy } from 'lucide-react';
import { useAuth } from '@/app/auth';
import { attemptsApi } from '@/lib/api/attempts';
import { useApiQuery } from '@/lib/query/hooks';
import { keys } from '@/lib/query/keys';
import { useDocumentTitle } from '@/lib/hooks';
import { cn, fmtDuration } from '@/lib/utils';
import {
  Avatar, Badge, Button, Card, EmptyState, Label, PageHeader, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Skeleton, SkeletonGroup, Tabs, TabsContent, TabsList, TabsTrigger,
} from '@/components/ui';

const Rank = ({ n }: { n: number }) => (
  <span className="num grid w-8 place-items-center font-semibold">
    {n <= 3 ? <Medal className={cn('size-5', n === 1 ? 'text-warning' : n === 2 ? 'text-muted' : 'text-accent')} aria-label={`Rank ${n}`} /> : n}
  </span>
);

interface Row { id: string; rank: number; name: string; username: string; avatarUrl: string | null; main: string; sub: string }

function Board({ rows, loading, label, mainHeader, subHeader }: { rows: Row[] | undefined; loading: boolean; label: string; mainHeader: string; subHeader: string }) {
  const { user } = useAuth();
  if (loading) return <SkeletonGroup label="Loading leaderboard"><Skeleton className="h-72 w-full" /></SkeletonGroup>;
  if (!rows?.length) return <EmptyState icon={<Trophy />} title="No one on the board yet" description="Finish a quiz to claim the first spot." action={<Button asChild><Link to="/discover">Find a quiz</Link></Button>} />;
  return (
    <Card className="overflow-hidden">
      <table className="w-full text-sm">
        <caption className="sr-only">{label}</caption>
        <thead className="bg-surface-2 text-left text-xs uppercase tracking-wide text-muted">
          <tr><th scope="col" className="w-14 px-3 py-3 font-medium">Rank</th><th scope="col" className="py-3 font-medium">Player</th><th scope="col" className="px-3 py-3 text-right font-medium">{mainHeader}</th><th scope="col" className="hidden px-3 py-3 text-right font-medium sm:table-cell">{subHeader}</th></tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const me = r.id === user?.id;
            return (
              <tr key={r.id} className={cn('border-t border-border', me && 'bg-accent-soft')} aria-current={me ? 'true' : undefined}>
                <td className="px-3 py-2.5"><Rank n={r.rank} /></td>
                <td className="py-2.5">
                  <span className="flex items-center gap-3"><Avatar name={r.name} src={r.avatarUrl} size={32} /><span className="min-w-0"><span className="block truncate font-medium">{r.name}{me && <span className="ml-2 text-xs font-semibold text-accent">You</span>}</span><span className="block truncate text-xs text-muted">@{r.username}</span></span></span>
                </td>
                <td className="num px-3 py-2.5 text-right font-semibold">{r.main}</td>
                <td className="hidden px-3 py-2.5 text-right text-muted sm:table-cell">{r.sub}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}

export default function Leaderboard() {
  useDocumentTitle('Leaderboard');
  const [params, setParams] = useSearchParams();
  const quizId = params.get('quiz') ?? '';
  const tab = quizId ? 'quiz' : params.get('tab') === 'quiz' ? 'quiz' : 'xp';

  const xp = useApiQuery(keys.attempts.globalLeaderboard, () => attemptsApi.globalLeaderboard());
  const history = useApiQuery(keys.attempts.history({ all: true }), async () => (await attemptsApi.history({ pageSize: 100 })).data);
  const quizzes = useMemo(() => {
    const m = new Map<string, string>();
    history.data?.forEach((a) => m.set(a.quizId, a.quizTitle));
    return [...m.entries()].map(([id, title]) => ({ id, title }));
  }, [history.data]);
  const board = useApiQuery(keys.attempts.leaderboard(quizId), () => attemptsApi.quizLeaderboard(quizId), { enabled: !!quizId });

  const xpRows: Row[] | undefined = xp.data?.map((r) => ({ id: r.userId, rank: r.rank, name: r.name ?? r.username, username: r.username, avatarUrl: r.avatarUrl, main: `${r.xp.toLocaleString()} XP`, sub: r.tier }));
  const quizRows: Row[] | undefined = board.data?.map((r) => ({ id: r.userId, rank: r.rank, name: r.name ?? r.username, username: r.username, avatarUrl: r.avatarUrl, main: `${r.percentage.toFixed(1)}%`, sub: r.durationSec != null ? fmtDuration(r.durationSec) : '—' }));

  return (
    <>
      <PageHeader eyebrow="Leaderboard" title="Top performers" description="Climb the XP table, or see who leads a specific quiz." />
      <Tabs value={tab} onValueChange={(v) => setParams(v === 'quiz' ? { tab: 'quiz', ...(quizId ? { quiz: quizId } : {}) } : {}, { replace: true })}>
        <TabsList aria-label="Leaderboard type">
          <TabsTrigger value="xp">Global XP</TabsTrigger>
          <TabsTrigger value="quiz">By quiz</TabsTrigger>
        </TabsList>
        <TabsContent value="xp" className="pt-5">
          <Board rows={xpRows} loading={xp.isPending} label="Global XP leaderboard" mainHeader="XP" subHeader="Tier" />
        </TabsContent>
        <TabsContent value="quiz" className="pt-5">
          <div className="mb-4 grid max-w-sm gap-1.5">
            <Label htmlFor="lb-quiz">Quiz</Label>
            <Select value={quizId || undefined} onValueChange={(v) => setParams({ tab: 'quiz', quiz: v }, { replace: true })}>
              <SelectTrigger id="lb-quiz"><SelectValue placeholder={quizzes.length ? 'Choose a quiz you’ve taken' : 'No quizzes taken yet'} /></SelectTrigger>
              <SelectContent>
                {quizzes.map((q) => <SelectItem key={q.id} value={q.id}>{q.title}</SelectItem>)}
                {quizId && !quizzes.some((q) => q.id === quizId) && <SelectItem value={quizId}>This quiz</SelectItem>}
              </SelectContent>
            </Select>
          </div>
          {quizId ? (
            <>
              <p className="mb-3 text-sm text-muted">Best result per person, ties broken by speed. <Badge tone="teal">Top 20</Badge></p>
              <Board rows={quizRows} loading={board.isPending} label="Quiz leaderboard" mainHeader="Score" subHeader="Time" />
            </>
          ) : <EmptyState icon={<Trophy />} title="Pick a quiz" description="Choose one of the quizzes you’ve attempted to see its board." />}
        </TabsContent>
      </Tabs>
    </>
  );
}
