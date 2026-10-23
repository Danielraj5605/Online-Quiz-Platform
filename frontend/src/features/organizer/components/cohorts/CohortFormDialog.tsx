import { useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';
import { Pencil } from 'lucide-react';
import { cohortSchema } from '@quiz/shared';
import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle, DialogTrigger, FormField, Input, Textarea } from '@/components/ui';
import { cohortsApi } from '@/lib/api';
import type { CohortDto } from '@/lib/api/types';
import { ApiError } from '@/lib/api';
import { keys } from '@/lib/query/keys';
import { useApiMutation } from '@/lib/query/hooks';

type In = z.input<typeof cohortSchema>;
type Out = z.output<typeof cohortSchema>;

/** Create (no `cohort`) or edit a cohort. */
export function CohortFormDialog({ cohort, trigger, onSaved }: { cohort?: CohortDto; trigger?: ReactNode; onSaved?: (c: CohortDto) => void }) {
  const [open, setOpen] = useState(false);
  const { register, handleSubmit, reset, setError, formState: { errors } } = useForm<In, unknown, Out>({
    resolver: zodResolver(cohortSchema), defaultValues: { name: cohort?.name ?? '', description: cohort?.description ?? '' },
  });
  const save = useApiMutation(
    (v: Out) => (cohort ? cohortsApi.update(cohort.id, v) : cohortsApi.create(v)),
    {
      invalidate: [keys.cohorts.all], success: cohort ? 'Cohort updated' : 'Cohort created',
      onSuccess: (c) => { setOpen(false); if (!cohort) reset({ name: '', description: '' }); onSaved?.(c); },
    },
  );
  const submit = handleSubmit(async (v) => {
    try { await save.mutateAsync(v); }
    catch (e) { if (e instanceof ApiError) for (const [k, m] of Object.entries(e.fieldErrors)) setError(k as keyof In, { message: m }); }
  });

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o) reset({ name: cohort?.name ?? '', description: cohort?.description ?? '' }); }}>
      <DialogTrigger asChild>{trigger ?? <Button variant="outline" size="sm"><Pencil aria-hidden="true" /> Edit</Button>}</DialogTrigger>
      <DialogContent>
        <DialogTitle>{cohort ? 'Edit cohort' : 'New cohort'}</DialogTitle>
        <DialogDescription>A cohort is a named group — a class, team or batch — you can assign quizzes to.</DialogDescription>
        <form onSubmit={(e) => void submit(e)} className="grid gap-4" noValidate>
          <FormField label="Name" required error={errors.name?.message}><Input maxLength={80} autoFocus {...register('name')} /></FormField>
          <FormField label="Description" error={errors.description?.message}><Textarea rows={3} maxLength={500} {...register('description')} /></FormField>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" loading={save.isPending}>{cohort ? 'Save' : 'Create cohort'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
