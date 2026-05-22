import type { Session } from '@hapi/protocol/types'
import { EventPublisher } from './eventPublisher'
import { SessionRepository } from './sessionRepository'

/**
 * SessionMergeService — merge, history merge, agent-session-id dedup.
 *
 * Private helpers (`mergeSessionData`, `mergeSessionMetadata`, `mergeAgentState`,
 * `extractAgentSessionId`) stay private inside this class (Pitfall 3).
 *
 * The existing `Store.transaction` call inside `mergeSessionData` is preserved
 * verbatim — no transaction-wrapping abstraction is introduced (D-131).
 */
export class SessionMergeService {
    private readonly deduplicateInProgress: Set<string> = new Set()
    private readonly deduplicatePending: Set<string> = new Set()

    constructor(
        private readonly repository: SessionRepository,
        private readonly publisher: EventPublisher
    ) {
    }

    async mergeSessions(oldSessionId: string, newSessionId: string): Promise<void> {
        await this.mergeSessionData(oldSessionId, newSessionId, { deleteOldSession: true })
    }

    async mergeSessionHistory(
        oldSessionId: string,
        newSessionId: string,
        options: { mergeAgentState?: boolean } = {}
    ): Promise<void> {
        await this.mergeSessionData(oldSessionId, newSessionId, {
            deleteOldSession: false,
            mergeAgentState: options.mergeAgentState ?? true
        })
    }

    private async mergeSessionData(
        oldSessionId: string,
        newSessionId: string,
        options: { deleteOldSession: boolean; mergeAgentState?: boolean }
    ): Promise<void> {
        if (oldSessionId === newSessionId) {
            return
        }

        const store = this.repository.store
        const oldStored = store.sessions.getSession(oldSessionId)
        const newStored = store.sessions.getSession(newSessionId)
        if (!oldStored || !newStored) {
            throw new Error('Session not found for merge')
        }
        const movedMessages = store.messages.mergeSessionMessages(oldSessionId, newSessionId)
        if (movedMessages.moved > 0) {
            if (!options.deleteOldSession) {
                this.publisher.emit({ type: 'messages-invalidated', sessionId: oldSessionId })
            }
            this.publisher.emit({ type: 'messages-invalidated', sessionId: newSessionId })
        }

        const mergedMetadata = this.mergeSessionMetadata(oldStored.metadata, newStored.metadata)
        if (mergedMetadata !== null && mergedMetadata !== newStored.metadata) {
            for (let attempt = 0; attempt < 2; attempt += 1) {
                const latest = store.sessions.getSession(newSessionId)
                if (!latest) break
                const result = store.sessions.updateSessionMetadata(
                    newSessionId,
                    mergedMetadata,
                    latest.metadataVersion,
                    { touchUpdatedAt: false }
                )
                if (result.result === 'success') {
                    break
                }
                if (result.result === 'error') {
                    break
                }
            }
        }

        if (newStored.model === null && oldStored.model !== null) {
            const updated = store.sessions.setSessionModel(newSessionId, oldStored.model, {
                touchUpdatedAt: false
            })
            if (!updated) {
                throw new Error('Failed to preserve session model during merge')
            }
        }

        if (newStored.modelReasoningEffort === null && oldStored.modelReasoningEffort !== null) {
            const updated = store.sessions.setSessionModelReasoningEffort(newSessionId, oldStored.modelReasoningEffort, {
                touchUpdatedAt: false
            })
            if (!updated) {
                throw new Error('Failed to preserve session model reasoning effort during merge')
            }
        }

        if (newStored.effort === null && oldStored.effort !== null) {
            const updated = store.sessions.setSessionEffort(newSessionId, oldStored.effort, {
                touchUpdatedAt: false
            })
            if (!updated) {
                throw new Error('Failed to preserve session effort during merge')
            }
        }

        if (oldStored.todos !== null && oldStored.todosUpdatedAt !== null) {
            store.sessions.setSessionTodos(
                newSessionId,
                oldStored.todos,
                oldStored.todosUpdatedAt
            )
        }

        // Merge agentState: union requests/completedRequests from both sessions so pending
        // approvals on inactive duplicates are not lost. Active duplicates keep their
        // own agentState because permission approve/deny RPCs are routed by session id.
        // Read the latest target state right before writing to avoid overwriting live updates.
        if ((options.mergeAgentState ?? true) && oldStored.agentState !== null) {
            for (let attempt = 0; attempt < 2; attempt += 1) {
                const latest = store.sessions.getSession(newSessionId)
                if (!latest) break
                const mergedAgentState = this.mergeAgentState(oldStored.agentState, latest.agentState)
                if (mergedAgentState === null || mergedAgentState === latest.agentState) break
                const result = store.sessions.updateSessionAgentState(
                    newSessionId,
                    mergedAgentState,
                    latest.agentStateVersion
                )
                if (result.result !== 'version-mismatch') break
            }
        }

        if (oldStored.teamState !== null && oldStored.teamStateUpdatedAt !== null) {
            store.sessions.setSessionTeamState(
                newSessionId,
                oldStored.teamState,
                oldStored.teamStateUpdatedAt
            )
        }

        if (options.deleteOldSession) {
            const deleted = store.sessions.deleteSession(oldSessionId)
            if (!deleted) {
                throw new Error('Failed to delete old session during merge')
            }

            const existed = this.repository.sessions.delete(oldSessionId)
            if (existed) {
                this.publisher.emit({ type: 'session-removed', sessionId: oldSessionId })
            }
            this.repository.lastBroadcastAtBySessionId.delete(oldSessionId)
            this.repository.todoBackfillAttemptedSessionIds.delete(oldSessionId)
        } else {
            this.repository.refreshSession(oldSessionId)
        }

        const refreshed = this.repository.refreshSession(newSessionId)
        if (refreshed) {
            this.publisher.emit({ type: 'session-updated', sessionId: newSessionId, data: refreshed })
        }
    }

    private mergeSessionMetadata(oldMetadata: unknown | null, newMetadata: unknown | null): unknown | null {
        if (!oldMetadata || typeof oldMetadata !== 'object') {
            return newMetadata
        }
        if (!newMetadata || typeof newMetadata !== 'object') {
            return oldMetadata
        }

        const oldObj = oldMetadata as Record<string, unknown>
        const newObj = newMetadata as Record<string, unknown>
        const merged: Record<string, unknown> = { ...newObj }
        let changed = false

        if (typeof oldObj.name === 'string' && typeof newObj.name !== 'string') {
            merged.name = oldObj.name
            changed = true
        }

        const oldSummary = oldObj.summary as { text?: unknown; updatedAt?: unknown } | undefined
        const newSummary = newObj.summary as { text?: unknown; updatedAt?: unknown } | undefined
        const oldUpdatedAt = typeof oldSummary?.updatedAt === 'number' ? oldSummary.updatedAt : null
        const newUpdatedAt = typeof newSummary?.updatedAt === 'number' ? newSummary.updatedAt : null
        if (oldUpdatedAt !== null && (newUpdatedAt === null || oldUpdatedAt > newUpdatedAt)) {
            merged.summary = oldSummary
            changed = true
        }

        if (oldObj.worktree && !newObj.worktree) {
            merged.worktree = oldObj.worktree
            changed = true
        }

        if (typeof oldObj.path === 'string' && typeof newObj.path !== 'string') {
            merged.path = oldObj.path
            changed = true
        }
        if (typeof oldObj.host === 'string' && typeof newObj.host !== 'string') {
            merged.host = oldObj.host
            changed = true
        }

        return changed ? merged : newMetadata
    }

    private mergeAgentState(oldState: unknown | null, newState: unknown | null): unknown | null {
        if (oldState === null) return newState
        if (newState === null) return oldState

        const oldObj = oldState as Record<string, unknown>
        const newObj = newState as Record<string, unknown>

        const completedRequests = {
            ...((oldObj.completedRequests as Record<string, unknown> | undefined) ?? {}),
            ...((newObj.completedRequests as Record<string, unknown> | undefined) ?? {})
        }
        const completedIds = new Set(Object.keys(completedRequests))
        const requests = Object.fromEntries(
            Object.entries({
                ...((oldObj.requests as Record<string, unknown> | undefined) ?? {}),
                ...((newObj.requests as Record<string, unknown> | undefined) ?? {})
            }).filter(([id]) => !completedIds.has(id))
        )

        return { ...oldObj, ...newObj, requests, completedRequests }
    }

    private extractAgentSessionId(
        metadata: NonNullable<Session['metadata']>
    ): { field: 'cursorSessionId'; value: string } | null {
        if (metadata.cursorSessionId) return { field: 'cursorSessionId', value: metadata.cursorSessionId }
        return null
    }

    async deduplicateByAgentSessionId(sessionId: string): Promise<void> {
        const session = this.repository.sessions.get(sessionId)
        if (!session?.metadata) return

        const agentId = this.extractAgentSessionId(session.metadata)
        if (!agentId) return

        // Guard: if another dedup for this agent ID is already in progress,
        // coalesce this trigger and run one more pass afterwards.
        if (this.deduplicateInProgress.has(agentId.value)) {
            this.deduplicatePending.add(agentId.value)
            return
        }
        this.deduplicateInProgress.add(agentId.value)

        try {
            do {
                this.deduplicatePending.delete(agentId.value)

                const currentSession = this.repository.sessions.get(sessionId)
                const candidates: { id: string; session: Session }[] = []
                if (currentSession?.metadata && currentSession.metadata[agentId.field] === agentId.value) {
                    candidates.push({ id: sessionId, session: currentSession })
                }
                for (const [existingId, existing] of this.repository.sessions) {
                    if (existingId === sessionId) continue
                    if (!existing.metadata) continue
                    if (existing.metadata[agentId.field] !== agentId.value) continue
                    candidates.push({ id: existingId, session: existing })
                }

                if (candidates.length <= 1) continue

                const activeCandidates = candidates.filter(({ session }) => session.active)
                if (activeCandidates.length > 1) {
                    continue
                }

                candidates.sort((a, b) => {
                    if (a.session.active !== b.session.active) return a.session.active ? -1 : 1
                    const updatedDelta = b.session.updatedAt - a.session.updatedAt
                    if (updatedDelta !== 0) return updatedDelta
                    if (a.id === sessionId) return -1
                    if (b.id === sessionId) return 1
                    return b.session.activeAt - a.session.activeAt
                })
                const targetId = candidates[0].id

                for (const { id } of candidates.slice(1)) {
                    if (id === targetId) continue
                    try {
                        const candidate = this.repository.sessions.get(id)
                        if (candidate?.active) {
                            await this.mergeSessionHistory(id, targetId, {
                                mergeAgentState: false
                            })
                        } else {
                            await this.mergeSessions(id, targetId)
                        }
                    } catch {
                        // best-effort: duplicate remains if merge fails
                    }
                }
            } while (this.deduplicatePending.has(agentId.value))
        } finally {
            this.deduplicateInProgress.delete(agentId.value)
            this.deduplicatePending.delete(agentId.value)
        }
    }
}
