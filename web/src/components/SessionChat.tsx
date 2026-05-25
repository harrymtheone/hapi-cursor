import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { AssistantRuntimeProvider } from '@assistant-ui/react'
import type { ApiClient } from '@/api/client'
import type {
    AttachmentMetadata,
    DecryptedMessage,
    PermissionMode,
    Session,
    SlashCommand
} from '@/types/api'
import type { ChatBlock, NormalizedMessage } from '@/chat/types'
import type { Suggestion } from '@/hooks/useActiveSuggestions'
import { normalizeDecryptedMessage } from '@/chat/normalize'
import { reduceChatBlocks } from '@/chat/reducer'
import { reconcileChatBlocks } from '@/chat/reconcile'
import { buildConversationOutline } from '@/chat/outline'
import { buildVisibleChatBlocks, isToolGroupBlock, type ToolGroupBlock } from '@/chat/toolGroups'
import { isQueuedForInvocation, mergeMessages } from '@/lib/messages'
import { HappyComposer } from '@/components/AssistantChat/HappyComposer'
import type { ModelSwitchState } from '@/components/AssistantChat/StatusBar'
import type { ModelFamily } from '@/lib/cursorModelFamilies'
import type { PendingSchedule } from '@/components/AssistantChat/ScheduleTimePicker'
import { resolvePendingSchedule } from '@/components/AssistantChat/ScheduleTimePicker'
import { HappyThread } from '@/components/AssistantChat/HappyThread'
import { QueuedMessagesBar } from '@/components/AssistantChat/QueuedMessagesBar'
import { useHappyRuntime } from '@/lib/assistant-runtime'
import { createAttachmentAdapter } from '@/lib/attachmentAdapter'
import { useTranslation } from '@/lib/use-translation'
import { SessionHeader } from '@/components/SessionHeader'
import { TeamPanel } from '@/components/TeamPanel'
import { usePlatform } from '@/hooks/usePlatform'
import { useSessionActions } from '@/hooks/mutations/useSessionActions'
import { isRemoteTerminalSupported } from '@/utils/terminalSupport'

/**
 * Returns whether a PendingSchedule should trigger an auto-clear timer.
 *
 * Only 'absolute' schedules expire (the chosen instant passes).
 * 'preset' schedules are relative to send time and have no fixed expiry.
 *
 * Used both by the auto-clear useEffect and by unit tests, so a future
 * variant of PendingSchedule only needs to update this single helper.
 */
export function shouldAutoClearPendingSchedule(pending: PendingSchedule | null): boolean {
    return pending !== null && pending.type === 'absolute'
}

function isUninvokedScheduledMessage(message: DecryptedMessage): boolean {
    return message.invokedAt == null && message.scheduledAt != null
}

export function buildGoalStateMessages(
    messages: DecryptedMessage[],
    pendingMessages: DecryptedMessage[] = []
): DecryptedMessage[] {
    const eligibleMessages = messages.filter((message) => !isUninvokedScheduledMessage(message))
    const eligiblePendingMessages = pendingMessages.filter((message) => !isUninvokedScheduledMessage(message))
    return eligiblePendingMessages.length > 0
        ? mergeMessages(eligibleMessages, eligiblePendingMessages)
        : eligibleMessages
}

function getOutlineTitle(session: Session): string {
    if (session.metadata?.name) {
        return session.metadata.name
    }
    if (session.metadata?.summary?.text) {
        return session.metadata.summary.text
    }
    if (session.metadata?.path) {
        return session.metadata.path
    }
    return session.id.slice(0, 8)
}

export function SessionChat(props: {
    api: ApiClient
    session: Session
    messages: DecryptedMessage[]
    pendingMessages?: DecryptedMessage[]
    messagesWarning: string | null
    hasMoreMessages: boolean
    isLoadingMessages: boolean
    isLoadingMoreMessages: boolean
    isSending: boolean
    pendingCount: number
    messagesVersion: number
    onBack: () => void
    onRefresh: () => void
    onLoadMore: () => Promise<unknown>
    // Resolves true when the send was accepted by the underlying mutation, false when
    // pre-mutation guards (no-api / no-session / pending) rejected the call OR async
    // inactive-session resume failed. Composer state that should only be cleared on
    // actual send (pendingSchedule) must await this — see handleSend below.
    onSend: (text: string, attachments?: AttachmentMetadata[], scheduledAt?: number | null) => Promise<boolean>
    onFlushPending: () => void
    onAtBottomChange: (atBottom: boolean) => void
    onRetryMessage?: (localId: string) => void
    autocompleteSuggestions?: (query: string) => Promise<Suggestion[]>
    availableSlashCommands?: readonly SlashCommand[]
    runtimeModelSwitchSupported?: boolean
    modelFamilies?: ModelFamily[]
}) {
    const { haptic } = usePlatform()
    useTranslation()
    const navigate = useNavigate()
    const sessionInactive = !props.session.active
    const terminalSupported = isRemoteTerminalSupported(props.session.metadata)
    const normalizedCacheRef = useRef<Map<string, { source: DecryptedMessage; normalized: NormalizedMessage | null }>>(new Map())
    const blocksByIdRef = useRef<Map<string, ChatBlock>>(new Map())
    const visibleGroupsRef = useRef<ToolGroupBlock[]>([])
    const [forceScrollToken, setForceScrollToken] = useState(0)
    const [outlineOpen, setOutlineOpen] = useState(false)
    const [modelSwitchState, setModelSwitchState] = useState<ModelSwitchState>({ status: 'idle' })
    const agentFlavor = 'cursor'
    const controlledByUser = props.session.agentState?.controlledByUser === true
    const {
        abortSession,
        switchSession,
        setPermissionMode,
        setModel
    } = useSessionActions(
        props.api,
        props.session.id,
        agentFlavor
    )

    // Track session id to clear caches when it changes
    const prevSessionIdRef = useRef<string | null>(null)

    useEffect(() => {
        normalizedCacheRef.current.clear()
        blocksByIdRef.current.clear()
        visibleGroupsRef.current = []
        setOutlineOpen(false)
    }, [props.session.id])

    // Exclude user messages that haven't been invoked yet — those appear in the
    // QueuedMessagesBar above the composer, not in the thread timeline. The
    // `isQueuedForInvocation` predicate is shared with the window store and the
    // floating bar so the three views never disagree about queued state.
    const visibleMessages = useMemo(
        () => props.messages.filter((m) => !isQueuedForInvocation(m)),
        [props.messages]
    )

    const normalizedMessages: NormalizedMessage[] = useMemo(() => {
        // Clear caches immediately when session changes (before useEffect runs)
        if (prevSessionIdRef.current !== null && prevSessionIdRef.current !== props.session.id) {
            normalizedCacheRef.current.clear()
            blocksByIdRef.current.clear()
            visibleGroupsRef.current = []
        }
        prevSessionIdRef.current = props.session.id

        const cache = normalizedCacheRef.current
        const normalized: NormalizedMessage[] = []
        const seen = new Set<string>()
        for (const message of visibleMessages) {
            seen.add(message.id)
            const cached = cache.get(message.id)
            if (cached && cached.source === message) {
                if (cached.normalized) normalized.push(cached.normalized)
                continue
            }
            const next = normalizeDecryptedMessage(message)
            cache.set(message.id, { source: message, normalized: next })
            if (next) normalized.push(next)
        }
        for (const id of cache.keys()) {
            if (!seen.has(id)) {
                cache.delete(id)
            }
        }
        return normalized
    }, [visibleMessages])

    const goalStateSourceMessages = useMemo(
        () => buildGoalStateMessages(props.messages, props.pendingMessages ?? []),
        [props.messages, props.pendingMessages]
    )

    const normalizedGoalStateMessages: NormalizedMessage[] = useMemo(() => {
        const normalized: NormalizedMessage[] = []
        for (const message of goalStateSourceMessages) {
            const next = normalizeDecryptedMessage(message)
            if (next) normalized.push(next)
        }
        return normalized
    }, [goalStateSourceMessages])

    const reduced = useMemo(
        () => reduceChatBlocks(normalizedMessages, props.session.agentState, {
            goalStateMessages: normalizedGoalStateMessages,
            sessionId: props.session.id
        }),
        [normalizedMessages, normalizedGoalStateMessages, props.session.agentState, props.session.id]
    )
    const reconciled = useMemo(
        () => reconcileChatBlocks(reduced.blocks, blocksByIdRef.current),
        [reduced.blocks]
    )

    useEffect(() => {
        blocksByIdRef.current = reconciled.byId
    }, [reconciled.byId])

    const visibleBlocks = useMemo(
        () => buildVisibleChatBlocks(reconciled.blocks, {
            hasMoreMessages: props.hasMoreMessages,
            previousGroups: visibleGroupsRef.current
        }),
        [reconciled.blocks, props.hasMoreMessages]
    )

    useEffect(() => {
        visibleGroupsRef.current = visibleBlocks.filter(isToolGroupBlock)
    }, [visibleBlocks])

    const outlineItems = useMemo(
        () => buildConversationOutline(reconciled.blocks),
        [reconciled.blocks]
    )

    const outlineTitle = useMemo(
        () => getOutlineTitle(props.session),
        [props.session]
    )

    // Permission mode change handler
    const handlePermissionModeChange = useCallback(async (mode: PermissionMode) => {
        try {
            await setPermissionMode(mode)
            haptic.notification('success')
            props.onRefresh()
        } catch (e) {
            haptic.notification('error')
            console.error('Failed to set permission mode:', e)
        }
    }, [setPermissionMode, props.onRefresh, haptic])

    // Model mode change handler
    const handleModelChange = useCallback(async (model: string | null) => {
        const previousModel = props.session.model ?? null
        setModelSwitchState({ status: 'applying', targetModel: model, previousModel })
        try {
            const result = await setModel(model)
            const reason = 'reason' in result ? result.reason : undefined
            const nextState: ModelSwitchState = reason
                ? { status: result.status, reason, targetModel: model, previousModel }
                : { status: result.status, targetModel: model, previousModel }
            setModelSwitchState(nextState)
            haptic.notification(result.status === 'failed' ? 'error' : 'success')
            props.onRefresh()
        } catch (e) {
            setModelSwitchState({ status: 'failed', targetModel: model, previousModel })
            haptic.notification('error')
            console.error('Failed to set model:', e)
        }
    }, [setModel, props.onRefresh, haptic, props.session.model])

    // Reset the local switch state once the Hub-delivered session-updated patch
    // reports the new model in effect (next-message turn observed). This keeps
    // the BIG label gate honest: previousModel rules until Hub confirms.
    useEffect(() => {
        if (
            modelSwitchState.status === 'applies-next-run'
            && modelSwitchState.targetModel === (props.session.model ?? null)
        ) {
            setModelSwitchState({ status: 'idle' })
        }
    }, [props.session.model, modelSwitchState.status, modelSwitchState.targetModel])

    // Abort handler
    const handleAbort = useCallback(async () => {
        await abortSession()
        props.onRefresh()
    }, [abortSession, props.onRefresh])

    // Switch to remote handler
    const handleSwitchToRemote = useCallback(async () => {
        await switchSession()
        props.onRefresh()
    }, [switchSession, props.onRefresh])

    const handleViewFiles = useCallback(() => {
        navigate({
            to: '/sessions/$sessionId/files',
            params: { sessionId: props.session.id }
        })
    }, [navigate, props.session.id])

    const handleViewTerminal = useCallback(() => {
        navigate({
            to: '/sessions/$sessionId/terminal',
            params: { sessionId: props.session.id }
        })
    }, [navigate, props.session.id])

    // Scheduled message state — lifted here so useHappyRuntime can read the ref.
    //
    // pendingSchedule holds what the user selected (preset or absolute ms).
    // The ref is read at send time; resolvePendingSchedule converts it to an
    // absolute epoch-ms using Date.now() at that moment (send-time base for presets).
    const [pendingSchedule, setPendingSchedule] = useState<PendingSchedule | null>(null)
    const pendingScheduleRef = useRef<PendingSchedule | null>(null)
    // Keep render ref in sync so onNew can snapshot at send time
    pendingScheduleRef.current = pendingSchedule

    // Auto-clear absolute-type pendingSchedule when the chosen time expires so
    // the composer clock button doesn't stay active past the scheduled instant.
    // Preset-type schedules are relative so they don't expire until send — the
    // shouldAutoClearPendingSchedule predicate is the single source of truth so
    // adding a new PendingSchedule variant only needs to update that helper.
    useEffect(() => {
        if (!shouldAutoClearPendingSchedule(pendingSchedule)) return
        // Narrowed to 'absolute' by the predicate above.
        const ms = (pendingSchedule as Extract<PendingSchedule, { type: 'absolute' }>).ms
        const remaining = ms - Date.now()
        if (remaining <= 0) {
            setPendingSchedule(null)
            return
        }
        const timer = setTimeout(() => setPendingSchedule(null), remaining)
        return () => clearTimeout(timer)
    }, [pendingSchedule])

    const handleSend = useCallback(async (text: string, attachments?: AttachmentMetadata[], scheduledAt?: number | null) => {
        const accepted = await props.onSend(text, attachments, scheduledAt)
        if (!accepted) return
        // Clear pendingSchedule only after the mutation is actually accepted —
        // covers both pre-mutation guards AND async inactive-session resume
        // failure. SessionChat is the single owner of schedule clear (HappyComposer
        // no longer clears on its own send path).
        setPendingSchedule(null)
        setForceScrollToken((token) => token + 1)
    }, [props.onSend])

    const attachmentAdapter = useMemo(() => {
        if (!props.session.active) {
            return undefined
        }
        return createAttachmentAdapter(props.api, props.session.id)
    }, [props.api, props.session.id, props.session.active])

    const runtime = useHappyRuntime({
        session: props.session,
        blocks: visibleBlocks,
        isSending: props.isSending,
        isRunning: props.session.thinking,
        onSendMessage: handleSend,
        onAbort: handleAbort,
        attachmentAdapter,
        allowSendWhenInactive: true,
        pendingScheduleRef
    })

    return (
        <div className="flex h-full min-h-0 flex-col">
            <SessionHeader
                session={props.session}
                onBack={props.onBack}
                onViewFiles={props.session.metadata?.path ? handleViewFiles : undefined}
                onOpenOutline={() => setOutlineOpen(true)}
                api={props.api}
                onSessionDeleted={props.onBack}
            />

            {props.session.teamState && (
                <TeamPanel teamState={props.session.teamState} />
            )}

            {sessionInactive ? (
                <div className="px-3 pt-3">
                    <div className="mx-auto w-full max-w-content rounded-md bg-[var(--app-subtle-bg)] p-3 text-sm text-[var(--app-hint)]">
                        Session is inactive. Sending will resume it automatically.
                    </div>
                </div>
            ) : null}

            <AssistantRuntimeProvider runtime={runtime}>
                <div className="relative flex min-h-0 flex-1 flex-col">
                    <HappyThread
                        key={props.session.id}
                        api={props.api}
                        sessionId={props.session.id}
                        metadata={props.session.metadata}
                        disabled={sessionInactive}
                        onRefresh={props.onRefresh}
                        onRetryMessage={props.onRetryMessage}
                        onFlushPending={props.onFlushPending}
                        onAtBottomChange={props.onAtBottomChange}
                        isLoadingMessages={props.isLoadingMessages}
                        messagesWarning={props.messagesWarning}
                        hasMoreMessages={props.hasMoreMessages}
                        isLoadingMoreMessages={props.isLoadingMoreMessages}
                        onLoadMore={props.onLoadMore}
                        pendingCount={props.pendingCount}
                        rawMessagesCount={visibleMessages.length}
                        normalizedMessagesCount={normalizedMessages.length}
                        messagesVersion={props.messagesVersion}
                        forceScrollToken={forceScrollToken}
                        outlineOpen={outlineOpen}
                        outlineTitle={outlineTitle}
                        outlineItems={outlineItems}
                        onOutlineOpenChange={setOutlineOpen}
                    />

                    <div className="px-3">
                        <QueuedMessagesBar
                            sessionId={props.session.id}
                            api={props.api}
                            onEdit={({ pendingSchedule: restored }) => {
                                // Restore the schedule so the clock button re-activates
                                setPendingSchedule(restored)
                            }}
                        />
                    </div>

                    <HappyComposer
                        key={props.session.id}
                        sessionId={props.session.id}
                        disabled={props.isSending}
                        pendingSchedule={pendingSchedule}
                        onSchedule={setPendingSchedule}
                        onClearSchedule={() => setPendingSchedule(null)}
                        permissionMode={props.session.permissionMode}
                        threadGoal={reduced.latestGoal}
                        model={props.session.model}
                        modelReasoningEffort={props.session.modelReasoningEffort}
                        effort={props.session.effort}
                        agentFlavor={agentFlavor}
                        modelSwitchState={modelSwitchState}
                        runtimeModelSwitchSupported={props.runtimeModelSwitchSupported}
                        modelFamilies={props.modelFamilies}
                        active={props.session.active}
                        allowSendWhenInactive
                        thinking={props.session.thinking}
                        agentState={props.session.agentState}
                        backgroundTaskCount={props.session.backgroundTaskCount}
                        contextSize={reduced.latestUsage?.contextSize}
                        contextCacheRead={reduced.latestUsage?.cacheRead}
                        contextWindow={reduced.latestUsage?.contextWindow}
                        controlledByUser={controlledByUser}
                        onPermissionModeChange={handlePermissionModeChange}
                        onModelChange={handleModelChange}
                        onSwitchToRemote={handleSwitchToRemote}
                        onTerminal={props.session.active && terminalSupported ? handleViewTerminal : undefined}
                        terminalUnsupported={props.session.active && !terminalSupported}
                        autocompleteSuggestions={props.autocompleteSuggestions}
                    />
                </div>
            </AssistantRuntimeProvider>
        </div>
    )
}
