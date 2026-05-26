import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { SkillSummary } from '@hapi/protocol/types'
import { I18nProvider } from '@/lib/i18n-context'
import { SkillsPolicySheet } from './SkillsPolicySheet'

const mockSkills: SkillSummary[] = [
    {
        name: 'valid-skill',
        description: 'A valid skill',
        source: 'project',
        valid: true,
    },
    {
        name: 'broken-skill',
        source: 'user',
        valid: false,
        invalidReason: 'Missing frontmatter',
    },
]

const refetchMock = vi.fn().mockResolvedValue(undefined)

vi.mock('@tanstack/react-query', () => ({
    useQueryClient: () => ({
        invalidateQueries: vi.fn(),
    }),
}))

vi.mock('@/hooks/queries/useSkills', () => ({
    useSkills: () => ({
        skills: mockSkills,
        isLoading: false,
        error: null,
        getSuggestions: vi.fn(),
        refetch: refetchMock,
    }),
}))

function renderSheet(overrides: Partial<Parameters<typeof SkillsPolicySheet>[0]> = {}) {
    return render(
        <I18nProvider>
            <SkillsPolicySheet
                open
                onClose={vi.fn()}
                anchorPoint={{ x: 320, y: 48 }}
                api={{} as never}
                sessionId="session-1"
                {...overrides}
            />
        </I18nProvider>
    )
}

describe('SkillsPolicySheet', () => {
    afterEach(() => cleanup())

    it('shows Invalid pill for invalid skills', () => {
        renderSheet()
        expect(screen.getByText('Invalid')).toBeInTheDocument()
        expect(screen.getByText('broken-skill')).toBeInTheDocument()
    })

    it('does not render tri-state radiogroup controls', () => {
        renderSheet()
        expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument()
        expect(screen.queryAllByRole('radio')).toHaveLength(0)
    })

    it('does not render policy footer actions', () => {
        renderSheet()
        expect(screen.queryByRole('button', { name: 'Reset all to inherited' })).not.toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Browse skills catalog' })).not.toBeInTheDocument()
    })

    it('shows scope pills for Global and Local skills', () => {
        renderSheet()
        expect(screen.getByText('Local')).toBeInTheDocument()
        expect(screen.getByText('Global')).toBeInTheDocument()
    })

    it('renders as anchored panel without dialog role', () => {
        renderSheet()
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
        expect(screen.getByRole('region', { name: 'Skills' })).toBeInTheDocument()
    })
})
