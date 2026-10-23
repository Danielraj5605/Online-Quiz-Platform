import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { PageHeader, Skeleton, StatusBadge } from '@/components/ui';
import { quizzesApi } from '@/lib/api';
import { keys } from '@/lib/query/keys';
import { useApiQuery } from '@/lib/query/hooks';
import { useDocumentTitle } from '@/lib/hooks';
import { GradeWorkspace } from '../components/grading/GradeWorkspace';

export default function Grading() {
  const { id = '' } = useParams();
  const quiz = useApiQuery(keys.quizzes.detail(id), () => quizzesApi.get(id));
  useDocumentTitle(quiz.data ? `Grading · ${quiz.data.title}` : 'Grading');

  return (
    <>
      <Link to="/studio/quizzes" className="mb-2 inline-flex items-center gap-1 text-sm text-muted hover:text-text">
        <ArrowLeft className="size-4" aria-hidden="true" /> All quizzes
      </Link>
      <PageHeader
        eyebrow="Grading workspace"
        title={quiz.data ? quiz.data.title : <Skeleton className="h-8 w-64" />}
        description="Score written answers against the rubric. Auto-graded questions are already counted."
        actions={quiz.data && <StatusBadge status={quiz.data.status} />}
      />
      <GradeWorkspace quizId={id} />
    </>
  );
}
