import { Navigate, Outlet, useLocation } from 'react-router-dom';
import type { Role } from '@quiz/shared';
import { useAuth, homeFor } from './auth';
import { PageSpinner } from '@/components/ui/spinner';

/** Requires a signed-in user; remembers where they were headed. */
export function RequireAuth() {
  const { user, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <PageSpinner />;
  if (!user) return <Navigate to="/login" replace state={{ from: loc.pathname + loc.search }} />;
  return <Outlet />;
}

/** Requires one of the given roles (must be nested inside RequireAuth). Others get the 403 page. */
export function RequireRole({ roles }: { roles: Role[] }) {
  const { user, loading } = useAuth();
  if (loading) return <PageSpinner />;
  if (!user) return <Navigate to="/login" replace />;
  if (!roles.includes(user.role)) return <Navigate to="/forbidden" replace />;
  return <Outlet />;
}

/** Login/Register: bounce signed-in users to their home. */
export function GuestOnly() {
  const { user, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <PageSpinner />;
  if (user) {
    const from = (loc.state as { from?: string } | null)?.from;
    return <Navigate to={from ?? homeFor(user.role)} replace />;
  }
  return <Outlet />;
}
