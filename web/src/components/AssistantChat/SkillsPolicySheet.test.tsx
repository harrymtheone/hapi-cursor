import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { SkillSummary } from '@hapi/protocol/types'
import { I18nProvider } from '@/lib/i18n-context'
import { EnforcementBadge } from './EnforcementBadge'
import { SkillsPolicySheet } from './SkillsPolicySheet'

const navigateMock = vi.fn()
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

vi.mock('@tanstack/react-router', () => ({
    useNavigate: () => navigateMock,
}))

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
    }),
}))

function renderSheet(overrides: Partial<Parameters<typeof SkillsPolicySheet>[0]> = {}) {
    const onSetSkillPolicy = vi.fn().mockResolvedValue(undefined)
    const onResetSkillPolicy = vi.fn().mockResolvedValue(undefined)
    const view = render(
        <I18nProvider>
            <SkillsPolicySheet
                open
                onOpenChange={vi.fn()}
                api={{} as never}
                sessionId="session-1"
                skillPolicy={{}}
                onSetSkillPolicy={onSetSkillPolicy}
                onResetSkillPolicy={onResetSkillPolicy}
                {...overrides}
            />
        </I18nProvider>
    )
    return { ...view, onSetSkillPolicy, onResetSkillPolicy }
}

describe('EnforcementBadge', () => {
    afterEach(() => cleanup())

    it('shows HAPI session policy copy by default', () => {
        render(
            <I18nProvider>
                <EnforcementBadge />
            </I18nProvider>
        )
        expect(screen.getByText('HAPI session policy')).toBeInTheDocument()
        expect(screen.queryByText('Cursor enforced')).not.toBeInTheDocument()
    })
})

describe('SkillsPolicySheet', () => {
    afterEach(() => cleanup())

    it('disables tri-state for invalid skills', () => {
        renderSheet()
        const row = screen.getByText('broken-skill').closest('.min-h-\\[56px\\]')
        expect(row).toBeTruthy()
        const radios = row!.querySelectorAll('button[role="radio"]')
        expect(radios.length).toBe(3)
        for (const radio of radios) {
            expect(radio).toBeDisabled()
        }
    })

    it('calls resetSkillPolicy when reset footer is clicked', async () => {
        const { onResetSkillPolicy } = renderSheet()
        fireEvent.click(screen.getByRole('button', { name: 'Reset all to inherited' }))
        await waitFor(() => {
            expect(onResetSkillPolicy).toHaveBeenCalledTimes(1)
        })
    })

    it('does not render Cursor enforced badge in sheet rows', () => {
        renderSheet()
        expect(screen.getAllByText('HAPI session policy').length).toBeGreaterThan(0)
        expect(screen.queryByText('Cursor enforced')).not.toBeInTheDocument()
    })
})
