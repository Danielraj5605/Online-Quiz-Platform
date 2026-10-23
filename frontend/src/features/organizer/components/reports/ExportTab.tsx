import { useState } from 'react';
import { toast } from 'sonner';
import { FileSpreadsheet, FileText } from 'lucide-react';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui';
import { reportsApi } from '@/lib/api';

export function ExportTab({ quizId }: { quizId: string }) {
  const [busy, setBusy] = useState<'csv' | 'pdf' | null>(null);
  const run = async (kind: 'csv' | 'pdf') => {
    setBusy(kind);
    try {
      await (kind === 'csv' ? reportsApi.exportCsv(quizId) : reportsApi.exportPdf(quizId));
      toast.success(`${kind.toUpperCase()} downloaded`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Export failed');
    } finally {
      setBusy(null);
    }
  };
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><FileSpreadsheet className="size-5 text-teal" aria-hidden="true" /> CSV spreadsheet</CardTitle>
          <CardDescription>One row per attempt: username, name, email, score, percentage, band, pass/fail, duration and tab switches. Opens in Excel or Sheets.</CardDescription></CardHeader>
        <CardContent><Button variant="secondary" loading={busy === 'csv'} onClick={() => void run('csv')}>Download CSV</Button></CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><FileText className="size-5 text-accent" aria-hidden="true" /> PDF summary</CardTitle>
          <CardDescription>A printable report with headline numbers, score distribution and the item analysis for each question.</CardDescription></CardHeader>
        <CardContent><Button variant="secondary" loading={busy === 'pdf'} onClick={() => void run('pdf')}>Download PDF</Button></CardContent>
      </Card>
    </div>
  );
}
