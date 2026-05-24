import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { I18nProvider } from '@/lib/i18n-context'
import { RESEARCH_MODEL_FIXTURES } from '@/lib/cursorModelFamilies.test'
import ModelsSettingsPage from './models'

const navigateMock = vi.fn()
const setVisibleFamiliesMock = vi.fn()

vi.mock('@tanstack/react-router', () => ({
    useNavigate: () => navigateMock,
}))

vi.mock('@/hooks/useAppGoBack', () => ({
    useAppGoBack: () => vi.fn(),
}))

vi.mock('@/lib/app-context', () => ({
    useAppContext: () => ({ api: {}, token: 't', baseUrl: 'http://localhost' }),
}))

vi.mock('@/hooks/queries/useMachines', () => ({
    useMachines: () => ({
        machines: [{ id: 'machine-1', active: true }],
        isLoading: false,
        error: null,
        refetch: vi.fn(),
    }),
}))

vi.mock('@/hooks/useCursorModels', () => ({
    useCursorModels: () => ({
        result: {
            status: 'ok',
            models: RESEARCH_MODEL_FIXTURES,
            discoveredAt: 1,
        },
        isLoading: false,
        error: null,
        retry: vi.fn(),
    }),
}))

vi.mock('@/hooks/useVisibleModelFamilies', () => ({
    useVisibleModelFamilies: () => ({
        visibleKeys: null,
        setVisibleFamilies: setVisibleFamiliesMock,
    }),
}))

describe('ModelsSettingsPage', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    afterEach(() => cleanup())

    it('filters families by search and saves visible keys', () => {
        render(
            <I18nProvider>
                <ModelsSettingsPage />
            </I18nProvider>
        )

        expect(screen.getByText('Composer 2')).toBeInTheDocument()
        expect(screen.getByText('Opus 4.7')).toBeInTheDocument()

        fireEvent.change(screen.getByPlaceholderText('Search model families'), {
            target: { value: 'opus' },
        })
        expect(screen.queryByText('Composer 2')).not.toBeInTheDocument()
        expect(screen.getByText('Opus 4.7')).toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: 'Save' }))
        expect(setVisibleFamiliesMock).toHaveBeenCalled()
        expect(navigateMock).toHaveBeenCalledWith({ to: '/settings' })
    })
})
