import type { z } from 'zod';
import type { UserDto, updateProfileSchema, changePasswordSchema } from '@quiz/shared';
import { api } from './client';
import type { BadgeDto } from './types';

export interface PublicProfile {
  id: string; username: string; name: string | null; avatarUrl: string | null; xp: number; tier: string; streakDays: number;
  badges: { awardedAt: string; badge: BadgeDto }[]; followerCount: number; followingCount: number; isFollowing: boolean;
}
export const usersApi = {
  updateMe: (input: z.input<typeof updateProfileSchema>) => api.patch<UserDto>('/users/me', input),
  changePassword: (input: z.input<typeof changePasswordSchema>) => api.put<void>('/users/me/password', input),
  publicProfile: (id: string) => api.get<PublicProfile>(`/users/${id}/public`),
  follow: (id: string) => api.post<void>(`/users/${id}/follow`),
  unfollow: (id: string) => api.del(`/users/${id}/follow`),
};
