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
    it('persists active-session supported fields returned by applies-next-run acknowledgement', async () => {
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
            model: 'cursor-runtime-model-next'
        })
    })

    it('does not persist unsupported active-session effort fields returned by acknowledgement', async () => {
        const result: CursorRuntimeConfigApplyResult = {
            status: 'applies-next-run',
            model: 'cursor-runtime-model-current',
            modelReasoningEffort: 'medium',
            effort: 'background',
            reason: 'unknown'
        }
        const { facade, applySessionConfig } = createFacade(createSession(), result)

        await expect(facade.applySessionConfig('session-1', {
            modelReasoningEffort: 'medium',
            effort: 'background'
        })).resolves.toEqual(result)

        expect(applySessionConfig).toHaveBeenCalledWith('session-1', {
            model: 'cursor-runtime-model-current'
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

    it('strips unsupported effort fields before inactive session-cache persistence', async () => {
        const { facade, applySessionConfig } = createFacade(createSession({
            active: false,
            modelReasoningEffort: 'medium',
            effort: 'background'
        }), {
            status: 'failed',
            model: 'cursor-runtime-model-current',
            modelReasoningEffort: 'medium',
            effort: 'background',
            reason: 'unknown'
        })

        await expect(facade.applySessionConfig('session-1', {
            modelReasoningEffort: 'medium',
            effort: 'background'
        })).resolves.toEqual({
            status: 'failed',
            model: 'cursor-runtime-model-current',
            modelReasoningEffort: 'medium',
            effort: 'background',
            reason: 'unknown'
        })

        expect(applySessionConfig).not.toHaveBeenCalled()
    })

    it('does not persist effort-only inactive payloads as session-cache writes', async () => {
        const { facade, applySessionConfig } = createFacade(createSession({
            active: false,
            effort: 'high'
        }), {
            status: 'failed',
            model: 'cursor-runtime-model-current',
            modelReasoningEffort: null,
            effort: 'high',
            reason: 'unknown'
        })

        const result = await facade.applySessionConfig('session-1', { effort: 'high' })

        expect(result).toEqual({
            status: 'failed',
            model: 'cursor-runtime-model-current',
            modelReasoningEffort: null,
            effort: 'high',
            reason: 'unknown'
        })
        expect(result.status).not.toBe('applies-next-run')
        expect(applySessionConfig).not.toHaveBeenCalled()
    })

    it('persists only supported model fields for inactive session-cache requests', async () => {
        const result: CursorRuntimeConfigApplyResult = {
            status: 'applies-next-run',
            model: 'cursor-runtime-model-next',
            modelReasoningEffort: null,
            effort: null,
            reason: 'unknown'
        }
        const { facade, applySessionConfig } = createFacade(createSession({ active: false }), result)

        await expect(facade.applySessionConfig('session-1', {
            model: 'cursor-runtime-model-next',
            modelReasoningEffort: 'medium',
            effort: 'background'
        })).resolves.toEqual(result)

        expect(applySessionConfig).toHaveBeenCalledWith('session-1', {
            model: 'cursor-runtime-model-next'
        })
    })
})
