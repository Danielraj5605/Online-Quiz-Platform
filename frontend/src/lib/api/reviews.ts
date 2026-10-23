import type { z } from 'zod';
import type { reviewSchema } from '@quiz/shared';
import { api } from './client';
import type { ReviewsDto } from './types';

export const reviewsApi = {
  list: (quizId: string, query: { page?: number; pageSize?: number } = {}) => api.get<ReviewsDto>(`/quizzes/${quizId}/reviews`, query),
  save: (quizId: string, input: z.input<typeof reviewSchema>) => api.post<{ id: string; rating: number; comment: string }>(`/quizzes/${quizId}/reviews`, input),
  remove: (quizId: string) => api.del(`/quizzes/${quizId}/reviews`),
};
