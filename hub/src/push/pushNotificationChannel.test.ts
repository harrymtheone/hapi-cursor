import { describe, expect, it } from 'bun:test'
import type { Session } from '../sync/syncEngine'
import { PushNotificationChannel } from './pushNotificationChannel'
import type { PushPayload } from './pushService'

function createSession(overrides: Partial<Session> = {}): Session {
    return {
        id: 'session-task-toast',
        name: 'Demo task',
        active: true,
        metadata: { name: 'Demo task' },
        ...overrides
    } as Session
}

describe('PushNotificationChannel', () => {
    it('sends task notifications to visible web clients before falling back to push', async () => {
        const pushed: PushPayload[] = []
        const toasts: unknown[] = []
        const channel = new PushNotificationChannel(
            {
                send: async (payload: PushPayload) => {
                    pushed.push(payload)
                }
            } as never,
            {
                sendToast: async (event: unknown) => {
                    toasts.push(event)
                    return 1
                }
            } as never,
            {
                hasVisibleConnection: () => true
            } as never,
            ''
        )

        await channel.sendTaskNotification(createSession(), {
            status: 'completed',
            summary: 'Background work finished'
        })

        expect(toasts).toHaveLength(1)
        expect(toasts[0]).toEqual({
            type: 'toast',
            data: {
                title: 'Task completed',
                body: 'Cursor · Demo task · Background work finished',
                sessionId: 'session-task-toast',
                url: '/sessions/session-task-toast'
            }
        })
        expect(pushed).toHaveLength(0)
    })

    it('does not reuse one replacement tag for all task notifications in a session', async () => {
        const pushed: PushPayload[] = []
        const channel = new PushNotificationChannel(
            {
                send: async (payload: PushPayload) => {
                    pushed.push(payload)
                }
            } as never,
            {
                sendToast: async () => 0
            } as never,
            {
                hasVisibleConnection: () => false
            } as never,
            ''
        )

        await channel.sendTaskNotification(createSession(), {
            status: 'completed',
            summary: 'First task'
        })
        await channel.sendTaskNotification(createSession(), {
            status: 'failed',
            summary: 'Second task'
        })

        expect(pushed).toHaveLength(2)
        expect(pushed[0].tag).toBeUndefined()
        expect(pushed[1].tag).toBeUndefined()
    })
})
