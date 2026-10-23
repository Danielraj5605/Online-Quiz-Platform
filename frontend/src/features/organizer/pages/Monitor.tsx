import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CircleDot, Pause, Play, RefreshCw } from 'lucide-react';
import { Button, Card, EmptyState, PageHeader, Skeleton, StatusBadge } from '@/components/ui';
import { gradingApi, quizzesApi } from '@/lib/api';
import { keys } from '@/lib/query/keys';
import { useApiQuery } from '@/lib/query/hooks';
import { useDocumentTitle } from '@/lib/hooks';
import { MonitorTable } from '../components/monitor/MonitorTable';

const POLL_MS = 5000;

export default function Monitor() {
  const { id = '' } = useParams();
  const [live, setLive] = useState(true);
  const [now, setNow] = useState(() => Date.now());
  const quiz = useApiQuery(keys.quizzes.detail(id), () => quizzesApi.get(id));
  const mon = useApiQuery(keys.grading.monitor(id), () => gradingApi.monitor(id), { refetchInterval: live ? POLL_MS : false, refetchIntervalInBackground: false });
  useDocumentTitle(quiz.data ? `Monitor · ${quiz.data.title}` : 'Live monitor');

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const c = mon.data?.counts;
  const updated = mon.dataUpdatedAt ? Math.max(0, Math.round((now - mon.dataUpdatedAt) / 1000)) : null;

  return (
    <>
      <Link to="/studio/quizzes" className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-text"><ArrowLeft className="size-4" aria-hidden="true" /> All quizzes</Link>
      <PageHeader
        eyebrow="Live monitor"
        title={quiz.data?.title ?? <Skeleton className="inline-block h-9 w-64 align-middle" />}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            {quiz.data && <StatusBadge status={quiz.data.status} />}
            <span className="inline-flex items-center gap-1 text-sm" role="status">
              <CircleDot className={`size-3.5 ${live ? 'text-success' : 'text-muted'}`} aria-hidden="true" />
              {live ? `Updating every ${POLL_MS / 1000}s` : 'Paused'}{updated != null && ` · updated ${updated < 2 ? 'just now' : `${updated}s ago`}`}
            </span>
          </span>
        }
        actions={
          <>
            <Button variant="outline" onClick={() => setLive((v) => !v)} aria-pressed={!live}>{live ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />} {live ? 'Pause' : 'Resume'}</Button>
            <Button variant="outline" onClick={() => void mon.refetch()} loading={mon.isFetching && !mon.isPending}><RefreshCw aria-hidden="true" /> Refresh</Button>
            <Button asChild variant="secondary"><Link to={`/studio/quizzes/${id}/grading`}>Grading</Link></Button>
          </>
        }
      />

      {mon.isError ? (
        <EmptyState title="Couldn't load the monitor" description={mon.error.message} action={<Button onClick={() => void mon.refetch()}>Retry</Button>} />
      ) : (
        <>
          <section aria-label="Attempt counts" className="mb-5 grid grid-cols-3 gap-3">
            <Count label="In progress" value={c?.inProgress} tone="teal" />
            <Count label="Submitted" value={c?.submitted} tone="success" />
            <Count label="Not started" value={c?.notStarted} tone="muted" />
          </section>
          <MonitorTable rows={mon.data?.participants} loading={mon.isPending} now={now} />
        </>
      )}
    </>
  );
}

function Count({ label, value, tone }: { label: string; value: number | undefined; tone: 'teal' | 'success' | 'muted' }) {
  const color = tone === 'teal' ? 'text-teal' : tone === 'success' ? 'text-success' : 'text-muted';
  return (
    <Card className="p-4">
      <p className="text-sm text-muted">{label}</p>
      <p className={`num mt-1 text-3xl font-semibold ${color}`}>{value ?? <Skeleton className="h-8 w-10" />}</p>
    </Card>
  );
}
