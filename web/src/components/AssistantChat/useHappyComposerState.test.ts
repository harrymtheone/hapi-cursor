import { afterEach, describe, it, expect, vi } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { cleanup, renderHook } from '@testing-library/react'

const assistantState = vi.hoisted(() => ({
    composer: { text: '', attachments: [] },
    thread: { isRunning: false, isDisabled: false },
}))

vi.mock('@assistant-ui/react', () => ({
    useAssistantApi: () => ({
        composer: () => ({ setText: vi.fn(), addAttachment: vi.fn(), send: vi.fn() }),
        thread: () => ({ cancelRun: vi.fn() }),
    }),
    useAssistantState: (selector: (state: unknown) => unknown) =>
        selector(assistantState),
}))

vi.mock('@/hooks/useComposerEnterBehavior', () => ({
    useComposerEnterBehavior: () => ({ composerEnterBehavior: 'send', setComposerEnterBehavior: vi.fn() }),
    getComposerEnterBehaviorOptions: () => [],
}))

vi.mock('@/hooks/useComposerDraft', () => ({
    useComposerDraft: () => undefined,
}))

vi.mock('@/hooks/usePlatform', () => ({
    usePlatform: () => ({
        haptic: { impact: vi.fn(), notification: vi.fn() },
        isTouch: false,
    }),
}))

vi.mock('@/hooks/usePWAInstall', () => ({
    usePWAInstall: () => ({ isStandalone: false, isIOS: false }),
}))

vi.mock('@/hooks/useActiveWord', () => ({
    useActiveWord: () => null,
}))

vi.mock('@/hooks/useActiveSuggestions', () => ({
    useActiveSuggestions: () => [[], -1, vi.fn(), vi.fn(), vi.fn()] as const,
}))

vi.mock('@hapi/protocol', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@hapi/protocol')>()
    return {
        ...actual,
        getPermissionModeOptionsForFlavor: () => [
            { mode: 'default', label: 'Default' },
            { mode: 'plan', label: 'Plan' },
        ],
        supportsModelChange: () => true,
    }
})

vi.mock('./modelOptions', () => ({
    getModelOptionsForFlavor: () => [
        { value: null, label: 'Auto' },
        { value: 'gpt-5', label: 'GPT-5' },
    ],
    getNextModelForFlavor: () => null,
}))

import { I18nProvider } from '@/lib/i18n-context'
import { useHappyComposerState } from './useHappyComposerState'

afterEach(() => cleanup())

const wrapper = ({ children }: { children: ReactNode }) => createElement(I18nProvider, null, children)
const discoveredModelOptions = [
    { value: 'gpt-5', label: 'gpt-5' },
]

describe('useHappyComposerState', () => {
    afterEach(() => {
        assistantState.thread.isDisabled = false
    })

    it('derives canSend=false when there is no text and no attachments', () => {
        const { result } = renderHook(() => useHappyComposerState({}), { wrapper })
        expect(result.current.canSend).toBe(false)
        expect(result.current.hasAttachments).toBe(false)
    })

    it('exposes settings-button visibility flags from props + capabilities', () => {
        const { result } = renderHook(
            () => useHappyComposerState({
                onPermissionModeChange: vi.fn(),
                onModelChange: vi.fn(),
                agentFlavor: 'cursor',
                runtimeModelSwitchSupported: true,
                availableModelOptions: discoveredModelOptions,
            }),
            { wrapper },
        )
        expect(result.current.showPermissionSettings).toBe(true)
        expect(result.current.showModelSettings).toBe(true)
        expect(result.current.showSettingsButton).toBe(true)
    })

    it('allows model selector only when runtime switching is supported and idle', () => {
        const { result } = renderHook(
            () => useHappyComposerState({
                onModelChange: vi.fn(),
                agentFlavor: 'cursor',
                runtimeModelSwitchSupported: true,
                availableModelOptions: discoveredModelOptions,
            }),
            { wrapper },
        )

        expect(result.current.canOpenModelSelector).toBe(true)
        expect(result.current.showModelSettings).toBe(true)
    })

    it('keeps model selector read-only when runtime switching is unsupported or unproven', () => {
        const { result } = renderHook(
            () => useHappyComposerState({
                onModelChange: vi.fn(),
                agentFlavor: 'cursor',
                availableModelOptions: discoveredModelOptions,
            }),
            { wrapper },
        )

        expect(result.current.canOpenModelSelector).toBe(false)
        expect(result.current.showModelSettings).toBe(false)
    })

    it('disables model selector while thinking', () => {
        const { result } = renderHook(
            () => useHappyComposerState({
                onModelChange: vi.fn(),
                agentFlavor: 'cursor',
                runtimeModelSwitchSupported: true,
                availableModelOptions: discoveredModelOptions,
                thinking: true,
            }),
            { wrapper },
        )

        expect(result.current.canOpenModelSelector).toBe(false)
        expect(result.current.showModelSettings).toBe(false)
    })

    it('disables model selector while background work is running', () => {
        const { result } = renderHook(
            () => useHappyComposerState({
                onModelChange: vi.fn(),
                agentFlavor: 'cursor',
                runtimeModelSwitchSupported: true,
                availableModelOptions: discoveredModelOptions,
                backgroundTaskCount: 1,
            }),
            { wrapper },
        )

        expect(result.current.canOpenModelSelector).toBe(false)
        expect(result.current.showModelSettings).toBe(false)
    })

    it('disables model selector when pending requests exist', () => {
        const { result } = renderHook(
            () => useHappyComposerState({
                onModelChange: vi.fn(),
                agentFlavor: 'cursor',
                runtimeModelSwitchSupported: true,
                availableModelOptions: discoveredModelOptions,
                agentState: { requests: { req1: { status: 'pending' } } } as never,
            }),
            { wrapper },
        )

        expect(result.current.canOpenModelSelector).toBe(false)
        expect(result.current.showModelSettings).toBe(false)
    })

    it('allows model selector when supported and idle with empty modelFamilies (Auto-only)', () => {
        const { result } = renderHook(
            () => useHappyComposerState({
                onModelChange: vi.fn(),
                agentFlavor: 'cursor',
                runtimeModelSwitchSupported: true,
                modelFamilies: [],
            }),
            { wrapper },
        )

        expect(result.current.canOpenModelSelector).toBe(true)
        expect(result.current.showModelSettings).toBe(true)
    })

    it('controlsDisabled is true when disabled prop is set', () => {
        const { result } = renderHook(() => useHappyComposerState({ disabled: true }), { wrapper })
        expect(result.current.controlsDisabled).toBe(true)
        expect(result.current.canSend).toBe(false)
    })
})
