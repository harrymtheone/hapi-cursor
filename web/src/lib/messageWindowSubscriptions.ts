import {
    buildState,
    clearPendingVisibilityCache,
    createState,
    deleteInternalListeners,
    getInternalListeners,
    getInternalState,
    peekInternalState,
    setInternalListeners,
    setInternalState,
} from './messageWindowState'
import { clearPersistedState } from './messageWindowPersistence'

export function subscribeMessageWindow(sessionId: string, listener: () => void): () => void {
    const subs = getInternalListeners(sessionId) ?? new Set<() => void>()
    subs.add(listener)
    setInternalListeners(sessionId, subs)
    return () => {
        const current = getInternalListeners(sessionId)
        if (!current) return
        current.delete(listener)
        if (current.size === 0) {
            deleteInternalListeners(sessionId)
            clearPendingVisibilityCache(sessionId)
        }
    }
}

export function clearMessageWindow(sessionId: string): void {
    clearPendingVisibilityCache(sessionId)
    clearPersistedState(sessionId)
    const previous = peekInternalState(sessionId)
    if (!previous) {
        return
    }
    setInternalState(sessionId, {
        ...createState(sessionId),
        latestGeneration: previous.latestGeneration + 1,
        olderGeneration: previous.olderGeneration + 1,
    }, true)
}

export function seedMessageWindowFromSession(fromSessionId: string, toSessionId: string): void {
    if (!fromSessionId || !toSessionId || fromSessionId === toSessionId) {
        return
    }
    const source = getInternalState(fromSessionId)
    const base = createState(toSessionId)
    const next = buildState(base, {
        messages: [...source.messages],
        pending: [...source.pending],
        pendingOverflowCount: source.pendingOverflowCount,
        pendingOverflowVisibleCount: source.pendingOverflowVisibleCount,
        hasMore: source.hasMore,
        oldestPositionAt: source.oldestPositionAt,
        oldestPositionSeq: source.oldestPositionSeq,
        warning: source.warning,
        atBottom: source.atBottom,
        isLoading: false,
        isLoadingMore: false,
    })
    setInternalState(toSessionId, {
        ...next,
        latestGeneration: source.latestGeneration,
        olderGeneration: source.olderGeneration,
    })
}
