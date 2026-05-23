import type { CursorModelDiscoveryResult } from '@hapi/protocol/types'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '@/lib/i18n-context'
import { ModelSelector } from './ModelSelector'

function renderSelector(props: Partial<Parameters<typeof ModelSelector>[0]> = {}) {
    return render(
        <I18nProvider>
            <ModelSelector
                agent="cursor"
                model="auto"
                isDisabled={false}
                onModelChange={vi.fn()}
                {...props}
            />
        </I18nProvider>
    )
}

describe('ModelSelector', () => {
    it('keeps auto visible while discovery is loading', () => {
        renderSelector({ isLoading: true })

        const select = screen.getByLabelText(/Model/)
        expect(select).toBeDisabled()
        expect(screen.getByRole('option', { name: 'Auto (unspecified)' })).toHaveValue('auto')
        expect(screen.getByText('Loading Cursor models...')).toBeInTheDocument()
    })

    it('renders discovered raw model ids as the primary option text', () => {
        const discoveryResult: CursorModelDiscoveryResult = {
            status: 'ok',
            models: [
                { id: 'cursor-fast', label: 'Fast lane' },
                { id: 'cursor-precise' }
            ],
            discoveredAt: 1_000
        }

        renderSelector({ discoveryResult })

        expect(screen.getByRole('option', { name: 'cursor-fast - Fast lane' })).toHaveValue('cursor-fast')
        expect(screen.getByRole('option', { name: 'cursor-precise' })).toHaveValue('cursor-precise')
    })

    it('shows the empty model state while preserving auto', () => {
        const discoveryResult: CursorModelDiscoveryResult = {
            status: 'ok',
            models: [],
            discoveredAt: 1_000
        }

        renderSelector({ discoveryResult })

        expect(screen.getByRole('option', { name: 'Auto (unspecified)' })).toHaveValue('auto')
        expect(screen.getByText('No Cursor models found')).toBeInTheDocument()
        expect(screen.getByText('Continue with auto, or retry discovery after checking the local Cursor CLI.')).toBeInTheDocument()
    })

    it('shows safe discovery errors and invokes retry', () => {
        const onRetryDiscovery = vi.fn()
        const discoveryResult: CursorModelDiscoveryResult = {
            status: 'error',
            reason: 'not-authenticated',
            discoveredAt: 1_000
        }

        renderSelector({ discoveryResult, onRetryDiscovery })

        expect(screen.getByRole('option', { name: 'Auto (unspecified)' })).toHaveValue('auto')
        expect(screen.getByText('Could not load Cursor models. Retry discovery, or continue with auto.')).toBeInTheDocument()
        expect(screen.getByText('Not authenticated')).toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: 'Retry discovery' }))

        expect(onRetryDiscovery).toHaveBeenCalledTimes(1)
    })
})
