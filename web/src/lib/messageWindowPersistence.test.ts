import { afterEach, describe, expect, it } from 'vitest'
import type { DecryptedMessage } from '@/types/api'
import {
    clearPersistedState,
    hydrateState,
    persistState,
} from './messageWindowPersistence'
import { createState, buildState } from './messageWindowState'
import { clearMessageWindow } from './messageWindowSubscriptions'

function agentMsg(id: string, seq: number, createdAt: number): DecryptedMessage {
    return {
        id,
        seq,
        localId: null,
        content: { role: 'agent', content: { type: 'text', text: 'reply' } },
        createdAt,
        invokedAt: createdAt,
    } as DecryptedMessage
}

describe('messageWindowPersistence', () => {
    const SESSION = 'persistence-test-session'

    afterEach(() => {
        clearMessageWindow(SESSION)
        sessionStorage.clear()
    })

    it('persistState writes to sessionStorage under the prefixed key', () => {
        const base = createState(SESSION)
        const state = buildState(base, {
            messages: [agentMsg('persisted-1', 5, 1_700_000_000_000)],
            hasMore: true,
        })
        persistState(SESSION, state)
        const raw = sessionStorage.getItem(`hapi:message-window:v1:${SESSION}`)
        expect(raw).not.toBeNull()
        const parsed = JSON.parse(raw!)
        expect(parsed.messages[0].id).toBe('persisted-1')
        expect(parsed.hasMore).toBe(true)
    })

    it('hydrateState round-trips persisted state back into an InternalState', () => {
        const base = createState(SESSION)
        const state = buildState(base, {
            messages: [agentMsg('round-trip', 7, 1_700_000_000_100)],
            hasMore: true,
        })
        persistState(SESSION, state)
        const hydrated = hydrateState(SESSION)
        expect(hydrated).not.toBeNull()
        expect(hydrated!.messages.map((m) => m.id)).toEqual(['round-trip'])
        expect(hydrated!.hasMore).toBe(true)
    })

    it('persistState skips writing when state is empty (no messages / pending / warning)', () => {
        const empty = createState(SESSION)
        persistState(SESSION, empty)
        expect(sessionStorage.getItem(`hapi:message-window:v1:${SESSION}`)).toBeNull()
    })

    it('clearPersistedState removes the stored entry', () => {
        const base = createState(SESSION)
        const state = buildState(base, {
            messages: [agentMsg('to-clear', 9, 1_700_000_000_200)],
        })
        persistState(SESSION, state)
        expect(sessionStorage.getItem(`hapi:message-window:v1:${SESSION}`)).not.toBeNull()
        clearPersistedState(SESSION)
        expect(sessionStorage.getItem(`hapi:message-window:v1:${SESSION}`)).toBeNull()
    })

    it('hydrateState returns null and clears corrupted entries', () => {
        sessionStorage.setItem(`hapi:message-window:v1:${SESSION}`, '{"not":"valid"}')
        expect(hydrateState(SESSION)).toBeNull()
        expect(sessionStorage.getItem(`hapi:message-window:v1:${SESSION}`)).toBeNull()
    })
})
