import type { SkillPolicyState, SkillSummary } from '@hapi/protocol/types'

export function sortSkills(skills: SkillSummary[]): SkillSummary[] {
    return [...skills].sort((a, b) => {
        if (a.source !== b.source) {
            return a.source === 'project' ? -1 : 1
        }
        return a.name.localeCompare(b.name)
    })
}

export function getSkillPolicyState(
    name: string,
    policy: Record<string, SkillPolicyState> | undefined
): SkillPolicyState {
    return policy?.[name] ?? 'inherited'
}

export function hasExplicitSkillPolicy(
    policy: Record<string, SkillPolicyState> | undefined
): boolean {
    if (!policy) {
        return false
    }
    return Object.values(policy).some((state) => state === 'enabled' || state === 'disabled')
}
