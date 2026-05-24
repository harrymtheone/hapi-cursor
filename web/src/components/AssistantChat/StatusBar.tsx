import {
    getPermissionModeLabel,
    getPermissionModeTone,
    isPermissionModeAllowedForFlavor
} from '@hapi/protocol'
import type { PermissionModeTone } from '@hapi/protocol'
import { useMemo } from 'react'
import type { AgentState, PermissionMode } from '@/types/api'
import { getContextBudgetTokens } from '@/chat/modelConfig'
import { useTranslation } from '@/lib/use-translation'

export type ModelSwitchState = {
    status: 'idle' | 'applying' | 'applied' | 'pending' | 'failed' | 'applies-next-run'
    reason?: string
    targetModel?: string | null
    previousModel?: string | null
}

// Vibing messages for thinking state
const VIBING_MESSAGES = [
    "Accomplishing", "Actioning", "Actualizing", "Baking", "Booping", "Brewing",
    "Calculating", "Cerebrating", "Channelling", "Churning", "Coalescing",
    "Cogitating", "Computing", "Combobulating", "Concocting", "Conjuring", "Considering",
    "Contemplating", "Cooking", "Crafting", "Creating", "Crunching", "Deciphering",
    "Deliberating", "Determining", "Discombobulating", "Divining", "Doing", "Effecting",
    "Elucidating", "Enchanting", "Envisioning", "Finagling", "Flibbertigibbeting",
    "Forging", "Forming", "Frolicking", "Generating", "Germinating", "Hatching",
    "Herding", "Honking", "Ideating", "Imagining", "Incubating", "Inferring",
    "Manifesting", "Marinating", "Meandering", "Moseying", "Mulling", "Mustering",
    "Musing", "Noodling", "Percolating", "Perusing", "Philosophising", "Pontificating",
    "Pondering", "Processing", "Puttering", "Puzzling", "Reticulating", "Ruminating",
    "Scheming", "Schlepping", "Shimmying", "Simmering", "Smooshing", "Spelunking",
    "Spinning", "Stewing", "Sussing", "Synthesizing", "Thinking", "Tinkering",
    "Transmuting", "Unfurling", "Unravelling", "Vibing", "Wandering", "Whirring",
    "Wibbling", "Wizarding", "Working", "Wrangling"
]

const PERMISSION_TONE_CLASSES: Record<PermissionModeTone, string> = {
    neutral: 'text-[var(--app-hint)]',
    info: 'text-blue-500',
    warning: 'text-amber-500',
    danger: 'text-red-500'
}

function getConnectionStatus(
    active: boolean,
    thinking: boolean,
    agentState: AgentState | null | undefined,
    backgroundTaskCount: number,
    t: (key: string) => string
): { text: string; color: string; dotColor: string; isPulsing: boolean } {
    const hasPermissions = agentState?.requests && Object.keys(agentState.requests).length > 0

    if (!active) {
        return {
            text: t('misc.offline'),
            color: 'text-[#999]',
            dotColor: 'bg-[#999]',
            isPulsing: false
        }
    }

    if (hasPermissions) {
        return {
            text: t('misc.permissionRequired'),
            color: 'text-[#FF9500]',
            dotColor: 'bg-[#FF9500]',
            isPulsing: true
        }
    }

    if (thinking) {
        const vibingMessage = VIBING_MESSAGES[Math.floor(Math.random() * VIBING_MESSAGES.length)].toLowerCase() + '…'
        return {
            text: vibingMessage,
            color: 'text-[#007AFF]',
            dotColor: 'bg-[#007AFF]',
            isPulsing: true
        }
    }

    if (backgroundTaskCount > 0) {
        return {
            text: `${backgroundTaskCount} background task${backgroundTaskCount > 1 ? 's' : ''} running`,
            color: 'text-[#007AFF]',
            dotColor: 'bg-[#007AFF]',
            isPulsing: true
        }
    }

    return {
        text: t('misc.online'),
        color: 'text-[#34C759]',
        dotColor: 'bg-[#34C759]',
        isPulsing: false
    }
}

function getContextWarning(contextSize: number, maxContextSize: number, t: (key: string, params?: Record<string, string | number>) => string): { text: string; color: string } | null {
    const percentageUsed = (contextSize / maxContextSize) * 100
    const percentageRemaining = Math.max(0, 100 - percentageUsed)

    const percent = Math.round(percentageRemaining)
    if (percentageRemaining <= 5) {
        return { text: t('misc.percentLeft', { percent }), color: 'text-red-500' }
    } else if (percentageRemaining <= 10) {
        return { text: t('misc.percentLeft', { percent }), color: 'text-amber-500' }
    } else {
        return { text: t('misc.percentLeft', { percent }), color: 'text-[var(--app-hint)]' }
    }
}

function formatTokenCount(value: number): string {
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
    if (value >= 1_000) return `${Math.round(value / 1_000)}k`
    return String(value)
}

function formatSwitchReason(reason: string | undefined, t: (key: string) => string): string | null {
    if (!reason) return null
    const reasonKey = {
        'cursor-cli-unavailable': 'newSession.model.discovery.reason.cursorCliUnavailable',
        'not-authenticated': 'newSession.model.discovery.reason.notAuthenticated',
        'timed-out': 'newSession.model.discovery.reason.timedOut',
        'empty-model-list': 'newSession.model.discovery.reason.emptyModelList',
        unknown: 'newSession.model.discovery.reason.unknown'
    }[reason]
    return reasonKey ? t(reasonKey) : null
}

function getModelSwitchLabel(
    state: ModelSwitchState | undefined,
    t: (key: string) => string
): { text: string; className: string } | null {
    if (!state || state.status === 'idle') return null
    if (state.status === 'applying' || state.status === 'pending') {
        return { text: t('composer.model.applying'), className: 'text-[var(--app-hint)]' }
    }
    if (state.status === 'applied') {
        return { text: t('composer.model.applied'), className: 'text-[var(--app-hint)]' }
    }
    if (state.status === 'applies-next-run') {
        return { text: t('composer.model.appliesNextMessage'), className: 'text-amber-500' }
    }

    const reason = formatSwitchReason(state.reason, t)
    return {
        text: reason ? `${t('composer.model.switchFailed')} · ${reason}` : t('composer.model.switchFailed'),
        className: 'text-[var(--app-badge-error-text)]'
    }
}

export function StatusBar(props: {
    active: boolean
    thinking: boolean
    agentState: AgentState | null | undefined
    backgroundTaskCount?: number
    contextSize?: number
    contextCacheRead?: number
    contextWindow?: number | null
    model?: string | null
    modelReasoningEffort?: string | null
    effort?: string | null
    permissionMode?: PermissionMode
    agentFlavor?: string | null
    modelSwitchState?: ModelSwitchState
    canOpenModelSelector?: boolean
    onModelInfoClick?: () => void
    onModelRetry?: (model: string | null) => void
}) {
    const { t } = useTranslation()
    const connectionStatus = useMemo(
        () => getConnectionStatus(props.active, props.thinking, props.agentState, props.backgroundTaskCount ?? 0, t),
        [props.active, props.thinking, props.agentState, props.backgroundTaskCount, t]
    )

    const contextWarning = useMemo(
        () => {
            if (props.contextSize === undefined) return null
            const maxContextSize = props.contextWindow ?? getContextBudgetTokens(props.model, props.agentFlavor)
            if (!maxContextSize) return null
            return getContextWarning(props.contextSize, maxContextSize, t)
        },
        [props.contextSize, props.contextWindow, props.model, props.agentFlavor, t]
    )
    const contextUsageLabel = useMemo(() => {
        if (props.contextSize === undefined) return null
        const maxContextSize = props.contextWindow ?? getContextBudgetTokens(props.model, props.agentFlavor)
        if (!maxContextSize) return `ctx ${formatTokenCount(props.contextSize)}`
        const percentageUsed = Math.min(100, Math.round((props.contextSize / maxContextSize) * 100))
        return `ctx ${formatTokenCount(props.contextSize)}/${formatTokenCount(maxContextSize)} (${percentageUsed}%)`
    }, [props.contextSize, props.contextWindow, props.model, props.agentFlavor])
    const compactContextUsageLabel = useMemo(() => {
        if (props.contextSize === undefined) return null
        const maxContextSize = props.contextWindow ?? getContextBudgetTokens(props.model, props.agentFlavor)
        if (!maxContextSize) return `ctx ${formatTokenCount(props.contextSize)}`
        const percentageLeft = Math.max(0, Math.round(100 - (props.contextSize / maxContextSize) * 100))
        return `ctx ${formatTokenCount(maxContextSize).toUpperCase()}, ${percentageLeft}% left`
    }, [props.contextSize, props.contextWindow, props.model, props.agentFlavor])
    const cacheHitLabel = useMemo(() => {
        if (!props.contextCacheRead || props.contextCacheRead <= 0) return null
        return `cache ${formatTokenCount(props.contextCacheRead)}`
    }, [props.contextCacheRead])

    const permissionMode = props.permissionMode
    const displayPermissionMode = permissionMode
        && permissionMode !== 'default'
        && isPermissionModeAllowedForFlavor(permissionMode, props.agentFlavor)
        ? permissionMode
        : null

    const permissionModeLabel = displayPermissionMode ? getPermissionModeLabel(displayPermissionMode) : null
    const permissionModeTone = displayPermissionMode ? getPermissionModeTone(displayPermissionMode) : null
    const permissionModeColor = permissionModeTone ? PERMISSION_TONE_CLASSES[permissionModeTone] : 'text-[var(--app-hint)]'
    const modelSwitchLabel = getModelSwitchLabel(props.modelSwitchState, t)
    const pendingSwitchStatus = props.modelSwitchState?.status
    const isSwitchPending = pendingSwitchStatus === 'applying'
        || pendingSwitchStatus === 'pending'
        || pendingSwitchStatus === 'applies-next-run'
    const gatedModel = isSwitchPending && props.modelSwitchState?.previousModel !== undefined
        ? props.modelSwitchState.previousModel
        : props.model
    const modelLabel = gatedModel?.trim() ? gatedModel : t('newSession.model.autoUnspecified')
    const effortLabel = props.modelReasoningEffort ?? props.effort ?? null
    const canOpenModelSelector = props.canOpenModelSelector === true
    const showReadOnlyHint = !canOpenModelSelector && !modelSwitchLabel
    const retryModel = props.modelSwitchState?.targetModel ?? props.model ?? null

    return (
        <div className="flex min-w-0 items-center justify-between gap-2 px-2 pb-1">
            <div className="flex min-w-0 items-baseline gap-2 sm:gap-3">
                <div className="flex shrink-0 items-center gap-1.5">
                    <span
                        className={`h-2 w-2 rounded-full ${connectionStatus.dotColor} ${connectionStatus.isPulsing ? 'animate-pulse' : ''}`}
                    />
                    <span className={`whitespace-nowrap text-xs ${connectionStatus.color}`}>
                        {connectionStatus.text}
                    </span>
                </div>
                {contextUsageLabel ? (
                    <span className={`min-w-0 whitespace-nowrap text-[10px] ${contextWarning?.color ?? 'text-[var(--app-hint)]'}`}>
                        <span className="sm:hidden">
                            {compactContextUsageLabel}
                        </span>
                        <span className="hidden sm:inline">
                            {contextUsageLabel}{contextWarning ? ` · ${contextWarning.text}` : ''}
                        </span>
                    </span>
                ) : null}
                {cacheHitLabel ? (
                    <span className="hidden whitespace-nowrap text-[10px] text-[var(--app-hint)] sm:inline">
                        {cacheHitLabel}
                    </span>
                ) : null}
            </div>

            <div className="flex min-w-0 shrink-0 items-center gap-2">
                <div
                    role="button"
                    tabIndex={canOpenModelSelector ? 0 : -1}
                    aria-label={`${t('misc.model')} ${modelLabel}`}
                    aria-disabled={!canOpenModelSelector}
                    onClick={() => {
                        if (!canOpenModelSelector) return
                        props.onModelInfoClick?.()
                    }}
                    onKeyDown={(event) => {
                        if (!canOpenModelSelector) return
                        if (event.key !== 'Enter' && event.key !== ' ') return
                        event.preventDefault()
                        props.onModelInfoClick?.()
                    }}
                    className={`flex min-w-0 flex-col items-end rounded-lg border border-[var(--app-divider)] px-2 py-1 text-right transition-colors ${
                        canOpenModelSelector
                            ? 'cursor-pointer hover:bg-[var(--app-secondary-bg)] focus:outline-none focus:ring-2 focus:ring-[var(--app-link)]'
                            : 'cursor-default'
                    }`}
                >
                    <span className="max-w-[12rem] truncate text-xs font-semibold text-[var(--app-fg)]">
                        {modelLabel}
                    </span>
                    {effortLabel ? (
                        <span className="max-w-[12rem] truncate text-xs text-[var(--app-hint)]">
                            {effortLabel}
                        </span>
                    ) : null}
                    {modelSwitchLabel ? (
                        props.modelSwitchState?.status === 'failed' && props.onModelRetry ? (
                            <button
                                type="button"
                                aria-label={t('composer.model.switchFailed')}
                                className={`whitespace-nowrap text-xs ${modelSwitchLabel.className}`}
                                onClick={(event) => {
                                    event.stopPropagation()
                                    props.onModelRetry?.(retryModel)
                                }}
                                onKeyDown={(event) => {
                                    if (event.key !== 'Enter' && event.key !== ' ') return
                                    event.preventDefault()
                                    event.stopPropagation()
                                    props.onModelRetry?.(retryModel)
                                }}
                            >
                                {modelSwitchLabel.text}
                            </button>
                        ) : (
                            <span className={`whitespace-nowrap text-xs ${modelSwitchLabel.className}`}>
                                {modelSwitchLabel.text}
                            </span>
                        )
                    ) : null}
                    {showReadOnlyHint ? (
                        <span className="whitespace-nowrap text-xs text-[var(--app-hint)]">
                            {t('composer.model.switchingUnavailable')}
                        </span>
                    ) : null}
                </div>
                {displayPermissionMode ? (
                    <span className={`whitespace-nowrap text-xs ${permissionModeColor}`}>
                        {permissionModeLabel}
                    </span>
                ) : null}
            </div>
        </div>
    )
}
