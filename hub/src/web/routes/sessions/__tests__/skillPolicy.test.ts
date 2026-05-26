import { describe, expect, it } from 'bun:test'
import { createApp, createSession } from './_fixtures'

const sampleSkill = {
    name: 'my-skill',
    description: 'Does things',
    source: 'project' as const,
    invocationMode: 'auto' as const,
    valid: true
}

describe('sessions skill-policy route', () => {
    it('POST skill-policy single toggle returns 200 and calls applySkillPolicy', async () => {
        const session = createSession({ active: false })
        const calls: Array<{ name: string; state: string }> = []
        const { app } = createApp(session, {
            applySkillPolicy: (async (_id: string, update: { name: string; state: string }) => {
                calls.push(update)
            }) as never
        })

        const response = await app.request('/api/sessions/session-1/skill-policy', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ name: 'my-skill', state: 'disabled' })
        })

        expect(response.status).toBe(200)
        expect(await response.json()).toEqual({ ok: true })
        expect(calls).toEqual([{ name: 'my-skill', state: 'disabled' }])
    })

    it('POST skill-policy batch replaces map via applySkillPolicyBatch', async () => {
        const session = createSession({ active: false })
        let captured: Record<string, string> | undefined
        const { app } = createApp(session, {
            applySkillPolicyBatch: (async (_id: string, skillPolicy: Record<string, string>) => {
                captured = skillPolicy
            }) as never
        })

        const response = await app.request('/api/sessions/session-1/skill-policy', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ skillPolicy: { 'skill-a': 'enabled', 'skill-b': 'disabled' } })
        })

        expect(response.status).toBe(200)
        expect(captured).toEqual({ 'skill-a': 'enabled', 'skill-b': 'disabled' })
    })

    it('POST skill-policy reset calls resetSessionSkillPolicy', async () => {
        const session = createSession({ active: false })
        let reset = false
        const { app } = createApp(session, {
            resetSessionSkillPolicy: (async () => {
                reset = true
            }) as never
        })

        const response = await app.request('/api/sessions/session-1/skill-policy', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ reset: true })
        })

        expect(response.status).toBe(200)
        expect(reset).toBe(true)
    })

    it('returns 409 on concurrent modification', async () => {
        const session = createSession({ active: false })
        const { app } = createApp(session, {
            applySkillPolicy: (async () => {
                throw new Error('Session was modified concurrently. Please try again.')
            }) as never
        })

        const response = await app.request('/api/sessions/session-1/skill-policy', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ name: 'my-skill', state: 'disabled' })
        })

        expect(response.status).toBe(409)
        const body = await response.json() as { error: { code: string } }
        expect(body.error.code).toBe('skill-policy-conflict')
    })

    it('rejects oversized skillPolicy map with 400 invalid-body', async () => {
        const session = createSession({ active: false })
        const { app } = createApp(session)

        const skillPolicy: Record<string, string> = {}
        for (let i = 0; i < 201; i += 1) {
            skillPolicy[`skill-${i}`] = 'enabled'
        }

        const response = await app.request('/api/sessions/session-1/skill-policy', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ skillPolicy })
        })

        expect(response.status).toBe(400)
        const body = await response.json() as { error: { code: string } }
        expect(body.error.code).toBe('invalid-body')
    })
})

describe('sessions read routes skills shape', () => {
    it('lists skills via engine with protocol SkillSummary objects', async () => {
        const session = createSession({ active: true })
        const { app } = createApp(session, {
            listSkills: (async () => ({ success: true, skills: [sampleSkill] })) as never
        })

        const response = await app.request('/api/sessions/session-1/skills')
        expect(response.status).toBe(200)
        expect(await response.json()).toEqual({ success: true, skills: [sampleSkill] })
    })
})
