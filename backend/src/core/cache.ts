import Redis from 'ioredis';
import { env } from './env';

/** Tiny cache with tag invalidation. Redis when REDIS_URL is set, otherwise in-process map. */
export interface Cache {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown, ttlSec: number, tags?: string[]): Promise<void>;
  invalidateTags(...tags: string[]): Promise<void>;
  del(...keys: string[]): Promise<void>;
  clear(): Promise<void>;
}

class MemoryCache implements Cache {
  private store = new Map<string, { v: string; exp: number }>();
  private tags = new Map<string, Set<string>>();
  private static MAX = 2000;
  async get<T>(key: string) {
    const e = this.store.get(key);
    if (!e) return null;
    if (e.exp < Date.now()) { this.store.delete(key); return null; }
    return JSON.parse(e.v) as T;
  }
  async set(key: string, value: unknown, ttlSec: number, tags: string[] = []) {
    if (this.store.size >= MemoryCache.MAX) this.store.delete(this.store.keys().next().value as string);
    this.store.set(key, { v: JSON.stringify(value), exp: Date.now() + ttlSec * 1000 });
    for (const t of tags) {
      let s = this.tags.get(t);
      if (!s) this.tags.set(t, (s = new Set()));
      s.add(key);
    }
  }
  async invalidateTags(...tags: string[]) {
    for (const t of tags) {
      for (const k of this.tags.get(t) ?? []) this.store.delete(k);
      this.tags.delete(t);
    }
  }
  async del(...keys: string[]) { keys.forEach((k) => this.store.delete(k)); }
  async clear() { this.store.clear(); this.tags.clear(); }
}

class RedisCache implements Cache {
  private r: Redis;
  constructor(url: string) {
    this.r = new Redis(url, { maxRetriesPerRequest: 2 });
    this.r.on('error', (e) => console.error('[redis]', e.message));
  }
  async get<T>(key: string) {
    const v = await this.r.get(`c:${key}`).catch(() => null);
    return v ? (JSON.parse(v) as T) : null;
  }
  async set(key: string, value: unknown, ttlSec: number, tags: string[] = []) {
    const p = this.r.multi().set(`c:${key}`, JSON.stringify(value), 'EX', ttlSec);
    for (const t of tags) { p.sadd(`t:${t}`, `c:${key}`); p.expire(`t:${t}`, ttlSec * 2); }
    await p.exec().catch(() => undefined);
  }
  async invalidateTags(...tags: string[]) {
    for (const t of tags) {
      const keys = await this.r.smembers(`t:${t}`).catch(() => [] as string[]);
      if (keys.length) await this.r.del(...keys).catch(() => undefined);
      await this.r.del(`t:${t}`).catch(() => undefined);
    }
  }
  async del(...keys: string[]) { if (keys.length) await this.r.del(...keys.map((k) => `c:${k}`)).catch(() => undefined); }
  async clear() { await this.r.flushdb().catch(() => undefined); }
}

export const cache: Cache = env.REDIS_URL ? new RedisCache(env.REDIS_URL) : new MemoryCache();

/** get-or-compute helper */
export async function cached<T>(key: string, ttlSec: number, tags: string[], fn: () => Promise<T>): Promise<T> {
  const hit = await cache.get<T>(key);
  if (hit !== null) return hit;
  const v = await fn();
  await cache.set(key, v, ttlSec, tags);
  return v;
}
/** Tag conventions: `quiz:<id>` (metadata/reports/leaderboard of that quiz), `catalog`, `leaderboard:global`, `user:<id>`. */
