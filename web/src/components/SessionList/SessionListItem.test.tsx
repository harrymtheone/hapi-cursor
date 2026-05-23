import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import type { SessionSummary } from '@/types/api'
import { I18nProvider } from '@/lib/i18n-context'
import { SessionListItem, formatRelativeTime, getSessionTitle } from './SessionListItem'

afterEach(() => cleanup())

vi.mock('@/components/SessionActionMenu', () => ({
    SessionActionMenu: () => null,
}))
vi.mock('@/components/RenameSessionDialog', () => ({
    RenameSessionDialog: () => null,
}))
vi.mock('@/components/ui/ConfirmDialog', () => ({
    ConfirmDialog: () => null,
}))

function makeSession(overrides: Partial<SessionSummary> & { id: string }): SessionSummary {
    return {
        active: true,
        thinking: false,
        activeAt: 0,
        updatedAt: Date.now(),
        metadata: { name: 'My Session', path: '' },
        todoProgress: null,
        pendingRequestsCount: 0,
        backgroundTaskCount: 0,
        model: null,
        effort: null,
        ...overrides,
    }
}

function renderWithProviders(children: ReactNode) {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    })
    return render(
        <QueryClientProvider client={queryClient}>
            <I18nProvider>{children}</I18nProvider>
        </QueryClientProvider>
    )
}

describe('SessionListItem helpers', () => {
    it('getSessionTitle prefers metadata.name when present', () => {
        const session = makeSession({ id: 's-1', metadata: { name: 'My App', path: '' } })
        expect(getSessionTitle(session)).toBe('My App')
    })

    it('getSessionTitle falls back to the last path segment', () => {
        const session = makeSession({ id: 's-2', metadata: { path: '/home/user/repo' } })
        expect(getSessionTitle(session)).toBe('repo')
    })

    it('formatRelativeTime returns the just-now string for ages < 60s', () => {
        const t = (key: string) => key
        expect(formatRelativeTime(Date.now(), t)).toBe('session.time.justNow')
    })
})

describe('SessionListItem component', () => {
    it('renders the session title and forwards onSelect on click', () => {
        const onSelect = vi.fn()
        const session = makeSession({ id: 'sess-click', metadata: { name: 'Clickable', path: '' } })
        renderWithProviders(
            <SessionListItem session={session} onSelect={onSelect} api={null} />
        )
        expect(screen.getByText('Clickable')).toBeInTheDocument()
        const button = screen.getByRole('button')
        fireEvent.mouseDown(button)
        fireEvent.mouseUp(button)
        fireEvent.click(button)
        expect(onSelect).toHaveBeenCalledWith('sess-click')
    })

    it('marks the button with aria-current when selected', () => {
        renderWithProviders(
            <SessionListItem
                session={makeSession({ id: 'sess-selected', metadata: { name: 'Selected', path: '' } })}
                onSelect={vi.fn()}
                api={null}
                selected
            />
        )
        const button = screen.getByRole('button', { current: 'page' })
        expect(button).toBeInTheDocument()
    })
})
