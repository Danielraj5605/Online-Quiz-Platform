import { useEffect, useState } from 'react';
import { Command } from 'cmdk';
import * as D from '@radix-ui/react-dialog';
import { LogOut, Moon, Search, Sun } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/app/auth';
import { navFor } from '@/app/nav';
import { useTheme } from '@/app/theme';

/** ⌘/Ctrl-K palette. Items are role-aware: navigation for the user's area + global actions. Extra commands can be passed in. */
export interface PaletteAction { id: string; label: string; run: () => void; group?: string; keywords?: string[] }

export function CommandPalette({ extra = [], open: controlled, onOpenChange }: { extra?: PaletteAction[]; open?: boolean; onOpenChange?: (o: boolean) => void }) {
  const [internal, setInternal] = useState(false);
  const open = controlled ?? internal;
  const setOpen = onOpenChange ?? setInternal;
  const { user, logout } = useAuth();
  const { resolved, setTheme } = useTheme();
  const navigate = useNavigate();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setOpen(!open); }
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [open, setOpen]);

  if (!user) return null;
  const go = (to: string) => () => { setOpen(false); navigate(to); };
  const item = 'flex min-h-10 cursor-pointer items-center gap-3 rounded-md px-3 text-sm aria-selected:bg-surface-2 [&_svg]:size-4 [&_svg]:text-muted';

  return (
    <Command.Dialog open={open} onOpenChange={setOpen} label="Command palette" overlayClassName="fixed inset-0 z-50 bg-black/50" contentClassName="fixed left-1/2 top-[15dvh] z-50 w-[calc(100vw-2rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-lg border border-border bg-surface shadow-[var(--shadow-3)]">
      <D.Title className="sr-only">Command palette</D.Title>
      <div className="flex items-center gap-2 border-b border-border px-3">
        <Search className="size-4 text-muted" aria-hidden="true" />
        <Command.Input placeholder="Jump to… or run a command" className="h-12 w-full bg-transparent text-base outline-none placeholder:text-muted" />
      </div>
      <Command.List className="max-h-80 overflow-y-auto p-2">
        <Command.Empty className="px-3 py-6 text-center text-sm text-muted">No results.</Command.Empty>
        <Command.Group heading="Go to" className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:text-muted">
          {navFor(user.role).map((n) => (
            <Command.Item key={n.to} value={`go ${n.label}`} onSelect={go(n.to)} className={item}><n.icon aria-hidden="true" />{n.label}</Command.Item>
          ))}
        </Command.Group>
        {extra.length > 0 && (
          <Command.Group heading="Actions" className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:text-muted">
            {extra.map((a) => (
              <Command.Item key={a.id} value={`${a.label} ${(a.keywords ?? []).join(' ')}`} onSelect={() => { setOpen(false); a.run(); }} className={item}>{a.label}</Command.Item>
            ))}
          </Command.Group>
        )}
        <Command.Group heading="Preferences" className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:text-muted">
          <Command.Item value="toggle theme dark light" onSelect={() => { setTheme(resolved === 'dark' ? 'light' : 'dark'); setOpen(false); }} className={item}>
            {resolved === 'dark' ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}Switch to {resolved === 'dark' ? 'light' : 'dark'} theme
          </Command.Item>
          <Command.Item value="sign out log out" onSelect={() => { setOpen(false); void logout().then(() => navigate('/login')); }} className={item}><LogOut aria-hidden="true" />Sign out</Command.Item>
        </Command.Group>
      </Command.List>
    </Command.Dialog>
  );
}
