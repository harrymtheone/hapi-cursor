import { useMemo, useState } from 'react'
import type { SessionSummary } from '@/types/api'
import { getSessionTitle } from './SessionListItem'

export function normalizeSearch(value: string | null | undefined): string {
    return (value ?? '').trim().toLowerCase()
}

export function sessionMatchesQuery(session: SessionSummary, query: string, machineLabel: string): boolean {
    if (!query) return true
    const searchable = [
        getSessionTitle(session),
        session.id,
        session.metadata?.path,
        session.metadata?.worktree?.basePath,
        session.metadata?.name,
        session.metadata?.summary?.text,
        machineLabel,
    ]
        .filter((part): part is string => typeof part === 'string' && part.length > 0)
        .join('\n')
        .toLowerCase()
    return searchable.includes(query)
}

export function useSessionListSearch() {
    const [searchQuery, setSearchQuery] = useState('')
    const normalizedQuery = useMemo(() => normalizeSearch(searchQuery), [searchQuery])
    const isSearching = normalizedQuery.length > 0
    return { searchQuery, setSearchQuery, normalizedQuery, isSearching }
}
