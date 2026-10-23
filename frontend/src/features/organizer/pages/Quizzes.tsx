import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Archive, BarChart3, Copy, FilePlus2, MoreHorizontal, Pencil, Radio, Search, Trash2 } from 'lucide-react';
import { DIFFICULTIES, type QuizStatus, type QuizSummaryDto } from '@quiz/shared';
import {
  Button, DataTable, Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle, DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger, FormField, Input, PageHeader, Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
  StatusBadge, Tabs, TabsList, TabsTrigger, type Column,
} from '@/components/ui';
import { quizzesApi } from '@/lib/api';
import type { Paged } from '@/lib/api/client';
import { keys } from '@/lib/query/keys';
import { useApiMutation, usePagedQuery } from '@/lib/query/hooks';
import { useDebounced, useDocumentTitle } from '@/lib/hooks';
import { fmtDate } from '@/lib/utils';

const TABS: { value: QuizStatus | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'All' }, { value: 'DRAFT', label: 'Drafts' }, { value: 'SCHEDULED', label: 'Scheduled' },
  { value: 'LIVE', label: 'Live' }, { value: 'CLOSED', label: 'Closed' }, { value: 'ARCHIVED', label: 'Archived' },
];

type Pending = { kind: 'delete' | 'archive'; quiz: QuizSummaryDto } | null;

export default function Quizzes() {
  useDocumentTitle('Quizzes');
  const nav = useNavigate();
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const [status, setStatus] = useState<QuizStatus | 'ALL'>('ALL');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('-updatedAt');
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(params.get('new') === '1');
  const [pending, setPending] = useState<Pending>(null);
  const q = useDebounced(search, 300);

  useEffect(() => { setPage(1); }, [status, q, sort]);

  const query = { page, pageSize: 12, sort, q: q || undefined, status: status === 'ALL' ? undefined : status, mine: true };
  const listKey = keys.quizzes.list(query);
  const list = usePagedQuery(listKey, () => quizzesApi.list(query));

  const patchList = (fn: (rows: QuizSummaryDto[]) => QuizSummaryDto[]) => (old: unknown) => {
    const o = old as Paged<QuizSummaryDto[]> | undefined;
    return o ? { ...o, data: fn(o.data) } : o;
  };

  const remove = useApiMutation((id: string) => quizzesApi.remove(id), {
    invalidate: [keys.quizzes.all, keys.organizer.dashboard], success: 'Quiz deleted',
    optimistic: { key: listKey, update: (old, id) => patchList((r) => r.filter((x) => x.id !== id))(old) },
  });
  const archive = useApiMutation((id: string) => quizzesApi.archive(id), {
    invalidate: [keys.quizzes.all, keys.organizer.dashboard], success: 'Quiz archived',
    optimistic: { key: listKey, update: (old, id) => patchList((r) => r.map((x) => (x.id === id ? { ...x, status: 'ARCHIVED' as const } : x)))(old) },
  });
  const duplicate = useApiMutation((id: string) => quizzesApi.duplicate(id), {
    invalidate: [keys.quizzes.all], success: 'Copied as a new draft',
    onSuccess: (d) => nav(`/studio/quizzes/${d.id}/build`),
  });

  const columns: Column<QuizSummaryDto>[] = [
    {
      key: 'title', header: 'Quiz', sortKey: 'title', primary: true,
      cell: (r) => (
        <div className="min-w-0">
          <Link to={`/studio/quizzes/${r.id}/build`} className="font-medium hover:text-accent hover:underline" onClick={(e) => e.stopPropagation()}>{r.title}</Link>
          <p className="truncate text-xs text-muted">{[r.category?.name, r.difficulty.toLowerCase()].filter(Boolean).join(' · ')}{r.dirty ? ' · unpublished changes' : ''}</p>
        </div>
      ),
    },
    { key: 'status', header: 'Status', sortKey: 'status', cell: (r) => <StatusBadge status={r.status} /> },
    { key: 'questions', header: 'Questions', className: 'num', cell: (r) => r.questionCount },
    { key: 'attempts', header: 'Attempts', className: 'num', cell: (r) => r.attemptCount },
    { key: 'updated', header: 'Updated', sortKey: 'updatedAt', hideOnMobile: true, cell: (r) => <span className="text-muted">{fmtDate(r.updatedAt, { dateStyle: 'medium' })}</span> },
    {
      key: 'actions', header: 'Actions', className: 'w-12', hideOnMobile: true,
      cell: (r) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${r.title}`} onClick={(e) => e.stopPropagation()}><MoreHorizontal /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuItem onSelect={() => nav(`/studio/quizzes/${r.id}/build`)}><Pencil className="size-4" aria-hidden="true" /> Edit</DropdownMenuItem>
            {(r.status === 'LIVE' || r.status === 'CLOSED') && <DropdownMenuItem onSelect={() => nav(`/studio/quizzes/${r.id}/monitor`)}><Radio className="size-4" aria-hidden="true" /> Live monitor</DropdownMenuItem>}
            {r.attemptCount > 0 && <DropdownMenuItem onSelect={() => nav(`/studio/quizzes/${r.id}/reports`)}><BarChart3 className="size-4" aria-hidden="true" /> Reports</DropdownMenuItem>}
            <DropdownMenuItem onSelect={() => duplicate.mutate(r.id)}><Copy className="size-4" aria-hidden="true" /> Duplicate</DropdownMenuItem>
            <DropdownMenuSeparator />
            {r.status !== 'ARCHIVED' && <DropdownMenuItem onSelect={() => setPending({ kind: 'archive', quiz: r })}><Archive className="size-4" aria-hidden="true" /> Archive</DropdownMenuItem>}
            <DropdownMenuItem destructive onSelect={() => setPending({ kind: 'delete', quiz: r })}><Trash2 className="size-4" aria-hidden="true" /> Delete</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  const filtered = status !== 'ALL' || !!q;

  return (
    <>
      <PageHeader
        eyebrow="Studio"
        title="Quizzes"
        description="Draft, schedule and run your quizzes."
        actions={<Button onClick={() => setCreating(true)}><FilePlus2 aria-hidden="true" /> New quiz</Button>}
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Tabs value={status} onValueChange={(v) => setStatus(v as QuizStatus | 'ALL')} className="min-w-0 max-w-full">
          <TabsList aria-label="Filter by status">
            {TABS.map((t) => <TabsTrigger key={t.value} value={t.value}>{t.label}</TabsTrigger>)}
          </TabsList>
        </Tabs>
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
          <Input type="search" placeholder="Search quizzes…" aria-label="Search quizzes" className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      <DataTable
        caption="Your quizzes"
        columns={columns}
        rows={list.data?.data}
        loading={list.isPending}
        getRowId={(r) => r.id}
        sort={sort}
        onSortChange={setSort}
        meta={list.data?.meta}
        onPageChange={setPage}
        onRowClick={(r) => nav(`/studio/quizzes/${r.id}/build`)}
        empty={filtered
          ? { title: 'No quizzes match', description: 'Try a different status or search term.', action: <Button variant="outline" onClick={() => { setStatus('ALL'); setSearch(''); }}>Clear filters</Button> }
          : { title: 'No quizzes yet', icon: <FilePlus2 />, description: 'Create your first quiz to get started.', action: <Button onClick={() => setCreating(true)}>New quiz</Button> }}
      />

      <CreateQuizDialog
        open={creating}
        onOpenChange={(o) => { setCreating(o); if (!o && params.has('new')) { params.delete('new'); setParams(params, { replace: true }); } }}
        onCreated={(id) => { void qc.invalidateQueries({ queryKey: keys.quizzes.all }); nav(`/studio/quizzes/${id}/build`); }}
      />

      <Dialog open={!!pending} onOpenChange={(o) => !o && setPending(null)}>
        <DialogContent>
          <DialogTitle>{pending?.kind === 'delete' ? 'Delete this quiz?' : 'Archive this quiz?'}</DialogTitle>
          <DialogDescription>
            {pending?.kind === 'delete'
              ? `"${pending.quiz.title}" will be removed from your studio. Participants will no longer be able to open it.`
              : `"${pending?.quiz.title}" will be hidden from participants. Results are kept and you can reopen it later.`}
          </DialogDescription>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setPending(null)}>Cancel</Button>
            <Button
              variant={pending?.kind === 'delete' ? 'danger' : 'primary'}
              onClick={() => { if (pending) (pending.kind === 'delete' ? remove : archive).mutate(pending.quiz.id); setPending(null); }}
            >
              {pending?.kind === 'delete' ? 'Delete quiz' : 'Archive quiz'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function CreateQuizDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; onCreated: (id: string) => void }) {
  const [title, setTitle] = useState('');
  const [difficulty, setDifficulty] = useState<(typeof DIFFICULTIES)[number]>('MEDIUM');
  const [error, setError] = useState<string>();
  const create = useApiMutation((v: { title: string; difficulty: string }) => quizzesApi.create({ title: v.title, difficulty: v.difficulty as 'MEDIUM' }), {
    silent: true,
    onSuccess: (d) => { setTitle(''); onOpenChange(false); onCreated(d.id); },
  });
  const submit = () => {
    const t = title.trim();
    if (t.length < 3) return setError('Give your quiz a title of at least 3 characters');
    setError(undefined);
    create.mutate({ title: t, difficulty }, { onError: (e) => setError(e.message) });
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>New quiz</DialogTitle>
        <DialogDescription>You can change everything later. It starts as a private draft.</DialogDescription>
        <form className="grid gap-4" onSubmit={(e) => { e.preventDefault(); submit(); }}>
          <FormField label="Title" required error={error}>
            <Input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} maxLength={150} placeholder="e.g. Week 4 — Photosynthesis" />
          </FormField>
          <FormField label="Difficulty">
            <Select value={difficulty} onValueChange={(v) => setDifficulty(v as typeof difficulty)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{DIFFICULTIES.map((d) => <SelectItem key={d} value={d}>{d[0] + d.slice(1).toLowerCase()}</SelectItem>)}</SelectContent>
            </Select>
          </FormField>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" loading={create.isPending}>Create &amp; start building</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
