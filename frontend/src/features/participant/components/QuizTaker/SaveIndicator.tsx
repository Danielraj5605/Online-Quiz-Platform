import { AlertTriangle, Check, CloudOff } from 'lucide-react';
import { Spinner } from '@/components/ui';
import type { SaveStatus } from './saveQueue';

/** Polite live region so screen-reader users hear "Saved" / "Offline" without being interrupted. */
export function SaveIndicator({ status, pending, onRetry }: { status: SaveStatus; pending: number; onRetry: () => void }) {
  let body: React.ReactNode;
  switch (status) {
    case 'saving': body = <><Spinner className="size-3.5" /> Saving…</>; break;
    case 'saved': body = <><Check className="size-3.5 text-success" aria-hidden="true" /> Saved</>; break;
    case 'offline': body = <><CloudOff className="size-3.5 text-warning" aria-hidden="true" /> Offline · {pending} unsynced</>; break;
    case 'error': body = <><AlertTriangle className="size-3.5 text-danger" aria-hidden="true" /> Not saved <button type="button" onClick={onRetry} className="font-medium underline underline-offset-2">Retry</button></>; break;
    case 'expired': body = <><AlertTriangle className="size-3.5 text-danger" aria-hidden="true" /> Time is up</>; break;
    default: body = <span className="opacity-0">Saved</span>;
  }
  return <p role="status" aria-live="polite" className="inline-flex min-h-6 items-center gap-1.5 whitespace-nowrap text-xs text-muted">{body}</p>;
}
