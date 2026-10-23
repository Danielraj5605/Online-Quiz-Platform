import type { QuizStatus, Role } from '@quiz/shared';
import { api } from './client';
import type { AdminAnalytics, AdminQuizRow, AdminUserRow, AuditRow, ModerationItem } from './types';

export const adminApi = {
  users: (query: { page?: number; pageSize?: number; q?: string; sort?: string; role?: Role | ''; disabled?: 'true' | 'false' | '' } = {}) =>
    api.page<AdminUserRow>('/admin/users', query),
  updateUser: (id: string, input: { role?: Role; disabled?: boolean }) => api.patch<AdminUserRow>(`/admin/users/${id}`, input),
  analytics: () => api.get<AdminAnalytics>('/admin/analytics'),
  quizzes: (query: { page?: number; pageSize?: number; q?: string; sort?: string; status?: QuizStatus | ''; flagged?: 'true' | 'false' | '' } = {}) =>
    api.page<AdminQuizRow>('/admin/quizzes', query),
  updateQuiz: (id: string, input: { isFlagged?: boolean; status?: QuizStatus }) => api.patch<AdminQuizRow>(`/admin/quizzes/${id}`, input),
  moderation: (query: { page?: number; pageSize?: number; status?: string } = {}) => api.page<ModerationItem>('/admin/moderation', query),
  resolveFlag: (id: string, action: 'DISMISS' | 'REMOVE', note?: string) => api.patch<ModerationItem>(`/admin/moderation/${id}`, { action, note }),
  auditLog: (query: { page?: number; pageSize?: number; action?: string; actorId?: string; from?: string; to?: string } = {}) =>
    api.page<AuditRow>('/admin/audit-log', query),
  report: (input: { entityType: 'QUIZ' | 'REVIEW' | 'USER'; entityId: string; reason: string }) => api.post<void>('/reports', input),
};
