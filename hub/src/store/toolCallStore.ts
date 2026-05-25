import type { Database } from 'bun:sqlite'

import type { ToolCallProjection } from '@hapi/protocol/types'

import { getBySessionAndCallIds, upsertToolCall } from './toolCalls'

export class ToolCallStore {
    private readonly db: Database

    constructor(db: Database) {
        this.db = db
    }

    upsert(sessionId: string, callId: string, projection: ToolCallProjection): void {
        upsertToolCall(this.db, sessionId, callId, projection)
    }

    getBySessionAndCallIds(sessionId: string, callIds: string[]): Record<string, ToolCallProjection> {
        return getBySessionAndCallIds(this.db, sessionId, callIds)
    }
}
