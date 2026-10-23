import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Avatar, DataTable, Progress, StatusBadge, type Column } from '@/components/ui';
import type { MonitorParticipant } from '@/lib/api/types';
import { fmtDuration } from '@/lib/utils';

/** Seconds left until `expiresAt`, re-rendered every second. Untimed attempts show an em dash. */
export function Remaining({ expiresAt, active }: { expiresAt: string | null; active: boolean }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active || !expiresAt) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active, expiresAt]);
  if (!active || !expiresAt) return <span className="text-muted">—</span>;
  const left = Math.max(0, Math.round((new Date(expiresAt).getTime() - now) / 1000));
  return <span className={`num ${left <= 60 ? 'font-medium text-danger' : ''}`}>{fmtDuration(left)}</span>;
}

const ago = (iso: string, now: number) => {
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  return s < 10 ? 'just now' : s < 60 ? `${s}s ago` : s < 3600 ? `${Math.floor(s / 60)}m ago` : `${Math.floor(s / 3600)}h ago`;
};

export function MonitorTable({ rows, loading, now }: { rows: MonitorParticipant[] | undefined; loading: boolean; now: number }) {
  const columns: Column<MonitorParticipant>[] = [
    {
      key: 'who', header: 'Participant', primary: true,
      cell: (r) => (
        <span className="flex items-center gap-2.5">
          <Avatar name={r.name ?? r.username} size={30} />
          <span className="min-w-0"><span className="block truncate font-medium">{r.name ?? r.username}</span><span className="block truncate text-xs text-muted">@{r.username}</span></span>
        </span>
      ),
    },
    { key: 'status', header: 'Status', cell: (r) => <StatusBadge kind="attempt" status={r.status} /> },
    {
      key: 'progress', header: 'Progress',
      cell: (r) => (
        <div className="grid min-w-28 gap-1">
          <span className="num text-xs text-muted">{r.answered}/{r.total} answered</span>
          <Progress value={r.answered} max={Math.max(1, r.total)} label={`${r.username} progress`} tone={r.status === 'IN_PROGRESS' ? 'teal' : 'success'} />
        </div>
      ),
    },
    { key: 'left', header: 'Time left', cell: (r) => <Remaining expiresAt={r.expiresAt} active={r.status === 'IN_PROGRESS'} /> },
    {
      key: 'tabs', header: 'Tab switches',
      cell: (r) => r.tabSwitches > 3
        ? <span className="inline-flex items-center gap-1 font-medium text-warning"><AlertTriangle className="size-3.5" aria-hidden="true" /><span className="num">{r.tabSwitches}</span></span>
        : <span className="num">{r.tabSwitches}</span>,
    },
    { key: 'seen', header: 'Last active', hideOnMobile: true, cell: (r) => <span className="text-muted">{ago(r.lastSeenAt, now)}</span> },
  ];
  return (
    <DataTable
      caption="Participants and their attempt progress"
      columns={columns}
      rows={rows}
      loading={loading}
      getRowId={(r) => r.attemptId}
      empty={{ title: 'Nobody has started yet', description: 'Participants appear here the moment they begin. This page refreshes every few seconds.' }}
    />
  );
}
