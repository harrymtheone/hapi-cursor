import { afterEach, describe, expect, it } from 'vitest'
import type { DecryptedMessage } from '@/types/api'
import {
    appendOptimisticMessage,
    filterPendingAgainstVisible,
    ingestIncomingMessages,
    isOptimisticMessage,
    removeOptimisticMessage,
} from './messageWindowMergeService'
import { getInternalState } from './messageWindowState'
import { clearMessageWindow } from './messageWindowSubscriptions'

function userMsg(id: string, overrides: Partial<DecryptedMessage> = {}): DecryptedMessage {
    return {
        id,
        seq: null,
        localId: id,
        content: { role: 'user', content: { type: 'text', text: 'hi' } },
        createdAt: Date.now(),
        invokedAt: null,
        status: 'queued',
        ...overrides,
    } as DecryptedMessage
}

function serverUserMsg(id: string, seq: number, createdAt: number): DecryptedMessage {
    return {
        id,
        seq,
        localId: null,
        content: { role: 'user', content: { type: 'text', text: 'server-hi' } },
        createdAt,
        invokedAt: createdAt,
    } as DecryptedMessage
}

describe('messageWindowMergeService', () => {
    const SESSION = 'merge-test-session'

    afterEach(() => {
        clearMessageWindow(SESSION)
        sessionStorage.clear()
    })

    it('appendOptimisticMessage then removeOptimisticMessage leaves messages empty', () => {
        const msg = userMsg('opt-1', { localId: 'opt-1' })
        appendOptimisticMessage(SESSION, msg)
        expect(getInternalState(SESSION).messages).toHaveLength(1)
        removeOptimisticMessage(SESSION, 'opt-1')
        expect(getInternalState(SESSION).messages).toHaveLength(0)
    })

    it('ingestIncomingMessages dedupes against already-visible messages across calls', () => {
        const msg = serverUserMsg('dup-1', 1, 1_700_000_000_000)
        ingestIncomingMessages(SESSION, [msg])
        ingestIncomingMessages(SESSION, [msg])
        expect(getInternalState(SESSION).messages).toHaveLength(1)
    })

    it('isOptimisticMessage detects messages whose id equals their localId', () => {
        expect(isOptimisticMessage(userMsg('opt-2', { localId: 'opt-2' }))).toBe(true)
        expect(isOptimisticMessage(serverUserMsg('srv-1', 2, 0))).toBe(false)
    })

    it('filterPendingAgainstVisible removes pending entries already present in visible', () => {
        const pending = [serverUserMsg('p-1', 1, 1), serverUserMsg('p-2', 2, 2)]
        const visible = [serverUserMsg('p-1', 1, 1)]
        const filtered = filterPendingAgainstVisible(pending, visible)
        expect(filtered.map((m) => m.id)).toEqual(['p-2'])
    })
})
