import { describe, expect, it } from 'bun:test'
import { Hono } from 'hono'
import type { Session, SyncEngine } from '../../sync/syncEngine'
import type { WebAppEnv } from '../middleware/auth'
import { createSessionsRoutes } from './sessions'

function createSession(overrides?: Partial<Session>): Session {
    const baseMetadata = {
        path: '/tmp/project',
        host: 'localhost',
        flavor: 'cursor' as const
    }
    const base: Session = {
        id: 'session-1',
        namespace: 'default',
        seq: 1,
        createdAt: 1,
        updatedAt: 1,
        active: true,
        activeAt: 1,
        metadata: baseMetadata,
        metadataVersion: 1,
        agentState: {
            controlledByUser: false,
            requests: {},
            completedRequests: {}
        },
        agentStateVersion: 1,
        thinking: false,
        thinkingAt: 1,
        model: 'ollama/exaone:4.5-33b-q8',
        modelReasoningEffort: null,
        effort: null,
        permissionMode: 'default'
    }

    return {
        ...base,
        ...overrides,
        metadata: overrides?.metadata === undefined
            ? base.metadata
            : overrides.metadata === null
                ? null
                : {
                    ...baseMetadata,
                    ...overrides.metadata
                },
        agentState: overrides?.agentState === undefined ? base.agentState : overrides.agentState
    }
}

function createApp(session: Session, opts?: {
    resumeSession?: (sessionId: string, resumeOpts?: { permissionMode?: string }) => Promise<{ type: string; sessionId?: string; message?: string; code?: string }>
    listSlashCommands?: SyncEngine['listSlashCommands']
}) {
    const applySessionConfigCalls: Array<[string, Record<string, unknown>]> = []
    const applySessionConfig = async (sessionId: string, config: Record<string, unknown>) => {
        applySessionConfigCalls.push([sessionId, config])
    }
    const resumeSession = opts?.resumeSession ?? (async (sessionId: string) => ({ type: 'success', sessionId }))
    const engine = {
        resolveSessionAccess: () => ({ ok: true, sessionId: session.id, session }),
        applySessionConfig,
        resumeSession,
        listSlashCommands: opts?.listSlashCommands ?? (async () => ({
            success: true,
            commands: []
        }))
    } as Partial<SyncEngine>

    const app = new Hono<WebAppEnv>()
    app.route('/api', createSessionsRoutes(() => engine as SyncEngine))

    return { app, applySessionConfigCalls }
}

describe('sessions routes', () => {
    it('rejects model changes for Cursor sessions', async () => {
        const session = createSession({
            metadata: {
                path: '/tmp/project',
                host: 'localhost',
                flavor: 'cursor'
            }
        })
        const { app, applySessionConfigCalls } = createApp(session)

        const response = await app.request('/api/sessions/session-1/model', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ model: 'sonnet' })
        })

        expect(response.status).toBe(400)
        expect(applySessionConfigCalls).toEqual([])
    })

    it('rejects effort changes for non-Claude sessions', async () => {
        const { app, applySessionConfigCalls } = createApp(createSession())

        const response = await app.request('/api/sessions/session-1/effort', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ effort: 'high' })
        })

        expect(response.status).toBe(400)
        expect(await response.json()).toEqual({
            error: 'Effort selection is only supported for Claude sessions'
        })
        expect(applySessionConfigCalls).toEqual([])
    })

    it('applies effort changes for Claude sessions', async () => {
        const session = createSession({
            metadata: {
                path: '/tmp/project',
                host: 'localhost',
                flavor: 'claude'
            }
        })
        const { app, applySessionConfigCalls } = createApp(session)

        const response = await app.request('/api/sessions/session-1/effort', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ effort: 'max' })
        })

        expect(response.status).toBe(200)
        expect(await response.json()).toEqual({ ok: true })
        expect(applySessionConfigCalls).toEqual([
            ['session-1', { effort: 'max' }]
        ])
    })

    it('applies permission mode changes for inactive sessions', async () => {
        const session = createSession({
            active: false,
            metadata: { path: '/tmp/project', host: 'localhost', flavor: 'claude' }
        })
        const { app, applySessionConfigCalls } = createApp(session)

        const response = await app.request('/api/sessions/session-1/permission-mode', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ mode: 'bypassPermissions' })
        })

        expect(response.status).toBe(200)
        expect(await response.json()).toEqual({ ok: true })
        expect(applySessionConfigCalls).toEqual([
            ['session-1', { permissionMode: 'bypassPermissions' }]
        ])
    })

    it('passes permissionMode from resume body to resumeSession', async () => {
        const session = createSession({
            active: false,
            metadata: { path: '/tmp/project', host: 'localhost', flavor: 'claude' }
        })
        let capturedResumeOpts: { permissionMode?: string } | undefined
        const { app } = createApp(session, {
            resumeSession: async (sessionId, resumeOpts) => {
                capturedResumeOpts = resumeOpts
                return { type: 'success', sessionId }
            }
        })

        const response = await app.request('/api/sessions/session-1/resume', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ permissionMode: 'bypassPermissions' })
        })

        expect(response.status).toBe(200)
        expect(capturedResumeOpts).toEqual({ permissionMode: 'bypassPermissions' })
    })

    it('falls back to metadata slash commands when RPC listing fails', async () => {
        const session = createSession({
            metadata: {
                path: '/tmp/project',
                host: 'localhost',
                flavor: 'claude',
                slashCommands: ['help', 'memory', 'status']
            }
        })
        const { app } = createApp(session, {
            listSlashCommands: async () => {
                throw new Error('RPC unavailable')
            }
        })

        const response = await app.request('/api/sessions/session-1/slash-commands')

        expect(response.status).toBe(200)
        expect(await response.json()).toEqual({
            success: true,
            commands: [
                { name: 'help', source: 'builtin' },
                { name: 'memory', source: 'builtin' },
                { name: 'status', source: 'builtin' }
            ]
        })
    })

    it('merges RPC and metadata slash commands without hiding built-ins', async () => {
        const session = createSession({
            metadata: {
                path: '/tmp/project',
                host: 'localhost',
                flavor: 'claude',
                slashCommands: ['help', 'memory']
            }
        })
        const { app } = createApp(session, {
            listSlashCommands: async () => ({
                success: true,
                commands: [
                    { name: 'clear', source: 'builtin' },
                    { name: 'project-only', source: 'project', content: 'Project prompt' }
                ]
            })
        })

        const response = await app.request('/api/sessions/session-1/slash-commands')

        expect(response.status).toBe(200)
        expect(await response.json()).toEqual({
            success: true,
            commands: [
                { name: 'help', source: 'builtin' },
                { name: 'memory', source: 'builtin' },
                { name: 'clear', source: 'builtin' },
                { name: 'project-only', source: 'project', content: 'Project prompt' }
            ]
        })
    })

})
