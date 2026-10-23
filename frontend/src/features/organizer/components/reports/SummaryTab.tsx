import { Link } from 'react-router-dom';
import { BarChart3, Clock, Percent, Trophy, Users } from 'lucide-react';
import { Button, EmptyState, Skeleton, StatCard } from '@/components/ui';
import { reportsApi } from '@/lib/api';
import { keys } from '@/lib/query/keys';
import { useApiQuery } from '@/lib/query/hooks';
import { fmtDuration, fmtPct } from '@/lib/utils';
import { BarList, ScoreHistogram } from './charts';

export function SummaryTab({ quizId }: { quizId: string }) {
  const { data, isPending } = useApiQuery(keys.reports.summary(quizId), () => reportsApi.summary(quizId));

  if (isPending) {
    return (
      <div className="grid gap-4" aria-busy="true">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">{Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-28" />)}</div>
        <Skeleton className="h-80" />
      </div>
    );
  }
  if (!data || data.attempts === 0) {
    return <EmptyState icon={<BarChart3 />} title="No results yet" description="Reports appear as soon as participants submit this quiz. Share the access code or assign a cohort to get started." />;
  }

  const bands = [...data.bands].sort((a, b) => b.count - a.count);
  return (
    <div className="grid gap-6">
      {data.gradedPending > 0 && (
        <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-warning bg-warning-soft p-4 text-sm">
          <p><span className="num font-semibold">{data.gradedPending}</span> attempt{data.gradedPending === 1 ? ' is' : 's are'} still waiting for manual grading, so these figures are provisional.</p>
          <Button asChild variant="secondary" size="sm"><Link to={`/studio/quizzes/${quizId}/grading`}>Open grading</Link></Button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard label="Attempts" value={data.attempts} icon={<Users />} />
        <StatCard label="Participants" value={data.participants} icon={<Users />} />
        <StatCard label="Average score" value={fmtPct(data.avgPct)} hint={`Median ${fmtPct(data.medianPct)}`} icon={<Percent />} />
        <StatCard label="Pass rate" value={fmtPct(data.passRate)} icon={<Trophy />} />
        <StatCard label="Average time" value={fmtDuration(data.avgDurationSec)} icon={<Clock />} className="col-span-2 lg:col-span-1" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <ScoreHistogram data={data.distribution} />
        <section className="rounded-lg border border-border bg-surface p-5" aria-labelledby="bands-h">
          <h3 id="bands-h" className="font-display text-lg font-semibold">Grade bands</h3>
          <p className="mb-4 text-sm text-muted">Attempts per grade</p>
          {bands.length
            ? <BarList label="Attempts per grade band" rows={bands.map((b) => ({ id: b.label, label: `Grade ${b.label}`, value: b.count }))} />
            : <p className="text-sm text-muted">No grade bands configured for this quiz.</p>}
        </section>
      </div>
    </div>
  );
}
