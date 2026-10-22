import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function Card({ className, ...p }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rounded-lg border border-border bg-surface shadow-[var(--shadow-1)]', className)} {...p} />;
}
export const CardHeader = ({ className, ...p }: HTMLAttributes<HTMLDivElement>) => <div className={cn('flex flex-col gap-1 p-5 pb-0', className)} {...p} />;
export const CardTitle = ({ className, ...p }: HTMLAttributes<HTMLHeadingElement>) => <h3 className={cn('font-display text-lg font-semibold', className)} {...p} />;
export const CardDescription = ({ className, ...p }: HTMLAttributes<HTMLParagraphElement>) => <p className={cn('text-sm text-muted', className)} {...p} />;
export const CardContent = ({ className, ...p }: HTMLAttributes<HTMLDivElement>) => <div className={cn('p-5', className)} {...p} />;
export const CardFooter = ({ className, ...p }: HTMLAttributes<HTMLDivElement>) => <div className={cn('flex items-center gap-2 border-t border-border p-4', className)} {...p} />;

export function Skeleton({ className, ...p }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={cn('rounded-md bg-[linear-gradient(90deg,var(--surface-2)_25%,var(--border)_50%,var(--surface-2)_75%)] bg-[length:200%_100%] [animation:shimmer_1.6s_linear_infinite]', className)}
      {...p}
    />
  );
}

/** Groups skeletons and announces busy state once. */
export function SkeletonGroup({ children, label = 'Loading content' }: { children: ReactNode; label?: string }) {
  return <div role="status" aria-busy="true" aria-live="polite"><span className="sr-only">{label}</span>{children}</div>;
}

export function EmptyState({ icon, title, description, action, className }: { icon?: ReactNode; title: string; description?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn('grid place-items-center gap-3 rounded-lg border border-dashed border-border-strong px-6 py-12 text-center', className)}>
      {icon && <div className="grid size-12 place-items-center rounded-full bg-surface-2 text-muted [&_svg]:size-6" aria-hidden="true">{icon}</div>}
      <h3 className="font-display text-lg font-semibold">{title}</h3>
      {description && <p className="max-w-sm text-sm text-muted">{description}</p>}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}

export function PageHeader({ title, description, actions, eyebrow }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && <p className="mb-1 text-xs font-medium uppercase tracking-[0.14em] text-accent">{eyebrow}</p>}
        <h1 className="text-3xl font-semibold sm:text-4xl">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function StatCard({ label, value, hint, icon, className }: { label: string; value: ReactNode; hint?: ReactNode; icon?: ReactNode; className?: string }) {
  return (
    <Card className={cn('p-4 sm:p-5', className)}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm text-muted">{label}</p>
        {icon && <span className="text-muted [&_svg]:size-4" aria-hidden="true">{icon}</span>}
      </div>
      <p className="num mt-2 text-3xl font-semibold">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </Card>
  );
}

export function Avatar({ name, src, size = 36, className }: { name?: string | null; src?: string | null; size?: number; className?: string }) {
  const initials = (name ?? '?').split(/\s+/).filter(Boolean).slice(0, 2).map((s) => s[0]!.toUpperCase()).join('') || '?';
  return (
    <span
      className={cn('inline-grid shrink-0 place-items-center overflow-hidden rounded-full bg-accent-soft font-medium text-accent', className)}
      style={{ width: size, height: size, fontSize: size * 0.38 }}
      aria-hidden="true"
    >
      {src ? <img src={src} alt="" className="size-full object-cover" referrerPolicy="no-referrer" /> : initials}
    </span>
  );
}

export function Progress({ value, max = 100, label, className, tone = 'accent' }: { value: number; max?: number; label: string; className?: string; tone?: 'accent' | 'success' | 'teal' }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={Math.round(value)} className={cn('h-1.5 w-full overflow-hidden rounded-full bg-surface-2', className)}>
      <div className={cn('h-full rounded-full transition-[width] duration-[var(--dur-slow)]', tone === 'accent' ? 'bg-accent' : tone === 'success' ? 'bg-success' : 'bg-teal')} style={{ width: `${pct}%` }} />
    </div>
  );
}

export const VisuallyHidden = ({ children }: { children: ReactNode }) => <span className="sr-only">{children}</span>;

export function SkipLink({ href = '#main', children = 'Skip to content' }: { href?: string; children?: ReactNode }) {
  return (
    <a href={href} className="sr-only z-[100] rounded-md bg-text px-4 py-2 text-bg focus:not-sr-only focus:fixed focus:left-3 focus:top-3">
      {children}
    </a>
  );
}
