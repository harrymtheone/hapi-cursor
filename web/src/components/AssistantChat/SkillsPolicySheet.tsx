import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import type { SkillPolicyState } from '@hapi/protocol/types'
import type { ApiClient } from '@/api/client'
import { useSkills } from '@/hooks/queries/useSkills'
import { queryKeys } from '@/lib/query-keys'
import { useTranslation } from '@/lib/use-translation'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { SkillPolicyRow } from './SkillPolicyRow'
import { getSkillPolicyState, sortSkills } from './skillPolicyUtils'

export interface SkillsPolicySheetProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    api: ApiClient | null
    sessionId: string
    skillPolicy: Record<string, SkillPolicyState> | undefined
    controlsDisabled?: boolean
    onSetSkillPolicy: (name: string, state: SkillPolicyState) => Promise<void>
    onResetSkillPolicy: () => Promise<void>
}

export function SkillsPolicySheet(props: SkillsPolicySheetProps) {
    const { t } = useTranslation()
    const navigate = useNavigate()
    const queryClient = useQueryClient()
    const { skills, isLoading, error } = useSkills(props.api, props.sessionId, props.skillPolicy)
    const [searchQuery, setSearchQuery] = useState('')
    const [optimisticPolicy, setOptimisticPolicy] = useState(props.skillPolicy)
    const [pendingSkill, setPendingSkill] = useState<string | null>(null)
    const [isResetting, setIsResetting] = useState(false)

    useEffect(() => {
        setOptimisticPolicy(props.skillPolicy)
    }, [props.skillPolicy])

    const sortedSkills = useMemo(() => sortSkills(skills), [skills])
    const filteredSkills = useMemo(() => {
        const query = searchQuery.trim().toLowerCase()
        if (!query) {
            return sortedSkills
        }
        return sortedSkills.filter((skill) =>
            skill.name.toLowerCase().includes(query)
            || (skill.description?.toLowerCase().includes(query) ?? false)
        )
    }, [searchQuery, sortedSkills])

    const showSearch = sortedSkills.length > 8

    const handlePolicyChange = useCallback(async (name: string, state: SkillPolicyState) => {
        setOptimisticPolicy((current) => {
            const next = { ...(current ?? {}) }
            if (state === 'inherited') {
                delete next[name]
            } else {
                next[name] = state
            }
            return Object.keys(next).length > 0 ? next : undefined
        })
        setPendingSkill(name)
        try {
            await props.onSetSkillPolicy(name, state)
        } finally {
            setPendingSkill(null)
        }
    }, [props])

    const handleReset = useCallback(async () => {
        setIsResetting(true)
        setOptimisticPolicy(undefined)
        try {
            await props.onResetSkillPolicy()
        } finally {
            setIsResetting(false)
        }
    }, [props])

    const handleRetry = useCallback(() => {
        void queryClient.invalidateQueries({ queryKey: queryKeys.skills(props.sessionId) })
    }, [props.sessionId, queryClient])

    return (
        <Dialog open={props.open} onOpenChange={props.onOpenChange}>
            <DialogContent
                className="fixed inset-x-0 bottom-0 top-auto max-h-[min(85vh,640px)] w-full max-w-none translate-x-0 translate-y-0 rounded-t-2xl rounded-b-none p-0"
                style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
                aria-describedby="skills-policy-sheet-description"
            >
                <div className="flex max-h-[min(85vh,640px)] flex-col">
                    <DialogHeader className="shrink-0 space-y-2 border-b border-[var(--app-divider)] px-6 py-4 text-left">
                        <div className="flex items-center justify-between gap-2">
                            <DialogTitle className="text-base font-semibold">
                                {t('session.skills.sheetTitle')}
                            </DialogTitle>
                            <button
                                type="button"
                                className="text-sm font-medium text-[var(--app-link)]"
                                onClick={() => props.onOpenChange(false)}
                            >
                                {t('session.skills.done')}
                            </button>
                        </div>
                        <DialogDescription id="skills-policy-sheet-description" className="text-xs">
                            {t('session.skills.inheritedHelper')}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="min-h-0 flex-1 overflow-y-auto px-6">
                        {showSearch ? (
                            <div className="sticky top-0 z-10 bg-[var(--app-dialog-bg)] pb-2 pt-3">
                                <input
                                    type="search"
                                    value={searchQuery}
                                    onChange={(event) => setSearchQuery(event.target.value)}
                                    placeholder={t('session.skills.searchPlaceholder')}
                                    className="w-full rounded-lg border border-[var(--app-divider)] bg-[var(--app-bg)] px-3 py-2 text-sm text-[var(--app-fg)] focus:outline-none focus:ring-2 focus:ring-[var(--app-link)]"
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
                            <div className="divide-y divide-[var(--app-divider)]">
                                {filteredSkills.map((skill) => (
                                    <SkillPolicyRow
                                        key={skill.name}
                                        skill={skill}
                                        policyState={getSkillPolicyState(skill.name, optimisticPolicy)}
                                        pending={pendingSkill === skill.name}
                                        controlsDisabled={props.controlsDisabled || isResetting}
                                        onPolicyChange={(state) => handlePolicyChange(skill.name, state)}
                                    />
                                ))}
                            </div>
                        ) : null}
                    </div>

                    <div className="shrink-0 space-y-3 border-t border-[var(--app-divider)] px-6 py-4">
                        <button
                            type="button"
                            className="text-sm font-medium text-[var(--app-link)]"
                            onClick={() => {
                                props.onOpenChange(false)
                                navigate({ to: '/settings/skills' })
                            }}
                        >
                            {t('session.skills.browseCatalog')}
                        </button>
                        <button
                            type="button"
                            disabled={props.controlsDisabled || isResetting}
                            className="w-full text-sm font-semibold text-[var(--app-link)] disabled:opacity-50"
                            onClick={() => void handleReset()}
                        >
                            {t('session.skills.resetAll')}
                        </button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
