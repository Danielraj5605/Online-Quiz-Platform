import type { RouteObject } from 'react-router-dom';
import { page } from '@/app/lazy';

/** Participant area. Rendered inside ParticipantLayout (top bar + bottom tabs). Replace page files, keep paths. */
export const routes: RouteObject[] = [
  { path: '/', ...page(() => import('./pages/Home')) },
  { path: '/discover', ...page(() => import('./pages/Discover')) },
  { path: '/join', ...page(() => import('./pages/Join')) },
  { path: '/quizzes/:id', ...page(() => import('./pages/QuizOverview')) },
  { path: '/results/:attemptId', ...page(() => import('./pages/Results')) },
  { path: '/progress', ...page(() => import('./pages/Progress')) },
  { path: '/leaderboard', ...page(() => import('./pages/Leaderboard')) },
];

/** Chrome-less taking mode (TakingLayout). */
export const takingRoutes: RouteObject[] = [
  { path: '/attempt/:attemptId', ...page(() => import('./pages/Attempt')) },
];

/** Pages every signed-in role can open; chrome follows the user's role (RoleAwareLayout). */
export const sharedRoutes: RouteObject[] = [
  { path: '/profile', ...page(() => import('./pages/Profile')) },
];
