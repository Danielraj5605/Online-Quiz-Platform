import { quizSettingsSchema, type CreateQuizInput, type Difficulty, type QuizDetailDto, type QuizSettings } from '@quiz/shared';

/** Everything the Settings tab edits, in a flat shape that is easy to diff and validate. */
export interface SettingsForm {
  title: string; description: string; categoryId: string | null; difficulty: Difficulty; tags: string[];
  settings: QuizSettings; opensAt: string | null; closesAt: string | null;
}

export const fromQuiz = (q: QuizDetailDto): SettingsForm => ({
  title: q.title, description: q.description, categoryId: q.category?.id ?? null, difficulty: q.difficulty, tags: q.tags,
  settings: q.settings, opensAt: q.opensAt, closesAt: q.closesAt,
});

export function validateSettings(f: SettingsForm): Record<string, string> {
  const e: Record<string, string> = {};
  if (f.title.trim().length < 3) e.title = 'Title must be at least 3 characters';
  const s = quizSettingsSchema.safeParse(f.settings);
  if (!s.success) for (const i of s.error.issues) e[`settings.${i.path.join('.')}`] ??= i.message;
  if (f.opensAt && f.closesAt && new Date(f.closesAt) <= new Date(f.opensAt)) e.closesAt = 'Closing time must be after the opening time';
  if (f.settings.gradeBands.length && !f.settings.gradeBands.some((b) => b.minPct === 0)) e['settings.gradeBands'] = 'Include a band that starts at 0%';
  return e;
}

/** Only the keys that changed, in the shape PATCH /quizzes/:id expects. `before` mirrors it for undo. */
export function diffPatch(prev: SettingsForm, next: SettingsForm): { patch: Partial<CreateQuizInput>; before: Partial<CreateQuizInput> } {
  const patch: Record<string, unknown> = {};
  const before: Record<string, unknown> = {};
  const keys: (keyof SettingsForm)[] = ['title', 'description', 'categoryId', 'difficulty', 'tags', 'settings', 'opensAt', 'closesAt'];
  for (const k of keys) {
    if (JSON.stringify(prev[k]) !== JSON.stringify(next[k])) { patch[k] = next[k]; before[k] = prev[k]; }
  }
  if ('title' in patch) patch.title = (patch.title as string).trim();
  return { patch: patch as Partial<CreateQuizInput>, before: before as Partial<CreateQuizInput> };
}

/** ISO <-> value of <input type="datetime-local"> (local time, minute precision). */
export const toLocalInput = (iso: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};
export const fromLocalInput = (v: string) => (v ? new Date(v).toISOString() : null);
