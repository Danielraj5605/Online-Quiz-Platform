// Visual QA helper: node e2e/screenshots.mjs [baseUrl] [outDir] [path,path,...]
// Captures each path at mobile (375) and desktop (1280) in light and dark.
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const base = process.argv[2] ?? 'http://localhost:5173';
const out = process.argv[3] ?? path.join(process.cwd(), 'e2e', 'screenshots');
const paths = (process.argv[4] ?? '/login,/register').split(',');
mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
for (const [vw, vh, label] of [[375, 812, 'mobile'], [1280, 800, 'desktop']]) {
  for (const theme of ['light', 'dark']) {
    const ctx = await browser.newContext({ viewport: { width: vw, height: vh }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
    await ctx.addInitScript((t) => localStorage.setItem('quizzo-theme', t), theme);
    const page = await ctx.newPage();
    for (const p of paths) {
      await page.goto(base + p, { waitUntil: 'networkidle' });
      await page.waitForTimeout(400);
      const file = path.join(out, `${p.replace(/\W+/g, '_') || 'home'}-${label}-${theme}.png`);
      await page.screenshot({ path: file, fullPage: true });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
      console.log(file, overflow ? 'HORIZONTAL OVERFLOW' : 'ok');
    }
    await ctx.close();
  }
}
await browser.close();
