import type { z } from 'zod';
import type { bulkGradeSchema, gradeAnswersSchema } from '@quiz/shared';
import { api } from './client';
import type { BulkGradeResult, GradeSaveResult, GradingAttemptDto, GradingSubmission, MonitorDto } from './types';

export const gradingApi = {
  submissions: (quizId: string, query: { status?: 'pending' | 'graded' | 'all'; page?: number; pageSize?: number; q?: string } = {}) =>
    api.page<GradingSubmission>(`/quizzes/${quizId}/grading/submissions`, query),
  attempt: (attemptId: string) => api.get<GradingAttemptDto>(`/attempts/${attemptId}/grading`),
  grade: (attemptId: string, input: z.input<typeof gradeAnswersSchema>) => api.put<GradeSaveResult>(`/attempts/${attemptId}/grading`, input),
  bulk: (quizId: string, input: z.input<typeof bulkGradeSchema>) => api.post<BulkGradeResult>(`/quizzes/${quizId}/grading/bulk`, input),
  monitor: (quizId: string) => api.get<MonitorDto>(`/quizzes/${quizId}/monitor`),
};
