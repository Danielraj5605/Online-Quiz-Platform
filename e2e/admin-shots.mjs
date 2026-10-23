// Visual QA for the admin area: node e2e/admin-shots.mjs [baseUrl] [outDir]
// Logs in as the seeded admin, captures each admin page at 375/1280 in light/dark, reports overflow and console errors.
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const base = process.argv[2] ?? 'http://localhost:5173';
const out = process.argv[3] ?? path.join(process.cwd(), 'e2e', 'screenshots', 'admin');
const paths = ['/admin', '/admin/users', '/admin/quizzes', '/admin/moderation', '/admin/audit'];
mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
for (const [vw, vh, label] of [[375, 812, 'mobile'], [1280, 800, 'desktop']]) {
  for (const theme of ['light', 'dark']) {
    const ctx = await browser.newContext({ viewport: { width: vw, height: vh }, reducedMotion: 'reduce' });
    await ctx.addInitScript((t) => localStorage.setItem('quizzo-theme', t), theme);
    const page = await ctx.newPage();
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto(base + '/login', { waitUntil: 'networkidle' });
    await page.getByLabel('Email or username').fill('admin@quizzo.dev');
    await page.locator('input[type=password], input[autocomplete=current-password]').first().fill('Admin#12345');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL('**/admin', { timeout: 15000 });
    for (const p of paths) {
      await page.goto(base + p, { waitUntil: 'networkidle' }).catch(() => {});
      await page.waitForTimeout(600);
      const file = path.join(out, `${p.replace(/\W+/g, '_')}-${label}-${theme}.png`);
      await page.screenshot({ path: file, fullPage: true });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
      console.log(path.basename(file), overflow ? 'HORIZONTAL OVERFLOW' : 'ok');
    }
    if (errors.length) console.log(`[${label}/${theme}] console errors:`, [...new Set(errors)].slice(0, 5));
    await ctx.close();
  }
}
await browser.close();
