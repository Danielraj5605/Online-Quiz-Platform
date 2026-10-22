import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));

export const fmtDate = (iso: string | null | undefined, opts?: Intl.DateTimeFormatOptions) =>
  iso ? new Intl.DateTimeFormat(undefined, opts ?? { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso)) : '—';

export const fmtPct = (n: number | null | undefined, digits = 0) => (n == null ? '—' : `${n.toFixed(digits)}%`);

export function fmtDuration(sec: number | null | undefined) {
  if (sec == null) return '—';
  const s = Math.max(0, Math.round(sec));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  if (h) return `${h}h ${m}m`;
  if (m) return `${m}m ${r.toString().padStart(2, '0')}s`;
  return `${r}s`;
}

export const initials = (name?: string | null) =>
  (name ?? '?').split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join('') || '?';
