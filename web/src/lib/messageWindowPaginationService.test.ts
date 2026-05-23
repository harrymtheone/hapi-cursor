import { afterEach, describe, expect, it, vi } from 'vitest'
import { AGENT_MESSAGE_PAYLOAD_TYPE } from '@hapi/protocol'
import type { ApiClient } from '@/api/client'
import type { DecryptedMessage } from '@/types/api'
import {
    fetchLatestMessages,
    isAgentRunMessage,
    sliceForTrim,
    trimVisible,
    trimVisibleWithDropped,
} from './messageWindowPaginationService'
import { getInternalState, VISIBLE_WINDOW_SIZE } from './messageWindowState'
import { clearMessageWindow } from './messageWindowSubscriptions'

function regularMsg(id: string, seq: number, createdAt: number): DecryptedMessage {
    return {
        id,
        seq,
        localId: null,
        content: { role: 'agent', content: { type: 'text', text: 'hello' } },
        createdAt,
        invokedAt: createdAt,
    } as DecryptedMessage
}

function agentRunMsg(id: string, seq: number, createdAt: number): DecryptedMessage {
    return {
        id,
        seq,
        localId: null,
        content: {
            role: 'agent',
            content: {
                type: AGENT_MESSAGE_PAYLOAD_TYPE,
                data: { type: 'agent-run-update', cardId: 'c', agentId: 'a', status: 'running', activity: '...' },
            },
        },
        createdAt,
        invokedAt: createdAt,
    } as DecryptedMessage
}

describe('messageWindowPaginationService', () => {
    const SESSION = 'pagination-test-session'

    afterEach(() => {
        clearMessageWindow(SESSION)
        sessionStorage.clear()
    })

    it('isAgentRunMessage detects agent-run-* event types', () => {
        expect(isAgentRunMessage(agentRunMsg('r-1', 1, 0))).toBe(true)
        expect(isAgentRunMessage(regularMsg('m-1', 1, 0))).toBe(false)
    })

    it('sliceForTrim keeps the last N for append mode', () => {
        const items = [1, 2, 3, 4, 5]
        const { kept, dropped } = sliceForTrim(items, 3, 'append')
        expect(kept).toEqual([3, 4, 5])
        expect(dropped).toEqual([1, 2])
    })

    it('trimVisible respects VISIBLE_WINDOW_SIZE for regular messages', () => {
        const overflow = VISIBLE_WINDOW_SIZE + 5
        const messages = Array.from({ length: overflow }, (_, i) => regularMsg(`m-${i}`, i + 1, 1_000 + i))
        const kept = trimVisible(messages, 'append')
        expect(kept).toHaveLength(VISIBLE_WINDOW_SIZE)
        expect(kept[0].id).toBe(`m-5`)
        expect(kept[kept.length - 1].id).toBe(`m-${overflow - 1}`)
    })

    it('trimVisibleWithDropped reports the dropped slice', () => {
        const overflow = VISIBLE_WINDOW_SIZE + 3
        const messages = Array.from({ length: overflow }, (_, i) => regularMsg(`m-${i}`, i + 1, 1_000 + i))
        const { kept, dropped } = trimVisibleWithDropped(messages, 'append')
        expect(kept).toHaveLength(VISIBLE_WINDOW_SIZE)
        expect(dropped.map((m) => m.id)).toEqual(['m-0', 'm-1', 'm-2'])
    })

    it('fetchLatestMessages records the response and composite cursor pair', async () => {
        const api = {
            getMessages: vi.fn(async () => ({
                messages: [regularMsg('latest-1', 10, 1_700_000_000_000)],
                page: { limit: 50, nextBeforeSeq: 10, nextBeforeAt: 1_700_000_000_000, hasMore: false },
            })),
        } as unknown as ApiClient

        await fetchLatestMessages(api, SESSION)
        const state = getInternalState(SESSION)
        expect(state.messages.map((m) => m.id)).toEqual(['latest-1'])
        expect(state.oldestPositionAt).toBe(1_700_000_000_000)
        expect(state.oldestPositionSeq).toBe(10)
        expect(state.isLoading).toBe(false)
    })
})
