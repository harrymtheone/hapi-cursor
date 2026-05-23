import { afterEach, describe, expect, it, vi } from 'vitest'
import type { DecryptedMessage } from '@/types/api'
import {
    clearMessageWindow,
    seedMessageWindowFromSession,
    subscribeMessageWindow,
} from './messageWindowSubscriptions'
import { appendOptimisticMessage } from './messageWindowMergeService'
import { getInternalState } from './messageWindowState'

function userMsg(id: string): DecryptedMessage {
    return {
        id,
        seq: null,
        localId: id,
        content: { role: 'user', content: { type: 'text', text: 'hello' } },
        createdAt: Date.now(),
        invokedAt: null,
        status: 'queued',
    } as DecryptedMessage
}

describe('messageWindowSubscriptions', () => {
    const SESSION = 'sub-test-session'

    afterEach(() => {
        clearMessageWindow(SESSION)
        clearMessageWindow('sub-test-target')
        sessionStorage.clear()
    })

    it('subscribeMessageWindow listener fires on immediate state changes', () => {
        const listener = vi.fn()
        const unsubscribe = subscribeMessageWindow(SESSION, listener)
        // appendOptimisticMessage uses the immediate notify path
        appendOptimisticMessage(SESSION, userMsg('immediate-1'))
        expect(listener).toHaveBeenCalled()
        unsubscribe()
    })

    it('clearMessageWindow resets messages back to an empty window', () => {
        appendOptimisticMessage(SESSION, userMsg('to-clear'))
        expect(getInternalState(SESSION).messages).toHaveLength(1)
        clearMessageWindow(SESSION)
        expect(getInternalState(SESSION).messages).toHaveLength(0)
    })

    it('unsubscribing prevents further listener invocations', () => {
        const listener = vi.fn()
        const unsubscribe = subscribeMessageWindow(SESSION, listener)
        unsubscribe()
        appendOptimisticMessage(SESSION, userMsg('after-unsub'))
        expect(listener).not.toHaveBeenCalled()
    })

    it('seedMessageWindowFromSession copies messages between sessions', () => {
        appendOptimisticMessage(SESSION, userMsg('seed-1'))
        seedMessageWindowFromSession(SESSION, 'sub-test-target')
        const target = getInternalState('sub-test-target')
        expect(target.messages.map((m) => m.id)).toEqual(['seed-1'])
    })
})
