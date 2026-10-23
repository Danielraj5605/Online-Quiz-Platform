import type { QuestionAuthorDto, QuestionInput, QuizDetailDto, SectionDto } from '@quiz/shared';
import { api } from './client';

export type ReorderInput = {
  items: { id: string; sectionId: string | null; position: number }[];
  sections?: { id: string; position: number }[];
};

export const structureApi = {
  addSection: (quizId: string, input: { title: string; description?: string }) => api.post<SectionDto>(`/quizzes/${quizId}/sections`, input),
  updateSection: (id: string, input: { title?: string; description?: string }) => api.patch<SectionDto>(`/sections/${id}`, input),
  removeSection: (id: string) => api.del(`/sections/${id}`),
  addQuestion: (quizId: string, input: QuestionInput) => api.post<QuestionAuthorDto>(`/quizzes/${quizId}/questions`, input),
  updateQuestion: (id: string, input: QuestionInput) => api.patch<QuestionAuthorDto>(`/questions/${id}`, input),
  removeQuestion: (id: string) => api.del(`/questions/${id}`),
  reorder: (quizId: string, input: ReorderInput) => api.post<QuizDetailDto>(`/quizzes/${quizId}/reorder`, input),
  importBank: (quizId: string, input: { bankIds: string[]; sectionId?: string | null }) =>
    api.post<QuizDetailDto>(`/quizzes/${quizId}/import-bank`, input),
};
