import type { SyncEvent } from '@hapi/protocol/types'
import type { SSEManager } from '../sse/sseManager'

export type SyncEventListener = (event: SyncEvent) => void

export class EventPublisher {
    private readonly listeners: Set<SyncEventListener> = new Set()

    constructor(private readonly sseManager: SSEManager) {
    }

    subscribe(listener: SyncEventListener): () => void {
        this.listeners.add(listener)
        return () => this.listeners.delete(listener)
    }

    emit(event: SyncEvent): void {
        for (const listener of this.listeners) {
            try {
                listener(event)
            } catch (error) {
                console.error('[SyncEngine] Listener error:', error)
            }
        }

        this.sseManager.broadcast(event)
    }
}
