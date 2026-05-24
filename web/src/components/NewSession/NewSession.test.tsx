import type { Machine, SpawnResponse } from '@hapi/protocol/types'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ApiClient } from '@/api/client'
import { I18nProvider } from '@/lib/i18n-context'
import { NewSession } from './index'

function createMachine(id: string): Machine {
    return {
        id,
        seq: 1,
        createdAt: 1,
        updatedAt: 1,
        active: true,
        activeAt: 1,
        metadataVersion: 1,
        runnerStateVersion: 1,
        runnerState: { status: 'running' },
        metadata: {
            host: 'devbox',
            platform: 'linux',
            happyCliVersion: '1.0.0',
            displayName: 'Devbox',
            homeDir: '/home/harry',
            happyHomeDir: '/home/harry/.hapi',
            happyLibDir: '/home/harry/.hapi/lib',
            workspaceRoots: undefined,
        },
    }
}

function createApi(spawnResult?: SpawnResponse) {
    const result = spawnResult ?? { type: 'success' as const, sessionId: 'session-1' }
    const api = {
        getSessions: vi.fn(async () => ({ sessions: [] })),
        checkMachinePathsExists: vi.fn(async () => ({ exists: { '/repo': true } })),
        getCursorModels: vi.fn(async () => {
            throw new Error('NewSession must not call getCursorModels')
        }),
        spawnSession: vi.fn(async () => result),
    } as unknown as ApiClient
    return {
        api,
        getCursorModels: api.getCursorModels as unknown as ReturnType<typeof vi.fn>,
        spawnSession: api.spawnSession as unknown as ReturnType<typeof vi.fn>,
    }
}

function renderNewSession(api: ApiClient, machineId: string) {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    })

    return render(
        <QueryClientProvider client={queryClient}>
            <I18nProvider>
                <NewSession
                    api={api}
                    machines={[createMachine(machineId)]}
                    initialMachineId={machineId}
                    initialDirectory="/repo"
                    onSuccess={vi.fn()}
                    onCancel={vi.fn()}
                />
            </I18nProvider>
        </QueryClientProvider>
    )
}

describe('NewSession Auto-only launch', () => {
    afterEach(() => cleanup())

    it('does not render a model selector or discover models on mount', async () => {
        const { getCursorModels } = createApi()
        renderNewSession(createApi().api, 'machine-auto')

        expect(screen.queryByLabelText(/Model/)).not.toBeInTheDocument()
        await waitFor(() => {
            expect(getCursorModels).not.toHaveBeenCalled()
        })
    })

    it('spawns without a model field (Auto)', async () => {
        const { api, spawnSession } = createApi()
        renderNewSession(api, 'machine-auto')

        fireEvent.click(screen.getByRole('button', { name: 'Create' }))

        await waitFor(() => {
            expect(spawnSession).toHaveBeenCalled()
        })
        expect(spawnSession).toHaveBeenCalledWith(
            'machine-auto',
            '/repo',
            'cursor',
            undefined,
            false,
            'simple',
            undefined
        )
    })
})
