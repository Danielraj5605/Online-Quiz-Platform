import type { ItemAnalysisRow } from '@/lib/api/types';

export type FlagTone = 'danger' | 'warning' | 'teal' | 'success';
export interface ItemFlag { id: string; tone: FlagTone; label: string; detail: string }

/** Below this many graded responses the statistics are too noisy to judge. */
export const MIN_RESPONSES = 5;

/**
 * Plain-language review flags for one question, from classical test theory:
 *  difficulty = share of available points earned (p-value), discrimination = top-27% minus bottom-27% success.
 */
export function itemFlags(row: ItemAnalysisRow): ItemFlag[] {
  const flags: ItemFlag[] = [];
  if (row.responses < MIN_RESPONSES) {
    return [{ id: 'few', tone: 'teal', label: 'Too few responses', detail: `Only ${row.responses} graded response${row.responses === 1 ? '' : 's'} so far — wait for more before judging this question.` }];
  }
  const { difficulty: p, discrimination: d } = row;

  if (p != null) {
    if (p >= 0.9) flags.push({ id: 'easy', tone: 'warning', label: 'Too easy', detail: `${pct(p)} of points earned. Almost everyone gets this right, so it tells you little.` });
    else if (p <= 0.3) flags.push({ id: 'hard', tone: 'warning', label: 'Very hard', detail: `Only ${pct(p)} of points earned. Check the wording and the key before blaming learners.` });
  }
  if (d != null) {
    if (d < 0) flags.push({ id: 'negative', tone: 'danger', label: 'Check the answer key', detail: 'Stronger participants did worse here than weaker ones. The key or wording may be wrong.' });
    else if (d < 0.2 && !(p != null && (p >= 0.9 || p <= 0.1))) flags.push({ id: 'poor', tone: 'warning', label: 'Poor discrimination', detail: 'It barely separates strong from weak participants. Consider rewriting it.' });
    else if (d >= 0.4) flags.push({ id: 'great', tone: 'success', label: 'Discriminates well', detail: 'Strong participants clearly outperform weak ones on this question.' });
  }
  if (row.omitRate >= 0.2) flags.push({ id: 'skipped', tone: 'warning', label: 'Often skipped', detail: `${pct(row.omitRate)} of participants left it blank — it may be unclear or too long.` });

  if (row.distractors.length > 0) {
    const correctPicks = row.distractors.filter((x) => x.isCorrect).reduce((a, b) => a + b.count, 0);
    const wrong = row.distractors.filter((x) => !x.isCorrect);
    const unused = wrong.filter((x) => x.count === 0);
    if (unused.length > 0 && wrong.length > 1) {
      flags.push({ id: 'unused', tone: 'teal', label: 'Unused distractor', detail: `${unused.length} wrong option${unused.length === 1 ? ' was' : 's were'} never chosen. Make ${unused.length === 1 ? 'it' : 'them'} more plausible.` });
    }
    const top = wrong.reduce<(typeof wrong)[number] | null>((m, x) => (!m || x.count > m.count ? x : m), null);
    if (top && top.count > correctPicks && row.distractors.length > 1) {
      flags.push({ id: 'magnet', tone: 'danger', label: 'A wrong option beat the key', detail: `“${top.text}” was chosen more often than the correct answer.` });
    }
  }
  return flags;
}

const pct = (n: number) => `${Math.round(n * 100)}%`;
export const difficultyLabel = (p: number | null) => (p == null ? '—' : pct(p));
export const discriminationLabel = (d: number | null) => (d == null ? '—' : (d > 0 ? '+' : '') + d.toFixed(2));
