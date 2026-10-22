import { forwardRef, type ComponentPropsWithoutRef } from 'react';
import * as C from '@radix-ui/react-checkbox';
import * as R from '@radix-ui/react-radio-group';
import * as SW from '@radix-ui/react-switch';
import { Check, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Wraps the 24px minimum target: the visible box is 20px but the hit area grows with padding. */
export const Checkbox = forwardRef<HTMLButtonElement, ComponentPropsWithoutRef<typeof C.Root>>(({ className, ...p }, ref) => (
  <C.Root
    ref={ref}
    className={cn('grid size-5 shrink-0 place-items-center rounded-sm border border-border-strong bg-surface transition-colors data-[state=checked]:border-accent data-[state=checked]:bg-accent data-[state=indeterminate]:border-accent data-[state=indeterminate]:bg-accent disabled:opacity-50', className)}
    {...p}
  >
    <C.Indicator className="text-on-accent">
      {p.checked === 'indeterminate' ? <Minus className="size-3.5" aria-hidden="true" /> : <Check className="size-3.5" aria-hidden="true" />}
    </C.Indicator>
  </C.Root>
));
Checkbox.displayName = 'Checkbox';

export const RadioGroup = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<typeof R.Root>>(({ className, ...p }, ref) => (
  <R.Root ref={ref} className={cn('grid gap-2', className)} {...p} />
));
RadioGroup.displayName = 'RadioGroup';

export const RadioGroupItem = forwardRef<HTMLButtonElement, ComponentPropsWithoutRef<typeof R.Item>>(({ className, ...p }, ref) => (
  <R.Item
    ref={ref}
    className={cn('grid size-5 shrink-0 place-items-center rounded-full border border-border-strong bg-surface transition-colors data-[state=checked]:border-accent disabled:opacity-50', className)}
    {...p}
  >
    <R.Indicator className="size-2.5 rounded-full bg-accent" />
  </R.Item>
));
RadioGroupItem.displayName = 'RadioGroupItem';

export const Switch = forwardRef<HTMLButtonElement, ComponentPropsWithoutRef<typeof SW.Root>>(({ className, ...p }, ref) => (
  <SW.Root
    ref={ref}
    className={cn('relative h-6 w-11 shrink-0 rounded-full border border-border-strong bg-surface-2 transition-colors data-[state=checked]:border-accent data-[state=checked]:bg-accent disabled:opacity-50', className)}
    {...p}
  >
    <SW.Thumb className="block size-4 translate-x-1 rounded-full bg-text transition-transform data-[state=checked]:translate-x-6 data-[state=checked]:bg-on-accent" />
  </SW.Root>
));
Switch.displayName = 'Switch';
