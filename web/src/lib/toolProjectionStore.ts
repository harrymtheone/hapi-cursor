import type { ToolCallProjection } from '@hapi/protocol'

// Module-private Map — sole owner per Pitfall 4 / D-09.
// Keyed by sessionId → { callId → ToolCallProjection }.
// Lives outside the trimmed message window so result-only cards survive pagination.
const projections = new Map<string, Record<string, ToolCallProjection>>()

/**
 * Merge toolCalls from one paginated getMessages response into the session map.
 * Unions all callIds without dropping earlier entries (D-06, D-09).
 */
export function mergePageToolCalls(
    sessionId: string,
    toolCalls: Record<string, ToolCallProjection> | undefined
): void {
    if (!toolCalls || Object.keys(toolCalls).length === 0) return
    const existing = projections.get(sessionId) ?? {}
    projections.set(sessionId, { ...existing, ...toolCalls })
}

/**
 * Patch a single callId in the session projection map (D-08 SSE path).
 */
export function patchProjection(
    sessionId: string,
    callId: string,
    projection: ToolCallProjection
): void {
    const existing = projections.get(sessionId) ?? {}
    projections.set(sessionId, { ...existing, [callId]: projection })
}

/**
 * Read the current projection map for a session.
 * Returns an empty object for unknown sessions.
 */
export function getProjectionsForSession(sessionId: string): Record<string, ToolCallProjection> {
    return projections.get(sessionId) ?? {}
}

/**
 * Clear all projections for a session on teardown (session-removed / clearMessageWindow).
 */
export function clearProjectionsForSession(sessionId: string): void {
    projections.delete(sessionId)
}
