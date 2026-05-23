/**
 * CLI configuration for hapi
 *
 * Plan 10-03: replaces the prior `Configuration` singleton with `loadConfig()` —
 * a deeply frozen `Config` threaded via DI through every CLI consumer.
 *
 * Environment variables:
 * - HAPI_API_URL: API URL for hub (default: http://localhost:3006)
 * - CLI_API_TOKEN: shared secret for hub authentication
 * - HAPI_HOME: data directory (default: ~/.hapi)
 * - HAPI_EXTRA_HEADERS_JSON: JSON object of extra HTTP headers to send to hub
 * - HAPI_EXPERIMENTAL: enable experimental features
 *
 * Legacy env vars (`WEBAPP_HOST`, `WEBAPP_PORT`, `WEBAPP_URL`, `SERVER_URL`)
 * are rejected via `rejectOldEnvVars` from `hub/src/config/serverSettings.ts`.
 */

import { existsSync, mkdirSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import packageJson from '../package.json'
import { rejectOldEnvVars } from '../../hub/src/config/serverSettings'
import { getCliArgs } from '@/utils/cliArgs'

const OLD_CLI_SETTINGS_FIELDS = ['serverUrl'] as const

export type Config = Readonly<{
    apiUrl: string
    cliApiToken: string
    extraHeaders: Readonly<Record<string, string>>
    isRunnerProcess: boolean
    happyHomeDir: string
    logsDir: string
    settingsFile: string
    privateKeyFile: string
    runnerStateFile: string
    runnerLockFile: string
    currentCliVersion: string
    isExperimentalEnabled: boolean
}>

export function parseExtraHeaders(raw: string | undefined, warn: (message: string) => void = console.warn): Record<string, string> {
    if (!raw) {
        return {}
    }

    try {
        const parsed = JSON.parse(raw) as unknown
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
            warn('[WARN] HAPI_EXTRA_HEADERS_JSON must be a JSON object. Ignoring value.')
            return {}
        }

        const entries = Object.entries(parsed)
        const headers = Object.fromEntries(
            entries.filter((entry): entry is [string, string] => typeof entry[0] === 'string' && typeof entry[1] === 'string')
        )

        if (Object.keys(headers).length !== entries.length) {
            warn('[WARN] HAPI_EXTRA_HEADERS_JSON only supports string header values. Ignoring non-string entries.')
        }

        return headers
    } catch {
        warn('[WARN] Failed to parse HAPI_EXTRA_HEADERS_JSON. Ignoring value.')
        return {}
    }
}

function deepFreeze<T>(value: T): T {
    if (value && typeof value === 'object' && !Object.isFrozen(value)) {
        for (const key of Object.keys(value as object)) {
            deepFreeze((value as Record<string, unknown>)[key])
        }
        Object.freeze(value)
    }
    return value
}

function rejectOldCliSettingsFields(parsed: object, settingsFile: string): void {
    const oldFields = OLD_CLI_SETTINGS_FIELDS.filter((field) => field in parsed)
    if (oldFields.length === 0) {
        return
    }
    throw new Error(
        `Unsupported legacy field(s) in ${settingsFile}: ${oldFields.join(', ')}. ` +
        `Rename to apiUrl in ${settingsFile}, or remove the field, and restart.`
    )
}

export async function loadConfig(opts?: { argv?: string[] }): Promise<Config> {
    rejectOldEnvVars()

    const happyHomeDir = process.env.HAPI_HOME
        ? process.env.HAPI_HOME.replace(/^~/, homedir())
        : join(homedir(), '.hapi')

    const logsDir = join(happyHomeDir, 'logs')
    const settingsFile = join(happyHomeDir, 'settings.json')
    const privateKeyFile = join(happyHomeDir, 'access.key')
    const runnerStateFile = join(happyHomeDir, 'runner.state.json')
    const runnerLockFile = join(happyHomeDir, 'runner.state.json.lock')

    if (!existsSync(happyHomeDir)) {
        mkdirSync(happyHomeDir, { recursive: true })
    }
    if (!existsSync(logsDir)) {
        mkdirSync(logsDir, { recursive: true })
    }

    let settingsApiUrl: string | undefined
    let settingsCliApiToken: string | undefined
    if (existsSync(settingsFile)) {
        let raw: string
        try {
            raw = await readFile(settingsFile, 'utf8')
        } catch {
            throw new Error(
                `Cannot read ${settingsFile}. Please fix or remove the file and restart.`
            )
        }
        let parsed: unknown
        try {
            parsed = JSON.parse(raw)
        } catch {
            throw new Error(
                `Cannot parse ${settingsFile}: invalid JSON. Please fix or remove the file and restart.`
            )
        }
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
            throw new Error(
                `Cannot read ${settingsFile}: contents must be a JSON object. Please fix or remove the file and restart.`
            )
        }
        rejectOldCliSettingsFields(parsed as object, settingsFile)
        const settings = parsed as { apiUrl?: unknown; cliApiToken?: unknown }
        if (typeof settings.apiUrl === 'string') settingsApiUrl = settings.apiUrl
        if (typeof settings.cliApiToken === 'string') settingsCliApiToken = settings.cliApiToken
    }

    const apiUrl = process.env.HAPI_API_URL || settingsApiUrl || 'http://localhost:3006'
    const cliApiToken = process.env.CLI_API_TOKEN || settingsCliApiToken || ''
    const extraHeaders = Object.freeze({ ...parseExtraHeaders(process.env.HAPI_EXTRA_HEADERS_JSON) })

    const args = opts?.argv ?? getCliArgs()
    const isRunnerProcess = args.length >= 2 && args[0] === 'runner' && args[1] === 'start-sync'

    const isExperimentalEnabled = ['true', '1', 'yes'].includes(process.env.HAPI_EXPERIMENTAL?.toLowerCase() || '')

    return deepFreeze({
        apiUrl,
        cliApiToken,
        extraHeaders,
        isRunnerProcess,
        happyHomeDir,
        logsDir,
        settingsFile,
        privateKeyFile,
        runnerStateFile,
        runnerLockFile,
        currentCliVersion: packageJson.version,
        isExperimentalEnabled,
    }) as Config
}
