import type { MiddlewareHandler } from 'hono'
import type { z } from 'zod'
import type { SyncEngine } from '../../sync/syncEngine'
import type { WebAppEnv } from './auth'
import { ApiRouteError } from './apiRouteError'

export function withEngine(
    getSyncEngine: () => SyncEngine | null
): MiddlewareHandler<WebAppEnv> {
    return async (c, next) => {
        const engine = getSyncEngine()
        if (!engine) {
            throw new ApiRouteError(503, 'engine-unavailable', undefined, 'Not connected')
        }
        c.set('engine', engine)
        await next()
    }
}

export function withSession(idParam: string = 'id'): MiddlewareHandler<WebAppEnv> {
    return async (c, next) => {
        const engine = c.get('engine')
        const sessionId = c.req.param(idParam) ?? ''
        const access = engine.resolveSessionAccess(sessionId)
        if (!access.ok) {
            throw new ApiRouteError(404, 'not-found', undefined, 'Session not found')
        }
        c.set('session', access.session)
        await next()
    }
}

export function withActiveSession(idParam: string = 'id'): MiddlewareHandler<WebAppEnv> {
    return async (c, next) => {
        const engine = c.get('engine')
        const sessionId = c.req.param(idParam) ?? ''
        const access = engine.resolveSessionAccess(sessionId)
        if (!access.ok) {
            throw new ApiRouteError(404, 'not-found', undefined, 'Session not found')
        }
        if (!access.session.active) {
            throw new ApiRouteError(409, 'session-not-active', undefined, 'Session is inactive')
        }
        c.set('session', access.session)
        await next()
    }
}

export function withMachine(idParam: string = 'machineId'): MiddlewareHandler<WebAppEnv> {
    return async (c, next) => {
        const engine = c.get('engine')
        const machineId = c.req.param(idParam) ?? ''
        const machine = engine.getMachine(machineId)
        if (!machine) {
            throw new ApiRouteError(404, 'not-found', undefined, 'Machine not found')
        }
        c.set('machine', machine)
        await next()
    }
}

export function parseJsonBody<TSchema extends z.ZodTypeAny>(
    schema: TSchema
): MiddlewareHandler<WebAppEnv> {
    return async (c, next) => {
        let raw: unknown
        try {
            raw = await c.req.json()
        } catch {
            throw new ApiRouteError(400, 'invalid-body', undefined, 'Body is not valid JSON')
        }
        const parsed = schema.safeParse(raw)
        if (!parsed.success) {
            throw new ApiRouteError(400, 'invalid-body', parsed.error.issues)
        }
        c.set('body', parsed.data)
        await next()
    }
}
