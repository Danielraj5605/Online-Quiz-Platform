import { forwardRef, useState, type ComponentPropsWithoutRef, type ReactNode } from 'react';
import * as D from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './button';

export const Dialog = D.Root;
export const DialogTrigger = D.Trigger;
export const DialogClose = D.Close;

export const DialogContent = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<typeof D.Content> & { hideClose?: boolean }>(
  ({ className, children, hideClose, ...p }, ref) => (
    <D.Portal>
      <D.Overlay className="fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-[fade-up_var(--dur)_var(--ease)]" />
      <D.Content
        ref={ref}
        className={cn(
          'fixed left-1/2 top-1/2 z-50 grid max-h-[90dvh] w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 gap-4 overflow-y-auto rounded-lg border border-border bg-surface p-6 shadow-[var(--shadow-3)]',
          className,
        )}
        {...p}
      >
        {children}
        {!hideClose && (
          <D.Close className="absolute right-3 top-3 grid size-9 place-items-center rounded-md text-muted hover:bg-surface-2 hover:text-text" aria-label="Close">
            <X className="size-4" aria-hidden="true" />
          </D.Close>
        )}
      </D.Content>
    </D.Portal>
  ),
);
DialogContent.displayName = 'DialogContent';

export const DialogTitle = forwardRef<HTMLHeadingElement, ComponentPropsWithoutRef<typeof D.Title>>(({ className, ...p }, ref) => (
  <D.Title ref={ref} className={cn('pr-8 font-display text-xl font-semibold', className)} {...p} />
));
DialogTitle.displayName = 'DialogTitle';

export const DialogDescription = forwardRef<HTMLParagraphElement, ComponentPropsWithoutRef<typeof D.Description>>(({ className, ...p }, ref) => (
  <D.Description ref={ref} className={cn('text-sm text-muted', className)} {...p} />
));
DialogDescription.displayName = 'DialogDescription';

export const DialogFooter = ({ className, ...p }: ComponentPropsWithoutRef<'div'>) => (
  <div className={cn('mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', className)} {...p} />
);

interface ConfirmProps {
  trigger: ReactNode;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: () => void | Promise<unknown>;
}
/** Confirmation dialog with focus trapping and an awaited confirm action. */
export function ConfirmDialog({ trigger, title, description, confirmLabel = 'Confirm', destructive, onConfirm }: ConfirmProps) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogTitle>{title}</DialogTitle>
        {description && <DialogDescription>{description}</DialogDescription>}
        <DialogFooter>
          <DialogClose asChild><Button variant="secondary">Cancel</Button></DialogClose>
          <Button
            variant={destructive ? 'danger' : 'primary'}
            loading={busy}
            onClick={async () => {
              setBusy(true);
              try { await onConfirm(); setOpen(false); } finally { setBusy(false); }
            }}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
