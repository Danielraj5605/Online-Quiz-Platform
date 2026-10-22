import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryKey, type UseQueryOptions } from '@tanstack/react-query';
import type { PageMeta } from '@quiz/shared';
import type { Paged } from '../api/client';

type Opts<T> = Omit<UseQueryOptions<T, Error, T, QueryKey>, 'queryKey' | 'queryFn'>;

/** Plain query: `useApiQuery(keys.quizzes.detail(id), () => quizzesApi.get(id))`. */
export function useApiQuery<T>(key: QueryKey, fn: (signal: AbortSignal) => Promise<T>, opts: Opts<T> = {}) {
  return useQuery<T, Error, T, QueryKey>({ queryKey: key, queryFn: ({ signal }) => fn(signal), ...opts });
}

/** Paginated list query that keeps the previous page on screen while the next loads. */
export function usePagedQuery<T>(key: QueryKey, fn: () => Promise<Paged<T[]>>, opts: Opts<Paged<T[]>> = {}) {
  return useQuery<Paged<T[]>, Error, Paged<T[]>, QueryKey>({ queryKey: key, queryFn: fn, placeholderData: keepPreviousData, ...opts });
}
export type { PageMeta };

interface MutationOpts<TData, TVars> {
  /** query keys (prefixes) to invalidate on success */
  invalidate?: QueryKey[];
  success?: string;
  silent?: boolean;
  onSuccess?: (data: TData, vars: TVars) => void;
}

/**
 * Mutation with keyed invalidation + toast. For optimistic updates pass `optimistic`:
 *   useApiMutation(fn, { optimistic: { key, update: (old, vars) => newData } })
 */
export function useApiMutation<TData, TVars = void>(
  fn: (vars: TVars) => Promise<TData>,
  opts: MutationOpts<TData, TVars> & { optimistic?: { key: QueryKey; update: (old: unknown, vars: TVars) => unknown } } = {},
) {
  const qc = useQueryClient();
  return useMutation<TData, Error, TVars, { prev?: unknown }>({
    mutationFn: fn,
    meta: { silent: opts.silent, success: opts.success },
    onMutate: async (vars) => {
      if (!opts.optimistic) return {};
      const { key, update } = opts.optimistic;
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData(key);
      qc.setQueryData(key, (old: unknown) => update(old, vars));
      return { prev };
    },
    onError: (_e, _v, ctx) => { if (opts.optimistic && ctx) qc.setQueryData(opts.optimistic.key, ctx.prev); },
    onSettled: () => {
      opts.invalidate?.forEach((k) => void qc.invalidateQueries({ queryKey: k }));
      if (opts.optimistic) void qc.invalidateQueries({ queryKey: opts.optimistic.key });
    },
    onSuccess: (d, v) => opts.onSuccess?.(d, v),
  });
}
