import { api } from './client';
import type { OrganizerDashboard } from './types';

export const organizerApi = { dashboard: () => api.get<OrganizerDashboard>('/organizer/dashboard') };
