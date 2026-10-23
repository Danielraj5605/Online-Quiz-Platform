import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Lock, MonitorSmartphone } from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';
import { changePasswordSchema, updateProfileSchema } from '@quiz/shared';
import { useAuth } from '@/app/auth';
import { ApiError } from '@/lib/api/client';
import { gamificationApi } from '@/lib/api/gamification';
import { usersApi } from '@/lib/api/users';
import { useApiMutation, useApiQuery } from '@/lib/query/hooks';
import { keys } from '@/lib/query/keys';
import { useDocumentTitle } from '@/lib/hooks';
import { cn, fmtDate } from '@/lib/utils';
import { Avatar, Badge, Button, Card, CardContent, FormField, Input, PageHeader, Skeleton } from '@/components/ui';
import { BadgeIcon } from '../components/BadgeIcon';

const profileForm = z.object({
  username: updateProfileSchema.shape.username.unwrap(),
  name: z.string().trim().max(80),
  avatarUrl: z.union([z.literal(''), z.string().url('Enter a full image URL, e.g. https://…').max(300)]),
});
type ProfileForm = z.infer<typeof profileForm>;

const passwordForm = z.object({ currentPassword: changePasswordSchema.shape.currentPassword, newPassword: changePasswordSchema.shape.newPassword, confirm: z.string() })
  .refine((v) => v.newPassword === v.confirm, { path: ['confirm'], message: 'Passwords do not match' });
type PasswordForm = z.infer<typeof passwordForm>;

function ProfileCard() {
  const { user, setUser } = useAuth();
  const { register, handleSubmit, setError, formState: { errors, isDirty } } = useForm<ProfileForm>({
    resolver: zodResolver(profileForm),
    defaultValues: { username: user?.username ?? '', name: user?.name ?? '', avatarUrl: user?.avatarUrl ?? '' },
  });
  const save = useApiMutation((v: ProfileForm) => usersApi.updateMe({ username: v.username, name: v.name, avatarUrl: v.avatarUrl || null }), {
    success: 'Profile updated', silent: false,
    onSuccess: (u) => setUser(u),
  });
  const onSubmit = handleSubmit((v) => save.mutate(v, {
    onError: (e) => { if (e instanceof ApiError && e.code === 'USERNAME_TAKEN') setError('username', { message: 'That username is taken' }); },
  }));
  return (
    <Card>
      <CardContent>
        <h2 className="mb-4 text-xl font-semibold">Profile</h2>
        <div className="mb-4 flex items-center gap-3"><Avatar name={user?.name ?? user?.username} src={user?.avatarUrl} size={56} /><div><p className="font-medium">{user?.email}</p><p className="text-xs text-muted">Joined {fmtDate(user?.createdAt, { dateStyle: 'medium' })}</p></div></div>
        <form onSubmit={onSubmit} className="grid gap-4" noValidate>
          <FormField label="Display name" error={errors.name}><Input autoComplete="name" {...register('name')} /></FormField>
          <FormField label="Username" error={errors.username} required><Input autoComplete="username" {...register('username')} /></FormField>
          <FormField label="Avatar URL" error={errors.avatarUrl} hint="Optional. Link to a square image."><Input inputMode="url" autoComplete="off" {...register('avatarUrl')} /></FormField>
          <div><Button type="submit" loading={save.isPending} disabled={!isDirty}>Save changes</Button></div>
        </form>
      </CardContent>
    </Card>
  );
}

function PasswordCard() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { register, handleSubmit, reset, setError, formState: { errors } } = useForm<PasswordForm>({ resolver: zodResolver(passwordForm) });
  const change = useApiMutation((v: PasswordForm) => usersApi.changePassword({ currentPassword: v.currentPassword, newPassword: v.newPassword }), {
    silent: true,
    onSuccess: () => { reset(); toast.success('Password changed. Please sign in again.'); void logout().then(() => navigate('/login')); },
  });
  const onSubmit = handleSubmit((v) => change.mutate(v, {
    onError: (e) => {
      if (e instanceof ApiError && e.status === 401) setError('currentPassword', { message: 'Current password is incorrect' });
      else if (e instanceof ApiError && Object.keys(e.fieldErrors).length) { for (const [k, m] of Object.entries(e.fieldErrors)) setError(k as keyof PasswordForm, { message: m }); }
      else toast.error(e.message);
    },
  }));
  return (
    <Card>
      <CardContent>
        <h2 className="mb-1 flex items-center gap-2 text-xl font-semibold"><Lock className="size-5 text-muted" aria-hidden="true" /> Change password</h2>
        <p className="mb-4 text-sm text-muted">Use at least 8 characters with upper and lower case letters and a number.</p>
        <form onSubmit={onSubmit} className="grid gap-4" noValidate>
          <FormField label="Current password" error={errors.currentPassword} required><Input type="password" autoComplete="current-password" {...register('currentPassword')} /></FormField>
          <FormField label="New password" error={errors.newPassword} required><Input type="password" autoComplete="new-password" {...register('newPassword')} /></FormField>
          <FormField label="Confirm new password" error={errors.confirm} required><Input type="password" autoComplete="new-password" {...register('confirm')} /></FormField>
          <div><Button type="submit" loading={change.isPending}>Update password</Button></div>
        </form>
        <p className="mt-4 flex items-start gap-2 border-t border-border pt-4 text-sm text-muted">
          <MonitorSmartphone className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>You stay signed in on this device with a rotating session. Changing your password signs you out everywhere, including here.</span>
        </p>
      </CardContent>
    </Card>
  );
}

function Badges() {
  const { data, isPending } = useApiQuery(keys.gamification.me, () => gamificationApi.me());
  return (
    <section aria-labelledby="badges-h">
      <h2 id="badges-h" className="mb-3 text-2xl font-semibold">Badges {data && <span className="num text-base font-normal text-muted">{data.badges.filter((b) => b.earned).length}/{data.badges.length}</span>}</h2>
      {isPending ? <Skeleton className="h-32 w-full" /> : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {data?.badges.map((b) => (
            <li key={b.key}>
              <Card className={cn('flex h-full items-start gap-3 p-4', !b.earned && 'bg-surface-2')}>
                <span className={cn('grid size-10 shrink-0 place-items-center rounded-md', b.earned ? 'bg-accent-soft text-accent' : 'bg-surface text-muted')}><BadgeIcon name={b.icon} className="size-5" /></span>
                <div className="min-w-0">
                  <p className="font-medium">{b.name} {b.earned ? <Badge tone="success" className="ml-1 align-middle">Earned</Badge> : <Badge className="ml-1 align-middle">Locked</Badge>}</p>
                  <p className="text-sm text-muted">{b.description}</p>
                  {b.awardedAt && <p className="mt-1 text-xs text-muted">{fmtDate(b.awardedAt, { dateStyle: 'medium' })}</p>}
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function Profile() {
  useDocumentTitle('Profile');
  return (
    <>
      <PageHeader eyebrow="Account" title="Your profile" />
      <div className="grid gap-6 lg:grid-cols-2">
        <ProfileCard />
        <PasswordCard />
      </div>
      <div className="mt-10"><Badges /></div>
    </>
  );
}
