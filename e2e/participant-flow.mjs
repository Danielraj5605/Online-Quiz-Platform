// Drives the participant taking flow with the keyboard: start → answer → navigator → flag → summary → submit → results.
// Usage: MSYS_NO_PATHCONV=1 node e2e/participant-flow.mjs [baseUrl] [outDir]
import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const base = process.argv[2] ?? 'http://localhost:5173';
const out = process.argv[3] ?? path.join(process.cwd(), 'e2e', 'screenshots', 'participant');
mkdirSync(out, { recursive: true });
// each combo uses a different quiz so a seeded user's attempt limits are never exhausted
const QUIZ_FOR = { 'mobile-light': 'Algebra Essentials', 'desktop-dark': 'Algebra Essentials', 'mobile-dark': 'JavaScript Fundamentals', 'desktop-light': 'Intro to Physics' };
const problems = [];
const errorsRef = { list: [] };
const log = (...a) => console.log(...a);

async function axe(page, name) {
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  const v = r.violations.map((x) => `${x.id} (${x.impact}) x${x.nodes.length}: ${x.nodes[0]?.target?.join(' ')}`);
  log(`  axe ${name}: ${v.length ? v.join(' | ') : 'clean'}`);
  v.forEach((x) => problems.push(`${name}: ${x}`));
}
const shot = (page, name) => page.screenshot({ path: path.join(out, `${name}.png`), fullPage: false });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });
const page = await ctx.newPage();
await page.goto(base + '/login', { waitUntil: 'networkidle' });
await page.getByLabel('Email or username').fill(process.env.QA_USER ?? 'participant@quizzo.dev');
await page.locator('input[type="password"]').fill(process.env.QA_PASS ?? 'Participant#12345');
await page.getByRole('button', { name: 'Sign in' }).click();
await page.waitForURL((u) => !u.pathname.startsWith('/login'));
await page.waitForLoadState('networkidle');
page.on('pageerror', (e) => errorsRef.list.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errorsRef.list.push(m.text()); });
for (const [vw, vh, label] of [[375, 812, 'mobile'], [1280, 800, 'desktop']]) {
  for (const theme of ['light', 'dark']) {
    if (process.env.QA_ONLY && process.env.QA_ONLY !== `${label}-${theme}`) continue;
    log(`\n== ${label}/${theme}`);
    await page.setViewportSize({ width: vw, height: vh });
    await page.evaluate((t) => localStorage.setItem('quizzo-theme', t), theme);
    await page.goto(base + '/');
    await page.waitForLoadState('networkidle');
    const errors = errorsRef.list = [];


    // find the quiz on Discover/Home and open its overview
    await page.getByRole('link', { name: QUIZ_FOR[`${label}-${theme}`] }).first().click();
    await page.waitForURL(/\/quizzes\//);
    await page.waitForLoadState('networkidle');
    await shot(page, `overview-${label}-${theme}`);
    await axe(page, `overview ${label}/${theme}`);

    const startBtn = page.getByRole('button', { name: /Start quiz|Resume/ }).first();
    if (!(await startBtn.isEnabled())) { log('  start disabled (no attempts left?) — skipping flow'); continue; }
    await startBtn.click();
    await page.waitForURL(/\/attempt\//);
    await page.waitForSelector('h1');
    await page.waitForTimeout(400);
    await shot(page, `taker-q1-${label}-${theme}`);
    await axe(page, `taker ${label}/${theme}`);

    // keyboard: pick option B, next, pick option A, flag, next ...
    await page.keyboard.press('2');
    await page.keyboard.press('n');
    await page.waitForTimeout(300);
    const focusedHeading = await page.evaluate(() => document.activeElement?.tagName === 'H1');
    log('  focus moved to question heading after next:', focusedHeading);
    if (!focusedHeading) problems.push(`focus not on heading ${label}/${theme}`);
    await page.keyboard.press('1');
    await page.keyboard.press('f');
    await page.keyboard.press('?');
    await page.waitForSelector('role=dialog');
    await shot(page, `taker-help-${label}-${theme}`);
    await page.keyboard.press('Escape');

    // navigator
    if (vw < 1024) {
      await page.getByRole('button', { name: 'Open question navigator' }).click();
      await page.waitForSelector('role=dialog');
      await shot(page, `taker-navigator-${label}-${theme}`);
      await axe(page, `navigator ${label}/${theme}`);
      await page.keyboard.press('Escape');
    } else {
      await shot(page, `taker-q2-flagged-${label}-${theme}`);
    }

    // wait for autosave to settle
    await page.waitForTimeout(1500);
    const saved = await page.getByRole('status').filter({ hasText: /Saved|Saving|Offline/ }).first().textContent().catch(() => '');
    log('  save indicator:', saved?.trim());

    // fill remaining questions by typing where needed, then open summary
    for (let i = 0; i < 12; i++) {
      const heading = await page.locator('h1').first().textContent();
      const text = page.locator('textarea, input[type=text]:not([role]), input[inputmode=decimal]').first();
      if (await text.count()) { await text.fill('3'); await page.waitForTimeout(100); }
      else await page.keyboard.press('1');
      const last = await page.getByRole('button', { name: /Review & submit/ }).first().isVisible();
      if (last && !(await page.getByRole('button', { name: 'Next' }).count())) break;
      await page.getByRole('button', { name: 'Next' }).click();
      await page.waitForTimeout(150);
      if (!heading) break;
    }
    await page.keyboard.press('Control+Enter');
    await page.waitForSelector('role=dialog');
    await shot(page, `taker-summary-${label}-${theme}`);
    await axe(page, `summary ${label}/${theme}`);
    await page.getByRole('button', { name: 'Submit answers' }).click();
    await page.waitForURL(/\/results\//, { timeout: 20000 });
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(800);
    await shot(page, `results-${label}-${theme}`);
    await page.screenshot({ path: path.join(out, `results-full-${label}-${theme}.png`), fullPage: true });
    await axe(page, `results ${label}/${theme}`);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    if (overflow) problems.push(`results overflow ${label}/${theme}`);
    log('  page errors:', errors.length ? errors.slice(0, 3).join(' | ') : 'none');
    errors.forEach((e) => problems.push(`console ${label}/${theme}: ${e}`));
  }
}
await browser.close();
console.log(problems.length ? `\n${problems.length} problem(s):\n- ${problems.join('\n- ')}` : '\nAll clean');
