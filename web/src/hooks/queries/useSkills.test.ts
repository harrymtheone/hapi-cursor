import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SkillSummary } from '@hapi/protocol/types'
import { getEffectiveSkillSuggestions } from './useSkills'

vi.mock('@/lib/recent-skills', () => ({
    getRecentSkills: vi.fn(() => ({})),
}))

import { getRecentSkills } from '@/lib/recent-skills'

function skill(overrides: Partial<SkillSummary> & { name: string }): SkillSummary {
    return {
        source: 'project',
        valid: true,
        ...overrides,
    }
}

describe('getEffectiveSkillSuggestions', () => {
    beforeEach(() => {
        vi.mocked(getRecentSkills).mockReturnValue({})
    })

    const discoverySkills: SkillSummary[] = [
        skill({ name: 'alpha' }),
        skill({ name: 'beta', valid: false, invalidReason: 'bad frontmatter' }),
        skill({ name: 'gamma' }),
    ]

    it('suggests valid skills with / prefix keys', () => {
        const suggestions = getEffectiveSkillSuggestions(discoverySkills, '/')
        const keys = suggestions.map((item) => item.key)
        expect(keys).toContain('/alpha')
        expect(keys).toContain('/gamma')
        expect(keys.every((key) => key.startsWith('/'))).toBe(true)
        expect(keys.some((key) => key.startsWith('$'))).toBe(false)
    })

    it('never suggests invalid skills', () => {
        const suggestions = getEffectiveSkillSuggestions(discoverySkills, '/')
        expect(suggestions.map((item) => item.key)).not.toContain('/beta')
    })

    it('strips leading / from search term', () => {
        const suggestions = getEffectiveSkillSuggestions(
            [skill({ name: 'deploy' })],
            '/dep'
        )
        expect(suggestions.map((item) => item.key)).toEqual(['/deploy'])
    })

    it('reorders valid skills by recency', () => {
        vi.mocked(getRecentSkills).mockReturnValue({
            gamma: 3_000,
            alpha: 1_000,
        })
        const suggestions = getEffectiveSkillSuggestions(discoverySkills, '/')
        expect(suggestions.map((item) => item.key)).toEqual(['/gamma', '/alpha'])
    })

    it('labels skill suggestions for scanability', () => {
        const suggestions = getEffectiveSkillSuggestions(
            [skill({ name: 'deploy', description: 'Ship it' })],
            '/'
        )
        expect(suggestions[0]?.description).toContain('Skill')
        expect(suggestions[0]?.description).toContain('Ship it')
    })
})
