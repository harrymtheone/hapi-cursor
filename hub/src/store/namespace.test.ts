import { describe, expect, it } from 'bun:test'
import { Store } from './index'

describe('Store owner-only facades', () => {
    it('creates and updates sessions without namespace arguments', () => {
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

    it('creates and updates machines without namespace arguments', () => {
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

    it('upserts, lists, and removes push subscriptions without namespace arguments', () => {
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
