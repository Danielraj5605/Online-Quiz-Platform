import { useMemo, useState } from 'react';
import { ListChecks } from 'lucide-react';
import { Badge, EmptyState, FormField, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Skeleton } from '@/components/ui';
import { reportsApi } from '@/lib/api';
import type { ItemAnalysisRow } from '@/lib/api/types';
import { keys } from '@/lib/query/keys';
import { useApiQuery } from '@/lib/query/hooks';
import { fmtDuration } from '@/lib/utils';
import { BarList } from './charts';
import { difficultyLabel, discriminationLabel, itemFlags } from './item-flags';

type SortKey = 'order' | 'hardest' | 'discrimination';

export function ItemsTab({ quizId }: { quizId: string }) {
  const { data, isPending } = useApiQuery(keys.reports.items(quizId), () => reportsApi.items(quizId));
  const [sort, setSort] = useState<SortKey>('order');

  const rows = useMemo(() => {
    const list = (data ?? []).map((r, i) => ({ r, i, flags: itemFlags(r) }));
    if (sort === 'hardest') list.sort((a, b) => (a.r.difficulty ?? 2) - (b.r.difficulty ?? 2));
    if (sort === 'discrimination') list.sort((a, b) => (a.r.discrimination ?? 2) - (b.r.discrimination ?? 2));
    return list;
  }, [data, sort]);

  if (isPending) return <div className="grid gap-4" aria-busy="true">{Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-48" />)}</div>;
  if (!data || data.length === 0) return <EmptyState icon={<ListChecks />} title="No question data yet" description="Item analysis needs published questions and at least a few submissions." />;

  const flagged = rows.filter((x) => x.flags.some((f) => f.tone === 'danger' || f.tone === 'warning')).length;

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <p className="max-w-xl text-sm text-muted" aria-live="polite">
          <span className="num font-medium text-text">{flagged}</span> of <span className="num">{rows.length}</span> question{rows.length === 1 ? '' : 's'} may need a second look.
        </p>
        <FormField label="Sort by" className="w-52">
          <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="order">Quiz order</SelectItem>
              <SelectItem value="hardest">Hardest first</SelectItem>
              <SelectItem value="discrimination">Weakest discrimination</SelectItem>
            </SelectContent>
          </Select>
        </FormField>
      </div>

      <details className="rounded-lg border border-border bg-surface px-4 py-3 text-sm">
        <summary className="cursor-pointer select-none font-medium">How to read these numbers</summary>
        <dl className="mt-3 grid gap-2 text-muted">
          <div><dt className="inline font-medium text-text">Difficulty</dt> — the share of available points participants earned. High means easy; 30–90% is a healthy range.</div>
          <div><dt className="inline font-medium text-text">Discrimination</dt> — success of the top 27% of scorers minus the bottom 27%. Above +0.30 is good; negative suggests a wrong key.</div>
          <div><dt className="inline font-medium text-text">Options</dt> — how many participants chose each answer. A good wrong option attracts some of the weaker group.</div>
        </dl>
      </details>

      <ol className="grid gap-4">
        {rows.map(({ r, i, flags }) => <ItemCard key={r.questionId} index={i + 1} row={r} flags={flags} />)}
      </ol>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="num text-lg font-semibold">{value}</dd>
    </div>
  );
}

function ItemCard({ index, row, flags }: { index: number; row: ItemAnalysisRow; flags: ReturnType<typeof itemFlags> }) {
  return (
    <li className="rounded-lg border border-border bg-surface p-5">
      <div className="flex items-start gap-3">
        <span className="num grid size-7 shrink-0 place-items-center rounded-full bg-surface-2 text-sm font-medium">{index}</span>
        <div className="min-w-0 flex-1">
          <h3 className="break-words font-medium">{row.text}</h3>
          <p className="mt-0.5 text-xs text-muted">{row.type.replace('_', ' ').toLowerCase()} · <span className="num">{row.points}</span> pt{row.points === 1 ? '' : 's'} · <span className="num">{row.responses}</span> graded response{row.responses === 1 ? '' : 's'}</p>
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Difficulty" value={difficultyLabel(row.difficulty)} />
        <Stat label="Discrimination" value={discriminationLabel(row.discrimination)} />
        <Stat label="Avg. time" value={fmtDuration(Math.round(row.avgTimeMs / 1000))} />
        <Stat label="Left blank" value={`${Math.round(row.omitRate * 100)}%`} />
      </dl>

      {flags.length > 0 && (
        <ul className="mt-4 grid gap-2" aria-label="Review flags">
          {flags.map((f) => (
            <li key={f.id} className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm">
              <Badge tone={f.tone}>{f.label}</Badge>
              <span className="text-muted">{f.detail}</span>
            </li>
          ))}
        </ul>
      )}

      {row.distractors.length > 0 && (
        <div className="mt-5">
          <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">Times each option was chosen</h4>
          <BarList
            label={`Option counts for question ${index}`}
            rows={row.distractors.map((d, k) => ({
              id: d.optionId,
              label: `${String.fromCharCode(65 + k)}. ${d.text}${d.isCorrect ? ' (correct)' : ''}`,
              value: d.count,
              tone: d.isCorrect ? 'good' : 'neutral',
            }))}
          />
        </div>
      )}
    </li>
  );
}
