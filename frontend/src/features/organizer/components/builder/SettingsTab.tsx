import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import { DIFFICULTIES, SHOW_ANSWERS } from '@quiz/shared';
import {
  Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, FormField, Input, RadioGroup, RadioGroupItem, Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue, Switch, Textarea,
} from '@/components/ui';
import { quizzesApi } from '@/lib/api';
import { keys } from '@/lib/query/keys';
import { useApiQuery } from '@/lib/query/hooks';
import { useBuilder } from './BuilderProvider';
import { diffPatch, fromLocalInput, fromQuiz, toLocalInput, validateSettings, type SettingsForm } from './settings-form';

const NONE = '__none';
const REVEAL: Record<(typeof SHOW_ANSWERS)[number], { label: string; hint: string }> = {
  NEVER: { label: 'Never', hint: 'Participants see their score only.' },
  AFTER_SUBMIT: { label: 'After they submit', hint: 'Correct answers appear on their results page right away.' },
  AFTER_CLOSE: { label: 'After the quiz closes', hint: 'Keeps the answer key private until everyone has finished.' },
};

function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <Card>
      <CardHeader><CardTitle>{title}</CardTitle>{description && <CardDescription>{description}</CardDescription>}</CardHeader>
      <CardContent className="grid gap-5">{children}</CardContent>
    </Card>
  );
}
const Toggle = ({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) => (
  <label className="flex items-start gap-3 text-sm">
    <Switch checked={checked} onCheckedChange={onChange} aria-label={label} className="mt-0.5" />
    <span><span className="font-medium">{label}</span>{hint && <span className="block text-muted">{hint}</span>}</span>
  </label>
);

export function SettingsTab() {
  const { quiz, actions, revision } = useBuilder();
  const cats = useApiQuery(keys.quizzes.categories, () => quizzesApi.categories());
  const [f, setF] = useState<SettingsForm>(() => fromQuiz(quiz));
  const [tagDraft, setTagDraft] = useState('');
  const saved = useRef<SettingsForm>(f);
  const latest = useRef(f);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const lastRevision = useRef(revision);

  // undo/redo changed the server state: adopt it
  useEffect(() => {
    if (lastRevision.current === revision) return;
    lastRevision.current = revision;
    const next = fromQuiz(quiz);
    setF(next); latest.current = next; saved.current = next;
  }, [revision, quiz]);

  const flush = async () => {
    clearTimeout(timer.current);
    const cur = latest.current;
    if (Object.keys(validateSettings(cur)).length) return;
    const { patch, before } = diffPatch(saved.current, cur);
    if (!Object.keys(patch).length) return;
    const prev = saved.current;
    saved.current = cur;
    try { await actions.patchQuiz(patch, before); } catch { saved.current = prev; }
  };
  const flushRef = useRef(flush);
  flushRef.current = flush;
  useEffect(() => actions.registerFlusher(() => flushRef.current()), [actions]);
  useEffect(() => () => { void flushRef.current(); }, []);

  const update = (fn: (s: SettingsForm) => SettingsForm) => {
    const next = fn(latest.current);
    latest.current = next; setF(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => void flushRef.current(), 800);
  };
  const setS = (patch: Partial<SettingsForm['settings']>) => update((s) => ({ ...s, settings: { ...s.settings, ...patch } }));
  const errors = validateSettings(f);
  const timed = f.settings.timeLimitSec != null;
  const addTag = () => {
    const t = tagDraft.trim().slice(0, 30);
    if (t && !f.tags.includes(t) && f.tags.length < 10) update((s) => ({ ...s, tags: [...s.tags, t] }));
    setTagDraft('');
  };

  return (
    <div className="grid max-w-3xl gap-5">
      <Section title="Details">
        <FormField label="Title" required error={errors.title}>
          <Input value={f.title} maxLength={150} onChange={(e) => update((s) => ({ ...s, title: e.target.value }))} />
        </FormField>
        <FormField label="Description" hint="Shown to participants before they start.">
          <Textarea rows={3} value={f.description} maxLength={5000} onChange={(e) => update((s) => ({ ...s, description: e.target.value }))} />
        </FormField>
        <div className="grid gap-5 sm:grid-cols-2">
          <FormField label="Category">
            <Select value={f.categoryId ?? NONE} onValueChange={(v) => update((s) => ({ ...s, categoryId: v === NONE ? null : v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>No category</SelectItem>
                {cats.data?.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </FormField>
          <FormField label="Difficulty">
            <Select value={f.difficulty} onValueChange={(v) => update((s) => ({ ...s, difficulty: v as typeof s.difficulty }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{DIFFICULTIES.map((d) => <SelectItem key={d} value={d}>{d[0] + d.slice(1).toLowerCase()}</SelectItem>)}</SelectContent>
            </Select>
          </FormField>
        </div>
        <FormField label="Tags" hint="Press Enter to add. Helps people find your quiz in the catalog.">
          <div>
            <Input value={tagDraft} maxLength={30} placeholder="e.g. biology" onChange={(e) => setTagDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }} onBlur={addTag} />
            {f.tags.length > 0 && (
              <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Tags">
                {f.tags.map((t) => (
                  <li key={t}><Badge tone="teal" className="gap-1 pr-1">{t}<button type="button" aria-label={`Remove tag ${t}`} className="grid size-5 place-items-center rounded-sm hover:bg-black/10" onClick={() => update((s) => ({ ...s, tags: s.tags.filter((x) => x !== t) }))}><X className="size-3" /></button></Badge></li>
                ))}
              </ul>
            )}
          </div>
        </FormField>
      </Section>

      <Section title="Timing & attempts">
        <Toggle label="Time limit" hint="The clock runs on our server, so refreshing the page never gives extra time." checked={timed} onChange={(on) => setS({ timeLimitSec: on ? 30 * 60 : null })} />
        {timed && (
          <FormField label="Minutes allowed" error={errors['settings.timeLimitSec']} className="sm:max-w-48">
            <Input type="number" min={1} max={480} value={Math.round((f.settings.timeLimitSec ?? 60) / 60)} onChange={(e) => setS({ timeLimitSec: Math.min(480, Math.max(1, Number(e.target.value) || 1)) * 60 })} />
          </FormField>
        )}
        <FormField label="Attempts allowed per participant" error={errors['settings.maxAttempts']} className="sm:max-w-48">
          <Input type="number" min={1} max={50} value={f.settings.maxAttempts} onChange={(e) => setS({ maxAttempts: Math.min(50, Math.max(1, Number(e.target.value) || 1)) })} />
        </FormField>
        <div className="grid gap-5 sm:grid-cols-2">
          <FormField label="Opens at" hint="Leave empty to open as soon as it's published."><Input type="datetime-local" value={toLocalInput(f.opensAt)} onChange={(e) => update((s) => ({ ...s, opensAt: fromLocalInput(e.target.value) }))} /></FormField>
          <FormField label="Closes at" error={errors.closesAt} hint="Attempts in progress at closing time are submitted automatically."><Input type="datetime-local" value={toLocalInput(f.closesAt)} onChange={(e) => update((s) => ({ ...s, closesAt: fromLocalInput(e.target.value) }))} /></FormField>
        </div>
      </Section>

      <Section title="Question behaviour">
        <Toggle label="Shuffle question order" hint="Each participant gets their own order." checked={f.settings.shuffleQuestions} onChange={(v) => setS({ shuffleQuestions: v })} />
        <Toggle label="Shuffle answer options" hint="Applies to choice questions." checked={f.settings.shuffleOptions} onChange={(v) => setS({ shuffleOptions: v })} />
      </Section>

      <Section title="Scoring" description="How answers become a grade.">
        <div className="grid gap-5 sm:grid-cols-2">
          <FormField label="Pass mark (%)" error={errors['settings.passMarkPct']}>
            <Input type="number" min={0} max={100} value={f.settings.passMarkPct} onChange={(e) => setS({ passMarkPct: Math.min(100, Math.max(0, Number(e.target.value) || 0)) })} />
          </FormField>
          <FormField label="Negative marking (% of a question's points)" hint="Deducted for each wrong answer. Blank answers cost nothing." error={errors['settings.negativeMarking']}>
            <Input type="number" min={0} max={100} step={5} value={Math.round(f.settings.negativeMarking * 100)} onChange={(e) => setS({ negativeMarking: Math.min(100, Math.max(0, Number(e.target.value) || 0)) / 100 })} />
          </FormField>
        </div>
        <fieldset className="grid gap-2">
          <legend className="mb-1 text-sm font-medium">Grade bands</legend>
          {f.settings.gradeBands.map((b, i) => (
            <div key={i} className="grid grid-cols-[5rem_1fr_auto] items-center gap-2">
              <Input aria-label={`Band ${i + 1} label`} value={b.label} maxLength={20} onChange={(e) => setS({ gradeBands: f.settings.gradeBands.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} />
              <div className="flex items-center gap-2 text-sm text-muted">
                <span>from</span>
                <Input aria-label={`Band ${i + 1} minimum percent`} type="number" min={0} max={100} className="w-24" value={b.minPct} onChange={(e) => setS({ gradeBands: f.settings.gradeBands.map((x, j) => (j === i ? { ...x, minPct: Math.min(100, Math.max(0, Number(e.target.value) || 0)) } : x)) })} />
                <span>%</span>
              </div>
              <Button variant="ghost" size="icon" aria-label={`Remove band ${b.label || i + 1}`} onClick={() => setS({ gradeBands: f.settings.gradeBands.filter((_, j) => j !== i) })}><Trash2 /></Button>
            </div>
          ))}
          {errors['settings.gradeBands'] && <p role="alert" className="text-xs font-medium text-danger">{errors['settings.gradeBands']}</p>}
          {f.settings.gradeBands.length < 10 && <Button variant="outline" size="sm" className="w-fit" onClick={() => setS({ gradeBands: [...f.settings.gradeBands, { label: '', minPct: 0 }] })}><Plus aria-hidden="true" /> Add band</Button>}
        </fieldset>
      </Section>

      <Section title="After submission" description="What participants can see about the answer key.">
        <RadioGroup value={f.settings.showAnswers} onValueChange={(v) => setS({ showAnswers: v as typeof f.settings.showAnswers })} aria-label="Reveal correct answers" className="grid gap-3">
          {SHOW_ANSWERS.map((v) => (
            <label key={v} className="flex items-start gap-3 text-sm">
              <RadioGroupItem value={v} className="mt-0.5" />
              <span><span className="font-medium">{REVEAL[v].label}</span><span className="block text-muted">{REVEAL[v].hint}</span></span>
            </label>
          ))}
        </RadioGroup>
        <Toggle label="Show explanations" hint="Only when answers are revealed." checked={f.settings.showExplanations} onChange={(v) => setS({ showExplanations: v })} />
      </Section>
    </div>
  );
}
