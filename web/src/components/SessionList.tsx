import type { SessionSummary } from '@/types/api'
import type { ApiClient } from '@/api/client'
import { cn } from '@/lib/utils'
import { useTranslation } from '@/lib/use-translation'
import { useSessionPreviewLimit } from '@/hooks/useSessionPreviewLimit'
import { SessionListEmpty } from './SessionList/SessionListEmpty'
import { SessionListSearch } from './SessionList/SessionListSearch'
import { SessionListHeader } from './SessionList/SessionListHeader'
import { SessionListItem } from './SessionList/SessionListItem'
import {
    ChevronIcon,
    CopyPathButton,
    MachineIcon,
    PlusIconSmall,
} from './SessionList/SessionListIcons'
import {
    UNKNOWN_MACHINE_ID,
    useSessionListData,
    getVisibleSessionPreview,
    type SessionGroup,
} from './SessionList/useSessionListData'
import { useSessionListSearch } from './SessionList/useSessionListSearch'
import { useSessionListSelection } from './SessionList/useSessionListSelection'
import { useSessionListKeyboard } from './SessionList/useSessionListKeyboard'

// Re-exports preserving the SessionList.tsx public surface used by router + tests.
export {
    GROUP_SESSION_PREVIEW_LIMIT,
    deduplicateSessionsByAgentId,
} from './SessionList/useSessionListData'
export { UNKNOWN_MACHINE_ID, getVisibleSessionPreview }
export { normalizeSearch, sessionMatchesQuery } from './SessionList/useSessionListSearch'
export { expandSelectedSessionCollapseOverrides } from './SessionList/useSessionListSelection'
export { getSessionTitle } from './SessionList/SessionListItem'

export function SessionList(props: {
    sessions: SessionSummary[]
    onSelect: (sessionId: string) => void
    onNewSession: () => void
    onNewSessionInDirectory?: (args: { machineId: string | null; directory: string }) => void
    onBrowse?: () => void
    onRefresh: () => void
    isLoading: boolean
    renderHeader?: boolean
    api: ApiClient | null
    machineLabelsById?: Record<string, string>
    selectedSessionId?: string | null
}) {
    const { t } = useTranslation()
    const { renderHeader = true, api, selectedSessionId, machineLabelsById = {}, onNewSessionInDirectory } = props
    const { sessionPreviewLimit } = useSessionPreviewLimit()

    const resolveMachineLabel = (machineId: string | null): string => {
        if (machineId && machineLabelsById[machineId]) {
            return machineLabelsById[machineId]
        }
        if (machineId) {
            return machineId.slice(0, 8)
        }
        return t('machine.unknown')
    }

    const { searchQuery, setSearchQuery, normalizedQuery, isSearching } = useSessionListSearch()
    const { visibleSessions, allGroups, machineGroups } = useSessionListData({
        sessions: props.sessions,
        isSearching,
        normalizedQuery,
        resolveMachineLabel,
    })
    const {
        isGroupCollapsed,
        toggleGroup,
        isSessionGroupExpanded,
        toggleSessionGroup,
        isMachineCollapsed,
        toggleMachine,
    } = useSessionListSelection({
        allGroups,
        selectedSessionId,
        isSearching,
        sessionPreviewLimit,
    })
    useSessionListKeyboard()

    const getVisibleGroupSessions = (group: SessionGroup): SessionSummary[] => {
        return getVisibleSessionPreview(
            group.sessions,
            {
                expanded: isSessionGroupExpanded(group),
                selectedSessionId,
                limit: sessionPreviewLimit
            }
        )
    }

    return (
        <div className="mx-auto w-full max-w-content flex flex-col">
            {renderHeader ? (
                <SessionListHeader
                    isSearching={isSearching}
                    visibleSessionCount={visibleSessions.length}
                    totalSessionCount={props.sessions.length}
                    groupCount={allGroups.length}
                    onNewSession={props.onNewSession}
                />
            ) : null}

            {props.sessions.length > 0 ? (
                <SessionListSearch value={searchQuery} onChange={setSearchQuery} />
            ) : null}

            {props.sessions.length === 0 && (
                <SessionListEmpty
                    onNewSession={props.onNewSession}
                    onBrowse={props.onBrowse}
                />
            )}

            {props.sessions.length > 0 && isSearching && visibleSessions.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-[var(--app-hint)]">
                    {t('sessions.search.noResults')}
                </div>
            ) : null}

            <div className="flex flex-col gap-3 px-2 pt-1 pb-2">
                {machineGroups.map((mg) => {
                    const machineCollapsed = isMachineCollapsed(mg)
                    return (
                        <div key={mg.machineId ?? UNKNOWN_MACHINE_ID}>
                            {/* Level 1: Machine */}
                            <button
                                type="button"
                                onClick={() => toggleMachine(mg)}
                                className="flex w-full items-center gap-2 px-1 py-1.5 text-left rounded-lg transition-colors hover:bg-[var(--app-subtle-bg)] select-none"
                            >
                                <ChevronIcon className="h-4 w-4 text-[var(--app-hint)] shrink-0" collapsed={machineCollapsed} />
                                <MachineIcon className="h-4 w-4 text-[var(--app-hint)] shrink-0" />
                                <span className="text-sm font-semibold truncate flex-1">{mg.label}</span>
                                <span className="text-[11px] tabular-nums text-[var(--app-hint)] shrink-0">({mg.totalSessions})</span>
                            </button>

                            {/* Level 2: Projects */}
                            <div className="collapsible-panel" data-open={!machineCollapsed || undefined}>
                                <div className="collapsible-inner">
                                <div className="flex flex-col ml-3.5 pl-1 mt-0.5">
                                    {mg.projectGroups.map((group) => {
                                        const isCollapsed = isGroupCollapsed(group)
                                        const visibleGroupSessions = getVisibleGroupSessions(group)
                                        const hiddenSessionCount = group.sessions.length - visibleGroupSessions.length
                                        const sessionGroupExpanded = isSessionGroupExpanded(group)
                                        const canStartInGroupDirectory = group.directory !== 'Other'
                                        return (
                                            <div key={group.key}>
                                                <div
                                                    className="group/project sticky top-0 z-10 flex items-center gap-2 px-1 py-1.5 text-left rounded-lg transition-colors hover:bg-[var(--app-subtle-bg)] cursor-pointer min-w-0 w-full select-none"
                                                    onClick={() => toggleGroup(group.key, isCollapsed)}
                                                    title={group.directory}
                                                >
                                                    <ChevronIcon className="h-3.5 w-3.5 text-[var(--app-hint)] shrink-0" collapsed={isCollapsed} />
                                                    <span className="font-medium text-sm truncate flex-1">
                                                        {group.displayName}
                                                    </span>
                                                    <CopyPathButton path={group.directory} className="opacity-0 group-hover/project:opacity-100 transition-opacity duration-150" />
                                                    {onNewSessionInDirectory && canStartInGroupDirectory ? (
                                                        <button
                                                            type="button"
                                                            onClick={(event) => {
                                                                event.stopPropagation()
                                                                onNewSessionInDirectory({
                                                                    machineId: group.machineId,
                                                                    directory: group.directory
                                                                })
                                                            }}
                                                            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[var(--app-hint)] opacity-70 transition-colors hover:bg-[var(--app-secondary-bg)] hover:text-[var(--app-link)] hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-link)]"
                                                            title={t('sessions.group.new')}
                                                            aria-label={t('sessions.group.new')}
                                                        >
                                                            <PlusIconSmall className="h-3.5 w-3.5" />
                                                        </button>
                                                    ) : null}
                                                    <span className="text-[11px] tabular-nums text-[var(--app-hint)] shrink-0">
                                                        ({group.sessions.length})
                                                    </span>
                                                </div>

                                                {/* Level 3: Sessions */}
                                                <div className="collapsible-panel" data-open={!isCollapsed || undefined}>
                                                    <div className="collapsible-inner">
                                                    <div className="flex flex-col gap-0.5 ml-3 pl-1 pr-1 py-1">
                                                        {visibleGroupSessions.map((s) => (
                                                            <SessionListItem
                                                                key={s.id}
                                                                session={s}
                                                                onSelect={props.onSelect}
                                                                showPath={false}
                                                                api={api}
                                                                selected={s.id === selectedSessionId}
                                                            />
                                                        ))}
                                                        {!isSearching && group.sessions.length > sessionPreviewLimit && (sessionGroupExpanded || hiddenSessionCount > 0) ? (
                                                            <button
                                                                type="button"
                                                                onClick={() => toggleSessionGroup(group)}
                                                                className={cn(
                                                                    'mx-2 my-1 rounded-md px-2 py-1 text-left text-xs text-[var(--app-hint)] transition-colors hover:bg-[var(--app-subtle-bg)] hover:text-[var(--app-fg)]',
                                                                    hiddenSessionCount > 0 && 'border border-dashed border-[var(--app-border)]'
                                                                )}
                                                            >
                                                                {sessionGroupExpanded
                                                                    ? t('sessions.group.showLess')
                                                                    : t('sessions.group.showMore', { n: hiddenSessionCount })}
                                                            </button>
                                                        ) : null}
                                                    </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                                </div>
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
