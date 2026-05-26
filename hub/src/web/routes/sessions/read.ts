import { normalizeSkillSummaryForWire, toSessionSummary } from '@hapi/protocol'
import type { ListSkillsResponse } from '@hapi/protocol/schemas'
import { Hono } from 'hono'
import type { Session, SyncEngine } from '../../../sync/syncEngine'
import type { WebAppEnv } from '../../middleware/auth'
import { withEngine, withSession } from '../../middleware/route-helpers'

type SlashCommand = {
    name: string
    description?: string
    source: 'builtin' | 'user' | 'plugin' | 'project'
    content?: string
    pluginName?: string
}

function commandsFromMetadataSlashCommands(names: readonly string[] | undefined): SlashCommand[] {
    if (!names?.length) {
        return []
    }
    return names
        .filter((name): name is string => typeof name === 'string' && name.trim().length > 0)
        .map((name) => ({
            name,
            source: 'builtin'
        }))
}

function mergeSlashCommands(
    primary: readonly SlashCommand[],
    fallback: readonly SlashCommand[]
): SlashCommand[] {
    const commandMap = new Map<string, SlashCommand>()
    for (const command of [...fallback, ...primary]) {
        commandMap.set(command.name, command)
    }
    return Array.from(commandMap.values())
}

export function createReadRoutes(
    getSyncEngine: () => SyncEngine | null
): Hono<WebAppEnv> {
    const app = new Hono<WebAppEnv>()

    app.get('/sessions', withEngine(getSyncEngine), (c) => {
        const engine = c.get('engine')

        const getPendingCount = (s: Session) =>
            s.agentState?.requests ? Object.keys(s.agentState.requests).length : 0

        const sessions = engine.getSessions()
            .sort((a, b) => {
                if (a.active !== b.active) {
                    return a.active ? -1 : 1
                }
                const aPending = getPendingCount(a)
                const bPending = getPendingCount(b)
                if (a.active && aPending !== bPending) {
                    return bPending - aPending
                }
                return b.updatedAt - a.updatedAt
            })
            .map(toSessionSummary)

        return c.json({ sessions })
    })

    app.get('/sessions/:id', withEngine(getSyncEngine), withSession(), (c) => {
        return c.json({ session: c.get('session') })
    })

    app.get('/sessions/:id/slash-commands', withEngine(getSyncEngine), withSession(), async (c) => {
        const engine = c.get('engine')
        const session = c.get('session')
        const agent = 'cursor'

        const metadataCommands = commandsFromMetadataSlashCommands(
            session.metadata?.slashCommands
        )

        try {
            const result = await engine.listSlashCommands(session.id, agent)
            if (result.success && result.commands) {
                return c.json({
                    ...result,
                    commands: mergeSlashCommands(result.commands, metadataCommands)
                })
            }
            if (metadataCommands.length > 0) {
                return c.json({ success: true, commands: metadataCommands })
            }
            return c.json(result)
        } catch (error) {
            if (metadataCommands.length > 0) {
                return c.json({ success: true, commands: metadataCommands })
            }
            return c.json({
                success: false,
                error: error instanceof Error ? error.message : 'Failed to list slash commands'
            })
        }
    })

    app.get('/sessions/:id/skills', withEngine(getSyncEngine), withSession(), async (c) => {
        const engine = c.get('engine')
        const session = c.get('session')
        try {
            const result = await engine.listSkills(session.id) as ListSkillsResponse
            if (result.success && result.skills) {
                return c.json({
                    ...result,
                    skills: result.skills.map((skill) => normalizeSkillSummaryForWire(skill)),
                })
            }
            return c.json(result)
        } catch (error) {
            return c.json({
                success: false,
                error: error instanceof Error ? error.message : 'Failed to list skills'
            })
        }
    })

    return app
}
