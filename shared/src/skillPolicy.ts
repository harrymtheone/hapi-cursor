import type { SkillSummary } from './schemas'

/**
 * Coerce RPC/HTTP payloads that omit Phase 2 SkillSummary fields (stale agent or narrow typings).
 */
export function normalizeSkillSummaryForWire(skill: SkillSummary): SkillSummary {
    const source: SkillSummary['source'] =
        skill.source === 'project' || skill.source === 'user' ? skill.source : 'user'
    return {
        ...skill,
        source,
        valid: skill.valid ?? true,
    }
}

/** Whether a discovered skill may appear in `/` autocomplete (valid discovery only). */
export function isValidSkillForAutocomplete(skill: SkillSummary): boolean {
    return skill.valid === true
}
