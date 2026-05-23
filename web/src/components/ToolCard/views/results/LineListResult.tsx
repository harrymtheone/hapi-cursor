import type { ToolViewComponent, ToolViewProps } from '@/components/ToolCard/views/_all'
import {
    RawJsonDevOnly,
    ResultStatusPill,
    extractLineList,
    extractTextFromResult,
    isProbablyMarkdownList,
    placeholderForState,
    renderMarkdown,
    renderResultBody,
} from './_resultHelpers'

export const LineListResult: ToolViewComponent = (props: ToolViewProps) => {
    const result = props.block.tool.result

    if (result === undefined || result === null) {
        return <ResultStatusPill text={placeholderForState(props.block.tool.state)} />
    }

    const text = extractTextFromResult(result)
    if (!text) {
        return (
            <>
                <ResultStatusPill text="(no output)" />
                <RawJsonDevOnly value={result} surface={props.surface} />
            </>
        )
    }

    if (isProbablyMarkdownList(text)) {
        return (
            <>
                {renderResultBody(renderMarkdown(text, props.surface), props.surface)}
                <RawJsonDevOnly value={result} surface={props.surface} />
            </>
        )
    }

    const lines = extractLineList(text)
    if (lines.length === 0) {
        return (
            <>
                <ResultStatusPill text="(no output)" />
                <RawJsonDevOnly value={result} surface={props.surface} />
            </>
        )
    }

    return (
        <>
            {renderResultBody(
                <div className="flex flex-col gap-1">
                    {lines.map((line) => (
                        <div key={line} className={props.surface === 'dialog' ? 'text-sm font-mono text-[var(--app-md-quote-fg)] break-all' : 'text-sm font-mono text-[var(--app-fg)] break-all'}>
                            {line}
                        </div>
                    ))}
                </div>,
                props.surface
            )}
            <RawJsonDevOnly value={result} surface={props.surface} />
        </>
    )
}
