import type { SkillSummary } from '@hapi/protocol/types'

/** Legacy tri-state until SkillsPolicySheet is removed in 02.1-04. */
export type SkillPolicyState = 'inherited' | 'enabled' | 'disabled'

export function sortSkills(skills: SkillSummary[]): SkillSummary[] {
    return [...skills].sort((a, b) => {
        if (a.source !== b.source) {
            return a.source === 'project' ? -1 : 1
        }
        return a.name.localeCompare(b.name)
    })
}

export function getSkillSourceLabelKey(
    source: SkillSummary['source'] | undefined,
    namespace: 'settings' | 'session' = 'session'
): string {
    if (namespace === 'session') {
        if (source === 'project') {
            return 'session.skills.scope.local'
        }
        if (source === 'user') {
            return 'session.skills.scope.global'
        }
        return 'session.skills.source.unknown'
    }
    const base = 'settings.skills.catalog.source'
    if (source === 'project' || source === 'user') {
        return `${base}.${source}`
    }
    return `${base}.unknown`
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
