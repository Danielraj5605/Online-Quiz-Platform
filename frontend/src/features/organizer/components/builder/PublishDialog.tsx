import { useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Check, CircleAlert, Rocket } from 'lucide-react';
import { toast } from 'sonner';
import type { QuizDetailDto } from '@quiz/shared';
import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from '@/components/ui';
import { quizzesApi } from '@/lib/api';
import { ApiError } from '@/lib/api/client';
import { keys } from '@/lib/query/keys';
import { useBuilder } from './BuilderProvider';
import { fromDto, validateDraft } from './question-draft';

export interface CheckItem { ok: boolean; label: string; detail?: string; blocking: boolean }

/** Pre-flight checks mirroring what the API enforces when publishing. */
export function publishChecklist(q: QuizDetailDto): CheckItem[] {
  const items: CheckItem[] = [];
  items.push({ ok: q.title.trim().length >= 3, label: 'Has a title', blocking: true });
  items.push({ ok: q.questions.length > 0, label: 'Has at least one question', detail: q.questions.length ? `${q.questions.length} questions` : 'Add a question in the Questions tab', blocking: true });
  const bad: string[] = [];
  q.questions.forEach((x, i) => {
    const v = validateDraft(fromDto(x));
    if (!v.valid) bad.push(`Q${i + 1}: ${Object.values(v.errors)[0]}`);
    else if (v.warnings.some((w) => w.startsWith('Points'))) bad.push(`Q${i + 1}: points must be greater than 0`);
  });
  items.push({ ok: bad.length === 0, label: 'Every question is complete', detail: bad.slice(0, 4).join(' · ') + (bad.length > 4 ? ` · +${bad.length - 4} more` : ''), blocking: true });
  const pass = q.settings.passMarkPct;
  items.push({ ok: pass >= 0 && pass <= 100, label: `Pass mark is ${pass}%`, blocking: false });
  if (q.closesAt) items.push({ ok: new Date(q.closesAt) > new Date(), label: 'Closing time is in the future', detail: 'Pick a later closing time in Settings', blocking: true });
  const manual = q.questions.filter((x) => x.type === 'LONG_ANSWER').length;
  if (manual) items.push({ ok: true, label: `${manual} question${manual === 1 ? '' : 's'} need manual grading`, detail: 'Results stay provisional until you grade them', blocking: false });
  return items;
}

export function PublishDialog({ trigger, republish }: { trigger: ReactNode; republish: boolean }) {
  const { id, quiz, actions } = useBuilder();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [serverProblems, setServerProblems] = useState<string[]>([]);
  const items = publishChecklist(quiz);
  const blocked = items.some((i) => !i.ok && i.blocking);
  const nextNumber = (quiz.currentVersion ?? 0) + 1;

  const run = async () => {
    setBusy(true); setServerProblems([]);
    try {
      await actions.flushAll();
      const dto = await quizzesApi.publish(id);
      qc.setQueryData<QuizDetailDto>(keys.quizzes.detail(id), dto);
      void qc.invalidateQueries({ queryKey: ['quizzes', 'list'] });
      void qc.invalidateQueries({ queryKey: keys.quizzes.versions(id) });
      void qc.invalidateQueries({ queryKey: keys.organizer.dashboard });
      toast.success(dto.status === 'SCHEDULED' ? `Published — opens ${dto.opensAt ? new Date(dto.opensAt).toLocaleString() : 'soon'}` : republish ? `Version ${dto.currentVersion} is live` : 'Quiz is live');
      setOpen(false);
    } catch (e) {
      const err = e as ApiError;
      if (Array.isArray(err.details)) setServerProblems((err.details as { position?: number; message?: string }[]).map((d) => (d.position ? `Q${d.position}: ${d.message}` : d.message ?? '')).filter(Boolean));
      else setServerProblems([err.message]);
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <span onClick={() => setOpen(true)} role="presentation">{trigger}</span>
      <DialogContent>
        <DialogTitle>{republish ? `Publish changes as version ${nextNumber}` : 'Publish quiz'}</DialogTitle>
        <DialogDescription>
          {republish ? 'Participants starting from now get the new version. Attempts already in progress finish on the version they started with — nothing is lost.' : 'Publishing freezes a snapshot of the questions. You can keep editing; changes only reach participants when you publish again.'}
        </DialogDescription>
        <ul className="grid gap-2" aria-label="Pre-publish checks">
          {items.map((i) => (
            <li key={i.label} className="flex items-start gap-2.5 text-sm">
              {i.ok ? <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" /> : i.blocking ? <CircleAlert className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden="true" /> : <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />}
              <span><span className={i.ok ? '' : 'font-medium'}>{i.label}</span><span className="sr-only">{i.ok ? ' — passed' : i.blocking ? ' — must fix' : ' — note'}</span>{i.detail && <span className="block text-muted">{i.detail}</span>}</span>
            </li>
          ))}
        </ul>
        {serverProblems.length > 0 && (
          <div role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">
            <p className="font-medium">The server rejected this:</p>
            <ul className="list-disc pl-5">{serverProblems.map((p) => <li key={p}>{p}</li>)}</ul>
          </div>
        )}
        <DialogFooter>
          <Button variant="secondary" onClick={() => setOpen(false)}>Not yet</Button>
          <Button disabled={blocked} loading={busy} onClick={() => void run()}><Rocket aria-hidden="true" /> {republish ? 'Publish changes' : 'Publish'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
