import type { SkillSummary } from '@hapi/protocol/types'
import { useTranslation } from '@/lib/use-translation'
import { getSkillSourceLabelKey } from './skillPolicyUtils'

export interface SessionSkillsRowProps {
    skill: SkillSummary
}

export function SessionSkillsRow(props: SessionSkillsRowProps) {
    const { t } = useTranslation()
    const { skill } = props
    const showScopePill = skill.source === 'project' || skill.source === 'user'

    const invalid = !skill.valid
    return (
        <span
            className={
                'inline-flex max-w-full items-center gap-1 rounded-full border px-2 py-0.5 text-xs leading-5 ' +
                (invalid
                    ? 'border-[var(--app-badge-error-border)] bg-[var(--app-badge-error-bg)] text-[var(--app-badge-error-text)]'
                    : 'border-[var(--app-border)] bg-[var(--app-subtle-bg)] text-[var(--app-fg)]')
            }
            data-testid={`session-skill-row-${skill.name}`}
            title={skill.description ?? undefined}
        >
            <span className="min-w-0 truncate font-medium">{skill.name}</span>
            {showScopePill ? (
                <span className="shrink-0 text-[10px] uppercase tracking-wide text-[var(--app-hint)]">
                    {t(getSkillSourceLabelKey(skill.source, 'session'))}
                </span>
            ) : null}
            {invalid ? (
                <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide">
                    {t('session.skills.invalidTag')}
                </span>
            ) : null}
        </span>
    )
}
