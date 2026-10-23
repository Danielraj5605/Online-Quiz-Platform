import { Flag } from 'lucide-react';
import type { AttemptQuestionDto } from '@quiz/shared';
import { Button, Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogTitle } from '@/components/ui';
import type { Summary } from './answerState';

export function SubmitDialog({ open, onOpenChange, summary, questions, onJump, onSubmit, submitting }: {
  open: boolean; onOpenChange: (o: boolean) => void; summary: Summary; questions: AttemptQuestionDto[];
  onJump: (index: number) => void; onSubmit: () => void; submitting: boolean;
}) {
  const idx = (id: string) => questions.findIndex((q) => q.id === id);
  const jump = (id: string) => { onOpenChange(false); onJump(idx(id)); };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>Submit your answers?</DialogTitle>
        <DialogDescription>You cannot change your answers after submitting.</DialogDescription>
        <dl className="grid grid-cols-3 gap-3 text-center">
          <div className="rounded-md bg-surface-2 p-3"><dd className="num text-2xl font-semibold">{summary.answered}</dd><dt className="text-xs text-muted">Answered</dt></div>
          <div className="rounded-md bg-surface-2 p-3"><dd className="num text-2xl font-semibold">{summary.unansweredIds.length}</dd><dt className="text-xs text-muted">Unanswered</dt></div>
          <div className="rounded-md bg-surface-2 p-3"><dd className="num text-2xl font-semibold">{summary.flaggedIds.length}</dd><dt className="text-xs text-muted">Flagged</dt></div>
        </dl>
        {summary.unansweredIds.length > 0 && (
          <div>
            <p className="mb-2 text-sm font-medium">Unanswered — jump to:</p>
            <ul className="flex flex-wrap gap-2">
              {summary.unansweredIds.map((id) => (
                <li key={id}><button type="button" onClick={() => jump(id)} className="num min-h-9 min-w-9 rounded-md border border-border-strong px-2 text-sm font-semibold hover:bg-surface-2" aria-label={`Go to question ${idx(id) + 1}`}>{idx(id) + 1}</button></li>
              ))}
            </ul>
          </div>
        )}
        {summary.flaggedIds.length > 0 && (
          <div>
            <p className="mb-2 flex items-center gap-1.5 text-sm font-medium"><Flag className="size-4 text-warning" aria-hidden="true" /> Flagged for review — jump to:</p>
            <ul className="flex flex-wrap gap-2">
              {summary.flaggedIds.map((id) => (
                <li key={id}><button type="button" onClick={() => jump(id)} className="num min-h-9 min-w-9 rounded-md border border-warning px-2 text-sm font-semibold text-warning hover:bg-warning-soft" aria-label={`Go to flagged question ${idx(id) + 1}`}>{idx(id) + 1}</button></li>
              ))}
            </ul>
          </div>
        )}
        <DialogFooter>
          <DialogClose asChild><Button variant="secondary" disabled={submitting}>Keep working</Button></DialogClose>
          <Button onClick={onSubmit} loading={submitting}>Submit answers</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const SHORTCUTS: [string, string][] = [
  ['← / P', 'Previous question'],
  ['→ / N', 'Next question'],
  ['1–9 or A–E', 'Select option (toggle for multiple choice)'],
  ['F', 'Flag or unflag for review'],
  ['Ctrl + Enter', 'Review and submit'],
  ['?', 'Show this help'],
];

export function ShortcutsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>Keyboard shortcuts</DialogTitle>
        <DialogDescription>Shortcuts are off while you type in an answer box.</DialogDescription>
        <dl className="grid gap-2">
          {SHORTCUTS.map(([k, d]) => (
            <div key={k} className="flex items-center justify-between gap-4 border-b border-border pb-2 text-sm">
              <dd className="order-2 text-muted">{d}</dd>
              <dt className="num order-1 rounded-sm border border-border-strong bg-surface-2 px-2 py-0.5 font-semibold">{k}</dt>
            </div>
          ))}
        </dl>
        <DialogFooter><DialogClose asChild><Button>Got it</Button></DialogClose></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ExpiredDialog({ open, onContinue, loading }: { open: boolean; onContinue: () => void; loading: boolean }) {
  return (
    <Dialog open={open}>
      <DialogContent hideClose onEscapeKeyDown={(e) => e.preventDefault()} onInteractOutside={(e) => e.preventDefault()}>
        <DialogTitle>Time is up</DialogTitle>
        <DialogDescription>Your attempt has been submitted automatically. Everything you saved before the deadline is counted.</DialogDescription>
        <DialogFooter><Button onClick={onContinue} loading={loading}>See my results</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
