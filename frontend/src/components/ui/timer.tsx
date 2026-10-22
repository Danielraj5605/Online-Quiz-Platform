import { useEffect, useRef, useState } from 'react';
import { Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

const WARN_AT = [600, 300, 60, 30]; // seconds remaining that get announced

const fmt = (s: number) => {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  return `${h ? `${h}:${String(m).padStart(2, '0')}` : m}:${String(r).padStart(2, '0')}`;
};
const spoken = (s: number) => (s >= 60 ? `${Math.round(s / 60)} minute${s >= 120 ? 's' : ''}` : `${s} seconds`);

/**
 * Server-authoritative countdown. Pass `expiresAt` and `serverNow` from the attempt payload so client clock drift is corrected.
 * The ticking element is aria-live="off"; a separate polite region announces only at 50%, 10 min, 5 min, 1 min and 30 s.
 */
export function Timer({ expiresAt, serverNow, startedAt, onExpire, className }: {
  expiresAt: string; serverNow: string; startedAt?: string; onExpire?: () => void; className?: string;
}) {
  const [offset] = useState(() => new Date(serverNow).getTime() - Date.now());
  const end = new Date(expiresAt).getTime();
  const total = startedAt ? Math.max(1, Math.round((end - new Date(startedAt).getTime()) / 1000)) : null;
  const calc = () => Math.max(0, Math.round((end - (Date.now() + offset)) / 1000));
  const [left, setLeft] = useState(calc);
  const [announce, setAnnounce] = useState('');
  const fired = useRef(new Set<number>());
  const expired = useRef(false);

  useEffect(() => {
    const id = setInterval(() => setLeft(calc()), 250);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [end, offset]);

  useEffect(() => {
    const marks = [...WARN_AT, ...(total ? [Math.round(total / 2)] : [])];
    for (const m of marks) {
      if (left <= m && !fired.current.has(m) && left > 0) {
        fired.current.add(m);
        setAnnounce(`${spoken(left)} remaining`);
      }
    }
    if (left === 0 && !expired.current) { expired.current = true; setAnnounce('Time is up'); onExpire?.(); }
  }, [left, total, onExpire]);

  const urgent = left <= 60;
  const warn = left <= 300;
  return (
    <>
      <div
        role="timer"
        aria-live="off"
        aria-label="Time remaining"
        className={cn('num inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-sm font-semibold', urgent ? 'border-danger bg-danger-soft text-danger' : warn ? 'border-warning bg-warning-soft text-warning' : 'border-border bg-surface-2 text-text', className)}
      >
        <Clock className="size-4" aria-hidden="true" />
        {fmt(left)}
      </div>
      <div className="sr-only" role="status" aria-live="polite">{announce}</div>
    </>
  );
}
