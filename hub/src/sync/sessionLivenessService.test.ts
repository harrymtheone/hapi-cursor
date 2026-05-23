import { describe, expect, it } from 'bun:test'
import type { SyncEvent } from '@hapi/protocol/types'
import { Store } from '../store'
import type { EventPublisher } from './eventPublisher'
import { SessionLivenessService } from './sessionLivenessService'
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

function createServices(events: SyncEvent[]): { repo: SessionRepository; liveness: SessionLivenessService } {
    const publisher = createPublisher(events)
    const repo = new SessionRepository(new Store(':memory:'), publisher)
    const liveness = new SessionLivenessService(repo, publisher)
    return { repo, liveness }
}

describe('SessionLivenessService', () => {
    it('handleSessionAlive marks session active and emits session-updated with active=true', () => {
        const events: SyncEvent[] = []
        const { repo, liveness } = createServices(events)
        const session = repo.getOrCreateSession('alive-1', sessionMetadata, null)

        events.length = 0
        liveness.handleSessionAlive({ sid: session.id, time: Date.now(), thinking: false })

        const update = events.find((e) => e.type === 'session-updated')
        expect(update).toBeDefined()
        if (update && update.type === 'session-updated') {
            expect(update.data).toEqual(expect.objectContaining({ active: true }))
        }
        expect(repo.getSession(session.id)?.active).toBe(true)
    })

    it('handleSessionEnd sets active=false and emits patch with active/thinking false', () => {
        const events: SyncEvent[] = []
        const { repo, liveness } = createServices(events)
        const session = repo.getOrCreateSession('end-1', sessionMetadata, null)
        liveness.handleSessionAlive({ sid: session.id, time: Date.now(), thinking: true })

        events.length = 0
        liveness.handleSessionEnd({ sid: session.id, time: Date.now() })

        expect(repo.getSession(session.id)?.active).toBe(false)
        const update = events.find((e) => e.type === 'session-updated')
        expect(update).toBeDefined()
        if (update && update.type === 'session-updated') {
            expect(update.data).toEqual(expect.objectContaining({ active: false, thinking: false }))
        }
    })

    it('applyBackgroundTaskDelta emits exactly { backgroundTaskCount } and clamps at zero', () => {
        const events: SyncEvent[] = []
        const { repo, liveness } = createServices(events)
        const session = repo.getOrCreateSession('bg-1', sessionMetadata, null)

        events.length = 0
        liveness.applyBackgroundTaskDelta(session.id, { started: 2, completed: 0 })
        liveness.applyBackgroundTaskDelta(session.id, { started: 0, completed: 5 })

        const updates = events.filter((e) => e.type === 'session-updated')
        expect(updates.length).toBe(2)
        if (updates[0].type === 'session-updated') {
            expect(Object.keys(updates[0].data).sort()).toEqual(['backgroundTaskCount'])
            expect(updates[0].data.backgroundTaskCount).toBe(2)
        }
        if (updates[1].type === 'session-updated') {
            expect(updates[1].data.backgroundTaskCount).toBe(0)
        }
    })

    it('markMessageQueued is a no-op for inactive sessions', () => {
        const events: SyncEvent[] = []
        const { repo, liveness } = createServices(events)
        const session = repo.getOrCreateSession('queue-1', sessionMetadata, null)

        events.length = 0
        liveness.markMessageQueued(session.id, Date.now())

        expect(repo.getSession(session.id)?.thinking).toBe(false)
        expect(events.find((e) => e.type === 'session-updated')).toBeUndefined()
    })

    it('markMessageQueued sets thinking=true for active sessions and broadcasts', () => {
        const events: SyncEvent[] = []
        const { repo, liveness } = createServices(events)
        const session = repo.getOrCreateSession('queue-2', sessionMetadata, null)
        liveness.handleSessionAlive({ sid: session.id, time: Date.now(), thinking: false })

        events.length = 0
        liveness.markMessageQueued(session.id, Date.now())

        expect(repo.getSession(session.id)?.thinking).toBe(true)
        const update = events.find((e) => e.type === 'session-updated')
        expect(update).toBeDefined()
        if (update && update.type === 'session-updated') {
            expect(update.data).toEqual(expect.objectContaining({ thinking: true }))
        }
    })

    it('markMessageQueued clears stale completion marker when new work starts', () => {
        const events: SyncEvent[] = []
        const { repo, liveness } = createServices(events)
        const session = repo.getOrCreateSession('queue-clears-completed', sessionMetadata, null)
        liveness.handleSessionAlive({ sid: session.id, time: Date.now(), thinking: false })
        liveness.recordSessionActivity(session.id, session.updatedAt + 1_000, { kind: 'turn-completed' })

        events.length = 0
        liveness.markMessageQueued(session.id, session.updatedAt + 2_000)

        const update = events.find((e) => e.type === 'session-updated')
        expect(update).toBeDefined()
        if (update && update.type === 'session-updated') {
            expect(update.data).toEqual(expect.objectContaining({
                thinking: true,
                statusKind: 'thinking',
                completionMarker: null,
                errorMarker: null
            }))
        }
    })

    it('expireInactive flips overdue sessions to inactive and returns their ids', () => {
        const events: SyncEvent[] = []
        const { repo, liveness } = createServices(events)
        const session = repo.getOrCreateSession('expire-1', sessionMetadata, null)
        liveness.handleSessionAlive({ sid: session.id, time: Date.now() })
        const cached = repo.getSession(session.id)!
        cached.activeAt = Date.now() - 120_000

        const expired = liveness.expireInactive(Date.now())
        expect(expired).toContain(session.id)
        expect(repo.getSession(session.id)?.active).toBe(false)
    })

    it('recordSessionActivity updates session.updatedAt and emits a patch', () => {
        const events: SyncEvent[] = []
        const { repo, liveness } = createServices(events)
        const session = repo.getOrCreateSession('activity-1', sessionMetadata, null)
        const future = session.updatedAt + 10_000

        events.length = 0
        liveness.recordSessionActivity(session.id, future)

        expect(repo.getSession(session.id)?.updatedAt).toBeGreaterThanOrEqual(future)
        const update = events.find((e) => e.type === 'session-updated')
        expect(update).toBeDefined()
    })

    it('recordSessionActivity emits completion marker patch for ready turn completion', () => {
        const events: SyncEvent[] = []
        const { repo, liveness } = createServices(events)
        const session = repo.getOrCreateSession('activity-ready-1', sessionMetadata, null)
        liveness.handleSessionAlive({ sid: session.id, time: Date.now(), thinking: true })
        const future = session.updatedAt + 10_000

        events.length = 0
        liveness.recordSessionActivity(session.id, future, { kind: 'turn-completed' })

        const update = events.find((e) => e.type === 'session-updated')
        expect(update).toBeDefined()
        if (update && update.type === 'session-updated') {
            expect(update.data).toEqual(expect.objectContaining({
                updatedAt: future,
                thinking: false,
                statusKind: 'completed',
                completionMarker: future,
                errorMarker: null
            }))
        }
    })
})
