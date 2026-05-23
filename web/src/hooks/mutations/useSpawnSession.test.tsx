import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import type { ApiClient } from '@/api/client'
import { I18nProvider } from '@/lib/i18n-context'
import { useSpawnSession } from './useSpawnSession'

function createWrapper() {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
    })

    return function Wrapper({ children }: { children: ReactNode }) {
        return (
            <QueryClientProvider client={queryClient}>
                <I18nProvider>{children}</I18nProvider>
            </QueryClientProvider>
        )
    }
}

describe('useSpawnSession', () => {
    it('maps selected runtime config rejection to localized launch copy', async () => {
        const spawnSession = vi.fn(async () => ({
            type: 'error' as const,
            message: 'raw selected model failure',
            code: 'selected-runtime-config-rejected' as const
        }))
        const api = { spawnSession } as unknown as ApiClient
        const { result } = renderHook(() => useSpawnSession(api), { wrapper: createWrapper() })

        const response = await result.current.spawnSession({
            machineId: 'machine-1',
            directory: '/repo',
            agent: 'cursor',
            model: 'cursor-fast'
        })

        expect(response).toEqual({
            type: 'error',
            message: 'Cursor rejected the selected runtime config. Choose another model or continue with auto.',
            code: 'selected-runtime-config-rejected'
        })
    })

    it('keeps generic spawn errors generic', async () => {
        const spawnSession = vi.fn(async () => ({
            type: 'error' as const,
            message: 'Machine is offline'
        }))
        const api = { spawnSession } as unknown as ApiClient
        const { result } = renderHook(() => useSpawnSession(api), { wrapper: createWrapper() })

        const response = await result.current.spawnSession({
            machineId: 'machine-1',
            directory: '/repo',
            agent: 'cursor'
        })

        expect(response).toEqual({
            type: 'error',
            message: 'Machine is offline'
        })
    })
})
