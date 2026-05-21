import { afterEach, describe, expect, it } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadServerSettings } from './serverSettings'

const originalEnv = {
    HAPI_RELAY_API: process.env.HAPI_RELAY_API,
    HAPI_RELAY_AUTH: process.env.HAPI_RELAY_AUTH,
    HAPI_RELAY_FORCE_TCP: process.env.HAPI_RELAY_FORCE_TCP,
    HAPI_PUBLIC_URL: process.env.HAPI_PUBLIC_URL,
}

function restoreEnv(name: string, value: string | undefined): void {
    if (value === undefined) {
        delete process.env[name]
        return
    }
    process.env[name] = value
}

function makeTempDir(): string {
    return mkdtempSync(join(tmpdir(), 'hapi-server-settings-test-'))
}

describe('loadServerSettings', () => {
    let dir: string | null = null

    afterEach(() => {
        restoreEnv('HAPI_RELAY_API', originalEnv.HAPI_RELAY_API)
        restoreEnv('HAPI_RELAY_AUTH', originalEnv.HAPI_RELAY_AUTH)
        restoreEnv('HAPI_RELAY_FORCE_TCP', originalEnv.HAPI_RELAY_FORCE_TCP)
        restoreEnv('HAPI_PUBLIC_URL', originalEnv.HAPI_PUBLIC_URL)

        if (dir) {
            rmSync(dir, { recursive: true, force: true })
            dir = null
        }
    })

    it('rejects old webapp settings fields instead of migrating them', async () => {
        dir = makeTempDir()
        writeFileSync(join(dir, 'settings.json'), JSON.stringify({
            webappHost: '0.0.0.0',
            webappPort: 3007,
            webappUrl: 'http://localhost:3007',
        }))

        await expect(loadServerSettings(dir)).rejects.toThrow('Unsupported old settings field')
    })

    it('rejects legacy relay settings fields instead of migrating them', async () => {
        dir = makeTempDir()
        writeFileSync(join(dir, 'settings.json'), JSON.stringify({
            relayApi: 'relay.hapi.run',
            relayAuth: 'hapi',
            relayForceTcp: true,
            relayEnabled: true,
        }))

        await expect(loadServerSettings(dir)).rejects.toThrow(
            'Unsupported old settings field(s)'
        )
        await expect(loadServerSettings(dir)).rejects.toThrow('relayApi')
        await expect(loadServerSettings(dir)).rejects.toThrow('relayAuth')
        await expect(loadServerSettings(dir)).rejects.toThrow('relayForceTcp')
        await expect(loadServerSettings(dir)).rejects.toThrow('relayEnabled')
    })

    it('ignores legacy relay environment variables while preserving public URL source', async () => {
        dir = makeTempDir()
        process.env.HAPI_RELAY_API = 'legacy-relay.example'
        process.env.HAPI_RELAY_AUTH = 'legacy-auth'
        process.env.HAPI_RELAY_FORCE_TCP = '1'
        process.env.HAPI_PUBLIC_URL = 'https://hapi-tailnet.example'

        const result = await loadServerSettings(dir)

        expect(result.settings.publicUrl).toBe('https://hapi-tailnet.example')
        expect(result.sources.publicUrl).toBe('env')
        expect(result).not.toHaveProperty('relayApi')
        expect(result).not.toHaveProperty('relayAuth')
        expect(result).not.toHaveProperty('relayForceTcp')
        expect(result.settings).not.toHaveProperty('relayApi')
        expect(result.settings).not.toHaveProperty('relayAuth')
        expect(result.settings).not.toHaveProperty('relayForceTcp')
    })
})
