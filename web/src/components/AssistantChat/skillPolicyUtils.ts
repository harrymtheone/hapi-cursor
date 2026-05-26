import type { SkillSummary } from '@hapi/protocol/types'

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
    labelScope: 'settings' | 'session' = 'session'
): string {
    if (labelScope === 'session') {
        if (source === 'project') {
            return 'session.skills.scope.local'
        }
        if (source === 'user') {
            return 'session.skills.scope.global'
        }
        return 'session.skills.source.unknown'
    }
    const base = 'settings.skills.catalog.source'
    if (source === 'project') {
        return `${base}.local`
    }
    if (source === 'user') {
        return `${base}.global`
    }
    return `${base}.unknown`
}
