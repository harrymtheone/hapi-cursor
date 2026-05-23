import type { ReactNode } from 'react'
import { isObject, safeStringify } from '@hapi/protocol'
import { CodeBlock } from '@/components/CodeBlock'
import { MarkdownRenderer } from '@/components/MarkdownRenderer'
import { basename } from '@/utils/path'
import { getInputStringAny } from '@/lib/toolInputUtils'
import type { ToolViewProps } from '@/components/ToolCard/views/_all'

export function parseToolUseError(message: string): { isToolUseError: boolean; errorMessage: string | null } {
    const regex = /<tool_use_error>(.*?)<\/tool_use_error>/s
    const match = message.match(regex)

    if (match) {
        return {
            isToolUseError: true,
            errorMessage: typeof match[1] === 'string' ? match[1].trim() : ''
        }
    }

    return { isToolUseError: false, errorMessage: null }
}

function extractTextFromContentBlock(block: unknown): string | null {
    if (typeof block === 'string') return block
    if (!isObject(block)) return null
    if (block.type === 'text' && typeof block.text === 'string') return block.text
    if (typeof block.text === 'string') return block.text
    return null
}

export function extractTextFromResult(result: unknown, depth: number = 0): string | null {
    if (depth > 2) return null
    if (result === null || result === undefined) return null
    if (typeof result === 'string') {
        const toolUseError = parseToolUseError(result)
        return toolUseError.isToolUseError ? (toolUseError.errorMessage ?? '') : result
    }

    if (Array.isArray(result)) {
        const parts = result
            .map(extractTextFromContentBlock)
            .filter((part): part is string => typeof part === 'string' && part.length > 0)
        return parts.length > 0 ? parts.join('\n') : null
    }

    if (!isObject(result)) return null

    if (typeof result.content === 'string') return result.content
    if (typeof result.text === 'string') return result.text
    if (typeof result.output === 'string') return result.output
    if (typeof result.error === 'string') return result.error
    if (typeof result.message === 'string') return result.message

    const contentArray = Array.isArray(result.content) ? result.content : null
    if (contentArray) {
        const parts = contentArray
            .map(extractTextFromContentBlock)
            .filter((part): part is string => typeof part === 'string' && part.length > 0)
        return parts.length > 0 ? parts.join('\n') : null
    }

    const nestedOutput = isObject(result.output) ? result.output : null
    if (nestedOutput) {
        if (typeof nestedOutput.content === 'string') return nestedOutput.content
        if (typeof nestedOutput.text === 'string') return nestedOutput.text
    }

    const nestedError = isObject(result.error) ? result.error : null
    if (nestedError) {
        if (typeof nestedError.message === 'string') return nestedError.message
        if (typeof nestedError.error === 'string') return nestedError.error
    }

    const nestedResult = isObject(result.result) ? result.result : null
    if (nestedResult) {
        const nestedText = extractTextFromResult(nestedResult, depth + 1)
        if (nestedText) return nestedText
    }

    const nestedData = isObject(result.data) ? result.data : null
    if (nestedData) {
        const nestedText = extractTextFromResult(nestedData, depth + 1)
        if (nestedText) return nestedText
    }

    return null
}

export function getMutationResultRenderMode(text: string, state: string): { mode: 'code' | 'auto'; language?: string } {
    const isMultiline = text.split('\n').length > 3
    const mode = state === 'error' || isMultiline ? 'code' as const : 'auto' as const
    return { mode, language: mode === 'code' ? 'text' : undefined }
}

function looksLikeHtml(text: string): boolean {
    const trimmed = text.trimStart()
    return trimmed.startsWith('<!DOCTYPE') || trimmed.startsWith('<html') || trimmed.startsWith('<div') || trimmed.startsWith('<span')
}

function looksLikeJson(text: string): boolean {
    const trimmed = text.trim()
    return (trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))
}

function parseStandaloneMarkdownCodeBlock(text: string): { language: string; code: string } | null {
    const trimmed = text.trim()
    const fence = trimmed.startsWith('```') ? '```' : trimmed.startsWith('~~~') ? '~~~' : null
    if (!fence) return null

    const lines = trimmed.split('\n')
    if (lines.length < 2) return null

    const lastLine = lines[lines.length - 1]?.trim()
    if (lastLine !== fence) return null

    const firstLine = lines[0] ?? ''
    const language = firstLine.slice(fence.length).trim().split(/\s+/, 1)[0] || 'text'
    return {
        language,
        code: lines.slice(1, -1).join('\n')
    }
}

const codeLanguageByExtension: Record<string, string> = {
    c: 'c',
    cc: 'c',
    conf: 'ini',
    cpp: 'c',
    cs: 'csharp',
    css: 'css',
    cjs: 'javascript',
    cts: 'typescript',
    diff: 'diff',
    dockerfile: 'dockerfile',
    go: 'go',
    graphql: 'graphql',
    h: 'c',
    htm: 'html',
    html: 'html',
    ini: 'ini',
    java: 'java',
    js: 'javascript',
    json: 'json',
    jsx: 'jsx',
    kt: 'kotlin',
    kts: 'kotlin',
    m: 'c',
    makefile: 'make',
    md: 'markdown',
    mjs: 'javascript',
    mts: 'typescript',
    patch: 'diff',
    php: 'php',
    ps1: 'powershell',
    py: 'python',
    rb: 'ruby',
    rs: 'rust',
    scss: 'scss',
    sh: 'shellscript',
    sql: 'sql',
    swift: 'swift',
    toml: 'toml',
    ts: 'typescript',
    tsx: 'tsx',
    xml: 'xml',
    yaml: 'yaml',
    yml: 'yaml',
    zsh: 'shellscript'
}

function inferCodeLanguageFromPath(path: string | null): string | null {
    if (!path) return null
    const name = basename(path).toLowerCase()
    if (name === 'dockerfile') return 'dockerfile'
    if (name === 'makefile') return 'make'

    const ext = name.includes('.') ? name.split('.').pop() : null
    if (!ext) return null
    return codeLanguageByExtension[ext] ?? null
}

function looksLikeCodeContent(text: string): string | null {
    if (looksLikeJson(text)) return 'json'
    if (looksLikeHtml(text)) return 'html'
    if (text.trimStart().startsWith('diff --git') || text.trimStart().startsWith('@@ ')) return 'diff'
    if (text.startsWith('#!/bin/bash') || text.startsWith('#!/usr/bin/env bash') || text.startsWith('#!/bin/sh')) return 'shellscript'
    if (/^\s*(import|export)\s.+from\s+['"][^'"]+['"]/m.test(text)) return 'typescript'
    if (/^\s*(const|let|var|function|class|interface|type)\s+\w+/m.test(text)) return 'typescript'
    if (/^\s*def\s+\w+\(|^\s*class\s+\w+\(|^\s*from\s+\w+\s+import\s+/m.test(text)) return 'python'
    return null
}

export function inferCodeLanguage(path: string | null, text: string): string | null {
    return inferCodeLanguageFromPath(path) ?? looksLikeCodeContent(text)
}

export function resultCodeBlockProps(surface: ToolViewProps['surface'], collapseLongContent?: boolean) {
    return surface === 'dialog'
        ? { collapseLongContent: false, size: 'comfortable' as const, scrollY: true }
        : { collapseLongContent }
}

export function renderResultBody(
    content: ReactNode,
    surface: ToolViewProps['surface'],
    opts: { forceQuote?: boolean } = {}
) {
    if (surface !== 'dialog' && !opts.forceQuote) return content

    return (
        <div className="tool-result-quote rounded-r-2xl border-l-[3px] border-[var(--app-md-quote-border)] bg-[var(--app-md-quote-bg)] px-4 py-3 text-sm leading-6 text-[var(--app-md-quote-fg)]">
            {content}
        </div>
    )
}

function renderPlainTextQuote(text: string, surface: ToolViewProps['surface']) {
    return renderResultBody(
        <div className="whitespace-pre-wrap break-words">
            {text}
        </div>,
        surface,
        { forceQuote: true }
    )
}

export function renderMarkdown(text: string, surface: ToolViewProps['surface']) {
    return (
        <MarkdownRenderer
            content={text}
            className={surface === 'dialog' ? 'text-[var(--app-md-quote-fg)]' : undefined}
        />
    )
}

export function renderText(text: string, opts: { mode: 'markdown' | 'code' | 'auto'; language?: string; collapseLongContent?: boolean; surface?: ToolViewProps['surface'] } = { mode: 'auto' }) {
    if (opts.mode === 'code') {
        return <CodeBlock code={text} language={opts.language ?? 'text'} {...resultCodeBlockProps(opts.surface, opts.collapseLongContent)} />
    }

    const standaloneCodeBlock = parseStandaloneMarkdownCodeBlock(text)

    if (opts.mode === 'markdown') {
        const markdown = renderMarkdown(text, opts.surface)
        return standaloneCodeBlock
            ? <CodeBlock code={standaloneCodeBlock.code} language={standaloneCodeBlock.language} {...resultCodeBlockProps(opts.surface, opts.collapseLongContent)} />
            : renderResultBody(markdown, opts.surface)
    }

    if (looksLikeHtml(text) || looksLikeJson(text)) {
        return <CodeBlock code={text} language={looksLikeJson(text) ? 'json' : 'html'} {...resultCodeBlockProps(opts.surface, opts.collapseLongContent)} />
    }

    if (standaloneCodeBlock) {
        return <CodeBlock code={standaloneCodeBlock.code} language={standaloneCodeBlock.language} {...resultCodeBlockProps(opts.surface, opts.collapseLongContent)} />
    }

    return renderResultBody(renderMarkdown(text, opts.surface), opts.surface)
}

export function placeholderForState(state: ToolViewProps['block']['tool']['state']): string {
    if (state === 'pending') return 'Waiting for permission…'
    if (state === 'running') return 'Running…'
    return '(no output)'
}

export function RawJsonDevOnly(props: { value: unknown; surface?: ToolViewProps['surface'] }) {
    if (!import.meta.env.DEV) return null
    if (props.value === null || props.value === undefined) return null

    return (
        <details className="mt-3">
            <summary className="cursor-pointer text-xs font-medium text-[var(--app-hint)]">
                Raw JSON
            </summary>
            <div className="mt-2">
                <CodeBlock code={safeStringify(props.value)} language="json" title="Raw JSON" {...resultCodeBlockProps(props.surface, false)} />
            </div>
        </details>
    )
}

export function extractStdoutStderr(result: unknown): { stdout: string | null; stderr: string | null } | null {
    if (!isObject(result)) return null

    const stdout = typeof result.stdout === 'string' ? result.stdout : null
    const stderr = typeof result.stderr === 'string' ? result.stderr : null
    if (stdout !== null || stderr !== null) {
        return { stdout, stderr }
    }

    const nested = isObject(result.output) ? result.output : null
    if (nested) {
        const nestedStdout = typeof nested.stdout === 'string' ? nested.stdout : null
        const nestedStderr = typeof nested.stderr === 'string' ? nested.stderr : null
        if (nestedStdout !== null || nestedStderr !== null) {
            return { stdout: nestedStdout, stderr: nestedStderr }
        }
    }

    return null
}

export function extractReadFileContent(result: unknown): { filePath: string | null; content: string } | null {
    if (!isObject(result)) return null
    const file = isObject(result.file) ? result.file : null
    if (!file) return null

    const content = typeof file.content === 'string' ? file.content : null
    if (content === null) return null

    const filePath = typeof file.filePath === 'string'
        ? file.filePath
        : typeof file.file_path === 'string'
            ? file.file_path
            : null

    return { filePath, content }
}

export function isReadFileToolCall(toolName: string, input: unknown): boolean {
    if (toolName === 'Read' || toolName === 'NotebookRead') return true

    const normalizedName = toolName.toLowerCase()
    if (normalizedName.includes('read_file') || normalizedName.includes('readfile')) return true

    if (!isObject(input)) return false
    if (Array.isArray(input.parsed_cmd)) {
        return input.parsed_cmd.some((cmd) => isObject(cmd) && cmd.type === 'read')
    }

    return false
}

export function extractReadPathFromInput(input: unknown): string | null {
    if (!isObject(input)) return null

    const directPath = getInputStringAny(input, ['file_path', 'path', 'name'])
    if (directPath) return directPath

    if (Array.isArray(input.parsed_cmd)) {
        for (const cmd of input.parsed_cmd) {
            if (!isObject(cmd) || cmd.type !== 'read') continue
            const parsedPath = getInputStringAny(cmd, ['name', 'path', 'file_path'])
            if (parsedPath) return parsedPath
        }
    }

    return null
}

export function renderReadTextResult(text: string, path: string | null, surface: ToolViewProps['surface']) {
    const language = inferCodeLanguage(path, text)
    if (language) {
        return <CodeBlock code={text} language={language} title="File content" {...resultCodeBlockProps(surface, surface === 'inline')} />
    }
    return renderPlainTextQuote(text, surface)
}

export function ResultMetaPill(props: { children: ReactNode }) {
    return (
        <span className="inline-flex w-fit items-center rounded-full border border-[var(--app-border)] bg-[var(--app-subtle-bg)] px-2 py-0.5 font-mono text-[11px] leading-5 text-[var(--app-hint)]">
            {props.children}
        </span>
    )
}

export function ResultStatusPill(props: { text: string }) {
    return <ResultMetaPill>{props.text}</ResultMetaPill>
}

export function extractLineList(text: string): string[] {
    return text
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
}

export function isProbablyMarkdownList(text: string): boolean {
    const trimmed = text.trimStart()
    return trimmed.startsWith('- ') || trimmed.startsWith('* ') || trimmed.startsWith('1. ')
}
