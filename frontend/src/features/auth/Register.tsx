import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { GraduationCap, PencilRuler } from 'lucide-react';
import type { z } from 'zod';
import { registerSchema, type RegisterInput } from '@quiz/shared';
import { useAuth, homeFor } from '@/app/auth';
import { ApiError } from '@/lib/api/client';
import { useDocumentTitle } from '@/lib/hooks';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/controls';
import { AuthLayout } from './AuthLayout';

type FormIn = z.input<typeof registerSchema>;

const ROLES = [
  { value: 'PARTICIPANT', label: 'Participant', hint: 'Take quizzes and track progress', Icon: GraduationCap },
  { value: 'ORGANIZER', label: 'Organizer', hint: 'Build, run and grade quizzes', Icon: PencilRuler },
] as const;

export default function Register() {
  useDocumentTitle('Create account');
  const { register: signUp } = useAuth();
  const navigate = useNavigate();
  const from = (useLocation().state as { from?: string } | null)?.from;
  const [formError, setFormError] = useState<string | null>(null);
  const { register, control, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm<FormIn, unknown, RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: { role: 'PARTICIPANT' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      const u = await signUp(values);
      navigate(from ?? homeFor(u.role), { replace: true });
    } catch (e) {
      if (e instanceof ApiError) {
        const fe = e.fieldErrors;
        for (const [k, m] of Object.entries(fe)) setError(k as keyof FormIn, { message: m });
        if (!Object.keys(fe).length) setFormError(e.message);
      } else setFormError('Could not create your account. Please try again.');
    }
  });

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Free to start. Pick how you’ll use Quizzo — you can change it later."
      footer={<>Already have an account? <Link to="/login" state={{ from }} className="font-medium text-accent underline-offset-4 hover:underline">Sign in</Link></>}
    >
      <form onSubmit={onSubmit} noValidate className="grid gap-5">
        {formError && <p role="alert" className="rounded-md border border-danger bg-danger-soft px-3 py-2 text-sm font-medium text-danger">{formError}</p>}

        <Controller
          control={control}
          name="role"
          render={({ field }) => (
            <fieldset>
              <legend className="mb-1.5 text-sm font-medium">I’m joining as</legend>
              <RadioGroup value={field.value} onValueChange={field.onChange} className="grid-cols-2" aria-label="Account type">
                {ROLES.map(({ value, label, hint, Icon }) => (
                  <label
                    key={value}
                    className={cn('flex min-h-24 cursor-pointer flex-col gap-1 rounded-lg border p-3 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-focus', field.value === value ? 'border-accent bg-accent-soft' : 'border-border-strong hover:border-text')}
                  >
                    <span className="flex items-center justify-between">
                      <Icon className="size-5 text-accent" aria-hidden="true" />
                      <RadioGroupItem value={value} aria-label={label} />
                    </span>
                    <span className="text-sm font-semibold">{label}</span>
                    <span className="text-xs text-muted">{hint}</span>
                  </label>
                ))}
              </RadioGroup>
            </fieldset>
          )}
        />

        <FormField label="Username" error={errors.username} required hint="Letters, numbers, dot, dash and underscore.">
          <Input autoComplete="username" autoCapitalize="none" spellCheck={false} {...register('username')} />
        </FormField>
        <FormField label="Full name" error={errors.name} hint="Optional — shown on leaderboards instead of your username.">
          <Input autoComplete="name" {...register('name')} />
        </FormField>
        <FormField label="Email" error={errors.email} required>
          <Input type="email" autoComplete="email" {...register('email')} />
        </FormField>
        <FormField label="Password" error={errors.password} required hint="8+ characters with upper, lower case and a number.">
          <Input type="password" autoComplete="new-password" {...register('password')} />
        </FormField>
        <Button type="submit" size="lg" loading={isSubmitting}>Create account</Button>
      </form>
    </AuthLayout>
  );
}
