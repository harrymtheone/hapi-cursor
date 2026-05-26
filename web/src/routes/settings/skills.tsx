import { useMemo } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAppContext } from '@/lib/app-context'
import { useTranslation } from '@/lib/use-translation'
import { useAppGoBack } from '@/hooks/useAppGoBack'
import { useSessions } from '@/hooks/queries/useSessions'
import { useSkills } from '@/hooks/queries/useSkills'
import { queryKeys } from '@/lib/query-keys'
import { sortSkills } from '@/components/AssistantChat/skillPolicyUtils'
import { pickSkillsCatalogSessionId } from '@/routes/settings/skillsSession'
import { BackIcon } from './_sections/_icons'

export default function SkillsSettingsPage() {
    const { t } = useTranslation()
    const goBack = useAppGoBack()
    const queryClient = useQueryClient()
    const { api } = useAppContext()
    const { sessions } = useSessions(api)
    const sessionId = useMemo(() => pickSkillsCatalogSessionId(sessions), [sessions])
    const { skills, isLoading, error } = useSkills(api, sessionId)

    const sortedSkills = useMemo(() => sortSkills(skills), [skills])

    const handleRetry = () => {
        if (!sessionId) return
        void queryClient.invalidateQueries({ queryKey: queryKeys.skills(sessionId) })
    }

    return (
        <div className="flex h-full min-h-0 flex-col">
            <div className="bg-[var(--app-bg)] pt-[env(safe-area-inset-top)]">
                <div className="mx-auto flex w-full max-w-content items-center gap-2 border-b border-[var(--app-border)] p-3">
                    <button
                        type="button"
                        onClick={goBack}
                        className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--app-hint)] transition-colors hover:bg-[var(--app-secondary-bg)] hover:text-[var(--app-fg)]"
                    >
                        <BackIcon />
                    </button>
                    <div className="flex-1 font-semibold">{t('settings.skills.title')}</div>
                </div>
            </div>

            <div className="app-scroll-y min-h-0 flex-1">
                <div className="mx-auto w-full max-w-content">
                    <p className="px-3 py-3 text-xs text-[var(--app-hint)]">
                        {t('settings.skills.catalog.callout')}
                    </p>
                    {sessionId ? (
                        <p className="px-3 pb-2 text-xs text-[var(--app-hint)]">
                            {t('settings.skills.catalog.sessionNote')}
                        </p>
                    ) : null}

                    {!sessionId ? (
                        <p className="px-3 py-6 text-center text-sm text-[var(--app-hint)]">
                            {t('settings.skills.catalog.emptyTitle')}
                        </p>
                    ) : null}

                    {sessionId && isLoading ? (
                        <p className="px-3 py-6 text-center text-sm text-[var(--app-hint)]">
                            {t('settings.skills.catalog.loading')}
                        </p>
                    ) : null}

                    {sessionId && !isLoading && error ? (
                        <div className="px-3 py-6 text-center">
                            <p className="text-sm font-semibold text-[var(--app-fg)]">
                                {t('settings.skills.catalog.error')}
                            </p>
                            <p className="mt-1 text-xs text-[var(--app-hint)]">
                                {t('settings.skills.catalog.errorBody')}
                            </p>
                            <button
                                type="button"
                                className="mt-3 text-sm font-medium text-[var(--app-link)]"
                                onClick={handleRetry}
                            >
                                {t('settings.skills.catalog.retry')}
                            </button>
                        </div>
                    ) : null}

                    {sessionId && !isLoading && !error && sortedSkills.length === 0 ? (
                        <div className="px-3 py-8 text-center">
                            <p className="text-sm font-semibold text-[var(--app-fg)]">
                                {t('settings.skills.catalog.emptyTitle')}
                            </p>
                            <p className="mt-1 text-xs text-[var(--app-hint)]">
                                {t('settings.skills.catalog.emptyBody')}
                            </p>
                        </div>
                    ) : null}

                    {sessionId && !isLoading && !error && sortedSkills.length > 0 ? (
                        <div className="divide-y divide-[var(--app-divider)] border-t border-[var(--app-divider)]">
                            {sortedSkills.map((skill) => (
                                <div
                                    key={skill.name}
                                    className={`px-3 py-3 ${!skill.valid ? 'bg-[var(--app-subtle-bg)]' : ''}`}
                                >
                                    <p className="truncate text-sm font-semibold text-[var(--app-fg)]">{skill.name}</p>
                                    {skill.description ? (
                                        <p className="mt-0.5 line-clamp-2 text-xs text-[var(--app-hint)]">
                                            {skill.description}
                                        </p>
                                    ) : null}
                                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[var(--app-hint)]">
                                        <span className="rounded-full border border-[var(--app-border)] px-1.5 py-0.5">
                                            {t(`settings.skills.catalog.source.${skill.source}`)}
                                        </span>
                                        {skill.invocationMode ? (
                                            <span>
                                                {t('settings.skills.catalog.invocationMode', {
                                                    mode: skill.invocationMode,
                                                })}
                                            </span>
                                        ) : null}
                                        {skill.pathHint ? <span className="truncate">{skill.pathHint}</span> : null}
                                    </div>
                                    {!skill.valid && skill.invalidReason ? (
                                        <p className="mt-1 text-xs text-[var(--app-badge-error-text)]">
                                            {skill.invalidReason}
                                        </p>
                                    ) : null}
                                </div>
                            ))}
                        </div>
                    ) : null}

                    <p className="px-3 py-6 text-xs text-[var(--app-hint)]">
                        {t('settings.skills.catalog.footerNote')}
                    </p>
                </div>
            </div>
        </div>
    )
}
