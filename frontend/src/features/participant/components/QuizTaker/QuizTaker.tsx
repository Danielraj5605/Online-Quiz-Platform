import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Flag, HelpCircle, LayoutGrid, LogOut, Send } from 'lucide-react';
import { toast } from 'sonner';
import type { AttemptViewDto } from '@quiz/shared';
import { attemptsApi } from '@/lib/api/attempts';
import { ApiError } from '@/lib/api/client';
import { keys } from '@/lib/query/keys';
import { useOnline } from '@/lib/hooks';
import { cn } from '@/lib/utils';
import { Button, ConfirmDialog, Dialog, DialogContent, DialogTitle, Progress, Timer } from '@/components/ui';
import { answerReducer, isAnswered, summarize, type AnswerAction, type AnswerMap } from './answerState';
import { SaveQueue, type PendingItem, type SaveStatus } from './saveQueue';
import { QuestionView } from './QuestionView';
import { Navigator } from './Navigator';
import { SaveIndicator } from './SaveIndicator';
import { ExpiredDialog, ShortcutsDialog, SubmitDialog } from './Dialogs';

const initialAnswers = (a: AttemptViewDto['answers']): AnswerMap => answerReducer({}, { type: 'init', answers: a });

export function QuizTaker({ attempt }: { attempt: AttemptViewDto }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const online = useOnline();
  const questions = attempt.questions;
  const ids = useMemo(() => questions.map((q) => q.id), [questions]);

  const [answers, setAnswers] = useState<AnswerMap>(() => initialAnswers(attempt.answers));
  const answersRef = useRef(answers);
  const [current, setCurrent] = useState(0);
  const [save, setSave] = useState<{ status: SaveStatus; pending: number }>({ status: 'idle', pending: 0 });
  const [sheet, setSheet] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);
  const qStart = useRef(0);

  // ── autosave queue (one per attempt) ───────────────────────────────────
  const [queue] = useState(() => new SaveQueue({
    attemptId: attempt.id,
    save: (items) => attemptsApi.saveAnswers(attempt.id, { answers: items }),
    onStatus: (status, pending) => setSave({ status, pending }),
  }));

  const apply = useCallback((action: AnswerAction, enqueueId?: string) => {
    const next = answerReducer(answersRef.current, action);
    answersRef.current = next;
    setAnswers(next);
    if (enqueueId && next[enqueueId]) {
      const e = next[enqueueId];
      queue.enqueue({ questionId: enqueueId, value: e.value, flagged: e.flagged, timeSpentMs: e.timeSpentMs });
    }
  }, [queue]);

  // restore unsent answers from a previous session (reload / crash / offline) and push them
  useEffect(() => {
    qStart.current = Date.now();
    const restored = queue.restored();
    if (restored.length) { apply({ type: 'restore', items: restored }); void queue.flush(); }
    return () => queue.dispose();
  }, [queue, apply]);

  useEffect(() => { if (online) queue.notifyOnline(); }, [online, queue]);

  /** Adds the time spent on the current question to its answer and queues it. */
  const commitTime = useCallback((index: number) => {
    const q = questions[index];
    const ms = Date.now() - qStart.current;
    qStart.current = Date.now();
    if (q && ms > 300) apply({ type: 'addTime', questionId: q.id, ms }, answersRef.current[q.id] ? q.id : undefined);
  }, [apply, questions]);

  const goTo = useCallback((i: number) => {
    const n = Math.min(questions.length - 1, Math.max(0, i));
    if (n === current) return;
    commitTime(current);
    setCurrent(n);
    setSheet(false);
    void queue.flush();
  }, [commitTime, current, queue, questions.length]);

  // move focus to the question heading when the question changes (not on first paint)
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    headingRef.current?.focus({ preventScroll: false });
    window.scrollTo({ top: 0 });
  }, [current]);

  // ── submit ────────────────────────────────────────────────────────────
  const submit = useCallback(async (auto = false) => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    commitTime(current);
    // final flush rides along with the submit so offline/unsent answers are not lost
    const all: PendingItem[] = Object.entries(answersRef.current)
      .filter(([, e]) => isAnswered(e.value) || e.flagged)
      .slice(0, 200)
      .map(([questionId, e]) => ({ questionId, value: e.value, flagged: e.flagged, timeSpentMs: e.timeSpentMs }));
    try {
      await attemptsApi.submit(attempt.id, all.length ? all : undefined);
      queue.clear();
      void qc.invalidateQueries({ queryKey: keys.attempts.all });
      void qc.invalidateQueries({ queryKey: keys.catalog.all });
      void qc.invalidateQueries({ queryKey: keys.gamification.me });
      if (auto) toast.info('Time is up — your answers were submitted.');
      navigate(`/results/${attempt.id}`, { replace: true });
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        // already submitted/expired server-side: the result page is the right place
        queue.clear();
        navigate(`/results/${attempt.id}`, { replace: true });
        return;
      }
      submittingRef.current = false;
      setSubmitting(false);
    }
  }, [attempt.id, commitTime, current, navigate, qc, queue]);

  const submitRef = useRef(submit);
  useEffect(() => { submitRef.current = submit; });
  const onExpire = useCallback(() => { void submitRef.current(true); }, []);

  // server said the attempt is over (late save): show the dialog instead of silently failing
  const expired = save.status === 'expired';

  // ── integrity signals: tab switches / time away ────────────────────────
  useEffect(() => {
    const send = (type: 'blur' | 'focus' | 'hidden' | 'visible', awaySec?: number) => { void attemptsApi.event(attempt.id, { type, awaySec }).catch(() => undefined); };
    let hiddenAt: number | null = null;
    let blurAt: number | null = null;
    const onVis = () => {
      if (document.hidden) { hiddenAt = Date.now(); send('hidden'); void queue.flush(); }
      else if (hiddenAt) { send('visible', Math.round((Date.now() - hiddenAt) / 1000)); hiddenAt = null; }
    };
    const onBlur = () => setTimeout(() => { if (!document.hidden && !blurAt) { blurAt = Date.now(); send('blur'); } }, 60);
    const onFocus = () => { if (blurAt) { send('focus', Math.round((Date.now() - blurAt) / 1000)); blurAt = null; } void queue.flush(); };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('blur', onBlur);
    window.addEventListener('focus', onFocus);
    return () => { document.removeEventListener('visibilitychange', onVis); window.removeEventListener('blur', onBlur); window.removeEventListener('focus', onFocus); };
  }, [attempt.id, queue]);

  // ── handlers bound to the current question ─────────────────────────────
  const q = questions[current]!;
  const multi = q.type === 'MCQ_MULTI';
  const hasOptions = q.options.length > 0;
  const entry = answers[q.id];
  const select = useCallback((optionId: string) => apply({ type: 'selectOption', questionId: q.id, optionId, multi }, q.id), [apply, multi, q.id]);
  const toggleFlag = useCallback(() => apply({ type: 'toggleFlag', questionId: q.id }, q.id), [apply, q.id]);
  const summary = useMemo(() => summarize(ids, answers), [ids, answers]);
  const openSummary = useCallback(() => { commitTime(current); void queue.flush(); setSummaryOpen(true); }, [commitTime, current, queue]);

  // ── keyboard: works without a mouse; never fires while typing ──────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest('[role="dialog"], [role="alertdialog"]')) return;
      if (e.ctrlKey || e.metaKey) { if (e.key === 'Enter') { e.preventDefault(); openSummary(); } return; }
      if (e.altKey) return;
      const tag = t?.tagName;
      const inputType = tag === 'INPUT' ? (t as HTMLInputElement).type : '';
      const typing = tag === 'TEXTAREA' || tag === 'SELECT' || t?.isContentEditable || (tag === 'INPUT' && !['radio', 'checkbox', 'button'].includes(inputType));
      if (typing) return;
      const k = e.key.toLowerCase();
      if (k === 'arrowleft' || k === 'p') { e.preventDefault(); goTo(current - 1); }
      else if (k === 'arrowright' || k === 'n') { e.preventDefault(); goTo(current + 1); }
      else if (k === 'f') { e.preventDefault(); toggleFlag(); }
      else if (k === '?') { e.preventDefault(); setHelpOpen(true); }
      else if (hasOptions) {
        const idx = /^[1-9]$/.test(k) ? Number(k) - 1 : /^[a-e]$/.test(k) ? k.charCodeAt(0) - 97 : -1;
        const opt = idx >= 0 ? q.options[idx] : undefined;
        if (opt) { e.preventDefault(); select(opt.id); }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [current, goTo, hasOptions, openSummary, q.options, select, toggleFlag]);

  const last = current === questions.length - 1;
  const flagged = !!entry?.flagged;

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="safe-top sticky top-0 z-30 border-b border-border bg-bg/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-2 px-4 sm:gap-3">
          <ConfirmDialog
            trigger={<Button variant="ghost" size="icon" aria-label="Leave quiz"><LogOut className="rotate-180" aria-hidden="true" /></Button>}
            title="Leave this quiz?"
            description="Your answers are saved. If the quiz is timed, the clock keeps running while you are away."
            confirmLabel="Leave"
            onConfirm={async () => { await queue.flush(); navigate(`/quizzes/${attempt.quizId}`); }}
          />
          <p className="min-w-0 flex-1 truncate font-display text-base font-semibold sm:text-lg">{attempt.quizTitle}</p>
          <div className="hidden sm:block"><SaveIndicator status={save.status} pending={save.pending} onRetry={() => void queue.flush()} /></div>
          {attempt.expiresAt && <Timer expiresAt={attempt.expiresAt} serverNow={attempt.serverNow} startedAt={attempt.startedAt} onExpire={onExpire} />}
          <Button variant="ghost" size="icon" onClick={() => setHelpOpen(true)} aria-label="Keyboard shortcuts" className="hidden sm:inline-flex"><HelpCircle aria-hidden="true" /></Button>
          <Button variant="outline" size="icon" onClick={() => setSheet(true)} aria-label="Open question navigator" className="lg:hidden"><LayoutGrid aria-hidden="true" /></Button>
        </div>
        <Progress value={summary.answered} max={summary.total} label={`${summary.answered} of ${summary.total} answered`} className="h-1 rounded-none" />
        <div className="sm:hidden mx-auto flex max-w-5xl justify-end px-4 py-1"><SaveIndicator status={save.status} pending={save.pending} onRetry={() => void queue.flush()} /></div>
      </header>

      <div className="mx-auto grid w-full max-w-5xl flex-1 gap-8 px-4 pb-40 pt-6 lg:grid-cols-[1fr_17rem] lg:pb-12">
        <div className="min-w-0">
          <QuestionView
            key={q.id}
            ref={headingRef}
            question={q}
            index={current}
            total={questions.length}
            entry={entry}
            onSelect={select}
            onText={(text) => apply({ type: 'setText', questionId: q.id, text }, q.id)}
            onNumber={(number) => apply({ type: 'setNumber', questionId: q.id, number }, q.id)}
          />

          <div className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 px-4 pt-2 backdrop-blur lg:static lg:mt-8 lg:border-0 lg:bg-transparent lg:px-0 lg:pt-0">
            <div className="mx-auto flex max-w-5xl items-center gap-2 lg:max-w-none">
              <Button variant="outline" size="lg" className="min-h-12 flex-1 lg:flex-none" onClick={() => goTo(current - 1)} disabled={current === 0}>
                <ChevronLeft aria-hidden="true" /> <span>Previous</span>
              </Button>
              <Button
                variant={flagged ? 'secondary' : 'outline'}
                size="lg"
                className={cn('min-h-12 shrink-0', flagged && 'border-warning text-warning')}
                aria-pressed={flagged}
                onClick={toggleFlag}
              >
                <Flag className={cn(flagged && 'fill-warning')} aria-hidden="true" /> <span className="hidden min-[400px]:inline">{flagged ? 'Flagged' : 'Flag'}</span>
              </Button>
              {last ? (
                <Button size="lg" className="min-h-12 flex-1 lg:flex-none" onClick={openSummary}><span>Review &amp; submit</span> <Send aria-hidden="true" /></Button>
              ) : (
                <Button size="lg" className="min-h-12 flex-1 lg:flex-none" onClick={() => goTo(current + 1)}><span>Next</span> <ChevronRight aria-hidden="true" /></Button>
              )}
              {!last && <Button variant="ghost" size="lg" className="hidden min-h-12 lg:inline-flex" onClick={openSummary}>Review &amp; submit</Button>}
            </div>
          </div>
        </div>

        <aside className="hidden lg:block" aria-label="Question navigator">
          <div className="sticky top-24 rounded-lg border border-border bg-surface p-4">
            <h2 className="mb-3 font-display text-lg font-semibold">Questions</h2>
            <Navigator questions={questions} answers={answers} current={current} onGo={goTo} />
            <Button className="mt-4 w-full" onClick={openSummary}>Review &amp; submit</Button>
          </div>
        </aside>
      </div>

      {/* mobile navigator as a bottom sheet */}
      <Dialog open={sheet} onOpenChange={setSheet}>
        <DialogContent className="bottom-0 left-0 top-auto max-h-[75dvh] w-full max-w-none translate-x-0 translate-y-0 rounded-b-none pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          <DialogTitle>Questions</DialogTitle>
          <Navigator questions={questions} answers={answers} current={current} onGo={goTo} />
          <Button className="w-full" onClick={() => { setSheet(false); openSummary(); }}>Review &amp; submit</Button>
        </DialogContent>
      </Dialog>

      <SubmitDialog
        open={summaryOpen}
        onOpenChange={setSummaryOpen}
        summary={summary}
        questions={questions}
        onJump={goTo}
        onSubmit={() => void submit(false)}
        submitting={submitting}
      />
      <ShortcutsDialog open={helpOpen} onOpenChange={setHelpOpen} />
      <ExpiredDialog open={expired} loading={submitting} onContinue={() => void submit(true)} />
    </div>
  );
}
