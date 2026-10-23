import { Plus, Trash2 } from 'lucide-react';
import { QUESTION_TYPES, hasOptions, type QuestionConfig } from '@quiz/shared';
import {
  Button, Checkbox, FormField, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Switch, Textarea,
} from '@/components/ui';
import { changeType, optKey, TYPE_LABEL, type QuestionDraft } from './question-draft';

interface Props {
  draft: QuestionDraft;
  errors: Record<string, string>;
  warnings?: string[];
  onChange: (next: QuestionDraft) => void;
  idPrefix: string;
}

const num = (v: string) => (v === '' ? 0 : Number(v));

/** Inline editor for one question. Controlled and presentational: validation lives in question-draft.ts. */
export function QuestionEditor({ draft, errors, warnings = [], onChange, idPrefix }: Props) {
  const set = (patch: Partial<QuestionDraft>) => onChange({ ...draft, ...patch });
  const setConfig = (patch: Partial<QuestionConfig>) => onChange({ ...draft, config: { ...draft.config, ...patch } });
  const multi = draft.type === 'MCQ_MULTI';
  const setOption = (i: number, patch: Partial<QuestionDraft['options'][number]>) =>
    set({ options: draft.options.map((o, j) => (j === i ? { ...o, ...patch } : o)) });
  const markCorrect = (i: number) =>
    set({ options: draft.options.map((o, j) => (multi ? (j === i ? { ...o, isCorrect: !o.isCorrect } : o) : { ...o, isCorrect: j === i })) });

  return (
    <div className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
        <FormField label="Question type">
          <Select value={draft.type} onValueChange={(v) => onChange(changeType(draft, v as typeof draft.type))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{QUESTION_TYPES.map((t) => <SelectItem key={t} value={t}>{TYPE_LABEL[t]}</SelectItem>)}</SelectContent>
          </Select>
        </FormField>
        <FormField label="Points" error={errors.points}>
          <Input type="number" inputMode="decimal" min={0} step="0.5" value={draft.points} onChange={(e) => set({ points: num(e.target.value) })} />
        </FormField>
      </div>

      <FormField label="Question" required error={errors.text}>
        <Textarea rows={3} value={draft.text} maxLength={4000} placeholder="Write the question…" onChange={(e) => set({ text: e.target.value })} />
      </FormField>

      {hasOptions(draft.type) && (
        <fieldset className="grid gap-2" aria-describedby={errors.options ? `${idPrefix}-opt-err` : undefined}>
          <legend className="mb-1 text-sm font-medium">
            Answer options <span className="font-normal text-muted">— {multi ? 'tick every correct answer' : 'select the correct answer'}</span>
          </legend>
          {draft.options.map((o, i) => (
            <div key={o.key} className="flex items-start gap-2">
              <div className="grid h-10 w-9 shrink-0 place-items-center">
                {multi ? (
                  <Checkbox checked={o.isCorrect} onCheckedChange={() => markCorrect(i)} aria-label={`Option ${i + 1} is correct`} />
                ) : (
                  <input
                    type="radio" name={`${idPrefix}-correct`} checked={o.isCorrect} onChange={() => markCorrect(i)}
                    aria-label={`Option ${i + 1} is the correct answer`} className="size-5 accent-[var(--accent)]"
                  />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <Input
                  value={o.text} aria-label={`Option ${i + 1} text`} aria-invalid={!!errors[`options.${i}.text`] || undefined}
                  readOnly={draft.type === 'TRUE_FALSE'} maxLength={500} placeholder={`Option ${i + 1}`}
                  onChange={(e) => setOption(i, { text: e.target.value })}
                />
                {errors[`options.${i}.text`] && <p role="alert" className="mt-1 text-xs font-medium text-danger">{errors[`options.${i}.text`]}</p>}
              </div>
              {draft.type !== 'TRUE_FALSE' && (
                <Button
                  variant="ghost" size="icon" aria-label={`Remove option ${i + 1}`} disabled={draft.options.length <= 2}
                  onClick={() => set({ options: draft.options.filter((_, j) => j !== i) })}
                ><Trash2 /></Button>
              )}
            </div>
          ))}
          {errors.options && <p id={`${idPrefix}-opt-err`} role="alert" className="text-xs font-medium text-danger">{errors.options}</p>}
          {draft.type !== 'TRUE_FALSE' && draft.options.length < 10 && (
            <Button variant="outline" size="sm" className="w-fit" onClick={() => set({ options: [...draft.options, { key: optKey(), text: '', isCorrect: false }] })}>
              <Plus aria-hidden="true" /> Add option
            </Button>
          )}
          {multi && (
            <label className="mt-1 flex items-center gap-3 text-sm">
              <Switch
                checked={draft.config.partialCredit === 'proportional'}
                onCheckedChange={(on) => setConfig({ partialCredit: on ? 'proportional' : 'none' })}
                aria-label="Award partial credit"
              />
              <span>Award partial credit <span className="text-muted">(wrong ticks subtract)</span></span>
            </label>
          )}
        </fieldset>
      )}

      {draft.type === 'SHORT_ANSWER' && (
        <fieldset className="grid gap-2">
          <legend className="mb-1 text-sm font-medium">Accepted answers</legend>
          {draft.config.acceptedAnswers.map((a, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                aria-label={`Accepted answer ${i + 1}`} value={a} maxLength={200} placeholder="e.g. mitochondria"
                onChange={(e) => setConfig({ acceptedAnswers: draft.config.acceptedAnswers.map((x, j) => (j === i ? e.target.value : x)) })}
              />
              <Button variant="ghost" size="icon" aria-label={`Remove accepted answer ${i + 1}`} onClick={() => setConfig({ acceptedAnswers: draft.config.acceptedAnswers.filter((_, j) => j !== i) })}><Trash2 /></Button>
            </div>
          ))}
          {errors['config.acceptedAnswers'] && <p role="alert" className="text-xs font-medium text-danger">{errors['config.acceptedAnswers']}</p>}
          <Button variant="outline" size="sm" className="w-fit" onClick={() => setConfig({ acceptedAnswers: [...draft.config.acceptedAnswers, ''] })}><Plus aria-hidden="true" /> Add accepted answer</Button>
          <label className="mt-1 flex items-center gap-3 text-sm">
            <Switch checked={draft.config.caseSensitive} onCheckedChange={(v) => setConfig({ caseSensitive: v })} aria-label="Case sensitive" />
            <span>Case sensitive</span>
          </label>
        </fieldset>
      )}

      {draft.type === 'NUMERIC' && (
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Correct answer" required error={errors['config.numericAnswer']}>
            <Input
              type="number" inputMode="decimal" step="any" value={draft.config.numericAnswer ?? ''}
              onChange={(e) => setConfig({ numericAnswer: e.target.value === '' ? null : Number(e.target.value) })}
            />
          </FormField>
          <FormField label="Tolerance (±)" hint="Answers within this distance count as correct.">
            <Input type="number" inputMode="decimal" min={0} step="any" value={draft.config.tolerance} onChange={(e) => setConfig({ tolerance: Math.max(0, num(e.target.value)) })} />
          </FormField>
        </div>
      )}

      {draft.type === 'LONG_ANSWER' && (
        <fieldset className="grid gap-2">
          <legend className="mb-1 text-sm font-medium">Marking rubric <span className="font-normal text-muted">— graded by you after submission</span></legend>
          {draft.config.rubric.map((r, i) => (
            <div key={i} className="grid grid-cols-[1fr_5.5rem_auto] items-center gap-2">
              <Input
                aria-label={`Criterion ${i + 1}`} value={r.criterion} placeholder="e.g. Clear argument" maxLength={200}
                onChange={(e) => setConfig({ rubric: draft.config.rubric.map((x, j) => (j === i ? { ...x, criterion: e.target.value } : x)) })}
              />
              <Input
                type="number" min={0} step="0.5" aria-label={`Criterion ${i + 1} max points`} value={r.maxPoints}
                onChange={(e) => setConfig({ rubric: draft.config.rubric.map((x, j) => (j === i ? { ...x, maxPoints: num(e.target.value) } : x)) })}
              />
              <Button variant="ghost" size="icon" aria-label={`Remove criterion ${i + 1}`} onClick={() => setConfig({ rubric: draft.config.rubric.filter((_, j) => j !== i) })}><Trash2 /></Button>
            </div>
          ))}
          <Button variant="outline" size="sm" className="w-fit" onClick={() => setConfig({ rubric: [...draft.config.rubric, { criterion: '', maxPoints: 1 }] })}><Plus aria-hidden="true" /> Add criterion</Button>
          <FormField label="Maximum answer length (characters)" className="mt-2 sm:max-w-60">
            <Input type="number" min={1} max={20000} value={draft.config.maxLength} onChange={(e) => setConfig({ maxLength: Math.min(20000, Math.max(1, num(e.target.value))) })} />
          </FormField>
        </fieldset>
      )}

      <FormField label="Explanation (optional)" hint="Shown to participants after submitting, if you allow answers to be revealed.">
        <Textarea rows={2} value={draft.explanation} maxLength={4000} onChange={(e) => set({ explanation: e.target.value })} />
      </FormField>

      {warnings.length > 0 && (
        <ul className="rounded-md bg-warning-soft px-3 py-2 text-sm text-warning" aria-label="Warnings">
          {warnings.map((w) => <li key={w}>{w}</li>)}
        </ul>
      )}
    </div>
  );
}
