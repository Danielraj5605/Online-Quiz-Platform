import { Link, useNavigate } from 'react-router-dom';
import { CalendarClock, Clock, HelpCircle, Play, RotateCcw } from 'lucide-react';
import type { Difficulty, QuizOverviewDto } from '@quiz/shared';
import { attemptsApi } from '@/lib/api/attempts';
import { useApiMutation } from '@/lib/query/hooks';
import { keys } from '@/lib/query/keys';
import { fmtDate, fmtDuration } from '@/lib/utils';
import { Badge, Button, Card, type Tone } from '@/components/ui';
import { Rating } from './Rating';

const DIFF: Record<Difficulty, { label: string; tone: Tone }> = {
  EASY: { label: 'Easy', tone: 'success' },
  MEDIUM: { label: 'Medium', tone: 'teal' },
  HARD: { label: 'Hard', tone: 'accent' },
};
export const DifficultyBadge = ({ d }: { d: Difficulty }) => <Badge tone={DIFF[d].tone}>{DIFF[d].label}</Badge>;

/** Start (or resume) an attempt and jump into taking mode. */
export function useStartQuiz(quizId: string) {
  const navigate = useNavigate();
  return useApiMutation(() => attemptsApi.start(quizId), {
    invalidate: [keys.catalog.all],
    onSuccess: (a) => navigate(`/attempt/${a.id}`),
  });
}

export function StartButton({ quiz, size = 'md', className }: { quiz: QuizOverviewDto; size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const start = useStartQuiz(quiz.id);
  const resume = !!quiz.activeAttemptId;
  return (
    <Button size={size} className={className} loading={start.isPending} disabled={!quiz.canStart} onClick={() => start.mutate()}>
      {resume ? <RotateCcw aria-hidden="true" /> : <Play aria-hidden="true" />} {resume ? 'Resume' : 'Start quiz'}
    </Button>
  );
}

export function QuizCard({ quiz, showAction = true }: { quiz: QuizOverviewDto; showAction?: boolean }) {
  const attemptsLeft = Math.max(0, quiz.maxAttempts - quiz.attemptsUsed);
  return (
    <Card className="relative flex h-full flex-col p-5 transition-colors hover:border-border-strong">
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        <DifficultyBadge d={quiz.difficulty} />
        {quiz.category && <Badge>{quiz.category}</Badge>}
        {quiz.activeAttemptId && <Badge tone="accent">In progress</Badge>}
      </div>
      <h3 className="font-display text-xl font-semibold leading-snug">
        <Link to={`/quizzes/${quiz.id}`} className="rounded-sm after:absolute after:inset-0 hover:text-accent">{quiz.title}</Link>
      </h3>
      <p className="mt-1 line-clamp-2 text-sm text-muted">{quiz.description || 'No description provided.'}</p>
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
        <li className="inline-flex items-center gap-1.5"><HelpCircle className="size-4" aria-hidden="true" /><span className="num">{quiz.questionCount}</span> questions</li>
        <li className="inline-flex items-center gap-1.5"><Clock className="size-4" aria-hidden="true" />{quiz.timeLimitSec ? fmtDuration(quiz.timeLimitSec) : 'Untimed'}</li>
        {quiz.closesAt && <li className="inline-flex items-center gap-1.5"><CalendarClock className="size-4" aria-hidden="true" />Closes {fmtDate(quiz.closesAt, { dateStyle: 'medium' })}</li>}
      </ul>
      <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-4">
        <div className="min-w-0 text-xs text-muted">
          <Rating value={quiz.avgRating} count={quiz.ratingCount} />
          <p className="mt-1 truncate">by {quiz.owner.name ?? quiz.owner.username} · <span className="num">{attemptsLeft}</span> of <span className="num">{quiz.maxAttempts}</span> attempts left</p>
        </div>
        {showAction && (
          <div className="relative z-10">
            <StartButton quiz={quiz} size="sm" />
          </div>
        )}
      </div>
    </Card>
  );
}
