import { afterEach, describe, it, expect, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import type { ToolCallBlock } from '@/chat/types'
import { I18nProvider } from '@/lib/i18n-context'
import { LineListResult } from './LineListResult'

afterEach(() => cleanup())

vi.mock('@/components/MarkdownRenderer', () => ({
    MarkdownRenderer: (props: { content: string; className?: string }) => (
        <div className={props.className}>{props.content}</div>
    )
}))

vi.mock('@/components/CodeBlock', () => ({
    CodeBlock: (props: { code: string }) => <pre><code>{props.code}</code></pre>,
}))

function renderLineList(result: unknown) {
    const block: ToolCallBlock = {
        id: 'tool-glob',
        localId: null,
        createdAt: 0,
        kind: 'tool-call',
        children: [],
        tool: {
            id: 'tool-glob',
            name: 'Glob',
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
            <LineListResult block={block} metadata={null} surface="dialog" />
        </I18nProvider>
    )
}

describe('LineListResult', () => {
    it('renders each non-blank line on its own row when the result is plain text', () => {
        const { container } = renderLineList('src/foo.ts\nsrc/bar.ts\n\nsrc/baz.ts')
        expect(container).toHaveTextContent('src/foo.ts')
        expect(container).toHaveTextContent('src/bar.ts')
        expect(container).toHaveTextContent('src/baz.ts')
    })

    it('renders markdown-list-shaped output through the markdown path instead of line dispatch', () => {
        const { container } = renderLineList('- one\n- two\n- three')
        expect(container.querySelector('[class*="border-l-"]')).not.toBeNull()
        expect(container).toHaveTextContent('- one')
    })

    it('shows a (no output) pill when there is no extractable text', () => {
        const { container } = renderLineList({})
        expect(container).toHaveTextContent('(no output)')
    })
})
