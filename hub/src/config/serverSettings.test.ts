import { afterEach, describe, expect, it } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadServerSettings } from './serverSettings'

const legacyRelayEnv = {
    api: ['HAPI', 'RELAY', 'API'].join('_'),
    auth: ['HAPI', 'RELAY', 'AUTH'].join('_'),
    forceTcp: ['HAPI', 'RELAY', 'FORCE_TCP'].join('_'),
}

const originalEnv = {
    legacyRelayApi: process.env[legacyRelayEnv.api],
    legacyRelayAuth: process.env[legacyRelayEnv.auth],
    legacyRelayForceTcp: process.env[legacyRelayEnv.forceTcp],
    HAPI_LISTEN_PORT: process.env.HAPI_LISTEN_PORT,
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
        restoreEnv(legacyRelayEnv.api, originalEnv.legacyRelayApi)
        restoreEnv(legacyRelayEnv.auth, originalEnv.legacyRelayAuth)
        restoreEnv(legacyRelayEnv.forceTcp, originalEnv.legacyRelayForceTcp)
        restoreEnv('HAPI_LISTEN_PORT', originalEnv.HAPI_LISTEN_PORT)
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
        process.env[legacyRelayEnv.api] = 'legacy-relay.example'
        process.env[legacyRelayEnv.auth] = 'legacy-auth'
        process.env[legacyRelayEnv.forceTcp] = '1'
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

    it('rejects invalid file-sourced listenPort values', async () => {
        dir = makeTempDir()
        writeFileSync(join(dir, 'settings.json'), JSON.stringify({
            listenPort: '3006',
        }))

        await expect(loadServerSettings(dir)).rejects.toThrow(
            'listenPort must be an integer port between 1 and 65535'
        )
    })

    it('rejects invalid file-sourced corsOrigins values', async () => {
        dir = makeTempDir()
        writeFileSync(join(dir, 'settings.json'), JSON.stringify({
            corsOrigins: 'https://hapi.example.com',
        }))

        await expect(loadServerSettings(dir)).rejects.toThrow(
            'corsOrigins must be an array of origins'
        )
    })
})
