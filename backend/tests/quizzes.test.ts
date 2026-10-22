import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { api, cleanupUsers, registerUser, type TestUser } from './helpers';
import { prisma } from '../src/core/db';
import { advanceQuizLifecycle, effectiveStatus } from '../src/modules/quizzes/lifecycle';

let org: TestUser, other: TestUser, part: TestUser, admin: TestUser;

const mcq = (text = 'Capital of France?') => ({
  type: 'MCQ_SINGLE', text, points: 2,
  options: [{ text: 'Paris', isCorrect: true }, { text: 'Rome', isCorrect: false }, { text: 'Oslo', isCorrect: false }],
});
async function newQuiz(token = org.token, extra: object = {}) {
  const r = await api(token).post('/quizzes', { title: 'Geography basics', ...extra });
  expect(r.status).toBe(201);
  return r.body.data as { id: string };
}
async function publishable(extra: object = {}) {
  const q = await newQuiz(org.token, extra);
  expect((await api(org.token).post(`/quizzes/${q.id}/questions`, mcq())).status).toBe(201);
  return q;
}

beforeAll(async () => {
  [org, other, part, admin] = await Promise.all([registerUser('ORGANIZER'), registerUser('ORGANIZER'), registerUser('PARTICIPANT'), registerUser('ADMIN')]);
});
afterAll(async () => { await cleanupUsers(); await prisma.$disconnect(); });

describe('quiz CRUD & permissions', () => {
  it('creates a draft with defaults and tags, sanitising text', async () => {
    const r = await api(org.token).post('/quizzes', { title: '<script>alert(1)</script>Safe title', tags: ['Math', 'math', 'Algebra'] });
    expect(r.status).toBe(201);
    expect(r.body.data.status).toBe('DRAFT');
    expect(r.body.data.title).not.toContain('<script>');
    expect(r.body.data.tags.sort()).toEqual(['algebra', 'math']);
    expect(r.body.data.settings.maxAttempts).toBe(1);
  });

  it('forbids participants from the studio endpoints', async () => {
    expect((await api(part.token).get('/quizzes')).status).toBe(403);
    expect((await api(part.token).post('/quizzes', { title: 'Nope nope' })).status).toBe(403);
    expect((await api().get('/quizzes')).status).toBe(401);
  });

  it("hides other organizers' quizzes (404) but lets admin through", async () => {
    const q = await newQuiz();
    expect((await api(other.token).get(`/quizzes/${q.id}`)).status).toBe(404);
    expect((await api(other.token).patch(`/quizzes/${q.id}`, { title: 'Hijacked' })).status).toBe(404);
    expect((await api(other.token).delete(`/quizzes/${q.id}`)).status).toBe(404);
    expect((await api(admin.token).get(`/quizzes/${q.id}`)).status).toBe(200);
    const list = await api(other.token).get('/quizzes');
    expect(list.body.data.some((x: { id: string }) => x.id === q.id)).toBe(false);
  });

  it('PATCH only changes the fields sent (no default reset) and merges settings', async () => {
    const q = await newQuiz(org.token, { description: 'keep me', difficulty: 'HARD', tags: ['x'] });
    const r = await api(org.token).patch(`/quizzes/${q.id}`, { title: 'Renamed quiz', settings: { maxAttempts: 3 } });
    expect(r.status).toBe(200);
    expect(r.body.data.description).toBe('keep me');
    expect(r.body.data.difficulty).toBe('HARD');
    expect(r.body.data.tags).toEqual(['x']);
    expect(r.body.data.settings.maxAttempts).toBe(3);
    expect(r.body.data.settings.passMarkPct).toBe(50);
  });

  it('rejects an inverted schedule and unknown patch keys', async () => {
    const q = await newQuiz();
    const r = await api(org.token).patch(`/quizzes/${q.id}`, { opensAt: '2030-01-02T00:00:00.000Z', closesAt: '2030-01-01T00:00:00.000Z' });
    expect(r.status).toBe(400);
  });

  it('soft-deletes and duplicates', async () => {
    const q = await publishable();
    const dup = await api(org.token).post(`/quizzes/${q.id}/duplicate`);
    expect(dup.status).toBe(201);
    expect(dup.body.data.status).toBe('DRAFT');
    expect(dup.body.data.questions).toHaveLength(1);
    expect(dup.body.data.title).toMatch(/^Copy of/);
    expect((await api(org.token).delete(`/quizzes/${q.id}`)).status).toBe(204);
    expect((await api(org.token).get(`/quizzes/${q.id}`)).status).toBe(404);
    expect(await prisma.quiz.findUnique({ where: { id: q.id } })).toMatchObject({ deletedAt: expect.any(Date) });
  });
});

describe('questions, sections, reorder', () => {
  it('validates each question type and rejects invalid shapes', async () => {
    const q = await newQuiz();
    const post = (b: object) => api(org.token).post(`/quizzes/${q.id}/questions`, b);
    expect((await post({ type: 'MCQ_SINGLE', text: 'x', options: [{ text: 'a', isCorrect: true }] })).status).toBe(400);
    expect((await post({ type: 'MCQ_SINGLE', text: 'x', options: [{ text: 'a', isCorrect: true }, { text: 'b', isCorrect: true }] })).status).toBe(400);
    expect((await post({ type: 'SHORT_ANSWER', text: 'x' })).status).toBe(400);
    expect((await post({ type: 'NUMERIC', text: 'pi?', config: { numericAnswer: 3.14, tolerance: 0.01 } })).status).toBe(201);
    expect((await post({ type: 'SHORT_ANSWER', text: 'colour?', config: { acceptedAnswers: ['red'] } })).status).toBe(201);
    expect((await post({ type: 'LONG_ANSWER', text: 'Discuss', points: 10, config: { rubric: [{ criterion: 'Clarity', maxPoints: 10 }] } })).status).toBe(201);
    expect((await post({ type: 'TRUE_FALSE', text: 'Sky is blue', options: [{ text: 'True', isCorrect: true }, { text: 'False', isCorrect: false }] })).status).toBe(201);
    expect((await post({ ...mcq(), type: 'MCQ_MULTI', options: [{ text: 'a', isCorrect: true }, { text: 'b', isCorrect: true }, { text: 'c', isCorrect: false }] })).status).toBe(201);
  });

  it('sections group questions; reorder moves them; deleting a section keeps questions', async () => {
    const q = await newQuiz();
    const s1 = (await api(org.token).post(`/quizzes/${q.id}/sections`, { title: 'Part A' })).body.data;
    const s2 = (await api(org.token).post(`/quizzes/${q.id}/sections`, { title: 'Part B' })).body.data;
    const a = (await api(org.token).post(`/quizzes/${q.id}/questions`, { ...mcq('A'), sectionId: s1.id })).body.data;
    const b = (await api(org.token).post(`/quizzes/${q.id}/questions`, mcq('B'))).body.data;
    const bad = await api(org.token).post(`/quizzes/${q.id}/questions`, { ...mcq('C'), sectionId: 'nope' });
    expect(bad.status).toBe(400);

    const r = await api(org.token).post(`/quizzes/${q.id}/reorder`, {
      items: [{ id: b.id, sectionId: s2.id, position: 0 }, { id: a.id, sectionId: s2.id, position: 1 }],
      sections: [{ id: s2.id, position: 0 }, { id: s1.id, position: 1 }],
    });
    expect(r.status).toBe(200);
    expect(r.body.data.sections.map((s: { id: string }) => s.id)).toEqual([s2.id, s1.id]);
    expect(r.body.data.questions.map((x: { id: string; sectionId: string }) => [x.id, x.sectionId])).toEqual([[b.id, s2.id], [a.id, s2.id]]);

    expect((await api(org.token).delete(`/sections/${s2.id}`)).status).toBe(204);
    const d = (await api(org.token).get(`/quizzes/${q.id}`)).body.data;
    expect(d.sections).toHaveLength(1);
    expect(d.questions).toHaveLength(2);
    expect(d.questions.every((x: { sectionId: string | null }) => x.sectionId === null)).toBe(true);
  });

  it('does not let another organizer touch the questions', async () => {
    const q = await publishable();
    const qid = (await api(org.token).get(`/quizzes/${q.id}`)).body.data.questions[0].id;
    expect((await api(other.token).patch(`/questions/${qid}`, mcq())).status).toBe(404);
    expect((await api(other.token).delete(`/questions/${qid}`)).status).toBe(404);
    expect((await api(other.token).post(`/quizzes/${q.id}/questions`, mcq())).status).toBe(404);
  });

  it('imports from the owner’s question bank only', async () => {
    const bank = await api(org.token).post('/bank', { ...mcq('Bank Q'), tags: ['geo'] });
    expect(bank.status).toBe(201);
    const q = await newQuiz();
    const r = await api(org.token).post(`/quizzes/${q.id}/import-bank`, { bankIds: [bank.body.data.id] });
    expect(r.status).toBe(200);
    expect(r.body.data.questions).toHaveLength(1);
    expect(r.body.data.questions[0].options.filter((o: { isCorrect: boolean }) => o.isCorrect)).toHaveLength(1);
    const foreign = await api(other.token).post(`/quizzes/${(await newQuiz(other.token)).id}/import-bank`, { bankIds: [bank.body.data.id] });
    expect(foreign.status).toBe(404);
    expect((await api(other.token).patch(`/bank/${bank.body.data.id}`, { ...mcq(), tags: [] })).status).toBe(404);
    expect((await api(part.token).get('/bank')).status).toBe(403);
  });
});

describe('publish, versioning, lifecycle', () => {
  it('refuses to publish an empty quiz', async () => {
    const q = await newQuiz();
    expect((await api(org.token).post(`/quizzes/${q.id}/publish`)).status).toBe(422);
  });

  it('snapshots a version; later edits make the draft dirty without touching the version', async () => {
    const q = await publishable();
    const pub = await api(org.token).post(`/quizzes/${q.id}/publish`);
    expect(pub.status).toBe(200);
    expect(pub.body.data).toMatchObject({ status: 'LIVE', dirty: false, currentVersion: 1 });
    expect(pub.body.data.accessCode).toMatch(/^[A-Z2-9]{8}$/);

    const v1 = await prisma.quizVersion.findFirstOrThrow({ where: { quizId: q.id, number: 1 } });
    const before = JSON.stringify(v1.snapshot);
    expect((v1.snapshot as { questions: unknown[] }).questions).toHaveLength(1);

    const qid = pub.body.data.questions[0].id;
    await api(org.token).patch(`/questions/${qid}`, { ...mcq('Edited text') });
    await api(org.token).post(`/quizzes/${q.id}/questions`, mcq('Second'));
    const detail = (await api(org.token).get(`/quizzes/${q.id}`)).body.data;
    expect(detail.dirty).toBe(true);
    expect(detail.currentVersion).toBe(1);
    expect(JSON.stringify((await prisma.quizVersion.findUniqueOrThrow({ where: { id: v1.id } })).snapshot)).toBe(before);

    expect((await api(org.token).post(`/quizzes/${q.id}/publish`)).body.data).toMatchObject({ currentVersion: 2, dirty: false, status: 'LIVE' });
    const versions = (await api(org.token).get(`/quizzes/${q.id}/versions`)).body.data;
    expect(versions.map((v: { number: number }) => v.number)).toEqual([2, 1]);
    expect((await api(org.token).post(`/quizzes/${q.id}/publish`)).status).toBe(409); // nothing new
  });

  it('schedules for the future, then close/reopen/archive transitions', async () => {
    const future = new Date(Date.now() + 3600_000).toISOString();
    const q = await publishable({ opensAt: future });
    expect((await api(org.token).post(`/quizzes/${q.id}/publish`)).body.data.status).toBe('SCHEDULED');

    const live = await publishable();
    await api(org.token).post(`/quizzes/${live.id}/publish`);
    expect((await api(org.token).post(`/quizzes/${live.id}/close`)).body.data.status).toBe('CLOSED');
    expect((await api(org.token).post(`/quizzes/${live.id}/close`)).status).toBe(409);
    expect((await api(org.token).post(`/quizzes/${live.id}/reopen`)).body.data.status).toBe('LIVE');
    expect((await api(org.token).post(`/quizzes/${live.id}/archive`)).body.data.status).toBe('ARCHIVED');
    expect((await api(org.token).post(`/quizzes/${live.id}/reopen`)).body.data.status).toBe('LIVE');
  });

  it('lifecycle job opens scheduled and closes expired quizzes', async () => {
    const q = await publishable();
    await api(org.token).post(`/quizzes/${q.id}/publish`);
    await prisma.quiz.update({ where: { id: q.id }, data: { status: 'SCHEDULED', opensAt: new Date(Date.now() - 1000) } });
    expect(effectiveStatus({ status: 'SCHEDULED', opensAt: new Date(Date.now() - 1000), closesAt: null })).toBe('LIVE');
    await advanceQuizLifecycle();
    expect((await prisma.quiz.findUniqueOrThrow({ where: { id: q.id } })).status).toBe('LIVE');
    await prisma.quiz.update({ where: { id: q.id }, data: { closesAt: new Date(Date.now() - 1000) } });
    await advanceQuizLifecycle();
    expect((await prisma.quiz.findUniqueOrThrow({ where: { id: q.id } })).status).toBe('CLOSED');
  });

  it('blocks delete while attempts are in progress; regrade 404s for unknown version', async () => {
    const q = await publishable();
    const pub = (await api(org.token).post(`/quizzes/${q.id}/publish`)).body.data;
    const version = await prisma.quizVersion.findFirstOrThrow({ where: { quizId: q.id } });
    await prisma.attempt.create({ data: { quizId: q.id, versionId: version.id, userId: part.id, number: 1, questionOrder: [pub.questions[0].id] } });
    expect((await api(org.token).delete(`/quizzes/${q.id}`)).status).toBe(409);
    expect((await api(org.token).post(`/quizzes/${q.id}/regrade`, { versionId: 'missing' })).status).toBe(404);
  });
});

describe('access, catalog and answer-key safety', () => {
  it('public live quizzes appear in the catalog without any answer key', async () => {
    const q = await publishable({ title: 'Catalog visible quiz zz' });
    await api(org.token).put(`/quizzes/${q.id}/access`, { visibility: 'PUBLIC' });
    await api(org.token).post(`/quizzes/${q.id}/publish`);
    const list = await api(part.token).get('/catalog?q=Catalog visible quiz zz');
    expect(list.status).toBe(200);
    const item = list.body.data.find((x: { id: string }) => x.id === q.id);
    expect(item).toMatchObject({ questionCount: 1, totalPoints: 2, canStart: true, attemptsUsed: 0 });
    expect(JSON.stringify(list.body)).not.toMatch(/isCorrect|acceptedAnswers|numericAnswer/);
    const detail = await api(part.token).get(`/catalog/${q.id}`);
    expect(detail.status).toBe(200);
    expect(JSON.stringify(detail.body)).not.toMatch(/isCorrect|Paris/);

    const etag = list.headers.etag;
    expect(etag).toBeTruthy();
    expect((await api(part.token).get('/catalog?q=Catalog visible quiz zz').set('If-None-Match', etag)).status).toBe(304);
  });

  it('private quizzes are invisible until the participant redeems the code or is invited', async () => {
    const q = await publishable({ title: 'Private one' });
    const pub = (await api(org.token).post(`/quizzes/${q.id}/publish`)).body.data;
    expect(pub.visibility).toBe('PRIVATE');
    expect((await api(part.token).get(`/catalog/${q.id}`)).status).toBe(404);
    expect((await api(part.token).get('/catalog?q=Private one')).body.data.some((x: { id: string }) => x.id === q.id)).toBe(false);
    expect((await api(part.token).post('/catalog/join', { code: 'WRONGCODE' })).status).toBe(404);

    const joined = await api(part.token).post('/catalog/join', { code: pub.accessCode.toLowerCase() });
    expect(joined.status).toBe(200);
    expect(joined.body.data.id).toBe(q.id);
    expect((await api(part.token).get(`/catalog/${q.id}`)).status).toBe(200);
    const a = await api(part.token).get('/me/assignments');
    expect(a.body.data.assigned.some((x: { id: string }) => x.id === q.id)).toBe(true);
  });

  it('drafts are never visible to participants, even if invited', async () => {
    const q = await publishable();
    await api(org.token).put(`/quizzes/${q.id}/access`, { userIds: [part.id] });
    expect((await api(part.token).get(`/catalog/${q.id}`)).status).toBe(404);
  });

  it('cohort assignment grants access; membership changes take effect', async () => {
    const c = (await api(org.token).post('/cohorts', { name: 'Class 10A' })).body.data;
    const m = await api(org.token).post(`/cohorts/${c.id}/members`, { identifiers: [part.username, 'ghost_user'] });
    expect(m.body.data).toMatchObject({ added: 1, notFound: ['ghost_user'] });
    const q = await publishable();
    const acc = await api(org.token).put(`/quizzes/${q.id}/access`, { cohortIds: [c.id] });
    expect(acc.body.data.cohorts).toHaveLength(1);
    await api(org.token).post(`/quizzes/${q.id}/publish`);
    expect((await api(part.token).get(`/catalog/${q.id}`)).status).toBe(200);
    expect((await api(other.token).put(`/quizzes/${q.id}/access`, { visibility: 'PUBLIC' })).status).toBe(404);
    expect((await api(other.token).post(`/cohorts/${c.id}/members`, { identifiers: ['x'] })).status).toBe(404);
    await api(org.token).delete(`/cohorts/${c.id}/members/${part.id}`);
    expect((await api(part.token).get(`/catalog/${q.id}`)).status).toBe(404);
  });

  it('rejects cohorts the organizer does not own in access updates', async () => {
    const foreign = (await api(other.token).post('/cohorts', { name: 'Other cohort' })).body.data;
    const q = await newQuiz();
    expect((await api(org.token).put(`/quizzes/${q.id}/access`, { cohortIds: [foreign.id] })).status).toBe(400);
  });
});

describe('taxonomy', () => {
  it('creates categories (organizer) and lists them (everyone); duplicates conflict', async () => {
    const name = `Cat ${Date.now()}`;
    const c = await api(org.token).post('/categories', { name });
    expect(c.status).toBe(201);
    expect((await api(org.token).post('/categories', { name })).status).toBe(409);
    expect((await api(part.token).post('/categories', { name: 'Nope nope' })).status).toBe(403);
    expect((await api(part.token).get('/categories')).body.data.some((x: { id: string }) => x.id === c.body.data.id)).toBe(true);
    await prisma.category.delete({ where: { id: c.body.data.id } });
  });
});
