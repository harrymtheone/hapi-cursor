/**
 * REFT-03 — route layer negative + positive coverage for POST /api/auth.
 *
 * Anchors:
 * - D-185 (two-layer split: route vs middleware)
 * - D-186 (no secret leak in any 4xx body or captured log line)
 * - D-187 (module-local `make*` fixture factories — none needed at route layer)
 * - Orchestrator override 2026-05-23: `{ accessToken: '' }` -> 401 (not 400),
 *   because `parseAccessToken('')` trims to null and falls through to the
 *   constantTimeEquals failure path.
 */
import { describe, expect, it, spyOn } from 'bun:test'
import { Hono } from 'hono'
import { jwtVerify } from 'jose'
import { createAuthRoutes } from './auth'
import { assertNoSecretLeak } from '../test-utils/assertNoSecretLeak'

const jwtSecret = new TextEncoder().encode(
    'test-secret-with-enough-entropy-for-hs256-do-not-leak-marker'
)
const cliApiToken = 'cli-token-xyz-do-not-leak-marker'
const ownerId = 42

const SECRETS: ReadonlyArray<string> = [
    cliApiToken,
    new TextDecoder().decode(jwtSecret)
]

function makeApp(): Hono {
    const app = new Hono()
    app.route('/api', createAuthRoutes(jwtSecret, cliApiToken, ownerId))
    return app
}

function captureConsole(): { logs: string[]; restore: () => void } {
    const logs: string[] = []
    const push = (...args: unknown[]) => {
        logs.push(args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' '))
    }
    const spies = [
        spyOn(console, 'log').mockImplementation(push as never),
        spyOn(console, 'warn').mockImplementation(push as never),
        spyOn(console, 'error').mockImplementation(push as never)
    ]
    return {
        logs,
        restore: () => {
            for (const s of spies) s.mockRestore()
        }
    }
}

async function postAuth(body: string): Promise<Response> {
    const app = makeApp()
    return app.request('/api/auth', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body
    })
}

describe('POST /api/auth (REFT-03 route)', () => {
    it('rejects non-JSON body with 400 Invalid body + no leak', async () => {
        const cap = captureConsole()
        try {
            const res = await postAuth('not json')
            const text = await res.text()
            expect(res.status).toBe(400)
            expect(JSON.parse(text)).toEqual({ error: 'Invalid body' })
            assertNoSecretLeak(text, cap.logs, SECRETS)
        } finally {
            cap.restore()
        }
    })

    it('rejects empty {} body with 400 Invalid body + no leak', async () => {
        const cap = captureConsole()
        try {
            const res = await postAuth('{}')
            const text = await res.text()
            expect(res.status).toBe(400)
            expect(JSON.parse(text)).toEqual({ error: 'Invalid body' })
            assertNoSecretLeak(text, cap.logs, SECRETS)
        } finally {
            cap.restore()
        }
    })

    it('rejects non-string accessToken (number) with 400 Invalid body + no leak', async () => {
        const cap = captureConsole()
        try {
            const res = await postAuth(JSON.stringify({ accessToken: 123 }))
            const text = await res.text()
            expect(res.status).toBe(400)
            expect(JSON.parse(text)).toEqual({ error: 'Invalid body' })
            assertNoSecretLeak(text, cap.logs, SECRETS)
        } finally {
            cap.restore()
        }
    })

    it('rejects empty-string accessToken with 401 Invalid access token + no leak (parseAccessToken trims to null)', async () => {
        const cap = captureConsole()
        try {
            const res = await postAuth(JSON.stringify({ accessToken: '' }))
            const text = await res.text()
            expect(res.status).toBe(401)
            expect(JSON.parse(text)).toEqual({ error: 'Invalid access token' })
            assertNoSecretLeak(text, cap.logs, SECRETS)
        } finally {
            cap.restore()
        }
    })

    it('rejects wrong accessToken with 401 Invalid access token + no leak', async () => {
        const cap = captureConsole()
        try {
            const res = await postAuth(JSON.stringify({ accessToken: 'wrong-token-marker' }))
            const text = await res.text()
            expect(res.status).toBe(401)
            expect(JSON.parse(text)).toEqual({ error: 'Invalid access token' })
            assertNoSecretLeak(text, cap.logs, SECRETS)
        } finally {
            cap.restore()
        }
    })

    it('accepts correct accessToken — returns 200 with HS256 JWT decodable to { uid: ownerId }', async () => {
        const res = await postAuth(JSON.stringify({ accessToken: cliApiToken }))
        expect(res.status).toBe(200)
        const body = (await res.json()) as {
            token: string
            user: { id: number; firstName: string }
        }
        expect(typeof body.token).toBe('string')
        expect(body.user.id).toBe(ownerId)
        expect(body.user.firstName).toBe('Web User')

        const verified = await jwtVerify(body.token, jwtSecret, {
            algorithms: ['HS256']
        })
        expect(verified.protectedHeader.alg).toBe('HS256')
        expect(verified.payload.uid).toBe(ownerId)
    })
})
