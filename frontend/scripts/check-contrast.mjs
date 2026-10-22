// Verifies WCAG contrast for every text/background token pair in both themes.
// Reads token hex values from src/index.css (:root and .dark blocks). Exit 1 on any failure.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const css = readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '../src/index.css'), 'utf8');

function block(selector) {
  const m = css.match(new RegExp(`${selector.replace('.', '\\.')}\\s*\\{([\\s\\S]*?)\\n\\}`));
  if (!m) throw new Error(`block ${selector} not found`);
  const out = {};
  for (const [, k, v] of m[1].matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) out[k] = v;
  return out;
}

const lum = (hex) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const ratio = (a, b) => {
  const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
};

// [foreground, background, minimum ratio, why]
const TEXT = 4.5;
const UI = 3;
const pairs = [
  ['text', 'bg', TEXT], ['text', 'surface', TEXT], ['text', 'surface-2', TEXT],
  ['text-muted', 'bg', TEXT], ['text-muted', 'surface', TEXT], ['text-muted', 'surface-2', TEXT],
  ['on-accent', 'accent', TEXT], ['on-accent', 'accent-hover', TEXT],
  ['accent', 'bg', TEXT], ['accent', 'surface', TEXT], ['accent-hover', 'bg', TEXT],
  ['accent', 'accent-soft', TEXT], ['text', 'accent-soft', TEXT],
  ['teal', 'bg', TEXT], ['teal', 'surface', TEXT], ['teal', 'teal-soft', TEXT],
  ['success', 'bg', TEXT], ['success', 'surface', TEXT], ['success', 'success-soft', TEXT],
  ['warning', 'bg', TEXT], ['warning', 'surface', TEXT], ['warning', 'warning-soft', TEXT],
  ['danger', 'bg', TEXT], ['danger', 'surface', TEXT], ['danger', 'danger-soft', TEXT],
  // non-text UI: input borders, focus ring
  ['border-strong', 'bg', UI], ['border-strong', 'surface', UI],
  ['focus', 'bg', UI], ['focus', 'surface', UI], ['focus', 'surface-2', UI],
  ['accent', 'bg', UI],
];

let failed = 0;
for (const [theme, tokens] of [['light', block(':root')], ['dark', block('.dark')]]) {
  for (const [fg, bg, min] of pairs) {
    if (!tokens[fg] || !tokens[bg]) { console.error(`✗ [${theme}] missing token ${fg} or ${bg}`); failed++; continue; }
    const r = ratio(tokens[fg], tokens[bg]);
    const ok = r >= min;
    if (!ok) failed++;
    if (!ok || process.argv.includes('--verbose')) console.log(`${ok ? '✓' : '✗'} [${theme}] ${fg} on ${bg}: ${r.toFixed(2)}:1 (min ${min})`);
  }
}
if (failed) { console.error(`\n${failed} contrast check(s) failed`); process.exit(1); }
console.log(`Contrast OK — ${pairs.length * 2} pairs across light and dark`);
