import type { CursorModelDiscoveryResult, CursorModelSummary } from '@hapi/protocol/types'
import type { AgentType } from './types'
import { MODEL_OPTIONS } from './types'
import { useTranslation } from '@/lib/use-translation'

const AUTO_MODEL_VALUE = 'auto'
const MODEL_SELECT_ID = 'new-session-model'

type RuntimeConfigFailureReason = Extract<CursorModelDiscoveryResult, { status: 'error' }>['reason']

const DISCOVERY_REASON_KEYS: Record<RuntimeConfigFailureReason, string> = {
    'cursor-cli-unavailable': 'newSession.model.discovery.reason.cursorCliUnavailable',
    'not-authenticated': 'newSession.model.discovery.reason.notAuthenticated',
    'timed-out': 'newSession.model.discovery.reason.timedOut',
    'empty-model-list': 'newSession.model.discovery.reason.emptyModelList',
    unknown: 'newSession.model.discovery.reason.unknown'
}

function formatDiscoveredModelOption(model: CursorModelSummary): { value: string; label: string } {
    const secondaryLabel = model.label && model.label !== model.id ? ` - ${model.label}` : ''
    return {
        value: model.id,
        label: `${model.id}${secondaryLabel}`
    }
}

export function ModelSelector(props: {
    agent: AgentType
    model: string
    options?: Array<{ value: string; label: string }>
    isDisabled: boolean
    isLoading?: boolean
    error?: string | null
    discoveryResult?: CursorModelDiscoveryResult | null
    discoveryError?: Error | null
    onRetryDiscovery?: () => void
    onModelChange: (value: string) => void
}) {
    const { t } = useTranslation()
    const discoveredOptions = props.discoveryResult?.status === 'ok'
        ? props.discoveryResult.models.map(formatDiscoveredModelOption)
        : props.options ?? MODEL_OPTIONS[props.agent]
    const options = [
        { value: AUTO_MODEL_VALUE, label: t('newSession.model.autoUnspecified') },
        ...discoveredOptions
    ]
    const discoveryReason = props.discoveryResult?.status === 'error'
        ? props.discoveryResult.reason
        : props.discoveryError
            ? 'unknown'
            : null
    const hasDiscoveryError = Boolean(discoveryReason)
    const hasEmptyDiscovery = props.discoveryResult?.status === 'ok' && props.discoveryResult.models.length === 0
    const discoveryReasonText = discoveryReason
        ? t(DISCOVERY_REASON_KEYS[discoveryReason])
        : null

    return (
        <div className="flex flex-col gap-1.5 px-3 py-3">
            <label htmlFor={MODEL_SELECT_ID} className="text-xs font-medium text-[var(--app-hint)]">
                {t('newSession.model')}{' '}
                <span className="font-normal">({t('newSession.model.optional')})</span>
            </label>
            <select
                id={MODEL_SELECT_ID}
                value={props.model}
                onChange={(e) => props.onModelChange(e.target.value)}
                disabled={props.isDisabled || props.isLoading}
                className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--app-divider)] bg-[var(--app-bg)] text-[var(--app-text)] focus:outline-none focus:ring-2 focus:ring-[var(--app-link)] disabled:opacity-50"
            >
                {options.map((option) => (
                    <option key={option.value} value={option.value}>
                        {option.label}
                    </option>
                ))}
            </select>
            {props.isLoading ? (
                <div className="text-xs text-[var(--app-hint)]">
                    {t('newSession.model.discovery.loading')}
                </div>
            ) : null}
            {hasEmptyDiscovery ? (
                <div className="flex flex-col gap-1 text-xs text-[var(--app-hint)]">
                    <div className="font-semibold text-[var(--app-text)]">
                        {t('newSession.model.discovery.emptyTitle')}
                    </div>
                    <div>{t('newSession.model.discovery.emptyBody')}</div>
                    {props.onRetryDiscovery ? (
                        <button
                            type="button"
                            className="self-start text-[var(--app-link)]"
                            onClick={props.onRetryDiscovery}
                        >
                            {t('newSession.model.discovery.retry')}
                        </button>
                    ) : null}
                </div>
            ) : null}
            {hasDiscoveryError ? (
                <div className="flex flex-col gap-1 text-xs text-red-600">
                    <div>{t('newSession.model.discovery.error')}</div>
                    {discoveryReasonText ? (
                        <div>{discoveryReasonText}</div>
                    ) : null}
                    {props.onRetryDiscovery ? (
                        <button
                            type="button"
                            className="self-start text-[var(--app-link)]"
                            onClick={props.onRetryDiscovery}
                        >
                            {t('newSession.model.discovery.retry')}
                        </button>
                    ) : null}
                </div>
            ) : null}
            {props.error ? (
                <div className="text-xs text-red-600">
                    {props.error}
                </div>
            ) : null}
        </div>
    )
}
