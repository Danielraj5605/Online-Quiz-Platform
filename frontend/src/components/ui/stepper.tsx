import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Stepper({ steps, current, className }: { steps: string[]; current: number; className?: string }) {
  return (
    <ol className={cn('flex items-center gap-2', className)} aria-label="Progress">
      {steps.map((s, i) => {
        const done = i < current, active = i === current;
        return (
          <li key={s} className="flex flex-1 items-center gap-2 last:flex-none" aria-current={active ? 'step' : undefined}>
            <span className={cn('grid size-7 shrink-0 place-items-center rounded-full border text-xs font-semibold', done ? 'border-accent bg-accent text-on-accent' : active ? 'border-accent text-accent' : 'border-border-strong text-muted')}>
              {done ? <Check className="size-4" aria-hidden="true" /> : <span className="num">{i + 1}</span>}
              <span className="sr-only">{done ? 'Completed: ' : active ? 'Current: ' : ''}</span>
            </span>
            <span className={cn('hidden text-sm sm:inline', active ? 'font-medium text-text' : 'text-muted')}>{s}</span>
            {i < steps.length - 1 && <span className={cn('h-px flex-1', done ? 'bg-accent' : 'bg-border')} aria-hidden="true" />}
          </li>
        );
      })}
    </ol>
  );
}
