// Registers a throwaway organizer + participant through the UI, then screenshots the app chrome.
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const base = process.argv[2] ?? 'http://localhost:5173';
mkdirSync('e2e/screenshots', { recursive: true });
const sfx = Math.random().toString(36).slice(2, 7);
const browser = await chromium.launch();

for (const role of ['Organizer', 'Participant']) {
  for (const [vw, vh, label] of [[375, 812, 'mobile'], [1280, 800, 'desktop']]) {
    const ctx = await browser.newContext({ viewport: { width: vw, height: vh }, reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    await page.goto(`${base}/register`);
    await page.getByText(role, { exact: true }).first().click();
    const u = `${role.toLowerCase()}_${sfx}_${label}`;
    await page.getByLabel(/^Username/).fill(u);
    await page.getByLabel(/^Email/).fill(`${u}@example.com`);
    await page.getByLabel(/^Password/).fill('Passw0rdX');
    await page.getByRole('button', { name: 'Create account' }).click();
    await page.waitForURL(role === 'Organizer' ? '**/studio' : base + '/');
    await page.waitForTimeout(600);
    await page.screenshot({ path: `e2e/screenshots/shell-${role.toLowerCase()}-${label}.png` });
    console.log(role, label, page.url(), await page.title());
    // keyboard: open command palette
    await page.keyboard.press('Control+k');
    await page.waitForTimeout(300);
    console.log('  palette open:', await page.getByRole('dialog', { name: /command palette/i }).isVisible());
    await page.keyboard.press('Escape');
    // reload keeps session (refresh cookie)
    await page.reload();
    await page.waitForTimeout(800);
    console.log('  after reload:', page.url());
    // wrong-area access
    await page.goto(`${base}/admin`);
    await page.waitForTimeout(1500);
    console.log('  /admin ->', page.url());
    await ctx.close();
  }
}
await browser.close();
