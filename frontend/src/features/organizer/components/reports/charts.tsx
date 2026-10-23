import { useId, useState, type ReactNode } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { NameType, ValueType } from 'recharts/types/component/DefaultTooltipContent';
import type { TooltipContentProps } from 'recharts';
import { Table2, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui';
import { cn } from '@/lib/utils';

/* Chart ink comes from design tokens so light/dark follow the theme without re-rendering. */
const INK_MUTED = 'var(--text-muted)';
const GRID = 'var(--border)';
const SERIES = 'var(--teal)';

const axisTick = { fill: INK_MUTED, fontSize: 12 };

interface TipProps extends Partial<TooltipContentProps<ValueType, NameType>> { unit: string }
function ChartTip({ active, payload, label, unit }: TipProps) {
  if (!active || !payload?.length) return null;
  const v = Number(payload[0]!.value);
  return (
    <div role="status" className="rounded-md border border-border bg-surface px-3 py-2 text-sm shadow-[var(--shadow-2)]">
      <p className="num text-xs text-muted">{label}%</p>
      <p><span className="num text-base font-semibold">{v}</span> <span className="text-muted">{unit}{v === 1 ? '' : 's'}</span></p>
    </div>
  );
}

/** Wrapper with a title, a chart/table toggle (the table is the accessible, exact view) and a text summary. */
export function ChartCard({ title, description, summary, table, children, className }: {
  title: string; description?: string; summary: string; table: ReactNode; children: ReactNode; className?: string;
}) {
  const [asTable, setAsTable] = useState(false);
  const id = useId();
  return (
    <figure className={cn('rounded-lg border border-border bg-surface p-5', className)} aria-labelledby={`${id}-t`}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <figcaption>
          <h3 id={`${id}-t`} className="font-display text-lg font-semibold">{title}</h3>
          {description && <p className="text-sm text-muted">{description}</p>}
        </figcaption>
        <Button variant="ghost" size="sm" onClick={() => setAsTable((v) => !v)} aria-pressed={asTable}>
          {asTable ? <BarChart3 aria-hidden="true" /> : <Table2 aria-hidden="true" />}
          {asTable ? 'Show chart' : 'Show table'}
        </Button>
      </div>
      {asTable ? table : (
        <div role="img" aria-label={summary}>{children}</div>
      )}
    </figure>
  );
}

type LabelArgs = { x?: number | string; y?: number | string; width?: number | string; value?: unknown; index?: number };

export interface Bucket { bucket: string; count: number }

/** Score histogram: one hue, ≤24px columns with rounded caps, hairline grid, the peak labelled directly. */
export function ScoreHistogram({ data }: { data: Bucket[] }) {
  const max = Math.max(0, ...data.map((d) => d.count));
  const peak = data.find((d) => d.count === max && max > 0)?.bucket;
  const total = data.reduce((a, b) => a + b.count, 0);
  const summary = total
    ? `Histogram of ${total} scores in ten 10-point bands. Most common band: ${peak}%, with ${max}.`
    : 'No scores yet.';
  return (
    <ChartCard
      title="Score distribution"
      description="Attempts per score band (% of available points)"
      summary={summary}
      table={
        <table className="w-full text-sm">
          <caption className="sr-only">Number of attempts per score band</caption>
          <thead className="text-left text-xs uppercase tracking-wide text-muted"><tr><th scope="col" className="py-2">Score band</th><th scope="col" className="py-2 text-right">Attempts</th></tr></thead>
          <tbody>{data.map((d) => <tr key={d.bucket} className="border-t border-border"><th scope="row" className="num py-2 text-left font-normal">{d.bucket}%</th><td className="num py-2 text-right">{d.count}</td></tr>)}</tbody>
        </table>
      }
    >
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 22, right: 8, bottom: 0, left: -12 }} barCategoryGap="22%">
            <CartesianGrid vertical={false} stroke={GRID} strokeWidth={1} />
            <XAxis dataKey="bucket" tick={axisTick} tickLine={false} axisLine={{ stroke: GRID }} interval={0} tickFormatter={(v: string) => v.split('-')[0]!} />
            <YAxis allowDecimals={false} tick={axisTick} tickLine={false} axisLine={false} width={40} />
            <Tooltip cursor={{ fill: 'var(--surface-2)' }} content={(p) => <ChartTip {...p} unit="attempt" />} />
            <Bar
              dataKey="count" fill={SERIES} maxBarSize={24} radius={[4, 4, 0, 0]} isAnimationActive={false}
              label={(p: LabelArgs) => {
                const v = Number(p.value ?? 0);
                return data[p.index ?? -1]?.bucket === peak && v > 0 ? (
                  <text x={Number(p.x ?? 0) + Number(p.width ?? 0) / 2} y={Number(p.y ?? 0) - 6} textAnchor="middle" fill="var(--text)" fontSize={12} fontWeight={600} className="num">{v}</text>
                ) : <g />;
              }}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-1 text-center text-xs text-muted">Score band, starting at (%)</p>
    </ChartCard>
  );
}

export interface BarRow { id: string; label: string; value: number; display?: string; tone?: 'series' | 'good' | 'neutral' }

/**
 * Horizontal bars as plain HTML: label left, value at the bar tip, ≤12px thick, rounded data-end.
 * Used for grade bands and distractor counts, where long text labels need room.
 */
export function BarList({ rows, max, label }: { rows: BarRow[]; max?: number; label: string }) {
  const m = max ?? Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="grid gap-2" aria-label={label}>
      {rows.map((r) => (
        <li key={r.id} className="grid grid-cols-[minmax(0,10rem)_1fr_auto] items-center gap-3 text-sm sm:grid-cols-[minmax(0,14rem)_1fr_auto]">
          <span className="truncate" title={r.label}>{r.label}</span>
          <span className="h-3 rounded-r-[4px] bg-surface-2" aria-hidden="true">
            <span
              className={cn('block h-full rounded-r-[4px]', r.tone === 'good' ? 'bg-success' : r.tone === 'neutral' ? 'bg-border-strong' : 'bg-teal')}
              style={{ width: `${Math.max(r.value > 0 ? 2 : 0, (r.value / m) * 100)}%` }}
            />
          </span>
          <span className="num w-12 text-right font-medium">{r.display ?? r.value}</span>
        </li>
      ))}
    </ul>
  );
}
