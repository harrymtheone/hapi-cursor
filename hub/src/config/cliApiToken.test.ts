import { afterEach, describe, expect, it } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { getOrCreateCliApiToken } from './cliApiToken'

function makeTempDir(): string {
    return mkdtempSync(join(tmpdir(), 'hapi-cli-token-test-'))
}

describe('getOrCreateCliApiToken', () => {
    const originalToken = process.env.CLI_API_TOKEN
    let dir: string | null = null

    afterEach(() => {
        if (originalToken === undefined) {
            delete process.env.CLI_API_TOKEN
        } else {
            process.env.CLI_API_TOKEN = originalToken
        }
        if (dir) {
            rmSync(dir, { recursive: true, force: true })
            dir = null
        }
    })

    it('accepts colon-bearing env tokens as opaque secrets', async () => {
        dir = makeTempDir()
        process.env.CLI_API_TOKEN = 'base-token:default'

        const result = await getOrCreateCliApiToken(dir)

        expect(result.token).toBe('base-token:default')
        expect(result.source).toBe('env')
    })

    it('accepts colon-bearing file tokens as opaque secrets', async () => {
        dir = makeTempDir()
        delete process.env.CLI_API_TOKEN
        writeFileSync(join(dir, 'settings.json'), JSON.stringify({ cliApiToken: 'base-token:default' }))

        const result = await getOrCreateCliApiToken(dir)

        expect(result.token).toBe('base-token:default')
        expect(result.source).toBe('file')
    })
})
