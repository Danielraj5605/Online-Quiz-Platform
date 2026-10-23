import { useState } from 'react';
import { BookOpen, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { QUESTION_TYPES } from '@quiz/shared';
import {
  Badge, Button, ConfirmDialog, DataTable, Dialog, DialogContent, DialogDescription, DialogTitle, Input, PageHeader,
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue, type Column,
} from '@/components/ui';
import { bankApi, quizzesApi } from '@/lib/api';
import type { BankQuestionDto } from '@/lib/api/types';
import { keys } from '@/lib/query/keys';
import { useApiMutation, useApiQuery, usePagedQuery } from '@/lib/query/hooks';
import { useDebounced, useDocumentTitle } from '@/lib/hooks';
import { BankQuestionForm, type BankFormOut } from '../components/bank/BankQuestionForm';
import { TYPE_LABEL } from '../components/bank/labels';

export default function Bank() {
  useDocumentTitle('Question bank');
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState('-createdAt');
  const [search, setSearch] = useState('');
  const q = useDebounced(search.trim());
  const [type, setType] = useState('all');
  const [categoryId, setCategoryId] = useState('all');
  const [tag, setTag] = useState('');
  const tagQ = useDebounced(tag.trim().toLowerCase());
  const [editing, setEditing] = useState<BankQuestionDto | 'new' | null>(null);

  const query = { page, pageSize: 15, sort, q: q || undefined, type: type === 'all' ? undefined : type, categoryId: categoryId === 'all' ? undefined : categoryId, tag: tagQ || undefined };
  const list = usePagedQuery<BankQuestionDto>(keys.bank.list(query), () => bankApi.list(query));
  const categories = useApiQuery(keys.quizzes.categories, () => quizzesApi.categories());
  const catName = (id: string | null) => categories.data?.find((c) => c.id === id)?.name;

  const save = useApiMutation(
    (v: BankFormOut) => (editing && editing !== 'new' ? bankApi.update(editing.id, v) : bankApi.create(v)),
    { invalidate: [keys.bank.all], success: 'Saved to the bank', onSuccess: () => setEditing(null) },
  );
  const remove = useApiMutation((id: string) => bankApi.remove(id), {
    invalidate: [keys.bank.all], success: 'Question removed',
    optimistic: {
      key: keys.bank.list(query),
      update: (old, id) => {
        const o = old as { data: BankQuestionDto[]; meta: unknown } | undefined;
        return o ? { ...o, data: o.data.filter((x) => x.id !== id) } : old;
      },
    },
  });

  const filtered = q || type !== 'all' || categoryId !== 'all' || tagQ;
  const columns: Column<BankQuestionDto>[] = [
    { key: 'text', header: 'Question', primary: true, cell: (r) => <span className="line-clamp-2 max-w-xl break-words font-medium">{r.text}</span> },
    { key: 'type', header: 'Type', sortKey: 'type', cell: (r) => <Badge tone="teal">{TYPE_LABEL[r.type]}</Badge> },
    { key: 'points', header: 'Points', sortKey: 'points', cell: (r) => <span className="num">{r.points}</span> },
    { key: 'category', header: 'Category', hideOnMobile: true, cell: (r) => catName(r.categoryId) ?? <span className="text-muted">—</span> },
    {
      key: 'tags', header: 'Tags', hideOnMobile: true,
      cell: (r) => r.tags.length ? <span className="flex flex-wrap gap-1">{r.tags.slice(0, 3).map((t) => <Badge key={t}>{t}</Badge>)}{r.tags.length > 3 && <span className="text-xs text-muted">+{r.tags.length - 3}</span>}</span> : <span className="text-muted">—</span>,
    },
    {
      key: 'actions', header: 'Actions', className: 'text-right',
      cell: (r) => (
        <span className="flex justify-end gap-1">
          <Button variant="ghost" size="icon-sm" onClick={() => setEditing(r)} aria-label="Edit question"><Pencil aria-hidden="true" /></Button>
          <ConfirmDialog
            trigger={<Button variant="ghost" size="icon-sm" aria-label="Delete question"><Trash2 aria-hidden="true" /></Button>}
            title="Delete this question?" description="It is removed from your bank. Quizzes that already imported it keep their own copy."
            confirmLabel="Delete" destructive onConfirm={() => remove.mutateAsync(r.id)}
          />
        </span>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Studio"
        title="Question bank"
        description="Reusable questions you can drop into any quiz from the builder."
        actions={<Button onClick={() => setEditing('new')}><Plus aria-hidden="true" /> New question</Button>}
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
          <Input type="search" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search questions" aria-label="Search questions" className="pl-9" />
        </div>
        <Select value={type} onValueChange={(v) => { setType(v); setPage(1); }}>
          <SelectTrigger aria-label="Filter by type"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {QUESTION_TYPES.map((t) => <SelectItem key={t} value={t}>{TYPE_LABEL[t]}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={categoryId} onValueChange={(v) => { setCategoryId(v); setPage(1); }}>
          <SelectTrigger aria-label="Filter by category"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categories.data?.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input value={tag} onChange={(e) => { setTag(e.target.value); setPage(1); }} placeholder="Filter by tag" aria-label="Filter by tag" />
      </div>

      <DataTable
        caption="Question bank"
        columns={columns} rows={list.data?.data} getRowId={(r) => r.id} loading={list.isPending}
        sort={sort} onSortChange={(s) => { setSort(s); setPage(1); }}
        meta={list.data?.meta} onPageChange={setPage}
        empty={filtered
          ? { title: 'No matching questions', description: 'Try clearing a filter.', icon: <BookOpen /> }
          : { title: 'Your bank is empty', description: 'Save questions here once and reuse them across quizzes.', icon: <BookOpen />, action: <Button onClick={() => setEditing('new')}><Plus aria-hidden="true" /> Add the first question</Button> }}
      />

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogTitle>{editing === 'new' ? 'New bank question' : 'Edit bank question'}</DialogTitle>
          <DialogDescription>Answers are checked the same way as in a quiz.</DialogDescription>
          {editing && (
            <BankQuestionForm
              key={editing === 'new' ? 'new' : editing.id}
              question={editing === 'new' ? undefined : editing}
              categories={categories.data ?? []}
              submitting={save.isPending}
              onSubmit={(v) => save.mutate(v)}
              onCancel={() => setEditing(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
