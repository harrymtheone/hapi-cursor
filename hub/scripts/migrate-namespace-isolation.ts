#!/usr/bin/env bun

import { Database } from 'bun:sqlite'

export type NamespaceIsolationMigrationResult = {
    sessions: number
    machines: number
    messages: number
    pushSubscriptions: number
}

const TARGET_SCHEMA_VERSION = 10
const SOURCE_SCHEMA_VERSION = 9

function requireExplicitDbPath(dbPath: string): string {
    const trimmed = dbPath.trim()
    if (trimmed.length === 0) {
        throw new Error('An explicit SQLite DB path is required.')
    }
    return trimmed
}

function getUserVersion(db: Database): number {
    return db.query<{ user_version: number }, []>('PRAGMA user_version').get()?.user_version ?? 0
}

function countRows(db: Database, table: string): number {
    return db.query<{ count: number }, []>(`SELECT COUNT(*) AS count FROM ${table}`).get()?.count ?? 0
}

export function migrateNamespaceIsolation(dbPath: string): NamespaceIsolationMigrationResult {
    const explicitPath = requireExplicitDbPath(dbPath)
    const db = new Database(explicitPath, { create: false, readwrite: true, strict: true })

    try {
        const sourceVersion = getUserVersion(db)
        if (sourceVersion !== SOURCE_SCHEMA_VERSION) {
            throw new Error(
                `Expected SQLite schema version ${SOURCE_SCHEMA_VERSION}, found ${sourceVersion}. ` +
                'Run this offline migration only against a backed-up v9 database.'
            )
        }

        db.exec('PRAGMA foreign_keys = OFF')
        db.exec('BEGIN')
        try {
            db.exec(`
                CREATE TABLE sessions_v10 (
                    id TEXT PRIMARY KEY,
                    tag TEXT,
                    machine_id TEXT,
                    created_at INTEGER NOT NULL,
                    updated_at INTEGER NOT NULL,
                    metadata TEXT,
                    metadata_version INTEGER DEFAULT 1,
                    agent_state TEXT,
                    agent_state_version INTEGER DEFAULT 1,
                    model TEXT,
                    model_reasoning_effort TEXT,
                    effort TEXT,
                    todos TEXT,
                    todos_updated_at INTEGER,
                    team_state TEXT,
                    team_state_updated_at INTEGER,
                    active INTEGER DEFAULT 0,
                    active_at INTEGER,
                    seq INTEGER DEFAULT 0
                );
                INSERT INTO sessions_v10 (
                    id, tag, machine_id, created_at, updated_at,
                    metadata, metadata_version,
                    agent_state, agent_state_version,
                    model, model_reasoning_effort, effort,
                    todos, todos_updated_at,
                    team_state, team_state_updated_at,
                    active, active_at, seq
                )
                SELECT
                    id, tag, machine_id, created_at, updated_at,
                    metadata, metadata_version,
                    agent_state, agent_state_version,
                    model, model_reasoning_effort, effort,
                    todos, todos_updated_at,
                    team_state, team_state_updated_at,
                    active, active_at, seq
                FROM sessions;

                CREATE TABLE machines_v10 (
                    id TEXT PRIMARY KEY,
                    created_at INTEGER NOT NULL,
                    updated_at INTEGER NOT NULL,
                    metadata TEXT,
                    metadata_version INTEGER DEFAULT 1,
                    runner_state TEXT,
                    runner_state_version INTEGER DEFAULT 1,
                    active INTEGER DEFAULT 0,
                    active_at INTEGER,
                    seq INTEGER DEFAULT 0
                );
                INSERT INTO machines_v10 (
                    id, created_at, updated_at,
                    metadata, metadata_version,
                    runner_state, runner_state_version,
                    active, active_at, seq
                )
                SELECT
                    id, created_at, updated_at,
                    metadata, metadata_version,
                    runner_state, runner_state_version,
                    active, active_at, seq
                FROM machines;

                CREATE TABLE messages_v10 (
                    id TEXT PRIMARY KEY,
                    session_id TEXT NOT NULL,
                    content TEXT NOT NULL,
                    created_at INTEGER NOT NULL,
                    seq INTEGER NOT NULL,
                    local_id TEXT,
                    invoked_at INTEGER,
                    scheduled_at INTEGER,
                    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
                );
                INSERT INTO messages_v10 (
                    id, session_id, content, created_at, seq, local_id, invoked_at, scheduled_at
                )
                SELECT id, session_id, content, created_at, seq, local_id, invoked_at, scheduled_at
                FROM messages;

                CREATE TABLE push_subscriptions_v10 (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    endpoint TEXT NOT NULL,
                    p256dh TEXT NOT NULL,
                    auth TEXT NOT NULL,
                    created_at INTEGER NOT NULL,
                    UNIQUE(endpoint)
                );
                INSERT INTO push_subscriptions_v10 (endpoint, p256dh, auth, created_at)
                SELECT endpoint, p256dh, auth, created_at
                FROM push_subscriptions AS candidate
                WHERE candidate.id = (
                    SELECT winner.id
                    FROM push_subscriptions AS winner
                    WHERE winner.endpoint = candidate.endpoint
                    ORDER BY winner.created_at DESC, winner.id DESC
                    LIMIT 1
                )
                ORDER BY created_at ASC, endpoint ASC;

                DROP TABLE messages;
                DROP TABLE sessions;
                DROP TABLE machines;
                DROP TABLE users;
                DROP TABLE push_subscriptions;

                ALTER TABLE sessions_v10 RENAME TO sessions;
                ALTER TABLE machines_v10 RENAME TO machines;
                ALTER TABLE messages_v10 RENAME TO messages;
                ALTER TABLE push_subscriptions_v10 RENAME TO push_subscriptions;

                CREATE INDEX idx_sessions_tag ON sessions(tag);
                CREATE INDEX idx_messages_session ON messages(session_id, seq);
                CREATE UNIQUE INDEX idx_messages_local_id
                    ON messages(session_id, local_id)
                    WHERE local_id IS NOT NULL;
                CREATE INDEX idx_messages_session_position
                    ON messages(session_id, COALESCE(invoked_at, created_at) DESC, seq DESC);
                CREATE INDEX idx_messages_scheduled_pending
                    ON messages(scheduled_at)
                    WHERE scheduled_at IS NOT NULL AND invoked_at IS NULL;
                PRAGMA user_version = 10;
            `)

            const result: NamespaceIsolationMigrationResult = {
                sessions: countRows(db, 'sessions'),
                machines: countRows(db, 'machines'),
                messages: countRows(db, 'messages'),
                pushSubscriptions: countRows(db, 'push_subscriptions')
            }

            db.exec('COMMIT')
            return result
        } catch (error) {
            db.exec('ROLLBACK')
            throw error
        } finally {
            db.exec('PRAGMA foreign_keys = ON')
        }
    } finally {
        db.close()
    }
}

function main(): void {
    const dbPath = process.argv[2] ?? ''
    const result = migrateNamespaceIsolation(dbPath)
    console.log(JSON.stringify(result, null, 2))
}

if (import.meta.main) {
    main()
}
