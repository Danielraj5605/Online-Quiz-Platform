import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, ChevronDown, Trash2 } from 'lucide-react';
import type { QuestionAuthorDto } from '@quiz/shared';
import { Badge, Button, ConfirmDialog } from '@/components/ui';
import { cn } from '@/lib/utils';
import { QuestionEditor } from './QuestionEditor';
import { useBuilder } from './BuilderProvider';
import { answerHint, blankDraft, fromDto, TYPE_LABEL, toInput, validateDraft, type QuestionDraft } from './question-draft';

const AUTOSAVE_MS = 700;

interface CardProps {
  q: QuestionAuthorDto;
  number: number;
  open: boolean;
  onToggle: () => void;
  onMove: (dir: -1 | 1) => void;
  canMove: { up: boolean; down: boolean };
  handle: ReactNode;
}

/** A saved question: collapsed summary, expands into the inline editor with debounced autosave. */
export function QuestionCard({ q, number, open, onToggle, onMove, canMove, handle }: CardProps) {
  const { actions, revision } = useBuilder();
  const [draft, setDraft] = useState<QuestionDraft>(() => fromDto(q));
  const latest = useRef(draft);
  const saved = useRef(JSON.stringify(toInput(fromDto(q))));
  const savedInput = useRef(toInput(fromDto(q)));
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const mounted = useRef(true);
  const qid = useRef(q.id);
  qid.current = q.id;
  const stillExists = useRef(true);
  const { quiz } = useBuilder();
  stillExists.current = quiz.questions.some((x) => x.id === q.id);

  const flush = async () => {
    clearTimeout(timer.current);
    const cur = latest.current;
    if (!validateDraft(cur).valid) return;
    const input = toInput(cur);
    const json = JSON.stringify(input);
    if (json === saved.current) return;
    const before = savedInput.current;
    saved.current = json;
    savedInput.current = input;
    try { await actions.updateQuestion(qid.current, input, before); } catch { saved.current = JSON.stringify(before); savedInput.current = before; }
  };
  const flushRef = useRef(flush);
  flushRef.current = flush;

  useEffect(() => actions.registerFlusher(() => flushRef.current()), [actions]);
  useEffect(() => () => {
    mounted.current = false;
    if (stillExists.current) void flushRef.current();
    else clearTimeout(timer.current);
  }, []);

  const change = (next: QuestionDraft) => {
    setDraft(next);
    latest.current = next;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => void flushRef.current(), AUTOSAVE_MS);
  };

  const v = validateDraft(draft);
  const pendingInvalid = !v.valid;

  return (
    <article
      data-revision={revision}
      aria-label={`Question ${number}`}
      className={cn('rounded-lg border bg-surface transition-colors', open ? 'border-border-strong shadow-[var(--shadow-1)]' : 'border-border hover:border-border-strong')}
    >
      <div className="flex items-start gap-1 p-2 sm:gap-2 sm:p-3">
        {handle}
        <button
          type="button" onClick={onToggle} aria-expanded={open} aria-controls={`qe-${q.id}`}
          className="flex min-h-11 min-w-0 flex-1 items-start gap-3 rounded-md px-1 text-left"
        >
          <span className="num mt-0.5 grid size-7 shrink-0 place-items-center rounded-sm bg-surface-2 text-sm font-medium">{number}</span>
          <span className="min-w-0 flex-1">
            <span className="line-clamp-2 font-medium">{(open ? draft.text : q.text) || <span className="text-muted">Untitled question</span>}</span>
            {!open && <span className="mt-0.5 block truncate text-xs text-muted">Answer: {answerHint(q)}</span>}
          </span>
          <span className="hidden shrink-0 items-center gap-2 sm:flex">
            <Badge>{TYPE_LABEL[q.type]}</Badge>
            <Badge tone="accent"><span className="num">{q.points}</span> pt</Badge>
          </span>
          <ChevronDown className={cn('mt-1.5 size-4 shrink-0 text-muted transition-transform motion-reduce:transition-none', open && 'rotate-180')} aria-hidden="true" />
        </button>
        <div className="flex shrink-0 items-center">
          <Button variant="ghost" size="icon-sm" aria-label={`Move question ${number} up`} disabled={!canMove.up} onClick={() => onMove(-1)}><ArrowUp /></Button>
          <Button variant="ghost" size="icon-sm" aria-label={`Move question ${number} down`} disabled={!canMove.down} onClick={() => onMove(1)}><ArrowDown /></Button>
          <ConfirmDialog
            destructive confirmLabel="Delete question" title={`Delete question ${number}?`} description="You can undo this with Ctrl+Z."
            trigger={<Button variant="ghost" size="icon-sm" aria-label={`Delete question ${number}`}><Trash2 /></Button>}
            onConfirm={() => actions.deleteQuestion(q.id)}
          />
        </div>
      </div>

      {open && (
        <div id={`qe-${q.id}`} className="border-t border-border p-4 sm:p-5">
          <QuestionEditor draft={draft} errors={v.errors} warnings={v.warnings} onChange={change} idPrefix={`q-${q.id}`} />
          {pendingInvalid && <p className="mt-3 text-sm text-warning" role="status">Not saved yet — fix the highlighted fields and it will save automatically.</p>}
        </div>
      )}
    </article>
  );
}

/** A question that exists only in the browser until it validates; then it is created on the server automatically. */
export function NewQuestionCard({ sectionId, number, onCreated, onDiscard, handleSpace }: {
  sectionId: string | null; number: number; onCreated: (q: QuestionAuthorDto) => void; onDiscard: () => void; handleSpace?: ReactNode;
}) {
  const { actions } = useBuilder();
  const [draft, setDraft] = useState(() => blankDraft('MCQ_SINGLE', sectionId));
  const [touched, setTouched] = useState(false);
  const creating = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const latest = useRef(draft);

  const tryCreate = async () => {
    if (creating.current || !validateDraft(latest.current).valid) return;
    creating.current = true;
    try { onCreated(await actions.addQuestion(toInput(latest.current))); } catch { creating.current = false; }
  };
  const tryRef = useRef(tryCreate);
  tryRef.current = tryCreate;
  useEffect(() => actions.registerFlusher(() => tryRef.current()), [actions]);

  const change = (next: QuestionDraft) => {
    setDraft(next); latest.current = next; setTouched(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => void tryRef.current(), 900);
  };
  const v = validateDraft(draft);

  return (
    <article aria-label={`New question ${number}`} className="rounded-lg border border-dashed border-accent bg-surface">
      <div className="flex items-center gap-2 p-3">
        {handleSpace}
        <span className="num grid size-7 shrink-0 place-items-center rounded-sm bg-accent-soft text-sm font-medium text-accent">{number}</span>
        <p className="flex-1 text-sm font-medium">New question <span className="font-normal text-muted">— saved automatically once it's complete</span></p>
        <Button variant="ghost" size="sm" onClick={onDiscard}>Discard</Button>
      </div>
      <div className="border-t border-border p-4 sm:p-5">
        <QuestionEditor draft={draft} errors={touched ? v.errors : {}} warnings={touched ? v.warnings : []} onChange={change} idPrefix="q-new" />
      </div>
    </article>
  );
}
