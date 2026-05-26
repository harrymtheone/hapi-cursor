import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { listSkills } from './skills'

async function writeSkill(skillDir: string, name: string, description: string): Promise<void> {
    await mkdir(skillDir, { recursive: true })
    await writeFile(join(skillDir, 'SKILL.md'), [
        '---',
        `name: ${name}`,
        `description: ${description}`,
        '---',
        '',
        `# ${name}`,
    ].join('\n'))
}

describe('listSkills', () => {
    const originalHome = process.env.HOME
    let sandboxDir: string
    let homeDir: string

    beforeEach(async () => {
        sandboxDir = await mkdtemp(join(tmpdir(), 'hapi-skills-'))
        homeDir = join(sandboxDir, 'home')
        process.env.HOME = homeDir
        await mkdir(homeDir, { recursive: true })
    })

    afterEach(async () => {
        if (originalHome === undefined) {
            delete process.env.HOME
        } else {
            process.env.HOME = originalHome
        }

        await rm(sandboxDir, { recursive: true, force: true })
    })

    it('returns empty list when skills directories are missing', async () => {
        await expect(listSkills()).resolves.toEqual([])
    })

    it('lists user skills from ~/.agents/skills', async () => {
        await writeSkill(join(homeDir, '.agents', 'skills', 'amis'), 'amis', 'AMIS guide')

        const skills = await listSkills()

        expect(skills.map((skill) => skill.name)).toEqual(['amis'])
        expect(skills[0]).toMatchObject({
            name: 'amis',
            description: 'AMIS guide',
            source: 'user',
            valid: true,
        })
        expect(skills[0].pathHint).toMatch(/^~\/.agents\/skills\/amis\/SKILL\.md$/)
    })

    it('discovers nested SKILL.md under .cursor/skills', async () => {
        await writeSkill(join(homeDir, '.cursor', 'skills', 'parent', 'nested-skill'), 'nested-skill', 'Nested skill')

        const skills = await listSkills()

        expect(skills.map((skill) => skill.name)).toContain('nested-skill')
        expect(skills.find((skill) => skill.name === 'nested-skill')).toMatchObject({
            source: 'user',
            valid: true,
        })
    })

    it('lists invalid skills with valid false and invalidReason', async () => {
        const skillDir = join(homeDir, '.agents', 'skills', 'broken')
        await mkdir(skillDir, { recursive: true })
        await writeFile(join(skillDir, 'SKILL.md'), [
            '---',
            'name: [unclosed',
            'description: broken',
            '---',
            '',
            '# broken',
        ].join('\n'))

        const skills = await listSkills()
        const broken = skills.find((skill) => skill.name === 'broken')

        expect(broken).toMatchObject({
            source: 'user',
            valid: false,
            invalidReason: expect.any(String),
        })
    })

    it('redacts user pathHint to tilde-prefixed paths', async () => {
        await writeSkill(join(homeDir, '.cursor', 'skills', 'redacted'), 'redacted', 'Redacted skill')

        const skills = await listSkills()
        const skill = skills.find((entry) => entry.name === 'redacted')

        expect(skill?.pathHint).toMatch(/^~\/.cursor\/skills\/redacted\/SKILL\.md$/)
        expect(skill?.pathHint).not.toContain(homeDir)
    })

    it('falls back to directory name when frontmatter is missing', async () => {
        const skillDir = join(homeDir, '.agents', 'skills', 'no-frontmatter')
        await mkdir(skillDir, { recursive: true })
        await writeFile(join(skillDir, 'SKILL.md'), '# No Frontmatter\n')

        await expect(listSkills()).resolves.toEqual([
            {
                name: 'no-frontmatter',
                description: undefined,
                source: 'user',
                valid: true,
                pathHint: '~/.agents/skills/no-frontmatter/SKILL.md',
            }
        ])
    })

    it('loads project skills from cwd up to repo root', async () => {
        const repoRoot = join(sandboxDir, 'repo')
        const packageDir = join(repoRoot, 'packages')
        const workingDirectory = join(packageDir, 'app')

        await mkdir(join(repoRoot, '.git'), { recursive: true })
        await writeSkill(join(repoRoot, '.agents', 'skills', 'root-skill'), 'root-skill', 'Repo root skill')
        await writeSkill(join(packageDir, '.agents', 'skills', 'package-skill'), 'package-skill', 'Package skill')
        await writeSkill(join(workingDirectory, '.agents', 'skills', 'local-skill'), 'local-skill', 'Local skill')
        await writeSkill(join(sandboxDir, '.agents', 'skills', 'outside-skill'), 'outside-skill', 'Outside repo skill')

        const skills = await listSkills(workingDirectory)

        expect(skills.map((skill) => skill.name)).toEqual(['local-skill', 'package-skill', 'root-skill'])
        expect(skills.every((skill) => skill.source === 'project' && skill.valid === true)).toBe(true)
    })

    it('uses only cwd project skills outside a git repository', async () => {
        const parentDirectory = join(sandboxDir, 'workspace')
        const workingDirectory = join(parentDirectory, 'feature')

        await writeSkill(join(parentDirectory, '.agents', 'skills', 'parent-skill'), 'parent-skill', 'Parent skill')
        await writeSkill(join(workingDirectory, '.agents', 'skills', 'local-skill'), 'local-skill', 'Local skill')

        const skills = await listSkills(workingDirectory)

        expect(skills.map((skill) => skill.name)).toEqual(['local-skill'])
    })

    it('prefers nearest project skill over parent and user duplicates', async () => {
        const repoRoot = join(sandboxDir, 'repo')
        const workingDirectory = join(repoRoot, 'apps', 'web')

        await mkdir(join(repoRoot, '.git'), { recursive: true })
        await writeSkill(join(homeDir, '.agents', 'skills', 'shared'), 'shared', 'User shared skill')
        await writeSkill(join(repoRoot, '.agents', 'skills', 'shared'), 'shared', 'Repo shared skill')
        await writeSkill(join(workingDirectory, '.agents', 'skills', 'shared'), 'shared', 'Local shared skill')

        const skills = await listSkills(workingDirectory)
        const sharedSkills = skills.filter((skill) => skill.name === 'shared')

        expect(sharedSkills).toHaveLength(1)
        expect(sharedSkills[0]).toMatchObject({
            name: 'shared',
            description: 'Local shared skill',
            source: 'project',
            valid: true,
        })
    })

    it('prefers project skill over user skill when names collide', async () => {
        const repoRoot = join(sandboxDir, 'repo')
        const workingDirectory = join(repoRoot, 'apps', 'web')

        await mkdir(join(repoRoot, '.git'), { recursive: true })
        await writeSkill(join(homeDir, '.cursor', 'skills', 'shared'), 'shared', 'User shared skill')
        await writeSkill(join(repoRoot, '.cursor', 'skills', 'shared'), 'shared', 'Project shared skill')

        const skills = await listSkills(workingDirectory)
        const sharedSkills = skills.filter((skill) => skill.name === 'shared')

        expect(sharedSkills).toHaveLength(1)
        expect(sharedSkills[0]).toMatchObject({
            name: 'shared',
            description: 'Project shared skill',
            source: 'project',
            valid: true,
        })
    })
})
