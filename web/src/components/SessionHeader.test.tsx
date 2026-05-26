import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Session } from '@/types/api'
import { I18nProvider } from '@/lib/i18n-context'
import { SessionHeader } from './SessionHeader'

vi.mock('@/hooks/mutations/useSessionActions', () => ({
    useSessionActions: () => ({
        archiveSession: vi.fn(),
        renameSession: vi.fn(),
        deleteSession: vi.fn(),
        isPending: false,
    }),
}))

function createSession(overrides: Partial<Session> = {}): Session {
    return {
        id: 'session-1',
        seq: 1,
        createdAt: 1,
        updatedAt: 1,
        active: true,
        activeAt: 1,
        metadata: {
            path: '/repo',
            host: 'devbox'
        },
        metadataVersion: 1,
        agentStateVersion: 1,
        agentState: null,
        mode: 'local',
        thinking: false,
        backgroundTaskCount: 0,
        model: null,
        modelReasoningEffort: null,
        effort: null,
        permissionMode: 'default',
        ...overrides
    } as Session
}

function renderHeader(overrides: Partial<Parameters<typeof SessionHeader>[0]> = {}) {
    return render(
        <I18nProvider>
            <SessionHeader
                session={createSession()}
                onBack={vi.fn()}
                api={null}
                {...overrides}
            />
        </I18nProvider>
    )
}

describe('SessionHeader Skills button', () => {
    afterEach(() => cleanup())

    it('renders Skills button between Files and Outline when onOpenSkills provided', () => {
        const onOpenSkills = vi.fn()
        renderHeader({
            onViewFiles: vi.fn(),
            onOpenOutline: vi.fn(),
            onOpenSkills,
        })

        const skillsButton = screen.getByRole('button', { name: 'Skills' })
        expect(skillsButton).toBeInTheDocument()
        expect(skillsButton).toHaveAttribute('aria-expanded', 'false')

        fireEvent.click(skillsButton)
        expect(onOpenSkills).toHaveBeenCalledTimes(1)
    })

    it('does not render Skills button when onOpenSkills is omitted', () => {
        renderHeader({ onViewFiles: vi.fn(), onOpenOutline: vi.fn() })
        expect(screen.queryByRole('button', { name: 'Skills' })).not.toBeInTheDocument()
    })

    it('reflects skillsSheetOpen in aria-expanded', () => {
        renderHeader({
            onOpenSkills: vi.fn(),
            skillsSheetOpen: true,
        })
        expect(screen.getByRole('button', { name: 'Skills' })).toHaveAttribute('aria-expanded', 'true')
    })
})
