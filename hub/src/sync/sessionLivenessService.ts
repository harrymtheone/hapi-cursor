import type { PermissionMode } from '@hapi/protocol/types'
import { clampAliveTime } from './aliveTime'
import { EventPublisher } from './eventPublisher'
import { SessionRepository } from './sessionRepository'
import type { SessionActivity } from './sessionActivity'

const QUEUED_MESSAGE_THINKING_GRACE_MS = 15_000

/**
 * SessionLivenessService — alive/end/thinking/expiry transitions.
 *
 * Accesses Store only via `this.repository.store` (D-129).
 * No transaction-wrapping abstraction is introduced (D-131).
 */
export class SessionLivenessService {
    constructor(
        private readonly repository: SessionRepository,
        private readonly publisher: EventPublisher
    ) {
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
        const t = clampAliveTime(payload.time)
        if (!t) return

        const session = this.repository.sessions.get(payload.sid) ?? this.repository.refreshSession(payload.sid)
        if (!session) return

        const wasActive = session.active
        const wasThinking = session.thinking
        const previousPermissionMode = session.permissionMode
        const previousModel = session.model
        const previousModelReasoningEffort = session.modelReasoningEffort
        const previousEffort = session.effort
        const pendingThinkingUntil = this.repository.pendingThinkingUntilBySessionId.get(session.id) ?? 0
        const requestedThinking = Boolean(payload.thinking)
        const hubNow = Date.now()
        const preserveQueuedThinking = !requestedThinking && pendingThinkingUntil > hubNow

        session.active = true
        session.activeAt = Math.max(session.activeAt, t)
        session.thinking = requestedThinking || preserveQueuedThinking
        session.thinkingAt = t
        if (requestedThinking || pendingThinkingUntil <= hubNow) {
            this.repository.pendingThinkingUntilBySessionId.delete(session.id)
        }
        if (payload.permissionMode !== undefined) {
            session.permissionMode = payload.permissionMode
        }
        if (payload.model !== undefined) {
            if (payload.model !== session.model) {
                const stored = this.repository.store.sessions.getSession(payload.sid)
                if (!stored) return
                this.repository.store.sessions.setSessionModel(payload.sid, payload.model, {
                    touchUpdatedAt: false
                })
            }
            session.model = payload.model
        }
        if (payload.modelReasoningEffort !== undefined) {
            if (payload.modelReasoningEffort !== session.modelReasoningEffort) {
                const stored = this.repository.store.sessions.getSession(payload.sid)
                if (!stored) return
                this.repository.store.sessions.setSessionModelReasoningEffort(payload.sid, payload.modelReasoningEffort, {
                    touchUpdatedAt: false
                })
            }
            session.modelReasoningEffort = payload.modelReasoningEffort
        }
        if (payload.effort !== undefined) {
            if (payload.effort !== session.effort) {
                const stored = this.repository.store.sessions.getSession(payload.sid)
                if (!stored) return
                this.repository.store.sessions.setSessionEffort(payload.sid, payload.effort, {
                    touchUpdatedAt: false
                })
            }
            session.effort = payload.effort
        }

        const now = Date.now()
        const lastBroadcastAt = this.repository.lastBroadcastAtBySessionId.get(session.id) ?? 0
        const modeChanged = previousPermissionMode !== session.permissionMode
            || previousModel !== session.model
            || previousModelReasoningEffort !== session.modelReasoningEffort
            || previousEffort !== session.effort
        const shouldBroadcast = (!wasActive && session.active)
            || (wasThinking !== session.thinking)
            || modeChanged
            || (now - lastBroadcastAt > 10_000)

        if (shouldBroadcast) {
            this.repository.lastBroadcastAtBySessionId.set(session.id, now)
            this.publisher.emit({
                type: 'session-updated',
                sessionId: session.id,
                data: {
                    active: true,
                    activeAt: session.activeAt,
                    thinking: session.thinking,
                    permissionMode: session.permissionMode,
                    model: session.model,
                    modelReasoningEffort: session.modelReasoningEffort,
                    effort: session.effort
                }
            })
        }
    }

    markMessageQueued(sessionId: string, time: number = Date.now()): void {
        const session = this.repository.sessions.get(sessionId) ?? this.repository.refreshSession(sessionId)
        if (!session) return
        if (!session.active) return

        const nextTime = clampAliveTime(time) ?? Date.now()
        const wasThinking = session.thinking
        const hadCompletionMarker = session.turnCompletionMarker !== null
        const previousUpdatedAt = session.updatedAt

        session.thinking = true
        session.thinkingAt = nextTime
        session.updatedAt = Math.max(session.updatedAt, nextTime)
        session.turnCompletionMarker = null
        this.repository.store.sessions.clearSessionTurnCompletionMarker(session.id, session.updatedAt)
        this.repository.pendingThinkingUntilBySessionId.set(session.id, nextTime + QUEUED_MESSAGE_THINKING_GRACE_MS)

        if (!wasThinking || hadCompletionMarker || session.updatedAt !== previousUpdatedAt) {
            this.repository.lastBroadcastAtBySessionId.set(session.id, Date.now())
            this.publisher.emit({
                type: 'session-updated',
                sessionId: session.id,
                data: {
                    thinking: true,
                    updatedAt: session.updatedAt,
                    statusKind: 'thinking',
                    completionMarker: null,
                    errorMarker: null
                }
            })
        }
    }

    applyBackgroundTaskDelta(sessionId: string, delta: { started: number; completed: number }): void {
        const session = this.repository.sessions.get(sessionId)
        if (!session) return

        const prev = session.backgroundTaskCount ?? 0
        const next = Math.max(0, prev + delta.started - delta.completed)
        if (next === prev) return

        session.backgroundTaskCount = next
        this.publisher.emit({
            type: 'session-updated',
            sessionId,
            data: { backgroundTaskCount: next }
        })
    }

    recordSessionActivity(sessionId: string, updatedAt: number, activity: SessionActivity = { kind: 'message' }): void {
        if (!Number.isFinite(updatedAt)) {
            return
        }

        const stored = this.repository.store.sessions.getSession(sessionId)
        if (!stored) {
            return
        }

        const nextUpdatedAt = Math.max(stored.updatedAt, updatedAt)
        const touched = activity.kind === 'turn-completed'
            ? this.repository.store.sessions.setSessionTurnCompletionMarker(sessionId, nextUpdatedAt, nextUpdatedAt)
            : this.repository.store.sessions.touchSessionUpdatedAt(sessionId, nextUpdatedAt)
        const session = this.repository.sessions.get(sessionId)

        if (!session) {
            if (touched) {
                this.repository.refreshSession(sessionId)
            }
            return
        }

        if (nextUpdatedAt <= session.updatedAt && !touched) {
            return
        }

        session.updatedAt = Math.max(session.updatedAt, nextUpdatedAt)
        if (activity.kind === 'turn-completed') {
            session.thinking = false
            session.thinkingAt = nextUpdatedAt
            session.turnCompletionMarker = nextUpdatedAt
            this.repository.pendingThinkingUntilBySessionId.delete(session.id)
        }
        this.publisher.emit({
            type: 'session-updated',
            sessionId,
            data: activity.kind === 'turn-completed'
                ? {
                    updatedAt: session.updatedAt,
                    thinking: false,
                    statusKind: 'completed',
                    completionMarker: session.updatedAt,
                    errorMarker: null
                }
                : { updatedAt: session.updatedAt }
        })
    }

    handleSessionEnd(payload: { sid: string; time: number }): void {
        const t = clampAliveTime(payload.time) ?? Date.now()

        const session = this.repository.sessions.get(payload.sid) ?? this.repository.refreshSession(payload.sid)
        if (!session) return

        if (!session.active && !session.thinking) {
            return
        }

        session.active = false
        session.thinking = false
        session.thinkingAt = t
        session.backgroundTaskCount = 0
        this.repository.pendingThinkingUntilBySessionId.delete(session.id)

        this.publisher.emit({ type: 'session-updated', sessionId: session.id, data: { active: false, thinking: false, backgroundTaskCount: 0 } })
    }

    expireInactive(now: number = Date.now()): string[] {
        const sessionTimeoutMs = 30_000
        const expired: string[] = []

        for (const session of this.repository.sessions.values()) {
            if (!session.active) continue
            if (now - session.activeAt <= sessionTimeoutMs) continue
            session.active = false
            session.thinking = false
            this.repository.pendingThinkingUntilBySessionId.delete(session.id)
            expired.push(session.id)
            this.publisher.emit({ type: 'session-updated', sessionId: session.id, data: { active: false } })
        }

        return expired
    }
}
