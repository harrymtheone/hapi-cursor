import type { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import type { WebAppEnv } from './auth'

export class ApiRouteError extends HTTPException {
    readonly code: string
    readonly details?: unknown

    constructor(
        status: ContentfulStatusCode,
        code: string,
        details?: unknown,
        message?: string
    ) {
        super(status, { message: message ?? code })
        this.code = code
        this.details = details
    }
}

export function registerApiErrorHandler(app: Hono<WebAppEnv>): void {
    app.onError((err, c) => {
        if (err instanceof ApiRouteError) {
            return c.json(
                {
                    error: {
                        code: err.code,
                        message: err.message,
                        ...(err.details !== undefined ? { details: err.details } : {})
                    }
                },
                err.status
            )
        }
        if (err instanceof HTTPException) {
            return err.getResponse()
        }
        console.error('[Hub] Unhandled error in route:', err)
        return c.json(
            { error: { code: 'internal-error', message: 'Internal server error' } },
            500
        )
    })
}
