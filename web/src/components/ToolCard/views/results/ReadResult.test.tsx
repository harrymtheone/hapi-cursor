import { afterEach, describe, it, expect, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import type { ToolCallBlock } from '@/chat/types'
import { I18nProvider } from '@/lib/i18n-context'
import { ReadResult } from './ReadResult'

afterEach(() => cleanup())

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

function renderRead(result: unknown, input: unknown = {}) {
    const block: ToolCallBlock = {
        id: 'tool-read',
        localId: null,
        createdAt: 0,
        kind: 'tool-call',
        children: [],
        tool: {
            id: 'tool-read',
            name: 'Read',
            state: 'completed',
            input,
            result,
            createdAt: 0,
            startedAt: null,
            completedAt: 0,
            description: null,
        },
    }
    return render(
        <I18nProvider>
            <ReadResult block={block} metadata={null} surface="dialog" />
        </I18nProvider>
    )
}

describe('ReadResult', () => {
    it('renders source file content as a code block (with file basename)', () => {
        const { container } = renderRead({
            file: { filePath: '/tmp/example.ts', content: 'const value = 1\nexport { value }' }
        })
        expect(container.querySelector('[class*="border-l-"]')).toBeNull()
        expect(container.querySelector('pre')).not.toBeNull()
        expect(container).toHaveTextContent('File content')
        expect(container).toHaveTextContent('const value = 1')
        expect(screen.getAllByText('Raw JSON').length).toBeGreaterThan(0)
    })

    it('renders plain read output as a quote', () => {
        const { container } = renderRead({
            file: { filePath: '/tmp/notes.txt', content: 'plain notes from the workspace' }
        })
        const quote = container.querySelector('[class*="border-l-"]')
        expect(quote).toHaveTextContent('plain notes from the workspace')
        expect(quote).toHaveClass('tool-result-quote')
        expect(quote?.querySelector('pre')).toBeNull()
    })

    it('falls back to a status pill when no result is present', () => {
        const { container } = renderRead(null)
        expect(container).toHaveTextContent('(no output)')
    })
})
