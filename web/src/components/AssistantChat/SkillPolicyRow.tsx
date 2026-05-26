import type { SkillPolicyState, SkillSummary } from '@hapi/protocol/types'
import { useTranslation } from '@/lib/use-translation'
import { EnforcementBadge } from './EnforcementBadge'
import { SkillTriStateControl } from './SkillTriStateControl'

export interface SkillPolicyRowProps {
    skill: SkillSummary
    policyState: SkillPolicyState
    pending?: boolean
    controlsDisabled?: boolean
    onPolicyChange: (state: SkillPolicyState) => void
}

export function SkillPolicyRow(props: SkillPolicyRowProps) {
    const { t } = useTranslation()
    const { skill } = props
    const policyDisabled = props.controlsDisabled || !skill.valid

    return (
        <div
            className={`flex min-h-[56px] flex-col gap-2 py-3 ${
                !skill.valid ? 'border-l-2 border-[var(--app-badge-error-border)] pl-3' : ''
            } ${props.pending ? 'opacity-60' : ''}`}
        >
            <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-sm font-semibold text-[var(--app-fg)]">{skill.name}</span>
                        <EnforcementBadge />
                    </div>
                    {skill.description ? (
                        <p className="mt-0.5 line-clamp-2 text-xs text-[var(--app-hint)]">{skill.description}</p>
                    ) : null}
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[var(--app-hint)]">
                        <span className="rounded-full border border-[var(--app-border)] px-1.5 py-0.5">
                            {t(`session.skills.source.${skill.source}`)}
                        </span>
                        {skill.invocationMode ? (
                            <span>{t('session.skills.invocationMode', { mode: skill.invocationMode })}</span>
                        ) : null}
                        {skill.pathHint ? <span className="truncate">{skill.pathHint}</span> : null}
                    </div>
                    {!skill.valid && skill.invalidReason ? (
                        <p className="mt-1 text-xs text-[var(--app-badge-error-text)]">{skill.invalidReason}</p>
                    ) : null}
                    {!skill.valid ? (
                        <p className="mt-1 text-xs text-[var(--app-hint)]">{t('session.skills.invalidPolicyHint')}</p>
                    ) : null}
                </div>
            </div>
            <SkillTriStateControl
                name={skill.name}
                value={props.policyState}
                disabled={policyDisabled}
                onChange={props.onPolicyChange}
            />
        </div>
    )
}
