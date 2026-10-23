import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Eye, Search, Users } from 'lucide-react';
import { Avatar, Badge, Button, DataTable, Input, type Column } from '@/components/ui';
import { gradingApi, reportsApi } from '@/lib/api';
import type { ParticipantReportRow } from '@/lib/api/types';
import { keys } from '@/lib/query/keys';
import { usePagedQuery } from '@/lib/query/hooks';
import { useDebounced } from '@/lib/hooks';
import { fmtDuration, fmtPct } from '@/lib/utils';
import { ResultDialog } from './ResultDialog';

export function ParticipantsTab({ quizId }: { quizId: string }) {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState('-bestPct');
  const [search, setSearch] = useState('');
  const q = useDebounced(search.trim());
  const [open, setOpen] = useState<{ attemptId: string; who: string } | null>(null);
  const [opening, setOpening] = useState<string | null>(null);

  const query = { page, pageSize: 15, sort, q: q || undefined };
  const list = usePagedQuery<ParticipantReportRow>(keys.reports.participants(quizId, query), () => reportsApi.participants(quizId, query));

  // The report rows carry no attempt id; the live monitor lists each participant's latest attempt.
  const view = async (r: ParticipantReportRow) => {
    setOpening(r.userId);
    try {
      const m = await qc.fetchQuery({ queryKey: keys.grading.monitor(quizId), queryFn: () => gradingApi.monitor(quizId), staleTime: 10_000 });
      const hit = m.participants.find((p) => p.userId === r.userId) as ((typeof m.participants)[number] & { attemptId?: string }) | undefined;
      if (hit?.attemptId) setOpen({ attemptId: hit.attemptId, who: r.name ?? r.username });
      else toast.error('Could not find that participant’s latest attempt');
    } finally {
      setOpening(null);
    }
  };

  const columns: Column<ParticipantReportRow>[] = [
    {
      key: 'user', header: 'Participant', sortKey: 'username', primary: true,
      cell: (r) => (
        <span className="flex min-w-0 items-center gap-2">
          <Avatar name={r.name ?? r.username} size={28} />
          <span className="min-w-0"><span className="block truncate font-medium">{r.name ?? r.username}</span><span className="block truncate text-xs text-muted">@{r.username}</span></span>
        </span>
      ),
    },
    { key: 'attempts', header: 'Attempts', sortKey: 'attempts', cell: (r) => <span className="num">{r.attempts}</span> },
    { key: 'best', header: 'Best', sortKey: 'bestPct', cell: (r) => <span className="num font-medium">{fmtPct(r.bestPct)}</span> },
    { key: 'last', header: 'Latest', sortKey: 'lastPct', cell: (r) => <span className="num">{fmtPct(r.lastPct)}</span> },
    { key: 'passed', header: 'Result', cell: (r) => <Badge tone={r.passed ? 'success' : 'danger'}>{r.passed ? 'Passed' : 'Not passed'}</Badge> },
    { key: 'time', header: 'Avg. time', sortKey: 'avgDurationSec', hideOnMobile: true, cell: (r) => <span className="num">{fmtDuration(r.avgDurationSec)}</span> },
    {
      key: 'view', header: 'Details', className: 'text-right',
      cell: (r) => (
        <Button variant="ghost" size="sm" loading={opening === r.userId} onClick={(e) => { e.stopPropagation(); void view(r); }} aria-label={`View latest result for ${r.name ?? r.username}`}>
          <Eye aria-hidden="true" /> View
        </Button>
      ),
    },
  ];

  return (
    <div className="grid gap-4">
      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
        <Input type="search" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search participants" aria-label="Search participants" className="pl-9" />
      </div>
      <DataTable
        caption="Participants who attempted this quiz"
        columns={columns} rows={list.data?.data} getRowId={(r) => r.userId} loading={list.isPending}
        sort={sort} onSortChange={(s) => { setSort(s); setPage(1); }}
        meta={list.data?.meta} onPageChange={setPage}
        empty={{ title: q ? 'No matching participants' : 'No attempts yet', description: q ? 'Try a different name.' : 'Participants appear here after they submit.', icon: <Users /> }}
      />
      <ResultDialog attemptId={open?.attemptId ?? null} who={open?.who ?? ''} onClose={() => setOpen(null)} />
    </div>
  );
}
