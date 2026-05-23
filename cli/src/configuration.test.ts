/**
 * Active tests for `loadConfig()` (Plan 10-03).
 *
 * Covers the four behaviors flipped from `describe.skip` in Plan 01:
 * - D-164: returns a deeply frozen Config (top-level + nested mutations throw)
 * - D-160: rejects legacy `serverUrl` field naming `serverUrl` + `apiUrl` + the settings file path
 * - D-161: rejects legacy `WEBAPP_*` / `SERVER_URL` env vars naming the new env name
 * - D-167: throws on malformed `settings.json` with the absolute path in the message
 *
 * Each test isolates `HAPI_HOME` to a `mkdtempSync` directory and restores
 * the surrounding env in `afterEach` so no shared global state leaks.
 *
 * Per threat T-10-03-02 NONE of the assertions check token values inside
 * error messages.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { loadConfig } from './configuration'

const ENV_KEYS = [
    'HAPI_HOME',
    'WEBAPP_HOST',
    'WEBAPP_PORT',
    'WEBAPP_URL',
    'SERVER_URL',
    'HAPI_API_URL',
    'CLI_API_TOKEN',
    'HAPI_EXTRA_HEADERS_JSON',
    'HAPI_EXPERIMENTAL'
] as const

describe('cli/configuration loadConfig()', () => {
    const originalEnv: Record<string, string | undefined> = {}
    let happyHome: string

    beforeEach(() => {
        for (const key of ENV_KEYS) {
            originalEnv[key] = process.env[key]
            delete process.env[key]
        }
        happyHome = mkdtempSync(join(tmpdir(), 'hapi-load-config-test-'))
        process.env.HAPI_HOME = happyHome
    })

    afterEach(() => {
        for (const key of ENV_KEYS) {
            const value = originalEnv[key]
            if (value === undefined) {
                delete process.env[key]
            } else {
                process.env[key] = value
            }
        }
        rmSync(happyHome, { recursive: true, force: true })
    })

    it('returns a deeply frozen config object (D-164)', async () => {
        const config = await loadConfig()

        expect(Object.isFrozen(config)).toBe(true)
        expect(Object.isFrozen(config.extraHeaders)).toBe(true)

        expect(() => {
            ; (config as any).apiUrl = 'http://hijacked'
        }).toThrow(TypeError)
        expect(() => {
            ; (config.extraHeaders as any)['X-Foo'] = 'y'
        }).toThrow(TypeError)
    })

    it('rejects legacy `serverUrl` field naming serverUrl + apiUrl + the settings file path (D-160)', async () => {
        const settingsFile = join(happyHome, 'settings.json')
        writeFileSync(settingsFile, JSON.stringify({ serverUrl: 'http://example' }))

        await expect(loadConfig()).rejects.toThrow(
            expect.objectContaining({
                message: expect.stringMatching(
                    new RegExp(
                        ['serverUrl', 'apiUrl', settingsFile.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')].join('[\\s\\S]*')
                    )
                )
            })
        )
    })

    it('rejects legacy WEBAPP_HOST env var naming HAPI_LISTEN_HOST (D-161)', async () => {
        process.env.WEBAPP_HOST = '127.0.0.1'

        await expect(loadConfig()).rejects.toThrow(/HAPI_LISTEN_HOST/)
    })

    it('throws on malformed settings.json naming the settings file path (D-167)', async () => {
        const settingsFile = join(happyHome, 'settings.json')
        writeFileSync(settingsFile, '{')

        await expect(loadConfig()).rejects.toThrow(
            new RegExp(settingsFile.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
        )
    })
})
