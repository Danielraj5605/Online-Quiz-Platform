import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Flag, FlagOff, Search } from 'lucide-react';
import { QUIZ_STATUSES, type QuizStatus } from '@quiz/shared';
import { adminApi, type AdminQuizRow } from '@/lib/api';
import type { Paged } from '@/lib/api/client';
import { keys } from '@/lib/query/keys';
import { useApiMutation, usePagedQuery } from '@/lib/query/hooks';
import { useDebounced, useDocumentTitle } from '@/lib/hooks';
import {
  Badge, Button, DataTable, Input, Label, PageHeader, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, type Column,
} from '@/components/ui';
import { fmtDate } from '@/lib/utils';

const ALL = 'ALL';
const STATUS_LABEL: Record<QuizStatus, string> = { DRAFT: 'Draft', SCHEDULED: 'Scheduled', LIVE: 'Live', CLOSED: 'Closed', ARCHIVED: 'Archived' };

export default function Quizzes() {
  useDocumentTitle('All quizzes');
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState('-createdAt');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<QuizStatus | typeof ALL>(ALL);
  const [flagged, setFlagged] = useState<'ALL' | 'true' | 'false'>(ALL);
  const dq = useDebounced(q.trim(), 300);

  const query = { page, pageSize: 15, sort, q: dq || undefined, status: status === ALL ? '' as const : status, flagged: flagged === ALL ? '' as const : flagged };
  const listKey = keys.admin.quizzes(query);
  const list = usePagedQuery(listKey, () => adminApi.quizzes(query));

  const patchRow = (id: string, patch: Partial<AdminQuizRow>) => (old: unknown) => {
    const o = old as Paged<AdminQuizRow[]> | undefined;
    return o ? { ...o, data: o.data.map((r) => (r.id === id ? { ...r, ...patch } : r)) } : o;
  };
  const statusMut = useApiMutation(
    (v: { id: string; status: QuizStatus }) => adminApi.updateQuiz(v.id, { status: v.status }),
    { invalidate: [keys.admin.all], success: 'Status updated', optimistic: { key: listKey, update: (old, v) => patchRow(v.id, { status: v.status })(old) } },
  );
  const flagMut = useApiMutation(
    (v: { id: string; isFlagged: boolean }) => adminApi.updateQuiz(v.id, { isFlagged: v.isFlagged }),
    { invalidate: [keys.admin.all], success: 'Quiz updated', optimistic: { key: listKey, update: (old, v) => patchRow(v.id, { isFlagged: v.isFlagged })(old) } },
  );

  const columns: Column<AdminQuizRow>[] = [
    {
      key: 'title', header: 'Quiz', sortKey: 'title', primary: true,
      cell: (r) => (
        <div className="min-w-0">
          <Link to={`/studio/quizzes/${r.id}/build`} className="truncate font-medium hover:text-accent hover:underline">{r.title}</Link>
          <p className="truncate text-xs text-muted">by {r.owner.username} · {r.questionCount} questions</p>
        </div>
      ),
    },
    {
      key: 'status', header: 'Status', sortKey: 'status',
      cell: (r) => (
        <div className="flex items-center gap-2">
          <Select value={r.status} onValueChange={(v) => statusMut.mutate({ id: r.id, status: v as QuizStatus })}>
            <SelectTrigger aria-label={`Status for ${r.title}`} className="h-9 w-36 sm:h-9"><SelectValue /></SelectTrigger>
            <SelectContent>{QUIZ_STATUSES.map((s) => <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      ),
    },
    { key: 'visibility', header: 'Visibility', hideOnMobile: true, cell: (r) => <Badge>{r.visibility.toLowerCase()}</Badge> },
    { key: 'attempts', header: 'Attempts', hideOnMobile: true, cell: (r) => <span className="num">{r.attemptCount}</span> },
    { key: 'created', header: 'Created', sortKey: 'createdAt', cell: (r) => fmtDate(r.createdAt, { dateStyle: 'medium' }) },
    {
      key: 'flag', header: 'Flag', className: 'text-right',
      cell: (r) => (
        <Button
          variant={r.isFlagged ? 'secondary' : 'outline'}
          size="sm"
          aria-pressed={r.isFlagged}
          aria-label={`${r.isFlagged ? 'Unflag' : 'Flag'} ${r.title}`}
          onClick={() => flagMut.mutate({ id: r.id, isFlagged: !r.isFlagged })}
        >
          {r.isFlagged ? <FlagOff aria-hidden="true" /> : <Flag aria-hidden="true" />}
          {r.isFlagged ? 'Flagged' : 'Flag'}
        </Button>
      ),
    },
  ];

  return (
    <>
      <PageHeader eyebrow="Admin" title="All quizzes" description="Flagged quizzes are hidden from the public catalog until unflagged." />
      <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_auto_auto]">
        <div>
          <Label htmlFor="quiz-search" className="sr-only">Search quizzes</Label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
            <Input id="quiz-search" type="search" placeholder="Search title or owner" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} className="pl-9" />
          </div>
        </div>
        <Select value={status} onValueChange={(v) => { setStatus(v as QuizStatus | typeof ALL); setPage(1); }}>
          <SelectTrigger aria-label="Filter by status" className="sm:w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All statuses</SelectItem>
            {QUIZ_STATUSES.map((s) => <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={flagged} onValueChange={(v) => { setFlagged(v as typeof flagged); setPage(1); }}>
          <SelectTrigger aria-label="Filter by flag" className="sm:w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Flagged or not</SelectItem>
            <SelectItem value="true">Flagged only</SelectItem>
            <SelectItem value="false">Not flagged</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <DataTable
        caption="All quizzes on the platform"
        columns={columns}
        rows={list.data?.data}
        loading={list.isPending}
        getRowId={(r) => r.id}
        sort={sort}
        onSortChange={(s) => { setSort(s); setPage(1); }}
        meta={list.data?.meta}
        onPageChange={setPage}
        empty={{ title: 'No quizzes match', description: 'Try a different search or clear the filters.' }}
      />
    </>
  );
}
