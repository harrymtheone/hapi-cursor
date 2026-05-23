import { useCallback, useEffect, useState } from 'react'
import type { ApiClient } from '@/api/client'
import type { CursorModelDiscoveryResult } from '@hapi/protocol/types'

const CURSOR_MODELS_CACHE_TTL_MS = 30000

type CacheEntry = {
    result: CursorModelDiscoveryResult
    fetchedAt: number
}

const modelDiscoveryCache = new Map<string, CacheEntry>()

function getCachedDiscovery(machineId: string): CacheEntry | null {
    const cached = modelDiscoveryCache.get(machineId)
    if (!cached) {
        return null
    }
    if (Date.now() - cached.fetchedAt > CURSOR_MODELS_CACHE_TTL_MS) {
        modelDiscoveryCache.delete(machineId)
        return null
    }
    return cached
}

export function useCursorModels(
    api: ApiClient,
    machineId: string | null,
    enabled: boolean
): {
    result: CursorModelDiscoveryResult | null
    isLoading: boolean
    error: Error | null
    retry: () => Promise<void>
    lastFetchedAt: number | null
} {
    const [result, setResult] = useState<CursorModelDiscoveryResult | null>(null)
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<Error | null>(null)
    const [lastFetchedAt, setLastFetchedAt] = useState<number | null>(null)

    const loadModels = useCallback(async (
        bypassCache: boolean,
        isCancelled: () => boolean = () => false
    ) => {
        if (!enabled || !machineId) {
            setResult(null)
            setIsLoading(false)
            setError(null)
            setLastFetchedAt(null)
            return
        }

        if (!bypassCache) {
            const cached = getCachedDiscovery(machineId)
            if (cached) {
                setResult(cached.result)
                setIsLoading(false)
                setError(null)
                setLastFetchedAt(cached.fetchedAt)
                return
            }
        }

        setIsLoading(true)
        setError(null)
        try {
            const nextResult = await api.getCursorModels(machineId)
            if (isCancelled()) {
                return
            }
            const fetchedAt = Date.now()
            modelDiscoveryCache.set(machineId, { result: nextResult, fetchedAt })
            setResult(nextResult)
            setLastFetchedAt(fetchedAt)
            setError(null)
        } catch {
            if (isCancelled()) {
                return
            }
            setResult(null)
            setLastFetchedAt(null)
            setError(new Error('Failed to discover Cursor models'))
        } finally {
            if (!isCancelled()) {
                setIsLoading(false)
            }
        }
    }, [api, enabled, machineId])

    useEffect(() => {
        let cancelled = false
        void loadModels(false, () => cancelled)
        return () => {
            cancelled = true
        }
    }, [loadModels])

    const retry = useCallback(async () => {
        await loadModels(true)
    }, [loadModels])

    return {
        result,
        isLoading,
        error,
        retry,
        lastFetchedAt
    }
}
