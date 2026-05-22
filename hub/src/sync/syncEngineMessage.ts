/**
 * Message-domain sub-facade of SyncEngine.
 *
 * Constructor accepts `sessionCache` for the markMessageQueued side effect on send.
 */
import type { DecryptedMessage } from '@hapi/protocol/types'
import type { CancelQueuedMessageResult } from '../store'
import type { MessageService } from './messageService'
import type { SessionCache } from './sessionCache'

export class SyncEngineMessage {
    constructor(
        private readonly messageService: MessageService,
        private readonly sessionCache: SessionCache
    ) {}

    getMessagesPage(
        sessionId: string,
        options: { limit: number; before?: { at: number; seq: number } | null }
    ): {
        messages: DecryptedMessage[]
        page: {
            limit: number
            nextBeforeSeq: number | null
            nextBeforeAt: number | null
            hasMore: boolean
        }
    } {
        return this.messageService.getMessagesPage(sessionId, options)
    }

    getDeliverableMessagesAfter(
        sessionId: string,
        options: { afterSeq: number; limit: number; now: number }
    ): DecryptedMessage[] {
        return this.messageService.getDeliverableMessagesAfter(sessionId, options)
    }

    async sendMessage(
        sessionId: string,
        payload: {
            text: string
            localId?: string | null
            attachments?: Array<{
                id: string
                filename: string
                mimeType: string
                size: number
                path: string
                previewUrl?: string
            }>
            sentFrom?: 'webapp'
            scheduledAt?: number | null
        }
    ): Promise<void> {
        await this.messageService.sendMessage(sessionId, payload)
        this.sessionCache.markMessageQueued(sessionId)
    }

    async cancelQueuedMessage(
        sessionId: string,
        messageId: string
    ): Promise<CancelQueuedMessageResult> {
        return this.messageService.cancelQueuedMessage(sessionId, messageId)
    }

    sweepImmediateQueuedOnSessionEnd(sessionId: string, invokedAt: number): void {
        this.messageService.sweepImmediateQueuedOnSessionEnd(sessionId, invokedAt)
    }
}
