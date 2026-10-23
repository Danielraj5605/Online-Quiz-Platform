import { useCallback, useRef, useState } from 'react';

export interface HistoryEntry {
  label: string;
  undo: () => Promise<void>;
  redo: () => Promise<void>;
  /** consecutive entries with the same key within `COALESCE_MS` merge (keeps the first undo, takes the latest redo) */
  coalesceKey?: string;
}

const COALESCE_MS = 4000;
const LIMIT = 100;

/** Linear undo/redo stack of server-side operations. Each entry knows how to reverse and replay itself. */
export function useHistory() {
  const past = useRef<(HistoryEntry & { at: number })[]>([]);
  const future = useRef<HistoryEntry[]>([]);
  const [, bump] = useState(0);
  const busy = useRef(false);
  const rerender = () => bump((n) => n + 1);

  const push = useCallback((e: HistoryEntry) => {
    const top = past.current[past.current.length - 1];
    const now = Date.now();
    if (e.coalesceKey && top?.coalesceKey === e.coalesceKey && now - top.at < COALESCE_MS) {
      past.current[past.current.length - 1] = { ...top, redo: e.redo, at: now, label: e.label };
    } else {
      past.current.push({ ...e, at: now });
      if (past.current.length > LIMIT) past.current.shift();
    }
    future.current = [];
    rerender();
  }, []);

  const undo = useCallback(async () => {
    const e = past.current.pop();
    if (!e || busy.current) return;
    busy.current = true;
    try { await e.undo(); future.current.push(e); } catch (err) { past.current.push(e as never); throw err; } finally { busy.current = false; rerender(); }
  }, []);

  const redo = useCallback(async () => {
    const e = future.current.pop();
    if (!e || busy.current) return;
    busy.current = true;
    try { await e.redo(); past.current.push({ ...e, at: 0 }); } catch (err) { future.current.push(e); throw err; } finally { busy.current = false; rerender(); }
  }, []);

  return {
    push, undo, redo,
    canUndo: past.current.length > 0,
    canRedo: future.current.length > 0,
    undoLabel: past.current[past.current.length - 1]?.label,
    redoLabel: future.current[future.current.length - 1]?.label,
  };
}
