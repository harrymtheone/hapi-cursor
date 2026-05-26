import { pickString } from './pickString';

export function normalizeSkillArgs(args: Record<string, unknown>): Record<string, unknown> {
    const skill = pickString(args, ['skill', 'skill_name', 'skillName', 'name']);
    if (!skill) return { ...args };
    return { ...args, skill };
}
