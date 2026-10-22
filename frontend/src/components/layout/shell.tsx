import { Suspense, useState, type ReactNode } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Check, LogOut, Search, UserRound } from 'lucide-react';
import type { Role } from '@quiz/shared';
import { useAuth } from '@/app/auth';
import { navFor } from '@/app/nav';
import { cn } from '@/lib/utils';
import { Avatar, SkipLink } from '@/components/ui/surfaces';
import { Button } from '@/components/ui/button';
import { CommandPalette } from '@/components/ui/command-palette';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/menus';
import { PageSpinner } from '@/components/ui/spinner';
import { OfflineBanner } from './offline-banner';

export function Brand({ to = '/', className }: { to?: string; className?: string }) {
  return (
    <Link to={to} className={cn('inline-flex items-center gap-2 rounded-md font-display text-xl font-semibold tracking-tight', className)} aria-label="Quizzo home">
      <span className="grid size-7 place-items-center rounded-md bg-text text-bg" aria-hidden="true"><Check className="size-4 text-accent" strokeWidth={3.2} /></span>
      Quizzo
    </Link>
  );
}

function UserMenu() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  if (!user) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className="rounded-full" aria-label={`Account menu for ${user.username}`}><Avatar name={user.name ?? user.username} src={user.avatarUrl} /></button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel>
          <span className="block text-sm font-medium text-text">{user.name ?? user.username}</span>
          <span className="block">@{user.username} · {user.role.toLowerCase()}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => navigate('/profile')}><UserRound aria-hidden="true" /> Profile</DropdownMenuItem>
        <DropdownMenuItem destructive onSelect={() => void logout().then(() => navigate('/login'))}><LogOut aria-hidden="true" /> Sign out</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const linkCls = ({ isActive }: { isActive: boolean }) =>
  cn('inline-flex min-h-10 items-center gap-2 rounded-md px-3 text-sm font-medium transition-colors', isActive ? 'bg-surface-2 text-text' : 'text-muted hover:bg-surface-2 hover:text-text');

/**
 * App chrome. `variant="top"` = horizontal nav on desktop; `"sidebar"` = left rail ≥1024px.
 * Below 1024px both use a bottom tab bar (primary items) — thumb reachable on phones.
 */
export function AppShell({ role, variant, home, children }: { role: Role; variant: 'top' | 'sidebar'; home: string; children?: ReactNode }) {
  const items = navFor(role);
  const [palette, setPalette] = useState(false);
  const sidebar = variant === 'sidebar';
  return (
    <div className={cn('min-h-dvh', sidebar && 'lg:grid lg:grid-cols-[15rem_1fr]')}>
      <SkipLink />
      <OfflineBanner />
      {sidebar && (
        <aside className="sticky top-0 hidden h-dvh flex-col gap-6 border-r border-border bg-surface px-3 py-5 lg:flex" aria-label="Primary">
          <Brand to={home} className="px-2" />
          <nav className="grid gap-1" aria-label="Main">
            {items.map((n) => <NavLink key={n.to} to={n.to} end={n.end} className={linkCls}><n.icon className="size-4" aria-hidden="true" />{n.label}</NavLink>)}
          </nav>
          <p className="mt-auto px-2 text-xs text-muted">Press <kbd className="num rounded-sm border border-border-strong px-1">Ctrl</kbd> <kbd className="num rounded-sm border border-border-strong px-1">K</kbd> to jump anywhere</p>
        </aside>
      )}
      <div className="min-w-0">
        <header className="safe-top sticky top-0 z-30 border-b border-border bg-bg/90 backdrop-blur">
          <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 sm:px-6">
            <Brand to={home} className={cn(sidebar && 'lg:hidden')} />
            {!sidebar && (
              <nav className="ml-4 hidden items-center gap-1 lg:flex" aria-label="Main">
                {items.map((n) => <NavLink key={n.to} to={n.to} end={n.end} className={linkCls}>{n.label}</NavLink>)}
              </nav>
            )}
            <div className="ml-auto flex items-center gap-1">
              <Button variant="ghost" size="sm" className="hidden gap-2 text-muted sm:inline-flex" onClick={() => setPalette(true)} aria-label="Open command palette">
                <Search aria-hidden="true" /> Search <kbd className="num rounded-sm border border-border-strong px-1 text-xs">Ctrl K</kbd>
              </Button>
              <Button variant="ghost" size="icon" className="sm:hidden" onClick={() => setPalette(true)} aria-label="Open command palette"><Search aria-hidden="true" /></Button>
              <ThemeToggle />
              <UserMenu />
            </div>
          </div>
        </header>
        <main id="main" tabIndex={-1} className="mx-auto max-w-6xl px-4 pb-28 pt-6 outline-none sm:px-6 lg:pb-12">
          <Suspense fallback={<PageSpinner />}>{children ?? <Outlet />}</Suspense>
        </main>
      </div>
      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 backdrop-blur lg:hidden" aria-label="Mobile">
        <ul className="mx-auto flex max-w-xl justify-around px-1 pt-1">
          {items.filter((n) => n.primary).slice(0, 5).map((n) => (
            <li key={n.to} className="min-w-0 flex-1">
              <NavLink to={n.to} end={n.end} className={({ isActive }) => cn('flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-md px-1 text-[0.7rem] font-medium', isActive ? 'text-accent' : 'text-muted')}>
                <n.icon className="size-5" aria-hidden="true" />
                <span className="truncate">{n.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <CommandPalette open={palette} onOpenChange={setPalette} />
    </div>
  );
}

/** Chrome-less layout for taking a quiz — no nav, nothing to distract. */
export function TakingLayout() {
  return (
    <div className="min-h-dvh bg-bg">
      <SkipLink />
      <OfflineBanner />
      <main id="main" tabIndex={-1} className="outline-none"><Suspense fallback={<PageSpinner />}><Outlet /></Suspense></main>
    </div>
  );
}

export const ParticipantLayout = () => <AppShell role="PARTICIPANT" variant="top" home="/" />;
export const StudioLayout = () => <AppShell role="ORGANIZER" variant="sidebar" home="/studio" />;
export const AdminLayout = () => <AppShell role="ADMIN" variant="sidebar" home="/admin" />;

/** Shared pages (e.g. /profile) pick the chrome that matches the signed-in role. */
export function RoleAwareLayout() {
  const { user } = useAuth();
  if (user?.role === 'ADMIN') return <AdminLayout />;
  if (user?.role === 'ORGANIZER') return <StudioLayout />;
  return <ParticipantLayout />;
}
