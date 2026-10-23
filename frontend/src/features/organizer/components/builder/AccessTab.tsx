import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Check, Copy, Globe, KeyRound, Lock, RefreshCw, X } from 'lucide-react';
import type { QuizDetailDto, Visibility } from '@quiz/shared';
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Checkbox, RadioGroup, RadioGroupItem, Skeleton } from '@/components/ui';
import { cohortsApi, quizzesApi } from '@/lib/api';
import { keys } from '@/lib/query/keys';
import { useApiMutation, useApiQuery } from '@/lib/query/hooks';
import { useBuilder } from './BuilderProvider';
import type { AccessDto } from '@/lib/api/types';

const OPTIONS: { value: Visibility; icon: typeof Globe; label: string; hint: string }[] = [
  { value: 'PUBLIC', icon: Globe, label: 'Public', hint: 'Listed in the catalog. Anyone signed in can take it.' },
  { value: 'UNLISTED', icon: KeyRound, label: 'Unlisted', hint: 'Not in the catalog. People need the access code or an invitation.' },
  { value: 'PRIVATE', icon: Lock, label: 'Private', hint: 'Only assigned cohorts and invited people (plus the access code).' },
];

export function AccessTab() {
  const { id, quiz } = useBuilder();
  const qc = useQueryClient();
  const access = useApiQuery(keys.quizzes.access(id), () => quizzesApi.getAccess(id));
  const cohorts = useApiQuery(keys.cohorts.list({ pageSize: 100 }), () => cohortsApi.list({ pageSize: 100 }).then((r) => r.data));
  const [copied, setCopied] = useState(false);

  const update = useApiMutation(
    (v: { visibility?: Visibility; regenerateCode?: boolean; cohortIds?: string[]; userIds?: string[] }) => quizzesApi.setAccess(id, v),
    {
      invalidate: [['quizzes', 'list']],
      onSuccess: (d: AccessDto) => {
        qc.setQueryData(keys.quizzes.access(id), d);
        qc.setQueryData<QuizDetailDto>(keys.quizzes.detail(id), (q) => (q ? { ...q, visibility: d.visibility, accessCode: d.accessCode } : q));
      },
    },
  );

  if (access.isPending) return <div className="grid max-w-3xl gap-4"><Skeleton className="h-48" /><Skeleton className="h-40" /></div>;
  if (access.isError) return <p className="text-danger">Couldn't load access settings. {access.error.message}</p>;
  const a = access.data;
  const assigned = new Set(a.cohorts.map((c) => c.id));
  const toggleCohort = (cid: string) => update.mutate({ cohortIds: assigned.has(cid) ? [...assigned].filter((x) => x !== cid) : [...assigned, cid] });

  const copy = async () => {
    if (!a.accessCode) return;
    try { await navigator.clipboard.writeText(a.accessCode); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* clipboard blocked */ }
  };

  return (
    <div className="grid max-w-3xl gap-5">
      <Card>
        <CardHeader><CardTitle>Who can take this quiz</CardTitle><CardDescription>Applies once the quiz is live.</CardDescription></CardHeader>
        <CardContent>
          <RadioGroup value={a.visibility} onValueChange={(v) => update.mutate({ visibility: v as Visibility })} aria-label="Visibility" className="grid gap-2">
            {OPTIONS.map(({ value, icon: Icon, label, hint }) => (
              <label key={value} className="flex cursor-pointer items-start gap-3 rounded-md border border-border p-3 hover:bg-surface-2 has-[[data-state=checked]]:border-accent has-[[data-state=checked]]:bg-accent-soft">
                <RadioGroupItem value={value} className="mt-0.5" />
                <Icon className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden="true" />
                <span className="text-sm"><span className="font-medium">{label}</span><span className="block text-muted">{hint}</span></span>
              </label>
            ))}
          </RadioGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Access code</CardTitle><CardDescription>Share it so people can join from the “Join” page.</CardDescription></CardHeader>
        <CardContent>
          {a.accessCode ? (
            <div className="flex flex-wrap items-center gap-3">
              <code className="num rounded-md border border-border-strong bg-surface-2 px-4 py-2 text-2xl font-semibold tracking-[0.25em]" aria-label={`Access code ${a.accessCode.split('').join(' ')}`}>{a.accessCode}</code>
              <Button variant="outline" onClick={() => void copy()}>{copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />} {copied ? 'Copied' : 'Copy'}</Button>
              <Button variant="ghost" loading={update.isPending} onClick={() => update.mutate({ regenerateCode: true })}><RefreshCw aria-hidden="true" /> New code</Button>
              <span role="status" className="sr-only">{copied ? 'Access code copied to clipboard' : ''}</span>
            </div>
          ) : (
            <p className="text-sm text-muted">A code is created when you publish{quiz.status === 'DRAFT' ? ' this quiz' : ''}.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Cohorts</CardTitle><CardDescription>Everyone in a selected cohort can see and take this quiz.</CardDescription></CardHeader>
        <CardContent>
          {cohorts.isPending ? <Skeleton className="h-20" /> : (cohorts.data?.length ?? 0) === 0 ? (
            <p className="text-sm text-muted">You haven't created any cohorts. <Link to="/studio/cohorts" className="text-accent underline">Create one</Link> to assign this quiz to a class or team.</p>
          ) : (
            <ul className="grid gap-2">
              {cohorts.data!.map((c) => (
                <li key={c.id}>
                  <label className="flex cursor-pointer items-center gap-3 rounded-md p-2 hover:bg-surface-2">
                    <Checkbox checked={assigned.has(c.id)} onCheckedChange={() => toggleCohort(c.id)} aria-label={`Assign to ${c.name}`} />
                    <span className="flex-1 text-sm font-medium">{c.name}</span>
                    <Badge><span className="num">{c.memberCount}</span> member{c.memberCount === 1 ? '' : 's'}</Badge>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Invited people</CardTitle><CardDescription>People who joined with the code, or were invited directly.</CardDescription></CardHeader>
        <CardContent>
          {a.users.length === 0 ? <p className="text-sm text-muted">No one yet. Add people to a cohort to invite them in bulk.</p> : (
            <ul className="flex flex-wrap gap-2" aria-label="Invited people">
              {a.users.map((u) => (
                <li key={u.id}>
                  <Badge className="gap-1 py-1 pl-2.5 pr-1">
                    {u.name ?? u.username}
                    <button type="button" aria-label={`Remove ${u.username}`} className="grid size-5 place-items-center rounded-sm hover:bg-black/10" onClick={() => update.mutate({ userIds: a.users.filter((x) => x.id !== u.id).map((x) => x.id) })}><X className="size-3" /></button>
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
