import {
    useCallback,
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
    type CSSProperties,
    type RefObject,
} from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { ApiClient } from '@/api/client'
import { useSkills } from '@/hooks/queries/useSkills'
import { queryKeys } from '@/lib/query-keys'
import { useTranslation } from '@/lib/use-translation'
import { SessionSkillsRow } from './SessionSkillsRow'
import { sortSkills } from './skillPolicyUtils'

export interface SkillsPolicySheetProps {
    open: boolean
    onClose: () => void
    anchorPoint: { x: number; y: number }
    anchorRef?: RefObject<HTMLElement | null>
    api: ApiClient | null
    sessionId: string
}

type PanelPosition = {
    top: number
    left: number
    transformOrigin: string
}

const PANEL_WIDTH_PX = 288 // 18rem

export function SkillsPolicySheet(props: SkillsPolicySheetProps) {
    const { t } = useTranslation()
    const queryClient = useQueryClient()
    const { skills, isLoading, error, refetch } = useSkills(props.api, props.sessionId)
    const [searchQuery, setSearchQuery] = useState('')
    const panelRef = useRef<HTMLDivElement | null>(null)
    const [panelPosition, setPanelPosition] = useState<PanelPosition | null>(null)

    useEffect(() => {
        if (props.open) {
            void refetch()
        } else {
            setSearchQuery('')
        }
    }, [props.open, refetch])

    const sortedSkills = useMemo(() => sortSkills(skills), [skills])
    const filteredSkills = useMemo(() => {
        const query = searchQuery.trim().toLowerCase()
        if (!query) {
            return sortedSkills
        }
        return sortedSkills.filter((skill) => skill.name.toLowerCase().includes(query))
    }, [searchQuery, sortedSkills])

    const showSearch = sortedSkills.length > 8

    const handleRetry = useCallback(() => {
        void queryClient.invalidateQueries({ queryKey: queryKeys.skills(props.sessionId) })
    }, [props.sessionId, queryClient])

    const updatePosition = useCallback(() => {
        const panelEl = panelRef.current
        if (!panelEl) return

        const panelRect = panelEl.getBoundingClientRect()
        const viewportWidth = window.innerWidth
        const viewportHeight = window.innerHeight
        const padding = 8
        const gap = 6

        const spaceBelow = viewportHeight - props.anchorPoint.y
        const spaceAbove = props.anchorPoint.y
        const openAbove = spaceBelow < panelRect.height + gap && spaceAbove > spaceBelow

        let top = openAbove
            ? props.anchorPoint.y - panelRect.height - gap
            : props.anchorPoint.y + gap
        let left = props.anchorPoint.x - PANEL_WIDTH_PX
        const transformOrigin = openAbove ? 'bottom right' : 'top right'

        top = Math.min(Math.max(top, padding), viewportHeight - panelRect.height - padding)
        left = Math.min(Math.max(left, padding), viewportWidth - panelRect.width - padding)

        setPanelPosition({ top, left, transformOrigin })
    }, [props.anchorPoint])

    useLayoutEffect(() => {
        if (!props.open) return
        updatePosition()
    }, [props.open, updatePosition, filteredSkills.length, isLoading, error])

    useEffect(() => {
        if (!props.open) {
            setPanelPosition(null)
            return
        }

        const handlePointerDown = (event: PointerEvent) => {
            const target = event.target as Node
            if (panelRef.current?.contains(target)) return
            if (props.anchorRef?.current?.contains(target)) return
            props.onClose()
        }

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                props.onClose()
            }
        }

        const handleReflow = () => {
            updatePosition()
        }

        document.addEventListener('pointerdown', handlePointerDown)
        document.addEventListener('keydown', handleKeyDown)
        window.addEventListener('resize', handleReflow)
        window.addEventListener('scroll', handleReflow, true)

        return () => {
            document.removeEventListener('pointerdown', handlePointerDown)
            document.removeEventListener('keydown', handleKeyDown)
            window.removeEventListener('resize', handleReflow)
            window.removeEventListener('scroll', handleReflow, true)
        }
    }, [props.open, props.onClose, props.anchorRef, updatePosition])

    if (!props.open) return null

    const panelStyle: CSSProperties | undefined = panelPosition
        ? {
            top: panelPosition.top,
            left: panelPosition.left,
            transformOrigin: panelPosition.transformOrigin,
            width: PANEL_WIDTH_PX,
        }
        : { width: PANEL_WIDTH_PX }

    return (
        <div
            ref={panelRef}
            role="region"
            aria-label={t('session.skills.title')}
            className="fixed z-50 max-h-[min(70vh,420px)] overflow-hidden rounded-lg border border-[var(--app-border)] bg-[var(--app-bg)] shadow-lg animate-menu-pop"
            style={panelStyle}
        >
            <div className="flex max-h-[min(70vh,420px)] flex-col">
                <div className="shrink-0 border-b border-[var(--app-divider)] px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-[var(--app-fg)]">
                            {t('session.skills.title')}
                            {!isLoading && !error ? (
                                <span className="ml-1.5 text-xs font-normal text-[var(--app-hint)]">
                                    {sortedSkills.length}
                                </span>
                            ) : null}
                        </span>
                    </div>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto px-3">
                    {showSearch ? (
                        <div className="sticky top-0 z-10 bg-[var(--app-bg)] pb-2 pt-2">
                            <input
                                type="search"
                                value={searchQuery}
                                onChange={(event) => setSearchQuery(event.target.value)}
                                placeholder={t('session.skills.searchPlaceholder')}
                                className="w-full rounded-md border border-[var(--app-divider)] bg-[var(--app-secondary-bg)] px-2.5 py-1.5 text-xs text-[var(--app-fg)] focus:outline-none focus:ring-2 focus:ring-[var(--app-link)]"
                            />
                        </div>
                    ) : null}

                    {isLoading ? (
                        <p className="py-4 text-center text-xs text-[var(--app-hint)]">
                            {t('session.skills.loading')}
                        </p>
                    ) : null}

                    {!isLoading && error ? (
                        <div className="py-4 text-center">
                            <p className="text-xs font-semibold text-[var(--app-fg)]">{t('session.skills.error')}</p>
                            <p className="mt-1 text-[10px] text-[var(--app-hint)]">{t('session.skills.errorBody')}</p>
                            <button
                                type="button"
                                className="mt-2 text-xs font-medium text-[var(--app-link)]"
                                onClick={handleRetry}
                            >
                                {t('session.skills.retry')}
                            </button>
                        </div>
                    ) : null}

                    {!isLoading && !error && filteredSkills.length === 0 ? (
                        <div className="py-4 text-center">
                            <p className="text-xs font-semibold text-[var(--app-fg)]">{t('session.skills.emptyTitle')}</p>
                            <p className="mt-1 text-[10px] text-[var(--app-hint)]">{t('session.skills.emptyBody')}</p>
                        </div>
                    ) : null}

                        {!isLoading && !error && filteredSkills.length > 0 ? (
                            <div className="divide-y divide-[var(--app-divider)] py-1">
                                {filteredSkills.map((skill) => (
                                    <SessionSkillsRow key={skill.name} skill={skill} />
                                ))}
                            </div>
                        ) : null}
                </div>
            </div>
        </div>
    )
}
