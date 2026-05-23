import type { DecryptedMessage } from '@/types/api'
import { normalizeDecryptedMessage } from '@/chat/normalize'

// Persistence hooks registered by messageWindowPersistence at module load.
// Indirection breaks the state ↔ persistence import cycle (D-158 #7 / madge guard).
type PersistenceHooks = {
    schedulePersist: (sessionId: string) => void
    hydrateState: (sessionId: string) => InternalStateLike | null
}
type InternalStateLike = unknown
let persistenceHooks: PersistenceHooks | null = null
export function registerMessageWindowPersistence(hooks: PersistenceHooks): void {
    persistenceHooks = hooks
}

export type MessageWindowState = {
    sessionId: string
    messages: DecryptedMessage[]
    pending: DecryptedMessage[]
    pendingCount: number
    hasMore: boolean
    oldestSeq: number | null
    newestSeq: number | null
    isLoading: boolean
    isLoadingMore: boolean
    warning: string | null
    atBottom: boolean
    messagesVersion: number
}

export const VISIBLE_WINDOW_SIZE = 400
export const PENDING_WINDOW_SIZE = 200
export const AGENT_RUN_WINDOW_SIZE = 800
export const PAGE_SIZE = 50
export const COLD_LOAD_BACKFILL_PAGE_SIZE = 200
export const COLD_LOAD_REGULAR_TARGET = PAGE_SIZE
export const PENDING_OVERFLOW_WARNING = 'New messages arrived while you were away. Scroll to bottom to refresh.'

export type InternalState = MessageWindowState & {
    pendingOverflowCount: number
    pendingVisibleCount: number
    pendingOverflowVisibleCount: number
    latestGeneration: number
    olderGeneration: number
    // V8 composite cursor: defined when hub responded with nextBeforeAt
    oldestPositionAt: number | null
    // Paired with oldestPositionAt — the server returns both as a cursor; keep them
    // together so we don't accidentally combine `nextBeforeAt` from the server with
    // a recomputed minimum `seq` from the local window (those can refer to
    // different rows after a low-seq message is invoked late).
    oldestPositionSeq: number | null
}

export type PendingVisibilityCacheEntry = {
    source: DecryptedMessage
    visible: boolean
}

export type AsyncGenerationKind = 'latest' | 'older'

// Module-private Maps — sole owner per Pitfall 1. Siblings consume via accessors below.
const states = new Map<string, InternalState>()
const listeners = new Map<string, Set<() => void>>()
const pendingVisibilityCacheBySession = new Map<string, Map<string, PendingVisibilityCacheEntry>>()

// Throttled notification: coalesce rapid state updates into at most one
// notification per NOTIFY_THROTTLE_MS during streaming. This prevents
// Windows UI jank caused by excessive React re-renders during SSE streaming.
const NOTIFY_THROTTLE_MS = 150
const pendingNotifySessionIds = new Set<string>()
let notifyRafId: ReturnType<typeof requestAnimationFrame> | null = null
let lastNotifyAt = 0

function scheduleNotify(sessionId: string): void {
    pendingNotifySessionIds.add(sessionId)
    if (notifyRafId !== null) {
        return
    }
    const elapsed = Date.now() - lastNotifyAt
    if (elapsed >= NOTIFY_THROTTLE_MS) {
        notifyRafId = requestAnimationFrame(flushNotifications)
    } else {
        const remaining = NOTIFY_THROTTLE_MS - elapsed
        setTimeout(() => {
            notifyRafId = requestAnimationFrame(flushNotifications)
        }, remaining)
        notifyRafId = -1 as unknown as ReturnType<typeof requestAnimationFrame>
    }
}

function flushNotifications(): void {
    notifyRafId = null
    lastNotifyAt = Date.now()
    const sessionIds = Array.from(pendingNotifySessionIds)
    pendingNotifySessionIds.clear()
    for (const sessionId of sessionIds) {
        const subs = listeners.get(sessionId)
        if (!subs) continue
        for (const listener of subs) {
            listener()
        }
    }
}

export function getPendingVisibilityCache(sessionId: string): Map<string, PendingVisibilityCacheEntry> {
    const existing = pendingVisibilityCacheBySession.get(sessionId)
    if (existing) {
        return existing
    }
    const created = new Map<string, PendingVisibilityCacheEntry>()
    pendingVisibilityCacheBySession.set(sessionId, created)
    return created
}

export function clearPendingVisibilityCache(sessionId: string): void {
    pendingVisibilityCacheBySession.delete(sessionId)
}

export function isVisiblePendingMessage(sessionId: string, message: DecryptedMessage): boolean {
    const cache = getPendingVisibilityCache(sessionId)
    const cached = cache.get(message.id)
    if (cached && cached.source === message) {
        return cached.visible
    }
    const visible = normalizeDecryptedMessage(message) !== null
    cache.set(message.id, { source: message, visible })
    return visible
}

export function countVisiblePendingMessages(sessionId: string, messages: DecryptedMessage[]): number {
    let count = 0
    for (const message of messages) {
        if (isVisiblePendingMessage(sessionId, message)) {
            count += 1
        }
    }
    return count
}

export function syncPendingVisibilityCache(sessionId: string, pending: DecryptedMessage[]): void {
    const cache = pendingVisibilityCacheBySession.get(sessionId)
    if (!cache) {
        return
    }
    const keep = new Set(pending.map((message) => message.id))
    for (const id of cache.keys()) {
        if (!keep.has(id)) {
            cache.delete(id)
        }
    }
}

export function createState(sessionId: string): InternalState {
    return {
        sessionId,
        messages: [],
        pending: [],
        pendingCount: 0,
        pendingVisibleCount: 0,
        pendingOverflowVisibleCount: 0,
        hasMore: false,
        oldestSeq: null,
        oldestPositionAt: null,
        oldestPositionSeq: null,
        newestSeq: null,
        isLoading: false,
        isLoadingMore: false,
        warning: null,
        atBottom: true,
        messagesVersion: 0,
        pendingOverflowCount: 0,
        latestGeneration: 0,
        olderGeneration: 0,
    }
}

function getState(sessionId: string): InternalState {
    const existing = states.get(sessionId)
    if (existing) {
        return existing
    }
    const created = (persistenceHooks?.hydrateState(sessionId) as InternalState | null | undefined) ?? createState(sessionId)
    states.set(sessionId, created)
    return created
}

function notify(sessionId: string): void {
    scheduleNotify(sessionId)
}

function notifyImmediate(sessionId: string): void {
    // Bypass throttle for user-initiated actions (flush, clear, etc.)
    const subs = listeners.get(sessionId)
    if (!subs) return
    for (const listener of subs) {
        listener()
    }
}

function setState(sessionId: string, next: InternalState, immediate?: boolean): void {
    states.set(sessionId, next)
    persistenceHooks?.schedulePersist(sessionId)
    if (immediate) {
        notifyImmediate(sessionId)
    } else {
        notify(sessionId)
    }
}

function updateState(sessionId: string, updater: (prev: InternalState) => InternalState, immediate?: boolean): void {
    const prev = getState(sessionId)
    const next = updater(prev)
    if (next !== prev) {
        setState(sessionId, next, immediate)
    }
}

// Internal accessors — sole sanctioned entry points for sibling sub-modules.
export function getInternalState(sessionId: string): InternalState {
    return getState(sessionId)
}

export function peekInternalState(sessionId: string): InternalState | undefined {
    return states.get(sessionId)
}

export function setInternalState(sessionId: string, next: InternalState, immediate?: boolean): void {
    setState(sessionId, next, immediate)
}

export function updateInternalState(
    sessionId: string,
    updater: (prev: InternalState) => InternalState,
    immediate?: boolean
): void {
    updateState(sessionId, updater, immediate)
}

export function getInternalListeners(sessionId: string): Set<() => void> | undefined {
    return listeners.get(sessionId)
}

export function setInternalListeners(sessionId: string, subs: Set<() => void>): void {
    listeners.set(sessionId, subs)
}

export function deleteInternalListeners(sessionId: string): void {
    listeners.delete(sessionId)
}

export function beginAsyncGeneration(
    sessionId: string,
    kind: AsyncGenerationKind,
    updates: Parameters<typeof buildState>[1]
): number {
    let generation = 0
    updateState(sessionId, (prev) => {
        generation = getGeneration(prev, kind) + 1
        return setGeneration(buildState(prev, updates), kind, generation)
    })
    return generation
}

function getGeneration(state: InternalState, kind: AsyncGenerationKind): number {
    return kind === 'latest' ? state.latestGeneration : state.olderGeneration
}

function setGeneration(state: InternalState, kind: AsyncGenerationKind, generation: number): InternalState {
    return kind === 'latest'
        ? { ...state, latestGeneration: generation }
        : { ...state, olderGeneration: generation }
}

export function isCurrentGeneration(sessionId: string, kind: AsyncGenerationKind, generation: number): boolean {
    return getGeneration(getState(sessionId), kind) === generation
}

export function updateStateForGeneration(
    sessionId: string,
    kind: AsyncGenerationKind,
    generation: number,
    updater: (prev: InternalState) => InternalState,
    immediate?: boolean
): void {
    updateState(sessionId, (prev) => {
        if (getGeneration(prev, kind) !== generation) {
            return prev
        }
        return updater(prev)
    }, immediate)
}

function deriveSeqBounds(messages: DecryptedMessage[]): { oldestSeq: number | null; newestSeq: number | null } {
    let oldest: number | null = null
    let newest: number | null = null
    for (const message of messages) {
        if (typeof message.seq !== 'number') {
            continue
        }
        if (oldest === null || message.seq < oldest) {
            oldest = message.seq
        }
        if (newest === null || message.seq > newest) {
            newest = message.seq
        }
    }
    return { oldestSeq: oldest, newestSeq: newest }
}

export function getMessagePositionAt(message: DecryptedMessage): number {
    return message.invokedAt ?? message.createdAt
}

export function deriveOldestPosition(messages: DecryptedMessage[]): { at: number; seq: number } | null {
    let oldest: DecryptedMessage | null = null
    for (const message of messages) {
        if (typeof message.seq !== 'number') continue
        if (!oldest) {
            oldest = message
            continue
        }
        const messageAt = getMessagePositionAt(message)
        const oldestAt = getMessagePositionAt(oldest)
        if (messageAt < oldestAt || (messageAt === oldestAt && message.seq < oldest.seq!)) {
            oldest = message
        }
    }
    return oldest && typeof oldest.seq === 'number'
        ? { at: getMessagePositionAt(oldest), seq: oldest.seq }
        : null
}

export function buildState(
    prev: InternalState,
    updates: {
        messages?: DecryptedMessage[]
        pending?: DecryptedMessage[]
        pendingOverflowCount?: number
        pendingVisibleCount?: number
        pendingOverflowVisibleCount?: number
        hasMore?: boolean
        oldestPositionAt?: number | null
        oldestPositionSeq?: number | null
        isLoading?: boolean
        isLoadingMore?: boolean
        warning?: string | null
        atBottom?: boolean
    }
): InternalState {
    const messages = updates.messages ?? prev.messages
    const pending = updates.pending ?? prev.pending
    const pendingOverflowCount = updates.pendingOverflowCount ?? prev.pendingOverflowCount
    const pendingOverflowVisibleCount = updates.pendingOverflowVisibleCount ?? prev.pendingOverflowVisibleCount
    let pendingVisibleCount = updates.pendingVisibleCount ?? prev.pendingVisibleCount
    const pendingChanged = pending !== prev.pending
    if (pendingChanged && updates.pendingVisibleCount === undefined) {
        pendingVisibleCount = countVisiblePendingMessages(prev.sessionId, pending)
    }
    if (pendingChanged) {
        syncPendingVisibilityCache(prev.sessionId, pending)
    }
    const pendingCount = pendingVisibleCount + pendingOverflowVisibleCount
    const { oldestSeq, newestSeq } = deriveSeqBounds(messages)
    const messagesVersion = messages === prev.messages ? prev.messagesVersion : prev.messagesVersion + 1

    return {
        ...prev,
        messages,
        pending,
        pendingOverflowCount,
        pendingVisibleCount,
        pendingOverflowVisibleCount,
        pendingCount,
        oldestSeq,
        oldestPositionAt: updates.oldestPositionAt !== undefined ? updates.oldestPositionAt : prev.oldestPositionAt,
        oldestPositionSeq: updates.oldestPositionSeq !== undefined ? updates.oldestPositionSeq : prev.oldestPositionSeq,
        newestSeq,
        hasMore: updates.hasMore !== undefined ? updates.hasMore : prev.hasMore,
        isLoading: updates.isLoading !== undefined ? updates.isLoading : prev.isLoading,
        isLoadingMore: updates.isLoadingMore !== undefined ? updates.isLoadingMore : prev.isLoadingMore,
        warning: updates.warning !== undefined ? updates.warning : prev.warning,
        atBottom: updates.atBottom !== undefined ? updates.atBottom : prev.atBottom,
        messagesVersion,
    }
}

export function getMessageWindowState(sessionId: string): MessageWindowState {
    return getState(sessionId)
}

export function setAtBottom(sessionId: string, atBottom: boolean): void {
    updateState(sessionId, (prev) => {
        if (prev.atBottom === atBottom) {
            return prev
        }
        return buildState(prev, { atBottom })
    }, true)
}
