import { api } from './client';
import type { GamificationDto } from './types';

export const gamificationApi = { me: () => api.get<GamificationDto>('/me/gamification') };
