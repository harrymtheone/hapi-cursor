/**
 * Maps Cursor native *ToolCall NDJSON keys to HAPI Web knownTools registry names.
 * Unmapped keys stay 'unknown' (allowlist — no guessing from args).
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
};

/** When multiple *ToolCall keys exist, prefer map entries in this order. */
const PREFERRED_NATIVE_TOOL_CALL_KEY_ORDER: readonly string[] = [
    'readToolCall',
    'writeToolCall',
    'grepToolCall',
    'globToolCall',
    'editToolCall',
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

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
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

/** Resolve HAPI tool name: allowlist map → function.name → PascalCase *ToolCall fallback → unknown. */
export function resolveHapiToolName(toolCall: Record<string, unknown>): string {
    const native = findNativeToolCallVariant(toolCall);
    if (native) {
        const mapped = CURSOR_TOOL_KEY_TO_HAPI_NAME[native.key];
        if (mapped) return mapped;
        const generated = pascalCaseFromToolCallKey(native.key);
        if (generated) return generated;
    }

    if (isRecord(toolCall.function)) {
        const name = toolCall.function.name;
        if (typeof name === 'string' && name.length > 0) return name;
    }

    return 'unknown';
}
