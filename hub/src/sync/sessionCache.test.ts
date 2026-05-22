import { describe, expect, it } from 'bun:test'
import { SyncEventSchema } from '@hapi/protocol/schemas'
import type { SyncEvent } from '@hapi/protocol/types'
import { Store } from '../store'
import type { EventPublisher } from './eventPublisher'
import { MachineCache } from './machineCache'
import { SessionCache } from './sessionCache'

function createPublisher(events: SyncEvent[]): EventPublisher {
    return {
        emit: (event: SyncEvent) => {
            events.push(event)
        }
    } as unknown as EventPublisher
}

function expectSyncEventConformance(events: SyncEvent[]): void {
    for (const event of events) {
        const result = SyncEventSchema.safeParse(event)
        if (!result.success) {
            throw new Error(`emit violates SyncEventSchema: ${JSON.stringify(event)} - ${result.error.message}`)
        }
        expect(result.success).toBe(true)
    }
}

function createSessionCache(events: SyncEvent[]): SessionCache {
    return new SessionCache(new Store(':memory:'), createPublisher(events))
}

function createMachineCache(events: SyncEvent[]): MachineCache {
    return new MachineCache(new Store(':memory:'), createPublisher(events))
}

function createMachineCacheWithStore(events: SyncEvent[]): { store: Store; cache: MachineCache } {
    const store = new Store(':memory:')
    return { store, cache: new MachineCache(store, createPublisher(events)) }
}

function deleteStoredMachine(store: Store, machineId: string): void {
    const handle = store as unknown as {
        db: {
            prepare(sql: string): { run(id: string): void }
        }
    }
    handle.db.prepare('DELETE FROM machines WHERE id = ?').run(machineId)
}

const sessionMetadata = {
    path: '/tmp/project',
    host: 'localhost',
    machineId: 'machine-1'
}

const machineMetadata = {
    host: 'localhost',
    platform: 'linux',
    happyCliVersion: '0.1.0',
    homeDir: '/home/tester',
    happyHomeDir: '/home/tester/.happy',
    happyLibDir: '/home/tester/.happy/lib',
    workspaceRoot: '/tmp/project'
}

describe('publisher.emit contract - SyncEventSchema conformance', () => {
    describe('SessionCache', () => {
        it('emits schema-conformant events for representative session transitions', async () => {
            const events: SyncEvent[] = []
            const cache = createSessionCache(events)
            const baseTime = Date.now() - 120_000

            const session = cache.getOrCreateSession(
                'contract-session',
                sessionMetadata,
                { requests: {}, completedRequests: {} }
            )
            cache.handleSessionAlive({
                sid: session.id,
                time: baseTime,
                thinking: true,
                permissionMode: 'plan',
                model: 'cursor-model',
                modelReasoningEffort: 'medium',
                effort: 'high'
            })
            cache.markMessageQueued(session.id, baseTime + 1_000)
            cache.applyBackgroundTaskDelta(session.id, { started: 2, completed: 0 })
            cache.applyBackgroundTaskDelta(session.id, { started: 0, completed: 1 })
            cache.recordSessionActivity(session.id, baseTime + 2_000)
            cache.applySessionConfig(session.id, {
                permissionMode: 'ask',
                model: 'cursor-model-2',
                modelReasoningEffort: 'high',
                effort: 'medium'
            })
            cache.handleSessionEnd({ sid: session.id, time: baseTime + 3_000 })
            await cache.deleteSession(session.id)

            const inactive = cache.getOrCreateSession(
                'contract-expire',
                { ...sessionMetadata, machineId: 'machine-2' },
                null
            )
            cache.handleSessionAlive({ sid: inactive.id, time: baseTime + 4_000, thinking: false })
            cache.expireInactive(baseTime + 40_000)

            const oldSession = cache.getOrCreateSession(
                'contract-merge-old',
                { ...sessionMetadata, path: '/tmp/old' },
                { requests: {}, completedRequests: {} }
            )
            const newSession = cache.getOrCreateSession(
                'contract-merge-new',
                { ...sessionMetadata, path: '/tmp/new' },
                { requests: {}, completedRequests: {} }
            )
            await cache.mergeSessionHistory(oldSession.id, newSession.id)
            await cache.mergeSessions(oldSession.id, newSession.id)

            expectSyncEventConformance(events)
            expect(events.length).toBeGreaterThanOrEqual(8)
        })

        it('applyBackgroundTaskDelta emits a session-updated patch with exactly { backgroundTaskCount } data field', () => {
            const events: SyncEvent[] = []
            const cache = createSessionCache(events)
            const session = cache.getOrCreateSession('background-task-session', sessionMetadata, null)

            events.length = 0
            cache.applyBackgroundTaskDelta(session.id, { started: 1, completed: 0 })

            const update = events.find((event) => event.type === 'session-updated')
            expect(update).toBeDefined()
            if (!update || update.type !== 'session-updated') return

            const result = SyncEventSchema.safeParse(update)
            if (!result.success) {
                throw new Error(`emit violates SyncEventSchema: ${JSON.stringify(update)} - ${result.error.message}`)
            }
            expect(Object.keys(update.data).sort()).toEqual(['backgroundTaskCount'])
            expect(update.data.backgroundTaskCount).toEqual(expect.any(Number))
            expect(Number.isFinite(update.data.backgroundTaskCount)).toBe(true)
        })

        it('applySessionConfig emits session-updated with full Session payload', () => {
            const events: SyncEvent[] = []
            const cache = createSessionCache(events)
            const session = cache.getOrCreateSession('config-session', sessionMetadata, null)

            events.length = 0
            cache.applySessionConfig(session.id, {
                permissionMode: 'plan',
                model: 'cursor-model',
                modelReasoningEffort: 'medium',
                effort: 'high'
            })

            const update = events.find((event) => event.type === 'session-updated')
            expect(update).toBeDefined()
            if (!update || update.type !== 'session-updated') return

            const result = SyncEventSchema.safeParse(update)
            if (!result.success) {
                throw new Error(`emit violates SyncEventSchema: ${JSON.stringify(update)} - ${result.error.message}`)
            }
            expect('metadata' in update.data).toBe(true)
            expect(update.data.id).toBe(session.id)
        })
    })

    describe('MachineCache', () => {
        it('emits schema-conformant events for representative machine transitions', () => {
            const events: SyncEvent[] = []
            const { store, cache } = createMachineCacheWithStore(events)
            const baseTime = Date.now()

            const machine = cache.getOrCreateMachine('contract-machine', machineMetadata, {
                status: 'running',
                pid: 1234,
                startedAt: baseTime
            })
            cache.refreshMachine(machine.id)
            cache.handleMachineAlive({ machineId: machine.id, time: baseTime + 1_000 })
            cache.handleMachineAlive({ machineId: machine.id, time: baseTime + 12_000 })
            cache.expireInactive(baseTime + 60_000)
            deleteStoredMachine(store, machine.id)
            cache.refreshMachine(machine.id)

            expectSyncEventConformance(events)
            expect(events.length).toBeGreaterThanOrEqual(4)
        })

        it('refreshMachine on non-existent machineId emits machine-updated with data:null', () => {
            const events: SyncEvent[] = []
            const { store, cache } = createMachineCacheWithStore(events)
            const machine = cache.getOrCreateMachine('deleted-machine', machineMetadata, null)

            events.length = 0
            deleteStoredMachine(store, machine.id)
            cache.refreshMachine(machine.id)

            const nullUpdate = events.find((event) => {
                return event.type === 'machine-updated' && event.data === null
            })
            expect(nullUpdate).toBeDefined()
            if (!nullUpdate) return

            const result = SyncEventSchema.safeParse(nullUpdate)
            if (!result.success) {
                throw new Error(`emit violates SyncEventSchema: ${JSON.stringify(nullUpdate)} - ${result.error.message}`)
            }
        })

        it('expireInactive emits machine-updated with data:{ active: false }', () => {
            const events: SyncEvent[] = []
            const cache = createMachineCache(events)
            const baseTime = Date.now()
            const machine = cache.getOrCreateMachine('inactive-machine', machineMetadata, null)

            cache.handleMachineAlive({ machineId: machine.id, time: baseTime })
            events.length = 0
            cache.expireInactive(baseTime + 60_000)

            const inactiveUpdate = events.find((event) => {
                return event.type === 'machine-updated'
                    && event.data !== null
                    && !('id' in event.data)
            })
            expect(inactiveUpdate).toBeDefined()
            if (!inactiveUpdate || inactiveUpdate.type !== 'machine-updated' || inactiveUpdate.data === null) return

            const result = SyncEventSchema.safeParse(inactiveUpdate)
            if (!result.success) {
                throw new Error(`emit violates SyncEventSchema: ${JSON.stringify(inactiveUpdate)} - ${result.error.message}`)
            }
            expect(inactiveUpdate.data).toEqual({ active: false })
        })
    })
})
