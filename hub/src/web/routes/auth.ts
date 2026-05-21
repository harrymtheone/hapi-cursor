import { Hono } from 'hono'
import { SignJWT } from 'jose'
import { z } from 'zod'
import { getConfiguration } from '../../configuration'
import { constantTimeEquals } from '../../utils/crypto'
import { parseAccessToken } from '../../utils/accessToken'
import { getOrCreateOwnerId } from '../../config/ownerId'
import type { WebAppEnv } from '../middleware/auth'

const authBodySchema = z.object({
    accessToken: z.string()
})

export function createAuthRoutes(jwtSecret: Uint8Array): Hono<WebAppEnv> {
    const app = new Hono<WebAppEnv>()

    app.post('/auth', async (c) => {
        const json = await c.req.json().catch(() => null)
        const parsed = authBodySchema.safeParse(json)
        if (!parsed.success) {
            return c.json({ error: 'Invalid body' }, 400)
        }

        const configuration = getConfiguration()
        const parsedToken = parseAccessToken(parsed.data.accessToken)
        if (!parsedToken || !constantTimeEquals(parsedToken, configuration.cliApiToken)) {
            return c.json({ error: 'Invalid access token' }, 401)
        }

        const userId = await getOrCreateOwnerId()

        const token = await new SignJWT({ uid: userId })
            .setProtectedHeader({ alg: 'HS256' })
            .setIssuedAt()
            .setExpirationTime('4h')
            .sign(jwtSecret)

        return c.json({
            token,
            user: {
                id: userId,
                username: undefined,
                firstName: 'Web User',
                lastName: undefined
            }
        })
    })

    return app
}
