import { describe, expect, it } from 'bun:test'
import { createApp, createSession } from './_fixtures'

describe('sessions config routes', () => {
    it('returns active applied model change results', async () => {
        const session = createSession({
            metadata: { path: '/tmp/project', host: 'localhost' }
        })
        const result = {
            status: 'applied' as const,
            model: 'cursor-runtime-model-next',
            modelReasoningEffort: null,
            effort: null
        }
        const { app, applySessionConfigCalls } = createApp(session, {}, result)

        const response = await app.request('/api/sessions/session-1/model', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ model: 'cursor-runtime-model-next' })
        })

        expect(response.status).toBe(200)
        expect(await response.json()).toEqual(result)
        expect(applySessionConfigCalls).toEqual([
            ['session-1', { model: 'cursor-runtime-model-next' }]
        ])
    })

    it('returns active applies-next-run model change results', async () => {
        const session = createSession()
        const result = {
            status: 'applies-next-run' as const,
            model: 'cursor-runtime-model-next',
            modelReasoningEffort: null,
            effort: null,
            reason: 'unknown' as const
        }
        const { app } = createApp(session, {}, result)

        const response = await app.request('/api/sessions/session-1/model', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ model: 'cursor-runtime-model-next' })
        })

        expect(response.status).toBe(200)
        expect(await response.json()).toEqual(result)
    })

    it('returns failed model change results without route-side persistence', async () => {
        const session = createSession()
        const result = {
            status: 'failed' as const,
            model: 'cursor-runtime-model-next',
            modelReasoningEffort: null,
            effort: null,
            reason: 'unknown' as const
        }
        const { app, applySessionConfigCalls } = createApp(session, {}, result)

        const response = await app.request('/api/sessions/session-1/model', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ model: 'cursor-runtime-model-next' })
        })

        expect(response.status).toBe(200)
        expect(await response.json()).toEqual(result)
        expect(session.model).toBe('ollama/exaone:4.5-33b-q8')
        expect(applySessionConfigCalls).toEqual([
            ['session-1', { model: 'cursor-runtime-model-next' }]
        ])
    })

    it('allows inactive model changes as applies-next-run metadata', async () => {
        const session = createSession({ active: false })
        const result = {
            status: 'applies-next-run' as const,
            model: 'cursor-runtime-model-next',
            modelReasoningEffort: null,
            effort: null,
            reason: 'unknown' as const
        }
        const { app } = createApp(session, {}, result)

        const response = await app.request('/api/sessions/session-1/model', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ model: 'cursor-runtime-model-next' })
        })

        expect(response.status).toBe(200)
        expect(await response.json()).toEqual(result)
    })

    it('returns apply-config-failed when model apply is rejected by the engine', async () => {
        const session = createSession()
        const { app } = createApp(session, {
            applySessionConfig: async () => {
                throw new Error('selected runtime config was rejected')
            }
        })

        const response = await app.request('/api/sessions/session-1/model', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ model: 'cursor-runtime-model-next' })
        })

        expect(response.status).toBe(409)
        const body = await response.json() as { error: { code: string; message: string } }
        expect(body.error.code).toBe('apply-config-failed')
        expect(body.error.message).toBe('selected runtime config was rejected')
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
