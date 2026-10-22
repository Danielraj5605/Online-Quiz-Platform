import { forwardRef, type ComponentPropsWithoutRef } from 'react';
import * as M from '@radix-ui/react-dropdown-menu';
import * as P from '@radix-ui/react-popover';
import * as TT from '@radix-ui/react-tooltip';
import { cn } from '@/lib/utils';

/* ───── DropdownMenu ───── */
export const DropdownMenu = M.Root;
export const DropdownMenuTrigger = M.Trigger;
export const DropdownMenuLabel = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<typeof M.Label>>(({ className, ...p }, ref) => (
  <M.Label ref={ref} className={cn('px-2 py-1.5 text-xs font-medium text-muted', className)} {...p} />
));
DropdownMenuLabel.displayName = 'DropdownMenuLabel';
export const DropdownMenuSeparator = () => <M.Separator className="-mx-1 my-1 h-px bg-border" />;

export const DropdownMenuContent = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<typeof M.Content>>(({ className, sideOffset = 6, ...p }, ref) => (
  <M.Portal>
    <M.Content ref={ref} sideOffset={sideOffset} align="end" className={cn('z-50 min-w-48 overflow-hidden rounded-md border border-border bg-surface p-1 text-text shadow-[var(--shadow-2)]', className)} {...p} />
  </M.Portal>
));
DropdownMenuContent.displayName = 'DropdownMenuContent';

export const DropdownMenuItem = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<typeof M.Item> & { destructive?: boolean }>(({ className, destructive, ...p }, ref) => (
  <M.Item
    ref={ref}
    className={cn('flex min-h-9 cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none data-[highlighted]:bg-surface-2 data-[disabled]:opacity-50 [&_svg]:size-4', destructive && 'text-danger', className)}
    {...p}
  />
));
DropdownMenuItem.displayName = 'DropdownMenuItem';

/* ───── Popover ───── */
export const Popover = P.Root;
export const PopoverTrigger = P.Trigger;
export const PopoverContent = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<typeof P.Content>>(({ className, sideOffset = 6, ...p }, ref) => (
  <P.Portal>
    <P.Content ref={ref} sideOffset={sideOffset} className={cn('z-50 w-72 rounded-md border border-border bg-surface p-4 text-text shadow-[var(--shadow-2)]', className)} {...p} />
  </P.Portal>
));
PopoverContent.displayName = 'PopoverContent';

/* ───── Tooltip ───── */
export const TooltipProvider = TT.Provider;
export const Tooltip = TT.Root;
export const TooltipTrigger = TT.Trigger;
export const TooltipContent = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<typeof TT.Content>>(({ className, sideOffset = 6, ...p }, ref) => (
  <TT.Portal>
    <TT.Content ref={ref} sideOffset={sideOffset} className={cn('z-50 max-w-xs rounded-md bg-text px-2.5 py-1.5 text-xs text-bg shadow-[var(--shadow-2)]', className)} {...p} />
  </TT.Portal>
));
TooltipContent.displayName = 'TooltipContent';
