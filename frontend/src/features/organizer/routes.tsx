import type { RouteObject } from 'react-router-dom';
import { page } from '@/app/lazy';

/** Organizer studio (Organizer + Admin). Rendered inside StudioLayout. Replace page files, keep paths. */
export const routes: RouteObject[] = [
  { path: '/studio', ...page(() => import('./pages/Dashboard')) },
  { path: '/studio/quizzes', ...page(() => import('./pages/Quizzes')) },
  { path: '/studio/quizzes/:id/build', ...page(() => import('./pages/Builder')) },
  { path: '/studio/quizzes/:id/monitor', ...page(() => import('./pages/Monitor')) },
  { path: '/studio/quizzes/:id/grading', ...page(() => import('./pages/Grading')) },
  { path: '/studio/quizzes/:id/reports', ...page(() => import('./pages/Reports')) },
  { path: '/studio/bank', ...page(() => import('./pages/Bank')) },
  { path: '/studio/cohorts', ...page(() => import('./pages/Cohorts')) },
];
