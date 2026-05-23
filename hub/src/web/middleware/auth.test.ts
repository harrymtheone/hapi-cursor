/**
 * REFT-03 — middleware-layer coverage for createAuthMiddleware.
 *
 * Anchors:
 * - D-184: NO replay-detection added; "replayed JWT" == expired-JWT-resubmitted
 *   (single-user Tailscale posture, per orchestrator override 2026-05-23).
 * - D-185: two-layer split — this file owns middleware cases only; the route
 *   layer lives in ../routes/auth.test.ts.
 * - D-186: every 4xx response body AND every captured console.* line is
 *   asserted free of the raw jwtSecret bytes (cliApiToken is out of scope
 *   at the middleware layer).
 * - D-187: module-local `make*` factories — makeValidJwt / makeExpiredJwt /
 *   makeTamperedJwt / makeWrongAlgJwt / makeAlgNoneJwt /
 *   makePayloadWithoutUidJwt.
 * - Orchestrator override 2026-05-23: the `uid != ownerId` case is DROPPED
 *   (middleware does not enforce uid equality). Replaced by a positive-
 *   signature-but-missing-uid case that asserts 401 Invalid token payload.
 *
 * Wrong-alg variant chosen: HS512 re-sign with the same secret. jose's
 * `algorithms: ['HS256']` allow-list deterministically rejects the HS512
 * token with JWSAlgNotAllowed before signature verification, so this is
 * the simplest construction that lands on the 401 Invalid token path.
 */
import { describe, expect, it, spyOn } from 'bun:test'
import { Hono } from 'hono'
import { SignJWT } from 'jose'
import { createAuthMiddleware, type WebAppEnv } from './auth'
import { assertNoSecretLeak } from '../test-utils/assertNoSecretLeak'

const jwtSecret = new TextEncoder().encode(
    'test-secret-with-enough-entropy-for-hs256-do-not-leak-marker'
)

const SECRETS: ReadonlyArray<string> = [new TextDecoder().decode(jwtSecret)]

function b64url(s: string): string {
    return Buffer.from(s).toString('base64url')
}

async function makeValidJwt(uid: number = 1, ttl: string = '4h'): Promise<string> {
    return await new SignJWT({ uid })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime(ttl)
        .sign(jwtSecret)
}

async function makeExpiredJwt(uid: number = 1): Promise<string> {
    const nowSec = Math.floor(Date.now() / 1000)
    return await new SignJWT({ uid })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt(nowSec - 86_400)
        .setExpirationTime(nowSec - 60)
        .sign(jwtSecret)
}

async function makeTamperedJwt(uid: number = 1): Promise<string> {
    const valid = await makeValidJwt(uid)
    const parts = valid.split('.')
    const sig = parts[2] ?? ''
    const mangled = (sig.length > 2 ? sig.slice(0, -2) : sig) + 'AA'
    parts[2] = mangled === sig ? 'AAAA' : mangled
    return parts.join('.')
}

async function makeWrongAlgJwt(uid: number = 1): Promise<string> {
    // HS512 re-sign with the same secret — header.alg = 'HS512' is outside
    // the middleware's HS256 allow-list, so jose rejects with JWSAlgNotAllowed.
    return await new SignJWT({ uid })
        .setProtectedHeader({ alg: 'HS512' })
        .setIssuedAt()
        .setExpirationTime('4h')
        .sign(jwtSecret)
}

function makeAlgNoneJwt(uid: number = 1): string {
    // jose refuses to sign alg:'none', so we hand-construct the JWS compact
    // serialization with an empty signature segment.
    const header = b64url(JSON.stringify({ alg: 'none', typ: 'JWT' }))
    const payload = b64url(JSON.stringify({ uid }))
    return `${header}.${payload}.`
}

async function makePayloadWithoutUidJwt(): Promise<string> {
    return await new SignJWT({ foo: 'bar' })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('1h')
        .sign(jwtSecret)
}

function mount(): Hono<WebAppEnv> {
    const app = new Hono<WebAppEnv>()
    app.use('/api/*', createAuthMiddleware(jwtSecret))
    app.post('/api/auth', (c) => c.json({ skipped: true }))
    app.get('/api/ping', (c) => c.json({ ok: true }))
    app.get('/api/events', (c) => c.json({ ok: true }))
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

describe('createAuthMiddleware (REFT-03)', () => {
    it('skips auth for path /api/auth (short-circuit; pins login endpoint behavior)', async () => {
        const app = mount()
        const res = await app.request('/api/auth', { method: 'POST' })
        expect(res.status).toBe(200)
        expect(await res.json()).toEqual({ skipped: true })
    })

    it('returns 401 Missing authorization token when no header present on /api/ping', async () => {
        const cap = captureConsole()
        try {
            const app = mount()
            const res = await app.request('/api/ping')
            const text = await res.text()
            expect(res.status).toBe(401)
            expect(JSON.parse(text)).toEqual({ error: 'Missing authorization token' })
            assertNoSecretLeak(text, cap.logs, SECRETS)
        } finally {
            cap.restore()
        }
    })

    it('returns 401 Missing authorization token for Bearer with empty token', async () => {
        const cap = captureConsole()
        try {
            const app = mount()
            const res = await app.request('/api/ping', {
                headers: { authorization: 'Bearer ' }
            })
            const text = await res.text()
            expect(res.status).toBe(401)
            expect(JSON.parse(text)).toEqual({ error: 'Missing authorization token' })
            assertNoSecretLeak(text, cap.logs, SECRETS)
        } finally {
            cap.restore()
        }
    })

    it('returns 401 Invalid token for tampered signature', async () => {
        const cap = captureConsole()
        try {
            const app = mount()
            const token = await makeTamperedJwt()
            const res = await app.request('/api/ping', {
                headers: { authorization: `Bearer ${token}` }
            })
            const text = await res.text()
            expect(res.status).toBe(401)
            expect(JSON.parse(text)).toEqual({ error: 'Invalid token' })
            assertNoSecretLeak(text, cap.logs, SECRETS)
        } finally {
            cap.restore()
        }
    })

    it('returns 401 Invalid token for expired JWT (replay-after-expiry; D-184)', async () => {
        const cap = captureConsole()
        try {
            const app = mount()
            const token = await makeExpiredJwt()
            const res = await app.request('/api/ping', {
                headers: { authorization: `Bearer ${token}` }
            })
            const text = await res.text()
            expect(res.status).toBe(401)
            expect(JSON.parse(text)).toEqual({ error: 'Invalid token' })
            assertNoSecretLeak(text, cap.logs, SECRETS)
        } finally {
            cap.restore()
        }
    })

    it('returns 401 Invalid token for wrong-alg JWT (HS512 vs HS256 allow-list)', async () => {
        const cap = captureConsole()
        try {
            const app = mount()
            const token = await makeWrongAlgJwt()
            const res = await app.request('/api/ping', {
                headers: { authorization: `Bearer ${token}` }
            })
            const text = await res.text()
            expect(res.status).toBe(401)
            expect(JSON.parse(text)).toEqual({ error: 'Invalid token' })
            assertNoSecretLeak(text, cap.logs, SECRETS)
        } finally {
            cap.restore()
        }
    })

    it('returns 401 Invalid token for forged alg:none', async () => {
        const cap = captureConsole()
        try {
            const app = mount()
            const token = makeAlgNoneJwt()
            const res = await app.request('/api/ping', {
                headers: { authorization: `Bearer ${token}` }
            })
            const text = await res.text()
            expect(res.status).toBe(401)
            expect(JSON.parse(text)).toEqual({ error: 'Invalid token' })
            assertNoSecretLeak(text, cap.logs, SECRETS)
        } finally {
            cap.restore()
        }
    })

    it('returns 401 Invalid token payload for valid HS256 JWT with no uid (replaces uid != ownerId case per orchestrator override 2026-05-23)', async () => {
        const cap = captureConsole()
        try {
            const app = mount()
            const token = await makePayloadWithoutUidJwt()
            const res = await app.request('/api/ping', {
                headers: { authorization: `Bearer ${token}` }
            })
            const text = await res.text()
            expect(res.status).toBe(401)
            expect(JSON.parse(text)).toEqual({ error: 'Invalid token payload' })
            assertNoSecretLeak(text, cap.logs, SECRETS)
        } finally {
            cap.restore()
        }
    })

    it('falls back to ?token= query param on /api/events and rejects bad token', async () => {
        const cap = captureConsole()
        try {
            const app = mount()
            const res = await app.request('/api/events?token=garbage')
            const text = await res.text()
            expect(res.status).toBe(401)
            expect(JSON.parse(text)).toEqual({ error: 'Invalid token' })
            assertNoSecretLeak(text, cap.logs, SECRETS)
        } finally {
            cap.restore()
        }
    })

    it('passes valid HS256 JWT with { uid } payload through to next()', async () => {
        const app = mount()
        const token = await makeValidJwt(1)
        const res = await app.request('/api/ping', {
            headers: { authorization: `Bearer ${token}` }
        })
        expect(res.status).toBe(200)
        expect(await res.json()).toEqual({ ok: true })
    })
})
