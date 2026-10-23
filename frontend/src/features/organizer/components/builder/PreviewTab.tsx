import { useMemo, useState } from 'react';
import { Eye } from 'lucide-react';
import type { AttemptQuestionDto } from '@quiz/shared';
import { Button } from '@/components/ui';
import { attemptsApi } from '@/lib/api';
import { useApiMutation } from '@/lib/query/hooks';
import { PreviewPane } from '../PreviewPane';
import { useBuilder } from './BuilderProvider';
import { buildLayout } from './layout';

/** Draft preview built locally from the key-free fields, plus an optional run of the real preview attempt on the published version. */
export function PreviewTab() {
  const { id, quiz } = useBuilder();
  const [live, setLive] = useState<{ questions: AttemptQuestionDto[]; at: string } | null>(null);
  const start = useApiMutation(() => attemptsApi.start(id, true), {
    silent: false,
    onSuccess: (a) => setLive({ questions: a.questions, at: new Date().toLocaleTimeString() }),
  });

  const draft = useMemo<AttemptQuestionDto[]>(() => {
    const byId = new Map(quiz.questions.map((q) => [q.id, q]));
    const titles = new Map(quiz.sections.map((s) => [s.id, s.title]));
    return buildLayout(quiz).flatMap((c) => c.questionIds.map((qid) => byId.get(qid)!)).map((q) => ({
      id: q.id, type: q.type, text: q.text, points: q.points, sectionTitle: q.sectionId ? titles.get(q.sectionId) ?? null : null,
      options: q.options.map((o) => ({ id: o.id, text: o.text })), maxLength: q.config.maxLength,
    }));
  }, [quiz]);

  const published = quiz.currentVersion != null;
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">This is what participants see. Answers are never shown here.</p>
        <Button variant="outline" size="sm" disabled={!published} loading={start.isPending} onClick={() => start.mutate()} title={published ? undefined : 'Publish first to run a real preview'}>
          <Eye aria-hidden="true" /> {live ? 'Refresh published preview' : 'Run published preview'}
        </Button>
      </div>
      {live ? (
        <PreviewPane title={quiz.title} questions={live.questions} timeLimitSec={quiz.settings.timeLimitSec} maxAttempts={quiz.settings.maxAttempts} source={`Real preview attempt on version ${quiz.currentVersion} (started ${live.at}). Preview attempts are not counted in reports.`} />
      ) : (
        <PreviewPane title={quiz.title} questions={draft} timeLimitSec={quiz.settings.timeLimitSec} maxAttempts={quiz.settings.maxAttempts} source={quiz.dirty || !published ? 'Previewing your current draft. Shuffling is not applied.' : 'Previewing the draft, which matches the published version.'} />
      )}
      {live && <Button variant="ghost" className="mx-auto" onClick={() => setLive(null)}>Back to draft preview</Button>}
    </div>
  );
}
