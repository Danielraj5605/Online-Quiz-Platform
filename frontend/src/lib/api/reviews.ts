import type { z } from 'zod';
import type { reviewSchema } from '@quiz/shared';
import { api } from './client';
import type { ReviewsDto } from './types';

export const reviewsApi = {
  list: (quizId: string) => api.get<ReviewsDto>(`/quizzes/${quizId}/reviews`),
  save: (quizId: string, input: z.input<typeof reviewSchema>) => api.post<void>(`/quizzes/${quizId}/reviews`, input),
  remove: (quizId: string) => api.del(`/quizzes/${quizId}/reviews`),
};
