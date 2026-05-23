import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook } from '@testing-library/react'
import { createElement } from 'react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import type { CursorRuntimeConfigApplyResult } from '@hapi/protocol/types'
import type { ApiClient } from '@/api/client'
import { useSessionActions } from './useSessionActions'

function createWrapper() {
    const queryClient = new QueryClient({
        defaultOptions: {
            mutations: { retry: false },
            queries: { retry: false }
        }
    })
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries')

    function Wrapper({ children }: { children: ReactNode }) {
        return createElement(QueryClientProvider, { client: queryClient }, children)
    }

    return { Wrapper, invalidateQueries }
}

function createApi(result: CursorRuntimeConfigApplyResult): ApiClient {
    return {
        setModel: vi.fn(async () => result)
    } as unknown as ApiClient
}

describe('useSessionActions model mutation', () => {
    it.each([
        {
            status: 'applied',
            model: 'cursor-fast',
            modelReasoningEffort: null,
            effort: null
        },
        {
            status: 'applies-next-run',
            model: 'cursor-slow',
            modelReasoningEffort: null,
            effort: null,
            reason: 'unknown'
        },
        {
            status: 'failed',
            model: 'cursor-old',
            modelReasoningEffort: null,
            effort: null,
            reason: 'not-authenticated'
        }
    ] satisfies CursorRuntimeConfigApplyResult[])('propagates $status model apply results unchanged', async (applyResult) => {
        const api = createApi(applyResult)
        const { Wrapper, invalidateQueries } = createWrapper()
        const { result } = renderHook(
            () => useSessionActions(api, 'session-1', 'cursor'),
            { wrapper: Wrapper }
        )

        let returned: CursorRuntimeConfigApplyResult | undefined
        await act(async () => {
            returned = await result.current.setModel(applyResult.model)
        })

        expect(returned).toEqual(applyResult)
        expect(api.setModel).toHaveBeenCalledWith('session-1', applyResult.model)
        expect(invalidateQueries).toHaveBeenCalled()
    })

    it('rejects HTTP failures without synthesizing a model apply result', async () => {
        const error = new Error('HTTP 409 Conflict')
        const api = {
            setModel: vi.fn(async () => {
                throw error
            })
        } as unknown as ApiClient
        const { Wrapper } = createWrapper()
        const { result } = renderHook(
            () => useSessionActions(api, 'session-1', 'cursor'),
            { wrapper: Wrapper }
        )

        await expect(result.current.setModel('cursor-fast')).rejects.toThrow(error)
    })
})
