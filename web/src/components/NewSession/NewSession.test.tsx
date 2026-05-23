import type { CursorModelDiscoveryResult, Machine, SpawnResponse } from '@hapi/protocol/types'
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
            happyLibDir: '/home/harry/.hapi/lib'
        }
    }
}

function createApi(args: {
    discoveryResult?: CursorModelDiscoveryResult
    spawnResult?: SpawnResponse
}) {
    const discoveryResult = args.discoveryResult ?? {
        status: 'ok' as const,
        models: [{ id: 'cursor-fast', label: 'Fast lane' }],
        discoveredAt: 1_000
    }
    const spawnResult = args.spawnResult ?? { type: 'success' as const, sessionId: 'session-1' }
    const api = {
        getSessions: vi.fn(async () => ({ sessions: [] })),
        checkMachinePathsExists: vi.fn(async () => ({ exists: { '/repo': true } })),
        getCursorModels: vi.fn(async () => discoveryResult),
        spawnSession: vi.fn(async () => spawnResult)
    } as unknown as ApiClient
    return {
        api,
        getCursorModels: api.getCursorModels as unknown as ReturnType<typeof vi.fn>,
        spawnSession: api.spawnSession as unknown as ReturnType<typeof vi.fn>
    }
}

function renderNewSession(api: ApiClient, machineId: string) {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
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

describe('NewSession runtime model discovery', () => {
    afterEach(() => cleanup())

    it('discovers models for the selected machine and sends undefined for auto launch', async () => {
        const { api, getCursorModels, spawnSession } = createApi({})
        renderNewSession(api, 'machine-auto')

        await waitFor(() => {
            expect(getCursorModels).toHaveBeenCalledWith('machine-auto')
        })
        expect(screen.getByRole('option', { name: 'cursor-fast - Fast lane' })).toHaveValue('cursor-fast')

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
            undefined,
            undefined
        )
    })

    it('sends the selected raw Cursor model id on explicit launch', async () => {
        const { api, spawnSession } = createApi({})
        renderNewSession(api, 'machine-explicit')

        const modelSelect = await screen.findByLabelText(/Model/)
        await waitFor(() => {
            expect(screen.getByRole('option', { name: 'cursor-fast - Fast lane' })).toBeInTheDocument()
        })
        fireEvent.change(modelSelect, { target: { value: 'cursor-fast' } })
        fireEvent.click(screen.getByRole('button', { name: 'Create' }))

        await waitFor(() => {
            expect(spawnSession).toHaveBeenCalled()
        })
        expect(spawnSession).toHaveBeenCalledWith(
            'machine-explicit',
            '/repo',
            'cursor',
            'cursor-fast',
            false,
            'simple',
            undefined,
            undefined
        )
    })
})
