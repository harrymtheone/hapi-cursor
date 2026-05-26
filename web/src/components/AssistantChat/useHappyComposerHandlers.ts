import {
    type ChangeEvent as ReactChangeEvent,
    type ClipboardEvent as ReactClipboardEvent,
    type FormEvent as ReactFormEvent,
    type KeyboardEvent as ReactKeyboardEvent,
    type SyntheticEvent as ReactSyntheticEvent,
    useCallback,
    useEffect,
} from 'react'
import type { PermissionMode } from '@/types/api'
import { applySuggestion } from '@/utils/applySuggestion'
import { markSkillUsed } from '@/lib/recent-skills'
import { getNextModelForFlavor } from './modelOptions'
import type { HappyComposerState } from './useHappyComposerState'

export interface UseHappyComposerHandlersProps {
    onPermissionModeChange?: (mode: PermissionMode) => void
    onModelChange?: (model: string | null) => void
    onSwitchToRemote?: () => void
    agentFlavor?: string | null
}

export function useHappyComposerHandlers(state: HappyComposerState, props: UseHappyComposerHandlersProps) {
    const {
        api,
        suggestions,
        selectedIndex,
        moveUp,
        moveDown,
        clearSuggestions,
        composerEnterBehavior,
        canSend,
        threadIsRunning,
        permissionMode,
        permissionModes,
        haptic,
        controlsDisabled,
        attachmentsReady,
        pendingSchedule,
        textareaRef,
        inputState,
        autocompletePrefixes,
        setInputState,
        setShowContinueHint,
        setSettingsOverlay,
        setIsAborting,
        setIsSwitching,
        abortDisabled,
        switchDisabled,
        model,
        modelOptions,
        canOpenModelSelector,
    } = state
    const {
        onPermissionModeChange,
        onModelChange,
        onSwitchToRemote,
        agentFlavor,
    } = props

    const handleSuggestionSelect = useCallback((index: number) => {
        const suggestion = suggestions[index]
        if (!suggestion || !textareaRef.current) return
        if (suggestion.source === 'builtin' && suggestion.text.startsWith('/')) {
            markSkillUsed(suggestion.text.slice(1))
        }

        const result = applySuggestion(
            inputState.text,
            inputState.selection,
            suggestion.text,
            autocompletePrefixes,
            true
        )

        api.composer().setText(result.text)
        setInputState({
            text: result.text,
            selection: { start: result.cursorPosition, end: result.cursorPosition }
        })

        setTimeout(() => {
            const el = textareaRef.current
            if (!el) return
            el.setSelectionRange(result.cursorPosition, result.cursorPosition)
            try {
                el.focus({ preventScroll: true })
            } catch {
                el.focus()
            }
        }, 0)

        haptic('light')
    }, [api, suggestions, inputState, autocompletePrefixes, haptic, textareaRef, setInputState])

    const handleAbort = useCallback(() => {
        if (abortDisabled) return
        haptic('error')
        setIsAborting(true)
        api.thread().cancelRun()
    }, [abortDisabled, api, haptic, setIsAborting])

    const handleSwitch = useCallback(async () => {
        if (switchDisabled || !onSwitchToRemote) return
        haptic('light')
        setIsSwitching(true)
        try {
            await onSwitchToRemote()
        } catch {
            setIsSwitching(false)
        }
    }, [switchDisabled, onSwitchToRemote, haptic, setIsSwitching])

    const handleKeyDown = useCallback((e: ReactKeyboardEvent<HTMLTextAreaElement>) => {
        const key = e.key
        if (e.nativeEvent.isComposing) return
        if (key === 'Enter' && e.shiftKey) return
        if (key === 'Enter' && suggestions.length > 0) {
            e.preventDefault()
            handleSuggestionSelect(selectedIndex >= 0 ? selectedIndex : 0)
            return
        }
        if (key === 'Enter') {
            if (composerEnterBehavior === 'newline') {
                if ((e.ctrlKey || e.metaKey) && !e.altKey && canSend) {
                    e.preventDefault()
                    api.composer().send()
                    setShowContinueHint(false)
                }
                return
            }
            e.preventDefault()
            if (!e.ctrlKey && !e.altKey && !e.metaKey && canSend) {
                api.composer().send()
                setShowContinueHint(false)
            }
            return
        }
        if (suggestions.length > 0) {
            if (key === 'ArrowUp') { e.preventDefault(); moveUp(); return }
            if (key === 'ArrowDown') { e.preventDefault(); moveDown(); return }
            if (key === 'Tab' && !e.shiftKey) {
                e.preventDefault()
                handleSuggestionSelect(selectedIndex >= 0 ? selectedIndex : 0)
                return
            }
            if (key === 'Escape') { e.preventDefault(); clearSuggestions(); return }
        }
        if (key === 'Escape' && threadIsRunning) {
            e.preventDefault()
            handleAbort()
            return
        }
        if (key === 'Tab' && e.shiftKey && onPermissionModeChange && permissionModes.length > 0) {
            e.preventDefault()
            const currentIndex = permissionModes.indexOf(permissionMode)
            const nextIndex = (currentIndex + 1) % permissionModes.length
            onPermissionModeChange(permissionModes[nextIndex] ?? 'default')
            haptic('light')
        }
    }, [
        suggestions,
        selectedIndex,
        moveUp,
        moveDown,
        clearSuggestions,
        handleSuggestionSelect,
        threadIsRunning,
        handleAbort,
        onPermissionModeChange,
        permissionMode,
        permissionModes,
        canSend,
        api,
        haptic,
        composerEnterBehavior,
        setShowContinueHint,
    ])

    useEffect(() => {
        const handleGlobalKeyDown = (e: globalThis.KeyboardEvent) => {
            if (e.key === 'm' && (e.metaKey || e.ctrlKey) && onModelChange && canOpenModelSelector) {
                e.preventDefault()
                onModelChange(getNextModelForFlavor(agentFlavor, model, modelOptions))
                haptic('light')
            }
        }

        window.addEventListener('keydown', handleGlobalKeyDown)
        return () => window.removeEventListener('keydown', handleGlobalKeyDown)
    }, [model, onModelChange, haptic, agentFlavor, modelOptions, canOpenModelSelector])

    const handleChange = useCallback((e: ReactChangeEvent<HTMLTextAreaElement>) => {
        const selection = {
            start: e.target.selectionStart,
            end: e.target.selectionEnd
        }
        setInputState({ text: e.target.value, selection })
    }, [setInputState])

    const handleSelect = useCallback((e: ReactSyntheticEvent<HTMLTextAreaElement>) => {
        const target = e.target as HTMLTextAreaElement
        setInputState((prev) => ({
            ...prev,
            selection: { start: target.selectionStart, end: target.selectionEnd }
        }))
    }, [setInputState])

    const handlePaste = useCallback(async (e: ReactClipboardEvent<HTMLTextAreaElement>) => {
        const files = Array.from(e.clipboardData?.files || [])
        const imageFiles = files.filter(file => file.type.startsWith('image/'))

        if (imageFiles.length === 0) return

        if (pendingSchedule != null) {
            e.preventDefault()
            return
        }

        e.preventDefault()

        try {
            for (const file of imageFiles) {
                await api.composer().addAttachment(file)
            }
        } catch (error) {
            console.error('Error adding pasted image:', error)
        }
    }, [api, pendingSchedule])

    const handleSettingsToggle = useCallback(() => {
        haptic('light')
        setSettingsOverlay((prev) => (prev === 'permission' ? null : 'permission'))
    }, [haptic, setSettingsOverlay])

    const handleModelOverlayToggle = useCallback(() => {
        haptic('light')
        setSettingsOverlay((prev) => (prev === 'model' ? null : 'model'))
    }, [haptic, setSettingsOverlay])

    const handleSubmit = useCallback((event?: ReactFormEvent<HTMLFormElement>) => {
        if (event && !attachmentsReady) {
            event.preventDefault()
            return
        }
        setShowContinueHint(false)
    }, [attachmentsReady, setShowContinueHint])

    const handlePermissionChange = useCallback((mode: PermissionMode) => {
        if (!onPermissionModeChange || controlsDisabled) return
        onPermissionModeChange(mode)
        setSettingsOverlay(null)
        haptic('light')
    }, [onPermissionModeChange, controlsDisabled, haptic, setSettingsOverlay])

    const handleModelChange = useCallback((nextModel: string | null) => {
        if (!onModelChange || !canOpenModelSelector) return
        onModelChange(nextModel)
        setSettingsOverlay(null)
        haptic('light')
    }, [onModelChange, canOpenModelSelector, haptic, setSettingsOverlay])

    const handleSend = useCallback(() => {
        api.composer().send()
        // SessionChat owns clearing the schedule — see HappyComposer for rationale.
    }, [api])

    return {
        handleSuggestionSelect,
        handleAbort,
        handleSwitch,
        handleKeyDown,
        handleChange,
        handleSelect,
        handlePaste,
        handleSettingsToggle,
        handleModelOverlayToggle,
        handleSubmit,
        handlePermissionChange,
        handleModelChange,
        handleSend,
    }
}

export type HappyComposerHandlers = ReturnType<typeof useHappyComposerHandlers>
