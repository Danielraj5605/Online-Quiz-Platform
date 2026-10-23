import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search } from 'lucide-react';
import { ROLES, type Role } from '@quiz/shared';
import { adminApi, type AdminUserRow } from '@/lib/api';
import type { Paged } from '@/lib/api/client';
import { keys } from '@/lib/query/keys';
import { useApiMutation, usePagedQuery } from '@/lib/query/hooks';
import { useDebounced, useDocumentTitle } from '@/lib/hooks';
import { useAuth } from '@/app/auth';
import { Input, Label, PageHeader, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui';
import { UsersTable } from '../components/UsersTable';
import { ROLE_LABEL } from '../components/roles';

const ALL = 'ALL';

export default function Users() {
  useDocumentTitle('Users and roles');
  const { user: me } = useAuth();
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState('-createdAt');
  const [sp] = useSearchParams();
  const [q, setQ] = useState(sp.get('q') ?? '');
  const [role, setRole] = useState<Role | typeof ALL>(ALL);
  const [state, setState] = useState<'ALL' | 'active' | 'disabled'>(ALL);
  const dq = useDebounced(q.trim(), 300);

  const query = {
    page, pageSize: 15, sort, q: dq || undefined,
    role: role === ALL ? '' as const : role,
    disabled: state === ALL ? '' as const : state === 'disabled' ? 'true' as const : 'false' as const,
  };
  const listKey = keys.admin.users(query);
  const list = usePagedQuery(listKey, () => adminApi.users(query));

  const patchRow = (id: string, patch: Partial<AdminUserRow>) => (old: unknown) => {
    const o = old as Paged<AdminUserRow[]> | undefined;
    return o ? { ...o, data: o.data.map((u) => (u.id === id ? { ...u, ...patch } : u)) } : o;
  };
  const roleMut = useApiMutation(
    (v: { user: AdminUserRow; role: Role }) => adminApi.updateUser(v.user.id, { role: v.role }),
    { invalidate: [keys.admin.all], success: 'Role updated', optimistic: { key: listKey, update: (old, v) => patchRow(v.user.id, { role: v.role })(old) } },
  );
  const disableMut = useApiMutation(
    (u: AdminUserRow) => adminApi.updateUser(u.id, { disabled: !u.disabled }),
    { invalidate: [keys.admin.all], success: 'Account updated', optimistic: { key: listKey, update: (old, u) => patchRow(u.id, { disabled: !u.disabled })(old) } },
  );

  return (
    <>
      <PageHeader eyebrow="Admin" title="Users and roles" description="Promote organizers, disable accounts, and review who is on the platform." />
      <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_auto_auto]">
        <div>
          <Label htmlFor="user-search" className="sr-only">Search users</Label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
            <Input id="user-search" type="search" placeholder="Search name, username or email" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} className="pl-9" />
          </div>
        </div>
        <Select value={role} onValueChange={(v) => { setRole(v as Role | typeof ALL); setPage(1); }}>
          <SelectTrigger aria-label="Filter by role" className="sm:w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All roles</SelectItem>
            {ROLES.map((r) => <SelectItem key={r} value={r}>{ROLE_LABEL[r]}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={state} onValueChange={(v) => { setState(v as typeof state); setPage(1); }}>
          <SelectTrigger aria-label="Filter by status" className="sm:w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Any status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="disabled">Disabled</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <UsersTable
        rows={list.data?.data}
        loading={list.isPending}
        meta={list.data?.meta}
        onPageChange={setPage}
        sort={sort}
        onSortChange={(s) => { setSort(s); setPage(1); }}
        currentUserId={me?.id ?? ''}
        onChangeRole={(user, r) => roleMut.mutateAsync({ user, role: r })}
        onToggleDisabled={(u) => disableMut.mutateAsync(u)}
      />
    </>
  );
}
