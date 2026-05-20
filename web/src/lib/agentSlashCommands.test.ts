import { describe, expect, it } from 'vitest'
import {
    findAgentCustomPromptExpansion,
    getBuiltinSlashCommands,
    mergeSlashCommands
} from './agentSlashCommands'

describe('getBuiltinSlashCommands', () => {
    it('returns an empty list for cursor (no built-ins surfaced post Phase-1 cut)', () => {
        expect(getBuiltinSlashCommands('cursor')).toEqual([])
    })

    it('returns an empty list for unknown agent types', () => {
        expect(getBuiltinSlashCommands('unknown')).toEqual([])
    })
})

describe('mergeSlashCommands', () => {
    it('lets custom commands override same-name built-ins', () => {
        const commands = mergeSlashCommands([
            { name: 'clear', source: 'builtin' },
            { name: 'compact', source: 'builtin' },
            { name: 'clear', source: 'project', content: 'project clear prompt' }
        ])

        expect(commands).toEqual([
            { name: 'compact', source: 'builtin' },
            { name: 'clear', source: 'project', content: 'project clear prompt' }
        ])
    })

    it('keeps API-provided built-ins while de-duplicating by name', () => {
        const commands = mergeSlashCommands([
            { name: 'clear', source: 'builtin' },
            { name: 'status', source: 'builtin' },
            { name: 'help', source: 'builtin' },
            { name: 'status', source: 'builtin', description: 'Captured status' },
            { name: 'project-only', source: 'project', content: 'Project prompt' }
        ])

        expect(commands).toEqual([
            { name: 'clear', source: 'builtin' },
            { name: 'help', source: 'builtin' },
            { name: 'status', source: 'builtin', description: 'Captured status' },
            { name: 'project-only', source: 'project', content: 'Project prompt' }
        ])
    })
})

describe('findAgentCustomPromptExpansion', () => {
    it('expands exact custom prompt commands', () => {
        expect(findAgentCustomPromptExpansion('  /clear  ', [
            { name: 'clear', source: 'builtin' },
            { name: 'clear', source: 'project', content: 'custom clear prompt' }
        ])).toBe('custom clear prompt')
    })

    it('ignores built-ins and commands with arguments', () => {
        const commands = [
            { name: 'compact', source: 'project', content: 'custom compact prompt' }
        ] as const

        expect(findAgentCustomPromptExpansion('/compact now', commands)).toBeNull()
        expect(findAgentCustomPromptExpansion('/clear', [
            { name: 'clear', source: 'builtin' }
        ])).toBeNull()
    })
})
