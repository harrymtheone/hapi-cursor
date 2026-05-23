import type { Session, WorktreeMetadata } from './schemas'

export type SessionSummaryStatusKind = 'running' | 'thinking' | 'waiting' | 'error' | 'completed' | 'idle'

export type SessionSummaryMetadata = {
    name?: string
    path: string
    machineId?: string
    summary?: { text: string }
    worktree?: WorktreeMetadata
    agentSessionId?: string
}

export type SessionSummary = {
    id: string
    active: boolean
    thinking: boolean
    activeAt: number
    updatedAt: number
    metadata: SessionSummaryMetadata | null
    todoProgress: { completed: number; total: number } | null
    pendingRequestsCount: number
    backgroundTaskCount: number
    model: string | null
    effort: string | null
    statusKind: SessionSummaryStatusKind
    completionMarker: number | null
    errorMarker: number | null
}

function getSessionStatusKind(session: Session, pendingRequestsCount: number): SessionSummaryStatusKind {
    if (session.thinking) return 'thinking'
    if (pendingRequestsCount > 0) return 'waiting'
    if (session.active || (session.backgroundTaskCount ?? 0) > 0) return 'running'
    if (session.endReason === 'error') return 'error'
    if (session.endReason === 'completed') return 'completed'
    return 'idle'
}

export function toSessionSummary(session: Session): SessionSummary {
    const pendingRequestsCount = session.agentState?.requests ? Object.keys(session.agentState.requests).length : 0
    const statusKind = getSessionStatusKind(session, pendingRequestsCount)
    const completionMarker = statusKind === 'completed' ? session.updatedAt : null
    const errorMarker = statusKind === 'error' ? session.updatedAt : null

    const metadata: SessionSummaryMetadata | null = session.metadata ? {
        name: session.metadata.name,
        path: session.metadata.path,
        machineId: session.metadata.machineId ?? undefined,
        summary: session.metadata.summary ? { text: session.metadata.summary.text } : undefined,
        worktree: session.metadata.worktree,
        agentSessionId: session.metadata.cursorSessionId ?? undefined
    } : null

    const todoProgress = session.todos?.length ? {
        completed: session.todos.filter(t => t.status === 'completed').length,
        total: session.todos.length
    } : null

    return {
        id: session.id,
        active: session.active,
        thinking: session.thinking,
        activeAt: session.activeAt,
        updatedAt: session.updatedAt,
        metadata,
        todoProgress,
        pendingRequestsCount,
        backgroundTaskCount: session.backgroundTaskCount ?? 0,
        model: session.model,
        effort: session.effort,
        statusKind,
        completionMarker,
        errorMarker
    }
}
