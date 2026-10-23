import { History, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { Badge, Button, ConfirmDialog, Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger, EmptyState, Skeleton } from '@/components/ui';
import { quizzesApi } from '@/lib/api';
import { keys } from '@/lib/query/keys';
import { useApiMutation, useApiQuery } from '@/lib/query/hooks';
import { fmtDate } from '@/lib/utils';
import { useBuilder } from './BuilderProvider';

export function VersionsPanel() {
  const { id, quiz } = useBuilder();
  const versions = useApiQuery(keys.quizzes.versions(id), () => quizzesApi.versions(id));
  const regrade = useApiMutation((versionId?: string) => quizzesApi.regrade(id, versionId), {
    invalidate: [keys.reports.all, keys.grading.all, keys.organizer.dashboard], silent: true,
    onSuccess: (r) => { toast.success(r.regraded ? `Re-graded ${r.regraded} attempt${r.regraded === 1 ? '' : 's'}` : 'No attempts needed re-grading'); },
  });
  const failToast = regrade.error;

  return (
    <Dialog>
      <DialogTrigger asChild><Button variant="ghost" size="sm" disabled={quiz.currentVersion == null}><History aria-hidden="true" /> Versions</Button></DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogTitle>Version history</DialogTitle>
        <DialogDescription>Every publish creates an immutable version. Attempts stay graded against the version they were taken on until you re-grade them.</DialogDescription>
        {versions.isPending ? <Skeleton className="h-28" /> : !versions.data?.length ? (
          <EmptyState title="Nothing published yet" description="Versions appear after the first publish." />
        ) : (
          <ul className="divide-y divide-border rounded-md border border-border" aria-label="Versions">
            {versions.data.map((v) => (
              <li key={v.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
                <div>
                  <p className="font-medium">Version <span className="num">{v.number}</span> {v.number === quiz.currentVersion && <Badge tone="success" className="ml-1">Current</Badge>}</p>
                  <p className="text-xs text-muted">{fmtDate(v.createdAt)} · <span className="num">{v.attemptCount}</span> attempt{v.attemptCount === 1 ? '' : 's'}</p>
                </div>
                <ConfirmDialog
                  title={`Re-grade against version ${v.number}?`}
                  description="Submitted attempts are re-scored using this version's answer key and settings. Manual scores you entered are kept. Use this after fixing a wrong answer key."
                  confirmLabel="Re-grade attempts"
                  trigger={<Button variant="outline" size="sm" disabled={v.attemptCount === 0 && versions.data.length === 1}><RotateCcw aria-hidden="true" /> Re-grade</Button>}
                  onConfirm={() => regrade.mutateAsync(v.id)}
                />
              </li>
            ))}
          </ul>
        )}
        {failToast && <p role="alert" className="text-sm text-danger">{failToast.message}</p>}
      </DialogContent>
    </Dialog>
  );
}
