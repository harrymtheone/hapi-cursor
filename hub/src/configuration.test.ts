import { afterEach, describe, expect, it } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadConfig } from './configuration'

const ENV_KEYS = [
    'HAPI_HOME',
    'DB_PATH',
    'CLI_API_TOKEN',
    'HAPI_LISTEN_HOST',
    'HAPI_LISTEN_PORT',
    'HAPI_PUBLIC_URL',
    'CORS_ORIGINS',
    'WEBAPP_HOST',
    'WEBAPP_PORT',
    'WEBAPP_URL',
    'SERVER_URL',
] as const

const originalEnv: Record<string, string | undefined> = {}
for (const key of ENV_KEYS) {
    originalEnv[key] = process.env[key]
}

function restoreEnv(): void {
    for (const key of ENV_KEYS) {
        const original = originalEnv[key]
        if (original === undefined) {
            delete process.env[key]
        } else {
            process.env[key] = original
        }
    }
}

function makeTempHome(): string {
    return mkdtempSync(join(tmpdir(), 'hapi-hub-config-test-'))
}

// D-164: loadConfig() returns a deeply frozen config object.
describe('hub/configuration loadConfig() — returns a deeply frozen config', () => {
    let dir: string | null = null

    afterEach(() => {
        restoreEnv()
        if (dir) {
            rmSync(dir, { recursive: true, force: true })
            dir = null
        }
    })

    it('top-level + nested objects are frozen (Object.isFrozen === true)', async () => {
        dir = makeTempHome()
        process.env.HAPI_HOME = dir
        process.env.CLI_API_TOKEN = 'a'.repeat(40)

        const config = await loadConfig()

        expect(Object.isFrozen(config)).toBe(true)
        expect(Object.isFrozen(config.corsOrigins)).toBe(true)
        expect(Object.isFrozen(config.sources)).toBe(true)

        expect(() => {
            ;(config as unknown as { listenHost: string }).listenHost = 'mutated'
        }).toThrow(TypeError)
        expect(() => {
            ;(config.corsOrigins as unknown as string[]).push('http://evil.example')
        }).toThrow(TypeError)
        expect(() => {
            ;(config.sources as unknown as { listenHost: string }).listenHost = 'env'
        }).toThrow(TypeError)
    })
})

// D-161: `WEBAPP_*` / `SERVER_URL` env vars must be rejected at load time so a
// stale env cannot silently re-route the hub to an unintended interface.
describe('hub/configuration loadConfig() — rejects legacy env vars', () => {
    let dir: string | null = null

    afterEach(() => {
        restoreEnv()
        if (dir) {
            rmSync(dir, { recursive: true, force: true })
            dir = null
        }
    })

    it('throws when WEBAPP_HOST is set, naming HAPI_LISTEN_HOST', async () => {
        dir = makeTempHome()
        process.env.HAPI_HOME = dir
        process.env.WEBAPP_HOST = '0.0.0.0'

        await expect(loadConfig()).rejects.toThrow('WEBAPP_HOST')
        await expect(loadConfig()).rejects.toThrow('HAPI_LISTEN_HOST')
    })

    it('throws when WEBAPP_PORT is set, naming HAPI_LISTEN_PORT', async () => {
        dir = makeTempHome()
        process.env.HAPI_HOME = dir
        process.env.WEBAPP_PORT = '4000'

        await expect(loadConfig()).rejects.toThrow('WEBAPP_PORT')
        await expect(loadConfig()).rejects.toThrow('HAPI_LISTEN_PORT')
    })

    it('throws when WEBAPP_URL is set, naming HAPI_PUBLIC_URL', async () => {
        dir = makeTempHome()
        process.env.HAPI_HOME = dir
        process.env.WEBAPP_URL = 'http://example.test'

        await expect(loadConfig()).rejects.toThrow('WEBAPP_URL')
        await expect(loadConfig()).rejects.toThrow('HAPI_PUBLIC_URL')
    })

    it('throws when SERVER_URL is set, naming HAPI_API_URL', async () => {
        dir = makeTempHome()
        process.env.HAPI_HOME = dir
        process.env.SERVER_URL = 'http://example.test'

        await expect(loadConfig()).rejects.toThrow('SERVER_URL')
        await expect(loadConfig()).rejects.toThrow('HAPI_API_URL')
    })
})
