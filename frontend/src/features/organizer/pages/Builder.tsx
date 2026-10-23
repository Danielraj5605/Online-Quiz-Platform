import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Archive, BarChart3, ClipboardCheck, Copy, Lock, MoreHorizontal, Radio, Redo2, Rocket, RotateCcw, Undo2 } from 'lucide-react';
import type { QuizDetailDto } from '@quiz/shared';
import {
  Badge, Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, EmptyState, Skeleton,
  StatusBadge, Tabs, TabsContent, TabsList, TabsTrigger, Tooltip, TooltipContent, TooltipTrigger,
} from '@/components/ui';
import { quizzesApi } from '@/lib/api';
import { keys } from '@/lib/query/keys';
import { useApiMutation } from '@/lib/query/hooks';
import { useDocumentTitle } from '@/lib/hooks';
import { BuilderProvider, useBuilder } from '../components/builder/BuilderProvider';
import { QuestionsTab } from '../components/builder/QuestionsTab';
import { SettingsTab } from '../components/builder/SettingsTab';
import { AccessTab } from '../components/builder/AccessTab';
import { PreviewTab } from '../components/builder/PreviewTab';
import { PublishDialog } from '../components/builder/PublishDialog';
import { VersionsPanel } from '../components/builder/VersionsPanel';
import { SaveIndicator } from '../components/builder/save-state';

const isTyping = (t: EventTarget | null) => {
  const el = t as HTMLElement | null;
  return !!el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName));
};

export default function Builder() {
  const { id = '' } = useParams();
  return (
    <BuilderProvider
      key={id}
      id={id}
      fallback={({ loading, error }) => loading ? (
        <div className="grid gap-4"><Skeleton className="h-10 w-72" /><Skeleton className="h-11 w-full" /><Skeleton className="h-40" /><Skeleton className="h-40" /></div>
      ) : (
        <EmptyState title="Quiz not found" description={error?.message ?? "It may have been deleted, or it belongs to another organizer."} action={<Button asChild><Link to="/studio/quizzes">Back to quizzes</Link></Button>} />
      )}
    >
      {(quiz) => <BuilderView quiz={quiz} />}
    </BuilderProvider>
  );
}

function BuilderView({ quiz }: { quiz: QuizDetailDto }) {
  const { id, save, history, actions } = useBuilder();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') ?? 'questions';
  const [confirmUnload, setConfirmUnload] = useState(false);
  useDocumentTitle(`${quiz.title} · Builder`);

  // Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z, Ctrl+Y — but leave text-field undo alone
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || isTyping(e.target)) return;
      const k = e.key.toLowerCase();
      if (k === 'z' && !e.shiftKey) { e.preventDefault(); void actions.undo(); }
      else if ((k === 'z' && e.shiftKey) || k === 'y') { e.preventDefault(); void actions.redo(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [actions]);

  // don't lose a pending debounce or in-flight save by closing the tab
  useEffect(() => {
    setConfirmUnload(save.status === 'saving');
  }, [save.status]);
  useEffect(() => {
    if (!confirmUnload) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [confirmUnload]);

  const lifecycle = (fn: () => Promise<QuizDetailDto>, success: string) => async () => {
    await actions.flushAll();
    const dto = await fn();
    qc.setQueryData<QuizDetailDto>(keys.quizzes.detail(id), dto);
    void qc.invalidateQueries({ queryKey: ['quizzes', 'list'] });
    void qc.invalidateQueries({ queryKey: keys.organizer.dashboard });
    (await import('sonner')).toast.success(success);
  };
  const close = useApiMutation(lifecycle(() => quizzesApi.close(id), 'Quiz closed'));
  const archive = useApiMutation(lifecycle(() => quizzesApi.archive(id), 'Quiz archived'));
  const reopen = useApiMutation(lifecycle(() => quizzesApi.reopen(id), 'Quiz reopened'));
  const duplicate = useApiMutation(() => quizzesApi.duplicate(id), { invalidate: [['quizzes', 'list']], success: 'Copied as a new draft', onSuccess: (d) => nav(`/studio/quizzes/${d.id}/build`) });

  const published = quiz.currentVersion != null;
  const active = quiz.status === 'LIVE' || quiz.status === 'SCHEDULED';
  const ended = quiz.status === 'CLOSED' || quiz.status === 'ARCHIVED';
  const hasAttempts = quiz.attemptCount > 0;

  return (
    <>
      <Link to="/studio/quizzes" className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-text"><ArrowLeft className="size-4" aria-hidden="true" /> All quizzes</Link>

      <header className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="mb-1 text-xs font-medium uppercase tracking-[0.14em] text-accent">Quiz builder</p>
          <h1 className="text-3xl font-semibold sm:text-4xl">{quiz.title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <StatusBadge status={quiz.status} />
            {published && <Badge>v<span className="num">{quiz.currentVersion}</span></Badge>}
            {quiz.dirty && <Badge tone="warning">Unpublished changes</Badge>}
            <SaveIndicator status={save.status} at={save.at} error={save.error} />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center" role="group" aria-label="Undo and redo">
            <Tooltip><TooltipTrigger asChild>
              <Button variant="outline" size="icon" aria-label={`Undo${history.undoLabel ? ` ${history.undoLabel}` : ''}`} disabled={!history.canUndo} onClick={() => void actions.undo()} className="rounded-r-none"><Undo2 /></Button>
            </TooltipTrigger><TooltipContent>{history.undoLabel ? `Undo ${history.undoLabel}` : 'Nothing to undo'} (Ctrl+Z)</TooltipContent></Tooltip>
            <Tooltip><TooltipTrigger asChild>
              <Button variant="outline" size="icon" aria-label={`Redo${history.redoLabel ? ` ${history.redoLabel}` : ''}`} disabled={!history.canRedo} onClick={() => void actions.redo()} className="-ml-px rounded-l-none"><Redo2 /></Button>
            </TooltipTrigger><TooltipContent>{history.redoLabel ? `Redo ${history.redoLabel}` : 'Nothing to redo'} (Ctrl+Shift+Z)</TooltipContent></Tooltip>
          </div>

          <VersionsPanel />

          {quiz.status === 'DRAFT' && <PublishDialog republish={false} trigger={<Button><Rocket aria-hidden="true" /> Publish</Button>} />}
          {active && quiz.dirty && <PublishDialog republish trigger={<Button><Rocket aria-hidden="true" /> Publish changes</Button>} />}
          {active && !quiz.dirty && <Button variant="secondary" disabled><Lock aria-hidden="true" /> Published</Button>}
          {ended && <Button variant="secondary" loading={reopen.isPending} onClick={() => reopen.mutate()}><RotateCcw aria-hidden="true" /> Reopen</Button>}

          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button variant="outline" size="icon" aria-label="More actions"><MoreHorizontal /></Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {(active || quiz.status === 'CLOSED') && <DropdownMenuItem onSelect={() => nav(`/studio/quizzes/${id}/monitor`)}><Radio className="size-4" aria-hidden="true" /> Live monitor</DropdownMenuItem>}
              {hasAttempts && <DropdownMenuItem onSelect={() => nav(`/studio/quizzes/${id}/grading`)}><ClipboardCheck className="size-4" aria-hidden="true" /> Grading</DropdownMenuItem>}
              {hasAttempts && <DropdownMenuItem onSelect={() => nav(`/studio/quizzes/${id}/reports`)}><BarChart3 className="size-4" aria-hidden="true" /> Reports</DropdownMenuItem>}
              <DropdownMenuItem onSelect={() => duplicate.mutate()}><Copy className="size-4" aria-hidden="true" /> Duplicate</DropdownMenuItem>
              {(active || quiz.status === 'DRAFT' || quiz.status === 'CLOSED') && <DropdownMenuSeparator />}
              {active && <DropdownMenuItem onSelect={() => close.mutate()}>Close quiz now</DropdownMenuItem>}
              {quiz.status !== 'ARCHIVED' && <DropdownMenuItem onSelect={() => archive.mutate()}><Archive className="size-4" aria-hidden="true" /> Archive</DropdownMenuItem>}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {active && (
        <p className="mb-4 rounded-md bg-teal-soft px-3 py-2 text-sm text-teal" role="note">
          This quiz is {quiz.status === 'LIVE' ? 'live' : 'scheduled'}. Edits are saved to a draft and reach participants only when you choose “Publish changes”.
        </p>
      )}

      <Tabs value={tab} onValueChange={(v) => { params.set('tab', v); setParams(params, { replace: true }); }}>
        <TabsList aria-label="Builder sections">
          <TabsTrigger value="questions">Questions <span className="num ml-1 text-xs text-muted">{quiz.questions.length}</span></TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="access">Access</TabsTrigger>
          <TabsTrigger value="preview">Preview</TabsTrigger>
        </TabsList>
        <TabsContent value="questions"><QuestionsTab /></TabsContent>
        <TabsContent value="settings"><SettingsTab /></TabsContent>
        <TabsContent value="access"><AccessTab /></TabsContent>
        <TabsContent value="preview"><PreviewTab /></TabsContent>
      </Tabs>
    </>
  );
}
