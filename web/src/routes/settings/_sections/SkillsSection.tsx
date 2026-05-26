import { useMemo } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useAppContext } from '@/lib/app-context'
import { useTranslation } from '@/lib/use-translation'
import { useSessions } from '@/hooks/queries/useSessions'
import { useSkills } from '@/hooks/queries/useSkills'
import { pickSkillsCatalogSessionId } from '@/routes/settings/skillsSession'
import { ChevronRightIcon } from './_icons'

export function SkillsSection() {
    const { t } = useTranslation()
    const navigate = useNavigate()
    const { api } = useAppContext()
    const { sessions } = useSessions(api)
    const sessionId = useMemo(() => pickSkillsCatalogSessionId(sessions), [sessions])
    const { skills, isLoading, error } = useSkills(api, sessionId)

    const subtitle = !sessionId
        ? t('settings.skills.summary.none')
        : error
            ? t('settings.skills.summary.error')
            : isLoading
                ? t('settings.skills.summary.loading')
                : skills.length === 0
                    ? t('settings.skills.summary.none')
                    : t('settings.skills.summary.count', { count: skills.length })

    return (
        <div className="border-b border-[var(--app-divider)]">
            <div className="px-3 py-2 text-xs font-semibold text-[var(--app-hint)] uppercase tracking-wide">
                {t('settings.skills.sectionTitle')}
            </div>
            <button
                type="button"
                onClick={() => navigate({ to: '/settings/skills' })}
                className="flex w-full items-center justify-between px-3 py-3 text-left transition-colors hover:bg-[var(--app-subtle-bg)]"
            >
                <span className="text-[var(--app-fg)]">{t('settings.skills.rowTitle')}</span>
                <span className="flex items-center gap-1 text-[var(--app-hint)]">
                    <span className="text-sm">{subtitle}</span>
                    <ChevronRightIcon />
                </span>
            </button>
        </div>
    )
}
