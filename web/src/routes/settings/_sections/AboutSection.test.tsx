import { afterEach, describe, it, expect, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

afterEach(() => cleanup())

import { I18nProvider } from '@/lib/i18n-context'
import { PROTOCOL_VERSION } from '@hapi/protocol'
import { AboutSection } from './AboutSection'

vi.mock('@hapi/protocol', () => ({
    PROTOCOL_VERSION: 1,
}))

describe('AboutSection', () => {
    it('renders the title and the website link with security attributes', () => {
        render(
            <I18nProvider>
                <AboutSection />
            </I18nProvider>,
        )
        expect(screen.getByText('About')).toBeInTheDocument()
        const link = screen.getByRole('link', { name: 'hapi.run' })
        expect(link).toHaveAttribute('href', 'https://hapi.run')
        expect(link).toHaveAttribute('target', '_blank')
        expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    })

    it('renders the app version and protocol version values', () => {
        render(
            <I18nProvider>
                <AboutSection />
            </I18nProvider>,
        )
        expect(screen.getByText('App Version')).toBeInTheDocument()
        expect(screen.getByText(__APP_VERSION__)).toBeInTheDocument()
        expect(screen.getByText('Protocol Version')).toBeInTheDocument()
        expect(screen.getByText(String(PROTOCOL_VERSION))).toBeInTheDocument()
    })
})
