import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { listSlashCommands } from './slashCommands'

describe('listSlashCommands', () => {
    let sandboxDir: string
    let projectDir: string

    beforeEach(async () => {
        sandboxDir = await mkdtemp(join(tmpdir(), 'hapi-slash-commands-'))
        projectDir = join(sandboxDir, 'project')
    })

    afterEach(async () => {
        await rm(sandboxDir, { recursive: true, force: true })
    })

    it('returns an empty list for the cursor agent (no capability-defined dirs in v1)', async () => {
        await expect(listSlashCommands('cursor')).resolves.toEqual([])
    })

    it('returns an empty list for cursor even when a projectDir is provided', async () => {
        await expect(listSlashCommands('cursor', projectDir)).resolves.toEqual([])
    })

    it('returns an empty list for an unknown agent (capability lookup yields null resolvers)', async () => {
        await expect(listSlashCommands('something-else', projectDir)).resolves.toEqual([])
    })

    it('does not throw when the project directory does not exist', async () => {
        const nonExistentProjectDir = join(sandboxDir, 'not-exists')
        await expect(listSlashCommands('cursor', nonExistentProjectDir)).resolves.toEqual([])
    })
})
