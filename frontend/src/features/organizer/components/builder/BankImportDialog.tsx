import { useState } from 'react';
import { Search } from 'lucide-react';
import { Badge, Button, Checkbox, Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle, EmptyState, Input, Skeleton } from '@/components/ui';
import { bankApi } from '@/lib/api';
import { keys } from '@/lib/query/keys';
import { usePagedQuery } from '@/lib/query/hooks';
import { useDebounced } from '@/lib/hooks';
import { TYPE_LABEL } from './question-draft';
import { useBuilder } from './BuilderProvider';

export function BankImportDialog({ open, onOpenChange, sectionId }: { open: boolean; onOpenChange: (o: boolean) => void; sectionId: string | null }) {
  const { actions } = useBuilder();
  const [search, setSearch] = useState('');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const q = useDebounced(search, 250);
  const query = { pageSize: 50, q: q || undefined };
  const list = usePagedQuery(keys.bank.list(query), () => bankApi.list(query), { enabled: open });
  const toggle = (id: string) => setPicked((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const run = async () => {
    setBusy(true);
    try { await actions.importBank([...picked], sectionId); setPicked(new Set()); onOpenChange(false); } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogTitle>Import from question bank</DialogTitle>
        <DialogDescription>Pick questions to copy into this quiz. They stay in your bank and can be edited here independently.</DialogDescription>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
          <Input type="search" aria-label="Search the question bank" placeholder="Search questions…" className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="max-h-[50dvh] overflow-y-auto rounded-md border border-border">
          {list.isPending ? (
            <div className="grid gap-2 p-3">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-12" />)}</div>
          ) : list.data!.data.length === 0 ? (
            <EmptyState className="border-0" title={q ? 'No matching questions' : 'Your bank is empty'} description={q ? 'Try a different search.' : 'Add reusable questions in Question bank, then import them into any quiz.'} />
          ) : (
            <ul className="divide-y divide-border">
              {list.data!.data.map((b) => (
                <li key={b.id}>
                  <label className="flex cursor-pointer items-start gap-3 p-3 hover:bg-surface-2">
                    <Checkbox checked={picked.has(b.id)} onCheckedChange={() => toggle(b.id)} className="mt-0.5" aria-label={`Select: ${b.text}`} />
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-2 text-sm font-medium">{b.text}</span>
                      <span className="mt-1 flex flex-wrap gap-1.5"><Badge>{TYPE_LABEL[b.type]}</Badge><Badge tone="accent"><span className="num">{b.points}</span> pt</Badge>{b.tags.map((t) => <Badge key={t} tone="teal">{t}</Badge>)}</span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={picked.size === 0} loading={busy} onClick={() => void run()}>Import {picked.size || ''} question{picked.size === 1 ? '' : 's'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
