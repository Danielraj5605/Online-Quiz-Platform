import type { AnswerValue } from '@quiz/shared';
import type { ApiError } from '@/lib/api/client';

export interface PendingItem { questionId: string; value: AnswerValue; flagged: boolean; timeSpentMs: number }
export type SaveStatus = 'idle' | 'saving' | 'saved' | 'offline' | 'error' | 'expired';

export interface KeyValueStore { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem(k: string): void }

export interface SaveQueueOptions {
  attemptId: string;
  /** performs the network save; must throw ApiError (status 0 = network down) on failure */
  save: (items: PendingItem[]) => Promise<unknown>;
  onStatus: (s: SaveStatus, pendingCount: number) => void;
  storage?: KeyValueStore | null;
  debounceMs?: number;
  /** retry delay after a network/server error (ms) */
  retryMs?: number;
}

const key = (id: string) => `quizzo:pending:${id}`;
type Versioned = PendingItem & { v: number };
const strip = ({ v: _v, ...i }: Versioned): PendingItem => i;

/**
 * Debounced autosave with a durable offline queue.
 * - the latest value per question wins; the queue is mirrored to localStorage so a reload/crash never loses answers
 * - items are only removed after the server confirmed that exact version (edits made while a request was in flight stay queued)
 * - network errors → status "offline", retried on `online` and with a timer
 * - 409 ATTEMPT_EXPIRED/ATTEMPT_CLOSED → status "expired"; queued answers are kept in storage, never silently dropped
 */
export class SaveQueue {
  private pending = new Map<string, Versioned>();
  private version = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private inflight: Promise<void> | null = null;
  private dead = false;
  status: SaveStatus = 'idle';

  constructor(private o: SaveQueueOptions) {
    for (const i of this.load()) this.pending.set(i.questionId, { ...i, v: ++this.version });
  }

  private store() { return this.o.storage === undefined ? safeLocal() : this.o.storage; }
  private load(): PendingItem[] {
    try { const raw = this.store()?.getItem(key(this.o.attemptId)); return raw ? (JSON.parse(raw) as PendingItem[]) : []; } catch { return []; }
  }
  private persist() {
    try {
      const s = this.store();
      if (!s) return;
      if (this.pending.size === 0) s.removeItem(key(this.o.attemptId));
      else s.setItem(key(this.o.attemptId), JSON.stringify([...this.pending.values()].map(strip)));
    } catch { /* storage full or blocked — the in-memory queue still works */ }
  }
  private set(s: SaveStatus) { this.status = s; this.o.onStatus(s, this.pending.size); }

  /** items restored from a previous session (for merging into UI state) */
  restored(): PendingItem[] { return [...this.pending.values()].map(strip); }
  get pendingCount() { return this.pending.size; }

  enqueue(item: PendingItem) {
    if (this.dead) return;
    this.pending.set(item.questionId, { ...item, v: ++this.version });
    this.persist();
    this.set(this.status === 'offline' ? 'offline' : 'saving');
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.flush(), this.o.debounceMs ?? 800);
  }

  /** Sends everything queued now. Resolves when settled (never rejects). */
  async flush(): Promise<void> {
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
    if (this.dead) return;
    if (this.inflight) { await this.inflight; if (this.dead || this.pending.size === 0) return; }
    if (this.pending.size === 0) { if (this.status === 'saving') this.set('saved'); return; }
    const batch = [...this.pending.values()];
    this.set('saving');
    this.inflight = (async () => {
      try {
        await this.o.save(batch.map(strip));
        for (const b of batch) if (this.pending.get(b.questionId)?.v === b.v) this.pending.delete(b.questionId);
        this.persist();
        this.set(this.pending.size ? 'saving' : 'saved');
        if (this.pending.size) this.timer = setTimeout(() => void this.flush(), 0);
      } catch (e) {
        const err = e as ApiError;
        if (err.status === 409 && (err.code === 'ATTEMPT_EXPIRED' || err.code === 'ATTEMPT_CLOSED')) {
          this.dead = true; this.persist(); this.set('expired');
        } else if (err.status === 0 || (typeof navigator !== 'undefined' && navigator.onLine === false)) {
          this.set('offline'); this.scheduleRetry();
        } else if (err.status === 401 || err.status === 403 || err.status === 404) {
          this.set('error');
        } else {
          this.set('error'); this.scheduleRetry();
        }
      } finally {
        this.inflight = null;
      }
    })();
    await this.inflight;
  }

  /** Call when the browser reports connectivity again. */
  notifyOnline() { if (this.status === 'offline' || this.status === 'error') void this.flush(); }

  private scheduleRetry() {
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = setTimeout(() => { this.retryTimer = null; void this.flush(); }, this.o.retryMs ?? 5000);
  }

  /** Drop everything, e.g. after a successful submit. */
  clear() {
    this.dead = true;
    if (this.timer) clearTimeout(this.timer);
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.pending.clear();
    this.persist();
  }
  /** Stop timers without discarding the stored queue (unmount). */
  dispose() {
    if (this.timer) clearTimeout(this.timer);
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.dead = true;
  }
}

function safeLocal(): KeyValueStore | null {
  try { return typeof localStorage === 'undefined' ? null : localStorage; } catch { return null; }
}
