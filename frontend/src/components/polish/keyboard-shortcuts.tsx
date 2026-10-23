import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { useAuth } from '@/app/auth';
import { SHORTCUTS_EVENT } from './shortcuts-event';


interface Group { title: string; roles?: ('PARTICIPANT' | 'ORGANIZER' | 'ADMIN')[]; items: { keys: string[]; label: string }[] }

const GROUPS: Group[] = [
  {
    title: 'Everywhere',
    items: [
      { keys: ['Ctrl', 'K'], label: 'Open the command palette (⌘ K on Mac)' },
      { keys: ['?'], label: 'Show this list' },
      { keys: ['Tab'], label: 'Move to the next control' },
      { keys: ['Esc'], label: 'Close a dialog or menu' },
    ],
  },
  {
    title: 'Taking a quiz',
    roles: ['PARTICIPANT', 'ORGANIZER'],
    items: [
      { keys: ['←', '→'], label: 'Previous / next question' },
      { keys: ['1', '–', '9'], label: 'Choose the numbered option' },
      { keys: ['F'], label: 'Flag the question for review' },
      { keys: ['Ctrl', 'Enter'], label: 'Open the submit summary' },
    ],
  },
  {
    title: 'Grading',
    roles: ['ORGANIZER', 'ADMIN'],
    items: [
      { keys: ['J', 'K'], label: 'Next / previous answer' },
      { keys: ['1', '–', '9'], label: 'Pick a rubric level' },
      { keys: ['Enter'], label: 'Save the grade and go to the next answer' },
    ],
  },
];

const isTyping = (t: EventTarget | null) => {
  const el = t as HTMLElement | null;
  return !!el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName));
};

export function KeyboardShortcuts() {
  const [open, setOpen] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '?' && !e.ctrlKey && !e.metaKey && !e.altKey && !isTyping(e.target)) { e.preventDefault(); setOpen((o) => !o); }
    };
    const onOpen = () => setOpen(true);
    addEventListener('keydown', onKey);
    addEventListener(SHORTCUTS_EVENT, onOpen);
    return () => { removeEventListener('keydown', onKey); removeEventListener(SHORTCUTS_EVENT, onOpen); };
  }, []);

  if (!user) return null;
  const groups = GROUPS.filter((g) => !g.roles || g.roles.includes(user.role));
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogTitle>Keyboard shortcuts</DialogTitle>
        <DialogDescription>Shortcuts never fire while you are typing in a field.</DialogDescription>
        <div className="grid gap-5">
          {groups.map((g) => (
            <section key={g.title} aria-labelledby={`sc-${g.title}`}>
              <h3 id={`sc-${g.title}`} className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">{g.title}</h3>
              <dl className="grid gap-2">
                {g.items.map((i) => (
                  <div key={i.label} className="flex items-center justify-between gap-4 text-sm">
                    <dt>{i.label}</dt>
                    <dd className="flex shrink-0 items-center gap-1">
                      {i.keys.map((k, idx) => (k === '–'
                        ? <span key={idx} aria-label="to" className="text-muted">–</span>
                        : <kbd key={idx} className="num min-w-6 rounded-sm border border-border-strong bg-surface-2 px-1.5 py-0.5 text-center text-xs">{k}</kbd>))}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
