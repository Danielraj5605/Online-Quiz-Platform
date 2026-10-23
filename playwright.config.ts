import { defineConfig, devices } from '@playwright/test';

const WEB = process.env.E2E_BASE_URL ?? 'http://localhost:5173';

export default defineConfig({
  testDir: './e2e/tests',
  timeout: 240_000, // the full-flow spec spans four role switches; a remote database adds 1–2 s per request
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { baseURL: WEB, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } },
    { name: 'mobile', use: { ...devices['Pixel 7'] }, testMatch: /.*\.mobile\.spec\.ts/ },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : [
        { command: 'npm run dev:api', url: 'http://localhost:5000/health', reuseExistingServer: true, timeout: 120_000 },
        { command: 'npm run dev:web', url: WEB, reuseExistingServer: true, timeout: 120_000 },
      ],
});
