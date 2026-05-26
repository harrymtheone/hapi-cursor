import { describe, expect, it } from 'bun:test'
import { isEffectivelyAllowed, isSkillSuggestible } from './skillPolicy'

describe('isSkillSuggestible', () => {
    it('includes skills with no policy row (inherited)', () => {
        expect(isSkillSuggestible('deploy', undefined)).toBe(true)
        expect(isSkillSuggestible('deploy', {})).toBe(true)
    })

    it('excludes disabled skills only', () => {
        expect(isSkillSuggestible('deploy', { deploy: 'disabled' })).toBe(false)
        expect(isSkillSuggestible('deploy', { deploy: 'enabled' })).toBe(true)
        expect(isSkillSuggestible('deploy', { deploy: 'inherited' })).toBe(true)
    })
})

describe('isEffectivelyAllowed', () => {
    it('rejects invalid skills regardless of policy', () => {
        expect(isEffectivelyAllowed('broken', { broken: 'enabled' }, false)).toBe(false)
    })

    it('allows enabled skills even when invocation would be manual', () => {
        expect(isEffectivelyAllowed('manual-skill', { 'manual-skill': 'enabled' }, true)).toBe(true)
    })

    it('matches suggestible for valid inherited skills', () => {
        expect(isEffectivelyAllowed('deploy', undefined, true)).toBe(true)
        expect(isEffectivelyAllowed('deploy', { deploy: 'disabled' }, true)).toBe(false)
    })
})
