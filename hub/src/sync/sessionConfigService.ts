import { SkillPolicyStateSchema, type SkillPolicyState } from '@hapi/protocol/schemas'
import type { Metadata, PermissionMode } from '@hapi/protocol/types'
import { EventPublisher } from './eventPublisher'
import { SessionRepository } from './sessionRepository'

const SKILL_POLICY_MAX_KEYS = 200
const SKILL_POLICY_NAME_MAX_LEN = 128

function assertSkillPolicyName(name: string): void {
    if (name.length > SKILL_POLICY_NAME_MAX_LEN) {
        throw new Error(`Skill policy name exceeds maximum length of ${SKILL_POLICY_NAME_MAX_LEN}`)
    }
}

function validateSkillPolicyMap(skillPolicy: Record<string, SkillPolicyState>): void {
    const keys = Object.keys(skillPolicy)
    if (keys.length > SKILL_POLICY_MAX_KEYS) {
        throw new Error(`skillPolicy exceeds maximum of ${SKILL_POLICY_MAX_KEYS} keys`)
    }
    for (const name of keys) {
        assertSkillPolicyName(name)
        SkillPolicyStateSchema.parse(skillPolicy[name])
    }
}

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

    async applySkillPolicy(
        sessionId: string,
        update: { name: string; state: SkillPolicyState }
    ): Promise<void> {
        assertSkillPolicyName(update.name)
        const state = SkillPolicyStateSchema.parse(update.state)

        const session = this.repository.sessions.get(sessionId)
        if (!session) {
            throw new Error('Session not found')
        }

        const currentMetadata = (session.metadata ?? { path: '', host: '' }) as Metadata
        const currentPolicy = currentMetadata.skillPolicy ?? {}
        const nextPolicy: Record<string, SkillPolicyState> = { ...currentPolicy, [update.name]: state }
        if (Object.keys(nextPolicy).length > SKILL_POLICY_MAX_KEYS) {
            throw new Error(`skillPolicy exceeds maximum of ${SKILL_POLICY_MAX_KEYS} keys`)
        }

        await this.writeSkillPolicyMetadata(sessionId, currentMetadata, nextPolicy, session.metadataVersion)
    }

    async applySkillPolicyBatch(
        sessionId: string,
        skillPolicy: Record<string, SkillPolicyState>
    ): Promise<void> {
        validateSkillPolicyMap(skillPolicy)

        const session = this.repository.sessions.get(sessionId)
        if (!session) {
            throw new Error('Session not found')
        }

        const currentMetadata = (session.metadata ?? { path: '', host: '' }) as Metadata
        await this.writeSkillPolicyMetadata(sessionId, currentMetadata, skillPolicy, session.metadataVersion)
    }

    async resetSessionSkillPolicy(sessionId: string): Promise<void> {
        const session = this.repository.sessions.get(sessionId)
        if (!session) {
            throw new Error('Session not found')
        }

        const currentMetadata = (session.metadata ?? { path: '', host: '' }) as Metadata
        const { skillPolicy: _removed, ...metadataWithoutPolicy } = currentMetadata

        const result = this.repository.store.sessions.updateSessionMetadata(
            sessionId,
            metadataWithoutPolicy,
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

    private async writeSkillPolicyMetadata(
        sessionId: string,
        currentMetadata: Metadata,
        skillPolicy: Record<string, SkillPolicyState>,
        metadataVersion: number
    ): Promise<void> {
        const newMetadata: Metadata = { ...currentMetadata, skillPolicy }

        const result = this.repository.store.sessions.updateSessionMetadata(
            sessionId,
            newMetadata,
            metadataVersion,
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
