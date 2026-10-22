import type { RouteObject } from 'react-router-dom';
import { page } from '@/app/lazy';

/** Admin area. Rendered inside AdminLayout. Replace page files, keep paths. */
export const routes: RouteObject[] = [
  { path: '/admin', ...page(() => import('./pages/Overview')) },
  { path: '/admin/users', ...page(() => import('./pages/Users')) },
  { path: '/admin/quizzes', ...page(() => import('./pages/Quizzes')) },
  { path: '/admin/moderation', ...page(() => import('./pages/Moderation')) },
  { path: '/admin/audit', ...page(() => import('./pages/Audit')) },
];
