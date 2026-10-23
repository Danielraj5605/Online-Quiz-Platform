import { useCallback, useRef, useState } from 'react';

export interface HistoryEntry {
  label: string;
  undo: () => Promise<void>;
  redo: () => Promise<void>;
  /** consecutive entries with the same key within `COALESCE_MS` merge (keeps the first undo, takes the latest redo) */
  coalesceKey?: string;
}
type Stamped = HistoryEntry & { at: number };
interface Stacks { past: Stamped[]; future: Stamped[] }

const COALESCE_MS = 4000;
const LIMIT = 100;

/** Linear undo/redo stack of server-side operations. Each entry knows how to reverse and replay itself. */
export function useHistory() {
  const [stacks, setStacks] = useState<Stacks>({ past: [], future: [] });
  // mirror of `stacks` for use inside async callbacks (only read/written in callbacks, never during render)
  const live = useRef<Stacks>(stacks);
  const busy = useRef(false);
  const commit = (next: Stacks) => { live.current = next; setStacks(next); };

  const push = useCallback((e: HistoryEntry) => {
    const { past } = live.current;
    const top = past[past.length - 1];
    const now = Date.now();
    let nextPast: Stamped[];
    if (e.coalesceKey && top?.coalesceKey === e.coalesceKey && now - top.at < COALESCE_MS) {
      nextPast = [...past.slice(0, -1), { ...top, redo: e.redo, at: now, label: e.label }];
    } else {
      nextPast = [...past, { ...e, at: now }].slice(-LIMIT);
    }
    commit({ past: nextPast, future: [] });
  }, []);

  const undo = useCallback(async () => {
    const { past, future } = live.current;
    const e = past[past.length - 1];
    if (!e || busy.current) return;
    busy.current = true;
    try {
      await e.undo();
      commit({ past: past.slice(0, -1), future: [...future, e] });
    } finally { busy.current = false; }
  }, []);

  const redo = useCallback(async () => {
    const { past, future } = live.current;
    const e = future[future.length - 1];
    if (!e || busy.current) return;
    busy.current = true;
    try {
      await e.redo();
      commit({ past: [...past, { ...e, at: 0 }], future: future.slice(0, -1) });
    } finally { busy.current = false; }
  }, []);

  const lastPast = stacks.past[stacks.past.length - 1];
  const lastFuture = stacks.future[stacks.future.length - 1];
  return {
    push, undo, redo,
    canUndo: stacks.past.length > 0,
    canRedo: stacks.future.length > 0,
    undoLabel: lastPast?.label,
    redoLabel: lastFuture?.label,
  };
}
