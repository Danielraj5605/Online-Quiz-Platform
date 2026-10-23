import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, Check, Loader2 } from 'lucide-react';
import { fmtDate } from '@/lib/utils';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

/** Tracks in-flight saves so the builder can show Saving… / Saved / Couldn't save. */
export function useSaveTracker() {
  const [state, setState] = useState<{ status: SaveStatus; at: number | null; error?: string }>({ status: 'idle', at: null });
  const inflight = useRef(0);

  const track = useCallback(async <T,>(p: Promise<T>): Promise<T> => {
    inflight.current++;
    setState((s) => ({ ...s, status: 'saving' }));
    try {
      const v = await p;
      inflight.current--;
      if (inflight.current === 0) setState({ status: 'saved', at: Date.now() });
      return v;
    } catch (e) {
      inflight.current--;
      setState({ status: 'error', at: null, error: (e as Error).message });
      throw e;
    }
  }, []);

  const markDirty = useCallback(() => setState((s) => (s.status === 'saving' ? s : { ...s, status: 'saving' })), []);
  return { ...state, track, markDirty };
}

/** The visible autosave indicator. Announces state changes politely. */
export function SaveIndicator({ status, at, error }: { status: SaveStatus; at: number | null; error?: string }) {
  const [, tick] = useState(0);
  useEffect(() => {
    if (status !== 'saved') return;
    const id = setInterval(() => tick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, [status]);
  return (
    <span role="status" aria-live="polite" className="inline-flex min-h-6 items-center gap-1.5 text-sm text-muted">
      {status === 'saving' && <><Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" /> Saving…</>}
      {status === 'saved' && <><Check className="size-3.5 text-success" aria-hidden="true" /> Saved{at ? <span className="hidden sm:inline"> {fmtDate(new Date(at).toISOString(), { timeStyle: 'short' })}</span> : null}</>}
      {status === 'error' && <><AlertCircle className="size-3.5 text-danger" aria-hidden="true" /> <span className="text-danger">Couldn't save{error ? `: ${error}` : ''}</span></>}
      {status === 'idle' && <span className="opacity-0">Saved</span>}
    </span>
  );
}
