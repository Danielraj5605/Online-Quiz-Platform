import { Router } from 'express';
import { z } from 'zod';
import { me, organizerOrAdmin } from '../../core/auth';
import { prisma } from '../../core/db';
import { cached, cache } from '../../core/cache';
import { body, created, ok, query, wrap } from '../../core/http';
import { etagJson } from '../../core/etag';
import { conflict } from '../../core/errors';
import { clean } from '../../core/sanitize';
import { writeLimiter } from '../../core/rateLimit';
import { audit } from '../../core/audit';

export const taxonomyRouter = Router();

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'category';

taxonomyRouter.get('/categories', wrap(async (req, res) => {
  const items = await cached('categories', 300, ['categories'], () =>
    prisma.category.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true, slug: true } }));
  etagJson(req, res, items);
}));

taxonomyRouter.post('/categories', organizerOrAdmin, writeLimiter, wrap(async (req, res) => {
  const { name } = body(z.object({ name: z.string().trim().min(2).max(40) }), req);
  const cleanName = clean(name);
  const slug = slugify(cleanName);
  if (await prisma.category.findFirst({ where: { OR: [{ name: { equals: cleanName, mode: 'insensitive' } }, { slug }] } })) throw conflict('Category already exists');
  const c = await prisma.category.create({ data: { name: cleanName, slug } });
  await cache.invalidateTags('categories');
  await audit(req, me(req).id, 'category.create', 'Category', c.id);
  created(res, { id: c.id, name: c.name, slug: c.slug });
}));

taxonomyRouter.get('/tags', wrap(async (req, res) => {
  const { q } = query(z.object({ q: z.string().max(40).optional() }), req);
  const tags = await prisma.tag.findMany({
    where: q ? { name: { contains: q.toLowerCase(), mode: 'insensitive' } } : undefined,
    orderBy: { quizzes: { _count: 'desc' } }, take: 50, select: { id: true, name: true },
  });
  ok(res, tags);
}));
