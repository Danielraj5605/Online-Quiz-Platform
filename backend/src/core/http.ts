import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { ZodType } from 'zod';
import { z } from 'zod';
import type { PageMeta } from '@quiz/shared';
import { badRequest } from './errors';

export const wrap = (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown> | unknown): RequestHandler =>
  (req, res, next) => { Promise.resolve(fn(req, res, next)).catch(next); };

export const ok = <T>(res: Response, data: T, meta?: PageMeta, status = 200) => res.status(status).json(meta ? { data, meta } : { data });
export const created = <T>(res: Response, data: T) => ok(res, data, undefined, 201);
export const noContent = (res: Response) => res.status(204).end();

export const pageMeta = (page: number, pageSize: number, total: number): PageMeta =>
  ({ page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) });

function parse<T>(schema: ZodType<T>, data: unknown, where: string): T {
  const r = schema.safeParse(data);
  if (!r.success) {
    throw badRequest(`Invalid ${where}`, r.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })));
  }
  return r.data;
}
export const body = <T>(schema: ZodType<T>, req: Request) => parse(schema, req.body, 'body');
export const query = <T>(schema: ZodType<T>, req: Request) => parse(schema, req.query, 'query');
export const idParam = (req: Request, name = 'id') => parse(z.string().min(1).max(40), req.params[name], `param ${name}`);

/** Parses sort="field" | "-field" against a whitelist. */
export function orderBy<T extends string>(sort: string | undefined, allowed: readonly T[], fallback: { [K in T]?: 'asc' | 'desc' }) {
  if (!sort) return fallback;
  const desc = sort.startsWith('-');
  const f = (desc ? sort.slice(1) : sort) as T;
  if (!allowed.includes(f)) return fallback;
  return { [f]: desc ? 'desc' : 'asc' } as { [K in T]?: 'asc' | 'desc' };
}
export const skipTake = (p: { page: number; pageSize: number }) => ({ skip: (p.page - 1) * p.pageSize, take: p.pageSize });
