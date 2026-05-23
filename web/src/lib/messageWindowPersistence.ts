import type { DecryptedMessage } from '@/types/api'
import {
    buildState,
    createState,
    peekInternalState,
    type InternalState,
} from './messageWindowState'

const STORAGE_KEY_PREFIX = 'hapi:message-window:v1:'
const PERSIST_THROTTLE_MS = 200

type PersistedMessageWindowState = {
    messages: DecryptedMessage[]
    pending: DecryptedMessage[]
    pendingOverflowCount: number
    pendingOverflowVisibleCount: number
    hasMore: boolean
    oldestPositionAt: number | null
    oldestPositionSeq: number | null
    warning: string | null
    atBottom: boolean
}

const pendingPersistSessionIds = new Set<string>()
let persistTimerId: ReturnType<typeof setTimeout> | null = null

function getStorageKey(sessionId: string): string {
    return `${STORAGE_KEY_PREFIX}${sessionId}`
}

function isSessionStorageAvailable(): boolean {
    try {
        return typeof sessionStorage?.getItem === 'function'
    } catch {
        return false
    }
}

function toNullableNumber(value: unknown): number | null {
    return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function shouldPersistState(state: InternalState): boolean {
    return state.messages.length > 0
        || state.pending.length > 0
        || state.pendingOverflowCount > 0
        || state.pendingOverflowVisibleCount > 0
        || state.hasMore
        || state.warning !== null
}

export function persistState(sessionId: string, state: InternalState): void {
    if (!isSessionStorageAvailable()) {
        return
    }
    try {
        if (!shouldPersistState(state)) {
            sessionStorage.removeItem(getStorageKey(sessionId))
            return
        }
        const persisted: PersistedMessageWindowState = {
            messages: state.messages,
            pending: state.pending,
            pendingOverflowCount: state.pendingOverflowCount,
            pendingOverflowVisibleCount: state.pendingOverflowVisibleCount,
            hasMore: state.hasMore,
            oldestPositionAt: state.oldestPositionAt,
            oldestPositionSeq: state.oldestPositionSeq,
            warning: state.warning,
            atBottom: state.atBottom,
        }
        sessionStorage.setItem(getStorageKey(sessionId), JSON.stringify(persisted))
    } catch {
    }
}

export function clearPersistedState(sessionId: string): void {
    pendingPersistSessionIds.delete(sessionId)
    if (!isSessionStorageAvailable()) {
        return
    }
    try {
        sessionStorage.removeItem(getStorageKey(sessionId))
    } catch {
    }
}

export function flushPersistedStates(): void {
    persistTimerId = null
    const sessionIds = Array.from(pendingPersistSessionIds)
    pendingPersistSessionIds.clear()
    for (const sessionId of sessionIds) {
        const state = peekInternalState(sessionId)
        if (!state) {
            clearPersistedState(sessionId)
            continue
        }
        persistState(sessionId, state)
    }
}

export function schedulePersist(sessionId: string): void {
    if (!isSessionStorageAvailable()) {
        return
    }
    pendingPersistSessionIds.add(sessionId)
    if (persistTimerId !== null) {
        return
    }
    persistTimerId = setTimeout(flushPersistedStates, PERSIST_THROTTLE_MS)
}

export function hydrateState(sessionId: string): InternalState | null {
    if (!isSessionStorageAvailable()) {
        return null
    }
    try {
        const raw = sessionStorage.getItem(getStorageKey(sessionId))
        if (!raw) {
            return null
        }
        const parsed = JSON.parse(raw) as Partial<PersistedMessageWindowState> | null
        if (!parsed || !Array.isArray(parsed.messages) || !Array.isArray(parsed.pending)) {
            clearPersistedState(sessionId)
            return null
        }
        const base = createState(sessionId)
        return buildState(base, {
            messages: parsed.messages,
            pending: parsed.pending,
            pendingOverflowCount: typeof parsed.pendingOverflowCount === 'number' ? parsed.pendingOverflowCount : 0,
            pendingOverflowVisibleCount: typeof parsed.pendingOverflowVisibleCount === 'number' ? parsed.pendingOverflowVisibleCount : 0,
            hasMore: parsed.hasMore === true,
            oldestPositionAt: toNullableNumber(parsed.oldestPositionAt),
            oldestPositionSeq: toNullableNumber(parsed.oldestPositionSeq),
            warning: typeof parsed.warning === 'string' ? parsed.warning : null,
            atBottom: parsed.atBottom !== false,
        })
    } catch {
        clearPersistedState(sessionId)
        return null
    }
}
