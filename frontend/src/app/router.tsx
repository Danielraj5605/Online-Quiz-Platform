import type { ReactElement } from 'react';
import { createBrowserRouter, Navigate, Outlet, useLocation, type RouteObject } from 'react-router-dom';
import { GuestOnly, RequireAuth, RequireRole } from './guards';
import { useAuth } from './auth';
import { page } from './lazy';
import { AdminLayout, ParticipantLayout, RoleAwareLayout, StudioLayout, TakingLayout } from '@/components/layout/shell';
import { ErrorBoundary } from '@/components/layout/error-boundary';
import { routes as participant, takingRoutes, sharedRoutes } from '@/features/participant/routes';
import { routes as organizer } from '@/features/organizer/routes';
import { routes as admin } from '@/features/admin/routes';
import { Forbidden, NotFound } from '@/features/auth/StatusPages';

/** Admins never see participant screens; organizers landing on "/" are sent to their studio. */
function ParticipantGate() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  if (user?.role === 'ADMIN') return <Navigate to="/admin" replace />;
  if (user?.role === 'ORGANIZER' && pathname === '/') return <Navigate to="/studio" replace />;
  return <ParticipantLayout />;
}

const guarded = (roles: Parameters<typeof RequireRole>[0]['roles'], layout: ReactElement, children: RouteObject[]): RouteObject => ({
  element: <RequireRole roles={roles} />,
  children: [{ element: layout, children }],
});

export const router = createBrowserRouter([
  {
    element: <ErrorBoundary><Outlet /></ErrorBoundary>,
    children: [
      {
        element: <GuestOnly />,
        children: [
          { path: '/login', ...page(() => import('@/features/auth/Login')) },
          { path: '/register', ...page(() => import('@/features/auth/Register')) },
        ],
      },
      {
        element: <RequireAuth />,
        children: [
          guarded(['PARTICIPANT', 'ORGANIZER', 'ADMIN'], <RoleAwareLayout />, sharedRoutes),
          guarded(['PARTICIPANT', 'ORGANIZER', 'ADMIN'], <ParticipantGate />, participant),
          guarded(['PARTICIPANT', 'ORGANIZER'], <TakingLayout />, takingRoutes),
          guarded(['ORGANIZER', 'ADMIN'], <StudioLayout />, organizer),
          guarded(['ADMIN'], <AdminLayout />, admin),
          { path: '/forbidden', element: <Forbidden /> },
        ],
      },
      { path: '*', element: <NotFound /> },
    ],
  },
]);
