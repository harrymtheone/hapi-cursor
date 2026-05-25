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
import * as projStoreModule from '@/lib/toolProjectionStore'

vi.mock('@/lib/message-window-store', () => ({
    clearMessageWindow: vi.fn(),
    getMessageWindowState: vi.fn(() => ({ messages: [], pending: [] })),
    ingestIncomingMessages: vi.fn(),
    markMessagesConsumed: vi.fn(),
    removeOptimisticMessage: vi.fn(),
    updateMessageStatus: vi.fn(),
}))

vi.mock('@/lib/toolProjectionStore', async () => {
    const actual = await vi.importActual<typeof import('@/lib/toolProjectionStore')>('@/lib/toolProjectionStore')
    return {
        patchProjection: vi.fn(actual.patchProjection),
        clearProjectionsForSession: vi.fn(actual.clearProjectionsForSession),
        mergePageToolCalls: vi.fn(actual.mergePageToolCalls),
        getProjectionsForSession: vi.fn(actual.getProjectionsForSession),
    }
})

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
        turnCompletionMarker: null,
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
            ['statusKind', { type: 'session-updated', sessionId: 'session-1', data: { statusKind: 'thinking' } }, (queryClient) => {
                expect(queryClient.getQueryData<{ sessions: SessionSummary[] }>(queryKeys.sessions)?.sessions[0]?.statusKind).toBe('thinking')
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
            ['completionMarker', { type: 'session-updated', sessionId: 'session-1', data: { statusKind: 'completed', completionMarker: 5_000 } }, (queryClient) => {
                const summary = queryClient.getQueryData<{ sessions: SessionSummary[] }>(queryKeys.sessions)?.sessions[0]
                expect(summary?.statusKind).toBe('completed')
                expect(summary?.completionMarker).toBe(5_000)
            }],
            ['errorMarker', { type: 'session-updated', sessionId: 'session-1', data: { statusKind: 'error', errorMarker: 6_000 } }, (queryClient) => {
                const summary = queryClient.getQueryData<{ sessions: SessionSummary[] }>(queryKeys.sessions)?.sessions[0]
                expect(summary?.statusKind).toBe('error')
                expect(summary?.errorMarker).toBe(6_000)
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

    it('active keepalive without turn work converges summary status to idle', async () => {
        const { queryClient, wrapper } = createHarness()
        queryClient.setQueryData(queryKeys.sessions, {
            sessions: [createSummary({
                active: true,
                thinking: false,
                backgroundTaskCount: 0,
                pendingRequestsCount: 0,
                statusKind: 'running',
            })],
        })
        mountUseSSE(wrapper)

        act(() => {
            activeSource().dispatch({
                type: 'session-updated',
                sessionId: 'session-1',
                data: { active: true, thinking: false, updatedAt: 3_000 },
            } satisfies SyncEvent)
        })

        await waitFor(() => {
            const summary = queryClient.getQueryData<{ sessions: SessionSummary[] }>(queryKeys.sessions)?.sessions[0]
            expect(summary?.statusKind).toBe('idle')
            expect(summary?.completionMarker).toBeNull()
            expect(summary?.errorMarker).toBeNull()
        })
    })

    it('active keepalive preserves completed marker until new work arrives', async () => {
        const { queryClient, wrapper } = createHarness()
        queryClient.setQueryData(queryKeys.sessions, {
            sessions: [createSummary({
                active: true,
                thinking: false,
                statusKind: 'completed',
                completionMarker: 5_000,
            })],
        })
        mountUseSSE(wrapper)

        act(() => {
            activeSource().dispatch({
                type: 'session-updated',
                sessionId: 'session-1',
                data: { active: true, thinking: false, updatedAt: 6_000 },
            } satisfies SyncEvent)
        })

        await waitFor(() => {
            const summary = queryClient.getQueryData<{ sessions: SessionSummary[] }>(queryKeys.sessions)?.sessions[0]
            expect(summary?.statusKind).toBe('completed')
            expect(summary?.completionMarker).toBe(5_000)
        })
    })

    it('completion marker patch survives keepalive and clears on new thinking patch', async () => {
        const { queryClient, wrapper } = createHarness()
        queryClient.setQueryData(queryKeys.sessions, {
            sessions: [createSummary({
                active: true,
                thinking: true,
                statusKind: 'thinking',
            })],
        })
        mountUseSSE(wrapper)

        act(() => {
            activeSource().dispatch({
                type: 'session-updated',
                sessionId: 'session-1',
                data: {
                    updatedAt: 7_000,
                    thinking: false,
                    statusKind: 'completed',
                    completionMarker: 7_000,
                    errorMarker: null,
                },
            } satisfies SyncEvent)
        })

        await waitFor(() => {
            const summary = queryClient.getQueryData<{ sessions: SessionSummary[] }>(queryKeys.sessions)?.sessions[0]
            expect(summary?.statusKind).toBe('completed')
            expect(summary?.completionMarker).toBe(7_000)
        })

        act(() => {
            activeSource().dispatch({
                type: 'session-updated',
                sessionId: 'session-1',
                data: { active: true, thinking: false, updatedAt: 8_000 },
            } satisfies SyncEvent)
        })

        await waitFor(() => {
            const summary = queryClient.getQueryData<{ sessions: SessionSummary[] }>(queryKeys.sessions)?.sessions[0]
            expect(summary?.statusKind).toBe('completed')
            expect(summary?.completionMarker).toBe(7_000)
        })

        act(() => {
            activeSource().dispatch({
                type: 'session-updated',
                sessionId: 'session-1',
                data: { thinking: true, updatedAt: 9_000 },
            } satisfies SyncEvent)
        })

        await waitFor(() => {
            const summary = queryClient.getQueryData<{ sessions: SessionSummary[] }>(queryKeys.sessions)?.sessions[0]
            expect(summary?.statusKind).toBe('thinking')
            expect(summary?.completionMarker).toBeNull()
            expect(summary?.errorMarker).toBeNull()
        })
    })

    it("session-updated event for a non-selected session updates that session's SessionList summary cache entry while another session is open (cross-session patch convergence)", async () => {
        const { queryClient, wrapper } = createHarness()
        const summaryA = createSummary({ id: 'sessionA' })
        const summaryB = createSummary({
            id: 'sessionB',
            statusKind: 'thinking',
            thinking: true,
        })
        queryClient.setQueryData(queryKeys.sessions, { sessions: [summaryA, summaryB] })
        const sessionADetail = createSession({ id: 'sessionA' })
        queryClient.setQueryData(queryKeys.session('sessionA'), { session: sessionADetail })

        mountUseSSE(wrapper)

        act(() => {
            activeSource().dispatch({
                type: 'session-updated',
                sessionId: 'sessionB',
                data: {
                    active: true,
                    thinking: false,
                    statusKind: 'completed',
                    completionMarker: 7_000,
                    errorMarker: null,
                    updatedAt: 7_000,
                },
            } satisfies SyncEvent)
        })

        await waitFor(() => {
            const sessions = queryClient
                .getQueryData<{ sessions: SessionSummary[] }>(queryKeys.sessions)
                ?.sessions ?? []
            const b = sessions.find((s) => s.id === 'sessionB')
            expect(b?.statusKind).toBe('completed')
            expect(b?.completionMarker).toBe(7_000)
            expect(b?.thinking).toBe(false)
        })

        // sessionA detail cache untouched by a sessionB patch.
        expect(
            queryClient.getQueryData<{ session: Session }>(queryKeys.session('sessionA'))?.session,
        ).toEqual(sessionADetail)
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

describe('useSSE tool-call-projection-updated', () => {
    let originalEventSource: typeof globalThis.EventSource | undefined
    let actualProjStore: typeof import('@/lib/toolProjectionStore')

    beforeEach(async () => {
        originalEventSource = globalThis.EventSource
        ;(globalThis as unknown as Record<string, unknown>).EventSource = MockEventSource
        MockEventSource.reset()

        // Get actual implementation to use as passthrough and for state cleanup
        actualProjStore = await vi.importActual<typeof import('@/lib/toolProjectionStore')>('@/lib/toolProjectionStore')

        // Restore real implementations (may have been wiped by vi.resetAllMocks in other describes)
        vi.mocked(projStoreModule.patchProjection).mockImplementation(actualProjStore.patchProjection)
        vi.mocked(projStoreModule.clearProjectionsForSession).mockImplementation(actualProjStore.clearProjectionsForSession)
        vi.mocked(projStoreModule.mergePageToolCalls).mockImplementation(actualProjStore.mergePageToolCalls)
        vi.mocked(projStoreModule.getProjectionsForSession).mockImplementation(actualProjStore.getProjectionsForSession)

        // Clean store state from prior tests, then reset call history
        actualProjStore.clearProjectionsForSession('session-proj')
        actualProjStore.clearProjectionsForSession('session-gone')
        vi.clearAllMocks()

        // Re-apply after clearAllMocks (vi.clearAllMocks does not reset implementations,
        // but being explicit avoids subtle ordering surprises)
        vi.mocked(projStoreModule.patchProjection).mockImplementation(actualProjStore.patchProjection)
        vi.mocked(projStoreModule.clearProjectionsForSession).mockImplementation(actualProjStore.clearProjectionsForSession)
        vi.mocked(projStoreModule.mergePageToolCalls).mockImplementation(actualProjStore.mergePageToolCalls)
        vi.mocked(projStoreModule.getProjectionsForSession).mockImplementation(actualProjStore.getProjectionsForSession)
    })

    afterEach(() => {
        ;(globalThis as unknown as Record<string, unknown>).EventSource = originalEventSource
    })

    it('tool-call-projection-updated event calls patchProjection and projection is retrievable via getProjectionsForSession', async () => {
        const { wrapper } = createHarness()
        mountUseSSE(wrapper)
        const source = activeSource()
        await act(async () => { source.emitOpen() })

        await act(async () => {
            source.dispatch({
                type: 'tool-call-projection-updated',
                sessionId: 'session-proj',
                callId: 'call-abc',
                projection: {
                    callId: 'call-abc',
                    name: 'Bash',
                    input: { command: 'ls' },
                    status: 'completed',
                    startedAt: 1_700_000_000_000,
                },
            } satisfies SyncEvent)
        })

        expect(projStoreModule.patchProjection).toHaveBeenCalledWith(
            'session-proj',
            'call-abc',
            expect.objectContaining({ name: 'Bash' })
        )
        const stored = projStoreModule.getProjectionsForSession('session-proj')
        expect(stored['call-abc']?.name).toBe('Bash')
    })

    it('session-removed clears projection store for that sessionId', async () => {
        const { queryClient, wrapper } = createHarness()
        queryClient.setQueryData(queryKeys.sessions, { sessions: [] })
        mountUseSSE(wrapper)
        const source = activeSource()
        await act(async () => { source.emitOpen() })

        // Seed some state so we can verify it gets cleared
        actualProjStore.mergePageToolCalls('session-gone', {
            'call-1': { callId: 'call-1', name: 'Read', input: {}, status: 'completed', startedAt: 1_700_000_000_000 }
        })
        vi.clearAllMocks()
        vi.mocked(projStoreModule.clearProjectionsForSession).mockImplementation(actualProjStore.clearProjectionsForSession)
        vi.mocked(projStoreModule.getProjectionsForSession).mockImplementation(actualProjStore.getProjectionsForSession)

        await act(async () => {
            source.dispatch({
                type: 'session-removed',
                sessionId: 'session-gone',
            } satisfies SyncEvent)
        })

        expect(projStoreModule.clearProjectionsForSession).toHaveBeenCalledWith('session-gone')
        const stored = projStoreModule.getProjectionsForSession('session-gone')
        expect(Object.keys(stored)).toHaveLength(0)
    })
})
