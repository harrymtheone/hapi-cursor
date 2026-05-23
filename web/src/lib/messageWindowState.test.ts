import { afterEach, describe, expect, it } from 'vitest'
import type { DecryptedMessage } from '@/types/api'
import {
    buildState,
    createState,
    getInternalListeners,
    getInternalState,
    getMessageWindowState,
    peekInternalState,
    setAtBottom,
    setInternalListeners,
    updateInternalState,
} from './messageWindowState'
import { clearMessageWindow } from './messageWindowSubscriptions'

function userMsg(id: string, overrides: Partial<DecryptedMessage> = {}): DecryptedMessage {
    return {
        id,
        seq: null,
        localId: null,
        content: { role: 'user', content: { type: 'text', text: 'hi' } },
        createdAt: Date.now(),
        invokedAt: null,
        ...overrides,
    } as DecryptedMessage
}

describe('messageWindowState accessors', () => {
    const SESSION = 'state-test-session'

    afterEach(() => {
        clearMessageWindow(SESSION)
        sessionStorage.clear()
    })

    it('getInternalState returns the same instance on repeat calls (when state has not changed)', () => {
        const first = getInternalState(SESSION)
        const second = getInternalState(SESSION)
        expect(second).toBe(first)
    })

    it('updateInternalState mutates state visibly via subsequent reads', () => {
        updateInternalState(SESSION, (prev) => buildState(prev, { messages: [userMsg('m-1', { seq: 1 })] }))
        const state = getInternalState(SESSION)
        expect(state.messages).toHaveLength(1)
        expect(state.messages[0].id).toBe('m-1')
        expect(state.messagesVersion).toBeGreaterThan(0)
    })

    it('setAtBottom toggles the flag through buildState', () => {
        // Default atBottom is true; flipping should mutate and bump messagesVersion only on real change.
        setAtBottom(SESSION, false)
        expect(getMessageWindowState(SESSION).atBottom).toBe(false)
        setAtBottom(SESSION, true)
        expect(getMessageWindowState(SESSION).atBottom).toBe(true)
    })

    it('peekInternalState returns undefined for unknown session, then state after first access', () => {
        const before = peekInternalState('never-seen-session')
        expect(before).toBeUndefined()
        getInternalState('seen-session')
        expect(peekInternalState('seen-session')).toBeDefined()
        clearMessageWindow('seen-session')
    })

    it('getInternalListeners exposes the listener set after setInternalListeners', () => {
        const subs = new Set<() => void>([() => { /* noop */ }])
        setInternalListeners(SESSION, subs)
        expect(getInternalListeners(SESSION)).toBe(subs)
    })

    it('createState returns a fresh internal state with sensible defaults', () => {
        const state = createState('fresh-session')
        expect(state.messages).toEqual([])
        expect(state.atBottom).toBe(true)
        expect(state.latestGeneration).toBe(0)
        expect(state.olderGeneration).toBe(0)
    })
})
