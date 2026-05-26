import { useTranslation } from '@/lib/use-translation'

export interface EnforcementBadgeProps {
    /** Reserved for future verified Cursor enforcement (D-11). Never render Cursor copy in v1.1. */
    enforcement?: 'cursor'
}

export function EnforcementBadge(props: EnforcementBadgeProps) {
    const { t } = useTranslation()

    if (props.enforcement === 'cursor') {
        return (
            <span
                className="inline-flex shrink-0 items-center rounded-full border border-[var(--app-badge-success-border)] bg-[var(--app-badge-success-bg)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--app-badge-success-text)]"
                aria-label={t('session.skills.enforcement.cursor')}
            >
                {t('session.skills.enforcement.cursor')}
            </span>
        )
    }

    return (
        <span
            className="inline-flex shrink-0 items-center rounded-full border border-[var(--app-badge-warning-border)] bg-[var(--app-badge-warning-bg)] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--app-badge-warning-text)]"
            aria-label={t('session.skills.enforcement.hapi')}
        >
            {t('session.skills.enforcement.hapi')}
        </span>
    )
}
