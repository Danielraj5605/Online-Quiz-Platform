import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api/client';
import { SaveQueue, type KeyValueStore, type PendingItem, type SaveStatus } from './saveQueue';

const memStore = (): KeyValueStore & { data: Map<string, string> } => {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v), removeItem: (k) => void data.delete(k) };
};
const item = (q: string, text: string): PendingItem => ({ questionId: q, value: { text }, flagged: false, timeSpentMs: 10 });

describe('SaveQueue', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('debounces and sends only the latest value per question', async () => {
    const save = vi.fn().mockResolvedValue({});
    const q = new SaveQueue({ attemptId: 'a1', save, onStatus: () => {}, storage: memStore(), debounceMs: 500 });
    q.enqueue(item('q1', 'a')); q.enqueue(item('q1', 'ab')); q.enqueue(item('q2', 'x'));
    expect(save).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(500);
    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0]![0]).toEqual([item('q1', 'ab'), item('q2', 'x')]);
    expect(q.status).toBe('saved');
    expect(q.pendingCount).toBe(0);
  });

  it('mirrors the queue to storage and restores it after a reload', () => {
    const store = memStore();
    const a = new SaveQueue({ attemptId: 'a1', save: vi.fn(), onStatus: () => {}, storage: store });
    a.enqueue(item('q1', 'draft'));
    expect(store.data.get('quizzo:pending:a1')).toContain('draft');
    a.dispose();
    const b = new SaveQueue({ attemptId: 'a1', save: vi.fn(), onStatus: () => {}, storage: store });
    expect(b.restored()).toEqual([item('q1', 'draft')]);
  });

  it('keeps answers queued while offline and replays them when connectivity returns', async () => {
    const statuses: SaveStatus[] = [];
    const save = vi.fn().mockRejectedValueOnce(new ApiError(0, 'NETWORK', 'down')).mockResolvedValue({});
    const q = new SaveQueue({ attemptId: 'a1', save, onStatus: (s) => statuses.push(s), storage: memStore(), debounceMs: 100, retryMs: 60_000 });
    q.enqueue(item('q1', 'x'));
    await vi.advanceTimersByTimeAsync(100);
    expect(q.status).toBe('offline');
    expect(q.pendingCount).toBe(1);
    q.notifyOnline();
    await vi.advanceTimersByTimeAsync(0);
    expect(save).toHaveBeenCalledTimes(2);
    expect(q.status).toBe('saved');
    expect(q.pendingCount).toBe(0);
    expect(statuses).toContain('offline');
  });

  it('does not drop edits made while a request is in flight', async () => {
    let release!: () => void;
    const save = vi.fn().mockImplementationOnce(() => new Promise<void>((r) => { release = r; })).mockResolvedValue({});
    const q = new SaveQueue({ attemptId: 'a1', save, onStatus: () => {}, storage: memStore(), debounceMs: 10 });
    q.enqueue(item('q1', 'v1'));
    await vi.advanceTimersByTimeAsync(10);
    q.enqueue(item('q1', 'v2')); // edited during the request
    release();
    await vi.advanceTimersByTimeAsync(1000);
    expect(save).toHaveBeenCalledTimes(2);
    expect(save.mock.calls[1]![0]).toEqual([item('q1', 'v2')]);
    expect(q.pendingCount).toBe(0);
  });

  it('on 409 expiry stops sending but keeps the answers in storage', async () => {
    const store = memStore();
    const save = vi.fn().mockRejectedValue(new ApiError(409, 'ATTEMPT_EXPIRED', 'Time is up'));
    const q = new SaveQueue({ attemptId: 'a1', save, onStatus: () => {}, storage: store, debounceMs: 10 });
    q.enqueue(item('q1', 'late'));
    await vi.advanceTimersByTimeAsync(10);
    expect(q.status).toBe('expired');
    expect(store.data.get('quizzo:pending:a1')).toContain('late');
    q.enqueue(item('q1', 'later'));
    await vi.advanceTimersByTimeAsync(1000);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('clear() empties storage after a successful submit', () => {
    const store = memStore();
    const q = new SaveQueue({ attemptId: 'a1', save: vi.fn(), onStatus: () => {}, storage: store });
    q.enqueue(item('q1', 'x'));
    q.clear();
    expect(store.data.size).toBe(0);
  });
});
