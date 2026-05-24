import type { Database } from 'bun:sqlite'

import type { StoredSession, VersionedUpdateResult } from './types'
import {
    clearSessionTurnCompletionMarker,
    deleteSession,
    getOrCreateSession,
    getSession,
    getSessions,
    setSessionEffort,
    setSessionModel,
    setSessionModelReasoningEffort,
    setSessionTeamState,
    setSessionTurnCompletionMarker,
    setSessionTodos,
    touchSessionUpdatedAt,
    updateSessionAgentState,
    updateSessionMetadata
} from './sessions'

export class SessionStore {
    private readonly db: Database

    constructor(db: Database) {
        this.db = db
    }

    getOrCreateSession(
        tag: string,
        metadata: unknown,
        agentState: unknown,
        options?: { model?: string; effort?: string; modelReasoningEffort?: string }
    ): StoredSession
    getOrCreateSession(
        tag: string,
        metadata: unknown,
        agentState: unknown,
        options?: { model?: string; effort?: string; modelReasoningEffort?: string }
    ): StoredSession {
        return getOrCreateSession(this.db, tag, metadata, agentState, options)
    }

    updateSessionMetadata(
        id: string,
        metadata: unknown,
        expectedVersion: number,
        options?: { touchUpdatedAt?: boolean }
    ): VersionedUpdateResult<unknown | null>
    updateSessionMetadata(
        id: string,
        metadata: unknown,
        expectedVersion: number,
        options?: { touchUpdatedAt?: boolean }
    ): VersionedUpdateResult<unknown | null> {
        return updateSessionMetadata(this.db, id, metadata, expectedVersion, options)
    }

    updateSessionAgentState(
        id: string,
        agentState: unknown,
        expectedVersion: number
    ): VersionedUpdateResult<unknown | null>
    updateSessionAgentState(
        id: string,
        agentState: unknown,
        expectedVersion: number,
    ): VersionedUpdateResult<unknown | null> {
        return updateSessionAgentState(this.db, id, agentState, expectedVersion)
    }

    setSessionTodos(id: string, todos: unknown, todosUpdatedAt: number): boolean {
        return setSessionTodos(this.db, id, todos, todosUpdatedAt)
    }

    setSessionTeamState(id: string, teamState: unknown, updatedAt: number): boolean {
        return setSessionTeamState(this.db, id, teamState, updatedAt)
    }

    setSessionTurnCompletionMarker(id: string, marker: number, updatedAt: number): boolean {
        return setSessionTurnCompletionMarker(this.db, id, marker, updatedAt)
    }

    clearSessionTurnCompletionMarker(id: string, updatedAt: number): boolean {
        return clearSessionTurnCompletionMarker(this.db, id, updatedAt)
    }

    setSessionModel(id: string, model: string | null, options?: { touchUpdatedAt?: boolean }): boolean {
        return setSessionModel(this.db, id, model, options)
    }

    setSessionModelReasoningEffort(
        id: string,
        modelReasoningEffort: string | null,
        options?: { touchUpdatedAt?: boolean }
    ): boolean {
        return setSessionModelReasoningEffort(this.db, id, modelReasoningEffort, options)
    }

    setSessionEffort(id: string, effort: string | null, options?: { touchUpdatedAt?: boolean }): boolean {
        return setSessionEffort(this.db, id, effort, options)
    }

    touchSessionUpdatedAt(id: string, updatedAt: number): boolean {
        return touchSessionUpdatedAt(this.db, id, updatedAt)
    }

    getSession(id: string): StoredSession | null {
        return getSession(this.db, id)
    }

    getSessions(): StoredSession[] {
        return getSessions(this.db)
    }

    deleteSession(id: string): boolean {
        return deleteSession(this.db, id)
    }
}
