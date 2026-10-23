import type { z } from 'zod';
import type { bankQuestionSchema } from '@quiz/shared';
import { api } from './client';
import type { BankQuestionDto } from './types';

export const bankApi = {
  list: (query: { page?: number; pageSize?: number; q?: string; type?: string; categoryId?: string; tag?: string; sort?: string } = {}) => api.page<BankQuestionDto>('/bank', query),
  create: (input: z.input<typeof bankQuestionSchema>) => api.post<BankQuestionDto>('/bank', input),
  update: (id: string, input: z.input<typeof bankQuestionSchema>) => api.patch<BankQuestionDto>(`/bank/${id}`, input),
  remove: (id: string) => api.del(`/bank/${id}`),
};
