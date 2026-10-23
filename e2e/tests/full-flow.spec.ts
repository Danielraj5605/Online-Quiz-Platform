import { test, expect, type APIRequestContext, type Page } from '@playwright/test';

const API = 'http://localhost:5000/api/v1';
const run = Date.now().toString(36);
const PASSWORD = 'E2ePassw0rd';

async function register(request: APIRequestContext, role: 'ORGANIZER' | 'PARTICIPANT') {
  const username = `e2e_${role.toLowerCase().slice(0, 3)}_${run}`;
  const res = await request.post(`${API}/auth/register`, { data: { username, email: `${username}@example.com`, password: PASSWORD, role } });
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  return { username, token: body.data.accessToken as string };
}

async function login(page: Page, identifier: string) {
  await page.goto('/login');
  await page.getByLabel(/email or username/i).fill(identifier);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'));
}

test('organizer publishes → participant takes → organizer grades → reports are correct', async ({ browser, request }) => {
  const org = await register(request, 'ORGANIZER');
  const part = await register(request, 'PARTICIPANT');
  const auth = { Authorization: `Bearer ${org.token}` };
  const title = `E2E Quiz ${run}`;

  /* ── organizer creates the quiz in the UI ── */
  const orgCtx = await browser.newContext();
  const orgPage = await orgCtx.newPage();
  await login(orgPage, org.username);
  await orgPage.goto('/studio/quizzes');
  await orgPage.getByRole('button', { name: /new quiz/i }).first().click();
  await orgPage.getByRole('dialog').getByLabel(/^title/i).fill(title);
  await orgPage.getByRole('button', { name: /create & start building/i }).click();
  await orgPage.waitForURL(/\/studio\/quizzes\/[^/]+\/build/);
  const quizId = orgPage.url().match(/quizzes\/([^/]+)\/build/)![1];

  // first question (single choice, 1 pt) through the builder UI
  await orgPage.getByRole('button', { name: /add first question/i }).click();
  await orgPage.getByRole('textbox', { name: /^question/i }).fill('Which gas do plants absorb for photosynthesis?');
  await orgPage.getByLabel('Option 1 text').fill('Carbon dioxide');
  await orgPage.getByLabel('Option 2 text').fill('Oxygen');
  await orgPage.getByLabel('Option 3 text').fill('Nitrogen');
  await orgPage.getByLabel(/Option 1 is (the )?correct/i).check();
  await expect(orgPage.getByRole('status').filter({ hasText: /Saved/ }).first()).toBeVisible({ timeout: 15_000 });

  // long-answer question (4 pts, manual grading) + public access via API
  const q2 = await request.post(`${API}/quizzes/${quizId}/questions`, {
    headers: auth,
    data: { type: 'LONG_ANSWER', text: 'Explain why leaves are green.', points: 4, options: [], config: { rubric: [{ criterion: 'Accuracy', maxPoints: 4 }], maxLength: 2000 } },
  });
  expect(q2.ok()).toBeTruthy();
  expect((await request.put(`${API}/quizzes/${quizId}/access`, { headers: auth, data: { visibility: 'PUBLIC' } })).ok()).toBeTruthy();

  // publish via UI
  await orgPage.reload();
  await orgPage.getByRole('button', { name: /^publish$/i }).click();
  await orgPage.getByRole('dialog').getByRole('button', { name: /^publish$/i }).click();
  await expect(orgPage.getByText(/^Live$/).first()).toBeVisible({ timeout: 15_000 });

  /* ── participant takes it ── */
  const partCtx = await browser.newContext();
  const partPage = await partCtx.newPage();
  await login(partPage, part.username);
  await partPage.goto('/discover');
  await partPage.getByLabel(/search/i).first().fill(title);
  await partPage.getByRole('link', { name: title }).first().click();
  await partPage.getByRole('button', { name: /start quiz/i }).first().click();
  await partPage.waitForURL(/\/attempt\//);
  await partPage.keyboard.press('1'); // Carbon dioxide
  await partPage.getByRole('button', { name: 'Next' }).click();
  await partPage.locator('textarea').first().fill('Chlorophyll reflects green light.');
  await partPage.keyboard.press('Control+Enter');
  await partPage.getByRole('button', { name: 'Submit answers' }).click();
  await partPage.waitForURL(/\/results\//);
  await expect(partPage.getByText(/pending|manual/i).first()).toBeVisible();
  const attemptId = partPage.url().match(/results\/([^/?]+)/)![1];

  /* ── organizer grades (3 / 4) ── */
  await orgPage.goto(`/studio/quizzes/${quizId}/grading`);
  await orgPage.locator('section[aria-label="Submission queue"] li > button').first().click();
  await orgPage.getByLabel(/^score/i).first().fill('3');
  await orgPage.getByLabel(/feedback/i).first().fill('Good explanation.');
  await orgPage.keyboard.press('Control+Enter');
  await expect.poll(async () => {
    const r = await request.get(`${API}/attempts/${attemptId}/grading`, { headers: auth });
    return (await r.json()).data?.status;
  }, { timeout: 15_000 }).toBe('GRADED');

  /* ── reports show the right numbers: (1 + 3) / 5 = 80 % ── */
  const summary = (await (await request.get(`${API}/quizzes/${quizId}/reports/summary`, { headers: auth })).json()).data;
  expect(summary.attempts).toBe(1);
  expect(Math.round(summary.avgPct)).toBe(80);
  expect(summary.passRate).toBe(1);

  await orgPage.goto(`/studio/quizzes/${quizId}/reports`);
  await expect(orgPage.getByText(/80\s?%/).first()).toBeVisible({ timeout: 15_000 });

  // participant sees the final result
  await partPage.reload();
  await expect(partPage.getByText(/80\s?%/).first()).toBeVisible({ timeout: 15_000 });

  await orgCtx.close();
  await partCtx.close();
});
