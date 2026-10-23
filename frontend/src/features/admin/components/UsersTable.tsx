import { useState } from 'react';
import { Ban, RotateCcw } from 'lucide-react';
import { ROLES, type PageMeta, type Role } from '@quiz/shared';
import type { AdminUserRow } from '@/lib/api';
import {
  Avatar, Badge, Button, ConfirmDialog, DataTable, Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogTitle,
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue, type Column,
} from '@/components/ui';
import { fmtDate } from '@/lib/utils';
import { ROLE_LABEL } from './roles';


interface Props {
  rows: AdminUserRow[] | undefined;
  loading?: boolean;
  meta?: PageMeta;
  onPageChange: (p: number) => void;
  sort?: string;
  onSortChange: (s: string) => void;
  currentUserId: string;
  onChangeRole: (user: AdminUserRow, role: Role) => void | Promise<unknown>;
  onToggleDisabled: (user: AdminUserRow) => void | Promise<unknown>;
}

function RoleCell({ user, isSelf, onChangeRole }: { user: AdminUserRow; isSelf: boolean; onChangeRole: Props['onChangeRole'] }) {
  const [pending, setPending] = useState<Role | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <>
      <Select value={user.role} disabled={isSelf} onValueChange={(v) => setPending(v as Role)}>
        <SelectTrigger aria-label={`Role for ${user.username}`} className="h-9 w-36 sm:h-9">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {ROLES.map((r) => <SelectItem key={r} value={r}>{ROLE_LABEL[r]}</SelectItem>)}
        </SelectContent>
      </Select>
      <Dialog open={pending !== null} onOpenChange={(o) => { if (!o) setPending(null); }}>
        <DialogContent>
          <DialogTitle>Change role?</DialogTitle>
          <DialogDescription>
            {pending && <>Make <strong>{user.username}</strong> {pending === 'ADMIN' ? 'an' : 'a'} {ROLE_LABEL[pending].toLowerCase()}. {pending === 'ADMIN' ? 'Admins can manage every user and quiz on the platform.' : 'Their access changes immediately.'}</>}
          </DialogDescription>
          <DialogFooter>
            <DialogClose asChild><Button variant="secondary">Cancel</Button></DialogClose>
            <Button
              loading={busy}
              onClick={async () => {
                if (!pending) return;
                setBusy(true);
                try { await onChangeRole(user, pending); setPending(null); } finally { setBusy(false); }
              }}
            >
              Change role
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function UsersTable({ rows, loading, meta, onPageChange, sort, onSortChange, currentUserId, onChangeRole, onToggleDisabled }: Props) {
  const columns: Column<AdminUserRow>[] = [
    {
      key: 'user', header: 'User', sortKey: 'username', primary: true,
      cell: (u) => (
        <div className="flex min-w-0 items-center gap-3">
          <Avatar name={u.name ?? u.username} size={32} />
          <div className="min-w-0">
            <p className="truncate font-medium">
              {u.username}
              {u.id === currentUserId && <Badge tone="accent" className="ml-2">You</Badge>}
            </p>
            <p className="truncate text-xs text-muted">{u.email}</p>
          </div>
        </div>
      ),
    },
    { key: 'role', header: 'Role', sortKey: 'role', cell: (u) => <RoleCell user={u} isSelf={u.id === currentUserId} onChangeRole={onChangeRole} /> },
    {
      key: 'status', header: 'Status',
      cell: (u) => u.disabled ? <Badge tone="danger">Disabled</Badge> : <Badge tone="success">Active</Badge>,
    },
    { key: 'quizzes', header: 'Quizzes', hideOnMobile: true, cell: (u) => <span className="num">{u.quizCount}</span> },
    { key: 'attempts', header: 'Attempts', hideOnMobile: true, cell: (u) => <span className="num">{u.attemptCount}</span> },
    { key: 'xp', header: 'XP', sortKey: 'xp', hideOnMobile: true, cell: (u) => <span className="num">{u.xp.toLocaleString()}</span> },
    { key: 'joined', header: 'Joined', sortKey: 'createdAt', cell: (u) => fmtDate(u.createdAt, { dateStyle: 'medium' }) },
    {
      key: 'actions', header: 'Actions', className: 'text-right',
      cell: (u) => (
        <ConfirmDialog
          destructive={!u.disabled}
          title={u.disabled ? `Re-enable ${u.username}?` : `Disable ${u.username}?`}
          description={u.disabled
            ? 'They will be able to sign in again.'
            : 'They will be signed out everywhere and unable to sign in until re-enabled. Their quizzes and results are kept.'}
          confirmLabel={u.disabled ? 'Re-enable' : 'Disable account'}
          onConfirm={() => onToggleDisabled(u)}
          trigger={
            <Button variant="outline" size="sm" disabled={u.id === currentUserId} aria-label={`${u.disabled ? 'Re-enable' : 'Disable'} ${u.username}`}>
              {u.disabled ? <RotateCcw aria-hidden="true" /> : <Ban aria-hidden="true" />}
              {u.disabled ? 'Enable' : 'Disable'}
            </Button>
          }
        />
      ),
    },
  ];

  return (
    <DataTable
      caption="Platform users"
      columns={columns}
      rows={rows}
      loading={loading}
      getRowId={(u) => u.id}
      sort={sort}
      onSortChange={onSortChange}
      meta={meta}
      onPageChange={onPageChange}
      empty={{ title: 'No users match', description: 'Try a different search or clear the filters.' }}
    />
  );
}
