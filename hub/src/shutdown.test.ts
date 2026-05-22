/**
 * Shutdown handler unit test (D-141).
 *
 * Asserts that the SIGINT / SIGTERM closure built by `createShutdownHandler`
 * cancels the scheduler BEFORE the per-subsystem stops, and stubs
 * `process.exit` so the test does not actually terminate.
 *
 * Per D-141 process-level mocking (`process.emit('SIGINT')`) is unreliable
 * across runtimes, so the test invokes the returned closure directly.
 */
import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'
import { createShutdownHandler } from './index'

describe('createShutdownHandler', () => {
    const originalExit = process.exit
    let exitCalls: Array<number | undefined> = []

    beforeEach(() => {
        exitCalls = []
        process.exit = ((code?: number) => {
            exitCalls.push(code)
            return undefined as never
        }) as typeof process.exit
    })

    afterEach(() => {
        process.exit = originalExit
    })

    it('cancels scheduler before subsystem stops, then exits 0', async () => {
        const scheduler = { shutdown: mock(() => {}) }
        const syncEngine = { shutdown: mock(async () => {}) }
        const notificationHub = { stop: mock(() => {}) }
        const sseManager = { stop: mock(() => {}) }
        const webServer = { stop: mock(() => {}) }

        const handler = createShutdownHandler({
            scheduler,
            syncEngine,
            notificationHub,
            sseManager,
            webServer
        })

        await handler()

        expect(scheduler.shutdown).toHaveBeenCalledTimes(1)
        expect(syncEngine.shutdown).toHaveBeenCalledTimes(1)
        expect(notificationHub.stop).toHaveBeenCalledTimes(1)
        expect(sseManager.stop).toHaveBeenCalledTimes(1)
        expect(webServer.stop).toHaveBeenCalledTimes(1)
        expect(exitCalls).toEqual([0])

        const schedulerOrder = scheduler.shutdown.mock.invocationCallOrder[0] ?? Number.POSITIVE_INFINITY
        const notificationOrder = notificationHub.stop.mock.invocationCallOrder[0] ?? -1
        const syncOrder = syncEngine.shutdown.mock.invocationCallOrder[0] ?? -1
        const sseOrder = sseManager.stop.mock.invocationCallOrder[0] ?? -1
        const webOrder = webServer.stop.mock.invocationCallOrder[0] ?? -1

        expect(schedulerOrder).toBeLessThan(notificationOrder)
        expect(schedulerOrder).toBeLessThan(syncOrder)
        expect(schedulerOrder).toBeLessThan(sseOrder)
        expect(schedulerOrder).toBeLessThan(webOrder)
    })

    it('tolerates nullish subsystem references (graceful boot-failure shutdown)', async () => {
        const scheduler = { shutdown: mock(() => {}) }

        const handler = createShutdownHandler({
            scheduler,
            syncEngine: null,
            notificationHub: null,
            sseManager: null,
            webServer: null
        })

        await handler()

        expect(scheduler.shutdown).toHaveBeenCalledTimes(1)
        expect(exitCalls).toEqual([0])
    })

    it('awaits syncEngine.shutdown but races a 5s timeout (does not hang)', async () => {
        const scheduler = { shutdown: mock(() => {}) }
        const syncEngine = {
            shutdown: mock(() => new Promise<void>(() => { /* never resolves */ }))
        }
        const notificationHub = { stop: mock(() => {}) }
        const sseManager = { stop: mock(() => {}) }
        const webServer = { stop: mock(() => {}) }

        const handler = createShutdownHandler({
            scheduler,
            syncEngine,
            notificationHub,
            sseManager,
            webServer,
            syncEngineShutdownTimeoutMs: 30
        })

        const start = Date.now()
        await handler()
        const elapsed = Date.now() - start

        expect(elapsed).toBeLessThan(500)
        expect(scheduler.shutdown).toHaveBeenCalledTimes(1)
        expect(sseManager.stop).toHaveBeenCalledTimes(1)
        expect(webServer.stop).toHaveBeenCalledTimes(1)
        expect(exitCalls).toEqual([0])
    })
})
