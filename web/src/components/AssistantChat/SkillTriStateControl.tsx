import type { SkillPolicyState } from '@hapi/protocol/types'
import { useTranslation } from '@/lib/use-translation'

const SEGMENTS: SkillPolicyState[] = ['inherited', 'enabled', 'disabled']

export interface SkillTriStateControlProps {
    name: string
    value: SkillPolicyState
    disabled?: boolean
    onChange: (state: SkillPolicyState) => void
}

export function SkillTriStateControl(props: SkillTriStateControlProps) {
    const { t } = useTranslation()
    const labelFor = (state: SkillPolicyState) => {
        if (state === 'inherited') return t('session.skills.triState.inherited')
        if (state === 'enabled') return t('session.skills.triState.enabled')
        return t('session.skills.triState.disabled')
    }

    return (
        <div
            role="radiogroup"
            aria-label={props.name}
            className="flex overflow-hidden rounded-lg border border-[var(--app-border)]"
        >
            {SEGMENTS.map((state) => {
                const selected = props.value === state
                return (
                    <button
                        key={state}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        disabled={props.disabled}
                        onClick={() => props.onChange(state)}
                        className={`min-h-8 flex-1 px-2 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                            selected
                                ? 'border-[var(--app-link)] text-[var(--app-link)]'
                                : 'text-[var(--app-hint)]'
                        }`}
                    >
                        {labelFor(state)}
                    </button>
                )
            })}
        </div>
    )
}
