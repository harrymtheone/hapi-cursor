import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import type { ToolCallProjection } from '@hapi/protocol/types'

import { Store } from './index'
import { getBySessionAndCallIds, upsertToolCall } from './toolCalls'

const VALID_PROJECTION: ToolCallProjection = {
    callId: 'call-1',
    name: 'Bash',
    input: { command: 'ls' },
    status: 'completed',
    result: 'file1 file2',
    startedAt: 1000,
    completedAt: 1500
}

let store: Store
let sessionId: string
let tmpDir: string = ''

beforeEach(() => {
    store = new Store(':memory:')
    const session = store.sessions.getOrCreateSession('test-tag', { path: '/tmp/project' }, null)
    sessionId = session.id
    tmpDir = ''
})

afterEach(() => {
    store.close()
    if (tmpDir) {
        rmSync(tmpDir, { recursive: true, force: true })
        tmpDir = ''
    }
})

describe('upsertToolCall / getBySessionAndCallIds', () => {
    it('upsert then get returns the stored projection', () => {
        const db = (store as unknown as { db: import('bun:sqlite').Database }).db
        upsertToolCall(db, sessionId, 'call-1', VALID_PROJECTION)
        const result = getBySessionAndCallIds(db, sessionId, ['call-1'])
        expect(result['call-1']).toMatchObject({ callId: 'call-1', name: 'Bash', status: 'completed' })
    })

    it('upsert replaces previous projection for same key', () => {
        const db = (store as unknown as { db: import('bun:sqlite').Database }).db
        upsertToolCall(db, sessionId, 'call-1', VALID_PROJECTION)
        const updated: ToolCallProjection = { ...VALID_PROJECTION, name: 'Read', status: 'failed' }
        upsertToolCall(db, sessionId, 'call-1', updated)
        const result = getBySessionAndCallIds(db, sessionId, ['call-1'])
        expect(result['call-1']?.name).toBe('Read')
        expect(result['call-1']?.status).toBe('failed')
    })

    it('getBySessionAndCallIds returns only requested callIds', () => {
        const db = (store as unknown as { db: import('bun:sqlite').Database }).db
        upsertToolCall(db, sessionId, 'call-1', VALID_PROJECTION)
        upsertToolCall(db, sessionId, 'call-2', { ...VALID_PROJECTION, callId: 'call-2', name: 'Read' })
        const result = getBySessionAndCallIds(db, sessionId, ['call-1'])
        expect(Object.keys(result)).toHaveLength(1)
        expect(result['call-2']).toBeUndefined()
    })

    it('returns empty record when no matching callIds', () => {
        const db = (store as unknown as { db: import('bun:sqlite').Database }).db
        const result = getBySessionAndCallIds(db, sessionId, ['call-nonexistent'])
        expect(result).toEqual({})
    })

    it('returns empty record for empty callIds array', () => {
        const db = (store as unknown as { db: import('bun:sqlite').Database }).db
        upsertToolCall(db, sessionId, 'call-1', VALID_PROJECTION)
        const result = getBySessionAndCallIds(db, sessionId, [])
        expect(result).toEqual({})
    })

    it('skips rows with corrupt projection JSON without throwing', () => {
        const db = (store as unknown as { db: import('bun:sqlite').Database }).db
        db.prepare(
            'INSERT INTO tool_calls (session_id, call_id, projection, updated_at) VALUES (?, ?, ?, ?)'
        ).run(sessionId, 'call-corrupt', 'NOT VALID JSON{{{', Date.now())
        const result = getBySessionAndCallIds(db, sessionId, ['call-corrupt'])
        expect(result['call-corrupt']).toBeUndefined()
    })

    it('skips rows that fail ToolCallProjectionSchema validation', () => {
        const db = (store as unknown as { db: import('bun:sqlite').Database }).db
        // callId: '' violates z.string().min(1)
        db.prepare(
            'INSERT INTO tool_calls (session_id, call_id, projection, updated_at) VALUES (?, ?, ?, ?)'
        ).run(sessionId, 'call-bad', JSON.stringify({ callId: '', name: 'ok', status: 'completed', startedAt: 1 }), Date.now())
        const result = getBySessionAndCallIds(db, sessionId, ['call-bad'])
        expect(result['call-bad']).toBeUndefined()
    })

    it('rejects projection JSON over 65536 bytes at upsert without writing row', () => {
        const db = (store as unknown as { db: import('bun:sqlite').Database }).db
        const largeProjection: ToolCallProjection = { ...VALID_PROJECTION, input: 'x'.repeat(65537) }
        expect(() => upsertToolCall(db, sessionId, 'call-1', largeProjection)).toThrow()
        const result = getBySessionAndCallIds(db, sessionId, ['call-1'])
        expect(result['call-1']).toBeUndefined()
    })

    it('retains rows after store reopen (durability)', () => {
        tmpDir = mkdtempSync(join(tmpdir(), 'hapi-toolcalls-test-'))
        const dbPath = join(tmpDir, 'test.db')
        const s1 = new Store(dbPath)
        const s1Session = s1.sessions.getOrCreateSession('test-tag', { path: '/tmp/project' }, null)
        const db1 = (s1 as unknown as { db: import('bun:sqlite').Database }).db
        upsertToolCall(db1, s1Session.id, 'call-1', VALID_PROJECTION)
        s1.close()

        const s2 = new Store(dbPath)
        const db2 = (s2 as unknown as { db: import('bun:sqlite').Database }).db
        const result = getBySessionAndCallIds(db2, s1Session.id, ['call-1'])
        s2.close()

        expect(result['call-1']).toMatchObject({ callId: 'call-1', name: 'Bash' })
    })

    it('cascade deletes tool_calls when session is deleted', () => {
        const db = (store as unknown as { db: import('bun:sqlite').Database }).db
        upsertToolCall(db, sessionId, 'call-1', VALID_PROJECTION)
        db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId)
        const result = getBySessionAndCallIds(db, sessionId, ['call-1'])
        expect(result['call-1']).toBeUndefined()
    })
})

describe('Store.toolCalls facade', () => {
    it('Store exposes a toolCalls property', () => {
        expect(store.toolCalls).toBeDefined()
    })

    it('Store.toolCalls.upsert and getBySessionAndCallIds work end-to-end', () => {
        store.toolCalls.upsert(sessionId, 'call-1', VALID_PROJECTION)
        const result = store.toolCalls.getBySessionAndCallIds(sessionId, ['call-1'])
        expect(result['call-1']).toMatchObject({ callId: 'call-1', name: 'Bash', status: 'completed' })
    })
})
