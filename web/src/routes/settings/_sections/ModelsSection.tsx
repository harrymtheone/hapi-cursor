import { useNavigate } from '@tanstack/react-router'
import { useTranslation } from '@/lib/use-translation'
import { useVisibleModelFamilies } from '@/hooks/useVisibleModelFamilies'
import { ChevronRightIcon } from './_icons'

export function ModelsSection() {
    const { t } = useTranslation()
    const navigate = useNavigate()
    const { visibleKeys, isConfigured } = useVisibleModelFamilies()

    const summaryKind =
        !isConfigured || visibleKeys === null
            ? 'all'
            : visibleKeys.length === 0
                ? 'none'
                : 'count'
    const subtitle =
        summaryKind === 'all'
            ? t('settings.models.summary.all')
            : summaryKind === 'none'
                ? t('settings.models.summary.none')
                : t('settings.models.summary.count', { count: visibleKeys?.length ?? 0 })

    return (
        <div className="border-b border-[var(--app-divider)]">
            <div className="px-3 py-2 text-xs font-semibold text-[var(--app-hint)] uppercase tracking-wide">
                {t('settings.models.sectionTitle')}
            </div>
            <button
                type="button"
                onClick={() => navigate({ to: '/settings/models' })}
                className="flex w-full items-center justify-between px-3 py-3 text-left transition-colors hover:bg-[var(--app-subtle-bg)]"
            >
                <span className="text-[var(--app-fg)]">{t('settings.models.rowTitle')}</span>
                <span className="flex items-center gap-1 text-[var(--app-hint)]">
                    <span className="text-sm">{subtitle}</span>
                    <ChevronRightIcon />
                </span>
            </button>
        </div>
    )
}
