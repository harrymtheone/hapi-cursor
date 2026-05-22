import { describe, expect, it } from 'bun:test'
import { Hono } from 'hono'
import { z } from 'zod'
import type { SyncEngine } from '../../sync/syncEngine'
import { ApiRouteError, registerApiErrorHandler } from './apiRouteError'
import type { WebAppEnv } from './auth'
import { parseJsonBody, withEngine, withSession } from './route-helpers'

function buildApp() {
    const app = new Hono<WebAppEnv>()
    registerApiErrorHandler(app)
    return app
}

describe('ApiRouteError unified error shape', () => {
    it('parseJsonBody returns 400 invalid-body with zod issues on schema fail', async () => {
        const app = buildApp()
        app.post('/x', parseJsonBody(z.object({ n: z.number() })), (c) => c.json({ ok: true }))

        const response = await app.request('/x', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ n: 'not-a-number' })
        })

        expect(response.status).toBe(400)
        const body = await response.json() as { error: { code: string; message: string; details?: unknown[] } }
        expect(body.error.code).toBe('invalid-body')
        expect(Array.isArray(body.error.details)).toBe(true)
        expect((body.error.details as unknown[]).length).toBeGreaterThan(0)
    })

    it('parseJsonBody returns 400 invalid-body when body is not valid JSON', async () => {
        const app = buildApp()
        app.post('/x', parseJsonBody(z.object({ n: z.number() })), (c) => c.json({ ok: true }))

        const response = await app.request('/x', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: 'not-json-at-all'
        })

        expect(response.status).toBe(400)
        const body = await response.json() as { error: { code: string } }
        expect(body.error.code).toBe('invalid-body')
    })

    it('withEngine returns 503 engine-unavailable when getSyncEngine returns null', async () => {
        const app = buildApp()
        app.get('/x', withEngine(() => null), (c) => c.json({ ok: true }))

        const response = await app.request('/x')
        expect(response.status).toBe(503)
        const body = await response.json() as { error: { code: string } }
        expect(body.error.code).toBe('engine-unavailable')
    })

    it('withSession returns 404 not-found for unknown session id', async () => {
        const engine = {
            resolveSessionAccess: (() => ({ ok: false, reason: 'not-found' as const })) as SyncEngine['resolveSessionAccess']
        } as SyncEngine
        const app = buildApp()
        app.get(
            '/sessions/:id',
            withEngine(() => engine),
            withSession(),
            (c) => c.json({ ok: true })
        )

        const response = await app.request('/sessions/missing')
        expect(response.status).toBe(404)
        const body = await response.json() as { error: { code: string } }
        expect(body.error.code).toBe('not-found')
    })

    it('returns 500 internal-error for non-ApiRouteError throws without leaking details', async () => {
        const app = buildApp()
        app.get('/boom', () => {
            throw new Error('secret stack info should not leak')
        })

        const response = await app.request('/boom')
        expect(response.status).toBe(500)
        const body = await response.json() as { error: { code: string; message: string; details?: unknown } }
        expect(body.error.code).toBe('internal-error')
        expect(body.error.message).toBe('Internal server error')
        expect(body.error.details).toBeUndefined()
    })

    it('ApiRouteError omits details key when details is undefined', async () => {
        const app = buildApp()
        app.get('/x', () => {
            throw new ApiRouteError(404, 'not-found')
        })

        const response = await app.request('/x')
        expect(response.status).toBe(404)
        const body = await response.json() as { error: Record<string, unknown> }
        expect(body.error.code).toBe('not-found')
        expect('details' in body.error).toBe(false)
    })
})
