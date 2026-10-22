import { api } from './client';
import type { CohortReportRow, ItemAnalysisRow, ParticipantReportRow, ReportSummary } from './types';

export const reportsApi = {
  summary: (quizId: string) => api.get<ReportSummary>(`/quizzes/${quizId}/reports/summary`),
  items: (quizId: string) => api.get<ItemAnalysisRow[]>(`/quizzes/${quizId}/reports/items`),
  participants: (quizId: string, query: { page?: number; pageSize?: number; sort?: string; q?: string } = {}) =>
    api.page<ParticipantReportRow>(`/quizzes/${quizId}/reports/participants`, query),
  cohorts: (quizId: string) => api.get<CohortReportRow[]>(`/quizzes/${quizId}/reports/cohorts`),
  exportCsv: (quizId: string) => api.download(`/quizzes/${quizId}/reports/export.csv`, `quiz-${quizId}-report.csv`),
  exportPdf: (quizId: string) => api.download(`/quizzes/${quizId}/reports/export.pdf`, `quiz-${quizId}-report.pdf`),
};
