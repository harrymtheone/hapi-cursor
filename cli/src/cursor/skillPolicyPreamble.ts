import type { SkillSummary } from '@hapi/protocol/schemas';
import type { SkillPolicyState } from '@hapi/protocol/types';
import { isEffectivelyAllowed } from '@hapi/protocol';

export const HAPI_SESSION_SKILL_POLICY_MARKER = '[HAPI session skill policy]';

/**
 * Deterministic one-line preamble for allowed skills (D-13). HAPI session overlay only (D-11).
 * Does not read or write skill files or Cursor global config (D-10).
 */
export function buildSkillPolicyPreamble(
    skills: SkillSummary[],
    policy: Record<string, SkillPolicyState> | undefined
): string | null {
    const allowed = skills
        .filter((s) => isEffectivelyAllowed(s.name, policy, s.valid))
        .map((s) => s.name)
        .sort((a, b) => a.localeCompare(b));

    if (allowed.length === 0) {
        return null;
    }

    return `${HAPI_SESSION_SKILL_POLICY_MARKER} Allowed skills: ${allowed.join(', ')}.`;
}

export function prependSkillPolicyPreamble(formattedText: string, preamble: string | null): string {
    if (!preamble) {
        return formattedText;
    }

    return `${preamble}\n\n${formattedText}`;
}

export function applySkillPolicyToFormattedMessage(
    formattedText: string,
    skills: SkillSummary[],
    policy: Record<string, SkillPolicyState> | undefined
): string {
    return prependSkillPolicyPreamble(formattedText, buildSkillPolicyPreamble(skills, policy));
}
