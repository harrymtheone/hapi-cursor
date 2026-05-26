import type { SessionSummary } from '@/types/api'

/**
 * Skills catalog discovery is session-scoped (GET /sessions/:id/skills).
 * Prefer the most recently active session; otherwise the most recently updated session.
 */
export function pickSkillsCatalogSessionId(sessions: SessionSummary[]): string | null {
    if (sessions.length === 0) {
        return null
    }

    const activeSessions = sessions.filter((session) => session.active)
    if (activeSessions.length > 0) {
        return [...activeSessions].sort((a, b) => b.activeAt - a.activeAt)[0]!.id
    }

    return [...sessions].sort((a, b) => b.updatedAt - a.updatedAt)[0]!.id
}
