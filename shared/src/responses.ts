import type { DecryptedMessage, Machine, Session, ToolCallProjection } from './schemas'
import type { SessionSummary } from './sessionSummary'

export type SessionsResponse = { sessions: SessionSummary[] }

export type SessionResponse = { session: Session }

export type MessagesResponse = {
    messages: DecryptedMessage[]
    page: {
        limit: number
        nextBeforeSeq: number | null
        nextBeforeAt: number | null
        hasMore: boolean
    }
    toolCalls?: Record<string, ToolCallProjection>
}

export type MachinesResponse = { machines: Machine[] }

export type SpawnResponse =
    | { type: 'success'; sessionId: string }
    | { type: 'error'; message: string; code?: 'selected-runtime-config-rejected' }
