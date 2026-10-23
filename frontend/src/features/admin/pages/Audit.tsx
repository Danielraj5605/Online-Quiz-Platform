import { useState } from 'react';
import { Filter, X } from 'lucide-react';
import { adminApi, type AuditRow } from '@/lib/api';
import { keys } from '@/lib/query/keys';
import { usePagedQuery } from '@/lib/query/hooks';
import { useDebounced, useDocumentTitle } from '@/lib/hooks';
import { Badge, Button, DataTable, FormField, Input, PageHeader, type Column } from '@/components/ui';
import { fmtDate } from '@/lib/utils';

const ACTION_HINTS = ['auth.', 'admin.', 'moderation.', 'quiz.', 'grading.', 'attempt.'];

function Meta({ meta, ip }: { meta: unknown; ip: string | null }) {
  const has = meta !== null && meta !== undefined && !(typeof meta === 'object' && Object.keys(meta as object).length === 0);
  if (!has && !ip) return <span className="text-muted">—</span>;
  return (
    <details className="group max-w-xs">
      <summary className="cursor-pointer rounded-sm text-sm text-accent hover:underline">Details</summary>
      <pre className="mt-2 max-h-48 overflow-auto rounded-md bg-surface-2 p-2 font-mono text-xs leading-relaxed whitespace-pre-wrap break-all">
        {JSON.stringify({ ...(has ? { meta } : {}), ...(ip ? { ip } : {}) }, null, 2)}
      </pre>
    </details>
  );
}

export default function Audit() {
  useDocumentTitle('Audit log');
  const [page, setPage] = useState(1);
  const [action, setAction] = useState('');
  const [actor, setActor] = useState<{ id: string; username: string } | null>(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const dAction = useDebounced(action.trim(), 300);

  const query = {
    page, pageSize: 20,
    action: dAction || undefined,
    actorId: actor?.id,
    from: from ? `${from}T00:00:00.000Z` : undefined,
    to: to ? `${to}T23:59:59.999Z` : undefined,
  };
  const list = usePagedQuery(keys.admin.audit(query), () => adminApi.auditLog(query));
  const filtered = !!(dAction || actor || from || to);
  const reset = () => { setAction(''); setActor(null); setFrom(''); setTo(''); setPage(1); };

  const columns: Column<AuditRow>[] = [
    { key: 'when', header: 'When', primary: true, cell: (r) => <time dateTime={r.createdAt} className="whitespace-nowrap">{fmtDate(r.createdAt)}</time> },
    {
      key: 'actor', header: 'Actor',
      cell: (r) => r.actor ? (
        <button
          type="button"
          className="rounded-sm text-left hover:text-accent hover:underline"
          title="Filter by this actor"
          onClick={() => { setActor(r.actor); setPage(1); }}
        >
          {r.actor.username}
        </button>
      ) : <span className="text-muted">system</span>,
    },
    { key: 'action', header: 'Action', cell: (r) => <Badge tone="neutral" className="font-mono">{r.action}</Badge> },
    {
      key: 'entity', header: 'Entity',
      cell: (r) => (
        <span className="text-sm">
          {r.entityType}
          {r.entityId && <span className="ml-1 font-mono text-xs text-muted">{r.entityId.slice(0, 8)}</span>}
        </span>
      ),
    },
    { key: 'meta', header: 'Details', cell: (r) => <Meta meta={r.meta} ip={r.ip} /> },
  ];

  return (
    <>
      <PageHeader eyebrow="Admin" title="Audit log" description="A record of sign-ups, admin actions and moderation decisions." />
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_auto_auto_auto]">
        <FormField label="Action starts with">
          <Input list="audit-actions" placeholder="e.g. admin." value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }} />
        </FormField>
        <datalist id="audit-actions">{ACTION_HINTS.map((a) => <option key={a} value={a} />)}</datalist>
        <FormField label="From">
          <Input type="date" value={from} max={to || undefined} onChange={(e) => { setFrom(e.target.value); setPage(1); }} />
        </FormField>
        <FormField label="To">
          <Input type="date" value={to} min={from || undefined} onChange={(e) => { setTo(e.target.value); setPage(1); }} />
        </FormField>
        <div className="flex items-end gap-2">
          {filtered && <Button variant="outline" onClick={reset}><X aria-hidden="true" /> Clear</Button>}
        </div>
      </div>
      {actor && (
        <p className="mb-3 flex items-center gap-2 text-sm" aria-live="polite">
          <Filter className="size-4 text-muted" aria-hidden="true" />
          Showing actions by <Badge tone="accent">{actor.username}</Badge>
          <button type="button" className="rounded-sm text-accent underline" onClick={() => { setActor(null); setPage(1); }}>remove</button>
        </p>
      )}
      <DataTable
        caption="Audit log entries, newest first"
        columns={columns}
        rows={list.data?.data}
        loading={list.isPending}
        getRowId={(r) => r.id}
        meta={list.data?.meta}
        onPageChange={setPage}
        empty={{
          title: filtered ? 'No entries match these filters' : 'No activity recorded yet',
          action: filtered ? <Button variant="outline" onClick={reset}>Clear filters</Button> : undefined,
        }}
      />
    </>
  );
}
