import { Link } from 'react-router-dom';
import { UsersRound } from 'lucide-react';
import { Button, DataTable, EmptyState, Skeleton, type Column } from '@/components/ui';
import { reportsApi } from '@/lib/api';
import type { CohortReportRow } from '@/lib/api/types';
import { keys } from '@/lib/query/keys';
import { useApiQuery } from '@/lib/query/hooks';
import { fmtPct } from '@/lib/utils';
import { BarList } from './charts';

export function CohortsTab({ quizId }: { quizId: string }) {
  const { data, isPending } = useApiQuery(keys.reports.cohorts(quizId), () => reportsApi.cohorts(quizId));

  if (isPending) return <Skeleton className="h-64" />;
  if (!data || data.length === 0) {
    return (
      <EmptyState
        icon={<UsersRound />} title="No cohorts assigned"
        description="Assign this quiz to a cohort in its Access settings to compare groups side by side."
        action={<Button asChild variant="secondary"><Link to="/studio/cohorts">Manage cohorts</Link></Button>}
      />
    );
  }

  const columns: Column<CohortReportRow>[] = [
    { key: 'name', header: 'Cohort', primary: true, cell: (r) => <span className="font-medium">{r.name}</span> },
    { key: 'members', header: 'Members', cell: (r) => <span className="num">{r.members}</span> },
    { key: 'attempted', header: 'Attempted', cell: (r) => <span className="num">{r.attempted} / {r.members}</span> },
    { key: 'avg', header: 'Average (best)', cell: (r) => <span className="num font-medium">{fmtPct(r.avgPct)}</span> },
    { key: 'pass', header: 'Pass rate', cell: (r) => <span className="num">{fmtPct(r.passRate)}</span> },
  ];

  return (
    <div className="grid gap-6">
      <section className="rounded-lg border border-border bg-surface p-5" aria-labelledby="cmp-h">
        <h3 id="cmp-h" className="font-display text-lg font-semibold">Average score by cohort</h3>
        <p className="mb-4 text-sm text-muted">Mean of each member’s best attempt</p>
        <BarList label="Average score per cohort" max={100} rows={data.map((c) => ({ id: c.cohortId, label: c.name, value: c.avgPct, display: fmtPct(c.avgPct) }))} />
      </section>
      <DataTable caption="Cohort comparison" columns={columns} rows={data} getRowId={(r) => r.cohortId} />
    </div>
  );
}
