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
        config.applySessionConfig(session.id, { model: 'cursor-runtime-model-stored' })

        expect(repo.getSession(session.id)?.model).toBe('cursor-runtime-model-stored')
        expect(store.sessions.getSession(session.id)?.model).toBe('cursor-runtime-model-stored')
        const update = events.find((e) => e.type === 'session-updated')
        expect(update).toBeDefined()
        if (update && update.type === 'session-updated' && 'metadata' in update.data) {
            expect(update.data.id).toBe(session.id)
        }
    })

    it('applySessionConfig ignores unsupported effort fields when provided', () => {
        const events: SyncEvent[] = []
        const { store, repo, config } = createServices(events)
        const session = repo.getOrCreateSession('config-effort', sessionMetadata, null, {
            model: 'cursor-runtime-model-current',
            modelReasoningEffort: 'existing-reasoning',
            effort: 'existing-effort'
        })

        config.applySessionConfig(session.id, {
            model: 'cursor-runtime-model-next',
            modelReasoningEffort: 'medium',
            effort: 'background'
        })

        expect(repo.getSession(session.id)?.model).toBe('cursor-runtime-model-next')
        expect(repo.getSession(session.id)?.modelReasoningEffort).toBe('existing-reasoning')
        expect(repo.getSession(session.id)?.effort).toBe('existing-effort')
        expect(store.sessions.getSession(session.id)?.model).toBe('cursor-runtime-model-next')
        expect(store.sessions.getSession(session.id)?.modelReasoningEffort).toBe('existing-reasoning')
        expect(store.sessions.getSession(session.id)?.effort).toBe('existing-effort')
        expect(events.some((e) => e.type === 'session-updated')).toBe(true)
    })

    it('applySessionConfig does not emit for unsupported effort-only requests', () => {
        const events: SyncEvent[] = []
        const { store, repo, config } = createServices(events)
        const session = repo.getOrCreateSession('config-effort-only', sessionMetadata, null, {
            modelReasoningEffort: 'existing-reasoning',
            effort: 'existing-effort'
        })

        events.length = 0
        config.applySessionConfig(session.id, {
            modelReasoningEffort: 'medium',
            effort: 'background'
        })

        expect(repo.getSession(session.id)?.modelReasoningEffort).toBe('existing-reasoning')
        expect(repo.getSession(session.id)?.effort).toBe('existing-effort')
        expect(store.sessions.getSession(session.id)?.modelReasoningEffort).toBe('existing-reasoning')
        expect(store.sessions.getSession(session.id)?.effort).toBe('existing-effort')
        expect(events).toEqual([])
    })

    it('applySessionConfig does not emit when no config fields are provided', () => {
        const events: SyncEvent[] = []
        const { repo, config } = createServices(events)
        const session = repo.getOrCreateSession('config-empty', sessionMetadata, null)

        events.length = 0
        config.applySessionConfig(session.id, {})

        expect(events).toEqual([])
    })

    it('applySessionConfig accepts model=null to clear', () => {
        const events: SyncEvent[] = []
        const { store, repo, config } = createServices(events)
        const session = repo.getOrCreateSession('config-clear', sessionMetadata, null, { model: 'cursor-runtime-model-stored' })

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

    it('applySkillPolicy persists one key under metadata.skillPolicy and refreshes cache', async () => {
        const events: SyncEvent[] = []
        const { store, repo, config } = createServices(events)
        const session = repo.getOrCreateSession('skill-policy-1', sessionMetadata, null)

        events.length = 0
        await config.applySkillPolicy(session.id, { name: 'my-skill', state: 'disabled' })

        const stored = store.sessions.getSession(session.id)
        expect((stored?.metadata as { skillPolicy?: Record<string, string> } | null)?.skillPolicy).toEqual({
            'my-skill': 'disabled'
        })
        expect((repo.getSession(session.id)?.metadata as { skillPolicy?: Record<string, string> } | null)?.skillPolicy).toEqual({
            'my-skill': 'disabled'
        })
        expect(events.some((e) => e.type === 'session-updated')).toBe(true)
    })

    it('applySkillPolicyBatch replaces the entire skillPolicy map', async () => {
        const events: SyncEvent[] = []
        const { store, repo, config } = createServices(events)
        const session = repo.getOrCreateSession('skill-policy-batch', sessionMetadata, null)

        await config.applySkillPolicy(session.id, { name: 'old-skill', state: 'enabled' })
        await config.applySkillPolicyBatch(session.id, { 'other-skill': 'disabled' })

        const policy = (store.sessions.getSession(session.id)?.metadata as { skillPolicy?: Record<string, string> } | null)?.skillPolicy
        expect(policy).toEqual({ 'other-skill': 'disabled' })
        expect(repo.getSession(session.id)?.metadata?.skillPolicy).toEqual({ 'other-skill': 'disabled' })
        expect(events.some((e) => e.type === 'session-updated')).toBe(true)
    })

    it('resetSessionSkillPolicy removes skillPolicy from metadata', async () => {
        const { store, repo, config } = createServices([])
        const session = repo.getOrCreateSession('skill-policy-reset', sessionMetadata, null)

        await config.applySkillPolicy(session.id, { name: 'my-skill', state: 'disabled' })
        await config.resetSessionSkillPolicy(session.id)

        const metadata = store.sessions.getSession(session.id)?.metadata as Record<string, unknown> | null
        expect(metadata?.skillPolicy).toBeUndefined()
        expect(repo.getSession(session.id)?.metadata?.skillPolicy).toBeUndefined()
    })

    it('applySkillPolicy throws on version mismatch', async () => {
        const { store, repo, config } = createServices([])
        const session = repo.getOrCreateSession('skill-policy-conflict', sessionMetadata, null)
        const stored = store.sessions.getSession(session.id)
        if (!stored) {
            throw new Error('expected session in store')
        }

        store.sessions.updateSessionMetadata(
            session.id,
            { ...sessionMetadata, skillPolicy: { stale: 'enabled' } },
            stored.metadataVersion,
            { touchUpdatedAt: false }
        )

        const cached = repo.getSession(session.id)
        if (!cached) {
            throw new Error('expected cached session')
        }
        cached.metadataVersion = stored.metadataVersion

        await expect(
            config.applySkillPolicy(session.id, { name: 'my-skill', state: 'disabled' })
        ).rejects.toThrow('concurrently')
    })
})
