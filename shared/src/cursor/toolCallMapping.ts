/**
 * Maps Cursor native *ToolCall NDJSON keys to HAPI Web knownTools registry names.
 * Unmapped keys log a warning then use PascalCase fallback (D-08).
 */

export const CURSOR_TOOL_KEY_TO_HAPI_NAME: Record<string, string> = {
    readToolCall: 'Read',
    writeToolCall: 'Write',
    grepToolCall: 'Grep',
    globToolCall: 'Glob',
    editToolCall: 'Edit',
    lsToolCall: 'LS',
    listDirToolCall: 'LS',
    shellToolCall: 'Bash',
    bashToolCall: 'Bash',
    todoToolCall: 'TodoWrite',
    updatePlanToolCall: 'update_plan',
    webFetchToolCall: 'WebFetch',
    webSearchToolCall: 'WebSearch',
    semSearchToolCall: 'Grep',
    taskToolCall: 'Task',
    agentToolCall: 'Agent',
    subagentToolCall: 'Agent',
    skillToolCall: 'Skill',
    askUserQuestionToolCall: 'AskUserQuestion',
    notebookReadToolCall: 'NotebookRead',
};

/** When multiple *ToolCall keys exist, prefer map entries in this order. */
const PREFERRED_NATIVE_TOOL_CALL_KEY_ORDER: readonly string[] = [
    'readToolCall',
    'writeToolCall',
    'grepToolCall',
    'globToolCall',
    'editToolCall',
    'taskToolCall',
    'agentToolCall',
    'subagentToolCall',
    'skillToolCall',
    'askUserQuestionToolCall',
    'notebookReadToolCall',
    'lsToolCall',
    'listDirToolCall',
    'shellToolCall',
    'bashToolCall',
    'todoToolCall',
    'updatePlanToolCall',
    'webFetchToolCall',
    'webSearchToolCall',
    'semSearchToolCall',
];

const warnedUnmappedKeys = new Set<string>();

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function warnUnmappedNativeKey(key: string): void {
    if (warnedUnmappedKeys.has(key)) return;
    warnedUnmappedKeys.add(key);
    console.warn(`[cursor-ndjson] unmapped: ${key}`);
}

/** Test-only: reset deduped unmapped-key warnings. */
export function resetUnmappedToolCallWarningsForTests(): void {
    warnedUnmappedKeys.clear();
}

export function findNativeToolCallVariant(
    toolCall: Record<string, unknown>
): { key: string; variant: Record<string, unknown> } | null {
    const toolCallKeys = Object.keys(toolCall).filter((key) => key.endsWith('ToolCall'));
    if (toolCallKeys.length === 0) {
        return null;
    }

    const pick = (key: string): { key: string; variant: Record<string, unknown> } | null => {
        const variant = toolCall[key];
        return isRecord(variant) ? { key, variant } : null;
    };

    for (const preferred of PREFERRED_NATIVE_TOOL_CALL_KEY_ORDER) {
        if (!toolCallKeys.includes(preferred)) continue;
        const found = pick(preferred);
        if (found) return found;
    }

    for (const key of toolCallKeys) {
        const found = pick(key);
        if (found) return found;
    }

    return null;
}

function pascalCaseFromToolCallKey(key: string): string | null {
    if (!key.endsWith('ToolCall')) return null;
    const base = key.slice(0, -'ToolCall'.length);
    if (!base) return null;
    return base.charAt(0).toUpperCase() + base.slice(1);
}

/**
 * EditNotebook on .ipynb uses native `editToolCall`, not notebookEditToolCall.
 * Infer NotebookEdit from path suffix or completed result message (capture evidence).
 */
function isNotebookEditVariant(variant: Record<string, unknown>): boolean {
    if (isRecord(variant.args)) {
        const path = variant.args.path ?? variant.args.notebook_path;
        if (typeof path === 'string' && path.endsWith('.ipynb')) {
            return true;
        }
    }

    if (isRecord(variant.result) && isRecord(variant.result.success)) {
        const message = variant.result.success.message;
        if (typeof message === 'string' && /notebook cell/i.test(message)) {
            return true;
        }
    }

    return false;
}

/** Resolve HAPI tool name: allowlist map → NotebookEdit inference → function.name → PascalCase fallback → unknown. */
export function resolveHapiToolName(toolCall: Record<string, unknown>): string {
    const native = findNativeToolCallVariant(toolCall);
    if (native) {
        if (native.key === 'editToolCall' && isNotebookEditVariant(native.variant)) {
            return 'NotebookEdit';
        }

        const mapped = CURSOR_TOOL_KEY_TO_HAPI_NAME[native.key];
        if (mapped) return mapped;

        const generated = pascalCaseFromToolCallKey(native.key);
        if (generated) {
            warnUnmappedNativeKey(native.key);
            return generated;
        }
    }

    if (isRecord(toolCall.function)) {
        const name = toolCall.function.name;
        if (typeof name === 'string' && name.length > 0) return name;
    }

    return 'unknown';
}
