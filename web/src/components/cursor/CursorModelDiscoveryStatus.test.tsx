import type { CursorModelDiscoveryResult } from '@hapi/protocol/types'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { I18nProvider } from '@/lib/i18n-context'
import { CursorModelDiscoveryStatus } from './CursorModelDiscoveryStatus'

function renderStatus(props: Partial<Parameters<typeof CursorModelDiscoveryStatus>[0]> = {}) {
    return render(
        <I18nProvider>
            <CursorModelDiscoveryStatus {...props} />
        </I18nProvider>
    )
}

describe('CursorModelDiscoveryStatus', () => {
    afterEach(() => cleanup())

    it('shows loading copy', () => {
        renderStatus({ isLoading: true })
        expect(screen.getByText('Loading Cursor models...')).toBeInTheDocument()
    })

    it('shows empty discovery state with retry', () => {
        const onRetryDiscovery = vi.fn()
        const discoveryResult: CursorModelDiscoveryResult = {
            status: 'ok',
            models: [],
            discoveredAt: 1_000,
        }
        renderStatus({ discoveryResult, onRetryDiscovery })
        expect(screen.getByText('No Cursor models found')).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Retry discovery' }))
        expect(onRetryDiscovery).toHaveBeenCalledTimes(1)
    })

    it('shows safe discovery errors and invokes retry', () => {
        const onRetryDiscovery = vi.fn()
        const discoveryResult: CursorModelDiscoveryResult = {
            status: 'error',
            reason: 'not-authenticated',
            discoveredAt: 1_000,
        }
        renderStatus({ discoveryResult, onRetryDiscovery })
        expect(screen.getByText('Could not load Cursor models. Retry discovery, or continue with auto.')).toBeInTheDocument()
        expect(screen.getByText('Not authenticated')).toBeInTheDocument()
        fireEvent.click(screen.getByRole('button', { name: 'Retry discovery' }))
        expect(onRetryDiscovery).toHaveBeenCalledTimes(1)
    })
})
