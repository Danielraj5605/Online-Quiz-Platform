import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Read-only star rating with a text equivalent. */
export function Rating({ value, count, className }: { value: number | null; count?: number; className?: string }) {
  if (value == null || !count) return <span className={cn('text-xs text-muted', className)}>No ratings yet</span>;
  return (
    <span className={cn('inline-flex items-center gap-1.5', className)}>
      <span className="inline-flex" aria-hidden="true">
        {[1, 2, 3, 4, 5].map((i) => <Star key={i} className={cn('size-3.5', value >= i - 0.25 ? 'fill-warning text-warning' : 'text-border-strong')} />)}
      </span>
      <span className="num text-xs">{value.toFixed(1)}</span>
      <span className="sr-only">{value.toFixed(1)} out of 5 stars from {count} ratings</span>
      <span className="text-xs text-muted" aria-hidden="true">({count})</span>
    </span>
  );
}

/** Accessible 1–5 picker built on native radios. */
export function RatingInput({ value, onChange, name = 'rating' }: { value: number; onChange: (n: number) => void; name?: string }) {
  return (
    <fieldset>
      <legend className="mb-1.5 text-sm font-medium">Your rating</legend>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((i) => (
          <label key={i} className="group relative cursor-pointer rounded-md p-1 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-focus">
            <input type="radio" name={name} value={i} checked={value === i} onChange={() => onChange(i)} className="sr-only" />
            <Star className={cn('size-8 transition-colors', value >= i ? 'fill-warning text-warning' : 'text-border-strong')} aria-hidden="true" />
            <span className="sr-only">{i} {i === 1 ? 'star' : 'stars'}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
