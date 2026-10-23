import { Keyboard } from 'lucide-react';
import { Button, Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '@/components/ui';
import { SHORTCUT_HELP } from './shortcuts';

export function Kbd({ children }: { children: string }) {
  return <kbd className="num inline-flex min-w-6 items-center justify-center rounded-sm border border-border-strong bg-surface-2 px-1.5 py-0.5 text-xs">{children}</kbd>;
}

export function ShortcutHelp({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" aria-label="Keyboard shortcuts"><Keyboard aria-hidden="true" /> <span className="hidden sm:inline">Shortcuts</span></Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>Keyboard shortcuts</DialogTitle>
        <DialogDescription>Shortcuts are paused while you type in a field. Use Ctrl+Enter to save from inside feedback.</DialogDescription>
        <dl className="grid gap-2">
          {SHORTCUT_HELP.map((s) => (
            <div key={s.label} className="flex items-start justify-between gap-4 text-sm">
              <dt className="flex shrink-0 items-center gap-1">{s.keys.map((k, i) => (k === '–' ? <span key={i} aria-hidden="true">–</span> : <Kbd key={i}>{k}</Kbd>))}</dt>
              <dd className="text-right text-muted">{s.label}</dd>
            </div>
          ))}
        </dl>
      </DialogContent>
    </Dialog>
  );
}
