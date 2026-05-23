/**
 * Configuration for hapi-hub (Direct Connect)
 *
 * Configuration is loaded with priority: environment variable > settings.json > default.
 * When values are read from environment variables and not present in settings.json,
 * they are automatically saved for future use.
 *
 * Optional environment variables:
 * - CLI_API_TOKEN: Shared secret for hapi CLI authentication (auto-generated if not set)
 * - HAPI_LISTEN_HOST: Host/IP to bind the HTTP service (default: 127.0.0.1)
 * - HAPI_LISTEN_PORT: Port for HTTP service (default: 3006)
 * - HAPI_PUBLIC_URL: Public URL for external access to the web PWA
 * - CORS_ORIGINS: Comma-separated CORS origins
 * - VAPID_SUBJECT: Contact email or URL for Web Push (defaults to mailto:admin@hapi.run)
 * - HAPI_HOME: Data directory (default: ~/.hapi)
 * - DB_PATH: SQLite database path (default: {HAPI_HOME}/hapi.db)
 *
 * Plan 10-02: replaces the prior `Configuration` singleton with `loadConfig()` —
 * a deeply frozen `Config` threaded via DI through every Hub consumer.
 */

import { existsSync, mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { getOrCreateCliApiToken } from './config/cliApiToken'
import { getSettingsFile } from './config/settings'
import { loadServerSettings, rejectOldEnvVars } from './config/serverSettings'

export type ConfigSource = 'env' | 'file' | 'default'

export interface ConfigSources {
    listenHost: ConfigSource
    listenPort: ConfigSource
    publicUrl: ConfigSource
    corsOrigins: ConfigSource
    cliApiToken: 'env' | 'file' | 'generated'
}

export type Config = Readonly<{
    dataDir: string
    dbPath: string
    settingsFile: string
    listenHost: string
    listenPort: number
    publicUrl: string
    corsOrigins: readonly string[]
    cliApiToken: string
    cliApiTokenSource: 'env' | 'file' | 'generated'
    cliApiTokenIsNew: boolean
    sources: Readonly<ConfigSources>
}>

function deepFreeze<T>(value: T): T {
    if (value && typeof value === 'object' && !Object.isFrozen(value)) {
        for (const key of Object.keys(value as object)) {
            deepFreeze((value as Record<string, unknown>)[key])
        }
        Object.freeze(value)
    }
    return value
}

export async function loadConfig(): Promise<Config> {
    rejectOldEnvVars()

    const dataDir = process.env.HAPI_HOME
        ? process.env.HAPI_HOME.replace(/^~/, homedir())
        : join(homedir(), '.hapi')

    if (!existsSync(dataDir)) {
        mkdirSync(dataDir, { recursive: true })
    }

    const dbPath = process.env.DB_PATH
        ? process.env.DB_PATH.replace(/^~/, homedir())
        : join(dataDir, 'hapi.db')

    const settingsResult = await loadServerSettings(dataDir)

    if (settingsResult.savedToFile) {
        console.log(`[Hub] Configuration saved to ${getSettingsFile(dataDir)}`)
    }

    const tokenResult = await getOrCreateCliApiToken(dataDir)

    return deepFreeze({
        dataDir,
        dbPath,
        settingsFile: getSettingsFile(dataDir),
        listenHost: settingsResult.settings.listenHost,
        listenPort: settingsResult.settings.listenPort,
        publicUrl: settingsResult.settings.publicUrl,
        corsOrigins: Object.freeze([...settingsResult.settings.corsOrigins]) as readonly string[],
        cliApiToken: tokenResult.token,
        cliApiTokenSource: tokenResult.source,
        cliApiTokenIsNew: tokenResult.isNew,
        sources: Object.freeze({
            ...settingsResult.sources,
            cliApiToken: tokenResult.source,
        }),
    }) as Config
}
