import { Search } from 'lucide-react';
import { Avatar, Badge, Checkbox, EmptyState, Input, Pagination, Skeleton, Tabs, TabsList, TabsTrigger } from '@/components/ui';
import type { PageMeta } from '@quiz/shared';
import type { GradingSubmission } from '@/lib/api/types';
import { cn, fmtDate, fmtPct } from '@/lib/utils';

export type QueueStatus = 'pending' | 'graded' | 'all';

interface Props {
  rows: GradingSubmission[] | undefined;
  meta: PageMeta | undefined;
  loading: boolean;
  status: QueueStatus;
  onStatusChange: (s: QueueStatus) => void;
  search: string;
  onSearchChange: (s: string) => void;
  onPageChange: (p: number) => void;
  activeId: string | null;
  onOpen: (id: string) => void;
  selected: Set<string>;
  onToggle: (id: string) => void;
  onTogglePage: (ids: string[], on: boolean) => void;
}

export function SubmissionQueue({ rows, meta, loading, status, onStatusChange, search, onSearchChange, onPageChange, activeId, onOpen, selected, onToggle, onTogglePage }: Props) {
  const ids = rows?.map((r) => r.attemptId) ?? [];
  const allOn = ids.length > 0 && ids.every((i) => selected.has(i));
  const someOn = ids.some((i) => selected.has(i));

  return (
    <section aria-label="Submission queue" className="grid content-start gap-3">
      <Tabs value={status} onValueChange={(v) => onStatusChange(v as QueueStatus)}>
        <TabsList aria-label="Filter submissions">
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="graded">Graded</TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
        <Input type="search" value={search} onChange={(e) => onSearchChange(e.target.value)} placeholder="Search participants" aria-label="Search participants" className="pl-9" />
      </div>

      {loading && !rows ? (
        <div className="grid gap-2" aria-busy="true">{Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-16" />)}</div>
      ) : rows && rows.length === 0 ? (
        <EmptyState
          title={status === 'pending' ? 'Nothing waiting for you' : 'No submissions here'}
          description={status === 'pending' ? 'Every submission with written answers has been graded.' : 'Try another filter or search term.'}
        />
      ) : (
        <>
          <label className="flex items-center gap-2 px-1 text-xs text-muted">
            <Checkbox
              checked={allOn ? true : someOn ? 'indeterminate' : false}
              onCheckedChange={(c) => onTogglePage(ids, c === true)}
              aria-label="Select all submissions on this page"
            />
            Select page
          </label>
          <ul className="grid gap-2">
            {rows?.map((r) => {
              const active = r.attemptId === activeId;
              const pending = r.pendingCount > 0;
              return (
                <li key={r.attemptId} className={cn('flex items-stretch gap-2 rounded-lg border bg-surface', active ? 'border-accent ring-1 ring-accent' : 'border-border')}>
                  <div className="grid place-items-center pl-3">
                    <Checkbox checked={selected.has(r.attemptId)} onCheckedChange={() => onToggle(r.attemptId)} aria-label={`Select ${r.user.name ?? r.user.username}`} />
                  </div>
                  <button
                    type="button"
                    onClick={() => onOpen(r.attemptId)}
                    aria-current={active ? 'true' : undefined}
                    className="flex min-h-14 min-w-0 flex-1 items-center gap-3 rounded-r-lg py-2 pr-3 text-left hover:bg-surface-2"
                  >
                    <Avatar name={r.user.name ?? r.user.username} size={32} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{r.user.name ?? r.user.username}</span>
                      <span className="block truncate text-xs text-muted">@{r.user.username} · {fmtDate(r.submittedAt, { dateStyle: 'short', timeStyle: 'short' })}</span>
                    </span>
                    {pending ? (
                      <Badge tone="warning"><span className="num">{r.pendingCount}</span> to grade</Badge>
                    ) : (
                      <Badge tone="success">Graded <span className="num">{fmtPct(r.percentage)}</span></Badge>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
          <Pagination meta={meta} onPageChange={onPageChange} />
        </>
      )}
    </section>
  );
}
