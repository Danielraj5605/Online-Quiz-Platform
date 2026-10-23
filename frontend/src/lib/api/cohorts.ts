import { api } from './client';
import type { AddMembersResult, CohortDetailDto, CohortDto } from './types';

export const cohortsApi = {
  list: (query: { page?: number; pageSize?: number; q?: string } = {}) => api.page<CohortDto>('/cohorts', query),
  get: (id: string) => api.get<CohortDetailDto>(`/cohorts/${id}`),
  create: (input: { name: string; description?: string }) => api.post<CohortDto>('/cohorts', input),
  update: (id: string, input: { name?: string; description?: string }) => api.patch<CohortDto>(`/cohorts/${id}`, input),
  remove: (id: string) => api.del(`/cohorts/${id}`),
  addMembers: (id: string, identifiers: string[]) => api.post<AddMembersResult>(`/cohorts/${id}/members`, { identifiers }),
  removeMember: (id: string, userId: string) => api.del(`/cohorts/${id}/members/${userId}`),
};
