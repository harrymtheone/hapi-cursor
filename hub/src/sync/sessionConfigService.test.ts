import { describe, expect, it } from 'bun:test'
import type { SyncEvent } from '@hapi/protocol/types'
import { Store } from '../store'
import type { EventPublisher } from './eventPublisher'
import { SessionConfigService } from './sessionConfigService'
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

function createServices(events: SyncEvent[]): { store: Store; repo: SessionRepository; config: SessionConfigService } {
    const store = new Store(':memory:')
    const publisher = createPublisher(events)
    const repo = new SessionRepository(store, publisher)
    const config = new SessionConfigService(repo, publisher)
    return { store, repo, config }
}

describe('SessionConfigService', () => {
    it('applySessionConfig persists model + emits full Session payload', () => {
        const events: SyncEvent[] = []
        const { store, repo, config } = createServices(events)
        const session = repo.getOrCreateSession('config-1', sessionMetadata, null)

        events.length = 0
        config.applySessionConfig(session.id, { model: 'gpt-5.5' })

        expect(repo.getSession(session.id)?.model).toBe('gpt-5.5')
        expect(store.sessions.getSession(session.id)?.model).toBe('gpt-5.5')
        const update = events.find((e) => e.type === 'session-updated')
        expect(update).toBeDefined()
        if (update && update.type === 'session-updated' && 'metadata' in update.data) {
            expect(update.data.id).toBe(session.id)
        }
    })

    it('applySessionConfig accepts model=null to clear', () => {
        const events: SyncEvent[] = []
        const { store, repo, config } = createServices(events)
        const session = repo.getOrCreateSession('config-clear', sessionMetadata, null, { model: 'gpt-5.4' })

        config.applySessionConfig(session.id, { model: null })

        expect(repo.getSession(session.id)?.model).toBeNull()
        expect(store.sessions.getSession(session.id)?.model).toBeNull()
    })

    it('applySessionConfig updates permissionMode in memory only (no store write)', () => {
        const events: SyncEvent[] = []
        const { repo, config } = createServices(events)
        const session = repo.getOrCreateSession('config-perm', sessionMetadata, null)

        config.applySessionConfig(session.id, { permissionMode: 'plan' })

        expect(repo.getSession(session.id)?.permissionMode).toBe('plan')
    })

    it('renameSession updates store metadata and refreshes the cached session', async () => {
        const events: SyncEvent[] = []
        const { store, repo, config } = createServices(events)
        const session = repo.getOrCreateSession('rename-1', sessionMetadata, null)

        await config.renameSession(session.id, 'My Renamed Session')

        const stored = store.sessions.getSession(session.id)
        expect((stored?.metadata as { name?: string } | null)?.name).toBe('My Renamed Session')
        expect((repo.getSession(session.id)?.metadata as { name?: string } | null)?.name).toBe('My Renamed Session')
    })

    it('renameSession throws for unknown session', async () => {
        const { config } = createServices([])

        await expect(config.renameSession('missing', 'foo')).rejects.toThrow('Session not found')
    })

    it('deleteSession removes session from store + cache and emits session-removed', async () => {
        const events: SyncEvent[] = []
        const { store, repo, config } = createServices(events)
        const session = repo.getOrCreateSession('delete-1', sessionMetadata, null)

        events.length = 0
        await config.deleteSession(session.id)

        expect(repo.getSession(session.id)).toBeUndefined()
        expect(store.sessions.getSession(session.id) ?? null).toBeNull()
        expect(events.find((e) => e.type === 'session-removed')).toBeDefined()
    })

    it('deleteSession refuses to delete an active session', async () => {
        const { repo, config } = createServices([])
        const session = repo.getOrCreateSession('delete-active', sessionMetadata, null)
        session.active = true

        await expect(config.deleteSession(session.id)).rejects.toThrow('Cannot delete active session')
    })
})
