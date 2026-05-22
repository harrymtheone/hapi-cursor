import { describe, expect, it } from 'bun:test'
import { createApp, createSession } from './_fixtures'

describe('sessions upload routes', () => {
    it('uploads a small base64 file', async () => {
        const session = createSession({ active: true })
        let uploaded: { filename: string; mimeType: string } | undefined
        const { app } = createApp(session, {
            uploadFile: (async (_id: string, filename: string, _content: string, mimeType: string) => {
                uploaded = { filename, mimeType }
                return { success: true, path: '/tmp/x' }
            }) as never
        })

        const response = await app.request('/api/sessions/session-1/upload', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                filename: 'a.txt',
                content: Buffer.from('hello').toString('base64'),
                mimeType: 'text/plain'
            })
        })
        expect(response.status).toBe(200)
        expect(uploaded).toEqual({ filename: 'a.txt', mimeType: 'text/plain' })
    })

    it('rejects upload over 50MB with 413 payload-too-large', async () => {
        const session = createSession({ active: true })
        const { app } = createApp(session)

        const bigBase64 = 'A'.repeat(70 * 1024 * 1024)
        const response = await app.request('/api/sessions/session-1/upload', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                filename: 'big.bin',
                content: bigBase64,
                mimeType: 'application/octet-stream'
            })
        })

        expect(response.status).toBe(413)
        const body = await response.json() as { error: { code: string } }
        expect(body.error.code).toBe('payload-too-large')
    })

    it('rejects upload on inactive session with 409 session-not-active', async () => {
        const session = createSession({ active: false })
        const { app } = createApp(session)

        const response = await app.request('/api/sessions/session-1/upload', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                filename: 'a.txt',
                content: 'aGVsbG8=',
                mimeType: 'text/plain'
            })
        })
        expect(response.status).toBe(409)
        const body = await response.json() as { error: { code: string } }
        expect(body.error.code).toBe('session-not-active')
    })

    it('deletes an upload', async () => {
        const session = createSession({ active: true })
        let deletedPath: string | undefined
        const { app } = createApp(session, {
            deleteUploadFile: (async (_id: string, path: string) => {
                deletedPath = path
                return { success: true }
            }) as never
        })

        const response = await app.request('/api/sessions/session-1/upload/delete', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ path: '/tmp/x' })
        })
        expect(response.status).toBe(200)
        expect(deletedPath).toBe('/tmp/x')
    })
})
