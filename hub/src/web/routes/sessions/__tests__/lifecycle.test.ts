import { describe, expect, it } from 'bun:test'
import { createApp, createSession } from './_fixtures'

describe('sessions lifecycle routes', () => {
    it('passes permissionMode from resume body to resumeSession', async () => {
        const session = createSession({
            active: false,
            metadata: { path: '/tmp/project', host: 'localhost' }
        })
        let capturedResumeOpts: { permissionMode?: string } | undefined
        const { app } = createApp(session, {
            resumeSession: (async (sessionId: string, opts?: { permissionMode?: string }) => {
                capturedResumeOpts = opts
                return { type: 'success', sessionId }
            }) as never
        })

        const response = await app.request('/api/sessions/session-1/resume', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ permissionMode: 'yolo' })
        })

        expect(response.status).toBe(200)
        expect(capturedResumeOpts).toEqual({ permissionMode: 'yolo' })
    })

    it('aborts an active session', async () => {
        const session = createSession({ active: true })
        let aborted = false
        const { app } = createApp(session, {
            abortSession: (async () => { aborted = true }) as never
        })

        const response = await app.request('/api/sessions/session-1/abort', { method: 'POST' })
        expect(response.status).toBe(200)
        expect(aborted).toBe(true)
    })

    it('refuses to abort an inactive session with 409', async () => {
        const session = createSession({ active: false })
        const { app } = createApp(session)

        const response = await app.request('/api/sessions/session-1/abort', { method: 'POST' })
        expect(response.status).toBe(409)
        const body = await response.json() as { error: { code: string } }
        expect(body.error.code).toBe('session-not-active')
    })

    it('renames a session', async () => {
        const session = createSession({ active: false })
        let renamedTo: string | undefined
        const { app } = createApp(session, {
            renameSession: (async (_id: string, name: string) => { renamedTo = name }) as never
        })

        const response = await app.request('/api/sessions/session-1', {
            method: 'PATCH',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ name: 'New name' })
        })
        expect(response.status).toBe(200)
        expect(renamedTo).toBe('New name')
    })

    it('rejects deleting an active session with 409', async () => {
        const session = createSession({ active: true })
        const { app } = createApp(session)

        const response = await app.request('/api/sessions/session-1', { method: 'DELETE' })
        expect(response.status).toBe(409)
        const body = await response.json() as { error: { code: string } }
        expect(body.error.code).toBe('session-active')
    })

    it('deletes an inactive session', async () => {
        const session = createSession({ active: false })
        let deleted = false
        const { app } = createApp(session, {
            deleteSession: (async () => { deleted = true }) as never
        })

        const response = await app.request('/api/sessions/session-1', { method: 'DELETE' })
        expect(response.status).toBe(200)
        expect(deleted).toBe(true)
    })

    it('returns 404 when resuming an unknown session', async () => {
        const { app } = createApp(null)
        const response = await app.request('/api/sessions/missing/resume', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({})
        })
        expect(response.status).toBe(404)
        const body = await response.json() as { error: { code: string } }
        expect(body.error.code).toBe('not-found')
    })
})
