import { afterEach, describe, it, expect, vi } from 'vitest'
import { cleanup, renderHook } from '@testing-library/react'
import type { HappyComposerState } from './useHappyComposerState'
import { useHappyComposerHandlers } from './useHappyComposerHandlers'

afterEach(() => cleanup())

interface StubOverrides {
    abortDisabled?: boolean
    switchDisabled?: boolean
    cancelRun?: () => void
    send?: () => void
    haptic?: ReturnType<typeof vi.fn>
    setIsAborting?: ReturnType<typeof vi.fn>
    setIsSwitching?: ReturnType<typeof vi.fn>
}

function makeState(overrides: StubOverrides = {}) {
    const cancelRun = overrides.cancelRun ?? vi.fn()
    const send = overrides.send ?? vi.fn()
    const haptic = overrides.haptic ?? vi.fn()
    const setIsAborting = overrides.setIsAborting ?? vi.fn()
    const setIsSwitching = overrides.setIsSwitching ?? vi.fn()
    const setShowSettings = vi.fn()
    const setShowContinueHint = vi.fn()
    const setInputState = vi.fn()
    const api = {
        composer: () => ({
            send,
            setText: vi.fn(),
            addAttachment: vi.fn(),
        }),
        thread: () => ({ cancelRun }),
    }

    const state = {
        api,
        suggestions: [] as never[],
        selectedIndex: -1,
        moveUp: vi.fn(),
        moveDown: vi.fn(),
        clearSuggestions: vi.fn(),
        composerEnterBehavior: 'send' as const,
        canSend: true,
        threadIsRunning: true,
        permissionMode: 'default' as const,
        permissionModes: [],
        haptic,
        controlsDisabled: false,
        attachmentsReady: true,
        pendingSchedule: null,
        textareaRef: { current: null },
        inputState: { text: '', selection: { start: 0, end: 0 } },
        autocompletePrefixes: ['@'],
        setInputState,
        setShowContinueHint,
        setShowSettings,
        setIsAborting,
        setIsSwitching,
        abortDisabled: overrides.abortDisabled ?? false,
        switchDisabled: overrides.switchDisabled ?? false,
        model: null,
    } as unknown as HappyComposerState

    return { state, cancelRun, send, haptic, setIsAborting, setIsSwitching }
}

describe('useHappyComposerHandlers', () => {
    it('handleAbort cancels the running thread when not abortDisabled', () => {
        const { state, cancelRun, haptic, setIsAborting } = makeState({ abortDisabled: false })
        const { result } = renderHook(() => useHappyComposerHandlers(state, {}))
        result.current.handleAbort()
        expect(setIsAborting).toHaveBeenCalledWith(true)
        expect(cancelRun).toHaveBeenCalledTimes(1)
        expect(haptic).toHaveBeenCalledWith('error')
    })

    it('handleAbort is a no-op when abortDisabled is true', () => {
        const { state, cancelRun, setIsAborting } = makeState({ abortDisabled: true })
        const { result } = renderHook(() => useHappyComposerHandlers(state, {}))
        result.current.handleAbort()
        expect(setIsAborting).not.toHaveBeenCalled()
        expect(cancelRun).not.toHaveBeenCalled()
    })

    it('handleSend always invokes api.composer().send()', () => {
        const { state, send } = makeState()
        const { result } = renderHook(() => useHappyComposerHandlers(state, {}))
        result.current.handleSend()
        expect(send).toHaveBeenCalledTimes(1)
    })

    it('handleSwitch awaits onSwitchToRemote and resets isSwitching on rejection', async () => {
        const { state, setIsSwitching } = makeState({ switchDisabled: false })
        const onSwitchToRemote = vi.fn().mockRejectedValue(new Error('nope'))
        const { result } = renderHook(() => useHappyComposerHandlers(state, { onSwitchToRemote }))
        await result.current.handleSwitch()
        expect(onSwitchToRemote).toHaveBeenCalledTimes(1)
        expect(setIsSwitching).toHaveBeenCalledWith(true)
        expect(setIsSwitching).toHaveBeenLastCalledWith(false)
    })
})
