import { useState } from 'react';
import { useQueries, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ListChecks } from 'lucide-react';
import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle, DialogTrigger, FormField, Input, Textarea } from '@/components/ui';
import { gradingApi } from '@/lib/api';
import { keys } from '@/lib/query/keys';
import { useApiMutation } from '@/lib/query/hooks';
import { needsManual, isGraded } from './draft';

const MAX_BULK = 50;

/** Gives every still-ungraded written answer in the selected submissions the same percentage of its points. */
export function BulkGradeDialog({ quizId, attemptIds, onDone }: { quizId: string; attemptIds: string[]; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [pct, setPct] = useState('100');
  const [feedback, setFeedback] = useState('');
  const qc = useQueryClient();
  const ids = attemptIds.slice(0, MAX_BULK);

  const attempts = useQueries({
    queries: ids.map((id) => ({
      queryKey: keys.grading.attempt(id),
      queryFn: () => gradingApi.attempt(id),
      enabled: open,
      staleTime: 15_000,
    })),
  });
  const loading = open && attempts.some((a) => a.isPending);
  const answerIds = attempts.flatMap((a) => a.data?.items.filter((i) => needsManual(i) && !isGraded(i)).map((i) => i.answerId!) ?? []);
  const value = Number(pct);
  const valid = pct.trim() !== '' && Number.isFinite(value) && value >= 0 && value <= 100;

  const bulk = useApiMutation(() => gradingApi.bulk(quizId, { answerIds, scorePct: value, feedback: feedback.trim() }), {
    invalidate: [keys.grading.all, keys.reports.all, keys.organizer.dashboard],
    onSuccess: (r) => {
      toast.success(`Graded ${r.graded} answer${r.graded === 1 ? '' : 's'} in ${r.attempts} submission${r.attempts === 1 ? '' : 's'}`);
      ids.forEach((id) => void qc.invalidateQueries({ queryKey: keys.grading.attempt(id) }));
      setOpen(false);
      onDone();
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary" size="sm" disabled={attemptIds.length === 0}><ListChecks aria-hidden="true" /> Bulk grade <span className="num">({attemptIds.length})</span></Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>Bulk grade {attemptIds.length} submission{attemptIds.length === 1 ? '' : 's'}</DialogTitle>
        <DialogDescription>
          Every ungraded written answer in the selection receives the same share of its points. Already-graded answers are left alone.
          {attemptIds.length > MAX_BULK && ` Only the first ${MAX_BULK} selected submissions are included.`}
        </DialogDescription>
        <form
          className="grid gap-4"
          onSubmit={(e) => { e.preventDefault(); if (valid && answerIds.length) bulk.mutate(); }}
        >
          <FormField label="Score (% of each question's points)" required error={pct.trim() !== '' && !valid ? 'Enter a number from 0 to 100' : undefined}>
            <Input type="number" inputMode="decimal" min={0} max={100} step={5} value={pct} onChange={(e) => setPct(e.target.value)} />
          </FormField>
          <FormField label="Feedback (optional)" hint="Shown to every participant in the selection.">
            <Textarea rows={3} maxLength={4000} value={feedback} onChange={(e) => setFeedback(e.target.value)} />
          </FormField>
          <p className="rounded-md bg-surface-2 p-3 text-sm" aria-live="polite">
            {loading ? 'Counting answers…' : (
              <>
                <span className="num font-medium">{answerIds.length}</span> answer{answerIds.length === 1 ? '' : 's'} will be graded
                {valid && <> at <span className="num font-medium">{value}%</span></>}.
              </>
            )}
          </p>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" loading={bulk.isPending} disabled={!valid || loading || answerIds.length === 0}>Apply grade</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
