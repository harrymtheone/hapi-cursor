import { describe, expect, it } from 'bun:test'
import type { SyncEvent } from '@hapi/protocol/types'
import { Store } from '../store'
import type { EventPublisher } from './eventPublisher'
import { SessionMergeService } from './sessionMergeService'
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

function createServices(events: SyncEvent[]): { store: Store; repo: SessionRepository; merge: SessionMergeService } {
    const store = new Store(':memory:')
    const publisher = createPublisher(events)
    const repo = new SessionRepository(store, publisher)
    const merge = new SessionMergeService(repo, publisher)
    return { store, repo, merge }
}

describe('SessionMergeService', () => {
    it('mergeSessions deletes old session and emits session-removed', async () => {
        const events: SyncEvent[] = []
        const { repo, merge } = createServices(events)
        const oldSession = repo.getOrCreateSession('merge-old', { ...sessionMetadata, path: '/tmp/old' }, null)
        const newSession = repo.getOrCreateSession('merge-new', { ...sessionMetadata, path: '/tmp/new' }, null)

        await merge.mergeSessions(oldSession.id, newSession.id)

        expect(repo.getSession(oldSession.id)).toBeUndefined()
        expect(repo.getSession(newSession.id)).toBeDefined()
        expect(events.find((e) => e.type === 'session-removed' && e.sessionId === oldSession.id)).toBeDefined()
    })

    it('mergeSessionHistory preserves both sessions (does not delete the old session)', async () => {
        const events: SyncEvent[] = []
        const { repo, merge } = createServices(events)
        const oldSession = repo.getOrCreateSession('history-old', { ...sessionMetadata, path: '/tmp/old' }, null)
        const newSession = repo.getOrCreateSession('history-new', { ...sessionMetadata, path: '/tmp/new' }, null)

        events.length = 0
        await merge.mergeSessionHistory(oldSession.id, newSession.id)

        expect(repo.getSession(oldSession.id)).toBeDefined()
        expect(repo.getSession(newSession.id)).toBeDefined()
        expect(events.find((e) => e.type === 'session-removed' && e.sessionId === oldSession.id)).toBeUndefined()
    })

    it('mergeSessions preserves model from old session when new session has none', async () => {
        const events: SyncEvent[] = []
        const { repo, merge } = createServices(events)
        const oldSession = repo.getOrCreateSession('merge-model-old', sessionMetadata, null, { model: 'gpt-5.4' })
        const newSession = repo.getOrCreateSession('merge-model-new', sessionMetadata, null)

        await merge.mergeSessions(oldSession.id, newSession.id)

        expect(repo.getSession(newSession.id)?.model).toBe('gpt-5.4')
    })

    it('mergeSessions is a no-op when oldSessionId === newSessionId', async () => {
        const events: SyncEvent[] = []
        const { repo, merge } = createServices(events)
        const session = repo.getOrCreateSession('same', sessionMetadata, null)

        events.length = 0
        await merge.mergeSessions(session.id, session.id)

        expect(repo.getSession(session.id)).toBeDefined()
        expect(events.filter((e) => e.type === 'session-removed').length).toBe(0)
    })

    it('mergeSessions throws when either session is missing in the store', async () => {
        const { merge } = createServices([])

        await expect(merge.mergeSessions('missing-old', 'missing-new')).rejects.toThrow('Session not found for merge')
    })

    it('deduplicateByAgentSessionId merges duplicates sharing cursorSessionId', async () => {
        const events: SyncEvent[] = []
        const { repo, merge } = createServices(events)
        const oldSession = repo.getOrCreateSession(
            'dedup-old',
            { ...sessionMetadata, cursorSessionId: 'cursor-abc' },
            null
        )
        const newSession = repo.getOrCreateSession(
            'dedup-new',
            { ...sessionMetadata, cursorSessionId: 'cursor-abc' },
            null
        )

        await merge.deduplicateByAgentSessionId(newSession.id)

        const survivors = repo.getSessions().filter((s) => s.id === oldSession.id || s.id === newSession.id)
        expect(survivors.length).toBe(1)
    })

    it('deduplicateByAgentSessionId is a no-op when session has no cursorSessionId', async () => {
        const events: SyncEvent[] = []
        const { repo, merge } = createServices(events)
        const session = repo.getOrCreateSession('no-agent-id', sessionMetadata, null)

        events.length = 0
        await merge.deduplicateByAgentSessionId(session.id)

        expect(repo.getSession(session.id)).toBeDefined()
        expect(events.filter((e) => e.type === 'session-removed').length).toBe(0)
    })

    it('mergeSessionHistory unions skillPolicy with incoming precedence', async () => {
        const { store, repo, merge } = createServices([])
        const oldSession = repo.getOrCreateSession(
            'resume-old',
            {
                ...sessionMetadata,
                skillPolicy: { 'kept-skill': 'enabled', 'overridden-skill': 'enabled' }
            },
            null
        )
        const newSession = repo.getOrCreateSession(
            'resume-new',
            {
                ...sessionMetadata,
                skillPolicy: { 'overridden-skill': 'disabled', 'incoming-skill': 'disabled' }
            },
            null
        )

        await merge.mergeSessionHistory(oldSession.id, newSession.id)

        const policy = (store.sessions.getSession(newSession.id)?.metadata as {
            skillPolicy?: Record<string, string>
        } | null)?.skillPolicy
        expect(policy).toEqual({
            'kept-skill': 'enabled',
            'overridden-skill': 'disabled',
            'incoming-skill': 'disabled'
        })
    })

    it('resume handoff retains disabled skill after merge', async () => {
        const { store, repo, merge } = createServices([])
        const prior = repo.getOrCreateSession(
            'resume-prior',
            {
                ...sessionMetadata,
                cursorSessionId: 'cursor-resume-policy',
                skillPolicy: { 'blocked-skill': 'disabled' }
            },
            null
        )
        const resumed = repo.getOrCreateSession(
            'resume-next',
            {
                ...sessionMetadata,
                cursorSessionId: 'cursor-resume-policy'
            },
            null
        )

        await merge.mergeSessionHistory(prior.id, resumed.id)

        const policy = (store.sessions.getSession(resumed.id)?.metadata as {
            skillPolicy?: Record<string, string>
        } | null)?.skillPolicy
        expect(policy?.['blocked-skill']).toBe('disabled')
    })
})
