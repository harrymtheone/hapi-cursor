import { CodeBlock } from '@/components/CodeBlock'
import type { ToolViewComponent, ToolViewProps } from '@/components/ToolCard/views/_all'
import {
    RawJsonDevOnly,
    ResultStatusPill,
    extractStdoutStderr,
    extractTextFromResult,
    parseToolUseError,
    placeholderForState,
    renderText,
    resultCodeBlockProps,
} from './_resultHelpers'

export const BashResult: ToolViewComponent = (props: ToolViewProps) => {
    const result = props.block.tool.result

    if (result === undefined || result === null) {
        return <ResultStatusPill text={placeholderForState(props.block.tool.state)} />
    }

    if (typeof result === 'string') {
        const toolUseError = parseToolUseError(result)
        const display = toolUseError.isToolUseError ? (toolUseError.errorMessage ?? '') : result
        return (
            <>
                <CodeBlock code={display} language="text" {...resultCodeBlockProps(props.surface, props.surface === 'inline')} />
                <RawJsonDevOnly value={result} surface={props.surface} />
            </>
        )
    }

    const stdio = extractStdoutStderr(result)
    if (stdio) {
        return (
            <>
                <div className="flex flex-col gap-2">
                    {stdio.stdout ? <CodeBlock code={stdio.stdout} language="text" title="stdout" {...resultCodeBlockProps(props.surface, props.surface === 'inline')} /> : null}
                    {stdio.stderr ? <CodeBlock code={stdio.stderr} language="text" title="stderr" {...resultCodeBlockProps(props.surface, props.surface === 'inline')} /> : null}
                </div>
                <RawJsonDevOnly value={result} surface={props.surface} />
            </>
        )
    }

    const text = extractTextFromResult(result)
    if (text) {
        return (
            <>
                {renderText(text, { mode: 'code', language: 'text', collapseLongContent: props.surface === 'inline', surface: props.surface })}
                <RawJsonDevOnly value={result} surface={props.surface} />
            </>
        )
    }

    return (
        <>
            <ResultStatusPill text="(no output)" />
            <RawJsonDevOnly value={result} surface={props.surface} />
        </>
    )
}
