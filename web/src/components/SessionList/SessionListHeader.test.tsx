import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { I18nProvider } from '@/lib/i18n-context'
import { SessionListHeader } from './SessionListHeader'

afterEach(() => cleanup())

function renderHeader(overrides: Partial<React.ComponentProps<typeof SessionListHeader>> = {}) {
    const props = {
        isSearching: false,
        visibleSessionCount: 0,
        totalSessionCount: 0,
        groupCount: 0,
        onNewSession: vi.fn(),
        ...overrides,
    }
    render(
        <I18nProvider>
            <SessionListHeader {...props} />
        </I18nProvider>
    )
    return props
}

describe('SessionListHeader', () => {
    it('invokes onNewSession when the new-session button is clicked', () => {
        const props = renderHeader({ totalSessionCount: 3, groupCount: 1 })
        fireEvent.click(screen.getByRole('button'))
        expect(props.onNewSession).toHaveBeenCalledTimes(1)
    })

    it('renders search count text when isSearching is true', () => {
        renderHeader({ isSearching: true, visibleSessionCount: 2, totalSessionCount: 7 })
        // The translation key "sessions.search.count" interpolates n/total. The fallback
        // renders the raw key + params as text — assert we render *some* count text containing 2.
        expect(screen.getByText(/2/)).toBeInTheDocument()
    })
})
