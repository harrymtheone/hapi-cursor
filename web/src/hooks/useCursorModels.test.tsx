import type { CursorModelDiscoveryResult } from '@hapi/protocol/types'
import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ApiClient } from '@/api/client'
import { useCursorModels } from './useCursorModels'

function createApi(results: Array<CursorModelDiscoveryResult | Error>) {
    const getCursorModels = vi.fn(async () => {
        const next = results.shift()
        if (next instanceof Error) {
            throw next
        }
        return next ?? {
            status: 'ok',
            models: [{ id: 'fallback-model' }],
            discoveredAt: Date.now()
        }
    })
    return { api: { getCursorModels } as unknown as ApiClient, getCursorModels }
}

describe('useCursorModels', () => {
    let now = 1_000

    beforeEach(() => {
        now = 1_000
        vi.spyOn(Date, 'now').mockImplementation(() => now)
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('uses cached discovery results without a second API call', async () => {
        const discovered: CursorModelDiscoveryResult = {
            status: 'ok',
            models: [{ id: 'cursor-fast', label: 'Cursor Fast' }],
            discoveredAt: 1_000
        }
        const { api, getCursorModels } = createApi([discovered])

        const first = renderHook(() => useCursorModels(api, 'machine-cache', true))
        await waitFor(() => {
            expect(first.result.current.result).toEqual(discovered)
        })
        first.unmount()

        const second = renderHook(() => useCursorModels(api, 'machine-cache', true))
        await waitFor(() => {
            expect(second.result.current.result).toEqual(discovered)
        })

        expect(getCursorModels).toHaveBeenCalledTimes(1)
    })

    it('retry bypasses the cache for the current machine', async () => {
        const firstResult: CursorModelDiscoveryResult = {
            status: 'ok',
            models: [{ id: 'cursor-fast' }],
            discoveredAt: 1_000
        }
        const secondResult: CursorModelDiscoveryResult = {
            status: 'ok',
            models: [{ id: 'cursor-slow' }],
            discoveredAt: 2_000
        }
        const { api, getCursorModels } = createApi([firstResult, secondResult])
        const { result } = renderHook(() => useCursorModels(api, 'machine-retry', true))

        await waitFor(() => {
            expect(result.current.result).toEqual(firstResult)
        })

        now = 2_000
        await act(async () => {
            await result.current.retry()
        })

        await waitFor(() => {
            expect(result.current.result).toEqual(secondResult)
        })
        expect(getCursorModels).toHaveBeenCalledTimes(2)
    })

    it('does not call the API when disabled and clears transient loading state', () => {
        const { api, getCursorModels } = createApi([])
        const { result } = renderHook(() => useCursorModels(api, 'machine-disabled', false))

        expect(result.current.result).toBeNull()
        expect(result.current.isLoading).toBe(false)
        expect(result.current.error).toBeNull()
        expect(result.current.lastFetchedAt).toBeNull()
        expect(getCursorModels).not.toHaveBeenCalled()
    })

    it('treats safe discovery error results as data, not hook errors', async () => {
        const safeError: CursorModelDiscoveryResult = {
            status: 'error',
            reason: 'not-authenticated',
            discoveredAt: 1_000
        }
        const { api } = createApi([safeError])
        const { result } = renderHook(() => useCursorModels(api, 'machine-safe-error', true))

        await waitFor(() => {
            expect(result.current.result).toEqual(safeError)
        })
        expect(result.current.error).toBeNull()
    })

    it('sanitizes rejected API errors instead of exposing raw response text', async () => {
        const { api } = createApi([new Error('HTTP 502 Bad Gateway: raw stderr secret')])
        const { result } = renderHook(() => useCursorModels(api, 'machine-reject', true))

        await waitFor(() => {
            expect(result.current.error?.message).toBe('Failed to discover Cursor models')
        })
        expect(result.current.error?.message).not.toContain('raw stderr secret')
        expect(result.current.result).toBeNull()
        expect(result.current.isLoading).toBe(false)
    })
})
