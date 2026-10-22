import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { QuizDetailDto, ResultDto, AttemptViewDto } from '@quiz/shared';
import { prisma } from '../src/core/db';
import { sweepExpiredAttempts } from '../src/modules/attempts/sweeper';
import { api, cleanupUsers, registerUser, type TestUser } from './helpers';

let org: TestUser, org2: TestUser, p1: TestUser, p2: TestUser, p3: TestUser;
let quiz: QuizDetailDto;
let q: Record<'single' | 'multi' | 'short' | 'num' | 'long', QuizDetailDto['questions'][number]>;

async function buildQuiz(owner: TestUser, title: string, settings: object, questions: object[]): Promise<QuizDetailDto> {
  const c = await api(owner.token).post('/quizzes', { title, settings });
  expect(c.status).toBe(201);
  const id = c.body.data.id as string;
  for (const body of questions) {
    const r = await api(owner.token).post(`/quizzes/${id}/questions`, body);
    expect(r.status, JSON.stringify(r.body)).toBeLessThan(300);
  }
  const acc = await api(owner.token).put(`/quizzes/${id}/access`, { visibility: 'PUBLIC' });
  expect(acc.status, JSON.stringify(acc.body)).toBe(200);
  const pub = await api(owner.token).post(`/quizzes/${id}/publish`);
  expect(pub.status, JSON.stringify(pub.body)).toBe(200);
  const d = await api(owner.token).get(`/quizzes/${id}`);
  return d.body.data as QuizDetailDto;
}

const opt = (d: QuizDetailDto['questions'][number], correct: boolean, n = 0) => d.options.filter((o) => o.isCorrect === correct)[n].id;

beforeAll(async () => {
  [org, org2, p1, p2, p3] = await Promise.all([
    registerUser('ORGANIZER'), registerUser('ORGANIZER'), registerUser(), registerUser(), registerUser(),
  ]);
  quiz = await buildQuiz(org, 'Attempts engine quiz', { timeLimitSec: 60, maxAttempts: 2, negativeMarking: 0.5, passMarkPct: 50, showAnswers: 'AFTER_SUBMIT', showExplanations: true }, [
    { type: 'MCQ_SINGLE', text: 'Capital of France?', explanation: 'Paris is the capital', points: 2, options: [{ text: 'Paris', isCorrect: true }, { text: 'Rome', isCorrect: false }, { text: 'Oslo', isCorrect: false }] },
    { type: 'MCQ_MULTI', text: 'Pick the primes', points: 2, config: { partialCredit: 'proportional' }, options: [{ text: '2', isCorrect: true }, { text: '3', isCorrect: true }, { text: '4', isCorrect: false }, { text: '6', isCorrect: false }] },
    { type: 'SHORT_ANSWER', text: 'Chemical symbol for gold?', points: 1, config: { acceptedAnswers: ['Au'] } },
    { type: 'NUMERIC', text: 'Pi to 2dp?', points: 1, config: { numericAnswer: 3.14, tolerance: 0.005 } },
    { type: 'LONG_ANSWER', text: 'Explain recursion', points: 4, config: { rubric: [{ criterion: 'Clarity', maxPoints: 4 }] } },
  ]);
  const byType = (t: string) => quiz.questions.find((x) => x.type === t)!;
  q = { single: byType('MCQ_SINGLE'), multi: byType('MCQ_MULTI'), short: byType('SHORT_ANSWER'), num: byType('NUMERIC'), long: byType('LONG_ANSWER') };
});

afterAll(async () => {
  await cleanupUsers();
  await prisma.$disconnect();
});

describe('attempt engine', () => {
  let attempt: AttemptViewDto;

  it('starts an attempt without leaking the answer key, with a server deadline', async () => {
    const res = await api(p1.token).post(`/quizzes/${quiz.id}/attempts`);
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    attempt = res.body.data;
    const raw = JSON.stringify(res.body);
    expect(raw).not.toContain('isCorrect');
    expect(raw).not.toContain('acceptedAnswers');
    expect(raw).not.toContain('numericAnswer');
    expect(raw).not.toContain('Paris is the capital'); // explanation
    expect(attempt.questions).toHaveLength(5);
    expect(attempt.questions.find((x) => x.id === q.single.id)!.options).toHaveLength(3);
    const ttl = new Date(attempt.expiresAt!).getTime() - new Date(attempt.serverNow).getTime();
    expect(ttl).toBeGreaterThan(55_000);
    expect(ttl).toBeLessThanOrEqual(60_500);
  });

  it('resumes the same attempt instead of creating another', async () => {
    const res = await api(p1.token).post(`/quizzes/${quiz.id}/attempts`);
    expect(res.body.data.id).toBe(attempt.id);
  });

  it('keeps owners out of real attempts but allows preview', async () => {
    expect((await api(org.token).post(`/quizzes/${quiz.id}/attempts`)).status).toBe(403);
    const pv = await api(org.token).post(`/quizzes/${quiz.id}/attempts?preview=1`);
    expect(pv.status, JSON.stringify(pv.body)).toBe(200);
    expect(await prisma.attempt.findUnique({ where: { id: pv.body.data.id } })).toMatchObject({ number: 0 });
    expect((await api(p1.token).post(`/quizzes/${quiz.id}/attempts?preview=1`)).status).toBe(403);
  });

  it("blocks other users from reading or changing someone else's attempt (IDOR)", async () => {
    expect((await api(p2.token).get(`/attempts/${attempt.id}`)).status).toBe(404);
    expect((await api(p2.token).put(`/attempts/${attempt.id}/answers`, { answers: [{ questionId: q.single.id, value: { optionIds: [opt(q.single, true)] } }] })).status).toBe(404);
    expect((await api(p2.token).post(`/attempts/${attempt.id}/submit`)).status).toBe(404);
    expect((await api(p2.token).get(`/attempts/${attempt.id}/result`)).status).toBe(404);
    expect((await api(org2.token).get(`/attempts/${attempt.id}/result`)).status).toBe(404);
    expect((await api(org2.token).get(`/attempts/${attempt.id}/grading`)).status).toBe(404);
  });

  it('autosaves answers idempotently and restores them on resume', async () => {
    const body = {
      answers: [
        { questionId: q.single.id, value: { optionIds: [opt(q.single, true)] }, timeSpentMs: 1200 },
        { questionId: q.multi.id, value: { optionIds: [opt(q.multi, true, 0)] }, flagged: true },
        { questionId: q.short.id, value: { text: ' au ' } },
      ],
    };
    expect((await api(p1.token).put(`/attempts/${attempt.id}/answers`, body)).status).toBe(200);
    expect((await api(p1.token).put(`/attempts/${attempt.id}/answers`, body)).status).toBe(200);
    expect(await prisma.answer.count({ where: { attemptId: attempt.id } })).toBe(3);
    const view = (await api(p1.token).get(`/attempts/${attempt.id}`)).body.data as AttemptViewDto;
    expect(view.answers[q.multi.id].flagged).toBe(true);
    expect(view.answers[q.short.id].value.text).toBe(' au ');
  });

  it('rejects options that do not belong to the question', async () => {
    const bad = await api(p1.token).put(`/attempts/${attempt.id}/answers`, { answers: [{ questionId: q.single.id, value: { optionIds: [opt(q.multi, true)] } }] });
    expect(bad.status).toBe(400);
    const unknownQ = await api(p1.token).put(`/attempts/${attempt.id}/answers`, { answers: [{ questionId: 'nope', value: { text: 'x' } }] });
    expect(unknownQ.status).toBe(400);
  });

  it('records integrity events', async () => {
    await api(p1.token).post(`/attempts/${attempt.id}/events`, { type: 'hidden' });
    const r = await api(p1.token).post(`/attempts/${attempt.id}/events`, { type: 'visible', awaySec: 7 });
    expect(r.body.data).toMatchObject({ tabSwitches: 1, blurSeconds: 7 });
  });

  it('refuses to show a result before submit', async () => {
    expect((await api(p1.token).get(`/attempts/${attempt.id}/result`)).status).toBe(409);
  });

  it('auto-grades objective answers, applies negative marking and flags manual items', async () => {
    const res = await api(p1.token).post(`/attempts/${attempt.id}/submit`, {
      answers: [
        { questionId: q.num.id, value: { number: 3.14 } },
        { questionId: q.long.id, value: { text: 'A function that calls itself.' } },
      ],
    });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    const r = res.body.data as ResultDto;
    // single 2 + multi 1 (1 of 2 correct, proportional) + numeric 1 + short 1 ("au" normalised) = 5; long pending
    expect(r.score).toBe(5);
    expect(r.maxScore).toBe(10);
    expect(r.isFinal).toBe(false);
    expect(r.status).toBe('SUBMITTED');
    expect(r.durationSec).not.toBeNull();
    const rev = (id: string) => r.review.find((x) => x.questionId === id)!;
    expect(rev(q.single.id)).toMatchObject({ score: 2, isCorrect: true });
    expect(rev(q.multi.id).score).toBe(1);
    expect(rev(q.long.id).needsManual).toBe(true);
    expect(r.answersRevealed).toBe(true);
    expect(rev(q.single.id).correct?.optionIds).toEqual([opt(q.single, true)]);
    expect(rev(q.single.id).explanation).toBe('Paris is the capital');
  });

  it('submit is idempotent and further saves are rejected', async () => {
    const again = await api(p1.token).post(`/attempts/${attempt.id}/submit`);
    expect(again.status).toBe(200);
    expect(again.body.data.score).toBe(5);
    expect(await prisma.result.count({ where: { attemptId: attempt.id } })).toBe(1);
    const late = await api(p1.token).put(`/attempts/${attempt.id}/answers`, { answers: [{ questionId: q.short.id, value: { text: 'x' } }] });
    expect(late.status).toBe(409);
  });

  it('shows the submission in the grading queue and finalises after manual grading', async () => {
    const list = await api(org.token).get(`/quizzes/${quiz.id}/grading/submissions?status=pending`);
    expect(list.status, JSON.stringify(list.body)).toBe(200);
    expect(list.body.data.map((x: { attemptId: string }) => x.attemptId)).toContain(attempt.id);
    expect(list.body.data[0].pendingCount).toBe(1);

    const view = (await api(org.token).get(`/attempts/${attempt.id}/grading`)).body.data;
    const longItem = view.items.find((i: { questionId: string }) => i.questionId === q.long.id);
    expect(longItem.value.text).toContain('calls itself');
    expect(longItem.options).toBeDefined();

    // cannot exceed max, cannot hand-grade objective items
    expect((await api(org.token).put(`/attempts/${attempt.id}/grading`, { grades: [{ answerId: longItem.answerId, score: 99 }] })).status).toBe(400);
    const singleItem = view.items.find((i: { questionId: string }) => i.questionId === q.single.id);
    expect((await api(org.token).put(`/attempts/${attempt.id}/grading`, { grades: [{ answerId: singleItem.answerId, score: 1 }] })).status).toBe(400);
    // participants cannot grade themselves
    expect((await api(p1.token).put(`/attempts/${attempt.id}/grading`, { grades: [{ answerId: longItem.answerId, score: 4 }] })).status).toBe(404);

    const xpBefore = (await api(p1.token).get('/auth/me')).body.data.xp;
    const graded = await api(org.token).put(`/attempts/${attempt.id}/grading`, { grades: [{ answerId: longItem.answerId, score: 3, feedback: 'Good, but mention a base case.' }] });
    expect(graded.status, JSON.stringify(graded.body)).toBe(200);
    expect(graded.body.data).toMatchObject({ isFinal: true, score: 8, maxScore: 10, percentage: 80 });

    const r = (await api(p1.token).get(`/attempts/${attempt.id}/result`)).body.data as ResultDto;
    expect(r).toMatchObject({ isFinal: true, status: 'GRADED', percentage: 80, passed: true, band: 'B' });
    expect(r.review.find((x) => x.questionId === q.long.id)).toMatchObject({ score: 3, feedback: 'Good, but mention a base case.' });
    const me = (await api(p1.token).get('/auth/me')).body.data;
    expect(me.xp).toBeGreaterThan(xpBefore);
    expect(await prisma.auditLog.count({ where: { actorId: org.id, action: 'grading.grade', entityId: attempt.id } })).toBe(1);
  });

  it('awards XP only for the first final result of a quiz', async () => {
    const xp1 = (await api(p1.token).get('/auth/me')).body.data.xp;
    const a2 = (await api(p1.token).post(`/quizzes/${quiz.id}/attempts`)).body.data as AttemptViewDto;
    expect(a2.id).not.toBe(attempt.id);
    const sub = await api(p1.token).post(`/attempts/${a2.id}/submit`);
    expect(sub.status).toBe(200);
    expect(sub.body.data.score).toBe(0); // blank
    const xp2 = (await api(p1.token).get('/auth/me')).body.data.xp;
    expect(xp2).toBe(xp1);
  });

  it('enforces max attempts', async () => {
    const res = await api(p1.token).post(`/quizzes/${quiz.id}/attempts`);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ATTEMPTS_EXHAUSTED');
  });

  it('enforces the server clock: late saves are refused and the attempt is auto-submitted', async () => {
    const a = (await api(p2.token).post(`/quizzes/${quiz.id}/attempts`)).body.data as AttemptViewDto;
    await api(p2.token).put(`/attempts/${a.id}/answers`, { answers: [{ questionId: q.single.id, value: { optionIds: [opt(q.single, true)] } }] });
    // inside the 5 s grace window saves still work
    await prisma.attempt.update({ where: { id: a.id }, data: { expiresAt: new Date(Date.now() - 2000) } });
    expect((await api(p2.token).put(`/attempts/${a.id}/answers`, { answers: [{ questionId: q.short.id, value: { text: 'Au' } }] })).status).toBe(200);
    await prisma.attempt.update({ where: { id: a.id }, data: { expiresAt: new Date(Date.now() - 10_000) } });
    const late = await api(p2.token).put(`/attempts/${a.id}/answers`, { answers: [{ questionId: q.short.id, value: { text: 'Zn' } }] });
    expect(late.status).toBe(409);
    expect(late.body.error.code).toBe('ATTEMPT_EXPIRED');
    const row = await prisma.attempt.findUniqueOrThrow({ where: { id: a.id } });
    expect(['SUBMITTED', 'GRADED']).toContain(row.status);
    // duration is capped at the deadline, never beyond it
    expect(row.submittedAt!.getTime()).toBeLessThanOrEqual(Date.now() - 9_000);
    const r = (await api(p2.token).get(`/attempts/${a.id}/result`)).body.data as ResultDto;
    expect(r.score).toBe(3); // single 2 + short 1 (saved within grace)
  });

  it('sweeper auto-submits abandoned attempts past the deadline', async () => {
    const a = (await api(p3.token).post(`/quizzes/${quiz.id}/attempts`)).body.data as AttemptViewDto;
    await prisma.attempt.update({ where: { id: a.id }, data: { expiresAt: new Date(Date.now() - 20_000) } });
    await sweepExpiredAttempts();
    expect(['SUBMITTED', 'GRADED']).toContain((await prisma.attempt.findUniqueOrThrow({ where: { id: a.id } })).status);
    expect(await prisma.result.count({ where: { attemptId: a.id } })).toBe(1);
  });

  it('serves a per-quiz leaderboard, monitor and reviews with correct access', async () => {
    const lb = await api(p1.token).get(`/quizzes/${quiz.id}/leaderboard`);
    expect(lb.status).toBe(200);
    expect(lb.body.data[0]).toMatchObject({ rank: 1, userId: p1.id, percentage: 80 });
    expect(lb.body.data.filter((x: { userId: string }) => x.userId === p1.id)).toHaveLength(1); // best attempt only

    const mon = await api(org.token).get(`/quizzes/${quiz.id}/monitor`);
    expect(mon.status).toBe(200);
    expect(mon.body.data.participants.map((p: { userId: string }) => p.userId)).toEqual(expect.arrayContaining([p1.id, p2.id]));
    expect((await api(p1.token).get(`/quizzes/${quiz.id}/monitor`)).status).toBe(404);
    expect((await api(org2.token).get(`/quizzes/${quiz.id}/monitor`)).status).toBe(404);

    const unfinished = await api(org2.token).post(`/quizzes/${quiz.id}/reviews`, { rating: 5 });
    expect(unfinished.status).toBe(403);
    expect((await api(p1.token).post(`/quizzes/${quiz.id}/reviews`, { rating: 4, comment: '<b>Nice</b> quiz' })).status).toBe(200);
    const list = await api(p1.token).get(`/quizzes/${quiz.id}/reviews`);
    expect(list.body.data.count).toBe(1);
    expect(list.body.data.items[0].comment).toBe('Nice quiz');
    expect((await api(org.token).post(`/quizzes/${quiz.id}/reviews`, { rating: 5 })).status).toBe(403);
  });

  it('exposes history, progress and gamification for the participant', async () => {
    const hist = await api(p1.token).get('/me/attempts');
    expect(hist.body.data.length).toBeGreaterThanOrEqual(2);
    const prog = await api(p1.token).get('/me/progress');
    expect(prog.body.data.totals.attempts).toBeGreaterThanOrEqual(1);
    const g = await api(p1.token).get('/me/gamification');
    expect(g.body.data.badges.find((b: { key: string }) => b.key === 'first_quiz')?.earned).toBe(true);
  });

  it('re-grades attempts after an answer-key change while keeping manual scores', async () => {
    // new version where the single-choice answer is "Rome": p1's first attempt loses its 2 points
    const rome = q.single.options.find((o) => o.text === 'Rome')!;
    const paris = q.single.options.find((o) => o.text === 'Paris')!;
    const e1 = await api(org.token).patch(`/questions/${q.single.id}`, {
      type: 'MCQ_SINGLE', text: q.single.text, points: 2,
      options: [{ text: 'Paris', isCorrect: false }, { text: 'Rome', isCorrect: true }, { text: 'Oslo', isCorrect: false }],
    });
    expect(e1.status, JSON.stringify(e1.body)).toBeLessThan(300);
    void rome; void paris;
    // not yet re-published: past attempts untouched
    expect((await api(p1.token).get(`/attempts/${attempt.id}/result`)).body.data.score).toBe(8);
    expect((await api(org.token).post(`/quizzes/${quiz.id}/publish`)).status).toBe(200);
    const rg = await api(org.token).post(`/quizzes/${quiz.id}/regrade`, {});
    expect(rg.status, JSON.stringify(rg.body)).toBe(200);
    expect(rg.body.data.regraded).toBeGreaterThanOrEqual(2);
    const after = (await api(p1.token).get(`/attempts/${attempt.id}/result`)).body.data as ResultDto;
    expect(after.score).toBe(5); // single now wrong: -1 (0.5 x 2 pts); multi 1 + short 1 + numeric 1 + manual 3 kept
    expect(after.review.find((x) => x.questionId === q.long.id)!.score).toBe(3);
    expect((await api(p1.token).post(`/quizzes/${quiz.id}/regrade`, {})).status).toBeGreaterThanOrEqual(403);
  });
});

describe('answer visibility policies', () => {
  const mcq = { type: 'MCQ_SINGLE', text: 'Pick B', explanation: 'Because B', points: 1, options: [{ text: 'A', isCorrect: false }, { text: 'B', isCorrect: true }] };

  it('NEVER hides the key, explanations and per-question verdicts from the participant but not the owner', async () => {
    const z = await buildQuiz(org, 'Never reveal', { showAnswers: 'NEVER' }, [mcq]);
    const a = (await api(p1.token).post(`/quizzes/${z.id}/attempts`)).body.data as AttemptViewDto;
    const qq = z.questions[0];
    await api(p1.token).put(`/attempts/${a.id}/answers`, { answers: [{ questionId: qq.id, value: { optionIds: [opt(qq, true)] } }] });
    const r = (await api(p1.token).post(`/attempts/${a.id}/submit`)).body.data as ResultDto;
    expect(r.percentage).toBe(100);
    expect(r.answersRevealed).toBe(false);
    expect(r.review[0].correct).toBeUndefined();
    expect(r.review[0].explanation).toBeUndefined();
    expect(r.review[0].isCorrect).toBeNull();
    expect(JSON.stringify(r)).not.toContain('Because B');
    const owner = (await api(org.token).get(`/attempts/${a.id}/result`)).body.data as ResultDto;
    expect(owner.answersRevealed).toBe(true);
    expect(owner.review[0].explanation).toBe('Because B');
  });

  it('AFTER_CLOSE reveals only once the quiz is closed', async () => {
    const z = await buildQuiz(org, 'Reveal after close', { showAnswers: 'AFTER_CLOSE' }, [mcq]);
    const a = (await api(p2.token).post(`/quizzes/${z.id}/attempts`)).body.data as AttemptViewDto;
    const r1 = (await api(p2.token).post(`/attempts/${a.id}/submit`)).body.data as ResultDto;
    expect(r1.answersRevealed).toBe(false);
    expect((await api(org.token).post(`/quizzes/${z.id}/close`)).status).toBe(200);
    const r2 = (await api(p2.token).get(`/attempts/${a.id}/result`)).body.data as ResultDto;
    expect(r2.answersRevealed).toBe(true);
    expect(r2.review[0].correct?.optionIds).toEqual([opt(z.questions[0], true)]);
  });
});

describe('daily challenge & reports', () => {
  it('picks a deterministic challenge (or none) and lets users flag content', async () => {
    const a = await api(p1.token).get('/daily-challenge');
    const b = await api(p2.token).get('/daily-challenge');
    expect(a.status).toBe(200);
    expect(a.body.data?.id).toBe(b.body.data?.id);
    const flag = await api(p1.token).post('/reports', { entityType: 'QUIZ', entityId: quiz.id, reason: 'Spam content' });
    expect(flag.status).toBeLessThan(300);
    const dupe = await api(p1.token).post('/reports', { entityType: 'QUIZ', entityId: quiz.id, reason: 'Spam content' });
    expect(dupe.body.data.id).toBe(flag.body.data.id);
    expect((await api(p1.token).post('/reports', { entityType: 'QUIZ', entityId: 'missing', reason: 'Spam content' })).status).toBe(404);
  });

  it('global XP leaderboard is available', async () => {
    const r = await api(p1.token).get('/leaderboard');
    expect(r.status).toBe(200);
    expect(Array.isArray(r.body.data)).toBe(true);
  });
});
