import { describe, expect, it } from 'bun:test'
import { createApp, createSession } from './_fixtures'

describe('sessions config routes', () => {
    it('rejects model changes for Cursor sessions', async () => {
        const session = createSession({
            metadata: { path: '/tmp/project', host: 'localhost' }
        })
        const { app, applySessionConfigCalls } = createApp(session)

        const response = await app.request('/api/sessions/session-1/model', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ model: 'sonnet' })
        })

        expect(response.status).toBe(400)
        expect(applySessionConfigCalls).toEqual([])
        const body = await response.json() as { error: { code: string } }
        expect(body.error.code).toBe('model-change-unsupported')
    })

    it('applies permission mode changes for inactive sessions', async () => {
        const session = createSession({
            active: false,
            metadata: { path: '/tmp/project', host: 'localhost' }
        })
        const { app, applySessionConfigCalls } = createApp(session)

        const response = await app.request('/api/sessions/session-1/permission-mode', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ mode: 'yolo' })
        })

        expect(response.status).toBe(200)
        expect(await response.json()).toEqual({ ok: true })
        expect(applySessionConfigCalls).toEqual([
            ['session-1', { permissionMode: 'yolo' }]
        ])
    })

    it('rejects invalid permission mode body with 400 invalid-body', async () => {
        const session = createSession({ active: false })
        const { app } = createApp(session)

        const response = await app.request('/api/sessions/session-1/permission-mode', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ mode: 'not-a-mode' })
        })

        expect(response.status).toBe(400)
        const body = await response.json() as { error: { code: string } }
        expect(body.error.code).toBe('invalid-body')
    })
})
