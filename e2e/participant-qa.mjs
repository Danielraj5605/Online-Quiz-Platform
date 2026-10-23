// Participant QA: screenshots (375/1280 × light/dark) + axe on every participant route.
// Usage: MSYS_NO_PATHCONV=1 node e2e/participant-qa.mjs [baseUrl] [outDir]
import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const base = process.argv[2] ?? 'http://localhost:5173';
const out = process.argv[3] ?? path.join(process.cwd(), 'e2e', 'screenshots', 'participant');
mkdirSync(out, { recursive: true });

const EMAIL = process.env.QA_USER ?? 'participant@quizzo.dev';
const PASS = process.env.QA_PASS ?? 'Participant#12345';
const routes = (process.env.QA_ROUTES ?? '/,/discover,/join,/progress,/leaderboard,/profile').split(',');

const slug = (p) => (p.replace(/\W+/g, '_') || 'home');
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });
const page = await ctx.newPage();
await page.goto(base + '/login', { waitUntil: 'networkidle' });
await page.getByLabel('Email or username').fill(process.env.QA_USER ?? 'participant@quizzo.dev');
await page.locator('input[type="password"]').fill(process.env.QA_PASS ?? 'Participant#12345');
await page.getByRole('button', { name: 'Sign in' }).click();
await page.waitForURL((u) => !u.pathname.startsWith('/login'));
await page.waitForLoadState('networkidle');
const problems = [];

async function login(page) {
  await page.goto(base + '/login', { waitUntil: 'networkidle' });
  await page.getByLabel('Email or username').fill(EMAIL);
  await page.locator('input[type="password"]').fill(PASS);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'));
}

async function check(page, name, label, theme) {
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);
  const file = path.join(out, `${name}-${label}-${theme}.png`);
  await page.screenshot({ path: file, fullPage: true });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  const v = axe.violations.map((x) => `${x.id} (${x.impact}) x${x.nodes.length}: ${x.nodes[0]?.target?.join(' ')}`);
  console.log(`${name} ${label}/${theme}: ${overflow ? 'OVERFLOW ' : ''}${v.length ? 'AXE ' + v.join(' | ') : 'axe clean'}`);
  if (overflow) problems.push(`${name} ${label} ${theme} overflow`);
  v.forEach((x) => problems.push(`${name} ${label} ${theme}: ${x}`));
}

for (const [vw, vh, label] of [[375, 812, 'mobile'], [1280, 800, 'desktop']]) {
  for (const theme of ['light', 'dark']) {
    await page.setViewportSize({ width: vw, height: vh });
    await page.evaluate((t) => localStorage.setItem('quizzo-theme', t), theme);
    await page.goto(base + '/');
    await page.waitForLoadState('networkidle');
    for (const r of routes) {
      await page.goto(base + r);
      await check(page, slug(r), label, theme);
    }
  }
}
await browser.close();
console.log(problems.length ? `\n${problems.length} problem(s)` : '\nAll clean');
