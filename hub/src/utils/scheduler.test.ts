import { describe, expect, it } from 'bun:test'
import { KeepaliveScheduler } from './scheduler'

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

describe('KeepaliveScheduler', () => {
    it('shutdown() cancels every registered handle and zeros activeCount', async () => {
        const scheduler = new KeepaliveScheduler()
        let aFires = 0
        let bFires = 0
        let cFires = 0

        scheduler.everyMs('a', 5, () => { aFires += 1 })
        scheduler.everyMs('b', 5, () => { bFires += 1 })
        scheduler.everyMs('c', 5, () => { cFires += 1 })

        expect(scheduler.activeCount).toBe(3)

        scheduler.shutdown()
        expect(scheduler.activeCount).toBe(0)

        const aBefore = aFires
        const bBefore = bFires
        const cBefore = cFires
        await sleep(30)
        expect(aFires).toBe(aBefore)
        expect(bFires).toBe(bBefore)
        expect(cFires).toBe(cBefore)
    })

    it('cancel() on an afterMs handle before its delay elapses prevents fn from firing', async () => {
        const scheduler = new KeepaliveScheduler()
        let fired = false
        const handle = scheduler.afterMs('once', 20, () => { fired = true })

        handle.cancel()
        await sleep(50)
        expect(fired).toBe(false)
        expect(scheduler.activeCount).toBe(0)
    })

    it('everyMs callback fires multiple times until cancel', async () => {
        const scheduler = new KeepaliveScheduler()
        let count = 0
        const handle = scheduler.everyMs('tick', 10, () => { count += 1 })

        await sleep(55)
        const fired = count
        expect(fired).toBeGreaterThanOrEqual(3)

        handle.cancel()
        await sleep(40)
        expect(count).toBe(fired)
        expect(scheduler.activeCount).toBe(0)
    })

    it('duplicate names are allowed and both handles remain independently cancellable', async () => {
        const scheduler = new KeepaliveScheduler()
        let aFires = 0
        let bFires = 0
        const h1 = scheduler.everyMs('dup', 10, () => { aFires += 1 })
        const h2 = scheduler.everyMs('dup', 10, () => { bFires += 1 })

        expect(scheduler.activeCount).toBe(2)

        await sleep(35)
        const aBaseline = aFires
        const bBaseline = bFires
        expect(aBaseline).toBeGreaterThanOrEqual(2)
        expect(bBaseline).toBeGreaterThanOrEqual(2)

        h1.cancel()
        expect(scheduler.activeCount).toBe(1)
        await sleep(35)
        expect(aFires).toBe(aBaseline)
        expect(bFires).toBeGreaterThan(bBaseline)

        h2.cancel()
        expect(scheduler.activeCount).toBe(0)
    })

    it('afterMs callback removes its handle from activeCount when it fires', async () => {
        const scheduler = new KeepaliveScheduler()
        let fired = false
        scheduler.afterMs('one-shot', 10, () => { fired = true })
        expect(scheduler.activeCount).toBe(1)
        await sleep(30)
        expect(fired).toBe(true)
        expect(scheduler.activeCount).toBe(0)
    })

    it('shutdown() is idempotent', () => {
        const scheduler = new KeepaliveScheduler()
        scheduler.everyMs('x', 1000, () => {})
        scheduler.shutdown()
        expect(() => scheduler.shutdown()).not.toThrow()
        expect(scheduler.activeCount).toBe(0)
    })
})
