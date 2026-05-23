import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { Database } from 'bun:sqlite'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Store } from './index'

// Must match the SCHEMA_VERSION constant in ./index.ts. Kept loose enough that
// tests still pass if Plan 04 bumps the canonical version — we read the
// "expected" value out of the thrown error rather than hard-coding it here.

let tmpDir: string
let dbPath: string

beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'hapi-store-test-'))
    dbPath = join(tmpDir, 'test.db')
})

afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true })
})

function buildStoreOnce(): number {
    const seed = new Store(dbPath)
    const versionRow = (seed as unknown as { db: Database }).db
        .prepare('PRAGMA user_version')
        .get() as { user_version: number }
    seed.close()
    return versionRow.user_version
}

describe('Store schema mismatch', () => {
    it('throws when PRAGMA user_version differs from SCHEMA_VERSION (D-173)', () => {
        const expectedVersion = buildStoreOnce()
        const foundVersion = expectedVersion + 1

        const direct = new Database(dbPath, { create: false, readwrite: true, strict: true })
        direct.exec(`PRAGMA user_version = ${foundVersion}`)
        direct.close()

        let caught: Error | undefined
        try {
            new Store(dbPath)
        } catch (err) {
            caught = err as Error
        }

        expect(caught).toBeDefined()
        expect(caught!.message).toContain(dbPath)
        expect(caught!.message).toContain(String(expectedVersion))
        expect(caught!.message).toContain(String(foundVersion))
    })
})

describe('Store missing required tables', () => {
    it('throws naming the dropped table when a required table is absent', () => {
        buildStoreOnce()

        const direct = new Database(dbPath, { create: false, readwrite: true, strict: true })
        direct.exec('DROP TABLE sessions')
        direct.close()

        let caught: Error | undefined
        try {
            new Store(dbPath)
        } catch (err) {
            caught = err as Error
        }

        expect(caught).toBeDefined()
        expect(caught!.message.toLowerCase()).toContain('sessions')
    })
})
