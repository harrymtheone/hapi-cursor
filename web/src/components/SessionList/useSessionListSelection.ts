import { useEffect, useState } from 'react'
import type { SessionSummary } from '@/types/api'
import { UNKNOWN_MACHINE_ID, type MachineGroup, type SessionGroup } from './useSessionListData'

export function expandSelectedSessionCollapseOverrides(
    overrides: Map<string, boolean>,
    group: { key: string; machineId: string | null }
): Map<string, boolean> {
    const next = new Map(overrides)
    let changed = false

    // Expand project group if collapsed. Project and machine keys use true = collapsed.
    if (overrides.has(group.key) && overrides.get(group.key)) {
        next.delete(group.key)
        changed = true
    }

    // Session preview keys use inverted semantics: false = expanded, true/missing = collapsed.
    const sessionPreviewKey = `sessions::${group.key}`
    if (overrides.get(sessionPreviewKey) !== false) {
        next.set(sessionPreviewKey, false)
        changed = true
    }

    const machineKey = `machine::${group.machineId ?? UNKNOWN_MACHINE_ID}`
    if (overrides.has(machineKey) && overrides.get(machineKey)) {
        next.delete(machineKey)
        changed = true
    }

    return changed ? next : overrides
}

export function useSessionListSelection(args: {
    allGroups: SessionGroup[]
    selectedSessionId: string | null | undefined
    isSearching: boolean
    sessionPreviewLimit: number
}) {
    const { allGroups, selectedSessionId, isSearching, sessionPreviewLimit } = args
    const [collapseOverrides, setCollapseOverrides] = useState<Map<string, boolean>>(() => new Map())

    const isGroupCollapsed = (group: SessionGroup): boolean => {
        if (isSearching) return false
        const override = collapseOverrides.get(group.key)
        if (override !== undefined) return override
        const hasSelectedSession = selectedSessionId
            ? group.sessions.some(session => session.id === selectedSessionId)
            : false
        return !group.hasActiveSession && !hasSelectedSession
    }

    const toggleGroup = (groupKey: string, isCollapsed: boolean) => {
        setCollapseOverrides(prev => {
            const next = new Map(prev)
            next.set(groupKey, !isCollapsed)
            return next
        })
    }

    const isSessionGroupExpanded = (group: SessionGroup): boolean => {
        if (isSearching || group.sessions.length <= sessionPreviewLimit) return true
        const key = `sessions::${group.key}`
        const override = collapseOverrides.get(key)
        if (override !== undefined) return !override
        return false
    }

    const toggleSessionGroup = (group: SessionGroup) => {
        const key = `sessions::${group.key}`
        const expanded = isSessionGroupExpanded(group)
        setCollapseOverrides(prev => {
            const next = new Map(prev)
            next.set(key, expanded)
            return next
        })
    }

    const isMachineCollapsed = (mg: MachineGroup): boolean => {
        if (isSearching) return false
        const key = `machine::${mg.machineId ?? UNKNOWN_MACHINE_ID}`
        const override = collapseOverrides.get(key)
        if (override !== undefined) return override
        const hasSelected = selectedSessionId
            ? mg.projectGroups.some(pg => pg.sessions.some(s => s.id === selectedSessionId))
            : false
        return !mg.hasActiveSession && !hasSelected
    }

    const toggleMachine = (mg: MachineGroup) => {
        const key = `machine::${mg.machineId ?? UNKNOWN_MACHINE_ID}`
        const current = isMachineCollapsed(mg)
        setCollapseOverrides(prev => {
            const next = new Map(prev)
            next.set(key, !current)
            return next
        })
    }

    // Auto-expand group (and machine) containing selected session
    useEffect(() => {
        if (!selectedSessionId) return
        setCollapseOverrides(prev => {
            const group = allGroups.find(g =>
                g.sessions.some((s: SessionSummary) => s.id === selectedSessionId)
            )
            if (!group) return prev
            return expandSelectedSessionCollapseOverrides(prev, group)
        })
    }, [selectedSessionId, allGroups])

    // Clean up stale collapse overrides
    useEffect(() => {
        setCollapseOverrides(prev => {
            if (prev.size === 0) return prev
            const next = new Map(prev)
            const knownKeys = new Set<string>()
            for (const g of allGroups) {
                knownKeys.add(g.key)
                knownKeys.add(`sessions::${g.key}`)
                knownKeys.add(`machine::${g.machineId ?? UNKNOWN_MACHINE_ID}`)
            }
            let changed = false
            for (const key of next.keys()) {
                if (!knownKeys.has(key)) {
                    next.delete(key)
                    changed = true
                }
            }
            return changed ? next : prev
        })
    }, [allGroups])

    return {
        isGroupCollapsed,
        toggleGroup,
        isSessionGroupExpanded,
        toggleSessionGroup,
        isMachineCollapsed,
        toggleMachine,
    }
}
