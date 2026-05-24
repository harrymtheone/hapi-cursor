import type { Database } from 'bun:sqlite'
import { randomUUID } from 'node:crypto'

import type { StoredSession, VersionedUpdateResult } from './types'
import { safeJsonParse } from './json'
import { updateVersionedField } from './versionedUpdates'

type OwnerSessionCreateOptions = {
    model?: string
    effort?: string
    modelReasoningEffort?: string
}

type DbSessionRow = {
    id: string
    tag: string | null
    machine_id: string | null
    created_at: number
    updated_at: number
    metadata: string | null
    metadata_version: number
    agent_state: string | null
    agent_state_version: number
    model: string | null
    model_reasoning_effort: string | null
    effort: string | null
    todos: string | null
    todos_updated_at: number | null
    team_state: string | null
    team_state_updated_at: number | null
    turn_completion_marker: number | null
    active: number
    active_at: number | null
    seq: number
}

function toStoredSession(row: DbSessionRow): StoredSession {
    return {
        id: row.id,
        tag: row.tag,
        machineId: row.machine_id,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        metadata: safeJsonParse(row.metadata),
        metadataVersion: row.metadata_version,
        agentState: safeJsonParse(row.agent_state),
        agentStateVersion: row.agent_state_version,
        model: row.model,
        modelReasoningEffort: row.model_reasoning_effort,
        effort: row.effort,
        todos: safeJsonParse(row.todos),
        todosUpdatedAt: row.todos_updated_at,
        teamState: safeJsonParse(row.team_state),
        teamStateUpdatedAt: row.team_state_updated_at,
        turnCompletionMarker: row.turn_completion_marker,
        active: row.active === 1,
        activeAt: row.active_at,
        seq: row.seq
    }
}

export function getOrCreateSession(
    db: Database,
    tag: string,
    metadata: unknown,
    agentState: unknown,
    options?: OwnerSessionCreateOptions
): StoredSession
export function getOrCreateSession(
    db: Database,
    tag: string,
    metadata: unknown,
    agentState: unknown,
    options?: OwnerSessionCreateOptions
): StoredSession {
    const sessionModel = options?.model
    const sessionEffort = options?.effort
    const sessionModelReasoningEffort = options?.modelReasoningEffort

    const existing = db.prepare('SELECT * FROM sessions WHERE tag = ? ORDER BY created_at DESC LIMIT 1').get(tag) as
        | DbSessionRow
        | undefined

    if (existing) {
        return toStoredSession(existing)
    }

    const now = Date.now()
    const id = randomUUID()

    const metadataJson = JSON.stringify(metadata)
    const agentStateJson = agentState === null || agentState === undefined ? null : JSON.stringify(agentState)

    db.prepare(`
        INSERT INTO sessions (
            id, tag, machine_id, created_at, updated_at,
            metadata, metadata_version,
            agent_state, agent_state_version,
            model,
            model_reasoning_effort,
            effort,
            todos, todos_updated_at,
            turn_completion_marker,
            active, active_at, seq
        ) VALUES (
            @id, @tag, NULL, @created_at, @updated_at,
            @metadata, 1,
            @agent_state, 1,
            @model,
            @model_reasoning_effort,
            @effort,
            NULL, NULL,
            NULL,
            0, NULL, 0
        )
    `).run({
        id,
        tag,
        created_at: now,
        updated_at: now,
        metadata: metadataJson,
        agent_state: agentStateJson,
        model: sessionModel ?? null,
        model_reasoning_effort: sessionModelReasoningEffort ?? null,
        effort: sessionEffort ?? null
    })

    const row = getSession(db, id)
    if (!row) {
        throw new Error('Failed to create session')
    }
    return row
}

export function updateSessionMetadata(
    db: Database,
    id: string,
    metadata: unknown,
    expectedVersion: number,
    options?: { touchUpdatedAt?: boolean }
): VersionedUpdateResult<unknown | null>
export function updateSessionMetadata(
    db: Database,
    id: string,
    metadata: unknown,
    expectedVersion: number,
    options?: { touchUpdatedAt?: boolean }
): VersionedUpdateResult<unknown | null> {
    const now = Date.now()
    const touchUpdatedAt = options?.touchUpdatedAt !== false

    return updateVersionedField({
        db,
        table: 'sessions',
        id,
        field: 'metadata',
        versionField: 'metadata_version',
        expectedVersion,
        value: metadata,
        encode: (value) => {
            const json = JSON.stringify(value)
            return json === undefined ? null : json
        },
        decode: safeJsonParse,
        setClauses: [
            'updated_at = CASE WHEN @touch_updated_at = 1 THEN @updated_at ELSE updated_at END',
            'seq = seq + 1'
        ],
        params: {
            updated_at: now,
            touch_updated_at: touchUpdatedAt ? 1 : 0
        }
    })
}

export function updateSessionAgentState(
    db: Database,
    id: string,
    agentState: unknown,
    expectedVersion: number
): VersionedUpdateResult<unknown | null>
export function updateSessionAgentState(
    db: Database,
    id: string,
    agentState: unknown,
    expectedVersion: number
): VersionedUpdateResult<unknown | null> {
    const now = Date.now()
    const normalized = agentState ?? null

    return updateVersionedField({
        db,
        table: 'sessions',
        id,
        field: 'agent_state',
        versionField: 'agent_state_version',
        expectedVersion,
        value: normalized,
        encode: (value) => (value === null ? null : JSON.stringify(value)),
        decode: safeJsonParse,
        setClauses: ['updated_at = @updated_at', 'seq = seq + 1'],
        params: { updated_at: now }
    })
}

export function setSessionTodos(
    db: Database,
    id: string,
    todos: unknown,
    todosUpdatedAt: number
): boolean {
    try {
        const json = todos === null || todos === undefined ? null : JSON.stringify(todos)
        const result = db.prepare(`
            UPDATE sessions
            SET todos = @todos,
                todos_updated_at = @todos_updated_at,
                updated_at = CASE WHEN updated_at > @updated_at THEN updated_at ELSE @updated_at END,
                seq = seq + 1
            WHERE id = @id
              AND (todos_updated_at IS NULL OR todos_updated_at < @todos_updated_at)
        `).run({
            id,
            todos: json,
            todos_updated_at: todosUpdatedAt,
            updated_at: todosUpdatedAt
        })

        return result.changes === 1
    } catch {
        return false
    }
}

export function setSessionTeamState(
    db: Database,
    id: string,
    teamState: unknown,
    updatedAt: number
): boolean {
    try {
        const json = teamState === null || teamState === undefined ? null : JSON.stringify(teamState)
        const result = db.prepare(`
            UPDATE sessions
            SET team_state = @team_state,
                team_state_updated_at = @team_state_updated_at,
                updated_at = CASE WHEN updated_at > @updated_at THEN updated_at ELSE @updated_at END,
                seq = seq + 1
            WHERE id = @id
              AND (team_state_updated_at IS NULL OR team_state_updated_at < @team_state_updated_at)
        `).run({
            id,
            team_state: json,
            team_state_updated_at: updatedAt,
            updated_at: updatedAt
        })

        return result.changes === 1
    } catch {
        return false
    }
}

export function setSessionTurnCompletionMarker(
    db: Database,
    id: string,
    marker: number,
    updatedAt: number
): boolean {
    try {
        const result = db.prepare(`
            UPDATE sessions
            SET turn_completion_marker = @marker,
                updated_at = CASE WHEN updated_at > @updated_at THEN updated_at ELSE @updated_at END,
                seq = seq + 1
            WHERE id = @id
              AND turn_completion_marker IS NOT @marker
        `).run({
            id,
            marker,
            updated_at: updatedAt
        })

        return result.changes === 1
    } catch {
        return false
    }
}

export function clearSessionTurnCompletionMarker(
    db: Database,
    id: string,
    updatedAt: number
): boolean {
    try {
        const result = db.prepare(`
            UPDATE sessions
            SET turn_completion_marker = NULL,
                updated_at = CASE WHEN updated_at > @updated_at THEN updated_at ELSE @updated_at END,
                seq = seq + 1
            WHERE id = @id
              AND turn_completion_marker IS NOT NULL
        `).run({
            id,
            updated_at: updatedAt
        })

        return result.changes === 1
    } catch {
        return false
    }
}

export function setSessionModel(
    db: Database,
    id: string,
    model: string | null,
    options?: { touchUpdatedAt?: boolean }
): boolean {
    const now = Date.now()
    const touchUpdatedAt = options?.touchUpdatedAt === true

    try {
        const result = db.prepare(`
            UPDATE sessions
            SET model = @model,
                updated_at = CASE WHEN @touch_updated_at = 1 THEN @updated_at ELSE updated_at END,
                seq = seq + 1
            WHERE id = @id
              AND model IS NOT @model
        `).run({
            id,
            model,
            updated_at: now,
            touch_updated_at: touchUpdatedAt ? 1 : 0
        })

        return result.changes === 1
    } catch {
        return false
    }
}

export function setSessionModelReasoningEffort(
    db: Database,
    id: string,
    modelReasoningEffort: string | null,
    options?: { touchUpdatedAt?: boolean }
): boolean {
    const now = Date.now()
    const touchUpdatedAt = options?.touchUpdatedAt === true

    try {
        const result = db.prepare(`
            UPDATE sessions
            SET model_reasoning_effort = @model_reasoning_effort,
                updated_at = CASE WHEN @touch_updated_at = 1 THEN @updated_at ELSE updated_at END,
                seq = seq + 1
            WHERE id = @id
              AND model_reasoning_effort IS NOT @model_reasoning_effort
        `).run({
            id,
            model_reasoning_effort: modelReasoningEffort,
            updated_at: now,
            touch_updated_at: touchUpdatedAt ? 1 : 0
        })

        return result.changes === 1
    } catch {
        return false
    }
}

export function setSessionEffort(
    db: Database,
    id: string,
    effort: string | null,
    options?: { touchUpdatedAt?: boolean }
): boolean {
    const now = Date.now()
    const touchUpdatedAt = options?.touchUpdatedAt === true

    try {
        const result = db.prepare(`
            UPDATE sessions
            SET effort = @effort,
                updated_at = CASE WHEN @touch_updated_at = 1 THEN @updated_at ELSE updated_at END,
                seq = seq + 1
            WHERE id = @id
              AND effort IS NOT @effort
        `).run({
            id,
            effort,
            updated_at: now,
            touch_updated_at: touchUpdatedAt ? 1 : 0
        })

        return result.changes === 1
    } catch {
        return false
    }
}

export function touchSessionUpdatedAt(
    db: Database,
    id: string,
    updatedAt: number
): boolean {
    try {
        const result = db.prepare(`
            UPDATE sessions
            SET updated_at = @updated_at,
                seq = seq + 1
            WHERE id = @id
              AND updated_at < @updated_at
        `).run({
            id,
            updated_at: updatedAt
        })

        return result.changes === 1
    } catch {
        return false
    }
}

export function getSession(db: Database, id: string): StoredSession | null {
    const row = db.prepare('SELECT * FROM sessions WHERE id = ?').get(id) as DbSessionRow | undefined
    return row ? toStoredSession(row) : null
}

export function getSessions(db: Database): StoredSession[] {
    const rows = db.prepare('SELECT * FROM sessions ORDER BY updated_at DESC').all() as DbSessionRow[]
    return rows.map(toStoredSession)
}

export function deleteSession(db: Database, id: string): boolean {
    const result = db.prepare('DELETE FROM sessions WHERE id = ?').run(id)
    return result.changes > 0
}
