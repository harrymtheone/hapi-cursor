import type { Suggestion } from '@/hooks/useActiveSuggestions'

/** Skills first, then slash commands; duplicate keys keep the first (skill) entry. */
export function mergeAutocompleteSuggestions(
    skills: Suggestion[],
    commands: Suggestion[]
): Suggestion[] {
    const seen = new Set<string>()
    const merged: Suggestion[] = []
    for (const item of [...skills, ...commands]) {
        if (seen.has(item.key)) {
            continue
        }
        seen.add(item.key)
        merged.push(item)
    }
    return merged
}
