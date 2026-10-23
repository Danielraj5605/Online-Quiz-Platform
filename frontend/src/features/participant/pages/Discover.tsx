import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Compass, KeyRound, Search, X } from 'lucide-react';
import { DIFFICULTIES } from '@quiz/shared';
import { catalogApi } from '@/lib/api/catalog';
import { quizzesApi } from '@/lib/api/quizzes';
import { usePagedQuery, useApiQuery } from '@/lib/query/hooks';
import { keys } from '@/lib/query/keys';
import { useDebounced, useDocumentTitle } from '@/lib/hooks';
import {
  Button, EmptyState, Input, Label, PageHeader, Pagination, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Skeleton, SkeletonGroup,
} from '@/components/ui';
import { QuizCard } from '../components/QuizCard';

const ALL = 'all';

export default function Discover() {
  useDocumentTitle('Discover');
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const categoryId = params.get('categoryId') ?? '';
  const difficulty = params.get('difficulty') ?? '';
  const tag = params.get('tag') ?? '';
  const page = Number(params.get('page') ?? 1) || 1;

  const [text, setText] = useState(q);
  const debounced = useDebounced(text, 300);
  const set = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) { if (v) next.set(k, v); else next.delete(k); }
    if (!('page' in patch)) next.delete('page');
    setParams(next, { replace: true });
  };
  useEffect(() => {
    if (debounced !== q) set({ q: debounced || null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  const cats = useApiQuery(keys.quizzes.categories, () => quizzesApi.categories(), { staleTime: 5 * 60_000 });
  const query = { page, pageSize: 12, q: q || undefined, categoryId: categoryId || undefined, difficulty: difficulty || undefined, tag: tag || undefined };
  const list = usePagedQuery(keys.catalog.list(query), () => catalogApi.list(query));
  const filtered = !!(q || categoryId || difficulty || tag);
  const clear = () => { setText(''); setParams({}, { replace: true }); };

  return (
    <>
      <PageHeader
        eyebrow="Discover"
        title="Find a quiz"
        description="Public quizzes from organizers on Quizzo. Have a private code instead?"
        actions={<Button variant="outline" asChild><Link to="/join"><KeyRound aria-hidden="true" /> Enter code</Link></Button>}
      />

      <form role="search" aria-label="Filter quizzes" className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_12rem_10rem_10rem_auto]" onSubmit={(e) => e.preventDefault()}>
        <div className="grid gap-1.5">
          <Label htmlFor="disc-q">Search</Label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
            <Input id="disc-q" type="search" className="pl-9" placeholder="Title or topic" value={text} onChange={(e) => setText(e.target.value)} />
          </div>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="disc-cat">Category</Label>
          <Select value={categoryId || ALL} onValueChange={(v) => set({ categoryId: v === ALL ? null : v })}>
            <SelectTrigger id="disc-cat"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All categories</SelectItem>
              {cats.data?.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="disc-diff">Difficulty</Label>
          <Select value={difficulty || ALL} onValueChange={(v) => set({ difficulty: v === ALL ? null : v })}>
            <SelectTrigger id="disc-diff"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Any difficulty</SelectItem>
              {DIFFICULTIES.map((d) => <SelectItem key={d} value={d}>{d[0] + d.slice(1).toLowerCase()}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="disc-tag">Tag</Label>
          <Input id="disc-tag" placeholder="e.g. algebra" value={tag} onChange={(e) => set({ tag: e.target.value || null })} />
        </div>
        {filtered && (
          <div className="flex items-end">
            <Button type="button" variant="ghost" onClick={clear}><X aria-hidden="true" /> Clear</Button>
          </div>
        )}
      </form>

      <div aria-live="polite" className="sr-only">{list.data ? `${list.data.meta.total} quizzes found` : ''}</div>

      {list.isPending ? (
        <SkeletonGroup label="Loading quizzes">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-52" />)}</div>
        </SkeletonGroup>
      ) : list.isError ? (
        <EmptyState title="Could not load quizzes" description={list.error.message} action={<Button onClick={() => void list.refetch()}>Try again</Button>} />
      ) : list.data.data.length === 0 ? (
        <EmptyState
          icon={<Compass />}
          title={filtered ? 'No quizzes match those filters' : 'No public quizzes yet'}
          description={filtered ? 'Try a different search or clear the filters.' : 'When organizers publish public quizzes they appear here. Got a private code? Use it instead.'}
          action={filtered ? <Button onClick={clear}>Clear filters</Button> : <Button asChild><Link to="/join">Enter an access code</Link></Button>}
        />
      ) : (
        <>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {list.data.data.map((quiz) => <li key={quiz.id}><QuizCard quiz={quiz} /></li>)}
          </ul>
          <Pagination meta={list.data.meta} onPageChange={(p) => set({ page: p > 1 ? String(p) : null })} />
        </>
      )}
    </>
  );
}
