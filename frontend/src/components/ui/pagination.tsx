import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { PageMeta } from '@quiz/shared';
import { Button } from './button';

export function Pagination({ meta, onPageChange }: { meta?: PageMeta; onPageChange: (page: number) => void }) {
  if (!meta || meta.totalPages <= 1) return null;
  const { page, totalPages, total, pageSize } = meta;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <nav aria-label="Pagination" className="flex items-center justify-between gap-3 pt-4">
      <p className="text-sm text-muted" aria-live="polite">
        <span className="num">{from}–{to}</span> of <span className="num">{total}</span>
      </p>
      <div className="flex items-center gap-1">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)} aria-label="Previous page">
          <ChevronLeft aria-hidden="true" /> <span className="hidden sm:inline">Prev</span>
        </Button>
        <span className="num px-2 text-sm">{page} / {totalPages}</span>
        <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)} aria-label="Next page">
          <span className="hidden sm:inline">Next</span> <ChevronRight aria-hidden="true" />
        </Button>
      </div>
    </nav>
  );
}
