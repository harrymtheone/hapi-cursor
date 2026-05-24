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

    it('big model label stays on previousModel while switch state is applying or applies-next-run (gated until session-updated patch arrives)', () => {
        // Simulates Hub's optimistic write: props.model has already flipped to the
        // target model while modelSwitchState is still pending. The gate must keep
        // the BIG label on previousModel to avoid the mid-flight flicker.
        const switchPending = {
            status: 'applies-next-run' as const,
            targetModel: 'cursor-runtime-model-next',
            previousModel: 'cursor-runtime-model-current'
        }
        const { rerender } = renderStatusBar({
            model: 'cursor-runtime-model-next',
            modelSwitchState: switchPending
        })

        expect(screen.getByLabelText('Model cursor-runtime-model-current')).toBeInTheDocument()
        expect(screen.getByText('cursor-runtime-model-current')).toBeInTheDocument()

        const applyingState = {
            status: 'applying' as const,
            targetModel: 'cursor-runtime-model-next',
            previousModel: 'cursor-runtime-model-current'
        }
        rerender(
            <I18nProvider>
                <StatusBar
                    active
                    thinking={false}
                    agentState={null}
                    model="cursor-runtime-model-next"
                    modelSwitchState={applyingState}
                />
            </I18nProvider>
        )
        expect(screen.getByLabelText('Model cursor-runtime-model-current')).toBeInTheDocument()

        rerender(
            <I18nProvider>
                <StatusBar
                    active
                    thinking={false}
                    agentState={null}
                    model="cursor-runtime-model-next"
                    modelSwitchState={{ status: 'idle' }}
                />
            </I18nProvider>
        )
        expect(screen.getByLabelText('Model cursor-runtime-model-next')).toBeInTheDocument()
        expect(screen.queryByText('Applies next message')).not.toBeInTheDocument()
        expect(screen.queryByText('Applies next run')).not.toBeInTheDocument()

        rerender(
            <I18nProvider>
                <StatusBar
                    active
                    thinking={false}
                    agentState={null}
                    model="cursor-runtime-model-current"
                    modelSwitchState={{ status: 'idle' }}
                />
            </I18nProvider>
        )
        expect(screen.getByLabelText('Model cursor-runtime-model-current')).toBeInTheDocument()
    })

    it('applies-next-run renders Applies next message copy in en and 下一条消息生效 in zh-CN (locale rename, status enum unchanged)', () => {
        const switchState = {
            status: 'applies-next-run' as const,
            targetModel: 'X',
            previousModel: 'Y'
        }
        render(
            <I18nProvider>
                <StatusBar
                    active
                    thinking={false}
                    agentState={null}
                    model="Y"
                    modelSwitchState={switchState}
                />
            </I18nProvider>
        )
        expect(screen.getByText('Applies next message')).toBeInTheDocument()
        expect(screen.queryByText('Applies next run')).not.toBeInTheDocument()

        cleanup()
        localStorage.setItem('hapi-lang', 'zh-CN')
        try {
            render(
                <I18nProvider>
                    <StatusBar
                        active
                        thinking={false}
                        agentState={null}
                        model="Y"
                        modelSwitchState={switchState}
                    />
                </I18nProvider>
            )
            expect(screen.getByText('下一条消息生效')).toBeInTheDocument()
            expect(screen.queryByText('下次运行生效')).not.toBeInTheDocument()
        } finally {
            localStorage.removeItem('hapi-lang')
        }
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
