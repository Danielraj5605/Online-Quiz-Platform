import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { BarChart3 } from 'lucide-react';
import { attemptsApi } from '@/lib/api/attempts';
import type { AttemptHistoryItem, ProgressDto } from '@/lib/api/types';
import { useApiQuery, usePagedQuery } from '@/lib/query/hooks';
import { keys } from '@/lib/query/keys';
import { useDocumentTitle } from '@/lib/hooks';
import { fmtDate, fmtPct } from '@/lib/utils';
import { Badge, Button, Card, CardContent, DataTable, EmptyState, PageHeader, Skeleton, StatCard, StatusBadge, Switch, type Column } from '@/components/ui';

const AXIS = { fontSize: 12, fill: 'var(--text-muted)' };

function TipBox({ title, value, sub }: { title: string; value: string; sub?: string }) {
  return (
    <div className="rounded-md border border-border bg-surface px-3 py-2 text-sm shadow-[var(--shadow-2)]">
      <p className="num text-base font-semibold">{value}</p>
      <p className="flex items-center gap-1.5 text-muted"><span className="h-0.5 w-3 rounded bg-accent" aria-hidden="true" />{title}</p>
      {sub && <p className="text-xs text-muted">{sub}</p>}
    </div>
  );
}

function TrendChart({ trend }: { trend: ProgressDto['trend'] }) {
  const data = trend.map((t, i) => ({ i: i + 1, pct: Math.round(t.pct * 10) / 10, date: t.date }));
  return (
    <div className="h-64 w-full" role="img" aria-label={`Line chart of your last ${data.length} scores, from ${data[0]?.pct}% to ${data.at(-1)?.pct}%. A table view is available.`}>
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 12, right: 16, bottom: 4, left: -8 }}>
          <CartesianGrid stroke="var(--border)" strokeWidth={1} vertical={false} />
          <XAxis dataKey="i" tick={AXIS} tickLine={false} axisLine={{ stroke: 'var(--border)' }} tickFormatter={(v: number) => `#${v}`} />
          <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tick={AXIS} tickLine={false} axisLine={false} tickFormatter={(v: number) => `${v}%`} width={44} />
          <ReferenceLine y={50} stroke="var(--border-strong)" strokeDasharray="0" strokeOpacity={0.4} />
          <Tooltip
            cursor={{ stroke: 'var(--border-strong)', strokeWidth: 1 }}
            content={({ active, payload }) => active && payload?.length ? <TipBox title="Score" value={`${payload[0]!.value}%`} sub={fmtDate((payload[0]!.payload as { date: string }).date, { dateStyle: 'medium' })} /> : null}
          />
          <Line type="monotone" dataKey="pct" stroke="var(--accent)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" dot={{ r: 4, fill: 'var(--accent)', stroke: 'var(--surface)', strokeWidth: 2 }} activeDot={{ r: 6, fill: 'var(--accent)', stroke: 'var(--surface)', strokeWidth: 2 }} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function CategoryChart({ rows }: { rows: ProgressDto['byCategory'] }) {
  const data = rows.map((r) => ({ name: r.category, pct: r.avgPct, count: r.count }));
  return (
    <div style={{ height: Math.max(120, data.length * 44 + 30) }} className="w-full" role="img" aria-label={`Bar chart of average score by category: ${data.map((d) => `${d.name} ${d.pct}%`).join(', ')}.`}>
      <ResponsiveContainer>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 40, bottom: 4, left: 8 }}>
          <CartesianGrid stroke="var(--border)" horizontal={false} />
          <XAxis type="number" domain={[0, 100]} ticks={[0, 50, 100]} tick={AXIS} tickLine={false} axisLine={false} tickFormatter={(v: number) => `${v}%`} />
          <YAxis type="category" dataKey="name" tick={{ ...AXIS, fill: 'var(--text)' }} tickLine={false} axisLine={false} width={110} />
          <Tooltip cursor={{ fill: 'var(--surface-2)' }} content={({ active, payload }) => active && payload?.length ? <TipBox title={String(payload[0]!.payload.name)} value={`${payload[0]!.value}%`} sub={`${payload[0]!.payload.count} result${payload[0]!.payload.count === 1 ? '' : 's'}`} /> : null} />
          <Bar dataKey="pct" fill="var(--teal)" barSize={20} radius={[0, 4, 4, 0]} isAnimationActive={false} label={{ position: 'right', fill: 'var(--text)', fontSize: 12, formatter: (v: unknown) => `${v}%` }} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function Progress() {
  useDocumentTitle('Progress');
  const navigate = useNavigate();
  const [table, setTable] = useState(false);
  const [page, setPage] = useState(1);
  const progress = useApiQuery(keys.attempts.progress, () => attemptsApi.progress());
  const history = usePagedQuery(keys.attempts.history({ page }), () => attemptsApi.history({ page, pageSize: 10 }));

  const cols: Column<AttemptHistoryItem>[] = [
    { key: 'quiz', header: 'Quiz', primary: true, cell: (a) => <span className="font-medium">{a.quizTitle}</span> },
    { key: 'n', header: 'Attempt', cell: (a) => <span className="num">#{a.number}</span> },
    { key: 'status', header: 'Status', cell: (a) => <StatusBadge kind="attempt" status={a.status} /> },
    { key: 'score', header: 'Score', cell: (a) => (a.isFinal ? <span className="num font-semibold">{fmtPct(a.percentage)}</span> : <span className="text-muted">—</span>) },
    { key: 'result', header: 'Result', cell: (a) => (a.isFinal ? (a.passed ? <Badge tone="success">Passed</Badge> : <Badge tone="danger">Not passed</Badge>) : <span className="text-muted">—</span>) },
    { key: 'date', header: 'Date', cell: (a) => fmtDate(a.submittedAt ?? a.startedAt, { dateStyle: 'medium' }) },
  ];

  const p = progress.data;
  return (
    <>
      <PageHeader eyebrow="Progress" title="Your progress" description="How your scores are trending and where you’re strongest." />

      {progress.isPending ? <Skeleton className="h-64 w-full" /> : !p || p.totals.attempts === 0 ? (
        <EmptyState icon={<BarChart3 />} title="No results yet" description="Finish a quiz and your trend will appear here." action={<Button asChild><Link to="/discover">Find a quiz</Link></Button>} />
      ) : (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Quizzes finished" value={p.totals.attempts} />
            <StatCard label="Average score" value={fmtPct(p.totals.avgPct, 1)} />
            <StatCard label="Best score" value={fmtPct(p.totals.bestPct, 1)} />
            <StatCard label="Passed" value={`${p.totals.passed}/${p.totals.attempts}`} />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardContent>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <h2 className="text-xl font-semibold">Score trend</h2>
                  <label className="flex items-center gap-2 text-sm"><Switch checked={table} onCheckedChange={setTable} aria-label="Show chart data as a table" /> Table</label>
                </div>
                {table ? (
                  <table className="w-full text-sm">
                    <caption className="sr-only">Score for each of your recent results</caption>
                    <thead><tr className="text-left text-xs text-muted"><th scope="col" className="py-1.5">Result</th><th scope="col">Date</th><th scope="col" className="text-right">Score</th></tr></thead>
                    <tbody>{p.trend.map((t, i) => <tr key={i} className="border-t border-border"><td className="num py-1.5">#{i + 1}</td><td>{fmtDate(t.date, { dateStyle: 'medium' })}</td><td className="num text-right font-semibold">{fmtPct(t.pct, 1)}</td></tr>)}</tbody>
                  </table>
                ) : <TrendChart trend={p.trend} />}
              </CardContent>
            </Card>
            <Card>
              <CardContent>
                <h2 className="mb-2 text-xl font-semibold">Average by category</h2>
                {table ? (
                  <table className="w-full text-sm">
                    <caption className="sr-only">Average score per category</caption>
                    <thead><tr className="text-left text-xs text-muted"><th scope="col" className="py-1.5">Category</th><th scope="col" className="text-right">Results</th><th scope="col" className="text-right">Average</th></tr></thead>
                    <tbody>{p.byCategory.map((c) => <tr key={c.category} className="border-t border-border"><td className="py-1.5">{c.category}</td><td className="num text-right">{c.count}</td><td className="num text-right font-semibold">{fmtPct(c.avgPct, 1)}</td></tr>)}</tbody>
                  </table>
                ) : <CategoryChart rows={p.byCategory} />}
              </CardContent>
            </Card>
          </div>
        </>
      )}

      <section className="mt-10" aria-labelledby="hist-h">
        <h2 id="hist-h" className="mb-3 text-2xl font-semibold">History</h2>
        <DataTable
          caption="Your quiz attempts"
          columns={cols}
          rows={history.data?.data}
          loading={history.isPending}
          getRowId={(a) => a.attemptId}
          meta={history.data?.meta}
          onPageChange={setPage}
          onRowClick={(a) => navigate(a.status === 'IN_PROGRESS' ? `/attempt/${a.attemptId}` : `/results/${a.attemptId}`)}
          empty={{ title: 'No attempts yet', description: 'Your attempts will be listed here.', action: <Button asChild><Link to="/discover">Discover quizzes</Link></Button> }}
        />
      </section>
    </>
  );
}
