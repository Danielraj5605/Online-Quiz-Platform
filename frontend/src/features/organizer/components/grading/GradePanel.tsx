import { useImperativeHandle, useMemo, useState, type Ref } from 'react';
import { CheckCircle2, Flag, TabletSmartphone } from 'lucide-react';
import { Avatar, Badge, Input, Progress, Textarea } from '@/components/ui';
import type { GradingAttemptDto, GradingItem } from '@/lib/api/types';
import { cn, fmtDate, fmtDuration } from '@/lib/utils';
import { AnswerKey, AnswerView } from './AnswerView';
import { applyLevel, draftError, draftScore, initDraft, isGraded, needsManual, toGradePayload, type Draft } from './draft';

export interface GradePanelHandle {
  /** Digit shortcut: score the highlighted criterion (or question). */
  applyLevel: (n: number) => void;
  /** Validated payload for PUT /attempts/:id/grading; `error` when something is invalid. */
  collect: () => { grades: ReturnType<typeof toGradePayload>[]; error?: string };
}

interface Props {
  attempt: GradingAttemptDto;
  ref?: Ref<GradePanelHandle>;
}

export function GradePanel({ attempt, ref }: Props) {
  const manual = useMemo(() => attempt.items.filter(needsManual), [attempt.items]);
  const auto = useMemo(() => attempt.items.filter((i) => !needsManual(i)), [attempt.items]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [active, setActive] = useState<{ answerId: string; crit: number } | null>(() => {
    const first = manual.find((i) => !isGraded(i)) ?? manual[0];
    return first ? { answerId: first.answerId!, crit: 0 } : null;
  });

  const draftFor = (i: GradingItem): Draft => drafts[i.answerId!] ?? initDraft(i);
  const patch = (i: GradingItem, fn: (d: Draft) => Draft) =>
    setDrafts((s) => ({ ...s, [i.answerId!]: fn(s[i.answerId!] ?? initDraft(i)) }));

  const gradedCount = manual.filter((i) => isGraded(i) || draftScore(i, draftFor(i)) != null).length;

  useImperativeHandle(ref, () => ({
    applyLevel(n) {
      const item = manual.find((i) => i.answerId === active?.answerId);
      if (!item || !active) return;
      patch(item, (d) => applyLevel(item, d, active.crit, n));
      const rubricLen = (item.config.rubric ?? []).length;
      if (active.crit < rubricLen - 1) setActive({ answerId: item.answerId!, crit: active.crit + 1 });
    },
    collect() {
      const grades: ReturnType<typeof toGradePayload>[] = [];
      for (const i of manual) {
        const d = draftFor(i);
        const err = draftError(i, d);
        if (err) return { grades: [], error: err };
        if (draftScore(i, d) == null) continue;
        if (!d.dirty && isGraded(i)) continue;
        grades.push(toGradePayload(i, d));
      }
      return { grades };
    },
  }));

  const name = attempt.user.name ?? attempt.user.username;
  return (
    <div className="grid gap-5">
      <header className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-surface p-4">
        <Avatar name={name} src={attempt.user.avatarUrl} size={44} />
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-display text-xl font-semibold">{name}</h2>
          <p className="text-sm text-muted">
            @{attempt.user.username} · submitted {fmtDate(attempt.submittedAt)}
            {attempt.durationSec != null && <> · took <span className="num">{fmtDuration(attempt.durationSec)}</span></>}
          </p>
        </div>
        {attempt.tabSwitches > 0 && (
          <Badge tone={attempt.tabSwitches > 5 ? 'danger' : 'warning'}>
            <TabletSmartphone className="size-3.5" aria-hidden="true" /> <span className="num">{attempt.tabSwitches}</span> tab switch{attempt.tabSwitches === 1 ? '' : 'es'}
          </Badge>
        )}
        <div className="w-full sm:w-56">
          <p className="mb-1 flex justify-between text-xs text-muted">
            <span>Answers graded</span><span className="num">{gradedCount} / {manual.length}</span>
          </p>
          <Progress value={gradedCount} max={Math.max(1, manual.length)} label="Answers graded in this submission" tone="success" />
        </div>
      </header>

      {manual.map((item, n) => (
        <ManualItem
          key={item.answerId}
          index={n + 1}
          item={item}
          draft={draftFor(item)}
          activeCrit={active?.answerId === item.answerId ? active.crit : null}
          onActivate={(crit) => setActive({ answerId: item.answerId!, crit })}
          onChange={(fn) => patch(item, fn)}
        />
      ))}

      {auto.length > 0 && (
        <details className="rounded-lg border border-border bg-surface">
          <summary className="cursor-pointer select-none px-4 py-3 text-sm font-medium">
            Auto-graded answers <span className="num text-muted">({auto.length})</span>
          </summary>
          <ul className="divide-y divide-border border-t border-border">
            {auto.map((i) => (
              <li key={i.questionId} className="grid gap-2 p-4 text-sm md:grid-cols-2">
                <div>
                  <p className="font-medium">{i.text}</p>
                  <div className="mt-2"><AnswerKey item={i} /></div>
                </div>
                <div className="grid gap-2">
                  <AnswerView item={i} />
                  <p className="num text-muted">{i.grade?.effective ?? 0} / {i.points} pts{i.grade?.isCorrect === false && ' · incorrect'}</p>
                </div>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

interface ItemProps {
  index: number;
  item: GradingItem;
  draft: Draft;
  activeCrit: number | null;
  onActivate: (crit: number) => void;
  onChange: (fn: (d: Draft) => Draft) => void;
}

function ManualItem({ index, item, draft, activeCrit, onActivate, onChange }: ItemProps) {
  const rubric = item.config.rubric ?? [];
  const score = draftScore(item, draft);
  const error = draftError(item, draft);
  const done = isGraded(item) && !draft.dirty;
  const hid = `q-${item.questionId}`;

  return (
    <article aria-labelledby={hid} className={cn('rounded-lg border bg-surface', activeCrit !== null ? 'border-accent' : 'border-border')}>
      <header className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
        <span className="num grid size-7 place-items-center rounded-full bg-surface-2 text-sm font-medium">{index}</span>
        <h3 id={hid} className="min-w-0 flex-1 font-medium">{item.text}</h3>
        {item.flagged && <Badge tone="warning"><Flag className="size-3.5" aria-hidden="true" /> Flagged</Badge>}
        {done && <Badge tone="success"><CheckCircle2 className="size-3.5" aria-hidden="true" /> Graded</Badge>}
        <Badge><span className="num">{item.points}</span> pt{item.points === 1 ? '' : 's'}</Badge>
      </header>

      <div className="grid gap-5 p-4 md:grid-cols-2">
        <section aria-label="Student's answer" className="grid content-start gap-2">
          <h4 className="text-xs font-medium uppercase tracking-wide text-muted">Student's answer</h4>
          <AnswerView item={item} />
          <p className="num text-xs text-muted">Time on question: {fmtDuration(Math.round(item.timeSpentMs / 1000))}</p>
        </section>

        <section aria-label="Question, key and scoring" className="grid content-start gap-3">
          <h4 className="text-xs font-medium uppercase tracking-wide text-muted">Key &amp; scoring</h4>
          <AnswerKey item={item} />
          {item.explanation && <p className="rounded-md bg-surface-2 p-3 text-sm"><span className="text-muted">Notes: </span>{item.explanation}</p>}

          {rubric.length > 0 ? (
            <ul className="grid gap-2" aria-label="Rubric">
              {rubric.map((r, ci) => (
                <li key={ci} className={cn('flex items-center gap-3 rounded-md border px-3 py-2', activeCrit === ci ? 'border-accent bg-accent-soft' : 'border-border')}>
                  <label htmlFor={`${hid}-r${ci}`} className="min-w-0 flex-1 text-sm">{r.criterion}</label>
                  <Input
                    id={`${hid}-r${ci}`}
                    type="number" inputMode="decimal" min={0} max={r.maxPoints} step={0.5}
                    className="num h-9 w-20 text-right"
                    value={draft.rubric[ci] ?? ''}
                    onFocus={() => onActivate(ci)}
                    onChange={(e) => {
                      const v = e.target.value === '' ? null : Math.max(0, Math.min(r.maxPoints, Number(e.target.value)));
                      onChange((d) => ({ ...d, rubric: d.rubric.map((x, k) => (k === ci ? v : x)), dirty: true }));
                    }}
                    aria-label={`${r.criterion}, out of ${r.maxPoints}`}
                  />
                  <span className="num w-10 text-sm text-muted">/ {r.maxPoints}</span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex items-center gap-2">
              <label htmlFor={`${hid}-score`} className="text-sm font-medium">Score</label>
              <Input
                id={`${hid}-score`}
                type="number" inputMode="decimal" min={0} max={item.points} step={0.5}
                className="num w-24 text-right"
                value={draft.score}
                aria-invalid={error ? true : undefined}
                onFocus={() => onActivate(0)}
                onChange={(e) => onChange((d) => ({ ...d, score: e.target.value, dirty: true }))}
              />
              <span className="num text-sm text-muted">/ {item.points}</span>
            </div>
          )}

          <p className="flex items-baseline justify-between text-sm" aria-live="polite">
            <span className="text-muted">Awarded</span>
            <span className={cn('num text-lg font-semibold', error && 'text-danger')}>{score ?? '—'} <span className="text-sm font-normal text-muted">/ {item.points}</span></span>
          </p>
          {error && <p role="alert" className="text-xs font-medium text-danger">{error}</p>}

          <label className="grid gap-1.5 text-sm font-medium">
            Feedback
            <Textarea
              rows={3} maxLength={4000} placeholder="Optional note shown to the participant"
              value={draft.feedback}
              onChange={(e) => onChange((d) => ({ ...d, feedback: e.target.value, dirty: true }))}
              className="font-normal"
            />
          </label>
        </section>
      </div>
    </article>
  );
}
