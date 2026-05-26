import { describe, expect, it } from 'bun:test'
import { isValidSkillForAutocomplete, normalizeSkillSummaryForWire } from './skillPolicy'
import type { SkillSummary } from './schemas'

describe('normalizeSkillSummaryForWire', () => {
    it('defaults missing source and valid for legacy rows', () => {
        const legacy = { name: 'legacy', description: 'x' } as SkillSummary
        expect(normalizeSkillSummaryForWire(legacy)).toEqual({
            name: 'legacy',
            description: 'x',
            source: 'user',
            valid: true,
        })
    })

    it('preserves explicit project source and invalid flag', () => {
        const row: SkillSummary = {
            name: 'broken',
            source: 'project',
            valid: false,
            invalidReason: 'bad yaml',
        }
        expect(normalizeSkillSummaryForWire(row)).toEqual(row)
    })
})

describe('isValidSkillForAutocomplete', () => {
    it('returns true only when skill.valid === true', () => {
        expect(isValidSkillForAutocomplete({ name: 'ok', source: 'user', valid: true })).toBe(true)
        expect(isValidSkillForAutocomplete({ name: 'bad', source: 'user', valid: false })).toBe(false)
    })
})
