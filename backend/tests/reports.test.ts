import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Prisma } from '@prisma/client';
import { defaultQuizSettings, questionConfigSchema, type PublishedQuiz } from '@quiz/shared';
import { prisma } from '../src/core/db';
import { api, app, cleanupUsers, registerUser, type TestUser } from './helpers';

let org: TestUser, other: TestUser, p1: TestUser, p2: TestUser, p3: TestUser;
let quizId = '';
let q1 = '', q2 = '';
let o1Right = '', o1Wrong = '';

const settings = { ...defaultQuizSettings(), passMarkPct: 50, timeLimitSec: 600 };
const json = (v: unknown) => v as Prisma.InputJsonValue;

async function addAttempt(user: TestUser, number: number, answers: { q: string; value: object; score: number; max: number; auto?: boolean }[], pct: number, versionId: string, dur: number) {
  const a = await prisma.attempt.create({
    data: { quizId, versionId, userId: user.id, number, status: 'GRADED', submittedAt: new Date(), durationSec: dur, questionOrder: [q1, q2] },
  });
  for (const x of answers) {
    const ans = await prisma.answer.create({ data: { attemptId: a.id, questionId: x.q, value: json(x.value), timeSpentMs: 10_000 } });
    await prisma.grade.create({ data: { answerId: ans.id, maxScore: x.max, autoScore: x.score, needsManual: false } });
  }
  await prisma.result.create({
    data: { attemptId: a.id, quizId, userId: user.id, score: pct / 50, maxScore: 2, percentage: pct, band: pct >= 50 ? 'C' : 'F', passed: pct >= 50, isFinal: true },
  });
}

beforeAll(async () => {
  [org, other, p1, p2, p3] = await Promise.all([registerUser('ORGANIZER'), registerUser('ORGANIZER'), registerUser('PARTICIPANT'), registerUser('PARTICIPANT'), registerUser('PARTICIPANT')]);
  await prisma.user.update({ where: { id: p1.id }, data: { name: '=HYPERLINK("http://evil")' } });

  const quiz = await prisma.quiz.create({
    data: { ownerId: org.id, title: 'Report fixture', status: 'LIVE', visibility: 'PUBLIC', settings: json(settings) },
  });
  quizId = quiz.id;
  const cfg = questionConfigSchema.parse({ acceptedAnswers: ['def'] });
  const Q1 = await prisma.question.create({ data: { quizId, type: 'MCQ_SINGLE', text: 'Pick right', points: 1, position: 0, config: json(cfg) } });
  const Q2 = await prisma.question.create({ data: { quizId, type: 'SHORT_ANSWER', text: 'Keyword?', points: 1, position: 1, config: json(cfg) } });
  q1 = Q1.id; q2 = Q2.id;
  const r = await prisma.option.create({ data: { questionId: q1, text: 'Right', isCorrect: true, position: 0 } });
  const w = await prisma.option.create({ data: { questionId: q1, text: 'Wrong', isCorrect: false, position: 1 } });
  o1Right = r.id; o1Wrong = w.id;

  const snap: PublishedQuiz = {
    quizId, number: 1, title: 'Report fixture', settings, sections: [], totalPoints: 2,
    questions: [
      { id: q1, type: 'MCQ_SINGLE', text: 'Pick right', explanation: '', points: 1, sectionId: null, position: 0, config: cfg, options: [{ id: o1Right, text: 'Right', isCorrect: true, position: 0 }, { id: o1Wrong, text: 'Wrong', isCorrect: false, position: 1 }] },
      { id: q2, type: 'SHORT_ANSWER', text: 'Keyword?', explanation: '', points: 1, sectionId: null, position: 1, config: cfg, options: [] },
    ],
  };
  const v = await prisma.quizVersion.create({ data: { quizId, number: 1, snapshot: json(snap), publishedById: org.id } });
  await prisma.quiz.update({ where: { id: quizId }, data: { currentVersionId: v.id } });

  // p1: 100%, p2: 50% (q1 right, q2 wrong), p3: 0%
  await addAttempt(p1, 1, [{ q: q1, value: { optionIds: [o1Right] }, score: 1, max: 1 }, { q: q2, value: { text: 'def' }, score: 1, max: 1 }], 100, v.id, 120);
  await addAttempt(p2, 1, [{ q: q1, value: { optionIds: [o1Right] }, score: 1, max: 1 }, { q: q2, value: { text: 'nope' }, score: 0, max: 1 }], 50, v.id, 240);
  await addAttempt(p3, 1, [{ q: q1, value: { optionIds: [o1Wrong] }, score: 0, max: 1 }, { q: q2, value: {}, score: 0, max: 1 }], 0, v.id, 360);
  // preview attempt (number 0) must be excluded everywhere
  await addAttempt(org, 0, [{ q: q1, value: { optionIds: [o1Right] }, score: 1, max: 1 }], 100, v.id, 30);

  const cohort = await prisma.cohort.create({ data: { ownerId: org.id, name: 'Fixture cohort' } });
  await prisma.cohortMember.createMany({ data: [{ cohortId: cohort.id, userId: p1.id }, { cohortId: cohort.id, userId: p2.id }, { cohortId: cohort.id, userId: p3.id }] });
  await prisma.quizAssignment.create({ data: { quizId, cohortId: cohort.id } });
});

afterAll(async () => { await cleanupUsers(); });

describe('reports', () => {
  it('is restricted to the quiz owner', async () => {
    expect((await api(p1.token).get(`/quizzes/${quizId}/reports/summary`)).status).toBe(403);
    expect((await api(other.token).get(`/quizzes/${quizId}/reports/summary`)).status).toBe(404);
    expect((await api().get(`/quizzes/${quizId}/reports/summary`)).status).toBe(401);
    expect((await api(org.token).get(`/quizzes/${quizId}/reports/summary`)).status).toBe(200);
  });

  it('computes the summary excluding preview attempts', async () => {
    const { data } = (await api(org.token).get(`/quizzes/${quizId}/reports/summary`)).body;
    expect(data.attempts).toBe(3);
    expect(data.participants).toBe(3);
    expect(data.avgPct).toBe(50);
    expect(data.medianPct).toBe(50);
    expect(data.passRate).toBeCloseTo(66.7, 1);
    expect(data.avgDurationSec).toBe(240);
    expect(data.gradedPending).toBe(0);
    expect(data.distribution).toHaveLength(10);
    expect(data.distribution[9].count).toBe(1);
    expect(data.distribution[5].count).toBe(1);
    expect(data.distribution[0].count).toBe(1);
  });

  it('returns ETag and honours If-None-Match', async () => {
    const first = await api(org.token).get(`/quizzes/${quizId}/reports/summary`);
    const etag = first.headers.etag;
    expect(etag).toBeTruthy();
    const second = await request(app()).get(`/api/v1/quizzes/${quizId}/reports/summary`).set('Authorization', `Bearer ${org.token}`).set('If-None-Match', etag);
    expect(second.status).toBe(304);
  });

  it('computes item difficulty, discrimination, omit rate and distractors', async () => {
    const { data } = (await api(org.token).get(`/quizzes/${quizId}/reports/items`)).body;
    expect(data).toHaveLength(2);
    const [a, b] = data;
    expect(a.questionId).toBe(q1);
    expect(a.difficulty).toBeCloseTo(0.667, 2);
    expect(a.discrimination).toBe(1);
    expect(a.distractors.find((d: { optionId: string }) => d.optionId === o1Right).count).toBe(2);
    expect(a.distractors.find((d: { optionId: string }) => d.optionId === o1Wrong).count).toBe(1);
    expect(b.difficulty).toBeCloseTo(0.333, 2);
    expect(b.omitRate).toBeCloseTo(0.333, 2); // p3 left it blank
    expect(b.avgTimeMs).toBe(10_000);
  });

  it('lists participants with paging and sorting', async () => {
    const res = await api(org.token).get(`/quizzes/${quizId}/reports/participants?pageSize=2&sort=-bestPct`);
    expect(res.body.meta).toMatchObject({ page: 1, pageSize: 2, total: 3, totalPages: 2 });
    expect(res.body.data.map((r: { userId: string }) => r.userId)).toEqual([p1.id, p2.id]);
    const filtered = await api(org.token).get(`/quizzes/${quizId}/reports/participants?q=${p3.username}`);
    expect(filtered.body.data).toHaveLength(1);
  });

  it('breaks results down by cohort', async () => {
    const { data } = (await api(org.token).get(`/quizzes/${quizId}/reports/cohorts`)).body;
    expect(data).toHaveLength(1);
    expect(data[0]).toMatchObject({ name: 'Fixture cohort', members: 3, attempted: 3, avgPct: 50 });
  });

  it('exports CSV with formula-injection protection', async () => {
    const res = await api(org.token).get(`/quizzes/${quizId}/reports/export.csv`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    const lines = res.text.replace('﻿', '').trim().split('\r\n');
    expect(lines[0]).toContain('Username');
    expect(lines).toHaveLength(4); // header + 3 attempts, preview excluded
    expect(res.text).toContain(`"'=HYPERLINK(""http://evil"")"`);
    expect(res.text).not.toMatch(/(^|,)=HYPERLINK/m);
  });

  it('exports a PDF', async () => {
    const res = await request(app()).get(`/api/v1/quizzes/${quizId}/reports/export.pdf`).set('Authorization', `Bearer ${org.token}`)
      .buffer(true).parse((r, cb) => { const chunks: Buffer[] = []; r.on('data', (c: Buffer) => chunks.push(c)); r.on('end', () => cb(null, Buffer.concat(chunks))); });
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/pdf');
    expect((res.body as Buffer).subarray(0, 4).toString()).toBe('%PDF');
  });
});

describe('organizer dashboard', () => {
  it('returns KPIs for the organizer and is forbidden for participants', async () => {
    expect((await api(p1.token).get('/organizer/dashboard')).status).toBe(403);
    const { data } = (await api(org.token).get('/organizer/dashboard')).body;
    expect(data.kpis.liveQuizzes).toBe(1);
    expect(data.kpis.participants).toBe(3);
    expect(data.kpis.avgScorePct).toBe(50);
    expect(data.kpis.needsGrading).toBe(0);
    expect(data.liveQuizzes[0]).toMatchObject({ id: quizId, attempts: 3 });
    expect(Array.isArray(data.recentActivity)).toBe(true);
  });
});
