import { useQuery } from '@tanstack/react-query'
import { useCallback, useMemo } from 'react'
import { isSkillSuggestible } from '@hapi/protocol'
import type { SkillPolicyState, SkillSummary } from '@hapi/protocol/types'
import type { ApiClient } from '@/api/client'
import type { Suggestion } from '@/hooks/useActiveSuggestions'
import { queryKeys } from '@/lib/query-keys'
import { getRecentSkills } from '@/lib/recent-skills'
import { levenshteinDistance } from '@/lib/fuzzyMatch'

function filterSuggestibleSkills(
    skills: SkillSummary[],
    skillPolicy: Record<string, SkillPolicyState> | undefined
): SkillSummary[] {
    return skills.filter(
        (skill) => skill.valid && isSkillSuggestible(skill.name, skillPolicy)
    )
}

function toSuggestion(skill: SkillSummary): Suggestion {
    return {
        key: `$${skill.name}`,
        text: `$${skill.name}`,
        label: `$${skill.name}`,
        description: skill.description,
        source: 'builtin',
    }
}

export function getEffectiveSkillSuggestions(
    skills: SkillSummary[],
    skillPolicy: Record<string, SkillPolicyState> | undefined,
    queryText: string
): Suggestion[] {
    const allowed = filterSuggestibleSkills(skills, skillPolicy)
    const recent = getRecentSkills()
    const getRecency = (name: string) => recent[name] ?? 0
    const searchTerm = queryText.startsWith('$')
        ? queryText.slice(1).toLowerCase()
        : queryText.toLowerCase()

    if (!searchTerm) {
        return [...allowed]
            .sort((a, b) => getRecency(b.name) - getRecency(a.name) || a.name.localeCompare(b.name))
            .map(toSuggestion)
    }

    const maxDistance = Math.max(2, Math.floor(searchTerm.length / 2))
    return allowed
        .map((skill) => {
            const name = skill.name.toLowerCase()
            let score: number
            if (name === searchTerm) score = 0
            else if (name.startsWith(searchTerm)) score = 1
            else if (name.includes(searchTerm)) score = 2
            else {
                const dist = levenshteinDistance(searchTerm, name)
                score = dist <= maxDistance ? 3 + dist : Infinity
            }
            return { skill, score, recency: getRecency(skill.name) }
        })
        .filter((item) => item.score < Infinity)
        .sort((a, b) => a.score - b.score || b.recency - a.recency || a.skill.name.localeCompare(b.skill.name))
        .map(({ skill }) => toSuggestion(skill))
}

export function useSkills(
    api: ApiClient | null,
    sessionId: string | null,
    skillPolicy?: Record<string, SkillPolicyState> | undefined
): {
    skills: SkillSummary[]
    isLoading: boolean
    error: string | null
    getSuggestions: (query: string) => Promise<Suggestion[]>
    refetch: () => Promise<unknown>
} {
    const resolvedSessionId = sessionId ?? 'unknown'

    const query = useQuery({
        queryKey: queryKeys.skills(resolvedSessionId),
        queryFn: async () => {
            if (!api || !sessionId) {
                throw new Error('Session unavailable')
            }
            return await api.getSkills(sessionId)
        },
        enabled: Boolean(api && sessionId),
        staleTime: Infinity,
        gcTime: 30 * 60 * 1000,
        retry: false,
    })

    const skills = useMemo(() => {
        if (query.data?.success && query.data.skills) {
            return query.data.skills
        }
        return []
    }, [query.data])

    const getSuggestions = useCallback(async (queryText: string): Promise<Suggestion[]> => {
        return getEffectiveSkillSuggestions(skills, skillPolicy, queryText)
    }, [skillPolicy, skills])

    return {
        skills,
        isLoading: query.isLoading,
        error: query.error instanceof Error ? query.error.message : query.error ? 'Failed to load skills' : null,
        getSuggestions,
        refetch: () => query.refetch(),
    }
}
