import type { DecryptedMessage, MessageStatus } from '@/types/api'
import { isUserMessage, mergeMessages } from '@/lib/messages'
import {
    PENDING_OVERFLOW_WARNING,
    buildState,
    countVisiblePendingMessages,
    getInternalState,
    type InternalState,
    updateInternalState,
} from './messageWindowState'
import {
    cursorUpdatesAfterAppendTrim,
    trimPending,
    trimVisibleWithDropped,
} from './messageWindowPaginationService'

export function filterPendingAgainstVisible(pending: DecryptedMessage[], visible: DecryptedMessage[]): DecryptedMessage[] {
    if (pending.length === 0 || visible.length === 0) {
        return pending
    }
    const visibleIds = new Set(visible.map((message) => message.id))
    return pending.filter((message) => !visibleIds.has(message.id))
}

export function isOptimisticMessage(message: DecryptedMessage): boolean {
    return Boolean(message.localId && message.id === message.localId)
}

export function mergeIntoPending(
    prev: InternalState,
    incoming: DecryptedMessage[]
): {
    pending: DecryptedMessage[]
    pendingVisibleCount: number
    pendingOverflowCount: number
    pendingOverflowVisibleCount: number
    warning: string | null
} {
    if (incoming.length === 0) {
        return {
            pending: prev.pending,
            pendingVisibleCount: prev.pendingVisibleCount,
            pendingOverflowCount: prev.pendingOverflowCount,
            pendingOverflowVisibleCount: prev.pendingOverflowVisibleCount,
            warning: prev.warning
        }
    }
    const mergedPending = mergeMessages(prev.pending, incoming)
    const filtered = filterPendingAgainstVisible(mergedPending, prev.messages)
    const { pending, dropped, droppedVisible } = trimPending(prev.sessionId, filtered)
    const pendingVisibleCount = countVisiblePendingMessages(prev.sessionId, pending)
    const pendingOverflowCount = prev.pendingOverflowCount + dropped
    const pendingOverflowVisibleCount = prev.pendingOverflowVisibleCount + droppedVisible
    const warning = droppedVisible > 0 && !prev.warning ? PENDING_OVERFLOW_WARNING : prev.warning
    return { pending, pendingVisibleCount, pendingOverflowCount, pendingOverflowVisibleCount, warning }
}

export function ingestIncomingMessages(sessionId: string, incoming: DecryptedMessage[]): void {
    if (incoming.length === 0) {
        return
    }
    updateInternalState(sessionId, (prev) => {
        if (prev.atBottom) {
            const merged = mergeMessages(prev.messages, incoming)
            const { kept, dropped } = trimVisibleWithDropped(merged, 'append')
            const pending = filterPendingAgainstVisible(prev.pending, kept)
            return buildState(prev, {
                messages: kept,
                pending,
                ...cursorUpdatesAfterAppendTrim(kept, dropped)
            })
        }
        // 不在底部时：agent 消息立即显示，user 消息才放入 pending
        // 原因：用户必须看到 AI 回复才能继续交互，pending 机制会导致回复滞后
        const agentMessages = incoming.filter(msg => !isUserMessage(msg))
        const userMessages = incoming.filter(msg => isUserMessage(msg))

        let state = prev
        if (agentMessages.length > 0) {
            const merged = mergeMessages(state.messages, agentMessages)
            const { kept, dropped } = trimVisibleWithDropped(merged, 'append')
            const pending = filterPendingAgainstVisible(state.pending, kept)
            state = buildState(state, {
                messages: kept,
                pending,
                ...cursorUpdatesAfterAppendTrim(kept, dropped)
            })
        }
        if (userMessages.length > 0) {
            const pendingResult = mergeIntoPending(state, userMessages)
            state = buildState(state, {
                pending: pendingResult.pending,
                pendingVisibleCount: pendingResult.pendingVisibleCount,
                pendingOverflowCount: pendingResult.pendingOverflowCount,
                pendingOverflowVisibleCount: pendingResult.pendingOverflowVisibleCount,
                warning: pendingResult.warning,
            })
        }
        return state
    })
}

export function flushPendingMessages(sessionId: string): boolean {
    const current = getInternalState(sessionId)
    if (current.pending.length === 0 && current.pendingOverflowVisibleCount === 0) {
        return false
    }
    const needsRefresh = current.pendingOverflowVisibleCount > 0
    updateInternalState(sessionId, (prev) => {
        const merged = mergeMessages(prev.messages, prev.pending)
        const { kept, dropped } = trimVisibleWithDropped(merged, 'append')
        return buildState(prev, {
            messages: kept,
            pending: [],
            pendingOverflowCount: 0,
            pendingVisibleCount: 0,
            pendingOverflowVisibleCount: 0,
            warning: needsRefresh ? (prev.warning ?? PENDING_OVERFLOW_WARNING) : prev.warning,
            ...cursorUpdatesAfterAppendTrim(kept, dropped)
        })
    }, true)
    return needsRefresh
}

export function appendOptimisticMessage(sessionId: string, message: DecryptedMessage): void {
    updateInternalState(sessionId, (prev) => {
        const merged = mergeMessages(prev.messages, [message])
        const { kept, dropped } = trimVisibleWithDropped(merged, 'append')
        const pending = filterPendingAgainstVisible(prev.pending, kept)
        return buildState(prev, {
            messages: kept,
            pending,
            atBottom: true,
            ...cursorUpdatesAfterAppendTrim(kept, dropped)
        })
    }, true)
}

export function updateMessageStatus(sessionId: string, localId: string, status: MessageStatus): void {
    if (!localId) {
        return
    }
    updateInternalState(sessionId, (prev) => {
        let changed = false
        const updateList = (list: DecryptedMessage[]) => {
            return list.map((message) => {
                if (message.localId !== localId) {
                    return message
                }
                if (message.status === status) {
                    return message
                }
                changed = true
                return { ...message, status }
            })
        }
        const messages = updateList(prev.messages)
        const pending = updateList(prev.pending)
        if (!changed) {
            return prev
        }
        return buildState(prev, { messages, pending })
    })
}

/** Remove an optimistic (not-yet-confirmed) message by its localId or server id.
 *  Used by the cancel affordance: optimistically drop the row immediately so the
 *  floating bar clears before the DELETE /messages/:id round-trip completes. If
 *  the request fails, the caller is responsible for re-inserting the row (e.g.
 *  via ingestIncomingMessages).  Matches against both `localId` and `id` so that
 *  rows loaded from the server (which may have a stable uuid `id` + a localId) are
 *  also handled.
 */
export function removeOptimisticMessage(sessionId: string, localId: string): void {
    if (!localId) return
    updateInternalState(sessionId, (prev) => {
        let changed = false
        const filterList = (list: DecryptedMessage[]) => {
            const next = list.filter((message) => {
                const matchesLocalId = message.localId === localId
                const matchesId = message.id === localId
                if (matchesLocalId || matchesId) {
                    changed = true
                    return false
                }
                return true
            })
            return next
        }
        const messages = filterList(prev.messages)
        const pending = filterList(prev.pending)
        if (!changed) return prev
        return buildState(prev, { messages, pending })
    }, true)
}

/** Transition the queued messages whose localIds match to 'sent' and record invokedAt.
 *  Driven by the CLI ack (messages-consumed). Unmatched messages remain queued.
 *  Also handles server-loaded messages (status=undefined) that have a matching localId.
 *  `invokedAt` is provided by the hub and used as the stable display-position
 *  timestamp for composite cursor pagination. */
export function markMessagesConsumed(sessionId: string, localIds: string[], invokedAt: number): void {
    if (localIds.length === 0) return
    const idSet = new Set(localIds)
    updateInternalState(sessionId, (prev) => {
        let changed = false
        const updateList = (list: DecryptedMessage[]) => {
            return list.map((message) => {
                if (!message.localId || !idSet.has(message.localId)) {
                    return message
                }
                if (message.status === 'failed') {
                    return message
                }
                // Apply the ack even if the message is already 'sent' (optimistic) — otherwise
                // a message that flipped to 'sent' before the consume event arrives would
                // never receive `invokedAt` and keep sorting by send time.
                // First-write-wins on `invokedAt`: mirror the hub's UPDATE guard so a
                // duplicate `messages-consumed` (e.g. CLI re-emit) doesn't restamp a
                // message and shuffle its byPosition slot on live clients while the
                // DB still holds the original timestamp.
                const needsStatus = message.status !== 'sent'
                // Strict null to stay consistent with isQueuedForInvocation and the rest
                // of this file.
                const needsInvokedAt = message.invokedAt === null
                if (!needsStatus && !needsInvokedAt) {
                    return message
                }
                changed = true
                const update: Partial<DecryptedMessage> = {}
                if (needsStatus) {
                    update.status = 'sent' as MessageStatus
                }
                if (needsInvokedAt) {
                    update.invokedAt = invokedAt
                }
                return { ...message, ...update }
            })
        }
        // Migrate just-acked pending entries into the visible thread. Without
        // this step, an at-bottom=false user that is stuck in pending never
        // sees their own message at the invocation slot — it stays in the
        // pending bucket until they scroll, even though the floating bar
        // already cleared.  Identifying the migrated rows by (localId,
        // invokedAt = invokedAt) ensures we only move rows whose
        // ack just arrived, not unrelated pending entries.
        const updatedPending = updateList(prev.pending)
        const consumedFromPending: DecryptedMessage[] = []
        const remainingPending = updatedPending.filter((message) => {
            if (
                message.localId &&
                idSet.has(message.localId) &&
                message.invokedAt === invokedAt
            ) {
                consumedFromPending.push(message)
                return false
            }
            return true
        })
        // After update, re-merge to re-sort by the position key (`invokedAt ?? createdAt`):
        // a queued message that just received `invokedAt` should move to its invocation
        // position, not stay at its original send-time slot until the next fetch.
        const mergedMessages = mergeMessages(updateList(prev.messages), consumedFromPending)
        const { kept, dropped } = trimVisibleWithDropped(mergedMessages, 'append')
        const pending = mergeMessages([], remainingPending)
        if (!changed) {
            return prev
        }
        return buildState(prev, {
            messages: kept,
            pending,
            ...cursorUpdatesAfterAppendTrim(kept, dropped)
        })
    })
}
