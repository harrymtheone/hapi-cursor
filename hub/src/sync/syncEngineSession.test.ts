import { describe, expect, it, mock } from 'bun:test'
import type { CursorRuntimeConfigApplyResult, Session } from '@hapi/protocol/types'
import { SyncEngineSession } from './syncEngineSession'

function createSession(overrides: Partial<Session> = {}): Session {
    return {
        id: 'session-1',
        seq: 1,
        createdAt: 1,
        updatedAt: 1,
        active: true,
        activeAt: 1,
        metadata: { path: '/tmp/project', host: 'localhost' },
        metadataVersion: 1,
        agentState: null,
        agentStateVersion: 1,
        thinking: false,
        thinkingAt: 1,
        model: 'cursor-runtime-model-current',
        modelReasoningEffort: null,
        effort: null,
        permissionMode: 'default',
        ...overrides
    } as Session
}

function createFacade(
    session: Session,
    rpcResult: CursorRuntimeConfigApplyResult
): { facade: SyncEngineSession; applySessionConfig: ReturnType<typeof mock> } {
    const applySessionConfig = mock(() => undefined)
    const sessionCache = {
        getSession: mock((sessionId: string) => sessionId === session.id ? session : undefined),
        refreshSession: mock(() => null),
        applySessionConfig
    }
    const facade = new SyncEngineSession(
        sessionCache as never,
        {} as never,
        {} as never,
        { requestSessionConfig: mock(async () => rpcResult) } as never,
        { emit: mock(() => undefined) } as never,
        { everyMs: mock(() => ({ cancel: mock(() => undefined) })) } as never
    )

    return { facade, applySessionConfig }
}

describe('SyncEngineSession.applySessionConfig', () => {
    it('persists active-session fields returned by applies-next-run acknowledgement', async () => {
        const result: CursorRuntimeConfigApplyResult = {
            status: 'applies-next-run',
            model: 'cursor-runtime-model-next',
            modelReasoningEffort: 'medium',
            effort: null,
            reason: 'unknown'
        }
        const { facade, applySessionConfig } = createFacade(createSession(), result)

        await expect(facade.applySessionConfig('session-1', { model: 'cursor-runtime-model-next' })).resolves.toEqual(result)

        expect(applySessionConfig).toHaveBeenCalledWith('session-1', {
            model: 'cursor-runtime-model-next',
            modelReasoningEffort: 'medium',
            effort: null
        })
    })

    it('does not persist active-session fields when runtime apply fails', async () => {
        const result: CursorRuntimeConfigApplyResult = {
            status: 'failed',
            model: 'cursor-runtime-model-next',
            modelReasoningEffort: null,
            effort: null,
            reason: 'unknown'
        }
        const { facade, applySessionConfig } = createFacade(createSession(), result)

        await expect(facade.applySessionConfig('session-1', { model: 'cursor-runtime-model-next' })).resolves.toEqual(result)

        expect(applySessionConfig).not.toHaveBeenCalled()
    })
})
