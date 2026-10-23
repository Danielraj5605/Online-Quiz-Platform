// Non-mutating interaction check: palette, shortcuts dialog, disable-confirm dialog. node e2e/admin-interactions.mjs [baseUrl] [outDir]
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const base = process.argv[2] ?? 'http://localhost:5173';
const out = process.argv[3] ?? path.join(process.cwd(), 'e2e', 'screenshots', 'admin');
mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });
const page = await ctx.newPage();
await page.goto(base + '/login', { waitUntil: 'networkidle' });
await page.getByLabel('Email or username').fill('admin@quizzo.dev');
await page.locator('input[type=password]').first().fill('Admin#12345');
await page.getByRole('button', { name: 'Sign in' }).click();
await page.waitForURL('**/admin');
await page.waitForTimeout(1000);

await page.keyboard.press('Control+k');
await page.locator('[cmdk-input]').waitFor();
await page.screenshot({ path: path.join(out, 'palette.png') });
const items = await page.getByRole('option').allInnerTexts();
console.log('palette items:', items.join(' | '));
await page.keyboard.press('Escape');

await page.waitForTimeout(500);
await page.keyboard.type('?');
await page.getByRole('dialog', { name: 'Keyboard shortcuts' }).waitFor();
await page.screenshot({ path: path.join(out, 'shortcuts.png') });
await page.keyboard.press('Escape');

await page.goto(base + '/admin/users', { waitUntil: 'networkidle' });
await page.getByRole('button', { name: /^Disable learner/ }).first().click();
await page.getByRole('dialog').waitFor();
await page.screenshot({ path: path.join(out, 'disable-confirm.png') });
await page.getByRole('button', { name: 'Cancel' }).click();
const self = await page.getByRole('button', { name: /^Disable KIngDani|^Disable admin/i }).first().isDisabled().catch(() => 'n/a');
console.log('self disable button disabled:', self);
await browser.close();
