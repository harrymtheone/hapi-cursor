import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { I18nProvider } from '@/lib/i18n-context'
import { SessionListEmpty } from './SessionListEmpty'

afterEach(() => cleanup())

describe('SessionListEmpty', () => {
    it('renders only the start-session button when onBrowse is omitted', () => {
        render(
            <I18nProvider>
                <SessionListEmpty onNewSession={vi.fn()} />
            </I18nProvider>
        )
        expect(screen.getAllByRole('button')).toHaveLength(1)
    })

    it('renders a browse button when onBrowse is provided and forwards clicks', () => {
        const onBrowse = vi.fn()
        const onNewSession = vi.fn()
        render(
            <I18nProvider>
                <SessionListEmpty onNewSession={onNewSession} onBrowse={onBrowse} />
            </I18nProvider>
        )
        const buttons = screen.getAllByRole('button')
        expect(buttons).toHaveLength(2)
        fireEvent.click(buttons[0])
        expect(onNewSession).toHaveBeenCalledTimes(1)
        fireEvent.click(buttons[1])
        expect(onBrowse).toHaveBeenCalledTimes(1)
    })
})
