import { Hono } from 'hono'
import type { SyncEngine } from '../../../sync/syncEngine'
import type { WebAppEnv } from '../../middleware/auth'
import { createConfigRoutes } from './config'
import { createLifecycleRoutes } from './lifecycle'
import { createReadRoutes } from './read'
import { createSkillPolicyRoutes } from './skillPolicy'
import { createUploadRoutes } from './upload'

export function createSessionsRoutes(
    getSyncEngine: () => SyncEngine | null
): Hono<WebAppEnv> {
    const app = new Hono<WebAppEnv>()
    app.route('/', createLifecycleRoutes(getSyncEngine))
    app.route('/', createConfigRoutes(getSyncEngine))
    app.route('/', createSkillPolicyRoutes(getSyncEngine))
    app.route('/', createUploadRoutes(getSyncEngine))
    app.route('/', createReadRoutes(getSyncEngine))
    return app
}
