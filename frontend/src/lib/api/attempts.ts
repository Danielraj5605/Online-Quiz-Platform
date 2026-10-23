import type { z } from 'zod';
import type { AttemptViewDto, ResultDto, saveAnswersSchema, attemptEventSchema } from '@quiz/shared';
import { api } from './client';
import type { AttemptHistoryItem, ProgressDto, QuizLeaderboardRow, XpLeaderboardRow } from './types';

export const attemptsApi = {
  start: (quizId: string, preview = false) => api.post<AttemptViewDto>(`/quizzes/${quizId}/attempts${preview ? '?preview=1' : ''}`),
  get: (id: string) => api.get<AttemptViewDto>(`/attempts/${id}`),
  saveAnswers: (id: string, input: z.input<typeof saveAnswersSchema>) => api.put<{ savedAt: string; count: number }>(`/attempts/${id}/answers`, input),
  event: (id: string, input: z.input<typeof attemptEventSchema>) => api.post<void>(`/attempts/${id}/events`, input),
  submit: (id: string, answers?: z.input<typeof saveAnswersSchema>['answers']) => api.post<ResultDto>(`/attempts/${id}/submit`, answers?.length ? { answers } : {}),
  result: (id: string) => api.get<ResultDto>(`/attempts/${id}/result`),
  history: (query: { page?: number; pageSize?: number } = {}) => api.page<AttemptHistoryItem>('/me/attempts', query),
  progress: () => api.get<ProgressDto>('/me/progress'),
  quizLeaderboard: (quizId: string) => api.get<QuizLeaderboardRow[]>(`/quizzes/${quizId}/leaderboard`),
  globalLeaderboard: () => api.get<XpLeaderboardRow[]>('/leaderboard'),
};
