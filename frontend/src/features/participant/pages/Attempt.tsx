import { Navigate, useParams } from 'react-router-dom';
import { attemptsApi } from '@/lib/api/attempts';
import { ApiError } from '@/lib/api/client';
import { keys } from '@/lib/query/keys';
import { useApiQuery } from '@/lib/query/hooks';
import { useDocumentTitle } from '@/lib/hooks';
import { Button, EmptyState, PageSpinner } from '@/components/ui';
import { QuizTaker } from '../components/QuizTaker/QuizTaker';

export default function Attempt() {
  const { attemptId = '' } = useParams();
  useDocumentTitle('Taking quiz');
  // Always fetch fresh from the server: the server owns the clock and the saved answers.
  const { data, error, isPending, refetch } = useApiQuery(keys.attempts.detail(attemptId), () => attemptsApi.get(attemptId), {
    staleTime: 0, gcTime: 0, refetchOnWindowFocus: false, refetchOnReconnect: false, retry: false,
  });

  if (isPending) return <PageSpinner />;
  if (error) {
    const notFound = error instanceof ApiError && error.status === 404;
    return (
      <div className="mx-auto max-w-lg px-4 py-16">
        <EmptyState
          title={notFound ? 'Attempt not found' : 'Could not load your attempt'}
          description={notFound ? 'This attempt does not exist or belongs to someone else.' : error.message}
          action={notFound ? <Button asChild><a href="/">Back to home</a></Button> : <Button onClick={() => void refetch()}>Try again</Button>}
        />
      </div>
    );
  }
  if (data.status !== 'IN_PROGRESS') return <Navigate to={`/results/${attemptId}`} replace />;
  return <QuizTaker key={data.id} attempt={data} />;
}
