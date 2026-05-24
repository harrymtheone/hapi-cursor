import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const sseCalls = vi.hoisted(() => ({ calls: [] as Array<{ subscription?: unknown }> }))
const routerState = vi.hoisted(() => ({ selectedSessionId: null as string | null }))

vi.mock('@/hooks/useSSE', () => ({
    useSSE: (args: { subscription?: unknown }) => {
        sseCalls.calls.push(args)
        return { subscriptionId: 'sub-1' }
    },
}))

vi.mock('@tanstack/react-router', () => ({
    Outlet: () => null,
    useLocation: ({ select }: { select: (location: { pathname: string }) => unknown }) =>
        select({
            pathname: routerState.selectedSessionId
                ? `/sessions/${routerState.selectedSessionId}`
                : '/',
        }),
    useMatchRoute: () => () =>
        routerState.selectedSessionId
            ? { sessionId: routerState.selectedSessionId }
            : false,
    useRouter: () => ({
        history: {
            location: { pathname: '/', search: '', hash: '', state: null },
            replace: () => {},
        },
    }),
}))

vi.mock('@/hooks/useAuth', () => ({
    useAuth: () => ({
        token: 't',
        api: { __api: true } as unknown,
        isLoading: false,
        error: null,
    }),
}))

vi.mock('@/hooks/useAuthSource', () => ({
    useAuthSource: () => ({
        authSource: { type: 'manual' } as unknown,
        isLoading: false,
        setAccessToken: () => {},
    }),
}))

vi.mock('@/hooks/useServerUrl', () => ({
    useServerUrl: () => ({
        serverUrl: 'http://x',
        baseUrl: 'http://x',
        setServerUrl: () => {},
        clearServerUrl: () => {},
    }),
}))

vi.mock('@/hooks/useSyncingState', () => ({
    useSyncingState: () => ({ isSyncing: false, startSync: () => {}, endSync: () => {} }),
}))

vi.mock('@/hooks/usePushNotifications', () => ({
    usePushNotifications: () => ({
        isSupported: false,
        permission: 'default' as PermissionState,
        requestPermission: async () => false,
        subscribe: async () => {},
    }),
}))

vi.mock('@/hooks/useViewportHeight', () => ({ useViewportHeight: () => {} }))
vi.mock('@/hooks/useVisibilityReporter', () => ({ useVisibilityReporter: () => {} }))
vi.mock('@/hooks/useChatSurfaceColors', () => ({ initializeChatSurfaceColors: () => {} }))
vi.mock('@/hooks/useTheme', () => ({ initializeTheme: () => {} }))
vi.mock('@/hooks/useAppGoBack', () => ({ useAppGoBack: () => () => {} }))
vi.mock('@/lib/runtime-config', () => ({ requireHubUrlForLogin: () => false }))
vi.mock('@/lib/message-window-store', () => ({
    clearMessageWindow: () => {},
    fetchLatestMessages: async () => {},
}))
vi.mock('@/lib/use-translation', () => ({
    useTranslation: () => ({ t: (key: string) => key }),
}))
vi.mock('@/lib/toast-context', () => ({
    ToastProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    useToast: () => ({ addToast: () => {} }),
}))
vi.mock('@/lib/app-context', () => ({
    AppContextProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))
vi.mock('@/components/LoginPrompt', () => ({ LoginPrompt: () => null }))
vi.mock('@/components/InstallPrompt', () => ({ InstallPrompt: () => null }))
vi.mock('@/components/OfflineBanner', () => ({ OfflineBanner: () => null }))
vi.mock('@/components/SyncingBanner', () => ({ SyncingBanner: () => null }))
vi.mock('@/components/ReconnectingBanner', () => ({ ReconnectingBanner: () => null }))
vi.mock('@/components/LoadingState', () => ({ LoadingState: () => null }))
vi.mock('@/components/ToastContainer', () => ({ ToastContainer: () => null }))

import { App } from './App'

function renderApp() {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    })
    return render(
        <QueryClientProvider client={queryClient}>
            <App />
        </QueryClientProvider>,
    )
}

describe('App SSE subscription scope', () => {
    beforeEach(() => {
        sseCalls.calls = []
        routerState.selectedSessionId = null
    })

    afterEach(() => {
        cleanup()
    })

    it('App SSE subscription scope is always { all: true } regardless of selected session', () => {
        // Render 1: list-only route (no session selected).
        routerState.selectedSessionId = null
        const { unmount } = renderApp()
        expect(sseCalls.calls.length).toBeGreaterThan(0)
        const lastNoSession = sseCalls.calls.at(-1)
        expect(lastNoSession?.subscription).toEqual({ all: true })
        for (const call of sseCalls.calls) {
            expect(call.subscription).not.toHaveProperty('sessionId')
        }
        unmount()

        // Render 2: session detail route — must STILL be { all: true }.
        sseCalls.calls = []
        routerState.selectedSessionId = 'sessionA'
        renderApp()
        expect(sseCalls.calls.length).toBeGreaterThan(0)
        const lastWithSession = sseCalls.calls.at(-1)
        expect(lastWithSession?.subscription).toEqual({ all: true })
        for (const call of sseCalls.calls) {
            expect(call.subscription).not.toHaveProperty('sessionId')
        }
    })
})
