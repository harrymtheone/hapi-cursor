import { afterEach, describe, it, expect, vi } from 'vitest'
import { useRef, useState } from 'react'
import { cleanup, render, screen } from '@testing-library/react'

afterEach(() => cleanup())

import { I18nProvider } from '@/lib/i18n-context'
import type { DropdownSlot } from '@/routes/settings/useSettingsState'
import { DisplaySection } from './DisplaySection'

vi.mock('@/hooks/useFontScale', () => ({
    useFontScale: () => ({ fontScale: 1, setFontScale: vi.fn() }),
    getFontScaleOptions: () => [
        { value: 1, label: '100%' },
        { value: 1.125, label: '112.5%' },
    ],
}))

vi.mock('@/hooks/useTerminalFontSize', () => ({
    useTerminalFontSize: () => ({ terminalFontSize: 13, setTerminalFontSize: vi.fn() }),
    getTerminalFontSizeOptions: () => [
        { value: 13, label: '13px' },
        { value: 17, label: '17px' },
    ],
}))

vi.mock('@/hooks/useSessionPreviewLimit', () => ({
    MIN_SESSION_PREVIEW_LIMIT: 1,
    MAX_SESSION_PREVIEW_LIMIT: 99,
    normalizeSessionPreviewLimit: (value: number) => Math.min(99, Math.max(1, Math.floor(value))),
    useSessionPreviewLimit: () => ({ sessionPreviewLimit: 8, setSessionPreviewLimit: vi.fn() }),
}))

vi.mock('@/hooks/useTheme', () => ({
    useAppearance: () => ({ appearance: 'system', setAppearance: vi.fn() }),
    getAppearanceOptions: () => [
        { value: 'system', labelKey: 'settings.display.appearance.system' },
        { value: 'dark', labelKey: 'settings.display.appearance.dark' },
    ],
}))

function Harness() {
    const aRef = useRef<HTMLDivElement | null>(null)
    const fRef = useRef<HTMLDivElement | null>(null)
    const tRef = useRef<HTMLDivElement | null>(null)
    const [aOpen, setAOpen] = useState(false)
    const [fOpen, setFOpen] = useState(false)
    const [tOpen, setTOpen] = useState(false)
    const a: DropdownSlot = { isOpen: aOpen, setIsOpen: setAOpen, containerRef: aRef }
    const f: DropdownSlot = { isOpen: fOpen, setIsOpen: setFOpen, containerRef: fRef }
    const tt: DropdownSlot = { isOpen: tOpen, setIsOpen: setTOpen, containerRef: tRef }
    return <DisplaySection appearanceDropdown={a} fontDropdown={f} terminalFontDropdown={tt} />
}

describe('DisplaySection', () => {
    it('renders the appearance, font size, terminal font, and session preview controls', () => {
        render(
            <I18nProvider>
                <Harness />
            </I18nProvider>,
        )
        expect(screen.getAllByText('Appearance').length).toBeGreaterThanOrEqual(1)
        expect(screen.getAllByText('Follow System').length).toBeGreaterThanOrEqual(1)
        expect(screen.getAllByText('Terminal Font Size').length).toBeGreaterThanOrEqual(1)
        expect(screen.getAllByText('13px').length).toBeGreaterThanOrEqual(1)
    })

    it('renders the session preview limit numeric input wired to the current value', () => {
        render(
            <I18nProvider>
                <Harness />
            </I18nProvider>,
        )
        expect(screen.getByLabelText('Sessions Before Folding')).toHaveValue(8)
    })
})
