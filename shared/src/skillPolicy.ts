import type { SkillPolicyState } from './schemas'

/**
 * Whether a skill should appear in HAPI autocomplete / discovery UX.
 * Missing policy rows are inherited (included). Cursor may still auto-invoke skills (D-10).
 */
export function isSkillSuggestible(
    name: string,
    policy: Record<string, SkillPolicyState> | undefined
): boolean {
    return policy?.[name] !== 'disabled'
}

/**
 * Whether a valid skill is allowed for session policy (composer, preamble).
 * Enabled overrides inherited-off; manual invocationMode does not block allowance.
 */
export function isEffectivelyAllowed(
    name: string,
    policy: Record<string, SkillPolicyState> | undefined,
    skillValid = true
): boolean {
    if (!skillValid) {
        return false
    }

    const state = policy?.[name]
    if (state === 'disabled') {
        return false
    }

    return true
}
