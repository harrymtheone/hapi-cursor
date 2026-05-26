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

vi.mock('@/components/AssistantChat/SkillsPolicySheet', () => ({
    SkillsPolicySheet: (props: { open: boolean }) =>
        props.open ? <div role="region" aria-label="Skills" /> : null,
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
                api={{} as never}
                {...overrides}
            />
        </I18nProvider>
    )
}

describe('SessionHeader Skills button', () => {
    afterEach(() => cleanup())

    it('renders Skills button between Files and Outline when api is provided', () => {
        renderHeader({
            onViewFiles: vi.fn(),
            onOpenOutline: vi.fn(),
        })

        const skillsButton = screen.getByRole('button', { name: 'Skills' })
        expect(skillsButton).toBeInTheDocument()
        expect(skillsButton).toHaveAttribute('aria-expanded', 'false')
    })

    it('does not render Skills button when api is null', () => {
        renderHeader({ api: null, onViewFiles: vi.fn(), onOpenOutline: vi.fn() })
        expect(screen.queryByRole('button', { name: 'Skills' })).not.toBeInTheDocument()
    })

    it('toggles skills dropdown on button click', () => {
        renderHeader({ onViewFiles: vi.fn(), onOpenOutline: vi.fn() })

        const skillsButton = screen.getByRole('button', { name: 'Skills' })
        fireEvent.click(skillsButton)
        expect(skillsButton).toHaveAttribute('aria-expanded', 'true')
        expect(screen.getByRole('region', { name: 'Skills' })).toBeInTheDocument()

        fireEvent.click(skillsButton)
        expect(skillsButton).toHaveAttribute('aria-expanded', 'false')
        expect(screen.queryByRole('region', { name: 'Skills' })).not.toBeInTheDocument()
    })
})
