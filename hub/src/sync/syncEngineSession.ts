/**
 * Session-domain sub-facade of SyncEngine.
 *
 * Owns the session lifecycle methods + the inactivity sweep timer. Plan 08-02
 * Task 2 keeps raw setInterval; Task 3 routes it through KeepaliveScheduler.
 *
 * Constructor deviation (Rule 3 — missing critical functionality + line budget):
 * the plan's `<interfaces>` block names the constructor as `(sessionCache,
 * machineCache, publisher, sseManager)`, but inherited methods (resume / handoff,
 * applySessionConfig active branch, expireInactive's messageService sweep) need
 * `rpcGateway` + `messageService`. Adding them as constructor params instead of
 * `sseManager` (never read here). Also: resume/handoff/wait methods extracted
 * into `syncEngineSessionResume.ts` to satisfy the SC#1 < 400 line budget.
 */
import type { ResumableSession } from '@hapi/protocol'
import type { PermissionMode, Session, SyncEvent } from '@hapi/protocol/types'
import type { EventPublisher } from './eventPublisher'
import type { MachineCache } from './machineCache'
import type { MessageService } from './messageService'
import type { RpcGateway } from './rpcGateway'
import type { SessionCache } from './sessionCache'
import { SyncEngineSessionResume } from './syncEngineSessionResume'
import type { LocalHandoffResult, LocalResumeTargetResult, ResumeSessionResult } from './syncEngineSessionTypes'

export type { LocalHandoffResult, LocalResumeTargetResult, ResumeSessionResult } from './syncEngineSessionTypes'

export class SyncEngineSession {
    private inactivityTimer: NodeJS.Timeout | null = null
    private readonly resume: SyncEngineSessionResume

    constructor(
        private readonly sessionCache: SessionCache,
        private readonly machineCache: MachineCache,
        private readonly messageService: MessageService,
        private readonly rpcGateway: RpcGateway,
        private readonly eventPublisher: EventPublisher
    ) {
        this.resume = new SyncEngineSessionResume(
            sessionCache,
            machineCache,
            rpcGateway,
            (sessionId) => this.getSession(sessionId)
        )
    }

    start(): void {
        if (this.inactivityTimer) {
            return
        }
        this.inactivityTimer = setInterval(() => this.expireInactive(), 5_000)
    }

    shutdown(): void {
        if (this.inactivityTimer) {
            clearInterval(this.inactivityTimer)
            this.inactivityTimer = null
        }
    }

    reloadAll(): void {
        this.sessionCache.reloadAll()
        this.machineCache.reloadAll()
    }

    getSessions(): Session[] {
        return this.sessionCache.getSessions()
    }

    getSession(sessionId: string): Session | undefined {
        return this.sessionCache.getSession(sessionId) ?? this.sessionCache.refreshSession(sessionId) ?? undefined
    }

    resolveSessionAccess(
        sessionId: string
    ): { ok: true; sessionId: string; session: Session } | { ok: false; reason: 'not-found' } {
        return this.sessionCache.resolveSessionAccess(sessionId)
    }

    getActiveSessions(): Session[] {
        return this.sessionCache.getActiveSessions()
    }

    getOrCreateSession(
        tag: string,
        metadata: unknown,
        agentState: unknown,
        options?: { model?: string; effort?: string; modelReasoningEffort?: string }
    ): Session {
        return this.sessionCache.getOrCreateSession(tag, metadata, agentState, options)
    }

    handleRealtimeEvent(event: SyncEvent): void {
        if (event.type === 'session-updated' && event.sessionId) {
            const before = this.sessionCache.getSession(event.sessionId)
            this.sessionCache.refreshSession(event.sessionId)
            const after = this.sessionCache.getSession(event.sessionId)
            if (after?.metadata && !this.hasSameAgentSessionIds(before?.metadata ?? null, after.metadata)) {
                void this.sessionCache.deduplicateByAgentSessionId(event.sessionId).catch(() => {
                    // best-effort: dedup failure is harmless, web-side safety net hides remaining duplicates
                })
            }
            return
        }

        if (event.type === 'machine-updated' && event.machineId) {
            this.machineCache.refreshMachine(event.machineId)
            return
        }

        if (event.type === 'message-received' && event.sessionId) {
            if (!this.getSession(event.sessionId)) {
                this.sessionCache.refreshSession(event.sessionId)
            }
        }

        this.eventPublisher.emit(event)
    }

    handleSessionAlive(payload: {
        sid: string
        time: number
        thinking?: boolean
        mode?: 'local' | 'remote'
        permissionMode?: PermissionMode
        model?: string | null
        modelReasoningEffort?: string | null
        effort?: string | null
    }): void {
        this.sessionCache.handleSessionAlive(payload)
        this.triggerDedupIfNeeded(payload.sid)
    }

    handleSessionEnd(payload: { sid: string; time: number; reason?: 'completed' | 'terminated' | 'error' }): void {
        this.sessionCache.handleSessionEnd(payload)
        this.eventPublisher.emit({ type: 'session-ended', sessionId: payload.sid, reason: payload.reason })
        // Retry dedup now that this session is inactive — a prior dedup may have
        // skipped it because it was still active at the time.
        this.triggerDedupIfNeeded(payload.sid)
    }

    handleBackgroundTaskDelta(sessionId: string, delta: { started: number; completed: number }): void {
        this.sessionCache.applyBackgroundTaskDelta(sessionId, delta)
    }

    recordSessionActivity(sessionId: string, updatedAt: number): void {
        this.sessionCache.recordSessionActivity(sessionId, updatedAt)
    }

    expireInactive(): void {
        const expired = this.sessionCache.expireInactive()
        // Sort by most recent first so dedup keeps the newest session when multiple
        // duplicates for the same agent thread expire in the same sweep.
        const sorted = expired
            .map((id) => this.sessionCache.getSession(id))
            .filter((s): s is NonNullable<typeof s> => s != null)
            .sort((a, b) => (b.activeAt - a.activeAt) || (b.updatedAt - a.updatedAt))
        for (const session of sorted) {
            this.triggerDedupIfNeeded(session.id)
        }
        this.machineCache.expireInactive()
        // Piggybacked on the inactivity tick; not a logical part of expireInactive
        // but shares its 5s cadence (avoids a second timer).
        this.messageService.releaseMatureScheduledMessages(Date.now())
    }

    async renameSession(sessionId: string, name: string): Promise<void> {
        await this.sessionCache.renameSession(sessionId, name)
    }

    async deleteSession(sessionId: string): Promise<void> {
        await this.sessionCache.deleteSession(sessionId)
    }

    async applySessionConfig(
        sessionId: string,
        config: {
            permissionMode?: PermissionMode
            model?: string | null
            modelReasoningEffort?: string | null
            effort?: string | null
        }
    ): Promise<void> {
        const session = this.sessionCache.getSession(sessionId)
        if (!session?.active) {
            // For inactive sessions, update the in-memory cache directly without
            // an RPC call — the CLI is not running yet. The updated value will be
            // passed to the spawned process when the session is resumed.
            this.sessionCache.applySessionConfig(sessionId, config)
            return
        }

        const result = await this.rpcGateway.requestSessionConfig(sessionId, config)
        if (!result || typeof result !== 'object') {
            throw new Error('Invalid response from session config RPC')
        }
        const applied = (result as { applied?: {
            permissionMode?: Session['permissionMode']
            model?: Session['model']
            modelReasoningEffort?: Session['modelReasoningEffort']
            effort?: Session['effort']
        } }).applied
        if (!applied || typeof applied !== 'object') {
            throw new Error('Missing applied session config')
        }

        this.sessionCache.applySessionConfig(sessionId, applied)
    }

    resolveLocalResumeTarget(sessionId: string, _scope?: string): LocalResumeTargetResult {
        return this.resume.resolveLocalResumeTarget(sessionId, _scope)
    }

    listLocalResumableSessions(
        scopeOrOpts?: string | { machineId?: string },
        legacyOpts?: { machineId?: string }
    ): ResumableSession[] {
        return this.resume.listLocalResumableSessions(scopeOrOpts, legacyOpts)
    }

    resumeSession(
        sessionId: string,
        scopeOrOpts?: string | { permissionMode?: PermissionMode },
        legacyOpts?: { permissionMode?: PermissionMode }
    ): Promise<ResumeSessionResult> {
        return this.resume.resumeSession(sessionId, scopeOrOpts, legacyOpts)
    }

    handoffSessionToLocal(sessionId: string, _scope?: string): Promise<LocalHandoffResult> {
        return this.resume.handoffSessionToLocal(sessionId, _scope)
    }

    waitForSessionActive(sessionId: string, timeoutMs: number = 15_000): Promise<boolean> {
        return this.resume.waitForSessionActive(sessionId, timeoutMs)
    }

    waitForSessionInactive(sessionId: string, timeoutMs: number = 15_000): Promise<boolean> {
        return this.resume.waitForSessionInactive(sessionId, timeoutMs)
    }

    hasSameAgentSessionIds(
        prev: Session['metadata'] | null,
        next: NonNullable<Session['metadata']>
    ): boolean {
        return (prev?.cursorSessionId ?? null) === (next.cursorSessionId ?? null)
    }

    triggerDedupIfNeeded(sessionId: string): void {
        const session = this.sessionCache.getSession(sessionId)
        if (session?.metadata) {
            void this.sessionCache.deduplicateByAgentSessionId(sessionId).catch(() => {
                // best-effort: web-side safety net hides remaining duplicates
            })
        }
    }
}
