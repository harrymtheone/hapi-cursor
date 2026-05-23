import { useAssistantApi, useAssistantState } from '@assistant-ui/react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getPermissionModeOptionsForFlavor, supportsModelChange } from '@hapi/protocol'
import type { AgentState, PermissionMode, ThreadGoal } from '@/types/api'
import type { Suggestion } from '@/hooks/useActiveSuggestions'
import { useActiveWord } from '@/hooks/useActiveWord'
import { useActiveSuggestions } from '@/hooks/useActiveSuggestions'
import { usePlatform } from '@/hooks/usePlatform'
import { usePWAInstall } from '@/hooks/usePWAInstall'
import { useComposerDraft } from '@/hooks/useComposerDraft'
import { useComposerEnterBehavior } from '@/hooks/useComposerEnterBehavior'
import { useTranslation } from '@/lib/use-translation'
import type { PendingSchedule } from '@/components/AssistantChat/ScheduleTimePicker'
import { getModelOptionsForFlavor } from './modelOptions'

export interface TextInputState {
    text: string
    selection: { start: number; end: number }
}

export interface UseHappyComposerStateProps {
    sessionId?: string
    disabled?: boolean
    permissionMode?: PermissionMode
    threadGoal?: ThreadGoal | null
    model?: string | null
    modelReasoningEffort?: string | null
    effort?: string | null
    active?: boolean
    allowSendWhenInactive?: boolean
    thinking?: boolean
    agentState?: AgentState | null
    backgroundTaskCount?: number
    contextSize?: number
    contextCacheRead?: number
    contextWindow?: number | null
    controlledByUser?: boolean
    agentFlavor?: string | null
    availableModelOptions?: Array<{ value: string | null; label: string }>
    onPermissionModeChange?: (mode: PermissionMode) => void
    onModelChange?: (model: string | null) => void
    onSwitchToRemote?: () => void
    onTerminal?: () => void
    terminalUnsupported?: boolean
    autocompletePrefixes?: string[]
    autocompleteSuggestions?: (query: string) => Promise<Suggestion[]>
    pendingSchedule?: PendingSchedule | null
    onSchedule?: (pending: PendingSchedule) => void
    onClearSchedule?: () => void
}

const defaultSuggestionHandler = async (): Promise<Suggestion[]> => []

export function useHappyComposerState(props: UseHappyComposerStateProps) {
    const { t } = useTranslation()
    const {
        sessionId,
        disabled = false,
        permissionMode: rawPermissionMode,
        model: rawModel,
        active = true,
        allowSendWhenInactive = false,
        controlledByUser = false,
        agentFlavor,
        availableModelOptions,
        onPermissionModeChange,
        onModelChange,
        onSwitchToRemote,
        onTerminal,
        terminalUnsupported = false,
        autocompletePrefixes = ['@', '/', '$'],
        autocompleteSuggestions = defaultSuggestionHandler,
        pendingSchedule: pendingScheduleProp,
        onSchedule: onScheduleProp,
    } = props

    const permissionMode = rawPermissionMode ?? 'default'
    const model = rawModel ?? null

    const api = useAssistantApi()
    const { composerEnterBehavior } = useComposerEnterBehavior()
    const composerText = useAssistantState(({ composer }) => composer.text)
    const attachments = useAssistantState(({ composer }) => composer.attachments)
    const threadIsRunning = useAssistantState(({ thread }) => thread.isRunning)
    const threadIsDisabled = useAssistantState(({ thread }) => thread.isDisabled)

    const controlsDisabled = disabled || (!active && !allowSendWhenInactive) || threadIsDisabled
    const trimmed = composerText.trim()
    const hasText = trimmed.length > 0
    const hasAttachments = attachments.length > 0
    const attachmentsReady = !hasAttachments || attachments.every((attachment) => {
        if (attachment.status.type === 'complete') {
            return true
        }
        if (attachment.status.type !== 'requires-action') {
            return false
        }
        const path = (attachment as { path?: string }).path
        return typeof path === 'string' && path.length > 0
    })
    const canSend = (hasText || hasAttachments) && attachmentsReady && !controlsDisabled

    const [inputState, setInputState] = useState<TextInputState>({
        text: '',
        selection: { start: 0, end: 0 }
    })
    const [showSettings, setShowSettings] = useState(false)
    const [isAborting, setIsAborting] = useState(false)
    const [isSwitching, setIsSwitching] = useState(false)
    const [showContinueHint, setShowContinueHint] = useState(false)
    const [pendingScheduleLocal, setPendingScheduleLocal] = useState<PendingSchedule | null>(null)
    const isControlled = onScheduleProp !== undefined
    const pendingSchedule = isControlled ? (pendingScheduleProp ?? null) : pendingScheduleLocal
    const setPendingSchedule = isControlled ? onScheduleProp : setPendingScheduleLocal

    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const prevControlledByUser = useRef(controlledByUser)

    useComposerDraft(sessionId, composerText, (text) => api.composer().setText(text))

    useEffect(() => {
        setInputState((prev) => {
            if (prev.text === composerText) return prev
            const newPos = composerText.length
            return { text: composerText, selection: { start: newPos, end: newPos } }
        })
    }, [composerText])

    useEffect(() => {
        if (prevControlledByUser.current === true && controlledByUser === false) {
            setShowContinueHint(true)
        }
        if (controlledByUser) {
            setShowContinueHint(false)
        }
        prevControlledByUser.current = controlledByUser
    }, [controlledByUser])

    const { haptic: platformHaptic, isTouch } = usePlatform()
    const { isStandalone, isIOS } = usePWAInstall()
    const isIOSPWA = isIOS && isStandalone
    const bottomPaddingClass = isIOSPWA ? 'pb-0' : 'pb-3'
    const activeWord = useActiveWord(inputState.text, inputState.selection, autocompletePrefixes)
    const [suggestions, selectedIndex, moveUp, moveDown, clearSuggestions] = useActiveSuggestions(
        activeWord,
        autocompleteSuggestions,
        { clampSelection: true, wrapAround: true }
    )

    const haptic = useCallback((type: 'light' | 'success' | 'error' = 'light') => {
        if (type === 'light') {
            platformHaptic.impact('light')
        } else if (type === 'success') {
            platformHaptic.notification('success')
        } else {
            platformHaptic.notification('error')
        }
    }, [platformHaptic])

    useEffect(() => {
        if (!isAborting) return
        if (threadIsRunning) return
        setIsAborting(false)
    }, [isAborting, threadIsRunning])

    useEffect(() => {
        if (!isSwitching) return
        if (controlledByUser) return
        setIsSwitching(false)
    }, [isSwitching, controlledByUser])

    const permissionModeOptions = useMemo(
        () => getPermissionModeOptionsForFlavor(agentFlavor),
        [agentFlavor]
    )
    const modelOptions = useMemo(
        () => getModelOptionsForFlavor(agentFlavor, model, availableModelOptions),
        [agentFlavor, model, availableModelOptions]
    )
    const permissionModes = useMemo(
        () => permissionModeOptions.map((option) => option.mode),
        [permissionModeOptions]
    )

    const abortDisabled = controlsDisabled || isAborting || !threadIsRunning
    const switchDisabled = controlsDisabled || isSwitching || !controlledByUser
    const showSwitchButton = Boolean(controlledByUser && onSwitchToRemote)
    const showTerminalButton = Boolean(onTerminal || terminalUnsupported)
    const terminalDisabled = controlsDisabled || terminalUnsupported
    const terminalLabel = terminalUnsupported ? t('terminal.unsupportedWindows') : t('composer.terminal')

    const showPermissionSettings = Boolean(onPermissionModeChange && permissionModeOptions.length > 0)
    const showModelSettings = Boolean(onModelChange && supportsModelChange(agentFlavor) && modelOptions.length > 0)
    const showSettingsButton = Boolean(showPermissionSettings || showModelSettings)
    const showAbortButton = true

    return {
        t,
        api,
        composerEnterBehavior,
        composerText,
        attachments,
        threadIsRunning,
        controlsDisabled,
        hasAttachments,
        attachmentsReady,
        canSend,
        inputState,
        setInputState,
        showSettings,
        setShowSettings,
        isAborting,
        setIsAborting,
        isSwitching,
        setIsSwitching,
        showContinueHint,
        setShowContinueHint,
        pendingSchedule,
        setPendingSchedule,
        pendingScheduleLocal,
        setPendingScheduleLocal,
        isControlled,
        textareaRef,
        isTouch,
        bottomPaddingClass,
        activeWord,
        suggestions,
        selectedIndex,
        moveUp,
        moveDown,
        clearSuggestions,
        haptic,
        permissionMode,
        model,
        permissionModeOptions,
        modelOptions,
        permissionModes,
        abortDisabled,
        switchDisabled,
        showSwitchButton,
        showTerminalButton,
        terminalDisabled,
        terminalLabel,
        showPermissionSettings,
        showModelSettings,
        showSettingsButton,
        showAbortButton,
        autocompletePrefixes,
    }
}

export type HappyComposerState = ReturnType<typeof useHappyComposerState>
