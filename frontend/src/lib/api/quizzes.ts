import type { CreateQuizInput, QuizDetailDto, QuizStatus, QuizSummaryDto } from '@quiz/shared';
import { api } from './client';
import type { AccessDto, Category, Tag, VersionDto } from './types';

export interface QuizListQuery {
  page?: number; pageSize?: number; sort?: string; q?: string; status?: QuizStatus | ''; mine?: boolean; categoryId?: string;
}

export const quizzesApi = {
  list: (query: QuizListQuery = {}) => api.page<QuizSummaryDto>('/quizzes', query),
  get: (id: string) => api.get<QuizDetailDto>(`/quizzes/${id}`),
  create: (input: Partial<CreateQuizInput> & { title: string }) => api.post<QuizDetailDto>('/quizzes', input),
  update: (id: string, input: Partial<CreateQuizInput>) => api.patch<QuizDetailDto>(`/quizzes/${id}`, input),
  remove: (id: string) => api.del(`/quizzes/${id}`),
  duplicate: (id: string) => api.post<QuizDetailDto>(`/quizzes/${id}/duplicate`),
  publish: (id: string) => api.post<QuizDetailDto>(`/quizzes/${id}/publish`),
  close: (id: string) => api.post<QuizDetailDto>(`/quizzes/${id}/close`),
  archive: (id: string) => api.post<QuizDetailDto>(`/quizzes/${id}/archive`),
  reopen: (id: string) => api.post<QuizDetailDto>(`/quizzes/${id}/reopen`),
  versions: (id: string) => api.get<VersionDto[]>(`/quizzes/${id}/versions`),
  regrade: (id: string, versionId?: string) => api.post<{ regraded: number }>(`/quizzes/${id}/regrade`, { versionId }),
  getAccess: (id: string) => api.get<AccessDto>(`/quizzes/${id}/access`),
  setAccess: (id: string, input: { visibility?: string; regenerateCode?: boolean; cohortIds?: string[]; userIds?: string[] }) =>
    api.put<AccessDto>(`/quizzes/${id}/access`, input),
  categories: () => api.get<Category[]>('/categories'),
  createCategory: (name: string) => api.post<Category>('/categories', { name }),
  tags: (q?: string) => api.get<Tag[]>('/tags', { q }),
};
export type { QuizStatus };
