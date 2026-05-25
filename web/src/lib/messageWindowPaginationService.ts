import type { ApiClient } from '@/api/client'
import type { DecryptedMessage, MessagesResponse } from '@/types/api'
import { mergeMessages } from '@/lib/messages'
import { mergePageToolCalls } from '@/lib/toolProjectionStore'
import {
    COLD_LOAD_BACKFILL_PAGE_SIZE,
    COLD_LOAD_REGULAR_TARGET,
    PAGE_SIZE,
    beginAsyncGeneration,
    buildState,
    getInternalState,
    isCurrentGeneration,
    updateStateForGeneration,
} from './messageWindowState'
import {
    cursorUpdatesAfterAppendTrim,
    isAgentRunMessage,
    sliceForTrim,
    trimPending,
    trimPreservingQueued,
    trimVisible,
    trimVisibleWithDropped,
} from './messageWindowTrim'
import { mergeIntoPending } from './messageWindowMergeService'

export {
    cursorUpdatesAfterAppendTrim,
    isAgentRunMessage,
    sliceForTrim,
    trimPending,
    trimPreservingQueued,
    trimVisible,
    trimVisibleWithDropped,
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

        mergePageToolCalls(sessionId, older.toolCalls)
        combined = {
            messages: mergeMessages(older.messages, combined.messages),
            page: older.page,
            toolCalls: { ...(combined.toolCalls ?? {}), ...(older.toolCalls ?? {}) }
        }
        regularCount = countRegularMessages(combined.messages)
    }

    return combined
}

export async function fetchLatestMessages(api: ApiClient, sessionId: string): Promise<void> {
    const initial = getInternalState(sessionId)
    if (initial.isLoading) {
        return
    }
    const generation = beginAsyncGeneration(sessionId, 'latest', { isLoading: true, warning: null })

    try {
        const firstResponse = await api.getMessages(sessionId, { limit: PAGE_SIZE })
        mergePageToolCalls(sessionId, firstResponse.toolCalls)
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
        mergePageToolCalls(sessionId, response.toolCalls)

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
