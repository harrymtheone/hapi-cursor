import { useCallback, useEffect, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { ApiClient } from '@/api/client'
import { useSkills } from '@/hooks/queries/useSkills'
import { queryKeys } from '@/lib/query-keys'
import { useTranslation } from '@/lib/use-translation'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { SessionSkillsRow } from './SessionSkillsRow'
import { sortSkills } from './skillPolicyUtils'

export interface SkillsPolicySheetProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    api: ApiClient | null
    sessionId: string
}

export function SkillsPolicySheet(props: SkillsPolicySheetProps) {
    const { t } = useTranslation()
    const queryClient = useQueryClient()
    const { skills, isLoading, error, refetch } = useSkills(props.api, props.sessionId)
    const [searchQuery, setSearchQuery] = useState('')

    useEffect(() => {
        if (props.open) {
            void refetch()
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

    return (
        <Dialog open={props.open} onOpenChange={props.onOpenChange}>
            <DialogContent
                className="fixed bottom-0 left-1/2 top-auto z-50 max-h-[min(75vh,560px)] w-[min(calc(100vw-2rem),18rem)] max-w-none -translate-x-1/2 translate-y-0 rounded-t-2xl rounded-b-none p-0"
                style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
            >
                <div className="flex max-h-[min(75vh,560px)] flex-col">
                    <DialogHeader className="shrink-0 space-y-1 border-b border-[var(--app-divider)] px-3 py-2 text-left">
                        <div className="flex items-center justify-between gap-2">
                            <DialogTitle className="text-sm font-semibold">
                                {t('session.skills.title')}
                                {!isLoading && !error ? (
                                    <span className="ml-1.5 text-xs font-normal text-[var(--app-hint)]">
                                        {sortedSkills.length}
                                    </span>
                                ) : null}
                            </DialogTitle>
                            <button
                                type="button"
                                className="text-xs font-medium text-[var(--app-link)]"
                                onClick={() => props.onOpenChange(false)}
                            >
                                {t('session.skills.done')}
                            </button>
                        </div>
                    </DialogHeader>

                    <div className="min-h-0 flex-1 overflow-y-auto px-3">
                        {showSearch ? (
                            <div className="sticky top-0 z-10 bg-[var(--app-dialog-bg)] pb-2 pt-2">
                                <input
                                    type="search"
                                    value={searchQuery}
                                    onChange={(event) => setSearchQuery(event.target.value)}
                                    placeholder={t('session.skills.searchPlaceholder')}
                                    className="w-full rounded-lg border border-[var(--app-divider)] bg-[var(--app-bg)] px-2.5 py-1.5 text-xs text-[var(--app-fg)] focus:outline-none focus:ring-2 focus:ring-[var(--app-link)]"
                                />
                            </div>
                        ) : null}

                        {isLoading ? (
                            <p className="py-6 text-center text-sm text-[var(--app-hint)]">
                                {t('session.skills.loading')}
                            </p>
                        ) : null}

                        {!isLoading && error ? (
                            <div className="py-6 text-center">
                                <p className="text-sm font-semibold text-[var(--app-fg)]">{t('session.skills.error')}</p>
                                <p className="mt-1 text-xs text-[var(--app-hint)]">{t('session.skills.errorBody')}</p>
                                <button
                                    type="button"
                                    className="mt-3 text-sm font-medium text-[var(--app-link)]"
                                    onClick={handleRetry}
                                >
                                    {t('session.skills.retry')}
                                </button>
                            </div>
                        ) : null}

                        {!isLoading && !error && filteredSkills.length === 0 ? (
                            <div className="py-8 text-center">
                                <p className="text-sm font-semibold text-[var(--app-fg)]">{t('session.skills.emptyTitle')}</p>
                                <p className="mt-1 text-xs text-[var(--app-hint)]">{t('session.skills.emptyBody')}</p>
                            </div>
                        ) : null}

                        {!isLoading && !error && filteredSkills.length > 0 ? (
                            <div className="flex flex-wrap gap-1.5 py-2">
                                {filteredSkills.map((skill) => (
                                    <SessionSkillsRow key={skill.name} skill={skill} />
                                ))}
                            </div>
                        ) : null}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
