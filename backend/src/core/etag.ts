import crypto from 'node:crypto';
import type { Request, Response } from 'express';
import type { PageMeta } from '@quiz/shared';

/** Sends `{data, meta?}` with a weak ETag; answers 304 when If-None-Match matches. */
export function etagJson<T>(req: Request, res: Response, data: T, meta?: PageMeta, cacheControl = 'private, max-age=0, must-revalidate') {
  const payload = meta ? { data, meta } : { data };
  const body = JSON.stringify(payload);
  const tag = `W/"${crypto.createHash('sha1').update(body).digest('base64url')}"`;
  res.set('ETag', tag);
  res.set('Cache-Control', cacheControl);
  if (req.headers['if-none-match'] === tag) return res.status(304).end();
  return res.type('application/json').send(body);
}
