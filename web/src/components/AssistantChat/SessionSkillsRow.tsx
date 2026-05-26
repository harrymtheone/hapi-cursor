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

    return (
        <div
            className="flex min-h-[36px] items-center justify-between gap-2 py-1.5"
            data-testid={`session-skill-row-${skill.name}`}
            title={skill.description ?? undefined}
        >
            <span className="min-w-0 truncate text-sm font-medium text-[var(--app-fg)]">{skill.name}</span>
            <div className="flex shrink-0 items-center gap-1">
                {showScopePill ? (
                    <span className="rounded-full border border-[var(--app-border)] bg-[var(--app-subtle-bg)] px-1.5 py-0.5 text-[10px] font-normal uppercase tracking-wide text-[var(--app-hint)]">
                        {t(getSkillSourceLabelKey(skill.source, 'session'))}
                    </span>
                ) : null}
                {!skill.valid ? (
                    <span className="rounded-full border border-[var(--app-badge-error-border)] bg-[var(--app-badge-error-bg)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--app-badge-error-text)]">
                        {t('session.skills.invalidTag')}
                    </span>
                ) : null}
            </div>
        </div>
    )
}
