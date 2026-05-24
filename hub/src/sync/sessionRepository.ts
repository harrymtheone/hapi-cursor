import { AgentStateSchema, MetadataSchema, TeamStateSchema } from '@hapi/protocol/schemas'
import type { Session } from '@hapi/protocol/types'
import type { Store } from '../store'
import { EventPublisher } from './eventPublisher'
import { extractTodoWriteTodosFromMessageContent, TodosSchema } from './todos'

/**
 * SessionRepository — owns the only `Store` reference among the session services (D-129).
 *
 * Sibling services (liveness/config/merge) read/mutate the in-memory caches via the
 * `public readonly` maps exposed below and route Store writes through this class.
 */
export class SessionRepository {
    public readonly sessions: Map<string, Session> = new Map()
    public readonly lastBroadcastAtBySessionId: Map<string, number> = new Map()
    public readonly todoBackfillAttemptedSessionIds: Set<string> = new Set()
    public readonly pendingThinkingUntilBySessionId: Map<string, number> = new Map()

    constructor(
        public readonly store: Store,
        private readonly publisher: EventPublisher
    ) {
    }

    getSessions(): Session[] {
        return Array.from(this.sessions.values())
    }

    getSession(sessionId: string): Session | undefined {
        return this.sessions.get(sessionId)
    }

    resolveSessionAccess(
        sessionId: string
    ): { ok: true; sessionId: string; session: Session } | { ok: false; reason: 'not-found' }
    resolveSessionAccess(sessionId: string): { ok: true; sessionId: string; session: Session } | { ok: false; reason: 'not-found' } {
        const session = this.sessions.get(sessionId) ?? this.refreshSession(sessionId)
        if (session) {
            return { ok: true, sessionId, session }
        }

        return { ok: false, reason: 'not-found' }
    }

    getActiveSessions(): Session[] {
        return this.getSessions().filter((session) => session.active)
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
        const stored = this.store.sessions.getOrCreateSession(tag, metadata, agentState, options)
        return this.refreshSession(stored.id) ?? (() => { throw new Error('Failed to load session') })()
    }

    refreshSession(sessionId: string): Session | null {
        let stored = this.store.sessions.getSession(sessionId)
        if (!stored) {
            const existed = this.sessions.delete(sessionId)
            this.pendingThinkingUntilBySessionId.delete(sessionId)
            if (existed) {
                this.publisher.emit({ type: 'session-removed', sessionId })
            }
            return null
        }

        const existing = this.sessions.get(sessionId)

        if (stored.todos === null && !this.todoBackfillAttemptedSessionIds.has(sessionId)) {
            this.todoBackfillAttemptedSessionIds.add(sessionId)
            const messages = this.store.messages.getMessages(sessionId, 200)
            for (let i = messages.length - 1; i >= 0; i -= 1) {
                const message = messages[i]
                const todos = extractTodoWriteTodosFromMessageContent(message.content)
                if (todos) {
                    const updated = this.store.sessions.setSessionTodos(sessionId, todos, message.createdAt)
                    if (updated) {
                        stored = this.store.sessions.getSession(sessionId) ?? stored
                    }
                    break
                }
            }
        }

        const metadata = (() => {
            const parsed = MetadataSchema.safeParse(stored.metadata)
            return parsed.success ? parsed.data : null
        })()

        const agentState = (() => {
            const parsed = AgentStateSchema.safeParse(stored.agentState)
            return parsed.success ? parsed.data : null
        })()

        const todos = (() => {
            if (stored.todos === null) return undefined
            const parsed = TodosSchema.safeParse(stored.todos)
            return parsed.success ? parsed.data : undefined
        })()

        const teamState = (() => {
            if (stored.teamState === null || stored.teamState === undefined) return undefined
            const parsed = TeamStateSchema.safeParse(stored.teamState)
            return parsed.success ? parsed.data : undefined
        })()

        const session: Session = {
            id: stored.id,
            seq: stored.seq,
            createdAt: stored.createdAt,
            updatedAt: stored.updatedAt,
            active: existing?.active ?? stored.active,
            activeAt: existing?.activeAt ?? (stored.activeAt ?? stored.createdAt),
            metadata,
            metadataVersion: stored.metadataVersion,
            agentState,
            agentStateVersion: stored.agentStateVersion,
            thinking: existing?.thinking ?? false,
            thinkingAt: existing?.thinkingAt ?? 0,
            backgroundTaskCount: existing?.backgroundTaskCount ?? 0,
            todos,
            teamState,
            model: stored.model,
            modelReasoningEffort: stored.modelReasoningEffort,
            effort: stored.effort,
            turnCompletionMarker: stored.turnCompletionMarker,
            permissionMode: existing?.permissionMode
        }

        this.sessions.set(sessionId, session)
        this.publisher.emit({ type: existing ? 'session-updated' : 'session-added', sessionId, data: session })
        return session
    }

    reloadAll(): void {
        const sessions = this.store.sessions.getSessions()
        for (const session of sessions) {
            this.refreshSession(session.id)
        }
    }
}
