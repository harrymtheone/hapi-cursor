import { afterEach, describe, it, expect, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import type { ToolCallBlock } from '@/chat/types'
import { I18nProvider } from '@/lib/i18n-context'
import { BashResult } from './BashResult'

afterEach(() => cleanup())

vi.mock('@/components/MarkdownRenderer', () => ({
    MarkdownRenderer: (props: { content: string; className?: string }) => (
        <div className={props.className}>{props.content}</div>
    )
}))

vi.mock('@/components/CodeBlock', () => ({
    CodeBlock: (props: { code: string; language?: string; title?: string }) => (
        <div>
            {props.title ? <div>{props.title}</div> : null}
            <pre data-language={props.language ?? 'text'}>
                <code>{props.code}</code>
            </pre>
        </div>
    )
}))

function renderBash(result: unknown) {
    const block: ToolCallBlock = {
        id: 'tool-bash',
        localId: null,
        createdAt: 0,
        kind: 'tool-call',
        children: [],
        tool: {
            id: 'tool-bash',
            name: 'Bash',
            state: 'completed',
            input: {},
            result,
            createdAt: 0,
            startedAt: null,
            completedAt: 0,
            description: null,
        },
    }
    return render(
        <I18nProvider>
            <BashResult block={block} metadata={null} surface="inline" />
        </I18nProvider>
    )
}

describe('BashResult', () => {
    it('renders stdout and stderr titled blocks separately when both are present', () => {
        const { container } = renderBash({ stdout: 'hello\n', stderr: 'oops\n' })
        expect(container).toHaveTextContent('stdout')
        expect(container).toHaveTextContent('stderr')
        expect(container).toHaveTextContent('hello')
        expect(container).toHaveTextContent('oops')
    })

    it('renders a string result as a single code block', () => {
        const { container } = renderBash('total 0\ndrwxr-xr-x  3 root root  96 Jan 01 12:00 .')
        expect(container.querySelectorAll('pre').length).toBeGreaterThanOrEqual(1)
        expect(container).toHaveTextContent('total 0')
    })

    it('shows a (no output) pill when result is null', () => {
        const { container } = renderBash(null)
        expect(container).toHaveTextContent('(no output)')
        expect(screen.queryByText('stdout')).toBeNull()
    })
})
