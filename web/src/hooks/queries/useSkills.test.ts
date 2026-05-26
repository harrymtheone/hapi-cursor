import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SkillPolicyState, SkillSummary } from '@hapi/protocol/types'
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

    it('omits disabled skills from suggestions', () => {
        const suggestions = getEffectiveSkillSuggestions(
            discoverySkills,
            { gamma: 'disabled' },
            '$'
        )
        const labels = suggestions.map((item) => item.label)
        expect(labels).not.toContain('$gamma')
        expect(labels).toContain('$alpha')
    })

    it('includes enabled skills when discovery lists them', () => {
        const suggestions = getEffectiveSkillSuggestions(
            [skill({ name: 'deploy' })],
            { deploy: 'enabled' },
            '$'
        )
        expect(suggestions.map((item) => item.label)).toContain('$deploy')
    })

    it('includes inherited skills when policy has no row', () => {
        const suggestions = getEffectiveSkillSuggestions(
            [skill({ name: 'deploy' })],
            undefined,
            '$'
        )
        expect(suggestions.map((item) => item.label)).toContain('$deploy')
    })

    it('never suggests invalid skills', () => {
        const suggestions = getEffectiveSkillSuggestions(discoverySkills, {}, '$')
        expect(suggestions.map((item) => item.label)).not.toContain('$beta')
    })

    it('reorders only suggestible skills by recency and skips disabled recent names', () => {
        vi.mocked(getRecentSkills).mockReturnValue({
            blocked: 3_000,
            alpha: 1_000,
        })
        const suggestions = getEffectiveSkillSuggestions(
            [skill({ name: 'alpha' }), skill({ name: 'blocked' })],
            { blocked: 'disabled' } satisfies Record<string, SkillPolicyState>,
            '$'
        )
        expect(suggestions.map((item) => item.label)).toEqual(['$alpha'])
    })

    it('filters disabled skills from fuzzy matches', () => {
        const suggestions = getEffectiveSkillSuggestions(
            [skill({ name: 'deploy' }), skill({ name: 'rollback' })],
            { rollback: 'disabled' },
            '$roll'
        )
        expect(suggestions.map((item) => item.label)).not.toContain('$rollback')
        expect(suggestions).toHaveLength(0)
    })
})
