import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { SkillSummary } from '@hapi/protocol/types'
import { I18nProvider } from '@/lib/i18n-context'
import SkillsSettingsPage from './skills'

const mockSkills: SkillSummary[] = [
    {
        name: 'deploy',
        description: 'Deploy helper',
        source: 'project',
        valid: true,
    },
    {
        name: 'broken',
        source: 'user',
        valid: false,
        invalidReason: 'Invalid YAML',
    },
]

vi.mock('@tanstack/react-router', () => ({
    useNavigate: () => vi.fn(),
}))

vi.mock('@tanstack/react-query', () => ({
    useQueryClient: () => ({
        invalidateQueries: vi.fn(),
    }),
}))

vi.mock('@/hooks/useAppGoBack', () => ({
    useAppGoBack: () => vi.fn(),
}))

vi.mock('@/lib/app-context', () => ({
    useAppContext: () => ({ api: {}, token: 't', baseUrl: 'http://localhost' }),
}))

vi.mock('@/hooks/queries/useSessions', () => ({
    useSessions: () => ({
        sessions: [{ id: 'session-1', active: true, activeAt: 1, updatedAt: 1 }],
        isLoading: false,
        error: null,
        refetch: vi.fn(),
    }),
}))

const setSkillPolicyMock = vi.fn()
const resetSkillPolicyMock = vi.fn()

vi.mock('@/api/client', () => ({
    ApiClient: class {},
}))

vi.mock('@/hooks/queries/useSkills', () => ({
    useSkills: () => ({
        skills: mockSkills,
        isLoading: false,
        error: null,
        getSuggestions: vi.fn(),
    }),
}))

vi.mock('@/hooks/mutations/useSessionActions', () => ({
    useSessionActions: () => ({
        setSkillPolicy: setSkillPolicyMock,
        resetSkillPolicy: resetSkillPolicyMock,
    }),
}))

describe('SkillsSettingsPage', () => {
    afterEach(() => {
        cleanup()
        vi.clearAllMocks()
    })

    it('renders read-only catalog without policy mutations', () => {
        render(
            <I18nProvider>
                <SkillsSettingsPage />
            </I18nProvider>
        )
        expect(screen.getByText('deploy')).toBeInTheDocument()
        expect(screen.getByText('Invalid YAML')).toBeInTheDocument()
        expect(setSkillPolicyMock).not.toHaveBeenCalled()
        expect(resetSkillPolicyMock).not.toHaveBeenCalled()
    })

    it('shows per-session policy footer note', () => {
        render(
            <I18nProvider>
                <SkillsSettingsPage />
            </I18nProvider>
        )
        expect(
            screen.getByText('Policy is set per session in chat. This list is read-only.')
        ).toBeInTheDocument()
    })
})
