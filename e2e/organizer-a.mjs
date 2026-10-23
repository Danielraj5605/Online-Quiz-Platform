// Organizer UI A drive-through: dashboard, quizzes, builder (create → add question → settings → access → publish), monitor.
// usage: node e2e/organizer-a.mjs [baseUrl] [outDir]
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const base = process.argv[2] ?? 'http://localhost:5173';
const out = process.argv[3] ?? path.join(process.cwd(), 'e2e', 'screenshots', 'organizer-a');
mkdirSync(out, { recursive: true });
const log = (...a) => console.log(...a);

async function login(page) {
  await page.goto(base + '/login', { waitUntil: 'networkidle' });
  await page.getByLabel(/email or username/i).fill('organizer@quizzo.dev');
  await page.locator('input[autocomplete="current-password"]').fill('Organizer#12345');
  await page.getByRole('button', { name: /sign in|log in/i }).click();
  await page.waitForURL('**/studio**');
}
const shot = async (page, name) => { const f = path.join(out, `${name}.png`); await page.screenshot({ path: f, fullPage: true }); log('shot', f); };
const overflow = (page) => page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
const firstLine = async (page) => (await page.getByRole("article", { name: "Question 1" }).innerText()).split(String.fromCharCode(10)).find((l) => l.length > 6);

const browser = await chromium.launch();
const errors = [];

// ── interactive run (desktop, light)
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
  await ctx.addInitScript(() => localStorage.setItem('quizzo-theme', 'light'));
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await login(page);
  await page.getByText('Needs grading').first().waitFor();
  await page.waitForTimeout(500);
  await shot(page, '01-dashboard-desktop-light');

  await page.goto(base + '/studio/quizzes', { waitUntil: 'networkidle' });
  await shot(page, '02-quizzes-desktop-light');

  // create a quiz
  await page.locator('tbody tr').first().waitFor();
  await page.getByRole('button', { name: /new quiz/i }).first().click();
  await page.getByRole('dialog').waitFor();
  await page.getByRole('dialog').getByLabel(/^title/i).fill('Playwright photosynthesis quiz');
  await page.getByRole('button', { name: /create & start building/i }).click();
  await page.waitForURL(/\/build/);
  await page.waitForLoadState('networkidle');
  await shot(page, '03-builder-empty-desktop-light');

  // add a first question and fill it
  await page.getByRole('button', { name: /add first question/i }).click();
  await page.getByRole('textbox', { name: /^question/i }).fill('Which gas do plants absorb for photosynthesis?');
  await page.getByLabel('Option 1 text').fill('Carbon dioxide');
  await page.getByLabel('Option 2 text').fill('Oxygen');
  await page.getByLabel('Option 3 text').fill('Nitrogen');
  await page.waitForTimeout(1800); // autosave
  await shot(page, '04-builder-question-desktop-light');

  // second question: true/false via type select
  await page.getByRole('button', { name: /^add question$/i }).first().click();
  const newCard = page.getByRole('article', { name: /new question/i });
  await newCard.getByRole('combobox').first().click();
  await page.getByRole('option', { name: /true \/ false/i }).click();
  await newCard.getByRole('textbox', { name: /^question/i }).fill('Chlorophyll is green.');
  await page.waitForTimeout(1800);
  log('saved indicator:', (await page.getByRole('status').filter({ hasText: /Saved|Saving/ }).first().textContent())?.trim());

  // add a section + undo / redo
  await page.getByRole('button', { name: /add section/i }).click();
  await page.waitForTimeout(800);
  await shot(page, '05-builder-section-desktop-light');
  await page.getByRole('button', { name: /^undo/i }).click();
  await page.waitForTimeout(800);
  log('sections after undo:', await page.getByRole('region', { name: /^Section/ }).count());
  await page.getByRole('button', { name: /^redo/i }).click();
  await page.waitForTimeout(800);
  log('sections after redo:', await page.getByRole('region', { name: /^Section/ }).count());

  // collapse the open card, then drag question 2 above question 1 with the pointer
  await page.getByRole('button', { name: /chlorophyll is green/i }).first().click();
  const h2 = await page.getByRole('button', { name: /drag question 2/i }).boundingBox();
  const h1 = await page.getByRole('button', { name: /drag question 1/i }).boundingBox();
  await page.mouse.move(h2.x + h2.width / 2, h2.y + h2.height / 2);
  await page.mouse.down();
  await page.mouse.move(h2.x + 5, h2.y - 20, { steps: 6 });
  await page.mouse.move(h1.x + 5, h1.y - 4, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(1200);
  log("first question after drag:", await firstLine(page));
  // keyboard / button move back down
  await page.getByRole('button', { name: /move question 1 down/i }).click();
  await page.waitForTimeout(1000);
  log("first question after Move down:", await firstLine(page));

  // settings
  await page.getByRole('tab', { name: 'Settings' }).click();
  await page.getByLabel('Attempts allowed per participant').fill('2');
  await page.waitForTimeout(1500);
  await shot(page, '06-builder-settings-desktop-light');

  // access
  await page.getByRole('tab', { name: 'Access' }).click();
  await page.getByText('Who can take this quiz').waitFor();
  await page.waitForTimeout(400);
  await shot(page, '07-builder-access-desktop-light');

  // preview
  await page.getByRole('tab', { name: 'Preview' }).click();
  await shot(page, '08-builder-preview-desktop-light');

  // publish
  await page.getByRole('button', { name: /^publish$/i }).click();
  await page.waitForTimeout(400);
  await shot(page, '09-publish-dialog-desktop-light');
  await page.getByRole('dialog').getByRole('button', { name: /^publish$/i }).click();
  await page.waitForTimeout(1500);
  log('status badge after publish:', (await page.getByText(/^Live$/).first().textContent().catch(() => 'n/a')));
  await shot(page, '10-builder-live-desktop-light');

  // edit live quiz → "Publish changes"
  await page.getByRole('tab', { name: 'Questions' }).click();
  await page.getByRole('button', { name: /question 1/i }).first().click().catch(() => {});
  await page.waitForTimeout(500);
  log('overflow desktop builder:', await overflow(page));

  // monitor
  const url = page.url().split('?')[0].replace('/build', '/monitor');
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.getByText(/Nobody has started yet|Participant/).first().waitFor();
  await shot(page, '11-monitor-desktop-light');
  await ctx.close();
}

// ── screenshot matrix: ONE login (auth is rate limited and refresh tokens rotate), then vary viewport + theme
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  await login(page);
  for (const [vw, vh, label] of [[375, 812, 'mobile'], [1280, 800, 'desktop']]) {
    for (const theme of ['light', 'dark']) {
      await page.setViewportSize({ width: vw, height: vh });
      await page.evaluate((t) => localStorage.setItem('quizzo-theme', t), theme);
      await page.goto(base + '/studio', { waitUntil: 'domcontentloaded' });
      await page.getByText('Needs grading').first().waitFor();
      await page.waitForTimeout(500);
      await shot(page, `m-dashboard-${label}-${theme}`);
      log(' overflow', label, theme, 'dashboard', await overflow(page));
      await page.goto(base + '/studio/quizzes', { waitUntil: 'domcontentloaded' });
      await page.locator('tbody tr, ul[aria-label="Your quizzes"] li').first().waitFor();
      await shot(page, `m-quizzes-${label}-${theme}`);
      log(' overflow', label, theme, 'quizzes', await overflow(page));
      await page.locator('tbody tr, ul[aria-label="Your quizzes"] li').first().click();
      await page.waitForURL(/\/build/);
      await page.getByRole('tab', { name: 'Settings' }).waitFor();
      await page.waitForTimeout(600);
      await shot(page, `m-builder-${label}-${theme}`);
      log(' overflow', label, theme, 'builder', await overflow(page));
      const monUrl = page.url().split('?')[0].replace('/build', '/monitor');
      await page.goto(monUrl, { waitUntil: 'domcontentloaded' });
      await page.locator('tbody tr, ul[aria-label="Participants and their attempt progress"] li').first().waitFor().catch(() => {});
      await page.waitForTimeout(500);
      await shot(page, `m-monitor-${label}-${theme}`);
      log(' overflow', label, theme, 'monitor', await overflow(page));
    }
  }
  await ctx.close();
}
await browser.close();
log(errors.length ? 'ERRORS:\n' + [...new Set(errors)].join('\n') : 'no console/page errors');
