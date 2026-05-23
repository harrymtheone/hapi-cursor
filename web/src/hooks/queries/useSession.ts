import type { ApiClient } from '@/api/client'
import type { Session } from '@/types/api'
import { queryKeys } from '@/lib/query-keys'
import { createApiQuery } from './_factory'

type SessionResponse = Awaited<ReturnType<ApiClient['getSession']>>

const useSessionQuery = createApiQuery<SessionResponse, Session | null, [sessionId: string | null]>({
    queryKey: (sessionId) => queryKeys.session(sessionId ?? 'unknown'),
    queryFn: (api, sessionId) => api.getSession(sessionId ?? ''),
    select: (data) => data?.session ?? null,
    enabled: (api, sessionId) => Boolean(api && sessionId),
    errorMessage: 'Failed to load session',
})

export function useSession(api: ApiClient | null, sessionId: string | null): {
    session: Session | null
    isLoading: boolean
    error: string | null
    refetch: () => Promise<unknown>
} {
    const { data, isLoading, error, refetch } = useSessionQuery(api, sessionId)
    return { session: data, isLoading, error, refetch }
}
