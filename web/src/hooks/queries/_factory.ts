import { useQuery, type UseQueryOptions } from '@tanstack/react-query'
import type { ApiClient } from '@/api/client'

/**
 * Spec for creating a shape-A query hook (api → fetch → select → unwrap).
 *
 * Shape-A hooks share: a queryKey derivation, a single-call api fetcher that
 * needs an `ApiClient`, a synchronous select that pulls one field off the raw
 * response, an enabled-guard that requires the api (plus optional extra args),
 * and the canonical `{ data, isLoading, error, refetch }` return contract.
 */
export interface ApiQuerySpec<TRaw, TResult, TArgs extends unknown[]> {
    queryKey: (...args: TArgs) => readonly unknown[]
    queryFn: (api: ApiClient, ...args: TArgs) => Promise<TRaw>
    select: (data: TRaw | undefined) => TResult
    enabled?: (api: ApiClient | null, ...args: TArgs) => boolean
    errorMessage: string
    queryOptions?: Partial<UseQueryOptions<TRaw, Error>>
}

/**
 * Builds a shape-A `useQuery` hook from a spec. The returned hook preserves
 * the canonical contract used by `useSessions`/`useSession`/`useMachines` so
 * downstream callers do not change.
 */
export function createApiQuery<TRaw, TResult, TArgs extends unknown[] = []>(
    spec: ApiQuerySpec<TRaw, TResult, TArgs>
): (api: ApiClient | null, ...args: TArgs) => {
    data: TResult
    isLoading: boolean
    error: string | null
    refetch: () => Promise<unknown>
} {
    return (api: ApiClient | null, ...args: TArgs) => {
        const enabled = spec.enabled
            ? spec.enabled(api, ...args)
            : Boolean(api)

        const query = useQuery<TRaw, Error>({
            queryKey: spec.queryKey(...args),
            queryFn: async () => {
                if (!api) {
                    throw new Error('API unavailable')
                }
                return await spec.queryFn(api, ...args)
            },
            enabled,
            ...(spec.queryOptions ?? {}),
        })

        return {
            data: spec.select(query.data),
            isLoading: query.isLoading,
            error: query.error instanceof Error
                ? query.error.message
                : query.error ? spec.errorMessage : null,
            refetch: query.refetch,
        }
    }
}
