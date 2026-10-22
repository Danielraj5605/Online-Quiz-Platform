import { BarChart3, BookOpen, Compass, FileText, Flag, Home, KeyRound, LayoutDashboard, ListChecks, ScrollText, ShieldCheck, Trophy, User, Users, UsersRound, type LucideIcon } from 'lucide-react';
import type { Role } from '@quiz/shared';

export interface NavItem { to: string; label: string; icon: LucideIcon; end?: boolean; /** show in the mobile bottom bar */ primary?: boolean }

export const participantNav: NavItem[] = [
  { to: '/', label: 'Home', icon: Home, end: true, primary: true },
  { to: '/discover', label: 'Discover', icon: Compass, primary: true },
  { to: '/join', label: 'Join', icon: KeyRound },
  { to: '/progress', label: 'Progress', icon: BarChart3, primary: true },
  { to: '/leaderboard', label: 'Leaderboard', icon: Trophy, primary: true },
  { to: '/profile', label: 'Profile', icon: User, primary: true },
];

export const studioNav: NavItem[] = [
  { to: '/studio', label: 'Dashboard', icon: LayoutDashboard, end: true, primary: true },
  { to: '/studio/quizzes', label: 'Quizzes', icon: FileText, primary: true },
  { to: '/studio/bank', label: 'Question bank', icon: BookOpen, primary: true },
  { to: '/studio/cohorts', label: 'Cohorts', icon: UsersRound, primary: true },
  { to: '/profile', label: 'Profile', icon: User, primary: true },
];

export const adminNav: NavItem[] = [
  { to: '/admin', label: 'Overview', icon: BarChart3, end: true, primary: true },
  { to: '/admin/users', label: 'Users', icon: Users, primary: true },
  { to: '/admin/quizzes', label: 'Quizzes', icon: ListChecks, primary: true },
  { to: '/admin/moderation', label: 'Moderation', icon: Flag, primary: true },
  { to: '/admin/audit', label: 'Audit log', icon: ScrollText, primary: true },
];

export const navFor = (role: Role): NavItem[] => (role === 'ADMIN' ? adminNav : role === 'ORGANIZER' ? studioNav : participantNav);
export const brandIcon = ShieldCheck;
