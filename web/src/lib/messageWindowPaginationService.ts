import type { ApiClient } from '@/api/client'
import type { DecryptedMessage, MessagesResponse } from '@/types/api'
import { isQueuedForInvocation, mergeMessages } from '@/lib/messages'
import { AGENT_MESSAGE_PAYLOAD_TYPE } from '@hapi/protocol'
import {
    AGENT_RUN_WINDOW_SIZE,
    COLD_LOAD_BACKFILL_PAGE_SIZE,
    COLD_LOAD_REGULAR_TARGET,
    PAGE_SIZE,
    PENDING_WINDOW_SIZE,
    VISIBLE_WINDOW_SIZE,
    beginAsyncGeneration,
    buildState,
    countVisiblePendingMessages,
    deriveOldestPosition,
    getInternalState,
    isCurrentGeneration,
    updateStateForGeneration,
} from './messageWindowState'
import { mergeIntoPending } from './messageWindowMergeService'

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

export function countRegularMessages(messages: DecryptedMessage[]): number {
    let count = 0
    const seen = new Set<string>()
    for (const message of messages) {
        if (seen.has(message.id)) continue
        seen.add(message.id)
        if (!isAgentRunMessage(message)) {
            count += 1
        }
    }
    return count
}

export function sameCursor(a: MessagesResponse, b: MessagesResponse): boolean {
    return a.page.nextBeforeAt === b.page.nextBeforeAt
        && a.page.nextBeforeSeq === b.page.nextBeforeSeq
}

export async function backfillColdLoadMessages(
    api: ApiClient,
    sessionId: string,
    first: MessagesResponse,
    isCurrent?: () => boolean
): Promise<MessagesResponse> {
    let combined = first
    let regularCount = countRegularMessages(combined.messages)

    // On a cold reload the hub's latest page can be filled entirely by
    // child-agent trace updates. The live path protects regular/root messages
    // with a separate client budget, but that cannot help if those messages were
    // never fetched. Walk older pages until the initial window has a small root
    // conversation floor, or until history is exhausted.
    while (combined.page.hasMore && regularCount < COLD_LOAD_REGULAR_TARGET) {
        if (isCurrent && !isCurrent()) {
            return combined
        }
        if (combined.page.nextBeforeSeq === null) break

        if (combined.page.nextBeforeAt === null) break

        const older = await api.getMessages(sessionId, {
            beforeAt: combined.page.nextBeforeAt,
            beforeSeq: combined.page.nextBeforeSeq,
            limit: COLD_LOAD_BACKFILL_PAGE_SIZE
        })

        if (isCurrent && !isCurrent()) {
            return combined
        }

        if (older.messages.length === 0 || sameCursor(combined, older)) {
            combined = {
                messages: combined.messages,
                page: {
                    ...combined.page,
                    hasMore: false
                }
            }
            break
        }

        combined = {
            messages: mergeMessages(older.messages, combined.messages),
            page: older.page
        }
        regularCount = countRegularMessages(combined.messages)
    }

    return combined
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

export async function fetchLatestMessages(api: ApiClient, sessionId: string): Promise<void> {
    const initial = getInternalState(sessionId)
    if (initial.isLoading) {
        return
    }
    const generation = beginAsyncGeneration(sessionId, 'latest', { isLoading: true, warning: null })

    try {
        const firstResponse = await api.getMessages(sessionId, { limit: PAGE_SIZE })
        const response = initial.atBottom
            ? await backfillColdLoadMessages(api, sessionId, firstResponse, () => isCurrentGeneration(sessionId, 'latest', generation))
            : firstResponse
        if (!isCurrentGeneration(sessionId, 'latest', generation)) {
            return
        }
        // Derive composite cursor pair from server response. Both values come from
        // the same row on the server; we keep them paired so the next older fetch
        // doesn't mix `beforeAt` from the server with a recomputed minimum `seq`.
        const nextBeforeAt = response.page.nextBeforeAt
        const nextBeforeSeq = response.page.nextBeforeSeq

        updateStateForGeneration(sessionId, 'latest', generation, (prev) => {
            if (prev.atBottom) {
                const merged = mergeMessages(prev.messages, [...prev.pending, ...response.messages])
                const trimmed = trimVisible(merged, 'append')
                return buildState(prev, {
                    messages: trimmed,
                    pending: [],
                    pendingOverflowCount: 0,
                    pendingVisibleCount: 0,
                    pendingOverflowVisibleCount: 0,
                    hasMore: response.page.hasMore,
                    oldestPositionAt: nextBeforeAt,
                    oldestPositionSeq: nextBeforeSeq,
                    isLoading: false,
                    warning: null,
                })
            }
            const pendingResult = mergeIntoPending(prev, response.messages)
            return buildState(prev, {
                pending: pendingResult.pending,
                pendingVisibleCount: pendingResult.pendingVisibleCount,
                pendingOverflowCount: pendingResult.pendingOverflowCount,
                pendingOverflowVisibleCount: pendingResult.pendingOverflowVisibleCount,
                // Persist the cursor pair on the non-at-bottom path too. Without this
                // a refresh while scrolled up drops the composite cursor and prevents
                // the next older-page load.
                oldestPositionAt: nextBeforeAt,
                oldestPositionSeq: nextBeforeSeq,
                isLoading: false,
                warning: pendingResult.warning,
            })
        })
    } catch (error) {
        if (!isCurrentGeneration(sessionId, 'latest', generation)) {
            return
        }
        const message = error instanceof Error ? error.message : 'Failed to load messages'
        updateStateForGeneration(sessionId, 'latest', generation, (prev) => buildState(prev, { isLoading: false, warning: message }))
    }
}

export async function fetchOlderMessages(api: ApiClient, sessionId: string): Promise<void> {
    const initial = getInternalState(sessionId)
    if (initial.isLoadingMore || !initial.hasMore) {
        return
    }
    if (initial.oldestPositionAt === null || initial.oldestPositionSeq === null) {
        return
    }
    const generation = beginAsyncGeneration(sessionId, 'older', { isLoadingMore: true })

    try {
        const response = await api.getMessages(sessionId, {
            beforeAt: initial.oldestPositionAt,
            beforeSeq: initial.oldestPositionSeq,
            limit: PAGE_SIZE
        })

        const nextBeforeAt = response.page.nextBeforeAt
        const nextBeforeSeq = response.page.nextBeforeSeq

        updateStateForGeneration(sessionId, 'older', generation, (prev) => {
            const merged = mergeMessages(response.messages, prev.messages)
            const trimmed = trimVisible(merged, 'prepend')
            return buildState(prev, {
                messages: trimmed,
                hasMore: response.page.hasMore,
                oldestPositionAt: nextBeforeAt,
                oldestPositionSeq: nextBeforeSeq,
                isLoadingMore: false,
            })
        })
    } catch (error) {
        if (!isCurrentGeneration(sessionId, 'older', generation)) {
            return
        }
        const message = error instanceof Error ? error.message : 'Failed to load messages'
        updateStateForGeneration(sessionId, 'older', generation, (prev) => buildState(prev, { isLoadingMore: false, warning: message }))
    }
}
