import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ApiError } from '../api/client';

export function messageOf(e: unknown) {
  if (e instanceof ApiError) return e.message;
  if (e instanceof Error) return e.message;
  return 'Something went wrong';
}

/** 401s are handled by the API client (refresh → retry → session listener); everything else is toasted once. */
export function handleGlobalError(e: unknown) {
  if (e instanceof ApiError) {
    if (e.status === 401) return;
    if (e.status === 403) return void toast.error('You do not have permission to do that');
    if (e.status === 0) return void toast.error(e.message, { id: 'network' });
  }
  toast.error(messageOf(e));
}

declare module '@tanstack/react-query' {
  interface Register {
    mutationMeta: { silent?: boolean; success?: string };
    queryMeta: { silent?: boolean };
  }
}

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (e, q) => { if (!q.meta?.silent && q.state.data === undefined) handleGlobalError(e); },
  }),
  mutationCache: new MutationCache({
    onError: (e, _v, _c, m) => { if (!m.meta?.silent) handleGlobalError(e); },
    onSuccess: (_d, _v, _c, m) => { if (m.meta?.success) toast.success(m.meta.success); },
  }),
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: true,
      retry: (count, e) => !(e instanceof ApiError && e.status >= 400 && e.status < 500) && count < 2,
    },
    mutations: { retry: false },
  },
});
