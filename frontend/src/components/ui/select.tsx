import { forwardRef, type ComponentPropsWithoutRef } from 'react';
import * as S from '@radix-ui/react-select';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { fieldClass } from './input';

export const Select = S.Root;
export const SelectValue = S.Value;

export const SelectTrigger = forwardRef<HTMLButtonElement, ComponentPropsWithoutRef<typeof S.Trigger>>(({ className, children, ...p }, ref) => (
  <S.Trigger ref={ref} className={cn(fieldClass, 'flex h-11 items-center justify-between gap-2 text-left text-base sm:h-10 sm:text-sm [&>span]:truncate data-[placeholder]:text-muted', className)} {...p}>
    {children}
    <S.Icon asChild><ChevronDown className="size-4 shrink-0 text-muted" aria-hidden="true" /></S.Icon>
  </S.Trigger>
));
SelectTrigger.displayName = 'SelectTrigger';

export const SelectContent = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<typeof S.Content>>(({ className, children, position = 'popper', ...p }, ref) => (
  <S.Portal>
    <S.Content
      ref={ref}
      position={position}
      sideOffset={4}
      className={cn('z-50 max-h-72 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-md border border-border bg-surface text-text shadow-[var(--shadow-2)]', className)}
      {...p}
    >
      <S.Viewport className="p-1">{children}</S.Viewport>
    </S.Content>
  </S.Portal>
));
SelectContent.displayName = 'SelectContent';

export const SelectItem = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<typeof S.Item>>(({ className, children, ...p }, ref) => (
  <S.Item ref={ref} className={cn('relative flex min-h-9 cursor-pointer select-none items-center rounded-sm py-1.5 pl-8 pr-3 text-sm outline-none data-[highlighted]:bg-surface-2 data-[disabled]:opacity-50', className)} {...p}>
    <span className="absolute left-2 grid size-4 place-items-center">
      <S.ItemIndicator><Check className="size-4 text-accent" aria-hidden="true" /></S.ItemIndicator>
    </span>
    <S.ItemText>{children}</S.ItemText>
  </S.Item>
));
SelectItem.displayName = 'SelectItem';
