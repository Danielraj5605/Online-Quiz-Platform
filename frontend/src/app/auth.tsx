import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { LoginInput, RegisterInput, Role, UserDto } from '@quiz/shared';
import { authApi } from '@/lib/api/auth';
import { refreshSession, setSessionListener, tokenStore } from '@/lib/api/client';

interface AuthCtx {
  user: UserDto | null;
  /** true until the first refresh attempt on page load has settled */
  loading: boolean;
  login: (i: LoginInput) => Promise<UserDto>;
  register: (i: RegisterInput) => Promise<UserDto>;
  logout: () => Promise<void>;
  setUser: (u: UserDto) => void;
  hasRole: (...roles: Role[]) => boolean;
}
const Ctx = createContext<AuthCtx | null>(null);

export const homeFor = (role: Role | undefined) => (role === 'ADMIN' ? '/admin' : role === 'ORGANIZER' ? '/studio' : '/');

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [user, setUser] = useState<UserDto | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // The API client tells us when the session is refreshed or dies (e.g. refresh cookie expired mid-session).
    setSessionListener((r) => { setUser(r?.user ?? null); if (!r) qc.clear(); });
    let alive = true;
    refreshSession().finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [qc]);

  const login = useCallback(async (i: LoginInput) => { const r = await authApi.login(i); qc.clear(); setUser(r.user); return r.user; }, [qc]);
  const register = useCallback(async (i: RegisterInput) => { const r = await authApi.register(i); qc.clear(); setUser(r.user); return r.user; }, [qc]);
  const logout = useCallback(async () => {
    try { await authApi.logout(); } finally { tokenStore.set(null); setUser(null); qc.clear(); }
  }, [qc]);
  const hasRole = useCallback((...roles: Role[]) => !!user && roles.includes(user.role), [user]);

  const value = useMemo(() => ({ user, loading, login, register, logout, setUser, hasRole }), [user, loading, login, register, logout, hasRole]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

 
export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAuth must be used inside AuthProvider');
  return c;
}
