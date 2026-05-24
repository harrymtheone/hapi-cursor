import type { CursorModelDiscoveryResult } from '@hapi/protocol/types'
import { useTranslation } from '@/lib/use-translation'

type RuntimeConfigFailureReason = Extract<CursorModelDiscoveryResult, { status: 'error' }>['reason']

export const DISCOVERY_REASON_KEYS: Record<RuntimeConfigFailureReason, string> = {
    'cursor-cli-unavailable': 'newSession.model.discovery.reason.cursorCliUnavailable',
    'not-authenticated': 'newSession.model.discovery.reason.notAuthenticated',
    'timed-out': 'newSession.model.discovery.reason.timedOut',
    'empty-model-list': 'newSession.model.discovery.reason.emptyModelList',
    unknown: 'newSession.model.discovery.reason.unknown',
}

export function CursorModelDiscoveryStatus(props: {
    isLoading?: boolean
    discoveryResult?: CursorModelDiscoveryResult | null
    discoveryError?: Error | null
    onRetryDiscovery?: () => void
}) {
    const { t } = useTranslation()
    const discoveryReason = props.discoveryResult?.status === 'error'
        ? props.discoveryResult.reason
        : props.discoveryError
            ? 'unknown'
            : null
    const hasDiscoveryError = Boolean(discoveryReason)
    const hasEmptyDiscovery =
        props.discoveryResult?.status === 'ok' && props.discoveryResult.models.length === 0
    const discoveryReasonText = discoveryReason
        ? t(DISCOVERY_REASON_KEYS[discoveryReason])
        : null

    return (
        <div className="flex flex-col gap-2 px-3 py-2">
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
                    {discoveryReasonText ? <div>{discoveryReasonText}</div> : null}
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
        </div>
    )
}
