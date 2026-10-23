import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff } from 'lucide-react';
import { loginSchema, type LoginInput } from '@quiz/shared';
import { useAuth, homeFor } from '@/app/auth';
import { ApiError } from '@/lib/api/client';
import { useDocumentTitle } from '@/lib/hooks';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { AuthLayout } from './AuthLayout';

export default function Login() {
  useDocumentTitle('Sign in');
  const { login } = useAuth();
  const navigate = useNavigate();
  const from = (useLocation().state as { from?: string } | null)?.from;
  const [show, setShow] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      const u = await login(values);
      navigate(from ?? homeFor(u.role), { replace: true });
    } catch (e) {
      setFormError(e instanceof ApiError ? e.message : 'Could not sign in. Please try again.');
    }
  });

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to continue where you left off."
      footer={<>New to Quizzo? <Link to="/register" state={{ from }} className="font-medium text-accent underline-offset-4 hover:underline">Create an account</Link></>}
    >
      <form onSubmit={onSubmit} noValidate className="grid gap-5">
        {formError && <p role="alert" className="rounded-md border border-danger bg-danger-soft px-3 py-2 text-sm font-medium text-danger">{formError}</p>}
        <FormField label="Email or username" error={errors.identifier} required>
          <Input autoComplete="username" autoCapitalize="none" spellCheck={false} {...register('identifier')} />
        </FormField>
        <FormField
          label="Password" error={errors.password} required
          trailing={
            <button type="button" onClick={() => setShow((s) => !s)} aria-pressed={show} aria-label={show ? 'Hide password' : 'Show password'} className="absolute right-1 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-md text-muted hover:text-text">
              {show ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
            </button>
          }
        >
          <Input type={show ? 'text' : 'password'} autoComplete="current-password" className="pr-11" {...register('password')} />
        </FormField>
        <Button type="submit" size="lg" loading={isSubmitting}>Sign in</Button>
      </form>
    </AuthLayout>
  );
}
