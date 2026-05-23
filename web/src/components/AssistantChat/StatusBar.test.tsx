import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { I18nProvider } from '@/lib/i18n-context'
import { StatusBar } from './StatusBar'

afterEach(() => cleanup())

function renderStatusBar(props: Partial<Parameters<typeof StatusBar>[0]> = {}) {
    return render(
        <I18nProvider>
            <StatusBar
                active
                thinking={false}
                agentState={null}
                model="gpt-5"
                {...props}
            />
        </I18nProvider>
    )
}

describe('StatusBar', () => {
    it('renders the raw current model id inside a model information box', () => {
        renderStatusBar({ model: 'cursor-runtime-model-1' })

        expect(screen.getByText('cursor-runtime-model-1')).toBeInTheDocument()
        expect(screen.getByLabelText('Model cursor-runtime-model-1')).toBeInTheDocument()
    })

    it('renders Auto (unspecified) when no model is set', () => {
        renderStatusBar({ model: null })

        expect(screen.getByText('Auto (unspecified)')).toBeInTheDocument()
    })

    it('renders effort only when verified effort metadata exists', () => {
        const { rerender } = render(
            <I18nProvider>
                <StatusBar
                    active
                    thinking={false}
                    agentState={null}
                    model="gpt-5"
                />
            </I18nProvider>
        )

        expect(screen.queryByText('high')).not.toBeInTheDocument()

        rerender(
            <I18nProvider>
                <StatusBar
                    active
                    thinking={false}
                    agentState={null}
                    model="gpt-5"
                    modelReasoningEffort="high"
                />
            </I18nProvider>
        )

        expect(screen.getByText('high')).toBeInTheDocument()
    })

    it('renders switch status copy inside the model information box', () => {
        const { rerender } = renderStatusBar({ modelSwitchState: { status: 'applying', targetModel: 'gpt-5' } })

        expect(screen.getByText('Applying...')).toBeInTheDocument()

        rerender(
            <I18nProvider>
                <StatusBar
                    active
                    thinking={false}
                    agentState={null}
                    model="gpt-5"
                    modelSwitchState={{ status: 'applied', targetModel: 'gpt-5' }}
                />
            </I18nProvider>
        )
        expect(screen.getByText('Applied')).toBeInTheDocument()

        rerender(
            <I18nProvider>
                <StatusBar
                    active
                    thinking={false}
                    agentState={null}
                    model="gpt-5"
                    modelSwitchState={{ status: 'applies-next-run', targetModel: 'gpt-5' }}
                />
            </I18nProvider>
        )
        expect(screen.getByText('Applies next run')).toBeInTheDocument()
    })

    it('renders failed status with retry using the target model', () => {
        const retry = vi.fn()
        renderStatusBar({
            modelSwitchState: {
                status: 'failed',
                targetModel: 'gpt-5',
                reason: 'not-authenticated',
            },
            onModelRetry: retry,
        })

        fireEvent.click(screen.getByRole('button', { name: 'Switch failed. Retry' }))

        expect(screen.getByText('Switch failed. Retry · Not authenticated')).toBeInTheDocument()
        expect(retry).toHaveBeenCalledWith('gpt-5')
    })

    it('opens model settings only when selector access is enabled', () => {
        const open = vi.fn()
        const { rerender } = renderStatusBar({
            canOpenModelSelector: false,
            onModelInfoClick: open,
        })

        fireEvent.click(screen.getByLabelText('Model gpt-5'))
        expect(open).not.toHaveBeenCalled()
        expect(screen.getByText('Switching unavailable for this runtime')).toBeInTheDocument()

        rerender(
            <I18nProvider>
                <StatusBar
                    active
                    thinking={false}
                    agentState={null}
                    model="gpt-5"
                    canOpenModelSelector
                    onModelInfoClick={open}
                />
            </I18nProvider>
        )

        fireEvent.click(screen.getByLabelText('Model gpt-5'))
        expect(open).toHaveBeenCalledTimes(1)
    })
})
