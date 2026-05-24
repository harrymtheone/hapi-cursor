import { afterEach, describe, expect, it, vi } from 'vitest'
import { type ReactNode } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { I18nProvider } from '@/lib/i18n-context'
import { HappyComposer } from './HappyComposer'

vi.mock('@assistant-ui/react', async () => {
    const React = await import('react')
    return {
        ComposerPrimitive: {
            Root: ({ children, onSubmit, className }: { children: ReactNode; onSubmit?: () => void; className?: string }) => (
                <form className={className} onSubmit={(event) => { event.preventDefault(); onSubmit?.() }}>
                    {children}
                </form>
            ),
            Input: React.forwardRef<HTMLTextAreaElement, Record<string, unknown>>(function Input(props, ref) {
                const {
                    className,
                    disabled,
                    placeholder,
                    onChange,
                    onSelect,
                    onKeyDown,
                    onPaste,
                } = props
                return (
                    <textarea
                        ref={ref}
                        className={className as string}
                        disabled={disabled as boolean}
                        placeholder={placeholder as string}
                        onChange={onChange as never}
                        onSelect={onSelect as never}
                        onKeyDown={onKeyDown as never}
                        onPaste={onPaste as never}
                    />
                )
            }),
            Attachments: () => null,
            AddAttachment: ({ children, ...props }: { children: ReactNode }) => (
                <button type="button" {...props}>
                    {children}
                </button>
            ),
        },
        useAssistantApi: () => ({
            composer: () => ({ setText: vi.fn(), addAttachment: vi.fn(), send: vi.fn() }),
            thread: () => ({ cancelRun: vi.fn() }),
        }),
        useAssistantState: (selector: (state: unknown) => unknown) =>
            selector({
                composer: { text: '', attachments: [] },
                thread: { isRunning: false, isDisabled: false },
            }),
    }
})

vi.mock('@hapi/protocol', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@hapi/protocol')>()
    return {
        ...actual,
        getPermissionModeOptionsForFlavor: () => [],
        supportsModelChange: () => true,
    }
})

vi.mock('@/hooks/useComposerEnterBehavior', () => ({
    useComposerEnterBehavior: () => ({ composerEnterBehavior: 'send', setComposerEnterBehavior: vi.fn() }),
    getComposerEnterBehaviorOptions: () => [],
}))

vi.mock('@/hooks/useComposerDraft', () => ({
    useComposerDraft: () => undefined,
}))

vi.mock('@/hooks/usePlatform', () => ({
    usePlatform: () => ({
        haptic: { impact: vi.fn(), notification: vi.fn() },
        isTouch: false,
    }),
}))

vi.mock('@/hooks/usePWAInstall', () => ({
    usePWAInstall: () => ({ isStandalone: false, isIOS: false }),
}))

vi.mock('@/hooks/useActiveWord', () => ({
    useActiveWord: () => null,
}))

vi.mock('@/hooks/useActiveSuggestions', () => ({
    useActiveSuggestions: () => [[], -1, vi.fn(), vi.fn(), vi.fn()] as const,
}))

afterEach(() => cleanup())

const runtimeOptions = [
    { value: null, label: 'Auto (unspecified)' },
    { value: 'gpt-5', label: 'gpt-5' },
    { value: 'gpt-5-high', label: 'gpt-5-high' },
    { value: 'cursor-raw-opus', label: 'cursor-raw-opus - Cursor Raw Opus' },
]

function renderComposer(props: Partial<Parameters<typeof HappyComposer>[0]> = {}) {
    return render(
        <I18nProvider>
            <HappyComposer
                active
                thinking={false}
                agentState={null}
                model="gpt-5"
                modelReasoningEffort="high"
                agentFlavor="cursor"
                onModelChange={vi.fn()}
                availableModelOptions={runtimeOptions}
                {...props}
            />
        </I18nProvider>
    )
}

describe('HappyComposer', () => {
    it('renders composer-adjacent model and effort display', () => {
        renderComposer()

        expect(screen.getByText('gpt-5')).toBeInTheDocument()
        expect(screen.getByText('high')).toBeInTheDocument()
    })

    it('renders stored effort metadata without effort controls', () => {
        renderComposer({
            modelReasoningEffort: null,
            effort: 'medium',
        })

        expect(screen.getByText('medium')).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: /effort/i })).not.toBeInTheDocument()
    })

    it('does not open the model selector when runtime switching is unsupported', () => {
        renderComposer({ runtimeModelSwitchSupported: false })

        fireEvent.click(screen.getByLabelText('Model gpt-5'))

        expect(screen.queryByRole('button', { name: 'gpt-5-high' })).not.toBeInTheDocument()
        expect(screen.getByText('Switching unavailable for this runtime')).toBeInTheDocument()
    })

    it('opens discovered runtime model options when runtime switching is supported and idle', () => {
        const onModelChange = vi.fn()
        renderComposer({ runtimeModelSwitchSupported: true, onModelChange })

        fireEvent.click(screen.getByLabelText('Model gpt-5'))

        expect(screen.getByRole('button', { name: 'cursor-raw-opus - Cursor Raw Opus' })).toBeInTheDocument()
        expect(screen.queryByText('Switching unavailable for this runtime')).not.toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: 'cursor-raw-opus - Cursor Raw Opus' }))

        expect(onModelChange).toHaveBeenCalledWith('cursor-raw-opus')
    })

    it('renders applies-next-run and failed switch feedback next to the composer', () => {
        const { rerender } = renderComposer({
            modelSwitchState: { status: 'applies-next-run', targetModel: 'gpt-5' },
        })

        expect(screen.getByText('Applies next message')).toBeInTheDocument()

        rerender(
            <I18nProvider>
                <HappyComposer
                    active
                    thinking={false}
                    agentState={null}
                    model="gpt-5"
                    agentFlavor="cursor"
                    modelSwitchState={{ status: 'failed', targetModel: 'gpt-5', reason: 'timed-out' }}
                    onModelChange={vi.fn()}
                    availableModelOptions={runtimeOptions}
                />
            </I18nProvider>
        )

        expect(screen.getByText('Switch failed. Retry · Timed out')).toBeInTheDocument()
    })
})
