import { Hammer } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { useDocumentTitle } from '@/lib/hooks';
import { EmptyState, PageHeader } from '@/components/ui/surfaces';

/** Temporary page body. Replace the page file (not the route) when you build the real screen. */
export function Placeholder({ title, note }: { title: string; note?: string }) {
  const params = useParams();
  useDocumentTitle(title);
  const ids = Object.entries(params).filter(([k]) => k !== '*').map(([k, v]) => `${k}=${v}`).join(' · ');
  return (
    <>
      <PageHeader title={title} />
      <EmptyState icon={<Hammer />} title="This screen is being built" description={note ?? (ids ? `Route params: ${ids}` : 'Check back soon.')} />
    </>
  );
}
