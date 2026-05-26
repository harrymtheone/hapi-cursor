import { describe, expect, it } from 'vitest';
import type { SkillSummary } from '@hapi/protocol/schemas';
import type { SkillPolicyState } from '@hapi/protocol/types';
import { buildSkillPolicyPreamble, HAPI_SESSION_SKILL_POLICY_MARKER } from './skillPolicyPreamble';

function skill(name: string, overrides: Partial<SkillSummary> = {}): SkillSummary {
    return {
        name,
        source: 'project',
        valid: true,
        pathHint: name,
        ...overrides,
    };
}

describe('buildSkillPolicyPreamble', () => {
    it.each([
        {
            label: 'empty skills',
            skills: [] as SkillSummary[],
            policy: undefined,
            expected: null,
        },
        {
            label: 'all disabled',
            skills: [skill('alpha'), skill('beta')],
            policy: { alpha: 'disabled', beta: 'disabled' } as Record<string, SkillPolicyState>,
            expected: null,
        },
        {
            label: 'mixed policy',
            skills: [skill('beta'), skill('alpha'), skill('gamma', { valid: false })],
            policy: { beta: 'disabled', alpha: 'enabled', gamma: 'enabled' } as Record<string, SkillPolicyState>,
            expected: `${HAPI_SESSION_SKILL_POLICY_MARKER} Allowed skills: alpha.`,
        },
        {
            label: 'inherited allows valid skills',
            skills: [skill('zeta'), skill('alpha')],
            policy: undefined,
            expected: `${HAPI_SESSION_SKILL_POLICY_MARKER} Allowed skills: alpha, zeta.`,
        },
    ])('$label', ({ skills, policy, expected }) => {
        expect(buildSkillPolicyPreamble(skills, policy)).toBe(expected);
    });

    it('disabled-only map returns null preamble', () => {
        const skills = [skill('only-skill')];
        expect(buildSkillPolicyPreamble(skills, { 'only-skill': 'disabled' })).toBeNull();
    });

    it('output contains HAPI session skill policy marker and not Cursor enforcement claims', () => {
        const preamble = buildSkillPolicyPreamble(
            [skill('deploy')],
            { deploy: 'enabled' }
        );
        expect(preamble).toContain(HAPI_SESSION_SKILL_POLICY_MARKER);
        expect(preamble?.toLowerCase()).not.toContain('cursor enforced');
        expect(preamble?.toLowerCase()).not.toContain('cursor enforces');
    });

    it('excludes invalid skills even when policy marks them enabled', () => {
        const preamble = buildSkillPolicyPreamble(
            [skill('broken', { valid: false }), skill('ok')],
            { broken: 'enabled', ok: 'enabled' }
        );
        expect(preamble).toBe(`${HAPI_SESSION_SKILL_POLICY_MARKER} Allowed skills: ok.`);
    });
});
