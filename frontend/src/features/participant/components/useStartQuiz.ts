import { useNavigate } from 'react-router-dom';
import { attemptsApi } from '@/lib/api/attempts';
import { useApiMutation } from '@/lib/query/hooks';
import { keys } from '@/lib/query/keys';

/** Start (or resume) an attempt and jump into taking mode. */
export function useStartQuiz(quizId: string) {
  const navigate = useNavigate();
  return useApiMutation(() => attemptsApi.start(quizId), {
    invalidate: [keys.catalog.all],
    onSuccess: (a) => navigate(`/attempt/${a.id}`),
  });
}
