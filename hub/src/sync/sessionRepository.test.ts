import { describe, expect, it } from 'bun:test'
import type { SyncEvent } from '@hapi/protocol/types'
import { Store } from '../store'
import type { EventPublisher } from './eventPublisher'
import { SessionRepository } from './sessionRepository'

function createPublisher(events: SyncEvent[]): EventPublisher {
    return {
        emit: (event: SyncEvent) => {
            events.push(event)
        }
    } as unknown as EventPublisher
}

const sessionMetadata = {
    path: '/tmp/project',
    host: 'localhost'
}

describe('SessionRepository', () => {
    it('getOrCreateSession persists a session and refreshSession returns it', () => {
        const store = new Store(':memory:')
        const events: SyncEvent[] = []
        const repo = new SessionRepository(store, createPublisher(events))

        const session = repo.getOrCreateSession('tag-1', sessionMetadata, null)
        expect(session.id).toBeDefined()
        expect(repo.getSession(session.id)?.id).toBe(session.id)
        expect(events.some((e) => e.type === 'session-added')).toBe(true)
    })

    it('resolveSessionAccess returns not-found for unknown id', () => {
        const repo = new SessionRepository(new Store(':memory:'), createPublisher([]))

        const result = repo.resolveSessionAccess('does-not-exist')
        expect(result).toEqual({ ok: false, reason: 'not-found' })
    })

    it('resolveSessionAccess refreshes from store when in-memory map missing the session', () => {
        const store = new Store(':memory:')
        const events: SyncEvent[] = []
        const repo = new SessionRepository(store, createPublisher(events))

        const created = repo.getOrCreateSession('tag-resolve', sessionMetadata, null)
        repo.sessions.delete(created.id)

        const result = repo.resolveSessionAccess(created.id)
        expect(result.ok).toBe(true)
    })

    it('refreshSession returns null and emits session-removed when store no longer has it', () => {
        const store = new Store(':memory:')
        const events: SyncEvent[] = []
        const repo = new SessionRepository(store, createPublisher(events))

        const session = repo.getOrCreateSession('tag-del', sessionMetadata, null)
        store.sessions.deleteSession(session.id)

        events.length = 0
        const refreshed = repo.refreshSession(session.id)
        expect(refreshed).toBeNull()
        expect(events.find((e) => e.type === 'session-removed')).toBeDefined()
    })

    it('getActiveSessions filters by active flag', () => {
        const repo = new SessionRepository(new Store(':memory:'), createPublisher([]))

        const inactive = repo.getOrCreateSession('inactive', sessionMetadata, null)
        const active = repo.getOrCreateSession('active', sessionMetadata, null)
        active.active = true

        const ids = repo.getActiveSessions().map((s) => s.id)
        expect(ids).toContain(active.id)
        expect(ids).not.toContain(inactive.id)
    })

    it('reloadAll loads all stored sessions into the in-memory map', () => {
        const store = new Store(':memory:')
        const events: SyncEvent[] = []
        const repo = new SessionRepository(store, createPublisher(events))

        repo.getOrCreateSession('a', sessionMetadata, null)
        repo.getOrCreateSession('b', sessionMetadata, null)
        repo.sessions.clear()

        repo.reloadAll()
        expect(repo.getSessions().length).toBe(2)
    })
})
