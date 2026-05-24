import { useCallback, useEffect, useState } from 'react'

export const VISIBLE_FAMILIES_STORAGE_KEY = 'hapi-visible-model-families'
export const VISIBLE_FAMILIES_CONFIGURED_KEY = 'hapi-visible-model-families-configured'

export type VisibilitySummaryKind = 'all' | 'count' | 'none'

type VisibleFamiliesState = {
    visibleKeys: string[] | null
    isConfigured: boolean
}

function isBrowser(): boolean {
    return typeof window !== 'undefined' && typeof document !== 'undefined'
}

function safeGetItem(key: string): string | null {
    if (!isBrowser()) {
        return null
    }
    try {
        return localStorage.getItem(key)
    } catch {
        return null
    }
}

function safeSetItem(key: string, value: string): void {
    if (!isBrowser()) {
        return
    }
    try {
        localStorage.setItem(key, value)
    } catch {
        // Ignore storage errors
    }
}

function safeRemoveItem(key: string): void {
    if (!isBrowser()) {
        return
    }
    try {
        localStorage.removeItem(key)
    } catch {
        // Ignore storage errors
    }
}

function parseVisibleFamilyKeys(raw: string | null): string[] | null {
    if (raw === null) {
        return null
    }
    try {
        const parsed: unknown = JSON.parse(raw)
        if (!Array.isArray(parsed)) {
            return null
        }
        const keys = parsed.filter((item): item is string => typeof item === 'string')
        if (keys.length !== parsed.length) {
            return null
        }
        return keys.filter((key) => key !== 'auto')
    } catch {
        return null
    }
}

function readVisibleFamiliesState(): VisibleFamiliesState {
    const configuredRaw = safeGetItem(VISIBLE_FAMILIES_CONFIGURED_KEY)
    const isConfigured = configuredRaw === 'true'
    const keysRaw = safeGetItem(VISIBLE_FAMILIES_STORAGE_KEY)

    if (!isConfigured) {
        return { visibleKeys: null, isConfigured: false }
    }

    const parsed = parseVisibleFamilyKeys(keysRaw)
    if (parsed === null) {
        return { visibleKeys: [], isConfigured: true }
    }

    return { visibleKeys: parsed, isConfigured: true }
}

export function useVisibleModelFamilies(): {
    visibleKeys: string[] | null
    isConfigured: boolean
    isFamilyVisible: (familyKey: string) => boolean
    setVisibleFamilies: (keys: string[]) => void
    clearFilter: () => void
    summaryLabel: (totalFamilies: number, visibleCount: number) => VisibilitySummaryKind
} {
    const [state, setState] = useState<VisibleFamiliesState>(readVisibleFamiliesState)

    const refreshFromStorage = useCallback(() => {
        setState(readVisibleFamiliesState())
    }, [])

    useEffect(() => {
        if (!isBrowser()) {
            return
        }

        const onStorage = (event: StorageEvent) => {
            if (
                event.key !== VISIBLE_FAMILIES_STORAGE_KEY &&
                event.key !== VISIBLE_FAMILIES_CONFIGURED_KEY
            ) {
                return
            }
            refreshFromStorage()
        }

        window.addEventListener('storage', onStorage)
        return () => window.removeEventListener('storage', onStorage)
    }, [refreshFromStorage])

    const isFamilyVisible = useCallback(
        (familyKey: string) => {
            if (state.visibleKeys === null) {
                return true
            }
            return state.visibleKeys.includes(familyKey)
        },
        [state.visibleKeys]
    )

    const setVisibleFamilies = useCallback(
        (keys: string[]) => {
            const filtered = keys.filter((key) => key !== 'auto')
            safeSetItem(VISIBLE_FAMILIES_CONFIGURED_KEY, 'true')
            safeSetItem(VISIBLE_FAMILIES_STORAGE_KEY, JSON.stringify(filtered))
            setState({ visibleKeys: filtered, isConfigured: true })
        },
        []
    )

    const clearFilter = useCallback(() => {
        safeRemoveItem(VISIBLE_FAMILIES_STORAGE_KEY)
        safeRemoveItem(VISIBLE_FAMILIES_CONFIGURED_KEY)
        setState({ visibleKeys: null, isConfigured: false })
    }, [])

    const summaryLabel = useCallback(
        (totalFamilies: number, visibleCount: number): VisibilitySummaryKind => {
            if (!state.isConfigured || state.visibleKeys === null) {
                return 'all'
            }
            if (visibleCount === 0) {
                return 'none'
            }
            if (visibleCount < totalFamilies) {
                return 'count'
            }
            return 'all'
        },
        [state.isConfigured, state.visibleKeys]
    )

    return {
        visibleKeys: state.visibleKeys,
        isConfigured: state.isConfigured,
        isFamilyVisible,
        setVisibleFamilies,
        clearFilter,
        summaryLabel,
    }
}
