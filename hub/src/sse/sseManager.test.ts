import { describe, expect, it } from 'bun:test'
import { SSEManager } from './sseManager'
import type { SyncEvent } from '@hapi/protocol/types'
import { VisibilityTracker } from '../visibility/visibilityTracker'

describe('SSEManager relevance filtering', () => {
    it('routes session events by subscription relevance', () => {
        const manager = new SSEManager(0, new VisibilityTracker())
        const receivedAll: SyncEvent[] = []
        const receivedSession: SyncEvent[] = []
        const receivedOther: SyncEvent[] = []

        manager.subscribe({
            id: 'all',
            all: true,
            send: (event) => {
                receivedAll.push(event)
            },
            sendHeartbeat: () => {}
        })

        manager.subscribe({
            id: 'session',
            sessionId: 's1',
            send: (event) => {
                receivedSession.push(event)
            },
            sendHeartbeat: () => {}
        })

        manager.subscribe({
            id: 'other',
            sessionId: 's2',
            send: (event) => {
                receivedOther.push(event)
            },
            sendHeartbeat: () => {}
        })

        manager.broadcast({ type: 'session-updated', sessionId: 's1', data: {} })

        expect(receivedAll).toHaveLength(1)
        expect(receivedSession).toHaveLength(1)
        expect(receivedOther).toHaveLength(0)
    })

    it('broadcasts connection-changed globally', () => {
        const manager = new SSEManager(0, new VisibilityTracker())
        const received: Array<{ id: string; event: SyncEvent }> = []

        manager.subscribe({
            id: 'first',
            all: true,
            send: (event) => {
                received.push({ id: 'first', event })
            },
            sendHeartbeat: () => {}
        })

        manager.subscribe({
            id: 'second',
            all: true,
            send: (event) => {
                received.push({ id: 'second', event })
            },
            sendHeartbeat: () => {}
        })

        manager.broadcast({ type: 'connection-changed', data: { status: 'connected' } })

        expect(received).toHaveLength(2)
        expect(received.map((entry) => entry.id).sort()).toEqual(['first', 'second'])
    })

    it('sends toast only to visible connections', async () => {
        const manager = new SSEManager(0, new VisibilityTracker())
        const received: Array<{ id: string; event: SyncEvent }> = []

        manager.subscribe({
            id: 'visible',
            all: true,
            visibility: 'visible',
            send: (event) => {
                received.push({ id: 'visible', event })
            },
            sendHeartbeat: () => {}
        })

        manager.subscribe({
            id: 'hidden',
            all: true,
            visibility: 'hidden',
            send: (event) => {
                received.push({ id: 'hidden', event })
            },
            sendHeartbeat: () => {}
        })

        manager.subscribe({
            id: 'other',
            all: true,
            visibility: 'visible',
            send: (event) => {
                received.push({ id: 'other', event })
            },
            sendHeartbeat: () => {}
        })

        const toastEvent: Extract<SyncEvent, { type: 'toast' }> = {
            type: 'toast',
            data: {
                title: 'Test',
                body: 'Toast body',
                sessionId: 'session-1',
                url: '/sessions/session-1'
            }
        }

        const delivered = await manager.sendToast(toastEvent)

        expect(delivered).toBe(2)
        expect(received.map((entry) => entry.id).sort()).toEqual(['other', 'visible'])
    })
})
