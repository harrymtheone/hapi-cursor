import type { PermissionMode } from '@hapi/protocol/types'
import { EventPublisher } from './eventPublisher'
import { SessionRepository } from './sessionRepository'

/**
 * SessionConfigService — config writes (model/effort/permissionMode), rename, delete.
 *
 * Accesses Store only via `this.repository.store` (D-129).
 */
export class SessionConfigService {
    constructor(
        private readonly repository: SessionRepository,
        private readonly publisher: EventPublisher
    ) {
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
        const session = this.repository.sessions.get(sessionId) ?? this.repository.refreshSession(sessionId)
        if (!session) {
            return
        }

        const hasConfigFields = config.permissionMode !== undefined
            || config.model !== undefined
            || config.modelReasoningEffort !== undefined
            || config.effort !== undefined
        if (!hasConfigFields) {
            return
        }

        if (config.permissionMode !== undefined) {
            session.permissionMode = config.permissionMode
        }
        if (config.model !== undefined) {
            if (config.model !== session.model) {
                const stored = this.repository.store.sessions.getSession(sessionId)
                if (!stored) {
                    throw new Error('Session not found')
                }
                const updated = this.repository.store.sessions.setSessionModel(sessionId, config.model, {
                    touchUpdatedAt: false
                })
                if (!updated) {
                    throw new Error('Failed to update session model')
                }
            }
            session.model = config.model
        }
        if (config.modelReasoningEffort !== undefined) {
            if (config.modelReasoningEffort !== session.modelReasoningEffort) {
                const stored = this.repository.store.sessions.getSession(sessionId)
                if (!stored) {
                    throw new Error('Session not found')
                }
                const updated = this.repository.store.sessions.setSessionModelReasoningEffort(sessionId, config.modelReasoningEffort, {
                    touchUpdatedAt: false
                })
                if (!updated) {
                    throw new Error('Failed to update session model reasoning effort')
                }
            }
            session.modelReasoningEffort = config.modelReasoningEffort
        }
        if (config.effort !== undefined) {
            if (config.effort !== session.effort) {
                const stored = this.repository.store.sessions.getSession(sessionId)
                if (!stored) {
                    throw new Error('Session not found')
                }
                const updated = this.repository.store.sessions.setSessionEffort(sessionId, config.effort, {
                    touchUpdatedAt: false
                })
                if (!updated) {
                    throw new Error('Failed to update session effort')
                }
            }
            session.effort = config.effort
        }

        this.publisher.emit({ type: 'session-updated', sessionId, data: session })
    }

    async renameSession(sessionId: string, name: string): Promise<void> {
        const session = this.repository.sessions.get(sessionId)
        if (!session) {
            throw new Error('Session not found')
        }

        const currentMetadata = session.metadata ?? { path: '', host: '' }
        const newMetadata = { ...currentMetadata, name }

        const result = this.repository.store.sessions.updateSessionMetadata(
            sessionId,
            newMetadata,
            session.metadataVersion,
            { touchUpdatedAt: false }
        )

        if (result.result === 'error') {
            throw new Error('Failed to update session metadata')
        }

        if (result.result === 'version-mismatch') {
            throw new Error('Session was modified concurrently. Please try again.')
        }

        this.repository.refreshSession(sessionId)
    }

    async deleteSession(sessionId: string): Promise<void> {
        const session = this.repository.sessions.get(sessionId)
        if (!session) {
            throw new Error('Session not found')
        }

        if (session.active) {
            throw new Error('Cannot delete active session')
        }

        const deleted = this.repository.store.sessions.deleteSession(sessionId)
        if (!deleted) {
            throw new Error('Failed to delete session')
        }

        this.repository.sessions.delete(sessionId)
        this.repository.lastBroadcastAtBySessionId.delete(sessionId)
        this.repository.todoBackfillAttemptedSessionIds.delete(sessionId)
        this.repository.pendingThinkingUntilBySessionId.delete(sessionId)

        this.publisher.emit({ type: 'session-removed', sessionId })
    }
}
