import type { ApiClient } from '@/api/client'
import type { Machine } from '@/types/api'
import { queryKeys } from '@/lib/query-keys'
import { createApiQuery } from './_factory'

type MachinesResponse = Awaited<ReturnType<ApiClient['getMachines']>>

const useMachinesQuery = createApiQuery<MachinesResponse, Machine[], [enabled: boolean]>({
    queryKey: () => queryKeys.machines,
    queryFn: (api) => api.getMachines(),
    select: (data) => data?.machines ?? [],
    enabled: (api, enabled) => Boolean(api && enabled),
    errorMessage: 'Failed to load machines',
})

export function useMachines(api: ApiClient | null, enabled: boolean): {
    machines: Machine[]
    isLoading: boolean
    error: string | null
    refetch: () => Promise<unknown>
} {
    const { data, isLoading, error, refetch } = useMachinesQuery(api, enabled)
    return { machines: data, isLoading, error, refetch }
}
