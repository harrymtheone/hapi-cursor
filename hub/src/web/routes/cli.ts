import { Hono } from 'hono'
import { z } from 'zod'
import { PROTOCOL_VERSION } from '@hapi/protocol'
import { constantTimeEquals } from '../../utils/crypto'
import { parseAccessToken } from '../../utils/accessToken'
import type { Machine, Session, SyncEngine } from '../../sync/syncEngine'

const bearerSchema = z.string().regex(/^Bearer\s+(.+)$/i)

const createOrLoadSessionSchema = z.object({
    tag: z.string().min(1),
    metadata: z.unknown(),
    agentState: z.unknown().nullable().optional(),
    model: z.string().optional(),
    modelReasoningEffort: z.string().optional(),
    effort: z.string().optional()
})

const createOrLoadMachineSchema = z.object({
    id: z.string().min(1),
    metadata: z.unknown(),
    runnerState: z.unknown().nullable().optional()
})

const getMessagesQuerySchema = z.object({
    afterSeq: z.coerce.number().int().min(0),
    limit: z.coerce.number().int().min(1).max(200).optional()
})

type CliEnv = {
    Variables: Record<string, never>
}

function resolveSession(
    engine: SyncEngine,
    sessionId: string
): { ok: true; session: Session; sessionId: string } | { ok: false; status: 404; error: string } {
    const access = engine.resolveSessionAccess(sessionId)
    if (access.ok) {
        return { ok: true, session: access.session, sessionId: access.sessionId }
    }
    return {
        ok: false,
        status: 404,
        error: 'Session not found'
    }
}

function resolveMachine(
    engine: SyncEngine,
    machineId: string
): { ok: true; machine: Machine } | { ok: false; status: 404; error: string } {
    const machine = engine.getMachine(machineId)
    if (machine) {
        return { ok: true, machine }
    }
    return { ok: false, status: 404, error: 'Machine not found' }
}

export function createCliRoutes(getSyncEngine: () => SyncEngine | null, cliApiToken: string): Hono<CliEnv> {
    const app = new Hono<CliEnv>()

    app.use('*', async (c, next) => {
        c.header('X-Hapi-Protocol-Version', String(PROTOCOL_VERSION))

        const raw = c.req.header('authorization')
        if (!raw) {
            return c.json({ error: 'Missing Authorization header' }, 401)
        }

        const parsed = bearerSchema.safeParse(raw)
        if (!parsed.success) {
            return c.json({ error: 'Invalid Authorization header' }, 401)
        }

        const token = parsed.data.replace(/^Bearer\s+/i, '')
        const parsedToken = parseAccessToken(token)
        if (!parsedToken || !constantTimeEquals(parsedToken, cliApiToken)) {
            return c.json({ error: 'Invalid token' }, 401)
        }

        return await next()
    })

    app.post('/sessions', async (c) => {
        const engine = getSyncEngine()
        if (!engine) {
            return c.json({ error: 'Not ready' }, 503)
        }
        const json = await c.req.json().catch(() => null)
        const parsed = createOrLoadSessionSchema.safeParse(json)
        if (!parsed.success) {
            return c.json({ error: 'Invalid body' }, 400)
        }

        const session = engine.getOrCreateSession(
            parsed.data.tag,
            parsed.data.metadata,
            parsed.data.agentState ?? null,
            {
                model: parsed.data.model,
                effort: parsed.data.effort,
                modelReasoningEffort: parsed.data.modelReasoningEffort
            }
        )
        return c.json({ session })
    })

    app.get('/sessions/resumable', (c) => {
        const engine = getSyncEngine()
        if (!engine) {
            return c.json({ error: 'Not ready' }, 503)
        }

        const machineId = c.req.query('machineId') || undefined
        const sessions = engine.listLocalResumableSessions({ machineId })
        return c.json({ sessions })
    })

    app.get('/sessions/:id/resume-target', (c) => {
        const engine = getSyncEngine()
        if (!engine) {
            return c.json({ error: 'Not ready' }, 503)
        }

        const result = engine.resolveLocalResumeTarget(c.req.param('id'))
        if (result.type === 'error') {
            const status = result.code === 'session_not_found' ? 404 : 409
            return c.json({ error: result.message, code: result.code }, status)
        }

        return c.json({ target: result.target })
    })

    app.post('/sessions/:id/handoff-local', async (c) => {
        const engine = getSyncEngine()
        if (!engine) {
            return c.json({ error: 'Not ready' }, 503)
        }

        const result = await engine.handoffSessionToLocal(c.req.param('id'))
        if (result.type === 'error') {
            const status = result.code === 'session_not_found' ? 404
                : result.code === 'already_local' ? 409
                    : 500
            return c.json({ error: result.message, code: result.code }, status)
        }

        return c.json({ ok: true })
    })

    app.get('/sessions/:id', (c) => {
        const engine = getSyncEngine()
        if (!engine) {
            return c.json({ error: 'Not ready' }, 503)
        }
        const sessionId = c.req.param('id')
        const resolved = resolveSession(engine, sessionId)
        if (!resolved.ok) {
            return c.json({ error: resolved.error }, resolved.status)
        }
        return c.json({ session: resolved.session })
    })

    app.get('/sessions/:id/messages', (c) => {
        const engine = getSyncEngine()
        if (!engine) {
            return c.json({ error: 'Not ready' }, 503)
        }
        const sessionId = c.req.param('id')
        const resolved = resolveSession(engine, sessionId)
        if (!resolved.ok) {
            return c.json({ error: resolved.error }, resolved.status)
        }

        const parsed = getMessagesQuerySchema.safeParse(c.req.query())
        if (!parsed.success) {
            return c.json({ error: 'Invalid query' }, 400)
        }

        const limit = parsed.data.limit ?? 200
        // Future-scheduled rows are excluded from CLI backfill — see
        // messages.ts:getDeliverableMessagesAfter for the rationale.  The
        // mature-scan path (releaseMatureScheduledMessages) is the sole
        // emit channel for scheduled rows.
        const messages = engine.getDeliverableMessagesAfter(resolved.sessionId, {
            afterSeq: parsed.data.afterSeq,
            limit,
            now: Date.now()
        })
        return c.json({ messages })
    })

    app.post('/machines', async (c) => {
        const engine = getSyncEngine()
        if (!engine) {
            return c.json({ error: 'Not ready' }, 503)
        }
        const json = await c.req.json().catch(() => null)
        const parsed = createOrLoadMachineSchema.safeParse(json)
        if (!parsed.success) {
            return c.json({ error: 'Invalid body' }, 400)
        }

        const machine = engine.getOrCreateMachine(parsed.data.id, parsed.data.metadata, parsed.data.runnerState ?? null)
        return c.json({ machine })
    })

    app.get('/machines/:id', (c) => {
        const engine = getSyncEngine()
        if (!engine) {
            return c.json({ error: 'Not ready' }, 503)
        }
        const machineId = c.req.param('id')
        const resolved = resolveMachine(engine, machineId)
        if (!resolved.ok) {
            return c.json({ error: resolved.error }, resolved.status)
        }
        return c.json({ machine: resolved.machine })
    })

    return app
}
