// Pure trimming helpers for the message-window store.
// Extracted into its own module to break the merge ↔ pagination import cycle
// (D-158 #7 / madge guard): merge and pagination both depend on these
// helpers but no longer on each other transitively through them.

import type { DecryptedMessage } from '@/types/api'
import { isQueuedForInvocation, mergeMessages } from '@/lib/messages'
import { AGENT_MESSAGE_PAYLOAD_TYPE } from '@hapi/protocol'
import {
    AGENT_RUN_WINDOW_SIZE,
    PENDING_WINDOW_SIZE,
    VISIBLE_WINDOW_SIZE,
    countVisiblePendingMessages,
    deriveOldestPosition,
} from './messageWindowState'

export function isAgentRunMessage(message: DecryptedMessage): boolean {
    const content = message.content
    if (!content || typeof content !== 'object') return false
    const outer = content as { role?: unknown; content?: unknown }
    if (outer.role !== 'agent') return false
    const inner = outer.content
    if (!inner || typeof inner !== 'object') return false
    const payload = inner as { type?: unknown; data?: unknown }
    if (payload.type !== AGENT_MESSAGE_PAYLOAD_TYPE) return false
    const data = payload.data
    if (!data || typeof data !== 'object') return false
    const eventType = (data as { type?: unknown }).type
    return eventType === 'agent-run-start'
        || eventType === 'agent-run-update'
        || eventType === 'agent-run-trace'
}

export function sliceForTrim<T>(items: T[], limit: number, mode: 'append' | 'prepend'): { kept: T[]; dropped: T[] } {
    if (items.length <= limit) {
        return { kept: items, dropped: [] }
    }
    if (limit <= 0) {
        return { kept: [], dropped: items }
    }
    const kept = mode === 'prepend'
        ? items.slice(0, limit)
        : items.slice(items.length - limit)
    const dropped = mode === 'prepend'
        ? items.slice(limit)
        : items.slice(0, items.length - limit)
    return { kept, dropped }
}

/** Trim `messages` down to `limit` while preserving every queued user message.
 *  Queued rows must survive trimming on both windows: the `messages-consumed`
 *  SSE only carries localIds, so a dropped queued row cannot be restored or
 *  repositioned without a full refetch.  Returns the kept slice plus the list
 *  of regular (non-queued) rows that were dropped, so the pending-overflow
 *  warning counter can be advanced symmetrically. */
export function trimPreservingQueued(
    messages: DecryptedMessage[],
    limit: number,
    mode: 'append' | 'prepend'
): { kept: DecryptedMessage[]; dropped: DecryptedMessage[] } {
    if (messages.length <= limit) {
        return { kept: messages, dropped: [] }
    }
    const queued = messages.filter(isQueuedForInvocation)
    const queuedIds = new Set(queued.map((message) => message.id))
    const nonQueued = messages.filter((message) => !queuedIds.has(message.id))
    const agentRun = nonQueued.filter(isAgentRunMessage)
    const regular = nonQueued.filter((message) => !isAgentRunMessage(message))
    const budget = Math.max(0, limit - queued.length)
    const regularTrim = sliceForTrim(regular, budget, mode)
    const agentRunTrim = sliceForTrim(agentRun, AGENT_RUN_WINDOW_SIZE, mode)
    return {
        kept: mergeMessages([...regularTrim.kept, ...agentRunTrim.kept], queued),
        dropped: [...regularTrim.dropped, ...agentRunTrim.dropped]
    }
}

export function trimVisible(messages: DecryptedMessage[], mode: 'append' | 'prepend'): DecryptedMessage[] {
    return trimPreservingQueued(messages, VISIBLE_WINDOW_SIZE, mode).kept
}

export function trimVisibleWithDropped(
    messages: DecryptedMessage[],
    mode: 'append' | 'prepend'
): { kept: DecryptedMessage[]; dropped: DecryptedMessage[] } {
    return trimPreservingQueued(messages, VISIBLE_WINDOW_SIZE, mode)
}

export function cursorUpdatesAfterAppendTrim(
    kept: DecryptedMessage[],
    dropped: DecryptedMessage[]
): {
    hasMore?: boolean
    oldestPositionAt?: number | null
    oldestPositionSeq?: number | null
} {
    if (dropped.length === 0) {
        return {}
    }
    const oldest = deriveOldestPosition(kept)
    return {
        hasMore: true,
        ...(oldest ? {
            oldestPositionAt: oldest.at,
            oldestPositionSeq: oldest.seq
        } : {})
    }
}

export function trimPending(
    sessionId: string,
    messages: DecryptedMessage[]
): { pending: DecryptedMessage[]; dropped: number; droppedVisible: number } {
    if (messages.length <= PENDING_WINDOW_SIZE) {
        return { pending: messages, dropped: 0, droppedVisible: 0 }
    }
    // Symmetric with trimVisible: agents that overflow the pending window
    // (200) must not evict queued user messages — the floating bar holds the
    // only client-visible reference to them until the CLI ack arrives.
    const { kept, dropped } = trimPreservingQueued(messages, PENDING_WINDOW_SIZE, 'append')
    const droppedVisible = countVisiblePendingMessages(sessionId, dropped)
    return { pending: kept, dropped: dropped.length, droppedVisible }
}
