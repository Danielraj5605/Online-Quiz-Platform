import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, ExternalLink, ShieldAlert } from 'lucide-react';
import { adminApi, type ModerationItem } from '@/lib/api';
import { keys } from '@/lib/query/keys';
import { useApiMutation, usePagedQuery } from '@/lib/query/hooks';
import { useDocumentTitle } from '@/lib/hooks';
import {
  Badge, Button, Card, Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogTitle, EmptyState, FormField,
  PageHeader, Pagination, Skeleton, SkeletonGroup, Tabs, TabsContent, TabsList, TabsTrigger, Textarea,
} from '@/components/ui';
import { fmtDate } from '@/lib/utils';

type Tab = 'OPEN' | 'DISMISSED' | 'ACTIONED';
const TAB_LABEL: Record<Tab, string> = { OPEN: 'Open', DISMISSED: 'Dismissed', ACTIONED: 'Removed' };
const ENTITY_LABEL: Record<string, string> = { QUIZ: 'Quiz', REVIEW: 'Review', USER: 'User' };
const REMOVE_EFFECT: Record<string, string> = {
  QUIZ: 'The quiz is deleted and disappears for everyone, including its owner.',
  REVIEW: 'The review is deleted from the quiz page.',
  USER: 'The account is disabled and signed out everywhere.',
};

function viewLink(item: ModerationItem) {
  if (item.entityType === 'QUIZ') return `/studio/quizzes/${item.entityId}/build`;
  if (item.entityType === 'USER' && item.entityLabel) return `/admin/users?q=${encodeURIComponent(item.entityLabel.replace(/^@/, ''))}`;
  return null;
}

function ResolveDialog({ item, action, onClose }: { item: ModerationItem; action: 'DISMISS' | 'REMOVE'; onClose: () => void }) {
  const [note, setNote] = useState('');
  const mut = useApiMutation(
    () => adminApi.resolveFlag(item.id, action, note.trim() || undefined),
    { invalidate: [keys.admin.all], success: action === 'REMOVE' ? 'Content removed' : 'Report dismissed', onSuccess: onClose },
  );
  const remove = action === 'REMOVE';
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent>
        <DialogTitle>{remove ? 'Remove reported content?' : 'Dismiss this report?'}</DialogTitle>
        <DialogDescription>
          {remove ? REMOVE_EFFECT[item.entityType] ?? 'The reported content is removed.' : 'The content stays as it is and the report is closed.'}
        </DialogDescription>
        <FormField label="Resolution note" hint="Optional. Saved with the audit log entry.">
          <Textarea rows={3} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
        </FormField>
        <DialogFooter>
          <DialogClose asChild><Button variant="secondary">Cancel</Button></DialogClose>
          <Button variant={remove ? 'danger' : 'primary'} loading={mut.isPending} onClick={() => mut.mutate()}>
            {remove ? 'Remove content' : 'Dismiss report'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Queue({ status }: { status: Tab }) {
  const [page, setPage] = useState(1);
  const [resolving, setResolving] = useState<{ item: ModerationItem; action: 'DISMISS' | 'REMOVE' } | null>(null);
  const query = { status, page, pageSize: 10 };
  const list = usePagedQuery(keys.admin.moderation(query), () => adminApi.moderation(query));

  if (list.isPending) return <SkeletonGroup label="Loading reports"><div className="grid gap-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-28" />)}</div></SkeletonGroup>;
  const rows = list.data?.data ?? [];
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={status === 'OPEN' ? <CheckCircle2 /> : <ShieldAlert />}
        title={status === 'OPEN' ? 'Nothing to review' : `No ${TAB_LABEL[status].toLowerCase()} reports`}
        description={status === 'OPEN' ? 'New reports from participants appear here.' : 'Resolved reports are listed here.'}
      />
    );
  }
  return (
    <>
      <ul className="grid gap-3" aria-label={`${TAB_LABEL[status]} reports`}>
        {rows.map((item) => {
          const link = viewLink(item);
          return (
            <li key={item.id}>
              <Card className="p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="mb-1.5 flex flex-wrap items-center gap-2">
                      <Badge tone="warning">{ENTITY_LABEL[item.entityType] ?? item.entityType}</Badge>
                      <span className="text-xs text-muted">Reported by {item.reporter.username} · {fmtDate(item.createdAt)}</span>
                    </div>
                    <p className="font-medium">{item.entityLabel ?? <span className="text-muted">Content no longer available</span>}</p>
                    <p className="mt-1 text-sm text-muted">“{item.reason}”</p>
                    {item.status !== 'OPEN' && item.resolution && <p className="mt-2 text-sm"><span className="text-muted">Resolution:</span> {item.resolution}</p>}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {link && (
                      <Button asChild variant="ghost" size="sm">
                        <Link to={link}><ExternalLink aria-hidden="true" /> View</Link>
                      </Button>
                    )}
                    {item.status === 'OPEN' && (
                      <>
                        <Button variant="outline" size="sm" onClick={() => setResolving({ item, action: 'DISMISS' })}>Dismiss</Button>
                        <Button variant="danger" size="sm" onClick={() => setResolving({ item, action: 'REMOVE' })}>Remove</Button>
                      </>
                    )}
                  </div>
                </div>
              </Card>
            </li>
          );
        })}
      </ul>
      <Pagination meta={list.data?.meta} onPageChange={setPage} />
      {resolving && <ResolveDialog item={resolving.item} action={resolving.action} onClose={() => setResolving(null)} />}
    </>
  );
}

export default function Moderation() {
  useDocumentTitle('Moderation');
  const [tab, setTab] = useState<Tab>('OPEN');
  return (
    <>
      <PageHeader eyebrow="Admin" title="Moderation queue" description="Reports from participants. Every decision is written to the audit log." />
      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
        <TabsList aria-label="Report status">
          {(Object.keys(TAB_LABEL) as Tab[]).map((t) => <TabsTrigger key={t} value={t}>{TAB_LABEL[t]}</TabsTrigger>)}
        </TabsList>
        {(Object.keys(TAB_LABEL) as Tab[]).map((t) => (
          <TabsContent key={t} value={t} className="mt-4">{tab === t && <Queue status={t} />}</TabsContent>
        ))}
      </Tabs>
    </>
  );
}
