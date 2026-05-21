import { afterEach, describe, expect, it } from 'bun:test'
import { Database } from 'bun:sqlite'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { migrateNamespaceIsolation } from './migrate-namespace-isolation'

let tempDirs: string[] = []

function makeTempDbPath(): string {
    const dir = mkdtempSync(join(tmpdir(), 'hapi-namespace-migration-'))
    tempDirs.push(dir)
    return join(dir, 'fixture.db')
}

function createV9Fixture(dbPath: string): void {
    const db = new Database(dbPath, { create: true, readwrite: true, strict: true })
    db.exec(`
        PRAGMA user_version = 9;
        PRAGMA foreign_keys = ON;

        CREATE TABLE sessions (
            id TEXT PRIMARY KEY,
            tag TEXT,
            namespace TEXT NOT NULL DEFAULT 'default',
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
        CREATE INDEX idx_sessions_tag_namespace ON sessions(tag, namespace);

        CREATE TABLE machines (
            id TEXT PRIMARY KEY,
            namespace TEXT NOT NULL DEFAULT 'default',
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
        CREATE INDEX idx_machines_namespace ON machines(namespace);

        CREATE TABLE messages (
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
        CREATE INDEX idx_messages_session ON messages(session_id, seq);
        CREATE UNIQUE INDEX idx_messages_local_id ON messages(session_id, local_id) WHERE local_id IS NOT NULL;
        CREATE INDEX idx_messages_session_position
            ON messages(session_id, COALESCE(invoked_at, created_at) DESC, seq DESC);
        CREATE INDEX idx_messages_scheduled_pending
            ON messages(scheduled_at)
            WHERE scheduled_at IS NOT NULL AND invoked_at IS NULL;

        CREATE TABLE users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            platform TEXT NOT NULL,
            platform_user_id TEXT NOT NULL,
            namespace TEXT NOT NULL DEFAULT 'default',
            created_at INTEGER NOT NULL,
            UNIQUE(platform, platform_user_id)
        );

        CREATE TABLE push_subscriptions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            namespace TEXT NOT NULL,
            endpoint TEXT NOT NULL,
            p256dh TEXT NOT NULL,
            auth TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            UNIQUE(namespace, endpoint)
        );

        INSERT INTO sessions (id, tag, namespace, machine_id, created_at, updated_at, metadata, metadata_version, agent_state, agent_state_version, active, active_at, seq)
        VALUES
            ('session-1', 'tag-1', 'alpha', 'machine-1', 1000, 1100, '{"path":"/alpha"}', 2, '{"ok":true}', 3, 1, 1200, 5),
            ('session-2', 'tag-2', 'beta', NULL, 2000, 2100, '{"path":"/beta"}', 1, NULL, 1, 0, NULL, 2);

        INSERT INTO machines (id, namespace, created_at, updated_at, metadata, metadata_version, runner_state, runner_state_version, active, active_at, seq)
        VALUES
            ('machine-1', 'alpha', 900, 1200, '{"host":"alpha"}', 2, '{"running":true}', 4, 1, 1200, 7);

        INSERT INTO messages (id, session_id, content, created_at, seq, local_id, invoked_at, scheduled_at)
        VALUES
            ('message-1', 'session-1', '{"role":"user"}', 1300, 1, 'local-1', 1300, NULL),
            ('message-2', 'session-2', '{"role":"assistant"}', 2300, 1, NULL, 2300, 2400);

        INSERT INTO users (platform, platform_user_id, namespace, created_at)
        VALUES ('legacy-platform', '42', 'alpha', 800);

        INSERT INTO push_subscriptions (namespace, endpoint, p256dh, auth, created_at)
        VALUES
            ('alpha', 'endpoint-1', 'key-old', 'auth-old', 100),
            ('beta', 'endpoint-1', 'key-new', 'auth-new', 200),
            ('alpha', 'endpoint-2', 'key-2', 'auth-2', 150);
    `)
    db.close()
}

function tableNames(db: Database): string[] {
    return db.query<{ name: string }, []>(`
        SELECT name
        FROM sqlite_master
        WHERE type = 'table'
          AND name NOT LIKE 'sqlite_%'
        ORDER BY name
    `).all().map((row) => row.name)
}

function columnNames(db: Database, table: string): string[] {
    return db.query<{ name: string }, []>(`PRAGMA table_info(${table})`).all().map((row) => row.name)
}

afterEach(() => {
    for (const dir of tempDirs) {
        rmSync(dir, { recursive: true, force: true })
    }
    tempDirs = []
})

describe('migrateNamespaceIsolation', () => {
    it('requires an explicit DB path', () => {
        expect(() => migrateNamespaceIsolation('')).toThrow('explicit SQLite DB path')
    })

    it('collapses a v9 namespace-shaped fixture into v10 runtime tables', () => {
        const dbPath = makeTempDbPath()
        createV9Fixture(dbPath)

        const result = migrateNamespaceIsolation(dbPath)

        expect(result).toEqual({
            sessions: 2,
            machines: 1,
            messages: 2,
            pushSubscriptions: 2
        })

        const db = new Database(dbPath, { strict: true })
        expect(db.query<{ user_version: number }, []>('PRAGMA user_version').get()?.user_version).toBe(10)
        expect(tableNames(db)).toEqual(['machines', 'messages', 'push_subscriptions', 'sessions'])
        expect(columnNames(db, 'sessions')).not.toContain('namespace')
        expect(columnNames(db, 'machines')).not.toContain('namespace')
        expect(columnNames(db, 'push_subscriptions')).not.toContain('namespace')

        expect(db.query<{ count: number }, []>('SELECT COUNT(*) AS count FROM sessions').get()?.count).toBe(2)
        expect(db.query<{ count: number }, []>('SELECT COUNT(*) AS count FROM machines').get()?.count).toBe(1)
        expect(db.query<{ count: number }, []>('SELECT COUNT(*) AS count FROM messages').get()?.count).toBe(2)
        expect(db.query<{ p256dh: string; auth: string }, []>(
            'SELECT p256dh, auth FROM push_subscriptions WHERE endpoint = "endpoint-1"'
        ).get()).toEqual({ p256dh: 'key-new', auth: 'auth-new' })
        expect(db.query<{ count: number }, []>('SELECT COUNT(*) AS count FROM push_subscriptions').get()?.count).toBe(2)
        db.close()
    })
})
