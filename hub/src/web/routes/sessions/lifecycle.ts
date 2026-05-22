import { isPermissionModeAllowedForFlavor } from '@hapi/protocol'
import { PermissionModeSchema } from '@hapi/protocol/schemas'
import { Hono } from 'hono'
import { z } from 'zod'
import type { SyncEngine } from '../../../sync/syncEngine'
import { ApiRouteError } from '../../middleware/apiRouteError'
import type { WebAppEnv } from '../../middleware/auth'
import { parseJsonBody, withActiveSession, withEngine, withSession } from '../../middleware/route-helpers'

const resumeBodySchema = z.object({
    permissionMode: PermissionModeSchema.optional()
})

const renameSessionSchema = z.object({
    name: z.string().min(1).max(255)
})

export function createLifecycleRoutes(
    getSyncEngine: () => SyncEngine | null
): Hono<WebAppEnv> {
    const app = new Hono<WebAppEnv>()

    app.post('/sessions/:id/resume', withEngine(getSyncEngine), withSession(), async (c) => {
        const engine = c.get('engine')
        const session = c.get('session')

        const raw = await c.req.json().catch(() => null)
        const parsed = raw ? resumeBodySchema.safeParse(raw) : { success: true as const, data: {} }
        if (!parsed.success) {
            throw new ApiRouteError(400, 'invalid-body', parsed.error.issues)
        }
        const { permissionMode } = parsed.data
        if (permissionMode !== undefined && !isPermissionModeAllowedForFlavor(permissionMode, 'cursor')) {
            throw new ApiRouteError(400, 'invalid-permission-mode', undefined, 'Invalid permission mode for session flavor')
        }

        const result = await engine.resumeSession(
            session.id,
            permissionMode !== undefined ? { permissionMode } : undefined
        )
        if (result.type === 'error') {
            const status = result.code === 'no_machine_online' ? 503
                : result.code === 'session_not_found' ? 404
                    : 500
            throw new ApiRouteError(status, result.code, undefined, result.message)
        }

        return c.json({ type: 'success', sessionId: result.sessionId })
    })

    app.post('/sessions/:id/abort', withEngine(getSyncEngine), withActiveSession(), async (c) => {
        const session = c.get('session')
        await c.get('engine').abortSession(session.id)
        return c.json({ ok: true })
    })

    app.post('/sessions/:id/archive', withEngine(getSyncEngine), withActiveSession(), async (c) => {
        const session = c.get('session')
        await c.get('engine').archiveSession(session.id)
        return c.json({ ok: true })
    })

    app.post('/sessions/:id/switch', withEngine(getSyncEngine), withActiveSession(), async (c) => {
        const session = c.get('session')
        await c.get('engine').switchSession(session.id, 'remote')
        return c.json({ ok: true })
    })

    app.patch(
        '/sessions/:id',
        withEngine(getSyncEngine),
        withSession(),
        parseJsonBody(renameSessionSchema),
        async (c) => {
            const session = c.get('session')
            const body = c.get('body') as z.infer<typeof renameSessionSchema>
            try {
                await c.get('engine').renameSession(session.id, body.name)
                return c.json({ ok: true })
            } catch (error) {
                const message = error instanceof Error ? error.message : 'Failed to rename session'
                if (message.includes('concurrently') || message.includes('version')) {
                    throw new ApiRouteError(409, 'rename-conflict', undefined, message)
                }
                throw new ApiRouteError(500, 'rename-failed', undefined, message)
            }
        }
    )

    app.delete('/sessions/:id', withEngine(getSyncEngine), withSession(), async (c) => {
        const session = c.get('session')
        if (session.active) {
            throw new ApiRouteError(409, 'session-active', undefined, 'Cannot delete active session. Archive it first.')
        }
        try {
            await c.get('engine').deleteSession(session.id)
            return c.json({ ok: true })
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to delete session'
            if (message.includes('active')) {
                throw new ApiRouteError(409, 'session-active', undefined, message)
            }
            throw new ApiRouteError(500, 'delete-failed', undefined, message)
        }
    })

    return app
}
