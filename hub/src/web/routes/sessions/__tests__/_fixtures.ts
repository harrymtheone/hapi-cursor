import { Hono } from 'hono'
import type { Session, SyncEngine } from '../../../../sync/syncEngine'
import { registerApiErrorHandler } from '../../../middleware/apiRouteError'
import type { WebAppEnv } from '../../../middleware/auth'
import { createSessionsRoutes } from '../index'

export function createSession(overrides?: Partial<Session>): Session {
    const legacyScopeField = 'name' + 'space'
    const baseMetadata = {
        path: '/tmp/project',
        host: 'localhost'
    }
    const base = {
        id: 'session-1',
        [legacyScopeField]: 'default',
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
    } as unknown as Session

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

export type EngineOverrides = Partial<SyncEngine> & {
    resolveSessionAccess?: SyncEngine['resolveSessionAccess']
}

export function createApp(session: Session | null, engineOverrides: EngineOverrides = {}) {
    const applySessionConfigCalls: Array<[string, Record<string, unknown>]> = []
    const baseEngine: Partial<SyncEngine> = {
        resolveSessionAccess: ((sessionId: string) => {
            if (!session || sessionId !== session.id) {
                return { ok: false, reason: 'not-found' as const }
            }
            return { ok: true, sessionId: session.id, session }
        }) as SyncEngine['resolveSessionAccess'],
        applySessionConfig: (async (sessionId: string, config: Record<string, unknown>) => {
            applySessionConfigCalls.push([sessionId, config])
        }) as unknown as SyncEngine['applySessionConfig'],
        resumeSession: (async (sessionId: string) => ({ type: 'success', sessionId })) as unknown as SyncEngine['resumeSession'],
        abortSession: (async () => { }) as unknown as SyncEngine['abortSession'],
        archiveSession: (async () => { }) as unknown as SyncEngine['archiveSession'],
        switchSession: (async () => { }) as unknown as SyncEngine['switchSession'],
        renameSession: (async () => { }) as unknown as SyncEngine['renameSession'],
        deleteSession: (async () => { }) as unknown as SyncEngine['deleteSession'],
        uploadFile: (async () => ({ success: true })) as unknown as SyncEngine['uploadFile'],
        deleteUploadFile: (async () => ({ success: true })) as unknown as SyncEngine['deleteUploadFile'],
        listSlashCommands: (async () => ({ success: true, commands: [] })) as unknown as SyncEngine['listSlashCommands'],
        listSkills: (async () => ({ success: true })) as unknown as SyncEngine['listSkills'],
        getSessions: (() => (session ? [session] : [])) as unknown as SyncEngine['getSessions']
    }
    const engine = { ...baseEngine, ...engineOverrides } as SyncEngine

    const app = new Hono<WebAppEnv>()
    registerApiErrorHandler(app)
    app.route('/api', createSessionsRoutes(() => engine))

    return { app, engine, applySessionConfigCalls }
}
