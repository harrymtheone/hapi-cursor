import { describe, expect, it } from 'bun:test'
import { AGENT_MESSAGE_PAYLOAD_TYPE, toSessionSummary } from '@hapi/protocol'
import type { SyncEvent } from '@hapi/protocol/types'
import { Store } from '../store'
import { RpcRegistry } from '../socket/rpcRegistry'
import { registerSessionHandlers } from '../socket/handlers/cli/sessionHandlers'
import type { EventPublisher } from './eventPublisher'
import { SessionCache } from './sessionCache'
import { SyncEngine } from './syncEngine'
import { KeepaliveScheduler } from '../utils/scheduler'

function createPublisher(events: SyncEvent[]): EventPublisher {
    return {
        emit: (event: SyncEvent) => {
            events.push(event)
        }
    } as unknown as EventPublisher
}

describe('session model', () => {
    it('includes explicit model in session summaries', () => {
        const store = new Store(':memory:')
        const events: SyncEvent[] = []
        const cache = new SessionCache(store, createPublisher(events))

        const session = cache.getOrCreateSession(
            'session-model-summary',
            { path: '/tmp/project', host: 'localhost' },
            null,
            { model: 'gpt-5.4' }
        )

        expect(session.model).toBe('gpt-5.4')
        expect(toSessionSummary(session).model).toBe('gpt-5.4')
        expect(toSessionSummary(session).effort).toBeNull()
    })

    it('includes explicit effort in session summaries', () => {
        const store = new Store(':memory:')
        const events: SyncEvent[] = []
        const cache = new SessionCache(store, createPublisher(events))

        const session = cache.getOrCreateSession(
            'session-effort-summary',
            { path: '/tmp/project', host: 'localhost' },
            null,
            { model: 'gpt-5.4', effort: 'high' }
        )

        expect(session.effort).toBe('high')
        expect(toSessionSummary(session).effort).toBe('high')
    })

    it('persists explicit model reasoning effort on Cursor sessions', () => {
        const store = new Store(':memory:')
        const events: SyncEvent[] = []
        const cache = new SessionCache(store, createPublisher(events))

        const session = cache.getOrCreateSession(
            'session-model-reasoning-effort',
            { path: '/tmp/project', host: 'localhost' },
            null,
            { model: 'gpt-5.4', modelReasoningEffort: 'xhigh' }
        )

        expect(session.modelReasoningEffort).toBe('xhigh')
        expect(store.sessions.getSession(session.id)?.modelReasoningEffort).toBe('xhigh')
    })

    it('preserves model from old session when merging into resumed session', async () => {
        const store = new Store(':memory:')
        const events: SyncEvent[] = []
        const cache = new SessionCache(store, createPublisher(events))

        const oldSession = cache.getOrCreateSession(
            'session-model-old',
            { path: '/tmp/project', host: 'localhost' },
            null,
            { model: 'gpt-5.4' }
        )
        const newSession = cache.getOrCreateSession(
            'session-model-new',
            { path: '/tmp/project', host: 'localhost' },
            null
        )

        await cache.mergeSessions(oldSession.id, newSession.id)

        const merged = cache.getSession(newSession.id)
        expect(merged?.model).toBe('gpt-5.4')
    })

    it('persists applied session model updates, including clear-to-auto', () => {
        const store = new Store(':memory:')
        const events: SyncEvent[] = []
        const cache = new SessionCache(store, createPublisher(events))

        const session = cache.getOrCreateSession(
            'session-model-config',
            { path: '/tmp/project', host: 'localhost' },
            null,
            { model: 'gpt-5.4' }
        )

        cache.applySessionConfig(session.id, { model: 'gpt-5.5' })
        expect(cache.getSession(session.id)?.model).toBe('gpt-5.5')
        expect(store.sessions.getSession(session.id)?.model).toBe('gpt-5.5')

        cache.applySessionConfig(session.id, { model: null })
        expect(cache.getSession(session.id)?.model).toBeNull()
        expect(store.sessions.getSession(session.id)?.model).toBeNull()
    })

    it('persists keepalive model changes, including clearing the model', () => {
        const store = new Store(':memory:')
        const events: SyncEvent[] = []
        const cache = new SessionCache(store, createPublisher(events))

        const session = cache.getOrCreateSession(
            'session-model-heartbeat',
            { path: '/tmp/project', host: 'localhost' },
            null,
            { model: 'gpt-5.4' }
        )

        cache.handleSessionAlive({
            sid: session.id,
            time: Date.now(),
            thinking: false,
            model: null
        })

        expect(cache.getSession(session.id)?.model).toBeNull()
        expect(store.sessions.getSession(session.id)?.model).toBeNull()
    })

    it('persists applied session effort updates, including clear-to-auto', () => {
        const store = new Store(':memory:')
        const events: SyncEvent[] = []
        const cache = new SessionCache(store, createPublisher(events))

        const session = cache.getOrCreateSession(
            'session-effort-config',
            { path: '/tmp/project', host: 'localhost' },
            null,
            { model: 'gpt-5.4', effort: 'medium' }
        )

        cache.applySessionConfig(session.id, { effort: 'max' })
        expect(cache.getSession(session.id)?.effort).toBe('max')
        expect(store.sessions.getSession(session.id)?.effort).toBe('max')

        cache.applySessionConfig(session.id, { effort: null })
        expect(cache.getSession(session.id)?.effort).toBeNull()
        expect(store.sessions.getSession(session.id)?.effort).toBeNull()
    })

    it('persists applied session model reasoning effort updates, including clear-to-default', () => {
        const store = new Store(':memory:')
        const events: SyncEvent[] = []
        const cache = new SessionCache(store, createPublisher(events))

        const session = cache.getOrCreateSession(
            'session-model-reasoning-config',
            { path: '/tmp/project', host: 'localhost' },
            null,
            { model: 'gpt-5.4', modelReasoningEffort: 'high' }
        )

        cache.applySessionConfig(session.id, { modelReasoningEffort: 'xhigh' })
        expect(cache.getSession(session.id)?.modelReasoningEffort).toBe('xhigh')
        expect(store.sessions.getSession(session.id)?.modelReasoningEffort).toBe('xhigh')

        cache.applySessionConfig(session.id, { modelReasoningEffort: null })
        expect(cache.getSession(session.id)?.modelReasoningEffort).toBeNull()
        expect(store.sessions.getSession(session.id)?.modelReasoningEffort).toBeNull()
    })

    it('persists keepalive effort changes, including clearing the effort', () => {
        const store = new Store(':memory:')
        const events: SyncEvent[] = []
        const cache = new SessionCache(store, createPublisher(events))

        const session = cache.getOrCreateSession(
            'session-effort-heartbeat',
            { path: '/tmp/project', host: 'localhost' },
            null,
            { model: 'gpt-5.4', effort: 'high' }
        )

        cache.handleSessionAlive({
            sid: session.id,
            time: Date.now(),
            thinking: false,
            effort: null
        })

        expect(cache.getSession(session.id)?.effort).toBeNull()
        expect(store.sessions.getSession(session.id)?.effort).toBeNull()
    })

    it('persists keepalive model reasoning effort changes, including clearing the value', () => {
        const store = new Store(':memory:')
        const events: SyncEvent[] = []
        const cache = new SessionCache(store, createPublisher(events))

        const session = cache.getOrCreateSession(
            'session-model-reasoning-heartbeat',
            { path: '/tmp/project', host: 'localhost' },
            null,
            { model: 'gpt-5.4', modelReasoningEffort: 'high' }
        )

        cache.handleSessionAlive({
            sid: session.id,
            time: Date.now(),
            thinking: false,
            modelReasoningEffort: null
        })

        expect(cache.getSession(session.id)?.modelReasoningEffort).toBeNull()
        expect(store.sessions.getSession(session.id)?.modelReasoningEffort).toBeNull()
    })

    it('touches session updatedAt when new message activity is recorded', () => {
        const store = new Store(':memory:')
        const events: SyncEvent[] = []
        const cache = new SessionCache(store, createPublisher(events))

        const session = cache.getOrCreateSession(
            'session-message-activity',
            { path: '/tmp/project', host: 'localhost' },
            null
        )
        const activityAt = session.updatedAt + 60_000

        cache.recordSessionActivity(session.id, activityAt)

        expect(store.sessions.getSession(session.id)?.updatedAt).toBe(activityAt)
        expect(cache.getSession(session.id)?.updatedAt).toBe(activityAt)
        expect(events).toContainEqual({
            type: 'session-updated',
            sessionId: session.id,
            data: { updatedAt: activityAt }
        })
    })

    it('touches session updatedAt when web sends a message through sync engine', async () => {
        const store = new Store(':memory:')
        const engine = new SyncEngine(
            store,
            { of: () => ({ to: () => ({ emit() {} }) }) } as never,
            new RpcRegistry(),
            { broadcast() {} } as never,
            new KeepaliveScheduler()
        )

        try {
            const session = engine.getOrCreateSession(
                'session-web-message-activity',
                { path: '/tmp/project', host: 'localhost' },
                null
            )
            const before = store.sessions.getSession(session.id)?.updatedAt ?? 0

            await new Promise((resolve) => setTimeout(resolve, 2))
            await engine.sendMessage(session.id, { text: 'hello' })

            const after = store.sessions.getSession(session.id)?.updatedAt ?? 0
            expect(after).toBeGreaterThan(before)
            expect(engine.getSession(session.id)?.updatedAt).toBe(after)
        } finally {
            engine.shutdown()
        }
    })

    it('reports session activity when CLI receives a turn-ready event over socket', () => {
        const store = new Store(':memory:')
        const events: SyncEvent[] = []
        const cache = new SessionCache(store, createPublisher(events))
        const session = cache.getOrCreateSession(
            'session-cli-message-activity',
            { path: '/tmp/project', host: 'localhost' },
            null
        )
        const handlers = new Map<string, (payload: unknown) => void>()
        const activity: Array<{ sessionId: string; updatedAt: number; kind: string | undefined }> = []

        registerSessionHandlers({
            on: (event: string, handler: (payload: unknown) => void) => {
                handlers.set(event, handler)
            },
            to: () => ({ emit() {} })
        } as never, {
            store,
            resolveSessionAccess: (sessionId) => {
                const stored = store.sessions.getSession(sessionId)
                return stored ? { ok: true, value: stored } : { ok: false, reason: 'not-found' }
            },
            emitAccessError: () => {},
            onSessionActivity: (sessionId, updatedAt, kind?: string) => {
                activity.push({ sessionId, updatedAt, kind })
            }
        })

        handlers.get('message')?.({
            sid: session.id,
            message: JSON.stringify({
                role: 'agent',
                content: {
                    type: 'event',
                    data: { type: 'ready' }
                }
            })
        })

        expect(activity).toHaveLength(1)
        expect(activity[0].sessionId).toBe(session.id)
        expect(activity[0].updatedAt).toBe(store.messages.getMessages(session.id, 1)[0]?.createdAt)
        expect(activity[0].kind).toBe('turn-completed')
    })

    it('does not report session activity for CLI tool messages', () => {
        const store = new Store(':memory:')
        const events: SyncEvent[] = []
        const cache = new SessionCache(store, createPublisher(events))
        const session = cache.getOrCreateSession(
            'session-cli-tool-activity',
            { path: '/tmp/project', host: 'localhost' },
            null
        )
        const handlers = new Map<string, (payload: unknown) => void>()
        const activity: Array<{ sessionId: string; updatedAt: number }> = []

        registerSessionHandlers({
            on: (event: string, handler: (payload: unknown) => void) => {
                handlers.set(event, handler)
            },
            to: () => ({ emit() {} })
        } as never, {
            store,
            resolveSessionAccess: (sessionId) => {
                const stored = store.sessions.getSession(sessionId)
                return stored ? { ok: true, value: stored } : { ok: false, reason: 'not-found' }
            },
            emitAccessError: () => {},
            onSessionActivity: (sessionId, updatedAt) => {
                activity.push({ sessionId, updatedAt })
            }
        })

        handlers.get('message')?.({
            sid: session.id,
            message: JSON.stringify({
                role: 'agent',
                content: {
                    type: AGENT_MESSAGE_PAYLOAD_TYPE,
                    data: {
                        type: 'tool-call',
                        name: 'CursorBash',
                        callId: 'call-1',
                        input: { cmd: 'date' }
                    }
                }
            })
        })
        handlers.get('message')?.({
            sid: session.id,
            message: JSON.stringify({
                role: 'agent',
                content: {
                    type: AGENT_MESSAGE_PAYLOAD_TYPE,
                    data: {
                        type: 'tool-call-result',
                        callId: 'call-1',
                        output: { stdout: 'Sat Apr 25' }
                    }
                }
            })
        })

        expect(activity).toHaveLength(0)
    })

    it('passes the stored model when respawning a resumed session', async () => {
        const store = new Store(':memory:')
        const engine = new SyncEngine(
            store,
            {} as never,
            new RpcRegistry(),
            { broadcast() {} } as never,
            new KeepaliveScheduler()
        )

        try {
            const session = engine.getOrCreateSession(
                'session-model-resume',
                {
                    path: '/tmp/project',
                    host: 'localhost',
                    machineId: 'machine-1',
                    cursorSessionId: 'cursor-thread-1'
                },
                null,
                { model: 'gpt-5.4' }
            )
            engine.getOrCreateMachine(
                'machine-1',
                { host: 'localhost', platform: 'linux', happyCliVersion: '0.1.0' },
                null
            )
            engine.handleMachineAlive({ machineId: 'machine-1', time: Date.now() })

            let capturedModel: string | undefined
            let capturedModelReasoningEffort: string | undefined
            let capturedEffort: string | undefined
            ;(engine as any).session.resume.rpcGateway.spawnSession = async (
                _machineId: string,
                _directory: string,
                _agent: string,
                model?: string,
                modelReasoningEffort?: string,
                _yolo?: boolean,
                _sessionType?: string,
                _worktreeName?: string,
                _resumeSessionId?: string,
                effort?: string
            ) => {
                capturedModel = model
                capturedModelReasoningEffort = modelReasoningEffort
                capturedEffort = effort
                return { type: 'success', sessionId: session.id }
            }
            ;(engine as any).session.resume.waitForSessionActive = async () => true

            const result = await engine.resumeSession(session.id)

            expect(result).toEqual({ type: 'success', sessionId: session.id })
            expect(capturedModel).toBe('gpt-5.4')
            expect(capturedModelReasoningEffort).toBeUndefined()
            expect(capturedEffort).toBeUndefined()
        } finally {
            engine.shutdown()
        }
    })

    it('passes the stored model reasoning effort when respawning a resumed Cursor session', async () => {
        const store = new Store(':memory:')
        const engine = new SyncEngine(
            store,
            {} as never,
            new RpcRegistry(),
            { broadcast() {} } as never,
            new KeepaliveScheduler()
        )

        try {
            const session = engine.getOrCreateSession(
                'session-model-reasoning-resume',
                {
                    path: '/tmp/project',
                    host: 'localhost',
                    machineId: 'machine-1',
                    cursorSessionId: 'cursor-thread-1'
                },
                null,
                { model: 'gpt-5.4', modelReasoningEffort: 'xhigh' }
            )
            engine.getOrCreateMachine(
                'machine-1',
                { host: 'localhost', platform: 'linux', happyCliVersion: '0.1.0' },
                null
            )
            engine.handleMachineAlive({ machineId: 'machine-1', time: Date.now() })

            let capturedModelReasoningEffort: string | undefined
            ;(engine as any).session.resume.rpcGateway.spawnSession = async (
                _machineId: string,
                _directory: string,
                _agent: string,
                _model?: string,
                modelReasoningEffort?: string
            ) => {
                capturedModelReasoningEffort = modelReasoningEffort
                return { type: 'success', sessionId: session.id }
            }
            ;(engine as any).session.resume.waitForSessionActive = async () => true

            const result = await engine.resumeSession(session.id)

            expect(result).toEqual({ type: 'success', sessionId: session.id })
            expect(capturedModelReasoningEffort).toBe('xhigh')
        } finally {
            engine.shutdown()
        }
    })

    it('passes resume session ID to rpc gateway when resuming cursor session', async () => {
        const store = new Store(':memory:')
        const engine = new SyncEngine(
            store,
            {} as never,
            new RpcRegistry(),
            { broadcast() {} } as never,
            new KeepaliveScheduler()
        )

        try {
            const session = engine.getOrCreateSession(
                'session-cursor-resume',
                {
                    path: '/tmp/project',
                    host: 'localhost',
                    machineId: 'machine-1',
                    cursorSessionId: 'cursor-session-1'
                },
                null,
                { model: 'gpt-5.4' }
            )
            engine.getOrCreateMachine(
                'machine-1',
                { host: 'localhost', platform: 'linux', happyCliVersion: '0.1.0' },
                null
            )
            engine.handleMachineAlive({ machineId: 'machine-1', time: Date.now() })

            let capturedResumeSessionId: string | undefined
            ;(engine as any).session.resume.rpcGateway.spawnSession = async (
                _machineId: string,
                _directory: string,
                _agent: string,
                _model?: string,
                _modelReasoningEffort?: string,
                _yolo?: boolean,
                _sessionType?: 'simple' | 'worktree',
                _worktreeName?: string,
                resumeSessionId?: string
            ) => {
                capturedResumeSessionId = resumeSessionId
                return { type: 'success', sessionId: session.id }
            }
            ;(engine as any).session.resume.waitForSessionActive = async () => true

            const result = await engine.resumeSession(session.id)

            expect(result).toEqual({ type: 'success', sessionId: session.id })
            expect(capturedResumeSessionId).toBe('cursor-session-1')
        } finally {
            engine.shutdown()
        }
    })

    // NOTE: Legacy `.skip`'d resume-from-stored-messages recovery tests were
    // removed in plan 05-06. The legacy message-recovery path was deleted in
    // Phase 1; cursor sessions resume via `cursorSessionId` metadata directly
    // (covered by the resume test above).

    it('passes the cached permissionMode when respawning a resumed session', async () => {
        const store = new Store(':memory:')
        const engine = new SyncEngine(
            store,
            {} as never,
            new RpcRegistry(),
            { broadcast() {} } as never,
            new KeepaliveScheduler()
        )

        try {
            const session = engine.getOrCreateSession(
                'session-permission-resume',
                {
                    path: '/tmp/project',
                    host: 'localhost',
                    machineId: 'machine-1',
                    cursorSessionId: 'cursor-session-perm'
                },
                null,
                { model: 'sonnet' }
            )
            engine.getOrCreateMachine(
                'machine-1',
                { host: 'localhost', platform: 'linux', happyCliVersion: '0.1.0' },
                null
            )
            engine.handleMachineAlive({ machineId: 'machine-1', time: Date.now() })

            engine.handleSessionAlive({
                sid: session.id,
                permissionMode: 'yolo',
                time: Date.now()
            })
            engine.handleSessionEnd({ sid: session.id, time: Date.now() })

            let capturedPermissionMode: string | undefined
            ;(engine as any).session.resume.rpcGateway.spawnSession = async (
                _machineId: string,
                _directory: string,
                _agent: string,
                _model?: string,
                _modelReasoningEffort?: string,
                _yolo?: boolean,
                _sessionType?: string,
                _worktreeName?: string,
                _resumeSessionId?: string,
                _effort?: string,
                permissionMode?: string
            ) => {
                capturedPermissionMode = permissionMode
                return { type: 'success', sessionId: session.id }
            }
            ;(engine as any).session.resume.waitForSessionActive = async () => true

            const result = await engine.resumeSession(session.id)

            expect(result).toEqual({ type: 'success', sessionId: session.id })
            expect(capturedPermissionMode).toBe('yolo')
        } finally {
            engine.shutdown()
        }
    })

    it('resolves a local resume target for a Cursor session', () => {
        const store = new Store(':memory:')
        const engine = new SyncEngine(
            store,
            {} as never,
            new RpcRegistry(),
            { broadcast() {} } as never,
            new KeepaliveScheduler()
        )

        try {
            const session = engine.getOrCreateSession(
                'local-resume-cursor',
                {
                    path: '/tmp/project',
                    host: 'localhost',
                    machineId: 'machine-1',
                    cursorSessionId: 'cursor-thread-1'
                },
                { controlledByUser: false },
                { model: 'gpt-5.4', modelReasoningEffort: 'xhigh' }
            )

            const result = engine.resolveLocalResumeTarget(session.id)

            expect(result).toEqual({
                type: 'success',
                target: expect.objectContaining({
                    sessionId: session.id,
                    directory: '/tmp/project',
                    machineId: 'machine-1',
                    host: 'localhost',
                    active: session.active,
                    thinking: session.thinking,
                    controlledByUser: false,
                    agentSessionId: 'cursor-thread-1',
                    model: 'gpt-5.4',
                    effort: null,
                    modelReasoningEffort: 'xhigh',
                    permissionMode: undefined
                })
            })
        } finally {
            engine.shutdown()
        }
    })

    // NOTE: Legacy `.skip`'d local-resume-target-from-stored-messages test
    // removed in plan 05-06 (dead path; cursor uses `cursorSessionId`).

    it('returns resume_unavailable when the local resume target lacks an agent session id', () => {
        const store = new Store(':memory:')
        const engine = new SyncEngine(
            store,
            {} as never,
            new RpcRegistry(),
            { broadcast() {} } as never,
            new KeepaliveScheduler()
        )

        try {
            const session = engine.getOrCreateSession(
                'local-resume-no-agent-id',
                {
                    path: '/tmp/project',
                    host: 'localhost',
                    machineId: 'machine-1'
                },
                null
            )

            expect(engine.resolveLocalResumeTarget(session.id)).toEqual({
                type: 'error',
                message: 'Resume session ID unavailable',
                code: 'resume_unavailable'
            })
        } finally {
            engine.shutdown()
        }
    })

    it('local handoff succeeds immediately for inactive sessions', async () => {
        const store = new Store(':memory:')
        const engine = new SyncEngine(
            store,
            {} as never,
            new RpcRegistry(),
            { broadcast() {} } as never,
            new KeepaliveScheduler()
        )

        try {
            const session = engine.getOrCreateSession(
                'local-handoff-inactive',
                {
                    path: '/tmp/project',
                    host: 'localhost',
                    machineId: 'machine-1',
                    cursorSessionId: 'cursor-thread-1'
                },
                { controlledByUser: false }
            )
            engine.handleSessionEnd({ sid: session.id, time: Date.now() })

            await expect(engine.handoffSessionToLocal(session.id)).resolves.toEqual({
                type: 'success'
            })
        } finally {
            engine.shutdown()
        }
    })

    it('local handoff rejects sessions already controlled by a local terminal', async () => {
        const store = new Store(':memory:')
        const engine = new SyncEngine(
            store,
            {} as never,
            new RpcRegistry(),
            { broadcast() {} } as never,
            new KeepaliveScheduler()
        )

        try {
            const session = engine.getOrCreateSession(
                'local-handoff-already-local',
                {
                    path: '/tmp/project',
                    host: 'localhost',
                    machineId: 'machine-1',
                    cursorSessionId: 'cursor-thread-1'
                },
                { controlledByUser: true }
            )
            engine.handleSessionAlive({ sid: session.id, time: Date.now(), mode: 'local' })

            await expect(engine.handoffSessionToLocal(session.id)).resolves.toEqual({
                type: 'error',
                message: 'Session is already controlled by a local terminal',
                code: 'already_local'
            })
        } finally {
            engine.shutdown()
        }
    })

    describe('session dedup by agent session ID', () => {
        it('merges duplicate when cursorSessionId collides', async () => {
            const store = new Store(':memory:')
            const events: SyncEvent[] = []
            const cache = new SessionCache(store, createPublisher(events))

            const s1 = cache.getOrCreateSession(
                'tag-1',
                { path: '/tmp/project', host: 'localhost', cursorSessionId: 'thread-X' },
                null
            )

            // Add a message to s1
            store.messages.addMessage(s1.id, { type: 'text', text: 'hello from s1' }, 'local-1')

            const s2 = cache.getOrCreateSession(
                'tag-2',
                { path: '/tmp/project', host: 'localhost', cursorSessionId: 'thread-X' },
                null
            )

            expect(s1.id).not.toBe(s2.id)

            await cache.deduplicateByAgentSessionId(s2.id)

            expect(cache.getSession(s1.id)).toBeUndefined()
            expect(cache.getSession(s2.id)).toBeDefined()

            const messages = store.messages.getMessages(s2.id, 100)
            expect(messages.length).toBeGreaterThanOrEqual(1)
        })

        it('preserves sessions with different agent session IDs', async () => {
            const store = new Store(':memory:')
            const events: SyncEvent[] = []
            const cache = new SessionCache(store, createPublisher(events))

            const s1 = cache.getOrCreateSession(
                'tag-1',
                { path: '/tmp/project', host: 'localhost', cursorSessionId: 'thread-X' },
                null
            )
            const s2 = cache.getOrCreateSession(
                'tag-2',
                { path: '/tmp/project', host: 'localhost', cursorSessionId: 'thread-Y' },
                null
            )

            await cache.deduplicateByAgentSessionId(s2.id)

            expect(cache.getSession(s1.id)).toBeDefined()
            expect(cache.getSession(s2.id)).toBeDefined()
        })

        it('no-op when session has no agent session ID', async () => {
            const store = new Store(':memory:')
            const events: SyncEvent[] = []
            const cache = new SessionCache(store, createPublisher(events))

            const s1 = cache.getOrCreateSession(
                'tag-1',
                { path: '/tmp/project', host: 'localhost' },
                null
            )

            await cache.deduplicateByAgentSessionId(s1.id)

            expect(cache.getSession(s1.id)).toBeDefined()
        })

        it('does not move history while duplicate sessions are both active', async () => {
            const store = new Store(':memory:')
            const events: SyncEvent[] = []
            const cache = new SessionCache(store, createPublisher(events))

            const s1 = cache.getOrCreateSession(
                'tag-1',
                { path: '/tmp/project', host: 'localhost', cursorSessionId: 'thread-X' },
                {
                    requests: { 'req-from-active-duplicate': { tool: 'Bash', arguments: {} } },
                    completedRequests: {}
                }
            )

            store.messages.addMessage(s1.id, { type: 'text', text: 'history from s1' }, 'local-s1')
            cache.handleSessionAlive({ sid: s1.id, time: Date.now(), thinking: false })

            const s2 = cache.getOrCreateSession(
                'tag-2',
                { path: '/tmp/project', host: 'localhost', cursorSessionId: 'thread-X' },
                {
                    requests: { 'req-from-target': { tool: 'Read', arguments: {} } },
                    completedRequests: {}
                }
            )
            store.messages.addMessage(s2.id, { type: 'text', text: 'history from s2' }, 'local-s2')
            cache.handleSessionAlive({ sid: s2.id, time: Date.now() + 1000, thinking: false })

            await cache.deduplicateByAgentSessionId(s2.id)

            // Both live session records keep their own histories until one of the
            // duplicates becomes inactive. The web may still be showing either
            // active session id, so the hub must not pick a canonical target yet.
            expect(cache.getSession(s1.id)).toBeDefined()
            expect(cache.getSession(s2.id)).toBeDefined()
            expect(store.messages.getMessages(s1.id, 100).map((message) => (message.content as { text?: string }).text)).toEqual([
                'history from s1'
            ])
            expect(store.messages.getMessages(s2.id, 100).map((message) => (message.content as { text?: string }).text)).toEqual([
                'history from s2'
            ])
            expect(events.some((event) => event.type === 'messages-invalidated')).toBe(false)

            const sourceRequests = cache.getSession(s1.id)?.agentState?.requests ?? {}
            const targetRequests = cache.getSession(s2.id)?.agentState?.requests ?? {}
            expect(sourceRequests['req-from-active-duplicate']).toBeDefined()
            expect(targetRequests['req-from-active-duplicate']).toBeUndefined()
            expect(targetRequests['req-from-target']).toBeDefined()
        })

        it('invalidates both sessions for history-only merges', async () => {
            const store = new Store(':memory:')
            const events: SyncEvent[] = []
            const cache = new SessionCache(store, createPublisher(events))

            const s1 = cache.getOrCreateSession(
                'tag-1',
                { path: '/tmp/project', host: 'localhost' },
                {
                    requests: { 'req-from-source': { tool: 'Bash', arguments: {} } },
                    completedRequests: {}
                }
            )
            const s2 = cache.getOrCreateSession(
                'tag-2',
                { path: '/tmp/project', host: 'localhost' },
                {
                    requests: { 'req-from-target': { tool: 'Read', arguments: {} } },
                    completedRequests: {}
                }
            )

            store.messages.addMessage(s1.id, { type: 'text', text: 'history from s1' }, 'local-s1')
            store.messages.addMessage(s2.id, { type: 'text', text: 'history from s2' }, 'local-s2')

            await cache.mergeSessionHistory(s1.id, s2.id, { mergeAgentState: false })

            expect(store.messages.getMessages(s1.id, 100)).toHaveLength(0)
            expect(store.messages.getMessages(s2.id, 100).map((message) => (message.content as { text?: string }).text)).toEqual([
                'history from s1',
                'history from s2'
            ])
            expect(events).toContainEqual({ type: 'messages-invalidated', sessionId: s1.id })
            expect(events).toContainEqual({ type: 'messages-invalidated', sessionId: s2.id })

            const sourceRequests = cache.getSession(s1.id)?.agentState?.requests ?? {}
            const targetRequests = cache.getSession(s2.id)?.agentState?.requests ?? {}
            expect(sourceRequests['req-from-source']).toBeDefined()
            expect(targetRequests['req-from-source']).toBeUndefined()
            expect(targetRequests['req-from-target']).toBeDefined()
        })

        it('merges duplicate after it becomes inactive via session-end', async () => {
            const store = new Store(':memory:')
            const engine = new SyncEngine(
                store,
                {} as never,
                new RpcRegistry(),
                { broadcast() {} } as never,
                new KeepaliveScheduler()
            )

            try {
                const s1 = engine.getOrCreateSession(
                    'tag-1',
                    { path: '/tmp/project', host: 'localhost', cursorSessionId: 'thread-X' },
                    null
                )
                const s2 = engine.getOrCreateSession(
                    'tag-2',
                    { path: '/tmp/project', host: 'localhost', cursorSessionId: 'thread-X' },
                    null
                )

                // Mark s1 as active
                engine.handleSessionAlive({ sid: s1.id, time: Date.now() })

                // s1 is active, so dedup keeps its live record around
                const events: SyncEvent[] = []
                const cache = (engine as any).session.sessionCache as SessionCache
                await cache.deduplicateByAgentSessionId(s2.id)
                expect(cache.getSession(s1.id)).toBeDefined()

                // Now s1 ends — handleSessionEnd should trigger dedup retry
                engine.handleSessionEnd({ sid: s1.id, time: Date.now() })

                // Give the fire-and-forget dedup a tick to complete
                await new Promise((r) => setTimeout(r, 50))

                // One of them should be merged away
                const s1Exists = cache.getSession(s1.id)
                const s2Exists = cache.getSession(s2.id)
                expect(!s1Exists || !s2Exists).toBe(true)
            } finally {
                engine.shutdown()
            }
        })

        it('merges duplicate after inactivity timeout expires it', async () => {
            const store = new Store(':memory:')
            const events: SyncEvent[] = []
            const cache = new SessionCache(store, createPublisher(events))

            const s1 = cache.getOrCreateSession(
                'tag-1',
                { path: '/tmp/project', host: 'localhost', cursorSessionId: 'thread-X' },
                null
            )
            const s2 = cache.getOrCreateSession(
                'tag-2',
                { path: '/tmp/project', host: 'localhost', cursorSessionId: 'thread-X' },
                null
            )

            // Mark both duplicates active. The older live record should keep
            // existing while active, because its socket may still send keepalives.
            const now = Date.now()
            cache.handleSessionAlive({ sid: s1.id, time: now })
            cache.handleSessionAlive({ sid: s2.id, time: now })

            // s1 is active — dedup only moves history and keeps the record.
            await cache.deduplicateByAgentSessionId(s2.id)
            expect(cache.getSession(s1.id)).toBeDefined()
            expect(cache.getSession(s2.id)).toBeDefined()

            // Simulate only s1 passing beyond the 30s timeout.
            cache.getSession(s1.id)!.activeAt = now - 31_000
            const expired = cache.expireInactive(now)
            expect(expired).toContain(s1.id)
            expect(expired).not.toContain(s2.id)

            // Now s1 is inactive — dedup should merge it
            await cache.deduplicateByAgentSessionId(s2.id)
            // Exactly one session should survive after dedup; which one is the
            // target depends on activeAt/updatedAt ordering, which can vary by
            // millisecond timing in CI.
            const remaining = [cache.getSession(s1.id), cache.getSession(s2.id)].filter(Boolean)
            expect(remaining).toHaveLength(1)
        })

        it('deep-merges agentState and filters completed requests', async () => {
            const store = new Store(':memory:')
            const events: SyncEvent[] = []
            const cache = new SessionCache(store, createPublisher(events))

            const s1 = cache.getOrCreateSession(
                'tag-1',
                { path: '/tmp/project', host: 'localhost', cursorSessionId: 'thread-X' },
                {
                    requests: {
                        'req-1': { tool: 'Bash', arguments: {} },
                        'req-2': { tool: 'Bash', arguments: {} }
                    },
                    completedRequests: {}
                }
            )
            const s2 = cache.getOrCreateSession(
                'tag-2',
                { path: '/tmp/project', host: 'localhost', cursorSessionId: 'thread-X' },
                {
                    requests: {
                        'req-3': { tool: 'Bash', arguments: {} }
                    },
                    completedRequests: {
                        'req-1': { tool: 'Bash', arguments: {}, status: 'approved' }
                    }
                }
            )

            await cache.deduplicateByAgentSessionId(s2.id)

            const session = cache.getSession(s2.id)
            expect(session).toBeDefined()
            const state = session!.agentState!

            // req-1 was completed in s2 — should NOT appear in requests
            expect(state.requests?.['req-1']).toBeUndefined()
            // req-2 and req-3 are still pending
            expect(state.requests?.['req-2']).toBeDefined()
            expect(state.requests?.['req-3']).toBeDefined()
            // completedRequests has req-1
            expect(state.completedRequests?.['req-1']).toBeDefined()
        })
    })
})
