import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueries } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, Trash2, UserMinus, UserPlus } from 'lucide-react';
import {
  Avatar, Badge, Button, ConfirmDialog, EmptyState, FormField, Skeleton, StatusBadge, Textarea,
} from '@/components/ui';
import { cohortsApi, quizzesApi } from '@/lib/api';
import type { CohortDetailDto } from '@/lib/api/types';
import { keys } from '@/lib/query/keys';
import { useApiMutation, useApiQuery } from '@/lib/query/hooks';
import { fmtDate } from '@/lib/utils';
import { CohortFormDialog } from './CohortFormDialog';
import { parseIdentifiers } from './identifiers';

export function CohortDetail({ id, onBack, onDeleted }: { id: string; onBack: () => void; onDeleted: () => void }) {
  const { data, isPending } = useApiQuery(keys.cohorts.detail(id), () => cohortsApi.get(id));
  const [text, setText] = useState('');
  const [missing, setMissing] = useState<string[]>([]);
  const ids = parseIdentifiers(text);

  const add = useApiMutation(() => cohortsApi.addMembers(id, ids), {
    invalidate: [keys.cohorts.all, keys.reports.all],
    onSuccess: (r) => {
      setText('');
      setMissing(r.notFound);
      if (r.added) toast.success(`Added ${r.added} member${r.added === 1 ? '' : 's'}`);
      else if (!r.notFound.length) toast.message('Everyone listed was already a member');
    },
  });
  const removeMember = useApiMutation((userId: string) => cohortsApi.removeMember(id, userId), {
    invalidate: [keys.cohorts.all, keys.reports.all], success: 'Member removed',
    optimistic: {
      key: keys.cohorts.detail(id),
      update: (old, userId) => {
        const o = old as CohortDetailDto | undefined;
        return o ? { ...o, memberCount: o.memberCount - 1, members: o.members.filter((m) => m.id !== userId) } : old;
      },
    },
  });
  const removeCohort = useApiMutation(() => cohortsApi.remove(id), { invalidate: [keys.cohorts.all], success: 'Cohort deleted', onSuccess: onDeleted });

  // quizzes assigned to this cohort — the API exposes this per quiz (GET /quizzes/:id/access)
  const quizzes = useApiQuery(keys.quizzes.list({ mine: true, pageSize: 100, forCohort: true }), () => quizzesApi.list({ mine: true, pageSize: 100 }));
  const access = useQueries({
    queries: (quizzes.data?.data ?? []).map((qz) => ({ queryKey: keys.quizzes.access(qz.id), queryFn: () => quizzesApi.getAccess(qz.id), staleTime: 30_000 })),
  });
  const assigned = (quizzes.data?.data ?? []).filter((_, i) => access[i]?.data?.cohorts.some((c) => c.id === id));
  const loadingAssigned = quizzes.isPending || access.some((a) => a.isPending);

  if (isPending || !data) return <div className="grid gap-4" aria-busy="true"><Skeleton className="h-24" /><Skeleton className="h-64" /></div>;

  return (
    <div className="grid gap-6">
      <header className="flex flex-wrap items-start gap-3">
        <Button variant="ghost" size="sm" className="lg:hidden" onClick={onBack}><ArrowLeft aria-hidden="true" /> Cohorts</Button>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-2xl font-semibold">{data.name}</h2>
          {data.description && <p className="mt-1 text-muted">{data.description}</p>}
          <p className="mt-1 text-xs text-muted"><span className="num">{data.memberCount}</span> member{data.memberCount === 1 ? '' : 's'} · created {fmtDate(data.createdAt, { dateStyle: 'medium' })}</p>
        </div>
        <div className="flex gap-2">
          <CohortFormDialog cohort={data} />
          <ConfirmDialog
            trigger={<Button variant="outline" size="sm"><Trash2 aria-hidden="true" /> Delete</Button>}
            title={`Delete “${data.name}”?`}
            description="Members lose access to quizzes assigned only through this cohort. Past results are kept."
            confirmLabel="Delete cohort" destructive onConfirm={() => removeCohort.mutateAsync()}
          />
        </div>
      </header>

      <section aria-labelledby="add-h" className="rounded-lg border border-border bg-surface p-5">
        <h3 id="add-h" className="font-display text-lg font-semibold">Add members</h3>
        <form className="mt-3 grid gap-3" onSubmit={(e) => { e.preventDefault(); if (ids.length) add.mutate(); }}>
          <FormField label="Usernames or emails" hint="Paste a list — separate with commas, spaces or new lines. Up to 500 at once.">
            <Textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder={'learner01\nlearner02@school.org'} />
          </FormField>
          {missing.length > 0 && (
            <p role="status" className="rounded-md bg-warning-soft p-3 text-sm text-warning">
              No account found for: <span className="font-medium">{missing.join(', ')}</span>
            </p>
          )}
          <div className="flex items-center gap-3">
            <Button type="submit" loading={add.isPending} disabled={ids.length === 0}><UserPlus aria-hidden="true" /> Add {ids.length > 0 ? <span className="num">{ids.length}</span> : ''} {ids.length === 1 ? 'person' : 'people'}</Button>
          </div>
        </form>
      </section>

      <section aria-labelledby="mem-h">
        <h3 id="mem-h" className="mb-3 font-display text-lg font-semibold">Members</h3>
        {data.members.length === 0 ? (
          <EmptyState title="No members yet" description="Add people above and assign this cohort to a quiz from its Access settings." />
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border bg-surface">
            {data.members.map((m) => (
              <li key={m.id} className="flex items-center gap-3 px-4 py-2.5">
                <Avatar name={m.name ?? m.username} src={m.avatarUrl} size={32} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{m.name ?? m.username}</p>
                  <p className="truncate text-xs text-muted">@{m.username} · {m.email}</p>
                </div>
                <ConfirmDialog
                  trigger={<Button variant="ghost" size="icon-sm" aria-label={`Remove ${m.name ?? m.username}`}><UserMinus aria-hidden="true" /></Button>}
                  title={`Remove ${m.name ?? m.username}?`} description="They keep their past results but lose cohort-based access."
                  confirmLabel="Remove" destructive onConfirm={() => removeMember.mutateAsync(m.id)}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="asg-h">
        <h3 id="asg-h" className="mb-3 font-display text-lg font-semibold">Assigned quizzes</h3>
        {loadingAssigned ? <Skeleton className="h-16" /> : assigned.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border-strong p-4 text-sm text-muted">Not assigned to any quiz yet. Open a quiz in the builder and choose this cohort under Access.</p>
        ) : (
          <ul className="grid gap-2">
            {assigned.map((qz) => (
              <li key={qz.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3">
                <Link to={`/studio/quizzes/${qz.id}/build`} className="min-w-0 flex-1 truncate font-medium hover:underline">{qz.title}</Link>
                <StatusBadge status={qz.status} />
                <Badge><span className="num">{qz.questionCount}</span> questions</Badge>
                <Button asChild variant="ghost" size="sm"><Link to={`/studio/quizzes/${qz.id}/reports?tab=cohorts`}>Results</Link></Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
