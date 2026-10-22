import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Prisma } from '@prisma/client';
import { defaultQuizSettings } from '@quiz/shared';
import { prisma } from '../src/core/db';
import { api, cleanupUsers, registerUser, type TestUser } from './helpers';

let admin: TestUser, org: TestUser, part: TestUser, victim: TestUser;
let quizId = '';

beforeAll(async () => {
  [admin, org, part, victim] = await Promise.all([registerUser('ADMIN'), registerUser('ORGANIZER'), registerUser('PARTICIPANT'), registerUser('PARTICIPANT')]);
  const q = await prisma.quiz.create({ data: { ownerId: org.id, title: 'Moderation fixture', status: 'LIVE', visibility: 'PUBLIC', settings: defaultQuizSettings() as unknown as Prisma.InputJsonValue } });
  quizId = q.id;
});

afterAll(async () => { await cleanupUsers(); });

describe('admin access control', () => {
  it('rejects non-admins and anonymous callers', async () => {
    for (const path of ['/admin/users', '/admin/analytics', '/admin/quizzes', '/admin/moderation', '/admin/audit-log']) {
      expect((await api(part.token).get(path)).status).toBe(403);
      expect((await api(org.token).get(path)).status).toBe(403);
      expect((await api().get(path)).status).toBe(401);
    }
  });
});

describe('admin users', () => {
  it('searches and paginates users', async () => {
    const res = await api(admin.token).get(`/admin/users?q=${victim.username}&pageSize=5`);
    expect(res.status).toBe(200);
    expect(res.body.meta.total).toBe(1);
    expect(res.body.data[0]).toMatchObject({ id: victim.id, role: 'PARTICIPANT', disabled: false });
    expect(res.body.data[0].passwordHash).toBeUndefined();
    const byRole = await api(admin.token).get('/admin/users?role=ADMIN&pageSize=1');
    expect(byRole.body.data.every((u: { role: string }) => u.role === 'ADMIN')).toBe(true);
  });

  it('changes a role, writes an audit entry and applies immediately', async () => {
    const res = await api(admin.token).patch(`/admin/users/${victim.id}`, { role: 'ORGANIZER' });
    expect(res.status).toBe(200);
    expect(res.body.data.role).toBe('ORGANIZER');
    // role is re-read server-side: the old token now has organizer rights
    expect((await api(victim.token).get('/organizer/dashboard')).status).toBe(200);
    const log = await api(admin.token).get(`/admin/audit-log?action=admin.user_update&actorId=${admin.id}`);
    expect(log.body.data.some((e: { entityId: string }) => e.entityId === victim.id)).toBe(true);
  });

  it('prevents an admin from modifying their own account', async () => {
    expect((await api(admin.token).patch(`/admin/users/${admin.id}`, { role: 'PARTICIPANT' })).status).toBe(400);
    expect((await api(admin.token).patch(`/admin/users/${admin.id}`, { disabled: true })).status).toBe(400);
  });

  it('rejects invalid role values and unknown users', async () => {
    expect((await api(admin.token).patch(`/admin/users/${victim.id}`, { role: 'SUPERUSER' })).status).toBe(400);
    expect((await api(admin.token).patch('/admin/users/does-not-exist', { disabled: true })).status).toBe(404);
  });

  it('disabling a user revokes access immediately and blocks login', async () => {
    expect((await api(admin.token).patch(`/admin/users/${victim.id}`, { disabled: true })).status).toBe(200);
    expect((await api(victim.token).get('/auth/me')).status).toBe(401);
    const login = await api().post('/auth/login', { identifier: victim.username, password: 'Passw0rd!x' });
    expect(login.status).toBe(403);
    expect(await prisma.refreshToken.count({ where: { userId: victim.id, revokedAt: null } })).toBe(0);
  });
});

describe('admin analytics', () => {
  it('returns totals and gap-free per-day series', async () => {
    const { data } = (await api(admin.token).get('/admin/analytics')).body;
    expect(data.totals.users).toBeGreaterThanOrEqual(4);
    expect(data.attemptsPerDay).toHaveLength(30);
    expect(data.signupsPerDay).toHaveLength(30);
    expect(data.signupsPerDay.at(-1).count).toBeGreaterThanOrEqual(4); // today's signups bucket
    const dates = data.signupsPerDay.map((d: { date: string }) => d.date);
    expect(new Set(dates).size).toBe(30);
  });
});

describe('admin quizzes + moderation', () => {
  it('lists quizzes and flags one', async () => {
    const list = await api(admin.token).get('/admin/quizzes?q=Moderation fixture');
    expect(list.body.data.some((q: { id: string }) => q.id === quizId)).toBe(true);
    const patched = await api(admin.token).patch(`/admin/quizzes/${quizId}`, { isFlagged: true });
    expect(patched.body.data.isFlagged).toBe(true);
    const flagged = await api(admin.token).get('/admin/quizzes?flagged=true&pageSize=100');
    expect(flagged.body.data.some((q: { id: string }) => q.id === quizId)).toBe(true);
    await api(admin.token).patch(`/admin/quizzes/${quizId}`, { isFlagged: false });
  });

  it('lets any user report content, is idempotent, and lets admin remove it', async () => {
    const r1 = await api(part.token).post('/reports', { entityType: 'QUIZ', entityId: quizId, reason: 'Contains offensive content' });
    expect(r1.status).toBe(201);
    const again = await api(part.token).post('/reports', { entityType: 'QUIZ', entityId: quizId, reason: 'Contains offensive content' });
    expect(again.body.data.id).toBe(r1.body.data.id); // idempotent: no duplicate open flag
    expect((await api(part.token).post('/reports', { entityType: 'QUIZ', entityId: 'missing', reason: 'nope nope' })).status).toBe(404);

    const queue = await api(admin.token).get('/admin/moderation?pageSize=100');
    const flag = queue.body.data.find((f: { id: string }) => f.id === r1.body.data.id);
    expect(flag).toMatchObject({ status: 'OPEN', entityType: 'QUIZ', entityLabel: 'Moderation fixture' });

    expect((await api(admin.token).patch(`/admin/moderation/${flag.id}`, { action: 'EXPLODE' })).status).toBe(400);
    const done = await api(admin.token).patch(`/admin/moderation/${flag.id}`, { action: 'REMOVE' });
    expect(done.body.data.status).toBe('ACTIONED');
    expect((await prisma.quiz.findUniqueOrThrow({ where: { id: quizId } })).deletedAt).not.toBeNull();
    expect((await api(admin.token).patch(`/admin/moderation/${flag.id}`, { action: 'DISMISS' })).status).toBe(409);
    const log = await api(admin.token).get('/admin/audit-log?action=moderation.');
    expect(log.body.data.some((e: { entityId: string }) => e.entityId === quizId)).toBe(true);
  });
});
