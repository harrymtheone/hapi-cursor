import type { ReactNode } from 'react'
import type { SessionSummaryMetadata } from '@/types/api'
import { isObject } from '@hapi/protocol'
import { BulbIcon, ClipboardIcon, EyeIcon, FileDiffIcon, GlobeIcon, MessageSquareIcon, PuzzleIcon, QuestionIcon, RocketIcon, SearchIcon, TerminalIcon, UsersIcon, WrenchIcon } from '@/components/ToolCard/icons'
import type { ChecklistItem } from '@/components/ToolCard/checklist'
import { extractTodoChecklist, extractUpdatePlanChecklist } from '@/components/ToolCard/checklist'
import { resolveDisplayPath } from '@/utils/path'
import { getInputStringAny, truncate } from '@/lib/toolInputUtils'

const DEFAULT_ICON_CLASS = 'h-3.5 w-3.5'
// Tool presentation registry for `hapi/web` (aligned with `hapi-app`).

export type ToolPresentation = {
    icon: ReactNode
    title: string
    subtitle: string | null
    minimal: boolean
}

function countLines(text: string): number {
    return text.split('\n').length
}

function formatChecklistCount(items: ChecklistItem[], noun: string): string | null {
    if (items.length === 0) return null
    return `${items.length} ${noun}${items.length === 1 ? '' : 's'}`
}

function snakeToTitleWithSpaces(value: string): string {
    return value
        .split('_')
        .filter((part) => part.length > 0)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
        .join(' ')
}

function formatMCPTitle(toolName: string): string {
    const withoutPrefix = toolName.replace(/^mcp__/, '')
    const parts = withoutPrefix.split('__')
    if (parts.length >= 2) {
        const serverName = snakeToTitleWithSpaces(parts[0])
        const toolPart = snakeToTitleWithSpaces(parts.slice(1).join('_'))
        return `MCP: ${serverName} ${toolPart}`
    }
    return `MCP: ${snakeToTitleWithSpaces(withoutPrefix)}`
}

type ToolOpts = {
    toolName: string
    input: unknown
    result: unknown
    childrenCount: number
    description: string | null
    metadata: SessionSummaryMetadata | null
}

export const knownTools: Record<string, {
    icon: (opts: ToolOpts) => ReactNode
    title: (opts: ToolOpts) => string
    subtitle?: (opts: ToolOpts) => string | null
    minimal?: boolean | ((opts: ToolOpts) => boolean)
}> = {
    Task: {
        icon: () => <RocketIcon className={DEFAULT_ICON_CLASS} />,
        title: (opts) => {
            const name = getInputStringAny(opts.input, ['name'])
            const teamName = getInputStringAny(opts.input, ['team_name'])
            if (name && teamName) return `Agent: ${name}`
            const description = getInputStringAny(opts.input, ['description'])
            return description ?? 'Task'
        },
        subtitle: (opts) => {
            const prompt = getInputStringAny(opts.input, ['prompt'])
            return prompt ? truncate(prompt, 120) : null
        },
        minimal: (opts) => opts.childrenCount === 0
    },
    TeamCreate: {
        icon: () => <UsersIcon className={DEFAULT_ICON_CLASS} />,
        title: (opts) => {
            const teamName = getInputStringAny(opts.input, ['team_name'])
            return teamName ? `Team: ${teamName}` : 'Create Team'
        },
        subtitle: (opts) => getInputStringAny(opts.input, ['description']) ?? null,
        minimal: false
    },
    TeamDelete: {
        icon: () => <UsersIcon className={DEFAULT_ICON_CLASS} />,
        title: () => 'Delete Team',
        minimal: true
    },
    SendMessage: {
        icon: () => <MessageSquareIcon className={DEFAULT_ICON_CLASS} />,
        title: (opts) => {
            const recipient = getInputStringAny(opts.input, ['recipient'])
            const msgType = getInputStringAny(opts.input, ['type'])
            if (msgType === 'broadcast') return 'Broadcast'
            if (msgType === 'shutdown_request') return `Shutdown: ${recipient ?? 'agent'}`
            if (msgType === 'shutdown_response') return 'Shutdown Response'
            return recipient ? `Message: ${recipient}` : 'Send Message'
        },
        subtitle: (opts) => {
            const summary = getInputStringAny(opts.input, ['summary'])
            return summary ? truncate(summary, 120) : null
        },
        minimal: true
    },
    Bash: {
        icon: () => <TerminalIcon className={DEFAULT_ICON_CLASS} />,
        title: (opts) => opts.description ?? 'Terminal',
        subtitle: (opts) => getInputStringAny(opts.input, ['command', 'cmd']),
        minimal: true
    },
    Glob: {
        icon: () => <SearchIcon className={DEFAULT_ICON_CLASS} />,
        title: (opts) => getInputStringAny(opts.input, ['pattern']) ?? 'Search files',
        minimal: true
    },
    Grep: {
        icon: () => <EyeIcon className={DEFAULT_ICON_CLASS} />,
        title: (opts) => {
            const pattern = getInputStringAny(opts.input, ['pattern'])
            return pattern ? `grep(pattern: ${pattern})` : 'Search content'
        },
        minimal: true
    },
    LS: {
        icon: () => <SearchIcon className={DEFAULT_ICON_CLASS} />,
        title: (opts) => {
            const path = getInputStringAny(opts.input, ['path'])
            return path ? resolveDisplayPath(path, opts.metadata) : 'List files'
        },
        minimal: true
    },
    shell_command: {
        icon: () => <TerminalIcon className={DEFAULT_ICON_CLASS} />,
        title: (opts) => opts.description ?? 'Terminal',
        subtitle: (opts) => getInputStringAny(opts.input, ['command', 'cmd']),
        minimal: true
    },
    Read: {
        icon: () => <EyeIcon className={DEFAULT_ICON_CLASS} />,
        title: (opts) => {
            const file = getInputStringAny(opts.input, ['file_path', 'path', 'file'])
            return file ? resolveDisplayPath(file, opts.metadata) : 'Read file'
        },
        minimal: true
    },
    Edit: {
        icon: () => <FileDiffIcon className={DEFAULT_ICON_CLASS} />,
        title: (opts) => {
            const file = getInputStringAny(opts.input, ['file_path', 'path'])
            return file ? resolveDisplayPath(file, opts.metadata) : 'Edit file'
        },
        minimal: true
    },
    MultiEdit: {
        icon: () => <FileDiffIcon className={DEFAULT_ICON_CLASS} />,
        title: (opts) => {
            const file = getInputStringAny(opts.input, ['file_path', 'path'])
            if (!file) return 'Edit file'
            const edits = isObject(opts.input) && Array.isArray(opts.input.edits) ? opts.input.edits : null
            const count = edits ? edits.length : 0
            const path = resolveDisplayPath(file, opts.metadata)
            return count > 1 ? `${path} (${count} edits)` : path
        },
        minimal: true
    },
    Write: {
        icon: () => <FileDiffIcon className={DEFAULT_ICON_CLASS} />,
        title: (opts) => {
            const file = getInputStringAny(opts.input, ['file_path', 'path'])
            return file ? resolveDisplayPath(file, opts.metadata) : 'Write file'
        },
        subtitle: (opts) => {
            const content = getInputStringAny(opts.input, ['content', 'text'])
            if (!content) return null
            const lines = countLines(content)
            return lines > 1 ? `${lines} lines` : `${content.length} chars`
        },
        minimal: true
    },
    WebFetch: {
        icon: () => <GlobeIcon className={DEFAULT_ICON_CLASS} />,
        title: (opts) => {
            const url = getInputStringAny(opts.input, ['url'])
            if (!url) return 'Web fetch'
            try {
                return new URL(url).hostname
            } catch {
                return url
            }
        },
        subtitle: (opts) => {
            const url = getInputStringAny(opts.input, ['url'])
            if (!url) return null
            return url
        },
        minimal: true
    },
    WebSearch: {
        icon: () => <GlobeIcon className={DEFAULT_ICON_CLASS} />,
        title: (opts) => getInputStringAny(opts.input, ['query']) ?? 'Web search',
        subtitle: (opts) => {
            const query = getInputStringAny(opts.input, ['query'])
            return query ? truncate(query, 80) : null
        },
        minimal: true
    },
    NotebookRead: {
        icon: () => <EyeIcon className={DEFAULT_ICON_CLASS} />,
        title: (opts) => {
            const path = getInputStringAny(opts.input, ['notebook_path'])
            return path ? resolveDisplayPath(path, opts.metadata) : 'Read notebook'
        },
        minimal: true
    },
    NotebookEdit: {
        icon: () => <FileDiffIcon className={DEFAULT_ICON_CLASS} />,
        title: (opts) => {
            const path = getInputStringAny(opts.input, ['notebook_path'])
            return path ? resolveDisplayPath(path, opts.metadata) : 'Edit notebook'
        },
        subtitle: (opts) => {
            const mode = getInputStringAny(opts.input, ['edit_mode'])
            return mode ? `mode: ${mode}` : null
        },
        minimal: false
    },
    TodoWrite: {
        icon: () => <BulbIcon className={DEFAULT_ICON_CLASS} />,
        title: () => 'Todo list',
        subtitle: (opts) => formatChecklistCount(extractTodoChecklist(opts.input, opts.result), 'item'),
        minimal: (opts) => extractTodoChecklist(opts.input, opts.result).length === 0
    },
    update_plan: {
        icon: () => <ClipboardIcon className={DEFAULT_ICON_CLASS} />,
        title: () => 'Plan',
        subtitle: (opts) => formatChecklistCount(extractUpdatePlanChecklist(opts.input, opts.result), 'step'),
        minimal: (opts) => extractUpdatePlanChecklist(opts.input, opts.result).length === 0
    },
    Skill: {
        icon: () => <PuzzleIcon className={DEFAULT_ICON_CLASS} />,
        title: (opts) => {
            const skill = getInputStringAny(opts.input, ['skill'])
            return skill ? `Skill: ${skill}` : 'Skill'
        },
        minimal: true
    },
    Agent: {
        icon: () => <RocketIcon className={DEFAULT_ICON_CLASS} />,
        title: (opts) => {
            const description = getInputStringAny(opts.input, ['description'])
            return description ?? 'Launch Agent'
        },
        subtitle: (opts) => {
            // Subagent invocation: show prompt preview (same as Task)
            const prompt = getInputStringAny(opts.input, ['prompt'])
            if (prompt) return truncate(prompt, 120)
            const model = getInputStringAny(opts.input, ['subagent_type'])
            return model ?? null
        },
        minimal: (opts) => opts.childrenCount === 0
    },
    ExitPlanMode: {
        icon: () => <ClipboardIcon className={DEFAULT_ICON_CLASS} />,
        title: () => 'Plan proposal',
        minimal: false
    },
    exit_plan_mode: {
        icon: () => <ClipboardIcon className={DEFAULT_ICON_CLASS} />,
        title: () => 'Plan proposal',
        minimal: false
    },
    AskUserQuestion: {
        icon: () => <QuestionIcon className={DEFAULT_ICON_CLASS} />,
        title: (opts) => {
            const questions = isObject(opts.input) && Array.isArray(opts.input.questions)
                ? opts.input.questions : []
            const count = questions.length
            const first = questions[0] ?? null
            const header = isObject(first) && typeof first.header === 'string'
                ? first.header.trim() : ''

            if (count > 1) {
                return `${count} Questions`
            }
            return header.length > 0 ? header : 'Question'
        },
        subtitle: (opts) => {
            const questions = isObject(opts.input) && Array.isArray(opts.input.questions)
                ? opts.input.questions : []
            const count = questions.length
            const first = questions[0] ?? null
            const question = isObject(first) && typeof first.question === 'string'
                ? first.question.trim() : ''

            if (count > 1 && question.length > 0) {
                return truncate(question, 100) + ` (+${count - 1} more)`
            }
            return question.length > 0 ? truncate(question, 120) : null
        },
        minimal: true
    },
    ask_user_question: {
        icon: () => <QuestionIcon className={DEFAULT_ICON_CLASS} />,
        title: (opts) => {
            const questions = isObject(opts.input) && Array.isArray(opts.input.questions)
                ? opts.input.questions : []
            const count = questions.length
            const first = questions[0] ?? null
            const header = isObject(first) && typeof first.header === 'string'
                ? first.header.trim() : ''

            if (count > 1) {
                return `${count} Questions`
            }
            return header.length > 0 ? header : 'Question'
        },
        subtitle: (opts) => {
            const questions = isObject(opts.input) && Array.isArray(opts.input.questions)
                ? opts.input.questions : []
            const count = questions.length
            const first = questions[0] ?? null
            const question = isObject(first) && typeof first.question === 'string'
                ? first.question.trim() : ''

            if (count > 1 && question.length > 0) {
                return truncate(question, 100) + ` (+${count - 1} more)`
            }
            return question.length > 0 ? truncate(question, 120) : null
        },
        minimal: true
    },
    request_user_input: {
        icon: () => <QuestionIcon className={DEFAULT_ICON_CLASS} />,
        title: (opts) => {
            const questions = isObject(opts.input) && Array.isArray(opts.input.questions)
                ? opts.input.questions : []
            const count = questions.length
            const first = questions[0] ?? null
            const id = isObject(first) && typeof first.id === 'string'
                ? first.id.trim() : ''

            if (count > 1) {
                return `${count} Questions`
            }
            return id.length > 0 ? id : 'Question'
        },
        subtitle: (opts) => {
            const questions = isObject(opts.input) && Array.isArray(opts.input.questions)
                ? opts.input.questions : []
            const count = questions.length
            const first = questions[0] ?? null
            const question = isObject(first) && typeof first.question === 'string'
                ? first.question.trim() : ''

            if (count > 1 && question.length > 0) {
                return truncate(question, 100) + ` (+${count - 1} more)`
            }
            return question.length > 0 ? truncate(question, 120) : null
        },
        minimal: true
    }
}

type Translator = (key: string, params?: Record<string, string | number>) => string

export function getToolPresentation(
    opts: Omit<ToolOpts, 'metadata'> & { metadata: SessionSummaryMetadata | null },
    t?: Translator
): ToolPresentation {
    if (opts.toolName.startsWith('mcp__')) {
        return {
            icon: <PuzzleIcon className={DEFAULT_ICON_CLASS} />,
            title: formatMCPTitle(opts.toolName),
            subtitle: null,
            minimal: true
        }
    }

    const known = knownTools[opts.toolName]
    if (known) {
        const minimal = typeof known.minimal === 'function' ? known.minimal(opts) : (known.minimal ?? false)
        return {
            icon: known.icon(opts),
            title: known.title(opts),
            subtitle: known.subtitle ? known.subtitle(opts) : null,
            minimal
        }
    }

    const filePath = getInputStringAny(opts.input, ['file_path', 'path', 'filePath', 'file'])
    const command = getInputStringAny(opts.input, ['command', 'cmd'])
    const pattern = getInputStringAny(opts.input, ['pattern'])
    const url = getInputStringAny(opts.input, ['url'])
    const query = getInputStringAny(opts.input, ['query'])
    const name = getInputStringAny(opts.input, ['name'])

    const subtitle = filePath ?? command ?? pattern ?? url ?? query ?? name

    // Some ACP agents emit `tool_call.title` as a verbatim argument (the shell
    // command or the file path itself). When it equals the input field,
    // promote a semantic label to the title slot and let the verbatim arg
    // become the subtitle, so the card reads like a sentence instead of
    // showing the same string twice. Labels are translated when a Translator
    // is supplied; tests and call sites without i18n fall back to English.
    let title = opts.toolName
    if (subtitle && subtitle === title) {
        if (filePath) title = t ? t('tool.semanticTitle.readFile') : 'Read file'
        else if (command) title = t ? t('tool.semanticTitle.runShell') : 'Run shell'
        else if (pattern) title = t ? t('tool.semanticTitle.search') : 'Search'
        else if (url) title = t ? t('tool.semanticTitle.openUrl') : 'Open URL'
        else if (query) title = t ? t('tool.semanticTitle.query') : 'Query'
    }

    return {
        icon: (
            <span data-testid="tool-card-unknown-fallback" className="inline-flex">
                <WrenchIcon className={DEFAULT_ICON_CLASS} />
            </span>
        ),
        title,
        subtitle: subtitle && subtitle !== title ? truncate(subtitle, 80) : null,
        minimal: true
    }
}
