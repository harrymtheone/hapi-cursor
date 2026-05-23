import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ComponentProps, ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CursorRuntimeConfigApplyResult, Session } from '@hapi/protocol/types'
import { I18nProvider } from '@/lib/i18n-context'
import { SessionChat } from './SessionChat'

let composerProps: ComponentProps<typeof import('@/components/AssistantChat/HappyComposer').HappyComposer> | null = null
let threadProps: Record<string, unknown> | null = null
let setModelMock: ReturnType<typeof vi.fn>
const hapticNotification = vi.fn()

vi.mock('@tanstack/react-router', () => ({
    useNavigate: () => vi.fn()
}))

vi.mock('@/hooks/usePlatform', () => ({
    usePlatform: () => ({
        haptic: {
            notification: hapticNotification
        }
    })
}))

vi.mock('@/hooks/mutations/useSessionActions', () => ({
    useSessionActions: () => ({
        abortSession: vi.fn(),
        switchSession: vi.fn(),
        setPermissionMode: vi.fn(),
        setModel: setModelMock,
        setEffort: vi.fn()
    })
}))

vi.mock('@/lib/assistant-runtime', () => ({
    useHappyRuntime: () => ({})
}))

vi.mock('@assistant-ui/react', () => ({
    AssistantRuntimeProvider: ({ children }: { children: ReactNode }) => <div>{children}</div>
}))

vi.mock('@/components/SessionHeader', () => ({
    SessionHeader: () => <div data-testid="session-header" />
}))

vi.mock('@/components/TeamPanel', () => ({
    TeamPanel: () => <div data-testid="team-panel" />
}))

vi.mock('@/components/AssistantChat/HappyThread', () => ({
    HappyThread: (props: Record<string, unknown>) => {
        threadProps = props
        return <div data-testid="happy-thread" data-raw-count={String(props.rawMessagesCount)} />
    }
}))

vi.mock('@/components/AssistantChat/QueuedMessagesBar', () => ({
    QueuedMessagesBar: () => <div data-testid="queued-messages" />
}))

vi.mock('@/components/AssistantChat/HappyComposer', () => ({
    HappyComposer: (props: ComponentProps<typeof import('@/components/AssistantChat/HappyComposer').HappyComposer>) => {
        composerProps = props
        return (
            <button type="button" onClick={() => props.onModelChange?.('cursor-next')}>
                switch model
            </button>
        )
    }
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
        messagesVersion: 1,
        agentStateVersion: 1,
        agentState: null,
        teamState: null,
        activePermissionRequest: null,
        mode: 'local',
        thinking: false,
        backgroundTaskCount: 0,
        model: 'cursor-old',
        modelReasoningEffort: null,
        effort: null,
        permissionMode: 'default',
        ...overrides
    }
}

function renderSessionChat(setModelResult: CursorRuntimeConfigApplyResult | Promise<CursorRuntimeConfigApplyResult>) {
    const queryClient = new QueryClient({
        defaultOptions: {
            mutations: { retry: false },
            queries: { retry: false }
        }
    })
    setModelMock = vi.fn(async () => await setModelResult)
    const onRefresh = vi.fn()

    render(
        <QueryClientProvider client={queryClient}>
            <I18nProvider>
                <SessionChat
                    api={{} as never}
                    session={createSession()}
                    messages={[]}
                    messagesWarning={null}
                    hasMoreMessages={false}
                    isLoadingMessages={false}
                    isLoadingMoreMessages={false}
                    isSending={false}
                    pendingCount={0}
                    messagesVersion={1}
                    onBack={vi.fn()}
                    onRefresh={onRefresh}
                    onLoadMore={vi.fn()}
                    onSend={vi.fn(async () => true)}
                    onFlushPending={vi.fn()}
                    onAtBottomChange={vi.fn()}
                />
            </I18nProvider>
        </QueryClientProvider>
    )

    return { onRefresh }
}

describe('SessionChat model switch state', () => {
    beforeEach(() => {
        composerProps = null
        threadProps = null
        setModelMock = vi.fn()
        hapticNotification.mockClear()
    })

    afterEach(() => cleanup())

    it('passes applying then applied model switch state to the composer without adding timeline messages', async () => {
        const applyResult: CursorRuntimeConfigApplyResult = {
            status: 'applied',
            model: 'cursor-next',
            modelReasoningEffort: null,
            effort: null
        }
        const { onRefresh } = renderSessionChat(applyResult)

        expect(composerProps?.modelSwitchState).toEqual({ status: 'idle' })

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'switch model' }))
            expect(composerProps?.modelSwitchState).toEqual({ status: 'applying' })
        })

        await waitFor(() => {
            expect(composerProps?.modelSwitchState).toEqual({ status: 'applied' })
        })
        expect(hapticNotification).toHaveBeenCalledWith('success')
        expect(onRefresh).toHaveBeenCalledTimes(1)
        expect(threadProps?.rawMessagesCount).toBe(0)
        expect(screen.getByTestId('happy-thread')).toHaveAttribute('data-raw-count', '0')
    })

    it('propagates applies-next-run and failed statuses to the composer', async () => {
        const appliesNextRun: CursorRuntimeConfigApplyResult = {
            status: 'applies-next-run',
            model: 'cursor-next',
            modelReasoningEffort: null,
            effort: null,
            reason: 'unknown'
        }
        const failed: CursorRuntimeConfigApplyResult = {
            status: 'failed',
            model: 'cursor-old',
            modelReasoningEffort: null,
            effort: null,
            reason: 'not-authenticated'
        }

        renderSessionChat(appliesNextRun)
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'switch model' }))
        })
        await waitFor(() => {
            expect(composerProps?.modelSwitchState).toEqual({ status: 'applies-next-run', reason: 'unknown' })
        })
        expect(hapticNotification).toHaveBeenLastCalledWith('success')

        cleanup()
        renderSessionChat(failed)
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'switch model' }))
        })
        await waitFor(() => {
            expect(composerProps?.modelSwitchState).toEqual({ status: 'failed', reason: 'not-authenticated' })
        })
        expect(hapticNotification).toHaveBeenLastCalledWith('error')
    })

    it('stores rejected model mutations as failed switch state and triggers error haptic', async () => {
        renderSessionChat(Promise.reject(new Error('HTTP 409')))

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: 'switch model' }))
        })

        await waitFor(() => {
            expect(composerProps?.modelSwitchState).toEqual({ status: 'failed' })
        })
        expect(hapticNotification).toHaveBeenCalledWith('error')
        expect(threadProps?.rawMessagesCount).toBe(0)
    })
})
