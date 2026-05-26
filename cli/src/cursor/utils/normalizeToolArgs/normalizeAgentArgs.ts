import { pickString } from './pickString';

/** Agent/subagent invocations — do not merge Task-only description-only shapes (D-07). */
export function normalizeAgentArgs(args: Record<string, unknown>): Record<string, unknown> {
    const prompt = pickString(args, ['prompt', 'message']);
    const description = pickString(args, ['description', 'task_description']);
    const subagent_type = pickString(args, ['subagent_type', 'subagentType']);

    const normalized: Record<string, unknown> = { ...args };
    if (prompt) normalized.prompt = prompt;
    if (description) normalized.description = description;
    if (subagent_type) normalized.subagent_type = subagent_type;

    return normalized;
}
