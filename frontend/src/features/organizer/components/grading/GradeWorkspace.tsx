import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, ChevronDown, ChevronUp, Save } from 'lucide-react';
import type { PageMeta } from '@quiz/shared';
import { Button, EmptyState, Progress, Skeleton } from '@/components/ui';
import { gradingApi } from '@/lib/api';
import type { GradingAttemptDto, GradingSubmission } from '@/lib/api/types';
import { keys } from '@/lib/query/keys';
import { useApiMutation, useApiQuery, usePagedQuery } from '@/lib/query/hooks';
import { useDebounced, useMediaQuery } from '@/lib/hooks';
import { GradePanel, type GradePanelHandle } from './GradePanel';
import { SubmissionQueue, type QueueStatus } from './SubmissionQueue';
import { BulkGradeDialog } from './BulkGradeDialog';
import { ShortcutHelp } from './ShortcutHelp';
import { useGradingShortcuts, type GradingAction } from './shortcuts';

type Paged = { data: GradingSubmission[]; meta: PageMeta };
const PAGE_SIZE = 20;

export function GradeWorkspace({ quizId }: { quizId: string }) {
  const qc = useQueryClient();
  const [sp, setSp] = useSearchParams();
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const status = (['pending', 'graded', 'all'].includes(sp.get('status') ?? '') ? sp.get('status') : 'pending') as QueueStatus;
  const attemptId = sp.get('attempt');
  const [search, setSearch] = useState('');
  const q = useDebounced(search.trim());
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [helpOpen, setHelpOpen] = useState(false);
  const panel = useRef<GradePanelHandle>(null);

  const setParams = (next: Record<string, string | null>) =>
    setSp((cur) => {
      const p = new URLSearchParams(cur);
      for (const [k, v] of Object.entries(next)) {
        if (v === null) p.delete(k);
        else p.set(k, v);
      }
      return p;
    }, { replace: true });

  const list = usePagedQuery<GradingSubmission>(
    keys.grading.submissions(quizId, { status, q, page }),
    () => gradingApi.submissions(quizId, { status, q: q || undefined, page, pageSize: PAGE_SIZE }),
  );
  const rows = list.data?.data;
  const ids = useMemo(() => rows?.map((r) => r.attemptId) ?? [], [rows]);

  // overall progress: how many submissions with written answers are done
  const pendingTotal = useApiQuery(keys.grading.submissions(quizId, { count: 'pending' }), () => gradingApi.submissions(quizId, { status: 'pending', pageSize: 1 }).then((r) => r.meta.total));
  const allTotal = useApiQuery(keys.grading.submissions(quizId, { count: 'all' }), () => gradingApi.submissions(quizId, { status: 'all', pageSize: 1 }).then((r) => r.meta.total));
  const total = allTotal.data ?? 0;
  const done = Math.max(0, total - (pendingTotal.data ?? 0));

  // on desktop open the first submission automatically
  useEffect(() => {
    if (isDesktop && !attemptId && ids.length) setParams({ attempt: ids[0]! });
  }, [isDesktop, attemptId, ids]); // eslint-disable-line react-hooks/exhaustive-deps

  const attempt = useApiQuery(keys.grading.attempt(attemptId ?? ''), () => gradingApi.attempt(attemptId!), { enabled: !!attemptId });

  const save = useApiMutation(
    (grades: NonNullable<ReturnType<GradePanelHandle['collect']>>['grades']) => {
      // optimistic: reflect the new pending counts in the queue immediately
      qc.setQueriesData<Paged>({ queryKey: ['grading', 'submissions', quizId] }, (old) => {
        if (!old || !Array.isArray(old.data)) return old;
        return {
          ...old,
          data: old.data.map((r) => {
            if (r.attemptId !== attemptId) return r;
            const pendingCount = Math.max(0, r.pendingCount - grades.length);
            return { ...r, pendingCount, status: pendingCount === 0 ? 'GRADED' : r.status };
          }),
        };
      });
      return gradingApi.grade(attemptId!, { grades });
    },
    {
      invalidate: [keys.grading.all, keys.reports.all, keys.organizer.dashboard],
      optimistic: {
        key: keys.grading.attempt(attemptId ?? ''),
        update: (old, grades) => {
          const a = old as GradingAttemptDto | undefined;
          if (!a) return old;
          const by = new Map(grades.map((g) => [g.answerId, g]));
          return {
            ...a,
            items: a.items.map((i) => {
              const g = i.answerId ? by.get(i.answerId) : undefined;
              return g && i.grade ? { ...i, grade: { ...i.grade, manualScore: g.score, feedback: g.feedback, effective: g.score } } : i;
            }),
          };
        },
      },
    },
  );

  const idx = attemptId ? ids.indexOf(attemptId) : -1;
  const open = (id: string | null) => setParams({ attempt: id });
  const step = (dir: 1 | -1) => {
    const target = ids[idx + dir];
    if (target) open(target);
    else if (dir === 1 && list.data && list.data.meta.page < list.data.meta.totalPages) setPage((p) => p + 1);
  };

  const saveAndNext = async () => {
    if (!attemptId || save.isPending) return;
    const res = panel.current?.collect();
    if (!res) return;
    if (res.error) { toast.error(res.error); return; }
    // neighbour computed before the save, because a fully graded submission leaves the pending list
    const nextId = ids[idx + 1] ?? ids[idx - 1] ?? null;
    if (res.grades.length === 0) {
      if (nextId && nextId !== attemptId) open(nextId); else toast.message('Nothing new to save');
      return;
    }
    try {
      const r = await save.mutateAsync(res.grades);
      toast.success(r.isFinal ? `Fully graded · ${Math.round(r.percentage)}%` : 'Saved');
      if (status === 'pending' && nextId) open(nextId);
      else if (status !== 'pending' && ids[idx + 1]) open(ids[idx + 1]!);
    } catch (e) {
      void e; // the global mutation handler has already shown the error
    }
  };

  useGradingShortcuts((a: GradingAction) => {
    if (a.type === 'next') step(1);
    else if (a.type === 'prev') step(-1);
    else if (a.type === 'save') void saveAndNext();
    else if (a.type === 'help') setHelpOpen(true);
    else panel.current?.applyLevel(a.value);
  }, !helpOpen);

  const queue = (
    <div className={isDesktop ? 'lg:sticky lg:top-4 lg:max-h-[calc(100dvh-8rem)] lg:overflow-y-auto lg:pr-1' : ''}>
      <SubmissionQueue
        rows={rows} meta={list.data?.meta} loading={list.isPending}
        status={status}
        onStatusChange={(s) => { setPage(1); setSelected(new Set()); setParams({ status: s, attempt: null }); }}
        search={search} onSearchChange={(s) => { setSearch(s); setPage(1); }}
        onPageChange={setPage}
        activeId={attemptId} onOpen={open}
        selected={selected}
        onToggle={(id) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; })}
        onTogglePage={(pageIds, on) => setSelected((s) => { const n = new Set(s); pageIds.forEach((i) => (on ? n.add(i) : n.delete(i))); return n; })}
      />
    </div>
  );

  const detail = !attemptId ? (
    <EmptyState title="Pick a submission" description="Choose someone from the queue to start grading. Use J and K to move through the list." />
  ) : attempt.isPending ? (
    <div className="grid gap-4" aria-busy="true"><Skeleton className="h-24" /><Skeleton className="h-72" /></div>
  ) : attempt.data ? (
    <GradePanel key={attemptId} ref={panel} attempt={attempt.data} />
  ) : (
    <EmptyState title="Could not load this submission" description="It may have been removed. Pick another from the queue." />
  );

  const showQueue = isDesktop || !attemptId;
  const showDetail = isDesktop || !!attemptId;

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-surface p-3">
        <div className="min-w-48 flex-1">
          <p className="mb-1 flex justify-between text-xs text-muted">
            <span>Quiz grading progress</span>
            <span className="num" aria-live="polite">{done} of {total} submissions graded</span>
          </p>
          <Progress value={done} max={Math.max(1, total)} label="Submissions graded" tone="success" />
        </div>
        <BulkGradeDialog quizId={quizId} attemptIds={[...selected]} onDone={() => setSelected(new Set())} />
        <ShortcutHelp open={helpOpen} onOpenChange={setHelpOpen} />
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[22rem_minmax(0,1fr)]">
        {showQueue && queue}
        {showDetail && (
          <div className="grid min-w-0 gap-4">
            {attemptId && (
              <div className="sticky top-0 z-10 -mx-1 flex flex-wrap items-center gap-2 bg-bg/95 px-1 py-2 backdrop-blur">
                {!isDesktop && (
                  <Button variant="ghost" size="sm" onClick={() => open(null)}><ArrowLeft aria-hidden="true" /> Queue</Button>
                )}
                <div className="ml-auto flex items-center gap-1">
                  <Button variant="outline" size="icon-sm" onClick={() => step(-1)} disabled={idx <= 0} aria-label="Previous submission (K)"><ChevronUp aria-hidden="true" /></Button>
                  <Button variant="outline" size="icon-sm" onClick={() => step(1)} disabled={idx < 0 || (idx >= ids.length - 1 && !(list.data && list.data.meta.page < list.data.meta.totalPages))} aria-label="Next submission (J)"><ChevronDown aria-hidden="true" /></Button>
                  <Button onClick={() => void saveAndNext()} loading={save.isPending} size="sm"><Save aria-hidden="true" /> Save &amp; next</Button>
                </div>
              </div>
            )}
            {detail}
          </div>
        )}
      </div>
    </div>
  );
}
