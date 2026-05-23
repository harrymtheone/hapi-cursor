import { afterEach, describe, it, expect } from 'vitest'
import { useRef, useState } from 'react'
import { cleanup, render, screen, fireEvent } from '@testing-library/react'

afterEach(() => cleanup())

import { I18nProvider } from '@/lib/i18n-context'
import type { DropdownSlot } from '@/routes/settings/useSettingsState'
import { LanguageSection } from './LanguageSection'

function Harness(props: { initialOpen?: boolean }) {
    const containerRef = useRef<HTMLDivElement | null>(null)
    const [isOpen, setIsOpen] = useState(props.initialOpen ?? false)
    const slot: DropdownSlot = { isOpen, setIsOpen, containerRef }
    return <LanguageSection dropdown={slot} />
}

function renderHarness(initialOpen?: boolean) {
    return render(
        <I18nProvider>
            <Harness initialOpen={initialOpen} />
        </I18nProvider>,
    )
}

describe('LanguageSection', () => {
    it('renders the language label and current locale', () => {
        renderHarness()
        expect(screen.getAllByText('Language').length).toBeGreaterThanOrEqual(1)
        expect(screen.getAllByText('English').length).toBeGreaterThanOrEqual(1)
    })

    it('toggles the listbox open when the trigger is clicked', () => {
        renderHarness()
        expect(screen.queryByRole('listbox')).toBeNull()
        const trigger = screen.getByRole('button', { name: /Language/ })
        fireEvent.click(trigger)
        expect(screen.getByRole('listbox')).toBeInTheDocument()
        expect(screen.getByRole('option', { name: /简体中文/ })).toBeInTheDocument()
    })

    it('renders the dropdown with options when initialOpen is true', () => {
        renderHarness(true)
        expect(screen.getByRole('listbox')).toBeInTheDocument()
        const selected = screen.getByRole('option', { selected: true })
        expect(selected).toHaveTextContent('English')
    })
})
