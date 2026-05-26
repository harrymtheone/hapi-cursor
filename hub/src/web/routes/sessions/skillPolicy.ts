/**
 * POST /sessions/:id/skill-policy
 *
 * Body shapes (exactly one):
 * - `{ name, state }` — merge one skill into metadata.skillPolicy
 * - `{ skillPolicy }` — replace the full policy map
 * - `{ reset: true }` — remove skillPolicy (all skills implicit inherited)
 */
import { SkillPolicyMapSchema, SkillPolicyStateSchema } from '@hapi/protocol/schemas'
import { Hono } from 'hono'
import { z } from 'zod'
import type { SyncEngine } from '../../../sync/syncEngine'
import { ApiRouteError } from '../../middleware/apiRouteError'
import type { WebAppEnv } from '../../middleware/auth'
import { parseJsonBody, withEngine, withSession } from '../../middleware/route-helpers'

const SKILL_POLICY_MAX_KEYS = 200
const SKILL_POLICY_NAME_MAX_LEN = 128

const skillPolicyNameSchema = z.string().trim().min(1).max(SKILL_POLICY_NAME_MAX_LEN)

const skillPolicySingleSchema = z.object({
    name: skillPolicyNameSchema,
    state: SkillPolicyStateSchema
})

const skillPolicyMapWriteSchema = SkillPolicyMapSchema.superRefine((map, ctx) => {
    const keys = Object.keys(map)
    if (keys.length > SKILL_POLICY_MAX_KEYS) {
        ctx.addIssue({
            code: 'custom',
            message: `skillPolicy exceeds maximum of ${SKILL_POLICY_MAX_KEYS} keys`
        })
    }
    for (const key of keys) {
        if (key.length > SKILL_POLICY_NAME_MAX_LEN) {
            ctx.addIssue({
                code: 'custom',
                message: `skill policy name exceeds maximum length of ${SKILL_POLICY_NAME_MAX_LEN}`
            })
        }
    }
})

const skillPolicyBatchSchema = z.object({
    skillPolicy: skillPolicyMapWriteSchema
})

const skillPolicyResetSchema = z.object({
    reset: z.literal(true)
})

const skillPolicyBodySchema = z.union([
    skillPolicySingleSchema,
    skillPolicyBatchSchema,
    skillPolicyResetSchema
])

function isSkillPolicyConflict(error: unknown): boolean {
    const message = error instanceof Error ? error.message : ''
    return message.includes('concurrently') || message.includes('version')
}

export function createSkillPolicyRoutes(
    getSyncEngine: () => SyncEngine | null
): Hono<WebAppEnv> {
    const app = new Hono<WebAppEnv>()

    app.post(
        '/sessions/:id/skill-policy',
        withEngine(getSyncEngine),
        withSession(),
        parseJsonBody(skillPolicyBodySchema),
        async (c) => {
            const session = c.get('session')
            const body = c.get('body') as z.infer<typeof skillPolicyBodySchema>
            const engine = c.get('engine')

            try {
                if ('reset' in body) {
                    await engine.resetSessionSkillPolicy(session.id)
                } else if ('skillPolicy' in body) {
                    await engine.applySkillPolicyBatch(session.id, body.skillPolicy)
                } else {
                    await engine.applySkillPolicy(session.id, { name: body.name, state: body.state })
                }
                return c.json({ ok: true })
            } catch (error) {
                const message = error instanceof Error ? error.message : 'Failed to update skill policy'
                if (isSkillPolicyConflict(error)) {
                    throw new ApiRouteError(409, 'skill-policy-conflict', undefined, message)
                }
                if (message.includes('exceeds maximum')) {
                    throw new ApiRouteError(400, 'invalid-skill-policy', undefined, message)
                }
                throw new ApiRouteError(500, 'skill-policy-failed', undefined, message)
            }
        }
    )

    return app
}
