import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { KeyRound } from 'lucide-react';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { catalogApi } from '@/lib/api/catalog';
import { ApiError } from '@/lib/api/client';
import { keys } from '@/lib/query/keys';
import { useApiMutation } from '@/lib/query/hooks';
import { useDocumentTitle } from '@/lib/hooks';
import { Button, Card, CardContent, FormField, Input, PageHeader } from '@/components/ui';

const schema = z.object({ code: z.string().trim().min(4, 'Codes are at least 4 characters').max(20, 'That code is too long') });
type Form = z.infer<typeof schema>;

export default function Join() {
  useDocumentTitle('Join a quiz');
  const navigate = useNavigate();
  const { register, handleSubmit, setError, formState: { errors } } = useForm<Form>({ resolver: zodResolver(schema) });
  const join = useApiMutation((v: Form) => catalogApi.join(v.code.toUpperCase()), {
    silent: true,
    invalidate: [keys.catalog.all],
    onSuccess: (quiz) => navigate(`/quizzes/${quiz.id}`),
  });

  const onSubmit = handleSubmit((v) =>
    join.mutate(v, {
      onError: (e) => {
        const msg = e instanceof ApiError && e.status === 429 ? 'Too many tries — wait a few minutes.' : e instanceof ApiError && e.status === 404 ? 'No quiz uses that code. Check it and try again.' : e.message;
        setError('code', { message: msg });
      },
    }),
  );

  return (
    <div className="mx-auto max-w-xl">
      <PageHeader eyebrow="Join" title="Enter an access code" description="Organizers share codes for private quizzes. Entering one adds the quiz to your home page." />
      <Card>
        <CardContent>
          <form onSubmit={onSubmit} className="grid gap-4" noValidate>
            <FormField label="Access code" error={errors.code} hint="Letters and numbers, e.g. ALGEBRA24" required>
              <Input
                autoComplete="off" autoCapitalize="characters" spellCheck={false} className="num h-12 text-lg uppercase tracking-widest" placeholder="ABC123"
                {...register('code')}
              />
            </FormField>
            <Button type="submit" size="lg" loading={join.isPending}><KeyRound aria-hidden="true" /> Join quiz</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
