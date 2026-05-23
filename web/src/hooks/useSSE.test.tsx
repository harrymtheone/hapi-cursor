import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import type { Machine, Session, SessionSummary, SyncEvent } from '@hapi/protocol/types'
import {
    useSSE,
    RECONNECT_BASE_DELAY_MS,
    RECONNECT_JITTER_MS,
    RECONNECT_MAX_DELAY_MS,
} from './useSSE'
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

    emitOpen() {
        this.readyState = MockEventSource.OPEN
        this.onopen?.()
    }

    emitError() {
        this.readyState = MockEventSource.CLOSED
        this.onerror?.(new Event('error'))
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
        statusKind: 'running',
        completionMarker: null,
        errorMarker: null,
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

/**
 * REFT-02 — SSE reconnect / patch-loss convergence.
 *
 * Pins (per Phase 11 CONTEXT.md):
 *   D-180  test seam: globalThis.EventSource monkey-patch (kept).
 *   D-181  assert FINAL TanStack Query cache state — never intermediate patch shape.
 *   D-182  fake timers drive backoff windows.
 *   D-183  Phase-7 safety: no assertions on setQueryData arg shape or the
 *          deleted patch-shape heuristic; only on getQueryData() equality.
 *   D-190  the only production change permitted in Phase 11 is exporting the
 *          five backoff constants in useSSE.ts (already done in Plan 11-04 Task 1).
 *
 * Orchestrator override 2026-05-23: useSSE.ts has no max-retry budget constant
 * (RESEARCH § M2 ground-truth correction); the dropped "retry budget exhausted"
 * case is replaced by a bounded-window assertion driven off the SUT's own
 * RECONNECT_BASE_DELAY_MS + RECONNECT_JITTER_MS export.
 */
describe('useSSE reconnect convergence (REFT-02)', () => {
    let originalEventSource: typeof globalThis.EventSource | undefined
    let consoleErrorSpy: ReturnType<typeof vi.spyOn>

    beforeEach(() => {
        vi.useFakeTimers()
        originalEventSource = globalThis.EventSource
        MockEventSource.reset()
        globalThis.EventSource = MockEventSource as unknown as typeof EventSource
        consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    })

    afterEach(() => {
        if (originalEventSource) {
            globalThis.EventSource = originalEventSource
        } else {
            delete (globalThis as { EventSource?: typeof EventSource }).EventSource
        }
        consoleErrorSpy.mockRestore()
        vi.useRealTimers()
    })

    it('reconnects within bounded backoff after onerror + readyState=CLOSED', async () => {
        const { wrapper } = createHarness()
        mountUseSSE(wrapper)

        expect(MockEventSource.instances.length).toBe(1)
        const firstInstance = activeSource()

        await act(async () => {
            firstInstance.emitOpen()
        })

        await act(async () => {
            firstInstance.emitError()
        })

        // Sanity: error alone does not synchronously construct a new instance —
        // reconnect goes through scheduleReconnect's setTimeout(base + jitter).
        expect(MockEventSource.instances.length).toBe(1)

        // attempt = 0 → delay = min(MAX, BASE * 2^0) + jitter ∈ [BASE, BASE + JITTER].
        // Advancing by BASE + JITTER + 1ms covers the entire bounded window for
        // the first reconnect attempt regardless of jitter draw.
        await act(async () => {
            await vi.advanceTimersByTimeAsync(RECONNECT_BASE_DELAY_MS + RECONNECT_JITTER_MS + 1)
        })

        expect(MockEventSource.instances.length).toBe(2)
        expect(activeSource()).not.toBe(firstInstance)

        // Bounded budget pin: the second instance was constructed strictly inside
        // [BASE, BASE + JITTER] — which is by construction ≤ RECONNECT_MAX_DELAY_MS.
        expect(RECONNECT_BASE_DELAY_MS + RECONNECT_JITTER_MS).toBeLessThanOrEqual(RECONNECT_MAX_DELAY_MS)
    })

    it('cache converges to authoritative snapshot after dropped intermediate events + reconnect', async () => {
        const { queryClient, wrapper } = createHarness()

        const summaryA = createSummary({ id: 'session-A', updatedAt: 2_000, activeAt: 2_000 })
        queryClient.setQueryData(queryKeys.sessions, { sessions: [summaryA] })

        mountUseSSE(wrapper)

        const firstInstance = activeSource()
        await act(async () => {
            firstInstance.emitOpen()
        })

        // Step 2: dispatch session-added for B on instance 1 → cache holds [A, B].
        const sessionB = createSession({ id: 'session-B', updatedAt: 3_000, activeAt: 3_000 })
        await act(async () => {
            firstInstance.dispatch({
                type: 'session-added',
                sessionId: sessionB.id,
                data: sessionB,
            } satisfies SyncEvent)
        })

        const afterAddIds = queryClient
            .getQueryData<{ sessions: SessionSummary[] }>(queryKeys.sessions)
            ?.sessions.map((s) => s.id)
            .sort()
        expect(afterAddIds).toEqual(['session-A', 'session-B'])

        // Step 3: error → backoff → second instance opens.  Between steps 3 and 5,
        // the simulated server-side events that *would* have flowed to the closed
        // instance are intentionally NEVER dispatched — modelling dropped patches.
        await act(async () => {
            firstInstance.emitError()
        })
        await act(async () => {
            await vi.advanceTimersByTimeAsync(RECONNECT_BASE_DELAY_MS + RECONNECT_JITTER_MS + 1)
        })

        expect(MockEventSource.instances.length).toBe(2)
        const secondInstance = activeSource()
        expect(secondInstance).not.toBe(firstInstance)

        await act(async () => {
            secondInstance.emitOpen()
        })

        // Step 5: authoritative reconciliation event on the new instance.
        // Single session-updated patch on A with updatedAt=9999 is sufficient to
        // prove cache convergence (D-183 — no patch-shape assertion needed).
        await act(async () => {
            secondInstance.dispatch({
                type: 'session-updated',
                sessionId: 'session-A',
                data: { updatedAt: 9_999 },
            } satisfies SyncEvent)
        })

        // Step 6: assert FINAL cache state (D-181 / D-183 — never intermediate
        // patch shape, never setQueryData spy args).
        const finalCache = queryClient.getQueryData<{ sessions: SessionSummary[] }>(queryKeys.sessions)
        expect(finalCache).toBeDefined()
        const final = finalCache!.sessions
        // sortSessionSummaries: both active, same pendingRequestsCount (0), so
        // ordered by updatedAt DESC → A (9999) before B (3000).
        expect(final.map((s) => s.id)).toEqual(['session-A', 'session-B'])
        expect(final[0]?.updatedAt).toBe(9_999)
        expect(final[1]?.updatedAt).toBe(3_000)
    })

    it('normal reconnect: error → backoff → open does not break subsequent event handling', async () => {
        const { queryClient, wrapper } = createHarness()
        queryClient.setQueryData(queryKeys.sessions, { sessions: [] })

        mountUseSSE(wrapper)

        const firstInstance = activeSource()
        await act(async () => {
            firstInstance.emitOpen()
        })

        await act(async () => {
            firstInstance.emitError()
        })
        await act(async () => {
            await vi.advanceTimersByTimeAsync(RECONNECT_BASE_DELAY_MS + RECONNECT_JITTER_MS + 1)
        })

        const secondInstance = activeSource()
        await act(async () => {
            secondInstance.emitOpen()
        })

        const sessionC = createSession({ id: 'session-C', updatedAt: 5_000, activeAt: 5_000 })
        await act(async () => {
            secondInstance.dispatch({
                type: 'session-added',
                sessionId: sessionC.id,
                data: sessionC,
            } satisfies SyncEvent)
        })

        const cache = queryClient.getQueryData<{ sessions: SessionSummary[] }>(queryKeys.sessions)
        expect(cache?.sessions.map((s) => s.id)).toEqual(['session-C'])
    })
})
