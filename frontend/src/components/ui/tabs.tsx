import { forwardRef, type ComponentPropsWithoutRef } from 'react';
import * as T from '@radix-ui/react-tabs';
import { cn } from '@/lib/utils';

export const Tabs = T.Root;

export const TabsList = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<typeof T.List>>(({ className, ...p }, ref) => (
  <T.List ref={ref} className={cn('flex gap-1 overflow-x-auto border-b border-border [scrollbar-width:none]', className)} {...p} />
));
TabsList.displayName = 'TabsList';

export const TabsTrigger = forwardRef<HTMLButtonElement, ComponentPropsWithoutRef<typeof T.Trigger>>(({ className, ...p }, ref) => (
  <T.Trigger
    ref={ref}
    className={cn('-mb-px min-h-11 whitespace-nowrap border-b-2 border-transparent px-3 text-sm font-medium text-muted transition-colors hover:text-text data-[state=active]:border-accent data-[state=active]:text-text', className)}
    {...p}
  />
));
TabsTrigger.displayName = 'TabsTrigger';

export const TabsContent = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<typeof T.Content>>(({ className, ...p }, ref) => (
  <T.Content ref={ref} className={cn('pt-5 focus-visible:outline-offset-4', className)} {...p} />
));
TabsContent.displayName = 'TabsContent';
