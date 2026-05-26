import { describe, expect, it } from 'vitest'
import type { Suggestion } from '@/hooks/useActiveSuggestions'
import { mergeAutocompleteSuggestions } from './autocompleteMerge'

function suggestion(overrides: Partial<Suggestion> & Pick<Suggestion, 'key'>): Suggestion {
    return {
        text: overrides.key,
        label: overrides.key,
        ...overrides,
    }
}

describe('mergeAutocompleteSuggestions', () => {
    it('concatenates skills then commands minus duplicate keys', async () => {
        const skills = [
            suggestion({ key: '/alpha', description: 'Alpha · Skill', source: 'builtin' }),
            suggestion({ key: '/shared', description: 'Skill row', source: 'builtin' }),
        ]
        const commands = [
            suggestion({ key: '/beta', description: 'Beta · Command', source: 'user' }),
            suggestion({ key: '/shared', description: 'Command row', source: 'user' }),
        ]

        const merged = mergeAutocompleteSuggestions(skills, commands)

        expect(merged).toHaveLength(3)
        expect(merged.map((item) => item.key)).toEqual(['/alpha', '/shared', '/beta'])
        expect(merged.find((item) => item.key === '/shared')?.description).toBe('Skill row')
    })

    it('returns skills-only when commands are empty', () => {
        const skills = [suggestion({ key: '/foo', source: 'builtin' })]
        expect(mergeAutocompleteSuggestions(skills, [])).toEqual(skills)
    })
})
