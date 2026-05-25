import type { Database } from 'bun:sqlite'

import { ToolCallProjectionSchema } from '@hapi/protocol/schemas'
import type { ToolCallProjection } from '@hapi/protocol/types'

import { safeJsonParse } from './json'

const MAX_PROJECTION_BYTES = 65536

export function upsertToolCall(
    db: Database,
    sessionId: string,
    callId: string,
    projection: ToolCallProjection
): void {
    const json = JSON.stringify(projection)
    if (json.length > MAX_PROJECTION_BYTES) {
        throw new Error(
            `Tool call projection for callId ${callId} exceeds ${MAX_PROJECTION_BYTES} bytes (got ${json.length})`
        )
    }
    const now = Date.now()
    db.prepare(`
        INSERT INTO tool_calls (session_id, call_id, projection, updated_at)
        VALUES (@session_id, @call_id, @projection, @updated_at)
        ON CONFLICT(session_id, call_id) DO UPDATE SET
            projection = excluded.projection,
            updated_at = excluded.updated_at
    `).run({
        session_id: sessionId,
        call_id: callId,
        projection: json,
        updated_at: now
    })
}

export function getBySessionAndCallIds(
    db: Database,
    sessionId: string,
    callIds: string[]
): Record<string, ToolCallProjection> {
    if (callIds.length === 0) return {}
    const placeholders = callIds.map(() => '?').join(', ')
    const rows = db.prepare(
        `SELECT call_id, projection FROM tool_calls WHERE session_id = ? AND call_id IN (${placeholders})`
    ).all(sessionId, ...callIds) as Array<{ call_id: string; projection: string }>

    const result: Record<string, ToolCallProjection> = {}
    for (const row of rows) {
        const parsed = safeJsonParse(row.projection)
        const validated = ToolCallProjectionSchema.safeParse(parsed)
        if (validated.success) {
            result[row.call_id] = validated.data
        }
    }
    return result
}
