import { Hono } from 'hono'
import { z } from 'zod'
import type { SyncEngine } from '../../../sync/syncEngine'
import { ApiRouteError } from '../../middleware/apiRouteError'
import type { WebAppEnv } from '../../middleware/auth'
import { parseJsonBody, withActiveSession, withEngine } from '../../middleware/route-helpers'
import { estimateBase64Bytes, MAX_UPLOAD_BYTES } from '@hapi/protocol'

const uploadSchema = z.object({
    filename: z.string().min(1).max(255),
    content: z.string().min(1),
    mimeType: z.string().min(1).max(255)
})

const uploadDeleteSchema = z.object({
    path: z.string().min(1)
})

export function createUploadRoutes(
    getSyncEngine: () => SyncEngine | null
): Hono<WebAppEnv> {
    const app = new Hono<WebAppEnv>()

    app.post(
        '/sessions/:id/upload/delete',
        withEngine(getSyncEngine),
        withActiveSession(),
        parseJsonBody(uploadDeleteSchema),
        async (c) => {
            const session = c.get('session')
            const body = c.get('body') as z.infer<typeof uploadDeleteSchema>
            try {
                const result = await c.get('engine').deleteUploadFile(session.id, body.path)
                return c.json(result)
            } catch (error) {
                const message = error instanceof Error ? error.message : 'Failed to delete upload'
                throw new ApiRouteError(500, 'upload-delete-failed', undefined, message)
            }
        }
    )

    app.post(
        '/sessions/:id/upload',
        withEngine(getSyncEngine),
        withActiveSession(),
        parseJsonBody(uploadSchema),
        async (c) => {
            const session = c.get('session')
            const body = c.get('body') as z.infer<typeof uploadSchema>

            if (estimateBase64Bytes(body.content) > MAX_UPLOAD_BYTES) {
                throw new ApiRouteError(413, 'payload-too-large', undefined, 'File too large (max 50MB)')
            }

            try {
                const result = await c.get('engine').uploadFile(
                    session.id,
                    body.filename,
                    body.content,
                    body.mimeType
                )
                return c.json(result)
            } catch (error) {
                const message = error instanceof Error ? error.message : 'Failed to upload file'
                throw new ApiRouteError(500, 'upload-failed', undefined, message)
            }
        }
    )

    return app
}
