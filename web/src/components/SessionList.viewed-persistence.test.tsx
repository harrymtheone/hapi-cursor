import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import type { SessionSummary } from '@/types/api'
import { I18nProvider } from '@/lib/i18n-context'
import { SessionList } from './SessionList'

const STORAGE_KEY = 'hapi.session-list.viewed-completion-markers'

beforeEach(() => {
    try {
        localStorage.clear()
    } catch {
        // ignore — environments without storage
    }
})

afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
})

function makeSession(overrides: Partial<SessionSummary> & { id: string }): SessionSummary {
    return {
        active: false,
        thinking: false,
        activeAt: 0,
        updatedAt: 0,
        metadata: null,
        todoProgress: null,
        pendingRequestsCount: 0,
        backgroundTaskCount: 0,
        model: null,
        effort: null,
        statusKind: 'idle',
        completionMarker: null,
        errorMarker: null,
        ...overrides,
    }
}

function renderWithProviders(children: ReactNode) {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: { retry: false },
            mutations: { retry: false },
        },
    })

    return render(
        <QueryClientProvider client={queryClient}>
            <I18nProvider>{children}</I18nProvider>
        </QueryClientProvider>
    )
}

describe('SessionList viewed completion markers persistence', () => {
    it('hydrates viewed completion markers from localStorage on mount so previously-viewed completed rows render as viewed without a user click', () => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ sessionA: 5 }))

        renderWithProviders(
            <SessionList
                sessions={[
                    makeSession({
                        id: 'sessionA',
                        statusKind: 'completed',
                        completionMarker: 5,
                        metadata: { name: 'Already viewed', path: '' },
                    }),
                ]}
                selectedSessionId={null}
                onSelect={vi.fn()}
                onNewSession={vi.fn()}
                onRefresh={vi.fn()}
                isLoading={false}
                renderHeader={false}
                api={null}
            />
        )

        expect(screen.getByLabelText('Viewed')).toBeInTheDocument()
        expect(screen.queryByLabelText('Unread result')).toBeNull()
    })

    it('markCompletionViewed writes through to localStorage with the same { sessionId: completionMarker } shape', async () => {
        renderWithProviders(
            <SessionList
                sessions={[
                    makeSession({
                        id: 'sessionA',
                        statusKind: 'completed',
                        completionMarker: 7,
                        metadata: { name: 'Selected completed', path: '' },
                    }),
                ]}
                selectedSessionId={'sessionA'}
                onSelect={vi.fn()}
                onNewSession={vi.fn()}
                onRefresh={vi.fn()}
                isLoading={false}
                renderHeader={false}
                api={null}
            />
        )

        await waitFor(() => {
            const raw = localStorage.getItem(STORAGE_KEY)
            expect(raw).not.toBeNull()
            expect(JSON.parse(raw!)).toEqual({ sessionA: 7 })
        })
    })

    it('prunes entries whose session id is no longer in props.sessions', async () => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ sessionA: 1, sessionGone: 2 }))

        renderWithProviders(
            <SessionList
                sessions={[
                    makeSession({
                        id: 'sessionA',
                        statusKind: 'completed',
                        completionMarker: 1,
                        metadata: { name: 'Still here', path: '' },
                    }),
                ]}
                selectedSessionId={null}
                onSelect={vi.fn()}
                onNewSession={vi.fn()}
                onRefresh={vi.fn()}
                isLoading={false}
                renderHeader={false}
                api={null}
            />
        )

        await waitFor(() => {
            const raw = localStorage.getItem(STORAGE_KEY)
            expect(raw).not.toBeNull()
            expect(JSON.parse(raw!)).toEqual({ sessionA: 1 })
        })
    })

    it('survives a localStorage failure (quota exceeded / SecurityError) without crashing the component', () => {
        vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
            throw new Error('QuotaExceeded')
        })
        vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
            throw new Error('SecurityError')
        })

        expect(() => {
            renderWithProviders(
                <SessionList
                    sessions={[
                        makeSession({
                            id: 'sessionA',
                            statusKind: 'completed',
                            completionMarker: 3,
                            metadata: { name: 'Storage broken', path: '' },
                        }),
                    ]}
                    selectedSessionId={'sessionA'}
                    onSelect={vi.fn()}
                    onNewSession={vi.fn()}
                    onRefresh={vi.fn()}
                    isLoading={false}
                    renderHeader={false}
                    api={null}
                />
            )
        }).not.toThrow()

        expect(screen.getByText('Storage broken')).toBeInTheDocument()
    })
})

// Storage key referenced for source-assertion grep coverage:
// 'hapi.session-list.viewed-completion-markers'
