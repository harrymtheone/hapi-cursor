import { describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ApiClient } from '@/api/client'
import type { ToolCallBlock } from '@/chat/types'
import { I18nProvider } from '@/lib/i18n-context'
import { ToolCard } from '@/components/ToolCard/ToolCard'
import { knownTools } from '@/components/ToolCard/knownTools'

vi.mock('@/components/MarkdownRenderer', () => ({
    MarkdownRenderer: (props: { content: string; className?: string }) => (
        <div className={props.className}>{props.content}</div>
    )
}))

vi.mock('@/components/CodeBlock', () => ({
    CodeBlock: (props: { code: string; language?: string; title?: string; className?: string }) => (
        <div className={props.className}>
            {props.title ? <div>{props.title}</div> : null}
            <pre data-language={props.language ?? 'text'}>
                <code>{props.code}</code>
            </pre>
        </div>
    )
}))

function makeMinimalProps(toolName: string) {
    const block: ToolCallBlock = {
        kind: 'tool-call',
        id: 'tool-call-1',
        localId: null,
        createdAt: 0,
        tool: {
            id: 'tool-call-1',
            name: toolName,
            state: 'completed',
            input: {},
            createdAt: 0,
            startedAt: 0,
            completedAt: 0,
            description: null,
            result: null,
        },
        children: [],
    }
    return {
        api: {} as ApiClient,
        sessionId: 'session-1',
        metadata: null,
        terminalToolDisplayMode: 'detailed' as const,
        disabled: false,
        onDone: () => {},
        block,
    }
}

function renderToolCard(toolName: string) {
    const client = new QueryClient({
        defaultOptions: { queries: { retry: false, gcTime: 0 } },
    })
    return render(
        <QueryClientProvider client={client}>
            <I18nProvider>
                <ToolCard {...makeMinimalProps(toolName)} />
            </I18nProvider>
        </QueryClientProvider>
    )
}

describe('ToolCard integration — knownTools registry → renderer', () => {
    const knownNames = Object.keys(knownTools)

    it('registers at least one known tool', () => {
        expect(knownNames.length).toBeGreaterThan(0)
    })

    it.each(knownNames)('renders %s without hitting the unknown-fallback', (toolName) => {
        const { container, queryByTestId } = renderToolCard(toolName)
        expect(container).toBeTruthy()
        expect(queryByTestId('tool-card-unknown-fallback')).toBeNull()
    })

    it('negative control: an unregistered tool DOES hit the unknown-fallback', () => {
        const { queryByTestId } = renderToolCard('definitely_not_a_known_tool_xyz')
        expect(queryByTestId('tool-card-unknown-fallback')).not.toBeNull()
    })
})
