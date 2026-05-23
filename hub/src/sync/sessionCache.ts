import type { PermissionMode, Session } from '@hapi/protocol/types'
import type { Store } from '../store'
import { EventPublisher } from './eventPublisher'
import { SessionConfigService } from './sessionConfigService'
import { SessionLivenessService } from './sessionLivenessService'
import { SessionMergeService } from './sessionMergeService'
import { SessionRepository } from './sessionRepository'
import type { SessionActivity } from './sessionActivity'

/**
 * Facade: see sessionRepository / sessionLivenessService / sessionConfigService /
 * sessionMergeService for implementation. Class name preserved per D-130 — callers
 * (SyncEngine, socket handlers, routes) do not change their imports.
 */
export class SessionCache {
    private readonly repository: SessionRepository
    private readonly liveness: SessionLivenessService
    private readonly config: SessionConfigService
    private readonly merge: SessionMergeService

    constructor(store: Store, publisher: EventPublisher) {
        this.repository = new SessionRepository(store, publisher)
        this.liveness = new SessionLivenessService(this.repository, publisher)
        this.config = new SessionConfigService(this.repository, publisher)
        this.merge = new SessionMergeService(this.repository, publisher)
    }

    getSessions(): Session[] {
        return this.repository.getSessions()
    }

    getSession(sessionId: string): Session | undefined {
        return this.repository.getSession(sessionId)
    }

    resolveSessionAccess(
        sessionId: string
    ): { ok: true; sessionId: string; session: Session } | { ok: false; reason: 'not-found' }
    resolveSessionAccess(sessionId: string): { ok: true; sessionId: string; session: Session } | { ok: false; reason: 'not-found' } {
        return this.repository.resolveSessionAccess(sessionId)
    }

    getActiveSessions(): Session[] {
        return this.repository.getActiveSessions()
    }

    getOrCreateSession(
        tag: string,
        metadata: unknown,
        agentState: unknown,
        options?: { model?: string; effort?: string; modelReasoningEffort?: string }
    ): Session
    getOrCreateSession(
        tag: string,
        metadata: unknown,
        agentState: unknown,
        options?: { model?: string; effort?: string; modelReasoningEffort?: string }
    ): Session {
        return this.repository.getOrCreateSession(tag, metadata, agentState, options)
    }

    refreshSession(sessionId: string): Session | null {
        return this.repository.refreshSession(sessionId)
    }

    reloadAll(): void {
        this.repository.reloadAll()
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
        this.liveness.handleSessionAlive(payload)
    }

    markMessageQueued(sessionId: string, time: number = Date.now()): void {
        this.liveness.markMessageQueued(sessionId, time)
    }

    applyBackgroundTaskDelta(sessionId: string, delta: { started: number; completed: number }): void {
        this.liveness.applyBackgroundTaskDelta(sessionId, delta)
    }

    recordSessionActivity(sessionId: string, updatedAt: number, activity?: SessionActivity): void {
        this.liveness.recordSessionActivity(sessionId, updatedAt, activity)
    }

    handleSessionEnd(payload: { sid: string; time: number }): void {
        this.liveness.handleSessionEnd(payload)
    }

    expireInactive(now: number = Date.now()): string[] {
        return this.liveness.expireInactive(now)
    }

    applySessionConfig(
        sessionId: string,
        config: {
            permissionMode?: PermissionMode
            model?: string | null
            modelReasoningEffort?: string | null
            effort?: string | null
        }
    ): void {
        this.config.applySessionConfig(sessionId, config)
    }

    async renameSession(sessionId: string, name: string): Promise<void> {
        await this.config.renameSession(sessionId, name)
    }

    async deleteSession(sessionId: string): Promise<void> {
        await this.config.deleteSession(sessionId)
    }

    async mergeSessions(oldSessionId: string, newSessionId: string): Promise<void> {
        await this.merge.mergeSessions(oldSessionId, newSessionId)
    }

    async mergeSessionHistory(
        oldSessionId: string,
        newSessionId: string,
        options: { mergeAgentState?: boolean } = {}
    ): Promise<void> {
        await this.merge.mergeSessionHistory(oldSessionId, newSessionId, options)
    }

    async deduplicateByAgentSessionId(sessionId: string): Promise<void> {
        await this.merge.deduplicateByAgentSessionId(sessionId)
    }
}
