import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ClipboardCheck } from 'lucide-react';
import { Button, PageHeader, Skeleton, StatusBadge, Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui';
import { quizzesApi } from '@/lib/api';
import { keys } from '@/lib/query/keys';
import { useApiQuery } from '@/lib/query/hooks';
import { useDocumentTitle } from '@/lib/hooks';
import { SummaryTab } from '../components/reports/SummaryTab';
import { ItemsTab } from '../components/reports/ItemsTab';
import { ParticipantsTab } from '../components/reports/ParticipantsTab';
import { CohortsTab } from '../components/reports/CohortsTab';
import { ExportTab } from '../components/reports/ExportTab';

const TABS = ['summary', 'items', 'participants', 'cohorts', 'export'] as const;
type Tab = (typeof TABS)[number];

export default function Reports() {
  const { id = '' } = useParams();
  const [sp, setSp] = useSearchParams();
  const tab: Tab = (TABS as readonly string[]).includes(sp.get('tab') ?? '') ? (sp.get('tab') as Tab) : 'summary';
  const quiz = useApiQuery(keys.quizzes.detail(id), () => quizzesApi.get(id));
  useDocumentTitle(quiz.data ? `Reports · ${quiz.data.title}` : 'Reports');

  return (
    <>
      <Link to="/studio/quizzes" className="mb-2 inline-flex items-center gap-1 text-sm text-muted hover:text-text">
        <ArrowLeft className="size-4" aria-hidden="true" /> All quizzes
      </Link>
      <PageHeader
        eyebrow="Reports"
        title={quiz.data ? quiz.data.title : <Skeleton className="h-8 w-64" />}
        description="How participants performed, question by question."
        actions={
          <>
            {quiz.data && <StatusBadge status={quiz.data.status} />}
            <Button asChild variant="secondary" size="sm"><Link to={`/studio/quizzes/${id}/grading`}><ClipboardCheck aria-hidden="true" /> Grading</Link></Button>
          </>
        }
      />
      <Tabs value={tab} onValueChange={(v) => setSp({ tab: v }, { replace: true })}>
        <TabsList aria-label="Report sections">
          <TabsTrigger value="summary">Summary</TabsTrigger>
          <TabsTrigger value="items">Item analysis</TabsTrigger>
          <TabsTrigger value="participants">Participants</TabsTrigger>
          <TabsTrigger value="cohorts">Cohorts</TabsTrigger>
          <TabsTrigger value="export">Export</TabsTrigger>
        </TabsList>
        <TabsContent value="summary"><SummaryTab quizId={id} /></TabsContent>
        <TabsContent value="items"><ItemsTab quizId={id} /></TabsContent>
        <TabsContent value="participants"><ParticipantsTab quizId={id} /></TabsContent>
        <TabsContent value="cohorts"><CohortsTab quizId={id} /></TabsContent>
        <TabsContent value="export"><ExportTab quizId={id} /></TabsContent>
      </Tabs>
    </>
  );
}
