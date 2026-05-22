/**
 * HAPI Hub - Main Entry Point
 *
 * Provides:
 * - Web app + HTTP API
 * - Socket.IO for CLI connections
 * - SSE updates for the web UI
 */

import { createConfiguration, type ConfigSource } from './configuration'
import { Store } from './store'
import { SyncEngine, type SyncEvent } from './sync/syncEngine'
import { NotificationHub } from './notifications/notificationHub'
import type { NotificationChannel } from './notifications/notificationTypes'
import { startWebServer } from './web/server'
import { getOrCreateJwtSecret } from './config/jwtSecret'
import { createSocketServer } from './socket/server'
import { SSEManager } from './sse/sseManager'
import { KeepaliveScheduler } from './utils/scheduler'
import { getOrCreateVapidKeys } from './config/vapidKeys'
import { PushService } from './push/pushService'
import { PushNotificationChannel } from './push/pushNotificationChannel'
import { VisibilityTracker } from './visibility/visibilityTracker'
import type { Server as BunServer } from 'bun'
import type { WebSocketData } from '@socket.io/bun-engine'

/** Format config source for logging */
function formatSource(source: ConfigSource | 'generated'): string {
    switch (source) {
        case 'env':
            return 'environment'
        case 'file':
            return 'settings.json'
        case 'default':
            return 'default'
        case 'generated':
            return 'generated'
    }
}

function normalizeOrigin(value: string): string {
    const trimmed = value.trim()
    if (!trimmed) {
        return ''
    }
    try {
        return new URL(trimmed).origin
    } catch {
        return trimmed
    }
}

function normalizeOrigins(origins: string[]): string[] {
    const normalized = origins
        .map(normalizeOrigin)
        .filter(Boolean)
    if (normalized.includes('*')) {
        return ['*']
    }
    return Array.from(new Set(normalized))
}

let syncEngine: SyncEngine | null = null
let webServer: BunServer<WebSocketData> | null = null
let sseManager: SSEManager | null = null
let visibilityTracker: VisibilityTracker | null = null
let notificationHub: NotificationHub | null = null

/**
 * Factory for the SIGINT / SIGTERM shutdown closure (D-141).
 *
 * Extracted from `main()` so unit tests can invoke the handler directly without
 * resorting to `process.emit('SIGINT')` (unreliable across runtimes).
 *
 * Shutdown order (D-140): cancel scheduler handles first so no further callbacks
 * fire after subsystem stops, then stop notificationHub, await syncEngine.shutdown
 * (raced with a configurable timeout — default 5s — so a hanging shutdown does
 * not block exit), then SSE + web server, then `process.exit(0)`.
 *
 * Plan 08-02 Task 2: scaffolds the factory with a no-op scheduler stub; Task 3
 * wires the real KeepaliveScheduler and the per-subsystem cancellations.
 */
export type ShutdownDeps = {
    scheduler: { shutdown: () => void }
    syncEngine: { shutdown: () => void | Promise<void> } | null
    notificationHub: { stop: () => void } | null
    sseManager: { stop: () => void } | null
    webServer: { stop: () => void } | null
    /** Race timeout (ms) for awaiting syncEngine.shutdown(). Default 5_000. */
    syncEngineShutdownTimeoutMs?: number
}

export function createShutdownHandler(deps: ShutdownDeps): () => Promise<void> {
    const timeoutMs = deps.syncEngineShutdownTimeoutMs ?? 5_000
    return async () => {
        console.log('\nShutting down...')
        deps.scheduler.shutdown()
        deps.notificationHub?.stop()
        if (deps.syncEngine) {
            const shutdownPromise = Promise.resolve(deps.syncEngine.shutdown())
            await Promise.race([
                shutdownPromise,
                new Promise<void>((resolve) => setTimeout(resolve, timeoutMs))
            ])
        }
        deps.sseManager?.stop()
        deps.webServer?.stop()
        process.exit(0)
    }
}

async function main() {
    console.log('HAPI Hub starting...')

    // Load configuration (async - loads from env/file with persistence)
    const config = await createConfiguration()
    const corsOrigins = normalizeOrigins(config.corsOrigins)

    // Display CLI API token information
    if (config.cliApiTokenIsNew) {
        console.log('')
        console.log('='.repeat(70))
        console.log('  NEW CLI_API_TOKEN GENERATED')
        console.log('='.repeat(70))
        console.log('')
        console.log(`  Token: ${config.cliApiToken}`)
        console.log('')
        console.log(`  Saved to: ${config.settingsFile}`)
        console.log('')
        console.log('='.repeat(70))
        console.log('')
    } else {
        console.log(`[Hub] CLI_API_TOKEN: loaded from ${formatSource(config.sources.cliApiToken)}`)
    }

    // Display other configuration sources
    console.log(`[Hub] HAPI_LISTEN_HOST: ${config.listenHost} (${formatSource(config.sources.listenHost)})`)
    console.log(`[Hub] HAPI_LISTEN_PORT: ${config.listenPort} (${formatSource(config.sources.listenPort)})`)
    console.log(`[Hub] HAPI_PUBLIC_URL: ${config.publicUrl} (${formatSource(config.sources.publicUrl)})`)

    const store = new Store(config.dbPath)
    const jwtSecret = await getOrCreateJwtSecret()
    const vapidKeys = await getOrCreateVapidKeys(config.dataDir)
    const vapidSubject = process.env.VAPID_SUBJECT ?? 'mailto:admin@hapi.run'
    const pushService = new PushService(vapidKeys, vapidSubject, store)

    const scheduler = new KeepaliveScheduler()
    visibilityTracker = new VisibilityTracker()
    sseManager = new SSEManager(30_000, visibilityTracker, scheduler)

    const socketServer = createSocketServer({
        store,
        jwtSecret,
        scheduler,
        corsOrigins,
        getSession: (sessionId) => {
            if (syncEngine) {
                return syncEngine.getSession(sessionId) ?? null
            }
            return store.sessions.getSession(sessionId)
        },
        onWebappEvent: (event: SyncEvent) => syncEngine?.handleRealtimeEvent(event),
        onSessionAlive: (payload) => syncEngine?.handleSessionAlive(payload),
        onSessionEnd: (payload) => syncEngine?.handleSessionEnd(payload),
        onMachineAlive: (payload) => syncEngine?.handleMachineAlive(payload),
        onBackgroundTaskDelta: (sessionId, delta) => syncEngine?.handleBackgroundTaskDelta(sessionId, delta),
        onSessionActivity: (sessionId, updatedAt) => syncEngine?.recordSessionActivity(sessionId, updatedAt),
        onSweepImmediateQueued: (sessionId, now) => syncEngine?.sweepImmediateQueuedOnSessionEnd(sessionId, now)
    })

    syncEngine = new SyncEngine(store, socketServer.io, socketServer.rpcRegistry, sseManager, scheduler)

    const notificationChannels: NotificationChannel[] = [
        new PushNotificationChannel(pushService, sseManager, visibilityTracker, config.publicUrl)
    ]

    notificationHub = new NotificationHub(syncEngine, notificationChannels, scheduler)

    webServer = await startWebServer({
        getSyncEngine: () => syncEngine,
        getSseManager: () => sseManager,
        getVisibilityTracker: () => visibilityTracker,
        jwtSecret,
        store,
        vapidPublicKey: vapidKeys.publicKey,
        socketEngine: socketServer.engine,
        corsOrigins
    })

    console.log('')
    console.log('[Web] Hub listening on :' + config.listenPort)
    console.log('[Web] Local:  http://localhost:' + config.listenPort)
    console.log('[Web] Public: ' + config.publicUrl)
    console.log('')
    console.log('HAPI Hub is ready!')

    const shutdown = createShutdownHandler({
        scheduler,
        syncEngine,
        notificationHub,
        sseManager,
        webServer
    })

    process.on('SIGINT', shutdown)
    process.on('SIGTERM', shutdown)

    // Keep process running
    await new Promise(() => {})
}

if (import.meta.main) {
    main().catch((error) => {
        console.error('Fatal error:', error)
        process.exit(1)
    })
}
