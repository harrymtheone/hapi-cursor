import { AGENT_MESSAGE_PAYLOAD_TYPE, isObject } from '@hapi/protocol'
import { unwrapRoleWrappedRecordEnvelope } from '@hapi/protocol/messages'
import type { DecryptedMessage, ToolCallProjection } from '@hapi/protocol/types'

import type { Store } from '../store'

export type ToolCallEvent =
    | { kind: 'start'; callId: string; name: string; input: unknown; at: number }
    | { kind: 'result'; callId: string; output: unknown; isError: boolean; at: number }

/**
 * Extract zero or more ToolCallEvents from a stored message's content.
 * Handles both the Cursor wire format (type: 'cursor', data.type: 'tool-call' / 'tool-call-result')
 * and the legacy assistant array format (tool_use / tool_result blocks).
 * Does NOT mutate the content (D-03).
 */
export function extractToolCallEventsFromMessageContent(
    content: unknown,
    messageAt: number
): ToolCallEvent[] {
    const record = unwrapRoleWrappedRecordEnvelope(content)
    if (!record || (record.role !== 'agent' && record.role !== 'assistant')) return []

    const c = record.content
    if (!isObject(c)) return []

    const events: ToolCallEvent[] = []

    // Primary Cursor wire: { type: 'cursor', data: { type: 'tool-call' | 'tool-call-result', ... } }
    if (c.type === AGENT_MESSAGE_PAYLOAD_TYPE) {
        const data = isObject(c.data) ? c.data : null
        if (!data || typeof data.type !== 'string') return events
        if (data.type === 'tool-call' && typeof data.callId === 'string') {
            events.push({
                kind: 'start',
                callId: data.callId,
                name: typeof data.name === 'string' ? data.name : 'unknown',
                input: 'input' in data ? data.input : null,
                at: messageAt
            })
        }
        if (data.type === 'tool-call-result' && typeof data.callId === 'string') {
            events.push({
                kind: 'result',
                callId: data.callId,
                output: 'output' in data ? data.output : null,
                isError: Boolean(data.is_error),
                at: messageAt
            })
        }
        return events
    }

    // Legacy assistant array blocks (mirror web/src/chat/normalizeAgent.ts tool_use / tool_result)
    if (Array.isArray(c)) {
        for (const block of c) {
            if (!isObject(block)) continue
            if (block.type === 'tool_use' && typeof block.id === 'string') {
                events.push({
                    kind: 'start',
                    callId: block.id,
                    name: typeof block.name === 'string' ? block.name : 'unknown',
                    input: 'input' in block ? block.input : null,
                    at: messageAt
                })
            }
            if (block.type === 'tool_result' && typeof block.tool_use_id === 'string') {
                events.push({
                    kind: 'result',
                    callId: block.tool_use_id,
                    output: 'content' in block ? block.content : null,
                    isError: Boolean(block.is_error),
                    at: messageAt
                })
            }
        }
    }

    return events
}

function payloadString(obj: Record<string, unknown>, keys: string[]): string | null {
    for (const key of keys) {
        const value = obj[key]
        if (typeof value === 'string' && value.length > 0) return value
    }
    return null
}

function isPlaceholderProjectionName(name: string | undefined): boolean {
    const normalized = (name ?? '').trim().toLowerCase()
    return normalized === '' || normalized === 'unknown'
}

function hasReadShapedResult(output: unknown): boolean {
    if (!isObject(output)) return false
    const success = output.success
    return isObject(success) && 'content' in success
}

/**
 * Infer HAPI knownTools name from stored tool input/output when wire name was placeholder.
 * Returns null when ambiguous — never guess over wrong label (T-01.2-10).
 */
export function inferToolNameFromPayload(input: unknown, output: unknown): string | null {
    const inObj = isObject(input) ? input : null
    const outObj = isObject(output) ? output : null

    if (inObj) {
        if (payloadString(inObj, ['command', 'cmd'])) return 'Bash'
        if (Array.isArray(inObj.todos) || inObj.merge === true) return 'TodoWrite'

        const pattern = payloadString(inObj, ['pattern'])
        if (pattern) {
            if (pattern.includes('*')) return 'Glob'
            if (payloadString(inObj, ['path', 'file_path', 'glob_pattern'])) return 'Grep'
            return null
        }

        const path = payloadString(inObj, ['file_path', 'path', 'file'])
        if (path) {
            if ('fileText' in inObj || payloadString(inObj, ['content', 'text'])) return 'Write'
            if ('old_string' in inObj || 'new_string' in inObj || Array.isArray(inObj.edits)) {
                return 'Edit'
            }
            if (hasReadShapedResult(outObj)) return 'Read'
            return null
        }
    }

    if (!inObj && outObj && hasReadShapedResult(outObj)) return 'Read'

    return null
}

function resolveProjectionName(
    candidate: string,
    input: unknown,
    output: unknown
): string {
    if (!isPlaceholderProjectionName(candidate)) return candidate
    return inferToolNameFromPayload(input, output) ?? candidate
}

/**
 * Pure merge of a ToolCallEvent into a previous projection (or null for first event).
 * Converges regardless of event order — result before start produces the same final state.
 * Never downgrades a non-placeholder name to empty.
 */
export function mergeToolCallProjection(
    prev: ToolCallProjection | null,
    event: ToolCallEvent
): ToolCallProjection {
    if (event.kind === 'start') {
        const incoming = event
        const mergeInput = prev?.input !== undefined && prev?.input !== null ? prev.input : incoming.input
        if (!prev) {
            const name = resolveProjectionName(incoming.name || 'unknown', incoming.input, null)
            return {
                callId: incoming.callId,
                name,
                input: incoming.input,
                status: 'in_progress',
                startedAt: incoming.at
            }
        }
        const candidateName = (prev.name && prev.name !== 'unknown') ? prev.name
            : (incoming.name || prev.name || 'unknown')
        const name = resolveProjectionName(candidateName, mergeInput, prev.result ?? null)
        return {
            ...prev,
            name,
            input: mergeInput,
            startedAt: Math.min(prev.startedAt, incoming.at),
            status: (prev.status === 'completed' || prev.status === 'failed')
                ? prev.status
                : 'in_progress'
        }
    }

    // kind === 'result'
    const incoming = event
    const status: ToolCallProjection['status'] = incoming.isError ? 'failed' : 'completed'

    if (!prev) {
        const name = resolveProjectionName('unknown', null, incoming.output)
        return {
            callId: incoming.callId,
            name,
            input: null,
            status,
            result: incoming.output,
            startedAt: incoming.at,
            completedAt: incoming.at
        }
    }

    const name = resolveProjectionName(prev.name, prev.input, incoming.output)
    return {
        ...prev,
        name,
        status,
        result: incoming.output,
        completedAt: incoming.at
    }
}

/**
 * Scan all stored messages for a session and converge tool_calls rows.
 * Idempotent: safe to call multiple times.
 */
export function reconcileSessionToolCalls(sessionId: string, store: Store): void {
    // Load all messages for the session (use max limit)
    const messages = store.messages.getMessages(sessionId, 200)

    // Build per-callId projection by merging events in seq order
    const projectionMap = new Map<string, ToolCallProjection>()

    for (const msg of messages) {
        const events = extractToolCallEventsFromMessageContent(msg.content, msg.createdAt)
        for (const event of events) {
            const prev = projectionMap.get(event.callId) ?? null
            projectionMap.set(event.callId, mergeToolCallProjection(prev, event))
        }
    }

    // Upsert each converged projection
    for (const [callId, projection] of projectionMap) {
        try {
            store.toolCalls.upsert(sessionId, callId, projection)
        } catch {
            // Oversize or schema violation — skip silently (non-critical sidecar)
        }
    }
}

/**
 * Collect all callIds referenced in an array of DecryptedMessages.
 * Used by page enrichment to determine which projections to fetch from the store.
 */
export function collectCallIdsFromDecryptedMessages(messages: DecryptedMessage[]): Set<string> {
    const ids = new Set<string>()
    for (const msg of messages) {
        const events = extractToolCallEventsFromMessageContent(msg.content, msg.createdAt)
        for (const event of events) {
            ids.add(event.callId)
        }
    }
    return ids
}
