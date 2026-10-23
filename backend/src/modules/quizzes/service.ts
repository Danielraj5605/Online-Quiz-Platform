import crypto from 'node:crypto';
import { z } from 'zod';
import type { Prisma, Quiz } from '@prisma/client';
import {
  createQuizSchema, questionInputSchema, quizSettingsSchema,
  type AuthLike, type QuestionInput,
} from './types';
import { prisma, type Tx } from '../../core/db';
import { cache } from '../../core/cache';
import { badRequest, conflict, notFound, unprocessable } from '../../core/errors';
import { clean } from '../../core/sanitize';
import { requireQuizOwner, isAdmin } from '../../core/policy';
import { pageMeta, orderBy, skipTake } from '../../core/http';
import { buildSnapshot, loadDetail, questionInclude, quizInclude, summaries, toAuthorQuestion } from './mappers';
import { statusForSchedule } from './lifecycle';
import { audit } from '../../core/audit';
import { regradeQuiz } from '../attempts/regrade';

export const touch = (quizId: string) => cache.invalidateTags(`quiz:${quizId}`, 'catalog');

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const newCode = () => Array.from(crypto.randomBytes(8), (b) => CODE_CHARS[b % CODE_CHARS.length]).join('');

async function uniqueCode(): Promise<string> {
  for (let i = 0; i < 8; i++) {
    const code = newCode();
    if (!(await prisma.quiz.findUnique({ where: { accessCode: code }, select: { id: true } }))) return code;
  }
  throw conflict('Could not allocate access code');
}

const cleanTags = (tags: string[]) => [...new Set(tags.map((t) => clean(t).toLowerCase()).filter(Boolean))].slice(0, 10);

async function setTags(tx: Tx, quizId: string, tags: string[]) {
  const names = cleanTags(tags);
  await tx.quizTag.deleteMany({ where: { quizId } });
  for (const name of names) {
    const tag = await tx.tag.upsert({ where: { name }, update: {}, create: { name } });
    await tx.quizTag.create({ data: { quizId, tagId: tag.id } });
  }
}

function checkSchedule(opensAt: Date | null, closesAt: Date | null) {
  if (opensAt && closesAt && closesAt <= opensAt) throw badRequest('closesAt must be after opensAt');
}
const toDate = (s: string | null | undefined) => (s ? new Date(s) : s === null ? null : undefined);

async function checkCategory(categoryId: string | null | undefined) {
  if (categoryId && !(await prisma.category.findUnique({ where: { id: categoryId }, select: { id: true } }))) throw badRequest('Unknown category');
}

/* ───────────── list / CRUD ───────────── */
export const listQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.string().max(40).optional(),
  q: z.string().max(100).optional(),
  status: z.enum(['DRAFT', 'SCHEDULED', 'LIVE', 'CLOSED', 'ARCHIVED']).optional(),
  mine: z.enum(['0', '1', 'true', 'false']).optional(),
  categoryId: z.string().max(40).optional(),
});

export async function listQuizzes(user: AuthLike, q: z.infer<typeof listQuery>) {
  const mine = q.mine === '1' || q.mine === 'true';
  const where: Prisma.QuizWhereInput = {
    deletedAt: null,
    ...(isAdmin(user) && !mine ? {} : { ownerId: user.id }),
    ...(q.status ? { status: q.status } : {}),
    ...(q.categoryId ? { categoryId: q.categoryId } : {}),
    ...(q.q ? { title: { contains: q.q, mode: 'insensitive' } } : {}),
  };
  const [total, rows] = await Promise.all([
    prisma.quiz.count({ where }),
    prisma.quiz.findMany({
      where, include: quizInclude, ...skipTake(q),
      orderBy: orderBy(q.sort, ['title', 'createdAt', 'updatedAt', 'status'] as const, { updatedAt: 'desc' }),
    }),
  ]);
  return { items: await summaries(rows), meta: pageMeta(q.page, q.pageSize, total) };
}

export async function createQuiz(user: AuthLike, input: z.infer<typeof createQuizSchema>) {
  await checkCategory(input.categoryId);
  const opensAt = toDate(input.opensAt) ?? null;
  const closesAt = toDate(input.closesAt) ?? null;
  checkSchedule(opensAt, closesAt);
  const quiz = await prisma.$transaction(async (tx) => {
    const created = await tx.quiz.create({
      data: {
        ownerId: user.id, title: clean(input.title), description: clean(input.description), categoryId: input.categoryId ?? null,
        difficulty: input.difficulty, settings: input.settings as Prisma.InputJsonValue, opensAt, closesAt,
      },
    });
    await setTags(tx, created.id, input.tags);
    return created;
  });
  await touch(quiz.id);
  return (await loadDetail(quiz.id))!;
}

const patchableKeys = ['title', 'description', 'categoryId', 'difficulty', 'tags', 'opensAt', 'closesAt'] as const;

export async function updateQuiz(user: AuthLike, quizId: string, raw: unknown) {
  const quiz = await requireQuizOwner(user, quizId);
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw badRequest('Invalid body');
  const body = raw as Record<string, unknown>;
  // Validate only keys that were sent: zod .partial() would re-apply defaults and silently reset fields.
  const shape = createQuizSchema.shape;
  const picked = z.object(Object.fromEntries(patchableKeys.filter((k) => k in body).map((k) => [k, shape[k]]))).strict().parse(
    Object.fromEntries(patchableKeys.filter((k) => k in body).map((k) => [k, body[k]])),
  ) as Partial<z.infer<typeof createQuizSchema>>;

  const data: Prisma.QuizUpdateInput = {};
  let contentChanged = false;
  if (picked.title !== undefined) { data.title = clean(picked.title); contentChanged = true; }
  if (picked.description !== undefined) data.description = clean(picked.description);
  if (picked.difficulty !== undefined) data.difficulty = picked.difficulty;
  if (picked.categoryId !== undefined) {
    await checkCategory(picked.categoryId);
    data.category = picked.categoryId ? { connect: { id: picked.categoryId } } : { disconnect: true };
  }
  if ('settings' in body) {
    if (typeof body.settings !== 'object' || body.settings === null) throw badRequest('Invalid settings');
    const merged = quizSettingsSchema.parse({ ...(quiz.settings as object), ...(body.settings as object) });
    data.settings = merged as Prisma.InputJsonValue;
    contentChanged = true;
  }
  const opensAt = picked.opensAt !== undefined ? toDate(picked.opensAt) ?? null : quiz.opensAt;
  const closesAt = picked.closesAt !== undefined ? toDate(picked.closesAt) ?? null : quiz.closesAt;
  const scheduleChanged = picked.opensAt !== undefined || picked.closesAt !== undefined;
  if (scheduleChanged) {
    checkSchedule(opensAt, closesAt);
    data.opensAt = opensAt;
    data.closesAt = closesAt;
    if (quiz.currentVersionId && (quiz.status === 'LIVE' || quiz.status === 'SCHEDULED')) data.status = statusForSchedule(opensAt, closesAt);
  }
  if (contentChanged && quiz.currentVersionId) data.dirty = true;

  await prisma.$transaction(async (tx) => {
    await tx.quiz.update({ where: { id: quizId }, data });
    if (picked.tags) await setTags(tx, quizId, picked.tags);
  });
  await touch(quizId);
  return (await loadDetail(quizId))!;
}

export async function deleteQuiz(user: AuthLike, quizId: string) {
  await requireQuizOwner(user, quizId);
  if (await prisma.attempt.count({ where: { quizId, status: 'IN_PROGRESS', number: { gt: 0 } } }))
    throw conflict('Participants are mid-attempt. Close the quiz and wait for attempts to finish.', 'ATTEMPTS_IN_PROGRESS');
  await prisma.quiz.update({ where: { id: quizId }, data: { deletedAt: new Date(), status: 'ARCHIVED', accessCode: null } });
  await touch(quizId);
}

export async function duplicateQuiz(user: AuthLike, quizId: string) {
  const src = await requireQuizOwner(user, quizId);
  const [sections, questions, tags] = await Promise.all([
    prisma.section.findMany({ where: { quizId, deletedAt: null }, orderBy: { position: 'asc' } }),
    prisma.question.findMany({ where: { quizId, deletedAt: null }, orderBy: { position: 'asc' }, include: questionInclude }),
    prisma.quizTag.findMany({ where: { quizId }, include: { tag: true } }),
  ]);
  const copyId = await prisma.$transaction(async (tx) => {
    const copy = await tx.quiz.create({
      data: {
        ownerId: user.id, title: `Copy of ${src.title}`.slice(0, 150), description: src.description, categoryId: src.categoryId,
        difficulty: src.difficulty, settings: src.settings as Prisma.InputJsonValue, visibility: 'PRIVATE',
      },
    });
    const sectionMap = new Map<string, string>();
    for (const s of sections) {
      const ns = await tx.section.create({ data: { quizId: copy.id, title: s.title, description: s.description, position: s.position } });
      sectionMap.set(s.id, ns.id);
    }
    for (const q of questions) {
      await tx.question.create({
        data: {
          quizId: copy.id, sectionId: q.sectionId ? sectionMap.get(q.sectionId) ?? null : null, type: q.type, text: q.text,
          explanation: q.explanation, points: q.points, position: q.position, config: q.config as Prisma.InputJsonValue,
          options: { create: q.options.map((o) => ({ text: o.text, isCorrect: o.isCorrect, position: o.position })) },
        },
      });
    }
    await setTags(tx, copy.id, tags.map((t) => t.tag.name));
    return copy.id;
  });
  await touch(copyId);
  return (await loadDetail(copyId))!;
}

/* ───────────── lifecycle ───────────── */
function validateForPublish(questions: Awaited<ReturnType<typeof loadQuestionsForPublish>>) {
  if (!questions.length) throw unprocessable('Add at least one question before publishing', [{ message: 'No questions' }]);
  const problems: { questionId: string; position: number; message: string }[] = [];
  questions.forEach((q, i) => {
    const r = questionInputSchema.safeParse({
      type: q.type, text: q.text, explanation: q.explanation, points: q.points,
      options: q.options.map((o) => ({ text: o.text, isCorrect: o.isCorrect })), config: q.config ?? {},
    });
    if (!r.success) for (const issue of r.error.issues) problems.push({ questionId: q.id, position: i + 1, message: issue.message });
    else if (q.type !== 'LONG_ANSWER' && r.data.points <= 0) problems.push({ questionId: q.id, position: i + 1, message: 'Points must be greater than 0' });
  });
  if (problems.length) throw unprocessable('Some questions are invalid', problems);
}
const loadQuestionsForPublish = (tx: Tx, quizId: string) =>
  tx.question.findMany({ where: { quizId, deletedAt: null }, orderBy: { position: 'asc' }, include: questionInclude });

export async function publishQuiz(user: AuthLike, quizId: string) {
  const quiz = await requireQuizOwner(user, quizId);
  const republish = (quiz.status === 'LIVE' || quiz.status === 'SCHEDULED') && !!quiz.currentVersionId;
  if (quiz.status !== 'DRAFT' && !republish) throw conflict(`A ${quiz.status.toLowerCase()} quiz cannot be published; reopen it first`, 'INVALID_STATE');
  if (republish && !quiz.dirty) throw conflict('No unpublished changes', 'NO_CHANGES');
  const status = statusForSchedule(quiz.opensAt, quiz.closesAt);
  if (status === 'CLOSED') throw unprocessable('The closing time is already in the past');

  await prisma.$transaction(async (tx) => {
    const [questions, sections, last] = await Promise.all([
      loadQuestionsForPublish(tx, quizId),
      tx.section.findMany({ where: { quizId, deletedAt: null }, orderBy: { position: 'asc' } }),
      tx.quizVersion.aggregate({ where: { quizId }, _max: { number: true } }),
    ]);
    validateForPublish(questions);
    const number = (last._max.number ?? 0) + 1;
    const version = await tx.quizVersion.create({
      data: { quizId, number, publishedById: user.id, snapshot: buildSnapshot(quiz, number, sections, questions) as unknown as Prisma.InputJsonValue },
    });
    await tx.quiz.update({
      where: { id: quizId },
      data: { currentVersionId: version.id, dirty: false, status, accessCode: quiz.accessCode ?? (await uniqueCode()) },
    });
  }, { timeout: 20_000 });
  await touch(quizId);
  await auditLater('quiz.publish', user, quizId, { republish });
  return (await loadDetail(quizId))!;
}

async function auditLater(action: string, user: AuthLike, quizId: string, meta?: object) {
  await audit(null, user.id, action, 'Quiz', quizId, meta);
}

async function transition(user: AuthLike, quizId: string, allowed: Quiz['status'][], next: (q: Quiz) => Quiz['status'], action: string, extra?: (q: Quiz) => Prisma.QuizUpdateInput) {
  const quiz = await requireQuizOwner(user, quizId);
  if (!allowed.includes(quiz.status)) throw conflict(`Cannot ${action.split('.')[1]} a quiz that is ${quiz.status.toLowerCase()}`, 'INVALID_STATE');
  await prisma.quiz.update({ where: { id: quizId }, data: { status: next(quiz), ...(extra?.(quiz) ?? {}) } });
  await touch(quizId);
  await auditLater(action, user, quizId, { from: quiz.status });
  return (await loadDetail(quizId))!;
}

export const closeQuiz = (u: AuthLike, id: string) => transition(u, id, ['LIVE', 'SCHEDULED'], () => 'CLOSED', 'quiz.close');
export const archiveQuiz = (u: AuthLike, id: string) => transition(u, id, ['DRAFT', 'LIVE', 'SCHEDULED', 'CLOSED'], () => 'ARCHIVED', 'quiz.archive');
export const reopenQuiz = (u: AuthLike, id: string) =>
  transition(
    u, id, ['CLOSED', 'ARCHIVED'],
    (q) => (q.currentVersionId ? statusForSchedule(q.opensAt, q.closesAt && q.closesAt > new Date() ? q.closesAt : null) : 'DRAFT'),
    'quiz.reopen',
    // an elapsed closing time would immediately re-close the quiz
    (q) => (q.closesAt && q.closesAt <= new Date() ? { closesAt: null } : {}),
  );

export async function listVersions(user: AuthLike, quizId: string) {
  await requireQuizOwner(user, quizId);
  const rows = await prisma.quizVersion.findMany({
    where: { quizId }, orderBy: { number: 'desc' }, select: { id: true, number: true, createdAt: true, _count: { select: { attempts: true } } },
  });
  return rows.map((v) => ({ id: v.id, number: v.number, createdAt: v.createdAt.toISOString(), attemptCount: v._count.attempts }));
}

export async function regrade(user: AuthLike, quizId: string, versionId?: string) {
  await requireQuizOwner(user, quizId);
  if (versionId && !(await prisma.quizVersion.findFirst({ where: { id: versionId, quizId }, select: { id: true } }))) throw notFound('Version');
  const out = await regradeQuiz(quizId, versionId);
  await touch(quizId);
  await auditLater('quiz.regrade', user, quizId, { versionId, ...out });
  return out;
}

/* ───────────── sections ───────────── */
async function markDirty(quiz: Pick<Quiz, 'id' | 'currentVersionId'>) {
  if (quiz.currentVersionId) await prisma.quiz.update({ where: { id: quiz.id }, data: { dirty: true } });
  await touch(quiz.id);
}

const sectionInput = z.object({ title: z.string().trim().min(1).max(120), description: z.string().trim().max(1000).default('') });
export const sectionSchemas = { create: sectionInput, patch: sectionInput.partial().extend({ title: z.string().trim().min(1).max(120).optional(), description: z.string().trim().max(1000).optional() }) };

export async function addSection(user: AuthLike, quizId: string, input: z.infer<typeof sectionInput>) {
  const quiz = await requireQuizOwner(user, quizId);
  const last = await prisma.section.aggregate({ where: { quizId, deletedAt: null }, _max: { position: true } });
  const s = await prisma.section.create({ data: { quizId, title: clean(input.title), description: clean(input.description), position: (last._max.position ?? -1) + 1 } });
  await markDirty(quiz);
  return { id: s.id, title: s.title, description: s.description, position: s.position };
}

async function sectionWithOwner(user: AuthLike, sectionId: string) {
  const s = await prisma.section.findFirst({ where: { id: sectionId, deletedAt: null } });
  if (!s) throw notFound('Section');
  const quiz = await requireQuizOwner(user, s.quizId);
  return { s, quiz };
}

export async function patchSection(user: AuthLike, sectionId: string, input: { title?: string; description?: string }) {
  const { s, quiz } = await sectionWithOwner(user, sectionId);
  const u = await prisma.section.update({
    where: { id: s.id },
    data: { title: input.title === undefined ? undefined : clean(input.title), description: input.description === undefined ? undefined : clean(input.description) },
  });
  await markDirty(quiz);
  return { id: u.id, title: u.title, description: u.description, position: u.position };
}

export async function deleteSection(user: AuthLike, sectionId: string) {
  const { s, quiz } = await sectionWithOwner(user, sectionId);
  await prisma.$transaction([
    prisma.question.updateMany({ where: { sectionId: s.id }, data: { sectionId: null } }),
    prisma.section.update({ where: { id: s.id }, data: { deletedAt: new Date() } }),
  ]);
  await markDirty(quiz);
}

/* ───────────── questions ───────────── */
async function assertSection(quizId: string, sectionId: string | null | undefined) {
  if (sectionId && !(await prisma.section.findFirst({ where: { id: sectionId, quizId, deletedAt: null }, select: { id: true } }))) throw badRequest('Section does not belong to this quiz');
}

const questionData = (q: QuestionInput) => ({
  type: q.type, text: clean(q.text), explanation: clean(q.explanation), points: q.points,
  config: {
    ...q.config, acceptedAnswers: q.config.acceptedAnswers.map(clean),
    rubric: q.config.rubric.map((r) => ({ ...r, criterion: clean(r.criterion) })),
  } as Prisma.InputJsonValue,
});
const optionData = (q: QuestionInput) => q.options.map((o, i) => ({ text: clean(o.text), isCorrect: o.isCorrect, position: i }));

export async function addQuestion(user: AuthLike, quizId: string, input: QuestionInput) {
  const quiz = await requireQuizOwner(user, quizId);
  await assertSection(quizId, input.sectionId);
  const last = await prisma.question.aggregate({ where: { quizId, deletedAt: null }, _max: { position: true } });
  const q = await prisma.question.create({
    data: { quizId, sectionId: input.sectionId ?? null, position: (last._max.position ?? -1) + 1, ...questionData(input), options: { create: optionData(input) } },
    include: questionInclude,
  });
  await markDirty(quiz);
  return toAuthorQuestion(q);
}

async function questionWithOwner(user: AuthLike, questionId: string) {
  const q = await prisma.question.findFirst({ where: { id: questionId, deletedAt: null } });
  if (!q) throw notFound('Question');
  const quiz = await requireQuizOwner(user, q.quizId);
  return { q, quiz };
}

/** Full replace of a question (options are re-created, so option ids change in the draft; published versions are unaffected). */
export async function replaceQuestion(user: AuthLike, questionId: string, input: QuestionInput) {
  const { q, quiz } = await questionWithOwner(user, questionId);
  await assertSection(q.quizId, input.sectionId);
  const updated = await prisma.$transaction(async (tx) => {
    await tx.option.deleteMany({ where: { questionId } });
    return tx.question.update({
      where: { id: questionId },
      data: { sectionId: input.sectionId === undefined ? q.sectionId : input.sectionId, ...questionData(input), options: { create: optionData(input) } },
      include: questionInclude,
    });
  });
  await markDirty(quiz);
  return toAuthorQuestion(updated);
}

export async function deleteQuestion(user: AuthLike, questionId: string) {
  const { q, quiz } = await questionWithOwner(user, questionId);
  await prisma.question.update({ where: { id: q.id }, data: { deletedAt: new Date() } });
  await markDirty(quiz);
}

export async function reorder(user: AuthLike, quizId: string, input: { items: { id: string; sectionId: string | null; position: number }[]; sections?: { id: string; position: number }[] }) {
  const quiz = await requireQuizOwner(user, quizId);
  const [qs, ss] = await Promise.all([
    prisma.question.findMany({ where: { quizId, deletedAt: null }, select: { id: true } }),
    prisma.section.findMany({ where: { quizId, deletedAt: null }, select: { id: true } }),
  ]);
  const qIds = new Set(qs.map((x) => x.id));
  const sIds = new Set(ss.map((x) => x.id));
  if (input.items.some((i) => !qIds.has(i.id) || (i.sectionId && !sIds.has(i.sectionId)))) throw badRequest('Unknown question or section in reorder');
  if (input.sections?.some((s) => !sIds.has(s.id))) throw badRequest('Unknown section in reorder');
  await prisma.$transaction([
    ...input.items.map((i) => prisma.question.update({ where: { id: i.id }, data: { sectionId: i.sectionId, position: i.position } })),
    ...(input.sections ?? []).map((s) => prisma.section.update({ where: { id: s.id }, data: { position: s.position } })),
  ]);
  await markDirty(quiz);
  return (await loadDetail(quizId))!;
}

export async function importBank(user: AuthLike, quizId: string, bankIds: string[], sectionId?: string | null) {
  const quiz = await requireQuizOwner(user, quizId);
  await assertSection(quizId, sectionId);
  const bank = await prisma.bankQuestion.findMany({ where: { id: { in: bankIds }, deletedAt: null, ...(isAdmin(user) ? {} : { ownerId: user.id }) } });
  if (bank.length !== new Set(bankIds).size) throw notFound('Bank question');
  const last = await prisma.question.aggregate({ where: { quizId, deletedAt: null }, _max: { position: true } });
  let pos = (last._max.position ?? -1) + 1;
  await prisma.$transaction(async (tx) => {
    for (const id of bankIds) {
      const b = bank.find((x) => x.id === id)!;
      const opts = (b.options as { text: string; isCorrect: boolean }[]) ?? [];
      await tx.question.create({
        data: {
          quizId, sectionId: sectionId ?? null, type: b.type, text: b.text, explanation: b.explanation, points: b.points,
          position: pos++, config: b.config as Prisma.InputJsonValue,
          options: { create: opts.map((o, i) => ({ text: o.text, isCorrect: o.isCorrect, position: i })) },
        },
      });
    }
  });
  await markDirty(quiz);
  return (await loadDetail(quizId))!;
}

/* ───────────── access ───────────── */
export const accessUpdate = z.object({
  visibility: z.enum(['PUBLIC', 'UNLISTED', 'PRIVATE']).optional(),
  regenerateCode: z.boolean().optional(),
  cohortIds: z.array(z.string().max(40)).max(200).optional(),
  userIds: z.array(z.string().max(40)).max(2000).optional(),
});

export async function getAccess(user: AuthLike, quizId: string) {
  const quiz = await requireQuizOwner(user, quizId);
  const [assignments, invitations] = await Promise.all([
    prisma.quizAssignment.findMany({ where: { quizId, cohort: { deletedAt: null } }, select: { cohort: { select: { id: true, name: true, _count: { select: { members: true } } } } } }),
    prisma.invitation.findMany({ where: { quizId }, select: { user: { select: { id: true, username: true, name: true } } }, take: 2000 }),
  ]);
  return {
    visibility: quiz.visibility, accessCode: quiz.accessCode,
    cohorts: assignments.map((a) => ({ id: a.cohort.id, name: a.cohort.name, memberCount: a.cohort._count.members })),
    users: invitations.map((i) => i.user),
  };
}

export async function updateAccess(user: AuthLike, quizId: string, input: z.infer<typeof accessUpdate>) {
  const quiz = await requireQuizOwner(user, quizId);
  if (input.cohortIds) {
    const owned = await prisma.cohort.count({ where: { id: { in: input.cohortIds }, deletedAt: null, ...(isAdmin(user) ? {} : { ownerId: user.id }) } });
    if (owned !== new Set(input.cohortIds).size) throw badRequest('Unknown cohort');
  }
  if (input.userIds && (await prisma.user.count({ where: { id: { in: input.userIds }, deletedAt: null } })) !== new Set(input.userIds).size) throw badRequest('Unknown user');
  const needsCode = input.regenerateCode || (!quiz.accessCode && (input.visibility ?? quiz.visibility) !== 'PUBLIC' && !!quiz.currentVersionId);
  const accessCode = needsCode ? await uniqueCode() : undefined;
  await prisma.$transaction(async (tx) => {
    await tx.quiz.update({ where: { id: quizId }, data: { visibility: input.visibility, accessCode } });
    if (input.cohortIds) {
      await tx.quizAssignment.deleteMany({ where: { quizId } });
      await tx.quizAssignment.createMany({ data: [...new Set(input.cohortIds)].map((cohortId) => ({ quizId, cohortId })) });
    }
    if (input.userIds) {
      await tx.invitation.deleteMany({ where: { quizId, userId: { notIn: input.userIds } } });
      await tx.invitation.createMany({ data: [...new Set(input.userIds)].map((userId) => ({ quizId, userId })), skipDuplicates: true });
    }
  });
  await touch(quizId);
  await auditLater('quiz.access', user, quizId, { visibility: input.visibility, regenerated: !!input.regenerateCode });
  return getAccess(user, quizId);
}
