// Organizer UI B drive-through: grading workspace, reports, question bank, cohorts.
// usage: node e2e/organizer-b.mjs [baseUrl] [outDir]
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const base = process.argv[2] ?? 'http://localhost:5173';
const out = process.argv[3] ?? path.join(process.cwd(), 'e2e', 'screenshots', 'organizer-b');
mkdirSync(out, { recursive: true });
const log = (...a) => console.log(...a);
const errors = [];

async function login(page) {
  await page.goto(base + '/login', { waitUntil: 'networkidle' });
  await page.getByLabel(/email or username/i).fill('organizer@quizzo.dev');
  await page.locator('input[type=password]').fill('Organizer#12345');
  await page.getByRole('button', { name: /sign in|log in/i }).click();
  await page.waitForURL('**/studio**');
}
const shot = async (page, name) => { const f = path.join(out, `${name}.png`); await page.screenshot({ path: f, fullPage: true }); log('shot', name); };
const overflow = (page) => page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
const watch = (page) => {
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
};

const browser = await chromium.launch();

// discover quiz ids through the API with a throwaway login
let quizzes = [];
{
  const ctx = await browser.newContext();
  const res = await ctx.request.post(base + '/api/v1/auth/login', { data: { identifier: 'organizer@quizzo.dev', password: 'Organizer#12345' } });
  const token = (await res.json()).data.accessToken;
  const list = await ctx.request.get(base + '/api/v1/quizzes?pageSize=50&mine=true', { headers: { Authorization: `Bearer ${token}` } });
  quizzes = (await list.json()).data;
  await ctx.close();
}
log('quizzes:', quizzes.map((q) => `${q.title} [${q.status}]`).join(' | '));
const gradingQuiz = quizzes.find((q) => /javascript|js/i.test(q.title)) ?? quizzes.find((q) => /physics/i.test(q.title)) ?? quizzes[0];
const reportQuiz = quizzes.find((q) => q.id !== gradingQuiz?.id && /python|geography|algebra/i.test(q.title)) ?? gradingQuiz;
log('grading quiz:', gradingQuiz?.title, '| report quiz:', reportQuiz?.title);

const pages = [
  [`/studio/quizzes/${gradingQuiz.id}/grading`, 'grading'],
  [`/studio/quizzes/${reportQuiz.id}/reports?tab=summary`, 'reports-summary'],
  [`/studio/quizzes/${reportQuiz.id}/reports?tab=items`, 'reports-items'],
  [`/studio/quizzes/${reportQuiz.id}/reports?tab=participants`, 'reports-participants'],
  [`/studio/quizzes/${reportQuiz.id}/reports?tab=cohorts`, 'reports-cohorts'],
  [`/studio/quizzes/${reportQuiz.id}/reports?tab=export`, 'reports-export'],
  ['/studio/bank', 'bank'],
  ['/studio/cohorts', 'cohorts'],
];

// One login for the whole run (the auth route allows 20 per 15 minutes); viewport and theme are switched in place.
const mainCtx = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
const mainPage = await mainCtx.newPage();
watch(mainPage);
await login(mainPage);
const setTheme = (page, t) => page.evaluate((th) => { localStorage.setItem('quizzo-theme', th); document.documentElement.classList.toggle('dark', th === 'dark'); }, t);

for (const [vw, vh, label] of [[375, 812, 'mobile'], [1280, 900, 'desktop']]) {
  await mainPage.setViewportSize({ width: vw, height: vh });
  for (const theme of ['light', 'dark']) {
    for (const [p, name] of pages) {
      await setTheme(mainPage, theme);
      await mainPage.goto(base + p, { waitUntil: 'networkidle' });
      await setTheme(mainPage, theme);
      await mainPage.waitForTimeout(500);
      if (name === 'grading' && label === 'mobile') {
        // mobile starts at the queue; open the first submission to show the grading panel too
        await shot(mainPage, `${name}-queue-${label}-${theme}`);
        const first = mainPage.locator('section[aria-label="Submission queue"] li > button').first();
        if (await first.count()) { await first.click(); await mainPage.waitForTimeout(700); }
      }
      await shot(mainPage, `${name}-${label}-${theme}`);
      if (await overflow(mainPage)) log('  HORIZONTAL OVERFLOW on', name, label, theme);
    }
  }
}
await mainPage.setViewportSize({ width: 1280, height: 900 });
await setTheme(mainPage, 'light');

// ── interactive grading run (desktop, light)
{
  const page = mainPage;
  await page.goto(base + `/studio/quizzes/${gradingQuiz.id}/grading`, { waitUntil: 'networkidle' });
  await page.waitForSelector('article', { timeout: 15000 });
  const before = await page.locator('section[aria-label="Submission queue"] ul > li').count();
  log('queue rows:', before);

  // help dialog
  await page.keyboard.press('?');
  await page.waitForSelector('text=Keyboard shortcuts');
  await shot(page, 'grading-help');
  await page.keyboard.press('Escape');

  // J moves to the next submission (URL param changes)
  const url0 = page.url();
  await page.keyboard.press('j');
  await page.waitForTimeout(600);
  log('J changed submission:', page.url() !== url0);
  await page.keyboard.press('k');
  await page.waitForTimeout(600);
  log('K returned:', page.url() === url0);

  // digit shortcuts score the highlighted criterion/question
  await page.locator('article').first().click({ position: { x: 10, y: 10 } });
  await page.keyboard.press('3');
  await page.waitForTimeout(200);
  await shot(page, 'grading-scored');

  // typing in the feedback box must not trigger shortcuts
  const fb = page.locator('textarea').first();
  await fb.fill('Nice work — j k 5 ? are just letters here');
  const stillSame = page.url() === url0;
  log('typing j/k/5/? in feedback kept the page:', stillSame);

  // Ctrl+Enter saves
  const saveResp = page.waitForResponse((r) => r.url().includes('/grading') && r.request().method() === 'PUT', { timeout: 15000 }).catch(() => null);
  await page.keyboard.press('Control+Enter');
  const resp = await saveResp;
  log('save response status:', resp ? resp.status() : 'none (nothing to save?)');
  await page.waitForTimeout(1000);
  await shot(page, 'grading-after-save');
}

// ── bank + cohorts interactions
{
  const page = mainPage;
  await page.goto(base + '/studio/bank', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /new question/i }).click();
  await page.waitForSelector('role=dialog');
  await shot(page, 'bank-form');
  await page.getByLabel('Question').fill('Playwright smoke: which planet is known as the Red Planet?');
  await page.getByLabel('Option 1 text').fill('Mars');
  await page.getByLabel('Option 2 text').fill('Venus');
  await page.getByLabel('Option 3 text').fill('Jupiter');
  await page.getByLabel('Option 4 text').fill('Saturn');
  await page.getByRole('button', { name: /add to bank/i }).click();
  await page.waitForSelector('role=dialog', { state: 'detached' });
  await page.getByLabel('Search questions').fill('Playwright smoke');
  await page.waitForTimeout(900);
  await shot(page, 'bank-after-create');
  log('bank row visible:', await page.getByText('Playwright smoke').count());
  // clean up the smoke question
  await page.getByRole('button', { name: 'Delete question' }).first().click();
  await page.getByRole('button', { name: /^delete$/i }).click();
  await page.waitForTimeout(800);

  await page.goto(base + '/studio/cohorts', { waitUntil: 'networkidle' });
  await page.locator('section[aria-label="Your cohorts"] ul button').first().click();
  await page.waitForTimeout(1200);
  await shot(page, 'cohorts-detail');
}

await browser.close();
log(errors.length ? 'ERRORS:\n' + [...new Set(errors)].join('\n') : 'no console/page errors');
