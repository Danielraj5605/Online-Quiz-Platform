import type { ApiErr, AuthResult, PageMeta } from '@quiz/shared';

const BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? '';
export const API = `${BASE}/api/v1`;

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: unknown) {
    super(message);
    this.name = 'ApiError';
  }
  /** field -> message map when the server returned zod issues */
  get fieldErrors(): Record<string, string> {
    if (!Array.isArray(this.details)) return {};
    const out: Record<string, string> = {};
    for (const d of this.details as { path?: string; message?: string }[]) if (d.path && d.message && !out[d.path]) out[d.path] = d.message;
    return out;
  }
}

/** Access token lives in memory only (never localStorage); the refresh token is an httpOnly cookie. */
let accessToken: string | null = null;
export const tokenStore = { get: () => accessToken, set: (t: string | null) => { accessToken = t; } };

type SessionListener = (r: AuthResult | null) => void;
let onSession: SessionListener = () => {};
export const setSessionListener = (fn: SessionListener) => { onSession = fn; };

let refreshing: Promise<AuthResult | null> | null = null;
/** Single-flight refresh: concurrent 401s share one request. */
export function refreshSession(): Promise<AuthResult | null> {
  refreshing ??= (async () => {
    try {
      const res = await fetch(`${API}/auth/refresh`, { method: 'POST', credentials: 'include' });
      if (!res.ok) { tokenStore.set(null); onSession(null); return null; }
      const { data } = (await res.json()) as { data: AuthResult };
      tokenStore.set(data.accessToken);
      onSession(data);
      return data;
    } catch {
      return null;
    } finally {
      setTimeout(() => { refreshing = null; }, 0);
    }
  })();
  return refreshing;
}

export interface RequestOptions {
  query?: object;
  body?: unknown;
  signal?: AbortSignal;
  /** skip the 401 → refresh → retry dance (used by auth endpoints) */
  noRefresh?: boolean;
}
export interface Paged<T> { data: T; meta: PageMeta }

function qs(query?: object) {
  if (!query) return '';
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== null && v !== '') p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : '';
}

async function raw(method: string, path: string, o: RequestOptions, retried = false): Promise<Response> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (o.body !== undefined) headers['Content-Type'] = 'application/json';
  const t = tokenStore.get();
  if (t) headers.Authorization = `Bearer ${t}`;
  let res: Response;
  try {
    res = await fetch(`${API}${path}${qs(o.query)}`, {
      method, headers, credentials: 'include', signal: o.signal,
      body: o.body !== undefined ? JSON.stringify(o.body) : undefined,
    });
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
    throw new ApiError(0, 'NETWORK', 'Cannot reach the server. Check your connection.');
  }
  if (res.status === 401 && !retried && !o.noRefresh) {
    const s = await refreshSession();
    if (s) return raw(method, path, o, true);
  }
  if (!res.ok) {
    let err: ApiErr['error'] = { code: 'HTTP_' + res.status, message: res.statusText || 'Request failed' };
    try { err = ((await res.json()) as ApiErr).error ?? err; } catch { /* non-JSON error body */ }
    throw new ApiError(res.status, err.code, err.message, err.details);
  }
  return res;
}

async function json<T>(method: string, path: string, o: RequestOptions = {}): Promise<Paged<T>> {
  const res = await raw(method, path, o);
  if (res.status === 204) return { data: undefined as T, meta: undefined as unknown as PageMeta };
  const j = (await res.json()) as { data: T; meta?: PageMeta };
  return { data: j.data, meta: j.meta as PageMeta };
}

export const api = {
  get: <T>(path: string, query?: object, signal?: AbortSignal) => json<T>('GET', path, { query, signal }).then((r) => r.data),
  page: <T>(path: string, query?: object, signal?: AbortSignal) => json<T[]>('GET', path, { query, signal }),
  post: <T>(path: string, body?: unknown, o: RequestOptions = {}) => json<T>('POST', path, { ...o, body: body ?? {} }).then((r) => r.data),
  put: <T>(path: string, body?: unknown) => json<T>('PUT', path, { body: body ?? {} }).then((r) => r.data),
  patch: <T>(path: string, body?: unknown) => json<T>('PATCH', path, { body: body ?? {} }).then((r) => r.data),
  del: <T = void>(path: string) => json<T>('DELETE', path).then((r) => r.data),
  /** Authenticated file download (CSV/PDF). Triggers a browser save. */
  async download(path: string, filename: string, query?: object) {
    const res = await raw('GET', path, { query });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },
};
