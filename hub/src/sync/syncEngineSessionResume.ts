/**
 * Resume / handoff helpers for SyncEngineSession.
 *
 * Plan 08-02 Task 2 deviation (Rule 3): the plan put all session-domain methods in
 * a single `syncEngineSession.ts`, but that file exceeded the 400-line SC#1 budget.
 * Extracted `resolveLocalResumeTarget` / `listLocalResumableSessions` / `resumeSession`
 * / `handoffSessionToLocal` / `waitForSessionActive` / `waitForSessionInactive` here.
 * Both whitelisted promise-sleep retries live in this file.
 */
import type { LocalResumeTarget, ResumableSession } from '@hapi/protocol'
import type { AgentFlavor, PermissionMode, Session } from '@hapi/protocol/types'
import type { MachineCache } from './machineCache'
import type { RpcGateway } from './rpcGateway'
import type { SessionCache } from './sessionCache'
import type { LocalHandoffResult, LocalResumeTargetResult, ResumeSessionResult } from './syncEngineSessionTypes'

function resolveFlavor(_session: Session): AgentFlavor {
    return 'cursor'
}

function resolveAgentResumeId(session: Session): string | null {
    return session.metadata?.cursorSessionId ?? null
}

export class SyncEngineSessionResume {
    constructor(
        private readonly sessionCache: SessionCache,
        private readonly machineCache: MachineCache,
        private readonly rpcGateway: RpcGateway,
        private readonly getSession: (sessionId: string) => Session | undefined
    ) {}

    resolveLocalResumeTarget(sessionId: string, _scope?: string): LocalResumeTargetResult {
        const access = this.sessionCache.resolveSessionAccess(sessionId)
        if (!access.ok) {
            return { type: 'error', message: 'Session not found', code: 'session_not_found' }
        }

        const session = access.session
        const metadata = session.metadata
        if (!metadata || typeof metadata.path !== 'string' || metadata.path.length === 0) {
            return { type: 'error', message: 'Session metadata missing path', code: 'resume_unavailable' }
        }

        const agentSessionId = resolveAgentResumeId(session)
        if (!agentSessionId) {
            return { type: 'error', message: 'Resume session ID unavailable', code: 'resume_unavailable' }
        }

        return {
            type: 'success',
            target: {
                sessionId: access.sessionId,
                flavor: resolveFlavor(session),
                directory: metadata.path,
                machineId: metadata.machineId,
                host: metadata.host,
                active: session.active,
                thinking: session.thinking,
                controlledByUser: session.agentState?.controlledByUser === true,
                agentSessionId,
                model: session.model ?? null,
                effort: session.effort ?? null,
                modelReasoningEffort: session.modelReasoningEffort ?? null,
                permissionMode: session.permissionMode
            }
        }
    }

    listLocalResumableSessions(
        scopeOrOpts?: string | { machineId?: string },
        legacyOpts?: { machineId?: string }
    ): ResumableSession[] {
        const opts = typeof scopeOrOpts === 'string' ? legacyOpts : scopeOrOpts
        const sessions = this.sessionCache.getSessions()

        return sessions
            .map((session) => this.resolveLocalResumeTarget(session.id))
            .filter((result): result is { type: 'success'; target: LocalResumeTarget } => result.type === 'success')
            .map(({ target }) => {
                const session = this.getSession(target.sessionId)
                return {
                    sessionId: target.sessionId,
                    flavor: target.flavor,
                    directory: target.directory,
                    machineId: target.machineId,
                    host: target.host,
                    active: target.active,
                    thinking: target.thinking,
                    controlledByUser: target.controlledByUser,
                    agentSessionId: target.agentSessionId,
                    model: target.model,
                    effort: target.effort,
                    modelReasoningEffort: target.modelReasoningEffort,
                    permissionMode: target.permissionMode,
                    updatedAt: session?.updatedAt ?? 0,
                    name: session?.metadata?.name,
                    summary: session?.metadata?.summary?.text
                }
            })
            .filter((session) => !opts?.machineId || session.machineId === opts.machineId)
            .sort((a, b) => b.updatedAt - a.updatedAt)
    }

    async resumeSession(
        sessionId: string,
        scopeOrOpts?: string | { permissionMode?: PermissionMode },
        legacyOpts?: { permissionMode?: PermissionMode }
    ): Promise<ResumeSessionResult> {
        const opts = typeof scopeOrOpts === 'string' ? legacyOpts : scopeOrOpts
        const access = this.sessionCache.resolveSessionAccess(sessionId)
        if (!access.ok) {
            return { type: 'error', message: 'Session not found', code: 'session_not_found' }
        }

        const session = access.session
        if (session.active) {
            return { type: 'success', sessionId: access.sessionId }
        }

        const targetResult = this.resolveLocalResumeTarget(access.sessionId)
        if (targetResult.type === 'error') {
            return targetResult
        }

        const target = targetResult.target
        const metadata = session.metadata!
        const resumeToken = target.agentSessionId

        const onlineMachines = this.machineCache.getOnlineMachines()
        if (onlineMachines.length === 0) {
            return { type: 'error', message: 'No machine online', code: 'no_machine_online' }
        }

        const targetMachine = (() => {
            if (metadata.machineId) {
                const exact = onlineMachines.find((m) => m.id === metadata.machineId)
                if (exact) return exact
            }
            if (metadata.host) {
                const hostMatch = onlineMachines.find((m) => m.metadata?.host === metadata.host)
                if (hostMatch) return hostMatch
            }
            return null
        })()

        if (!targetMachine) {
            return { type: 'error', message: 'No machine online', code: 'no_machine_online' }
        }

        const effectivePermissionMode = opts?.permissionMode ?? session.permissionMode ?? undefined
        const spawnResult = await this.rpcGateway.spawnSession(
            targetMachine.id,
            target.directory,
            target.flavor,
            session.model ?? undefined,
            undefined,
            undefined,
            undefined,
            resumeToken,
            effectivePermissionMode
        )

        if (spawnResult.type !== 'success') {
            return { type: 'error', message: spawnResult.message, code: 'resume_failed' }
        }

        const becameActive = await this.waitForSessionActive(spawnResult.sessionId)
        if (!becameActive) {
            return { type: 'error', message: 'Session failed to become active', code: 'resume_failed' }
        }

        if (spawnResult.sessionId !== access.sessionId) {
            // The old session may have already been merged by the automatic dedup path
            // (triggered when the spawned CLI sets its agent session ID in metadata).
            // Only attempt the explicit merge if the old session still exists.
            const oldSession = this.sessionCache.getSession(access.sessionId)
            if (oldSession) {
                try {
                    await this.sessionCache.mergeSessions(access.sessionId, spawnResult.sessionId)
                } catch (error) {
                    const message = error instanceof Error ? error.message : 'Failed to merge resumed session'
                    return { type: 'error', message, code: 'resume_failed' }
                }
            }
        }

        return { type: 'success', sessionId: spawnResult.sessionId }
    }

    async handoffSessionToLocal(sessionId: string, _scope?: string): Promise<LocalHandoffResult> {
        const access = this.sessionCache.resolveSessionAccess(sessionId)
        if (!access.ok) {
            return { type: 'error', message: 'Session not found', code: 'session_not_found' }
        }

        if (!access.session.active) {
            return { type: 'success' }
        }

        if (access.session.agentState?.controlledByUser === true) {
            return {
                type: 'error',
                message: 'Session is already controlled by a local terminal',
                code: 'already_local'
            }
        }

        try {
            await this.rpcGateway.handoffSessionToLocal(access.sessionId)
        } catch (error) {
            return {
                type: 'error',
                message: error instanceof Error ? error.message : String(error),
                code: 'handoff_failed'
            }
        }

        const inactive = await this.waitForSessionInactive(access.sessionId)
        if (!inactive) {
            return {
                type: 'error',
                message: 'Timed out waiting for remote session to hand off',
                code: 'handoff_failed'
            }
        }

        return { type: 'success' }
    }

    async waitForSessionActive(sessionId: string, timeoutMs: number = 15_000): Promise<boolean> {
        const start = Date.now()
        while (Date.now() - start < timeoutMs) {
            const session = this.getSession(sessionId)
            if (session?.active) {
                return true
            }
            // scheduler-exempt: promise-sleep retry
            await new Promise((resolve) => setTimeout(resolve, 250))
        }
        return false
    }

    async waitForSessionInactive(sessionId: string, timeoutMs: number = 15_000): Promise<boolean> {
        const start = Date.now()
        while (Date.now() - start < timeoutMs) {
            const session = this.getSession(sessionId)
            if (!session?.active) {
                return true
            }
            // scheduler-exempt: promise-sleep retry
            await new Promise((resolve) => setTimeout(resolve, 250))
        }
        return false
    }
}
