import { useState } from 'react';
import { Controller, useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';
import { Plus, Trash2 } from 'lucide-react';
import { bankQuestionSchema, hasOptions, questionInputSchema, QUESTION_TYPES, type QuestionType } from '@quiz/shared';
import { Button, FormField, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Switch, Textarea } from '@/components/ui';
import type { BankQuestionDto, Category } from '@/lib/api/types';

/** Same cross-field rules the API applies to quiz questions (exactly one correct option, etc.). */
const formSchema = bankQuestionSchema.superRefine((v, ctx) => {
  const r = questionInputSchema.safeParse({ type: v.type, text: v.text, explanation: v.explanation, points: v.points, options: v.options, config: v.config });
  if (!r.success) for (const i of r.error.issues) ctx.addIssue({ code: 'custom', path: i.path, message: i.message });
});
export type BankFormIn = z.input<typeof formSchema>;
export type BankFormOut = z.output<typeof formSchema>;

export const TYPE_LABEL: Record<QuestionType, string> = {
  MCQ_SINGLE: 'Single choice', MCQ_MULTI: 'Multiple choice', TRUE_FALSE: 'True / False',
  SHORT_ANSWER: 'Short answer', NUMERIC: 'Numeric', LONG_ANSWER: 'Long answer (manual grading)',
};

const optionsFor = (t: QuestionType): { text: string; isCorrect: boolean }[] =>
  t === 'TRUE_FALSE' ? [{ text: 'True', isCorrect: true }, { text: 'False', isCorrect: false }]
  : t === 'MCQ_SINGLE' || t === 'MCQ_MULTI' ? [{ text: '', isCorrect: true }, { text: '', isCorrect: false }, { text: '', isCorrect: false }, { text: '', isCorrect: false }]
  : [];

const emptyConfig = () => ({ partialCredit: 'none' as const, acceptedAnswers: [] as string[], caseSensitive: false, numericAnswer: null as number | null, tolerance: 0, rubric: [] as { criterion: string; maxPoints: number }[], maxLength: 5000 });

function defaults(q?: BankQuestionDto): BankFormIn {
  if (!q) return { type: 'MCQ_SINGLE', text: '', explanation: '', points: 1, tags: [], categoryId: null, options: optionsFor('MCQ_SINGLE'), config: emptyConfig() };
  return { type: q.type, text: q.text, explanation: q.explanation, points: q.points, tags: q.tags, categoryId: q.categoryId, options: q.options, config: { ...emptyConfig(), ...q.config } };
}

interface Props {
  question?: BankQuestionDto;
  categories: Category[];
  submitting: boolean;
  onSubmit: (v: BankFormOut) => void;
  onCancel: () => void;
}

export function BankQuestionForm({ question, categories, submitting, onSubmit, onCancel }: Props) {
  const form = useForm<BankFormIn, unknown, BankFormOut>({ resolver: zodResolver(formSchema), defaultValues: defaults(question) });
  const { register, control, watch, setValue, handleSubmit, formState: { errors } } = form;
  const options = useFieldArray({ control, name: 'options' });
  const rubric = useFieldArray({ control, name: 'config.rubric' });
  const type = watch('type');
  const [tagText, setTagText] = useState((question?.tags ?? []).join(', '));
  const [acceptedText, setAcceptedText] = useState((question?.config.acceptedAnswers ?? []).join('\n'));
  const [numText, setNumText] = useState(question?.config.numericAnswer != null ? String(question.config.numericAnswer) : '');

  const changeType = (t: QuestionType) => {
    setValue('type', t, { shouldDirty: true });
    options.replace(optionsFor(t));
  };
  const setCorrect = (i: number, on: boolean) => {
    const multi = type === 'MCQ_MULTI';
    options.fields.forEach((_, k) => setValue(`options.${k}.isCorrect`, multi ? (k === i ? on : watch(`options.${k}.isCorrect`)) : k === i, { shouldDirty: true, shouldValidate: true }));
  };
  const optionError = (errors.options as { message?: string } | undefined)?.message ?? (errors.options as { root?: { message?: string } } | undefined)?.root?.message;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-[1fr_7rem]">
        <FormField label="Type" required>
          <Select value={type} onValueChange={(v) => changeType(v as QuestionType)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{QUESTION_TYPES.map((t) => <SelectItem key={t} value={t}>{TYPE_LABEL[t]}</SelectItem>)}</SelectContent>
          </Select>
        </FormField>
        <FormField label="Points" required error={errors.points?.message}>
          <Input type="number" step="0.5" min={0} className="num" {...register('points', { valueAsNumber: true })} />
        </FormField>
      </div>

      <FormField label="Question" required error={errors.text?.message}>
        <Textarea rows={3} maxLength={4000} {...register('text')} />
      </FormField>

      {hasOptions(type) && (
        <fieldset className="grid gap-2">
          <legend className="mb-1 text-sm font-medium">Options <span className="font-normal text-muted">— mark {type === 'MCQ_MULTI' ? 'every correct one' : 'the correct one'}</span></legend>
          {options.fields.map((f, i) => (
            <div key={f.id} className="flex items-center gap-2">
              <input
                type={type === 'MCQ_MULTI' ? 'checkbox' : 'radio'} name="correct"
                checked={!!watch(`options.${i}.isCorrect`)}
                onChange={(e) => setCorrect(i, e.target.checked)}
                className="size-5 shrink-0 accent-[var(--accent)]"
                aria-label={`Option ${i + 1} is correct`}
              />
              <Input
                aria-label={`Option ${i + 1} text`} placeholder={`Option ${i + 1}`} maxLength={500}
                readOnly={type === 'TRUE_FALSE'} aria-invalid={errors.options?.[i]?.text ? true : undefined}
                {...register(`options.${i}.text`)}
              />
              {type !== 'TRUE_FALSE' && (
                <Button type="button" variant="ghost" size="icon-sm" onClick={() => options.remove(i)} disabled={options.fields.length <= 2} aria-label={`Remove option ${i + 1}`}><Trash2 aria-hidden="true" /></Button>
              )}
            </div>
          ))}
          {optionError && <p role="alert" className="text-xs font-medium text-danger">{optionError}</p>}
          {type !== 'TRUE_FALSE' && options.fields.length < 10 && (
            <Button type="button" variant="outline" size="sm" className="justify-self-start" onClick={() => options.append({ text: '', isCorrect: false })}><Plus aria-hidden="true" /> Add option</Button>
          )}
          {type === 'MCQ_MULTI' && (
            <label className="mt-1 flex items-center gap-2 text-sm">
              <Controller control={control} name="config.partialCredit" render={({ field }) => (
                <Switch checked={field.value === 'proportional'} onCheckedChange={(c) => field.onChange(c ? 'proportional' : 'none')} aria-label="Award partial credit" />
              )} />
              Award partial credit
            </label>
          )}
        </fieldset>
      )}

      {type === 'SHORT_ANSWER' && (
        <div className="grid gap-3">
          <FormField label="Accepted answers" required hint="One per line. Any match counts as correct." error={errors.config?.acceptedAnswers?.message ?? (errors.config?.acceptedAnswers as { root?: { message?: string } } | undefined)?.root?.message}>
            <Textarea rows={3} value={acceptedText} onChange={(e) => { setAcceptedText(e.target.value); setValue('config.acceptedAnswers', e.target.value.split('\n').map((s) => s.trim()).filter(Boolean), { shouldValidate: true, shouldDirty: true }); }} />
          </FormField>
          <label className="flex items-center gap-2 text-sm">
            <Controller control={control} name="config.caseSensitive" render={({ field }) => <Switch checked={!!field.value} onCheckedChange={field.onChange} aria-label="Case sensitive" />} />
            Case sensitive
          </label>
        </div>
      )}

      {type === 'NUMERIC' && (
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Correct answer" required error={errors.config?.numericAnswer?.message}>
            <Input
              type="number" step="any" className="num" value={numText}
              onChange={(e) => { setNumText(e.target.value); setValue('config.numericAnswer', e.target.value === '' ? null : Number(e.target.value), { shouldValidate: true, shouldDirty: true }); }}
            />
          </FormField>
          <FormField label="Tolerance (±)" hint="Accepted distance from the answer" error={errors.config?.tolerance?.message}>
            <Input type="number" step="any" min={0} className="num" {...register('config.tolerance', { valueAsNumber: true })} />
          </FormField>
        </div>
      )}

      {type === 'LONG_ANSWER' && (
        <fieldset className="grid gap-2">
          <legend className="mb-1 text-sm font-medium">Rubric <span className="font-normal text-muted">— optional criteria for grading</span></legend>
          {rubric.fields.map((f, i) => (
            <div key={f.id} className="flex items-center gap-2">
              <Input aria-label={`Criterion ${i + 1}`} placeholder="Criterion, e.g. Clear explanation" maxLength={200} {...register(`config.rubric.${i}.criterion`)} />
              <Input aria-label={`Criterion ${i + 1} maximum points`} type="number" min={0} step="0.5" className="num w-24" {...register(`config.rubric.${i}.maxPoints`, { valueAsNumber: true })} />
              <Button type="button" variant="ghost" size="icon-sm" onClick={() => rubric.remove(i)} aria-label={`Remove criterion ${i + 1}`}><Trash2 aria-hidden="true" /></Button>
            </div>
          ))}
          {rubric.fields.length < 10 && (
            <Button type="button" variant="outline" size="sm" className="justify-self-start" onClick={() => rubric.append({ criterion: '', maxPoints: 1 })}><Plus aria-hidden="true" /> Add criterion</Button>
          )}
        </fieldset>
      )}

      <FormField label="Explanation" hint="Shown to participants after the quiz, if the quiz allows it." error={errors.explanation?.message}>
        <Textarea rows={2} maxLength={4000} {...register('explanation')} />
      </FormField>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Category">
          <Controller control={control} name="categoryId" render={({ field }) => (
            <Select value={field.value ?? 'none'} onValueChange={(v) => field.onChange(v === 'none' ? null : v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No category</SelectItem>
                {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )} />
        </FormField>
        <FormField label="Tags" hint="Comma separated">
          <Input
            value={tagText}
            onChange={(e) => { setTagText(e.target.value); setValue('tags', e.target.value.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 10), { shouldDirty: true }); }}
          />
        </FormField>
      </div>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button type="submit" loading={submitting}>{question ? 'Save changes' : 'Add to bank'}</Button>
      </div>
    </form>
  );
}
