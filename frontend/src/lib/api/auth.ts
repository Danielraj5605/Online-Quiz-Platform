import type { AuthResult, LoginInput, RegisterInput, UserDto } from '@quiz/shared';
import { api, tokenStore } from './client';

export const authApi = {
  async login(input: LoginInput) {
    const r = await api.post<AuthResult>('/auth/login', input, { noRefresh: true });
    tokenStore.set(r.accessToken);
    return r;
  },
  async register(input: RegisterInput) {
    const r = await api.post<AuthResult>('/auth/register', input, { noRefresh: true });
    tokenStore.set(r.accessToken);
    return r;
  },
  async logout() {
    try { await api.post<void>('/auth/logout', undefined, { noRefresh: true }); } finally { tokenStore.set(null); }
  },
  me: () => api.get<UserDto>('/auth/me'),
};
