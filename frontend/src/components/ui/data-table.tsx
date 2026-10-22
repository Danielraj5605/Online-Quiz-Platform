import type { KeyboardEvent, ReactNode } from 'react';
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';
import type { PageMeta } from '@quiz/shared';
import { cn } from '@/lib/utils';
import { Skeleton, EmptyState } from './surfaces';
import { Pagination } from './pagination';

export interface Column<T> {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  /** server sort field; omit if not sortable */
  sortKey?: string;
  className?: string;
  /** hide this column in the mobile card layout */
  hideOnMobile?: boolean;
  /** render as the card title on mobile */
  primary?: boolean;
}

interface Props<T> {
  columns: Column<T>[];
  rows: T[] | undefined;
  getRowId: (row: T) => string;
  loading?: boolean;
  /** "field" or "-field" */
  sort?: string;
  onSortChange?: (sort: string) => void;
  meta?: PageMeta;
  onPageChange?: (page: number) => void;
  onRowClick?: (row: T) => void;
  empty?: { title: string; description?: ReactNode; action?: ReactNode; icon?: ReactNode };
  caption: string;
  className?: string;
}

export function DataTable<T>({ columns, rows, getRowId, loading, sort, onSortChange, meta, onPageChange, onRowClick, empty, caption, className }: Props<T>) {
  const sortField = sort?.replace(/^-/, '');
  const desc = sort?.startsWith('-');
  const toggle = (k: string) => onSortChange?.(sortField === k && !desc ? `-${k}` : k);
  const isEmpty = !loading && rows && rows.length === 0;
  const onKey = (e: KeyboardEvent, row: T) => { if (onRowClick && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onRowClick(row); } };
  const primary = columns.find((c) => c.primary) ?? columns[0]!;

  if (isEmpty) return <EmptyState title={empty?.title ?? 'Nothing here yet'} description={empty?.description} action={empty?.action} icon={empty?.icon} />;

  return (
    <div className={className}>
      {/* desktop table */}
      <div className="hidden overflow-x-auto rounded-lg border border-border bg-surface md:block">
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead className="bg-surface-2 text-left text-xs uppercase tracking-wide text-muted">
            <tr>
              {columns.map((c) => (
                <th key={c.key} scope="col" className={cn('px-4 py-3 font-medium', c.className)} aria-sort={c.sortKey && sortField === c.sortKey ? (desc ? 'descending' : 'ascending') : undefined}>
                  {c.sortKey ? (
                    <button type="button" onClick={() => toggle(c.sortKey!)} className="-mx-1 inline-flex items-center gap-1 rounded-sm px-1 uppercase tracking-wide hover:text-text">
                      {c.header}
                      {sortField === c.sortKey ? (desc ? <ArrowDown className="size-3.5" aria-hidden="true" /> : <ArrowUp className="size-3.5" aria-hidden="true" />) : <ChevronsUpDown className="size-3.5 opacity-50" aria-hidden="true" />}
                    </button>
                  ) : c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading || !rows
              ? Array.from({ length: 5 }, (_, i) => (
                  <tr key={i} className="border-t border-border" aria-hidden="true">
                    {columns.map((c) => <td key={c.key} className="px-4 py-3"><Skeleton className="h-5 w-full max-w-40" /></td>)}
                  </tr>
                ))
              : rows.map((row) => (
                  <tr
                    key={getRowId(row)}
                    className={cn('border-t border-border', onRowClick && 'cursor-pointer hover:bg-surface-2 focus-visible:bg-surface-2')}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    onKeyDown={onRowClick ? (e) => onKey(e, row) : undefined}
                    tabIndex={onRowClick ? 0 : undefined}
                  >
                    {columns.map((c) => <td key={c.key} className={cn('px-4 py-3 align-middle', c.className)}>{c.cell(row)}</td>)}
                  </tr>
                ))}
          </tbody>
        </table>
      </div>

      {/* mobile cards */}
      <ul className="grid gap-3 md:hidden" aria-label={caption}>
        {loading || !rows
          ? Array.from({ length: 4 }, (_, i) => <li key={i}><Skeleton className="h-24 w-full" /></li>)
          : rows.map((row) => (
              <li
                key={getRowId(row)}
                className={cn('rounded-lg border border-border bg-surface p-4', onRowClick && 'cursor-pointer active:bg-surface-2')}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                onKeyDown={onRowClick ? (e) => onKey(e, row) : undefined}
                tabIndex={onRowClick ? 0 : undefined}
              >
                <div className="mb-2 font-medium">{primary.cell(row)}</div>
                <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                  {columns.filter((c) => c !== primary && !c.hideOnMobile).map((c) => (
                    <div key={c.key} className="min-w-0">
                      <dt className="text-xs text-muted">{c.header}</dt>
                      <dd className="truncate">{c.cell(row)}</dd>
                    </div>
                  ))}
                </dl>
              </li>
            ))}
      </ul>

      {onPageChange && <Pagination meta={meta} onPageChange={onPageChange} />}
    </div>
  );
}
