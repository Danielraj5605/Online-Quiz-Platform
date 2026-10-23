import type { QuizOverviewDto } from '@quiz/shared';
import { api } from './client';
import type { AssignmentsDto, DailyChallengeDto } from './types';

export const catalogApi = {
  list: (query: { page?: number; pageSize?: number; q?: string; categoryId?: string; difficulty?: string; tag?: string; sort?: string } = {}) =>
    api.page<QuizOverviewDto>('/catalog', query),
  get: (id: string) => api.get<QuizOverviewDto>(`/catalog/${id}`),
  join: (code: string) => api.post<QuizOverviewDto>('/catalog/join', { code }),
  assignments: () => api.get<AssignmentsDto>('/me/assignments'),
  dailyChallenge: () => api.get<DailyChallengeDto | null>('/daily-challenge'),
};
