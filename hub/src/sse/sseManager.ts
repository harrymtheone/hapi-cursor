import type { SyncEvent } from '@hapi/protocol/types'
import type { VisibilityState } from '../visibility/visibilityTracker'
import type { VisibilityTracker } from '../visibility/visibilityTracker'
import type { KeepaliveScheduler, SchedulerHandle } from '../utils/scheduler'

export type SSESubscription = {
    id: string
    all: boolean
    sessionId: string | null
    machineId: string | null
}

type SSEConnection = SSESubscription & {
    send: (event: SyncEvent) => void | Promise<void>
    sendHeartbeat: () => void | Promise<void>
}

export class SSEManager {
    private readonly connections: Map<string, SSEConnection> = new Map()
    private heartbeatHandle: SchedulerHandle | null = null
    private readonly heartbeatMs: number
    private readonly visibilityTracker: VisibilityTracker
    private readonly scheduler: KeepaliveScheduler

    constructor(heartbeatMs: number, visibilityTracker: VisibilityTracker, scheduler: KeepaliveScheduler) {
        this.heartbeatMs = heartbeatMs
        this.visibilityTracker = visibilityTracker
        this.scheduler = scheduler
    }

    subscribe(options: {
        id: string
        all?: boolean
        sessionId?: string | null
        machineId?: string | null
        visibility?: VisibilityState
        send: (event: SyncEvent) => void | Promise<void>
        sendHeartbeat: () => void | Promise<void>
    }): SSESubscription {
        const subscription: SSEConnection = {
            id: options.id,
            all: Boolean(options.all),
            sessionId: options.sessionId ?? null,
            machineId: options.machineId ?? null,
            send: options.send,
            sendHeartbeat: options.sendHeartbeat
        }

        this.connections.set(subscription.id, subscription)
        this.visibilityTracker.registerConnection(
            subscription.id,
            options.visibility ?? 'hidden'
        )
        this.ensureHeartbeat()
        return {
            id: subscription.id,
            all: subscription.all,
            sessionId: subscription.sessionId,
            machineId: subscription.machineId
        }
    }

    unsubscribe(id: string): void {
        this.connections.delete(id)
        this.visibilityTracker.removeConnection(id)
        if (this.connections.size === 0) {
            this.stopHeartbeat()
        }
    }

    async sendToast(event: Extract<SyncEvent, { type: 'toast' }>): Promise<number> {
        const deliveries: Array<Promise<{ id: string; ok: boolean }>> = []
        for (const connection of this.connections.values()) {
            if (!this.visibilityTracker.isVisibleConnection(connection.id)) {
                continue
            }

            deliveries.push(
                Promise.resolve(connection.send(event))
                    .then(() => ({ id: connection.id, ok: true }))
                    .catch(() => ({ id: connection.id, ok: false }))
            )
        }

        if (deliveries.length === 0) {
            return 0
        }

        const results = await Promise.all(deliveries)
        let successCount = 0
        for (const result of results) {
            if (result.ok) {
                successCount += 1
                continue
            }
            this.unsubscribe(result.id)
        }

        return successCount
    }

    broadcast(event: SyncEvent): void {
        for (const connection of this.connections.values()) {
            if (!this.shouldSend(connection, event)) {
                continue
            }

            void Promise.resolve(connection.send(event)).catch(() => {
                this.unsubscribe(connection.id)
            })
        }
    }

    stop(): void {
        this.stopHeartbeat()
        for (const id of this.connections.keys()) {
            this.visibilityTracker.removeConnection(id)
        }
        this.connections.clear()
    }

    private ensureHeartbeat(): void {
        if (this.heartbeatHandle || this.heartbeatMs <= 0) {
            return
        }

        this.heartbeatHandle = this.scheduler.everyMs('sse-heartbeat', this.heartbeatMs, () => {
            for (const connection of this.connections.values()) {
                void Promise.resolve(connection.sendHeartbeat()).catch(() => {
                    this.unsubscribe(connection.id)
                })
            }
        })
    }

    private stopHeartbeat(): void {
        if (!this.heartbeatHandle) {
            return
        }

        this.heartbeatHandle.cancel()
        this.heartbeatHandle = null
    }

    private shouldSend(connection: SSEConnection, event: SyncEvent): boolean {
        if (event.type === 'message-received') {
            return connection.all || connection.sessionId === event.sessionId
        }

        if (event.type === 'connection-changed') {
            return true
        }

        if (connection.all) {
            return true
        }

        if ('sessionId' in event && connection.sessionId === event.sessionId) {
            return true
        }

        if ('machineId' in event && connection.machineId === event.machineId) {
            return true
        }

        return false
    }
}
