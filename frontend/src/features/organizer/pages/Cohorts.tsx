import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Search, UsersRound } from 'lucide-react';
import { Button, EmptyState, Input, Pagination, PageHeader, Skeleton } from '@/components/ui';
import { cohortsApi } from '@/lib/api';
import type { CohortDto } from '@/lib/api/types';
import { keys } from '@/lib/query/keys';
import { usePagedQuery } from '@/lib/query/hooks';
import { useDebounced, useDocumentTitle, useMediaQuery } from '@/lib/hooks';
import { cn } from '@/lib/utils';
import { CohortDetail } from '../components/cohorts/CohortDetail';
import { CohortFormDialog } from '../components/cohorts/CohortFormDialog';

export default function Cohorts() {
  useDocumentTitle('Cohorts');
  const [sp, setSp] = useSearchParams();
  const selected = sp.get('cohort');
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const q = useDebounced(search.trim());

  const query = { page, pageSize: 20, q: q || undefined };
  const list = usePagedQuery<CohortDto>(keys.cohorts.list(query), () => cohortsApi.list(query));
  const open = (id: string | null) => setSp(id ? { cohort: id } : {}, { replace: true });

  const newButton = <Button><Plus aria-hidden="true" /> New cohort</Button>;
  const showList = isDesktop || !selected;
  const showDetail = isDesktop || !!selected;

  return (
    <>
      <PageHeader
        eyebrow="Studio"
        title="Cohorts"
        description="Groups of participants you can assign quizzes to and compare in reports."
        actions={<CohortFormDialog trigger={newButton} onSaved={(c) => open(c.id)} />}
      />
      <div className="grid items-start gap-6 lg:grid-cols-[20rem_minmax(0,1fr)]">
        {showList && (
          <section aria-label="Your cohorts" className="grid content-start gap-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
              <Input type="search" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search cohorts" aria-label="Search cohorts" className="pl-9" />
            </div>
            {list.isPending ? (
              <div className="grid gap-2" aria-busy="true">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-16" />)}</div>
            ) : list.data && list.data.data.length === 0 ? (
              <EmptyState
                icon={<UsersRound />} title={q ? 'No matching cohorts' : 'No cohorts yet'}
                description={q ? 'Try a different name.' : 'Create one for each class or team, then add people in bulk.'}
                action={q ? undefined : <CohortFormDialog trigger={newButton} onSaved={(c) => open(c.id)} />}
              />
            ) : (
              <>
                <ul className="grid gap-2">
                  {list.data?.data.map((c) => (
                    <li key={c.id}>
                      <button
                        type="button" onClick={() => open(c.id)} aria-current={c.id === selected ? 'true' : undefined}
                        className={cn('w-full rounded-lg border bg-surface px-4 py-3 text-left hover:bg-surface-2', c.id === selected ? 'border-accent ring-1 ring-accent' : 'border-border')}
                      >
                        <span className="block truncate font-medium">{c.name}</span>
                        <span className="block text-xs text-muted"><span className="num">{c.memberCount}</span> member{c.memberCount === 1 ? '' : 's'}</span>
                      </button>
                    </li>
                  ))}
                </ul>
                <Pagination meta={list.data?.meta} onPageChange={setPage} />
              </>
            )}
          </section>
        )}
        {showDetail && (
          <div className="min-w-0">
            {selected
              ? <CohortDetail key={selected} id={selected} onBack={() => open(null)} onDeleted={() => open(null)} />
              : <EmptyState icon={<UsersRound />} title="Select a cohort" description="Pick one on the left to manage its members and see which quizzes use it." />}
          </div>
        )}
      </div>
    </>
  );
}
