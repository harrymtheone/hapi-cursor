import { getPermissionModesForFlavor, isPermissionModeAllowedForFlavor } from '@hapi/protocol'
import { PermissionModeSchema } from '@hapi/protocol/schemas'
import { Hono } from 'hono'
import { z } from 'zod'
import type { SyncEngine } from '../../../sync/syncEngine'
import { ApiRouteError } from '../../middleware/apiRouteError'
import type { WebAppEnv } from '../../middleware/auth'
import { parseJsonBody, withEngine, withSession } from '../../middleware/route-helpers'

const permissionModeSchema = z.object({
    mode: PermissionModeSchema
})

const modelSchema = z.object({
    model: z.string().trim().min(1).nullable()
})

export function createConfigRoutes(
    getSyncEngine: () => SyncEngine | null
): Hono<WebAppEnv> {
    const app = new Hono<WebAppEnv>()

    app.post(
        '/sessions/:id/permission-mode',
        withEngine(getSyncEngine),
        withSession(),
        parseJsonBody(permissionModeSchema),
        async (c) => {
            const session = c.get('session')
            const body = c.get('body') as z.infer<typeof permissionModeSchema>
            const mode = body.mode

            const allowedModes = getPermissionModesForFlavor('cursor')
            if (allowedModes.length === 0) {
                throw new ApiRouteError(400, 'permission-mode-unsupported', undefined, 'Permission mode not supported for session flavor')
            }
            if (!isPermissionModeAllowedForFlavor(mode, 'cursor')) {
                throw new ApiRouteError(400, 'invalid-permission-mode', undefined, 'Invalid permission mode for session flavor')
            }

            try {
                await c.get('engine').applySessionConfig(session.id, { permissionMode: mode })
                return c.json({ ok: true })
            } catch (error) {
                const message = error instanceof Error ? error.message : 'Failed to apply permission mode'
                throw new ApiRouteError(409, 'apply-config-failed', undefined, message)
            }
        }
    )

    app.post(
        '/sessions/:id/model',
        withEngine(getSyncEngine),
        withSession(),
        parseJsonBody(modelSchema),
        async (c) => {
            const session = c.get('session')
            const body = c.get('body') as z.infer<typeof modelSchema>

            try {
                const result = await c.get('engine').applySessionConfig(session.id, { model: body.model })
                return c.json(result)
            } catch (error) {
                const message = error instanceof Error ? error.message : 'Failed to apply model'
                throw new ApiRouteError(409, 'apply-config-failed', undefined, message)
            }
        }
    )

    return app
}
