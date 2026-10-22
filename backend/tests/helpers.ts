import request from 'supertest';
import { randomBytes } from 'node:crypto';
import { createApp } from '../src/app';
import { prisma } from '../src/core/db';

export { createApp };

let _app: ReturnType<typeof createApp> | undefined;
export const app = () => (_app ??= createApp());

const created: string[] = [];

export interface TestUser { id: string; username: string; email: string; token: string; role: string }

/** Registers a fresh user with a random suffix. ADMIN is promoted directly in the DB (self-signup cannot be admin). */
export async function registerUser(role: 'PARTICIPANT' | 'ORGANIZER' | 'ADMIN' = 'PARTICIPANT'): Promise<TestUser> {
  const s = randomBytes(5).toString('hex');
  const username = `t_${role.slice(0, 3).toLowerCase()}_${s}`;
  const res = await request(app())
    .post('/api/v1/auth/register')
    .send({ username, email: `${username}@test.local`, password: 'Passw0rd!x', role: role === 'ADMIN' ? 'PARTICIPANT' : role });
  if (res.status !== 201) throw new Error(`register failed: ${res.status} ${JSON.stringify(res.body)}`);
  const { user, accessToken } = res.body.data;
  created.push(user.id);
  if (role === 'ADMIN') {
    await prisma.user.update({ where: { id: user.id }, data: { role: 'ADMIN' } });
    const login = await request(app()).post('/api/v1/auth/login').send({ identifier: username, password: 'Passw0rd!x' });
    return { id: user.id, username, email: user.email, token: login.body.data.accessToken, role };
  }
  return { id: user.id, username, email: user.email, token: accessToken, role };
}

export const api = (token?: string) => ({
  get: (url: string) => withAuth(request(app()).get(`/api/v1${url}`), token),
  post: (url: string, body?: object) => withAuth(request(app()).post(`/api/v1${url}`).send(body), token),
  put: (url: string, body?: object) => withAuth(request(app()).put(`/api/v1${url}`).send(body), token),
  patch: (url: string, body?: object) => withAuth(request(app()).patch(`/api/v1${url}`).send(body), token),
  delete: (url: string) => withAuth(request(app()).delete(`/api/v1${url}`), token),
});
function withAuth<T extends request.Test>(r: T, token?: string): T {
  return token ? (r.set('Authorization', `Bearer ${token}`) as T) : r;
}

/** Deletes everything created through registerUser() (and its dependants). Never truncates tables. */
export async function cleanupUsers() {
  if (!created.length) return;
  const ids = created.splice(0);
  const quizzes = await prisma.quiz.findMany({ where: { ownerId: { in: ids } }, select: { id: true } });
  const quizIds = quizzes.map((q) => q.id);
  await prisma.attempt.deleteMany({ where: { OR: [{ userId: { in: ids } }, { quizId: { in: quizIds } }] } });
  await prisma.quiz.deleteMany({ where: { id: { in: quizIds } } });
  await prisma.bankQuestion.deleteMany({ where: { ownerId: { in: ids } } });
  await prisma.cohort.deleteMany({ where: { ownerId: { in: ids } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
}
