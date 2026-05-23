import { basename, resolveDisplayPath } from '@/utils/path'
import type { ToolViewComponent, ToolViewProps } from '@/components/ToolCard/views/_all'
import {
    RawJsonDevOnly,
    ResultStatusPill,
    extractReadFileContent,
    extractReadPathFromInput,
    extractTextFromResult,
    placeholderForState,
    renderReadTextResult,
} from './_resultHelpers'

export const ReadResult: ToolViewComponent = (props: ToolViewProps) => {
    const result = props.block.tool.result

    if (result === undefined || result === null) {
        return <ResultStatusPill text={placeholderForState(props.block.tool.state)} />
    }

    const file = extractReadFileContent(result)
    if (file) {
        const path = file.filePath ? resolveDisplayPath(file.filePath, props.metadata) : null
        return (
            <>
                {path ? (
                    <div className="mb-2 text-xs text-[var(--app-hint)] font-mono break-all">
                        {basename(path)}
                    </div>
                ) : null}
                {renderReadTextResult(file.content, path, props.surface)}
                <RawJsonDevOnly value={result} surface={props.surface} />
            </>
        )
    }

    const text = extractTextFromResult(result)
    if (text) {
        const path = extractReadPathFromInput(props.block.tool.input)
        const displayPath = path ? resolveDisplayPath(path, props.metadata) : null
        return (
            <>
                {renderReadTextResult(text, displayPath, props.surface)}
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
