import { Hono } from 'hono'
import { SignJWT } from 'jose'
import { z } from 'zod'
import { constantTimeEquals } from '../../utils/crypto'
import { parseAccessToken } from '../../utils/accessToken'
import type { WebAppEnv } from '../middleware/auth'

const authBodySchema = z.object({
    accessToken: z.string()
})

export function createAuthRoutes(
    jwtSecret: Uint8Array,
    cliApiToken: string,
    ownerId: number
): Hono<WebAppEnv> {
    const app = new Hono<WebAppEnv>()

    app.post('/auth', async (c) => {
        const json = await c.req.json().catch(() => null)
        const parsed = authBodySchema.safeParse(json)
        if (!parsed.success) {
            return c.json({ error: 'Invalid body' }, 400)
        }

        const parsedToken = parseAccessToken(parsed.data.accessToken)
        if (!parsedToken || !constantTimeEquals(parsedToken, cliApiToken)) {
            return c.json({ error: 'Invalid access token' }, 401)
        }

        const token = await new SignJWT({ uid: ownerId })
            .setProtectedHeader({ alg: 'HS256' })
            .setIssuedAt()
            .setExpirationTime('4h')
            .sign(jwtSecret)

        return c.json({
            token,
            user: {
                id: ownerId,
                username: undefined,
                firstName: 'Web User',
                lastName: undefined
            }
        })
    })

    return app
}
