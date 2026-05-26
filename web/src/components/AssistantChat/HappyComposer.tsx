import { ComposerPrimitive } from '@assistant-ui/react'
import type { ApiClient } from '@/api/client'
import type { AgentState, PermissionMode, ThreadGoal } from '@/types/api'
import type { Suggestion } from '@/hooks/useActiveSuggestions'
import { StatusBar } from '@/components/AssistantChat/StatusBar'
import type { ModelSwitchState } from '@/components/AssistantChat/StatusBar'
import { ComposerButtons } from '@/components/AssistantChat/ComposerButtons'
import type { PendingSchedule } from '@/components/AssistantChat/ScheduleTimePicker'
import { AttachmentItem } from '@/components/AssistantChat/AttachmentItem'
import type { ModelFamily } from '@/lib/cursorModelFamilies'
import { useHappyComposerState } from './useHappyComposerState'
import { useHappyComposerHandlers } from './useHappyComposerHandlers'
import { HappyComposerOverlays } from './HappyComposerOverlays'

export type { TextInputState } from './useHappyComposerState'

export interface HappyComposerProps {
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
    modelSwitchState?: ModelSwitchState
    runtimeModelSwitchSupported?: boolean
    modelFamilies?: ModelFamily[]
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
    api?: ApiClient | null
}

export function HappyComposer(props: HappyComposerProps) {
    const state = useHappyComposerState(props)
    const handlers = useHappyComposerHandlers(state, {
        onPermissionModeChange: props.onPermissionModeChange,
        onModelChange: props.onModelChange,
        onSwitchToRemote: props.onSwitchToRemote,
        agentFlavor: props.agentFlavor,
    })

    const {
        t,
        attachments,
        controlsDisabled,
        hasAttachments,
        canSend,
        settingsOverlay,
        showContinueHint,
        pendingSchedule,
        setPendingSchedule,
        setPendingScheduleLocal,
        isControlled,
        textareaRef,
        isTouch,
        bottomPaddingClass,
        suggestions,
        selectedIndex,
        permissionMode,
        permissionModeOptions,
        model,
        modelOptions,
        modelFamilies: composerModelFamilies,
        showPermissionSettings,
        showModelSettings,
        showSettingsButton,
        showAbortButton,
        showSwitchButton,
        showTerminalButton,
        terminalDisabled,
        terminalLabel,
        canOpenModelSelector,
        abortDisabled,
        switchDisabled,
        isAborting,
        isSwitching,
    } = state

    return (
        <div className={`px-3 ${bottomPaddingClass} pt-2 bg-[var(--app-bg)]`}>
            <div className="mx-auto w-full max-w-content">
                <ComposerPrimitive.Root className="relative" onSubmit={handlers.handleSubmit}>
                    <HappyComposerOverlays
                        settingsOverlay={settingsOverlay}
                        showPermissionSettings={showPermissionSettings}
                        showModelSettings={showModelSettings}
                        permissionMode={permissionMode}
                        permissionModeOptions={permissionModeOptions}
                        model={model}
                        modelFamilies={composerModelFamilies ?? []}
                        suggestions={suggestions}
                        selectedIndex={selectedIndex}
                        controlsDisabled={controlsDisabled}
                        onPermissionChange={handlers.handlePermissionChange}
                        onModelChange={handlers.handleModelChange}
                        onSuggestionSelect={handlers.handleSuggestionSelect}
                        t={t}
                    />

                    <StatusBar
                        active={props.active ?? true}
                        thinking={props.thinking ?? false}
                        agentState={props.agentState ?? null}
                        backgroundTaskCount={props.backgroundTaskCount}
                        contextSize={props.contextSize}
                        contextCacheRead={props.contextCacheRead}
                        contextWindow={props.contextWindow}
                        model={model}
                        modelFamilies={composerModelFamilies}
                        modelReasoningEffort={props.modelReasoningEffort}
                        effort={props.effort}
                        permissionMode={permissionMode}
                        agentFlavor={props.agentFlavor}
                        modelSwitchState={props.modelSwitchState}
                        canOpenModelSelector={canOpenModelSelector}
                        onModelInfoClick={handlers.handleModelOverlayToggle}
                        onModelRetry={handlers.handleModelChange}
                    />

                    <div className="overflow-hidden rounded-[20px] bg-[var(--app-secondary-bg)]">
                        {attachments.length > 0 ? (
                            <div className="flex flex-wrap gap-2 px-4 pt-3">
                                <ComposerPrimitive.Attachments components={{ Attachment: AttachmentItem }} />
                            </div>
                        ) : null}

                        <div className="flex items-center px-4 py-3">
                            <ComposerPrimitive.Input
                                ref={textareaRef}
                                autoFocus={!controlsDisabled && !isTouch}
                                placeholder={showContinueHint ? t('misc.typeMessage') : t('misc.typeAMessage')}
                                disabled={controlsDisabled}
                                maxRows={5}
                                submitOnEnter={false}
                                cancelOnEscape={false}
                                onChange={handlers.handleChange}
                                onSelect={handlers.handleSelect}
                                onKeyDown={handlers.handleKeyDown}
                                onPaste={handlers.handlePaste}
                                className="flex-1 resize-none bg-transparent text-base leading-snug text-[var(--app-fg)] placeholder-[var(--app-hint)] focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                            />
                        </div>

                        <ComposerButtons
                            canSend={canSend}
                            controlsDisabled={controlsDisabled}
                            showSettingsButton={showSettingsButton}
                            onSettingsToggle={handlers.handleSettingsToggle}
                            showTerminalButton={showTerminalButton}
                            terminalDisabled={terminalDisabled}
                            terminalLabel={terminalLabel}
                            onTerminal={props.onTerminal ?? (() => {})}
                            showAbortButton={showAbortButton}
                            abortDisabled={abortDisabled}
                            isAborting={isAborting}
                            onAbort={handlers.handleAbort}
                            showSwitchButton={showSwitchButton}
                            switchDisabled={switchDisabled}
                            isSwitching={isSwitching}
                            onSwitch={handlers.handleSwitch}
                            onSend={handlers.handleSend}
                            pendingSchedule={pendingSchedule}
                            onSchedule={setPendingSchedule}
                            onClearSchedule={isControlled ? props.onClearSchedule : () => setPendingScheduleLocal(null)}
                            hasAttachments={hasAttachments}
                        />
                    </div>
                </ComposerPrimitive.Root>
            </div>
        </div>
    )
}
