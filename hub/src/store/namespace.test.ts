import { describe, expect, it } from 'bun:test'
import { Database } from 'bun:sqlite'
import { Store } from './index'

function getTableNames(db: Database): string[] {
    return db.query<{ name: string }, []>(`
        SELECT name
        FROM sqlite_master
        WHERE type = 'table'
          AND name NOT LIKE 'sqlite_%'
        ORDER BY name
    `).all().map((row) => row.name)
}

function getColumnNames(db: Database, table: string): string[] {
    return db.query<{ name: string }, []>(`PRAGMA table_info(${table})`).all().map((row) => row.name)
}

function getIndexSql(db: Database, table: string): string[] {
    return db.query<{ sql: string | null }, [string]>(`
        SELECT sql
        FROM sqlite_master
        WHERE type = 'index'
          AND tbl_name = ?
          AND sql IS NOT NULL
        ORDER BY name
    `).all(table).map((row) => row.sql ?? '')
}

function getTableSql(db: Database, table: string): string {
    return db.query<{ sql: string }, [string]>(`
        SELECT sql
        FROM sqlite_master
        WHERE type = 'table'
          AND name = ?
    `).get(table)?.sql ?? ''
}

describe('Store owner-only schema', () => {
    const removedScopeColumn = ['name', 'space'].join('')

    it('creates schema version 11 without users or scoped columns', () => {
        const store = new Store(':memory:')
        const rawDb = (store as unknown as { db: Database }).db

        expect(rawDb.query<{ user_version: number }, []>('PRAGMA user_version').get()?.user_version).toBe(11)
        expect(getTableNames(rawDb)).toEqual(['machines', 'messages', 'push_subscriptions', 'sessions'])
        expect(getColumnNames(rawDb, 'sessions')).not.toContain(removedScopeColumn)
        expect(getColumnNames(rawDb, 'machines')).not.toContain(removedScopeColumn)
        expect(getColumnNames(rawDb, 'push_subscriptions')).not.toContain(removedScopeColumn)
        expect(getIndexSql(rawDb, 'sessions').join('\n')).not.toContain(removedScopeColumn)
        expect(getIndexSql(rawDb, 'machines').join('\n')).not.toContain(removedScopeColumn)
        expect(getTableSql(rawDb, 'push_subscriptions')).toContain('UNIQUE(endpoint)')
        store.close()
    })

    it('creates and updates sessions without scoped arguments', () => {
        const store = new Store(':memory:')
        const session = store.sessions.getOrCreateSession('tag', { path: '/alpha' }, null)

        const metadata = store.sessions.updateSessionMetadata(session.id, { path: '/beta' }, 1)
        const agentState = store.sessions.updateSessionAgentState(session.id, { status: 'running' }, 1)
        const loaded = store.sessions.getSession(session.id)

        expect(metadata).toEqual({ result: 'success', version: 2, value: { path: '/beta' } })
        expect(agentState).toEqual({ result: 'success', version: 2, value: { status: 'running' } })
        expect(loaded?.metadata).toEqual({ path: '/beta' })
        expect(loaded?.agentState).toEqual({ status: 'running' })
    })

    it('creates and updates machines without scoped arguments', () => {
        const store = new Store(':memory:')
        const machine = store.machines.getOrCreateMachine('machine-1', { host: 'alpha' }, null)

        const metadata = store.machines.updateMachineMetadata(machine.id, { host: 'beta' }, 1)
        const runnerState = store.machines.updateMachineRunnerState(machine.id, { online: true }, 1)
        const loaded = store.machines.getMachine(machine.id)

        expect(metadata).toEqual({ result: 'success', version: 2, value: { host: 'beta' } })
        expect(runnerState).toEqual({ result: 'success', version: 2, value: { online: true } })
        expect(loaded?.metadata).toEqual({ host: 'beta' })
        expect(loaded?.runnerState).toEqual({ online: true })
    })

    it('upserts, lists, and removes push subscriptions without scoped arguments', () => {
        const store = new Store(':memory:')

        store.push.upsertPushSubscription({ endpoint: 'endpoint-1', p256dh: 'key-1', auth: 'auth-1' })
        store.push.upsertPushSubscription({ endpoint: 'endpoint-1', p256dh: 'key-2', auth: 'auth-2' })

        const subscriptions = store.push.getPushSubscriptions()
        expect(subscriptions).toHaveLength(1)
        expect(subscriptions[0]).toMatchObject({
            endpoint: 'endpoint-1',
            p256dh: 'key-2',
            auth: 'auth-2'
        })

        store.push.removePushSubscription('endpoint-1')
        expect(store.push.getPushSubscriptions()).toEqual([])
    })
})
