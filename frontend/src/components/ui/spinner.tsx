import { cn } from '@/lib/utils';

export function Spinner({ className, label = 'Loading' }: { className?: string; label?: string }) {
  return (
    <span role="status" className="inline-flex">
      <svg viewBox="0 0 24 24" className={cn('animate-spin-slow size-5 text-current', className)} fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
        <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      </svg>
      <span className="sr-only">{label}</span>
    </span>
  );
}

export function PageSpinner({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="grid min-h-[50dvh] place-items-center text-muted">
      <Spinner className="size-7" label={label} />
    </div>
  );
}
