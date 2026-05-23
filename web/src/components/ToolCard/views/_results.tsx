import { safeStringify } from '@hapi/protocol'
import { CodeBlock } from '@/components/CodeBlock'
import { ChecklistList, extractTodoChecklist } from '@/components/ToolCard/checklist'
import { getInputStringAny } from '@/lib/toolInputUtils'
import type { ToolViewComponent, ToolViewProps } from '@/components/ToolCard/views/_all'
import {
    RawJsonDevOnly,
    ResultStatusPill,
    extractTextFromResult,
    extractReadPathFromInput,
    getMutationResultRenderMode,
    isReadFileToolCall,
    placeholderForState,
    renderReadTextResult,
    renderText,
    resultCodeBlockProps,
} from './results/_resultHelpers'
import { BashResult } from './results/BashResult'
import { LineListResult } from './results/LineListResult'
import { ReadResult } from './results/ReadResult'

// Re-export the public surface that external callers consume directly
// (registered toolbar / external tests). PRESERVE these — see Phase 9 D-152.
export { extractTextFromResult, getMutationResultRenderMode } from './results/_resultHelpers'

const AskUserQuestionResult: ToolViewComponent = (props: ToolViewProps) => {
    const answers = props.block.tool.permission?.answers ?? null
    if (answers && Object.keys(answers).length > 0) {
        return null
    }
    return <MarkdownResult {...props} />
}

const MarkdownResult: ToolViewComponent = (props: ToolViewProps) => {
    const result = props.block.tool.result

    if (result === undefined || result === null) {
        return <ResultStatusPill text={placeholderForState(props.block.tool.state)} />
    }

    const text = extractTextFromResult(result)
    if (text) {
        return (
            <>
                {renderText(text, { mode: 'auto', collapseLongContent: props.surface === 'inline', surface: props.surface })}
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

const MutationResult: ToolViewComponent = (props: ToolViewProps) => {
    const { state, result } = props.block.tool

    if (result === undefined || result === null) {
        if (state === 'completed') {
            return <ResultStatusPill text="Done" />
        }
        return <ResultStatusPill text={placeholderForState(state)} />
    }

    const text = extractTextFromResult(result)
    if (typeof text === 'string' && text.trim().length > 0) {
        const className = state === 'error' ? 'text-red-600' : 'text-[var(--app-fg)]'
        const { mode, language } = getMutationResultRenderMode(text, state)
        return (
            <>
                <div className={`text-sm ${className}`}>
                    {renderText(text, { mode, language, collapseLongContent: props.surface === 'inline', surface: props.surface })}
                </div>
                <RawJsonDevOnly value={result} surface={props.surface} />
            </>
        )
    }

    return (
        <>
            <ResultStatusPill text={state === 'completed' ? 'Done' : '(no output)'} />
            <RawJsonDevOnly value={result} surface={props.surface} />
        </>
    )
}

const TodoWriteResult: ToolViewComponent = (props: ToolViewProps) => {
    const todos = extractTodoChecklist(props.block.tool.input, props.block.tool.result)
    if (todos.length === 0) {
        return <ResultStatusPill text={placeholderForState(props.block.tool.state)} />
    }
    return <ChecklistList items={todos} />
}

const SkillResult: ToolViewComponent = (props: ToolViewProps) => {
    const { state, result, input } = props.block.tool

    if (result === undefined || result === null) {
        if (state === 'completed') {
            return <ResultStatusPill text="Skill loaded" />
        }
        return <ResultStatusPill text={placeholderForState(state)} />
    }

    if (state === 'error') {
        const text = extractTextFromResult(result)
        return (
            <div className="text-sm text-red-600">
                {text?.trim() ? text : 'Failed to load skill'}
            </div>
        )
    }

    const skillName = getInputStringAny(input, ['skill'])
    return <ResultStatusPill text={skillName ? `Skill "${skillName}" loaded` : 'Skill loaded'} />
}

const GenericResult: ToolViewComponent = (props: ToolViewProps) => {
    const result = props.block.tool.result

    if (result === undefined || result === null) {
        return <ResultStatusPill text={placeholderForState(props.block.tool.state)} />
    }

    const text = extractTextFromResult(result)
    if (text) {
        return (
            <>
                {isReadFileToolCall(props.block.tool.name, props.block.tool.input)
                    ? renderReadTextResult(text, extractReadPathFromInput(props.block.tool.input), props.surface)
                    : renderText(text, { mode: 'auto', collapseLongContent: props.surface === 'inline', surface: props.surface })}
                {typeof result === 'object' ? <RawJsonDevOnly value={result} surface={props.surface} /> : null}
            </>
        )
    }

    if (typeof result === 'string') {
        return renderText(result, { mode: 'auto', collapseLongContent: props.surface === 'inline', surface: props.surface })
    }

    return <CodeBlock code={safeStringify(result)} language="json" title="JSON" {...resultCodeBlockProps(props.surface, props.surface === 'inline')} />
}

export const toolResultViewRegistry: Record<string, ToolViewComponent> = {
    Task: MarkdownResult,
    Bash: BashResult,
    Glob: LineListResult,
    Grep: LineListResult,
    LS: LineListResult,
    Read: ReadResult,
    Edit: MutationResult,
    MultiEdit: MutationResult,
    Write: MutationResult,
    WebFetch: MarkdownResult,
    WebSearch: MarkdownResult,
    NotebookRead: ReadResult,
    NotebookEdit: MutationResult,
    TodoWrite: TodoWriteResult,
    Skill: SkillResult,
    AskUserQuestion: AskUserQuestionResult,
    ExitPlanMode: MarkdownResult,
    ask_user_question: AskUserQuestionResult,
    exit_plan_mode: MarkdownResult
}

export function getToolResultViewComponent(toolName: string): ToolViewComponent {
    if (toolName.startsWith('mcp__')) {
        return GenericResult
    }
    return toolResultViewRegistry[toolName] ?? GenericResult
}
