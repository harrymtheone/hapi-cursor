import { describe, expect, it } from 'bun:test'
import { createApp, createSession } from './_fixtures'

describe('sessions read routes', () => {
    it('falls back to metadata slash commands when RPC listing fails', async () => {
        const session = createSession({
            metadata: {
                path: '/tmp/project',
                host: 'localhost',
                slashCommands: ['help', 'memory', 'status']
            }
        })
        const { app } = createApp(session, {
            listSlashCommands: (async () => {
                throw new Error('RPC unavailable')
            }) as never
        })

        const response = await app.request('/api/sessions/session-1/slash-commands')
        expect(response.status).toBe(200)
        expect(await response.json()).toEqual({
            success: true,
            commands: [
                { name: 'help', source: 'builtin' },
                { name: 'memory', source: 'builtin' },
                { name: 'status', source: 'builtin' }
            ]
        })
    })

    it('merges RPC and metadata slash commands without hiding built-ins', async () => {
        const session = createSession({
            metadata: {
                path: '/tmp/project',
                host: 'localhost',
                slashCommands: ['help', 'memory']
            }
        })
        const { app } = createApp(session, {
            listSlashCommands: (async () => ({
                success: true,
                commands: [
                    { name: 'clear', source: 'builtin' },
                    { name: 'project-only', source: 'project', content: 'Project prompt' }
                ]
            })) as never
        })

        const response = await app.request('/api/sessions/session-1/slash-commands')
        expect(response.status).toBe(200)
        expect(await response.json()).toEqual({
            success: true,
            commands: [
                { name: 'help', source: 'builtin' },
                { name: 'memory', source: 'builtin' },
                { name: 'clear', source: 'builtin' },
                { name: 'project-only', source: 'project', content: 'Project prompt' }
            ]
        })
    })

    it('returns the session by id', async () => {
        const session = createSession({ active: true })
        const { app } = createApp(session)

        const response = await app.request('/api/sessions/session-1')
        expect(response.status).toBe(200)
        const body = await response.json() as { session: { id: string } }
        expect(body.session.id).toBe('session-1')
    })

    it('returns 404 for unknown session id', async () => {
        const { app } = createApp(null)
        const response = await app.request('/api/sessions/missing')
        expect(response.status).toBe(404)
        const body = await response.json() as { error: { code: string } }
        expect(body.error.code).toBe('not-found')
    })

    it('lists skills via engine', async () => {
        const session = createSession({ active: true })
        const { app } = createApp(session, {
            listSkills: (async () => ({
                success: true,
                skills: [{
                    name: 'skill-a',
                    source: 'project',
                    valid: true
                }]
            })) as never
        })

        const response = await app.request('/api/sessions/session-1/skills')
        expect(response.status).toBe(200)
        expect(await response.json()).toEqual({
            success: true,
            skills: [{
                name: 'skill-a',
                source: 'project',
                valid: true
            }]
        })
    })
})
