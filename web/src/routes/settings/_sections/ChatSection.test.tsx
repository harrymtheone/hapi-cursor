import { afterEach, describe, it, expect, vi } from 'vitest'
import { useRef, useState } from 'react'
import { cleanup, render, screen } from '@testing-library/react'

afterEach(() => cleanup())

import { I18nProvider } from '@/lib/i18n-context'
import type { DropdownSlot } from '@/routes/settings/useSettingsState'
import { ChatSection } from './ChatSection'

vi.mock('@/hooks/useComposerEnterBehavior', () => ({
    useComposerEnterBehavior: () => ({ composerEnterBehavior: 'send', setComposerEnterBehavior: vi.fn() }),
    getComposerEnterBehaviorOptions: () => [
        { value: 'send', labelKey: 'settings.chat.enterBehavior.send' },
        { value: 'newline', labelKey: 'settings.chat.enterBehavior.newline' },
    ],
}))

vi.mock('@/hooks/useTerminalToolDisplayMode', () => ({
    useTerminalToolDisplayMode: () => ({ terminalToolDisplayMode: 'compact', setTerminalToolDisplayMode: vi.fn() }),
    getTerminalToolDisplayModeOptions: () => [
        { value: 'compact', labelKey: 'settings.chat.terminalToolDisplay.compact' },
        { value: 'detailed', labelKey: 'settings.chat.terminalToolDisplay.detailed' },
    ],
}))

vi.mock('@/hooks/useChatSurfaceColors', () => ({
    useChatSurfaceColors: () => ({
        toolGroupBackground: 'default',
        userMessageBackground: 'preset:soft-blue',
        setToolGroupBackground: vi.fn(),
        setUserMessageBackground: vi.fn(),
    }),
    getChatSurfaceColorPresetOptions: () => [
        { value: 'default', labelKey: 'settings.chat.surfaceColor.default' },
        { value: 'soft-blue', labelKey: 'settings.chat.surfaceColor.softBlue' },
    ],
    getChatSurfaceColorPickerValue: () => '#7db7ff',
    toPresetChatSurfaceColorPreference: (value: string) => (value === 'default' ? 'default' : `preset:${value}`),
    toCustomChatSurfaceColorPreference: (value: string) => `custom:${value}`,
}))

function Harness() {
    const cRef = useRef<HTMLDivElement | null>(null)
    const tRef = useRef<HTMLDivElement | null>(null)
    const [cOpen, setCOpen] = useState(false)
    const [tOpen, setTOpen] = useState(false)
    const c: DropdownSlot = { isOpen: cOpen, setIsOpen: setCOpen, containerRef: cRef }
    const t: DropdownSlot = { isOpen: tOpen, setIsOpen: setTOpen, containerRef: tRef }
    return <ChatSection composerEnterDropdown={c} terminalToolDisplayDropdown={t} />
}

describe('ChatSection', () => {
    it('renders the enter-behavior, terminal-tool, and surface-color controls', () => {
        render(
            <I18nProvider>
                <Harness />
            </I18nProvider>,
        )
        expect(screen.getAllByText('Enter Key').length).toBeGreaterThanOrEqual(1)
        expect(screen.getAllByText('Send message').length).toBeGreaterThanOrEqual(1)
        expect(screen.getAllByText('Terminal Tool Cards').length).toBeGreaterThanOrEqual(1)
        expect(screen.getAllByText('Compact (command only)').length).toBeGreaterThanOrEqual(1)
    })

    it('renders both surface-color controls with custom-color color inputs', () => {
        render(
            <I18nProvider>
                <Harness />
            </I18nProvider>,
        )
        expect(screen.getAllByText('Grouped Tool Use Background').length).toBeGreaterThanOrEqual(1)
        expect(screen.getAllByText('User Message Background').length).toBeGreaterThanOrEqual(1)
        expect(screen.getAllByLabelText('Custom color').length).toBeGreaterThanOrEqual(2)
    })
})
