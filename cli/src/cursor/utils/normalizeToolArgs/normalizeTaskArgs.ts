import { pickString } from './pickString';

export function normalizeTaskArgs(args: Record<string, unknown>): Record<string, unknown> {
    const description = pickString(args, ['description', 'task_description']);
    const prompt = pickString(args, ['prompt', 'message']);
    const name = pickString(args, ['name']);
    const team_name = pickString(args, ['team_name', 'teamName']);

    const normalized: Record<string, unknown> = { ...args };
    if (description) normalized.description = description;
    if (prompt) normalized.prompt = prompt;
    if (name) normalized.name = name;
    if (team_name) normalized.team_name = team_name;

    const subagentType = args.subagentType ?? args.subagent_type;
    if (typeof subagentType === 'string' && subagentType.length > 0) {
        normalized.subagent_type = subagentType;
    }

    return normalized;
}
