import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import type { Machine, Session, SessionSummary, SyncEvent } from '@hapi/protocol/types'
import { useSSE } from './useSSE'
import { queryKeys } from '@/lib/query-keys'

vi.mock('@/lib/message-window-store', () => ({
    clearMessageWindow: vi.fn(),
    getMessageWindowState: vi.fn(() => ({ messages: [], pending: [] })),
    ingestIncomingMessages: vi.fn(),
    markMessagesConsumed: vi.fn(),
    removeOptimisticMessage: vi.fn(),
    updateMessageStatus: vi.fn(),
}))

class MockEventSource {
    static CONNECTING = 0
    static OPEN = 1
    static CLOSED = 2
    static instances: MockEventSource[] = []

    onmessage: ((event: MessageEvent<string>) => void) | null = null
    onopen: (() => void) | null = null
    onerror: ((error: unknown) => void) | null = null
    readyState = MockEventSource.CONNECTING

    constructor(public url: string) {
        MockEventSource.instances.push(this)
    }

    close() {
        this.readyState = MockEventSource.CLOSED
    }

    dispatch(payload: unknown) {
        this.onmessage?.({ data: JSON.stringify(payload) } as MessageEvent<string>)
    }

    dispatchRaw(data: string) {
        this.onmessage?.({ data } as MessageEvent<string>)
    }

    static reset() {
        MockEventSource.instances = []
    }
}

function createSession(overrides: Partial<Session> = {}): Session {
    return {
        id: 'session-1',
        seq: 1,
        createdAt: 1_000,
        updatedAt: 2_000,
        active: true,
        activeAt: 2_000,
        metadata: {
            path: '/repo',
            host: 'local',
            machineId: 'machine-1',
            name: 'Session One',
        },
        metadataVersion: 1,
        agentState: null,
        agentStateVersion: 1,
        thinking: false,
        thinkingAt: 0,
        backgroundTaskCount: 0,
        model: 'cursor-model',
        modelReasoningEffort: null,
        effort: null,
        permissionMode: 'default',
        ...overrides,
    }
}

function createSummary(overrides: Partial<SessionSummary> = {}): SessionSummary {
    return {
        id: 'session-1',
        active: true,
        thinking: false,
        activeAt: 2_000,
        updatedAt: 2_000,
        metadata: {
            path: '/repo',
            machineId: 'machine-1',
            name: 'Session One',
        },
        todoProgress: null,
        pendingRequestsCount: 0,
        backgroundTaskCount: 0,
        model: 'cursor-model',
        effort: null,
        ...overrides,
    }
}

function createMachine(overrides: Partial<Machine> = {}): Machine {
    return {
        id: 'machine-1',
        seq: 1,
        createdAt: 1_000,
        updatedAt: 2_000,
        active: true,
        activeAt: 2_000,
        metadata: {
            host: 'local',
            platform: 'linux',
            happyCliVersion: '0.18.1',
            homeDir: '/home/me',
            happyHomeDir: '/home/me/.hapi',
            happyLibDir: '/home/me/.hapi/lib',
            workspaceRoots: ['/repo'],
        },
        metadataVersion: 1,
        runnerState: null,
        runnerStateVersion: 1,
        ...overrides,
    }
}

function createHarness() {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: { retry: false },
            mutations: { retry: false },
        },
    })
    const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
    return { queryClient, wrapper }
}

function mountUseSSE(wrapper: ({ children }: { children: ReactNode }) => React.ReactElement) {
    const onEvent = vi.fn()
    renderHook(
        () => useSSE({
            enabled: true,
            token: 't',
            baseUrl: 'http://x',
            subscription: { all: true },
            onEvent,
        }),
        { wrapper },
    )
    return { onEvent }
}

function activeSource(): MockEventSource {
    const source = MockEventSource.instances.at(-1)
    if (!source) {
        throw new Error('expected active MockEventSource')
    }
    return source
}

describe('useSSE handleSyncEvent', () => {
    let originalEventSource: typeof globalThis.EventSource | undefined
    let consoleErrorSpy: ReturnType<typeof vi.spyOn>

    beforeEach(() => {
        originalEventSource = globalThis.EventSource
        MockEventSource.reset()
        globalThis.EventSource = MockEventSource as unknown as typeof EventSource
        consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
        vi.clearAllMocks()
    })

    afterEach(() => {
        if (originalEventSource) {
            globalThis.EventSource = originalEventSource
        } else {
            delete (globalThis as { EventSource?: typeof EventSource }).EventSource
        }
        consoleErrorSpy.mockRestore()
    })

    it('full session-added updates detail cache and upserts summary', async () => {
        const { queryClient, wrapper } = createHarness()
        queryClient.setQueryData(queryKeys.sessions, { sessions: [] })
        mountUseSSE(wrapper)

        const session = createSession()
        act(() => {
            activeSource().dispatch({ type: 'session-added', sessionId: session.id, data: session } satisfies SyncEvent)
        })

        await waitFor(() => {
            expect(queryClient.getQueryData(queryKeys.session(session.id))).toEqual({ session })
            expect(queryClient.getQueryData<{ sessions: SessionSummary[] }>(queryKeys.sessions)?.sessions[0]?.id).toBe(session.id)
        })
    })

    it('session-updated patch with only backgroundTaskCount mutates summary without invalidate (Phase 7 REFA-04 regression guard)', async () => {
        const { queryClient, wrapper } = createHarness()
        queryClient.setQueryData(queryKeys.sessions, { sessions: [createSummary()] })
        queryClient.setQueryData(queryKeys.session('session-1'), { session: createSession() })
        const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
        mountUseSSE(wrapper)

        act(() => {
            activeSource().dispatch({
                type: 'session-updated',
                sessionId: 'session-1',
                data: { backgroundTaskCount: 3 },
            } satisfies SyncEvent)
        })

        await waitFor(() => {
            const summary = queryClient.getQueryData<{ sessions: SessionSummary[] }>(queryKeys.sessions)?.sessions[0]
            const detail = queryClient.getQueryData<{ session: Session }>(queryKeys.session('session-1'))?.session
            expect(summary?.backgroundTaskCount).toBe(3)
            expect(detail?.backgroundTaskCount).toBe(3)
            expect(invalidateSpy).not.toHaveBeenCalled()
        })
    })

    it('session-updated with each other patch field mutates summary or detail correctly', async () => {
        const cases: Array<[string, SyncEvent & { type: 'session-updated' }, (queryClient: QueryClient) => void]> = [
            ['active', { type: 'session-updated', sessionId: 'session-1', data: { active: false } }, (queryClient) => {
                expect(queryClient.getQueryData<{ sessions: SessionSummary[] }>(queryKeys.sessions)?.sessions[0]?.active).toBe(false)
            }],
            ['activeAt', { type: 'session-updated', sessionId: 'session-1', data: { activeAt: 3_000 } }, (queryClient) => {
                expect(queryClient.getQueryData<{ sessions: SessionSummary[] }>(queryKeys.sessions)?.sessions[0]?.activeAt).toBe(3_000)
            }],
            ['thinking', { type: 'session-updated', sessionId: 'session-1', data: { thinking: true } }, (queryClient) => {
                expect(queryClient.getQueryData<{ sessions: SessionSummary[] }>(queryKeys.sessions)?.sessions[0]?.thinking).toBe(true)
            }],
            ['updatedAt', { type: 'session-updated', sessionId: 'session-1', data: { updatedAt: 4_000 } }, (queryClient) => {
                expect(queryClient.getQueryData<{ sessions: SessionSummary[] }>(queryKeys.sessions)?.sessions[0]?.updatedAt).toBe(4_000)
            }],
            ['permissionMode', { type: 'session-updated', sessionId: 'session-1', data: { permissionMode: 'ask' } }, (queryClient) => {
                expect(queryClient.getQueryData<{ session: Session }>(queryKeys.session('session-1'))?.session.permissionMode).toBe('ask')
            }],
            ['model', { type: 'session-updated', sessionId: 'session-1', data: { model: 'model-2' } }, (queryClient) => {
                expect(queryClient.getQueryData<{ sessions: SessionSummary[] }>(queryKeys.sessions)?.sessions[0]?.model).toBe('model-2')
            }],
            ['modelReasoningEffort', { type: 'session-updated', sessionId: 'session-1', data: { modelReasoningEffort: 'high' } }, (queryClient) => {
                expect(queryClient.getQueryData<{ session: Session }>(queryKeys.session('session-1'))?.session.modelReasoningEffort).toBe('high')
            }],
            ['effort', { type: 'session-updated', sessionId: 'session-1', data: { effort: 'medium' } }, (queryClient) => {
                expect(queryClient.getQueryData<{ sessions: SessionSummary[] }>(queryKeys.sessions)?.sessions[0]?.effort).toBe('medium')
            }],
        ]

        for (const [field, event, assertCase] of cases) {
            const { queryClient, wrapper } = createHarness()
            queryClient.setQueryData(queryKeys.sessions, { sessions: [createSummary()] })
            queryClient.setQueryData(queryKeys.session('session-1'), { session: createSession() })
            mountUseSSE(wrapper)

            act(() => {
                activeSource().dispatch(event)
            })

            await waitFor(() => {
                assertCase(queryClient)
            }, { timeout: 1_000 })

            expect(field).toBeTruthy()
        }
    })

    it('session-updated with full Session payload upserts both summary and detail', async () => {
        const { queryClient, wrapper } = createHarness()
        queryClient.setQueryData(queryKeys.sessions, { sessions: [createSummary()] })
        mountUseSSE(wrapper)
        const session = createSession({ updatedAt: 9_000, thinking: true })

        act(() => {
            activeSource().dispatch({ type: 'session-updated', sessionId: session.id, data: session } satisfies SyncEvent)
        })

        await waitFor(() => {
            expect(queryClient.getQueryData(queryKeys.session(session.id))).toEqual({ session })
            expect(queryClient.getQueryData<{ sessions: SessionSummary[] }>(queryKeys.sessions)?.sessions[0]?.thinking).toBe(true)
        })
    })

    it('full machine-updated upserts machine cache', async () => {
        const { queryClient, wrapper } = createHarness()
        queryClient.setQueryData(queryKeys.machines, { machines: [] })
        mountUseSSE(wrapper)
        const machine = createMachine()

        act(() => {
            activeSource().dispatch({ type: 'machine-updated', machineId: machine.id, data: machine } satisfies SyncEvent)
        })

        await waitFor(() => {
            expect(queryClient.getQueryData<{ machines: Machine[] }>(queryKeys.machines)?.machines[0]).toEqual(machine)
        })
    })

    it('machine-updated with inactive patch removes machine cache entry', async () => {
        const { queryClient, wrapper } = createHarness()
        queryClient.setQueryData(queryKeys.machines, { machines: [createMachine()] })
        mountUseSSE(wrapper)

        act(() => {
            activeSource().dispatch({ type: 'machine-updated', machineId: 'machine-1', data: { active: false } } satisfies SyncEvent)
        })

        await waitFor(() => {
            expect(queryClient.getQueryData<{ machines: Machine[] }>(queryKeys.machines)?.machines).toEqual([])
        })
    })

    it('machine-updated with data:null removes machine cache entry', async () => {
        const { queryClient, wrapper } = createHarness()
        queryClient.setQueryData(queryKeys.machines, { machines: [createMachine()] })
        mountUseSSE(wrapper)

        act(() => {
            activeSource().dispatch({ type: 'machine-updated', machineId: 'machine-1', data: null } satisfies SyncEvent)
        })

        await waitFor(() => {
            expect(queryClient.getQueryData<{ machines: Machine[] }>(queryKeys.machines)?.machines).toEqual([])
        })
    })

    it('malformed event with unknown type logs, preserves cache, and does not invalidate', async () => {
        const { queryClient, wrapper } = createHarness()
        const seeded = { sessions: [createSummary()] }
        queryClient.setQueryData(queryKeys.sessions, seeded)
        const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
        mountUseSSE(wrapper)

        act(() => {
            activeSource().dispatch({ type: 'invented-event', sessionId: 'x' })
        })

        await waitFor(() => {
            expect(consoleErrorSpy).toHaveBeenCalled()
            expect(queryClient.getQueryData(queryKeys.sessions)).toEqual(seeded)
            expect(invalidateSpy).not.toHaveBeenCalled()
        })
    })

    it('malformed session-updated patch with unknown field logs and does not mutate', async () => {
        const { queryClient, wrapper } = createHarness()
        const seeded = { sessions: [createSummary()] }
        queryClient.setQueryData(queryKeys.sessions, seeded)
        const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
        mountUseSSE(wrapper)

        act(() => {
            activeSource().dispatch({ type: 'session-updated', sessionId: 'session-1', data: { unknownField: 1 } })
        })

        await waitFor(() => {
            expect(consoleErrorSpy).toHaveBeenCalled()
            expect(queryClient.getQueryData(queryKeys.sessions)).toEqual(seeded)
            expect(invalidateSpy).not.toHaveBeenCalled()
        })
    })

    it('JSON.parse failure returns silently without malformed-event log or cache mutation', async () => {
        const { queryClient, wrapper } = createHarness()
        const seeded = { sessions: [createSummary()] }
        queryClient.setQueryData(queryKeys.sessions, seeded)
        mountUseSSE(wrapper)

        act(() => {
            activeSource().dispatchRaw('{')
        })

        await waitFor(() => {
            expect(queryClient.getQueryData(queryKeys.sessions)).toEqual(seeded)
        })
        expect(consoleErrorSpy).not.toHaveBeenCalledWith(
            expect.stringContaining('dropped malformed event'),
            expect.anything(),
        )
    })
})
