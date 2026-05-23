import type { ApiClient } from '@/api/client'
import type { SessionSummary } from '@/types/api'
import { queryKeys } from '@/lib/query-keys'
import { createApiQuery } from './_factory'

type SessionsResponse = Awaited<ReturnType<ApiClient['getSessions']>>

const useSessionsQuery = createApiQuery<SessionsResponse, SessionSummary[], []>({
    queryKey: () => queryKeys.sessions,
    queryFn: (api) => api.getSessions(),
    select: (data) => data?.sessions ?? [],
    errorMessage: 'Failed to load sessions',
})

export function useSessions(api: ApiClient | null): {
    sessions: SessionSummary[]
    isLoading: boolean
    error: string | null
    refetch: () => Promise<unknown>
} {
    const { data, isLoading, error, refetch } = useSessionsQuery(api)
    return { sessions: data, isLoading, error, refetch }
}
