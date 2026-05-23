# Phase 03: cut-multi-user-namespace-isolation - Pattern Map

**Mapped:** 2026-05-21  
**Files analyzed:** 44  
**Analogs found:** 44 / 44

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `hub/src/utils/accessToken.ts` | utility | request-response auth transform | `hub/src/utils/accessToken.ts` | exact |
| `hub/src/utils/accessToken.test.ts` | test | transform | `hub/src/utils/accessToken.test.ts` | exact |
| `hub/src/config/cliApiToken.ts` | config | file/env I/O | `hub/src/config/cliApiToken.ts` | exact |
| `hub/src/config/cliApiToken.test.ts` | test | file/env I/O | `hub/src/config/cliApiToken.test.ts` | role-match |
| `hub/src/web/routes/auth.ts` | route | request-response | `hub/src/web/routes/auth.ts` | exact |
| `hub/src/web/middleware/auth.ts` | middleware | request-response | `hub/src/web/middleware/auth.ts` | exact |
| `hub/src/socket/server.ts` | socket server | event-driven | `hub/src/socket/server.ts` | exact |
| `hub/src/socket/socketTypes.ts` | type utility | event-driven | `hub/src/socket/socketTypes.ts` | exact |
| `hub/src/socket/handlers/terminal.ts` | socket handler | event-driven | `hub/src/socket/handlers/terminal.ts` | exact |
| `hub/src/socket/handlers/terminal.test.ts` | test | event-driven | `hub/src/socket/handlers/terminal.test.ts` | exact |
| `hub/src/socket/handlers/cli/index.ts` | socket handler aggregator | event-driven | `hub/src/socket/handlers/cli/index.ts` | exact |
| `hub/src/socket/handlers/cli/types.ts` | type utility | event-driven | `hub/src/socket/handlers/cli/types.ts` | exact |
| `hub/src/socket/handlers/cli/sessionHandlers.ts` | socket handler | event-driven + CRUD | `hub/src/socket/handlers/cli/sessionHandlers.ts` | exact |
| `hub/src/socket/handlers/cli/machineHandlers.ts` | socket handler | event-driven + CRUD | `hub/src/socket/handlers/cli/machineHandlers.ts` | exact |
| `hub/src/socket/handlers/cli/terminalHandlers.ts` | socket handler | event-driven | `hub/src/socket/handlers/cli/terminalHandlers.ts` | exact |
| `hub/src/sync/syncEngine.ts` | service facade | request-response + event-driven | `hub/src/sync/syncEngine.ts` | exact |
| `hub/src/sync/sessionCache.ts` | cache/service | CRUD + event-driven | `hub/src/sync/sessionCache.ts` | exact |
| `hub/src/sync/machineCache.ts` | cache/service | CRUD + event-driven | `hub/src/sync/machineCache.ts` | exact |
| `hub/src/sync/eventPublisher.ts` | event publisher | pub-sub | `hub/src/sync/eventPublisher.ts` | exact |
| `hub/src/sse/sseManager.ts` | realtime manager | streaming + pub-sub | `hub/src/sse/sseManager.ts` | exact |
| `hub/src/sse/sseManager.test.ts` | test | streaming + pub-sub | `hub/src/sse/sseManager.test.ts` | exact |
| `hub/src/visibility/visibilityTracker.ts` | service | event-driven state tracking | `hub/src/visibility/visibilityTracker.ts` | exact |
| `hub/src/push/pushNotificationChannel.ts` | notification service | event-driven + pub-sub | `hub/src/push/pushNotificationChannel.ts` | exact |
| `hub/src/push/pushService.ts` | notification service | batch + CRUD cleanup | `hub/src/push/pushService.ts` | exact |
| `hub/src/web/routes/sessions.ts` | route | request-response + CRUD | `hub/src/web/routes/sessions.ts` | exact |
| `hub/src/web/routes/machines.ts` | route | request-response + RPC | `hub/src/web/routes/machines.ts` | exact |
| `hub/src/web/routes/events.ts` | route | streaming | `hub/src/web/routes/events.ts` | exact |
| `hub/src/web/routes/push.ts` | route | request-response + CRUD | `hub/src/web/routes/push.ts` | exact |
| `hub/src/web/routes/cli.ts` | route | request-response + CRUD | `hub/src/web/routes/cli.ts` | exact |
| `hub/src/web/routes/guards.ts` | route guard utility | request-response | `hub/src/web/routes/guards.ts` | exact |
| `hub/src/store/index.ts` | store/schema | SQLite schema + migration | `hub/src/store/index.ts` | exact |
| `hub/src/store/types.ts` | model/types | CRUD | `hub/src/store/types.ts` | exact |
| `hub/src/store/sessions.ts` | store module | SQLite CRUD | `hub/src/store/sessions.ts` | exact |
| `hub/src/store/sessionStore.ts` | store wrapper | CRUD | `hub/src/store/sessionStore.ts` | exact |
| `hub/src/store/machines.ts` | store module | SQLite CRUD | `hub/src/store/machines.ts` | exact |
| `hub/src/store/machineStore.ts` | store wrapper | CRUD | `hub/src/store/machineStore.ts` | exact |
| `hub/src/store/pushSubscriptions.ts` | store module | SQLite upsert/delete | `hub/src/store/pushSubscriptions.ts` | exact |
| `hub/src/store/pushStore.ts` | store wrapper | CRUD | `hub/src/store/pushStore.ts` | exact |
| `hub/src/store/users.ts` | store module | SQLite CRUD | `hub/src/store/users.ts` | exact-delete |
| `hub/src/store/userStore.ts` | store wrapper | CRUD | `hub/src/store/userStore.ts` | exact-delete |
| `hub/src/store/versionedUpdates.ts` | store utility | optimistic SQLite update | `hub/src/store/versionedUpdates.ts` | exact |
| `shared/src/schemas.ts` | shared schema | runtime validation | `shared/src/schemas.ts` | exact |
| `shared/src/socket.ts` | shared socket types | event-driven validation | `shared/src/socket.ts` | exact |
| `cli/src/api/types.ts` | client schema mirror | runtime validation | `cli/src/api/types.ts` | exact |
| `cli/src/api/api.ts` | API client | request-response | `cli/src/api/api.ts` | exact |
| `web/src/types/api.ts` | web API type mirror | runtime DTO typing | `web/src/types/api.ts` | exact |
| `web/src/hooks/useSSE.ts` | web SSE hook | streaming + cache updates | `web/src/hooks/useSSE.ts` | exact |
| `scripts/check-no-cut-agents.sh` | guard script | batch validation | `scripts/check-no-cut-agents.sh` | role-match |

## Pattern Assignments

### `hub/src/utils/accessToken.ts` (utility, request-response auth transform)

**Analog:** `hub/src/utils/accessToken.ts`

**Imports pattern:** none. Keep this helper dependency-free.

**Current split pattern to delete** (lines 1-34):

```typescript
export const DEFAULT_NAMESPACE = 'default'

export type ParsedAccessToken = {
    baseToken: string
    namespace: string
}

export function parseAccessToken(raw: string): ParsedAccessToken | null {
    // ...
    const separatorIndex = trimmed.lastIndexOf(':')
    if (separatorIndex === -1) {
        return { baseToken: trimmed, namespace: DEFAULT_NAMESPACE }
    }
    // ...
}
```

**Target pattern:** keep `parseAccessToken(raw): string | null`, trim outer whitespace, reject empty, return the full opaque token including any `:` characters.

**Tests to rewrite:** `hub/src/utils/accessToken.test.ts` currently asserts namespace parsing (lines 4-26). Replace with opaque behavior: trims, rejects empty, accepts `token:alice` as the full returned token.

---

### `hub/src/config/cliApiToken.ts` (config, file/env I/O)

**Analog:** `hub/src/config/cliApiToken.ts`

**Imports pattern** (lines 8-10):

```typescript
import { randomBytes } from 'node:crypto'
import { getOrCreateSettingsValue } from './generators'
import { getSettingsFile, readSettings, writeSettings } from './settings'
```

**Validation pattern to remove** (lines 43-50):

```typescript
function validateCliApiToken(rawToken: string, source: 'env' | 'file'): string {
    if (rawToken.includes(':')) {
        throw new Error(
            `CLI API token from ${source} must be the base token only; namespace suffixes are not accepted.`
        )
    }
    return rawToken
}
```

**Core pattern to keep** (lines 63-78):

```typescript
const envToken = process.env.CLI_API_TOKEN
if (envToken) {
    const token = validateCliApiToken(envToken, 'env')
    if (isWeakToken(token)) {
        console.warn('[WARN] CLI_API_TOKEN appears to be weak. Consider using a stronger secret.')
    }
    // persist env token when needed
    return { token, source: 'env', isNew: false, filePath: settingsFile }
}
```

**Target pattern:** delete colon rejection, keep weak-token warning and settings persistence. Do not split or normalize internal colon content.

---

### `hub/src/web/routes/auth.ts` (route, request-response)

**Analog:** `hub/src/web/routes/auth.ts`

**Imports pattern** (lines 1-8):

```typescript
import { Hono } from 'hono'
import { SignJWT } from 'jose'
import { z } from 'zod'
import { getConfiguration } from '../../configuration'
import { constantTimeEquals } from '../../utils/crypto'
import { parseAccessToken } from '../../utils/accessToken'
import { getOrCreateOwnerId } from '../../config/ownerId'
import type { WebAppEnv } from '../middleware/auth'
```

**Validation and error pattern** (lines 17-28):

```typescript
const json = await c.req.json().catch(() => null)
const parsed = authBodySchema.safeParse(json)
if (!parsed.success) {
    return c.json({ error: 'Invalid body' }, 400)
}

const configuration = getConfiguration()
const parsedToken = parseAccessToken(parsed.data.accessToken)
if (!parsedToken || !constantTimeEquals(parsedToken.baseToken, configuration.cliApiToken)) {
    return c.json({ error: 'Invalid access token' }, 401)
}
```

**JWT pattern to narrow** (lines 30-37):

```typescript
const userId = await getOrCreateOwnerId()
const namespace = parsedToken.namespace

const token = await new SignJWT({ uid: userId, ns: namespace })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('4h')
    .sign(jwtSecret)
```

**Target pattern:** compare `parseAccessToken()` result directly to `configuration.cliApiToken` with `constantTimeEquals`, then sign only `{ uid: userId }`.

---

### `hub/src/web/middleware/auth.ts` (middleware, request-response)

**Analog:** `hub/src/web/middleware/auth.ts`

**Imports pattern** (lines 1-3):

```typescript
import type { MiddlewareHandler } from 'hono'
import { z } from 'zod'
import { jwtVerify } from 'jose'
```

**Env contract to narrow** (lines 5-15):

```typescript
export type WebAppEnv = {
    Variables: {
        userId: number
        namespace: string
    }
}

const jwtPayloadSchema = z.object({
    uid: z.number(),
    ns: z.string()
})
```

**Bearer/query token pattern** (lines 25-42):

```typescript
const authorization = c.req.header('authorization')
const tokenFromHeader = authorization?.startsWith('Bearer ') ? authorization.slice('Bearer '.length) : undefined
const tokenFromQuery = path === '/api/events' ? c.req.query().token : undefined
const token = tokenFromHeader ?? tokenFromQuery
// ...
c.set('userId', parsed.data.uid)
c.set('namespace', parsed.data.ns)
```

**Target pattern:** keep `/api/auth` bypass, bearer/query lookup, `jwtVerify`, and Zod payload validation. Remove `namespace` from `WebAppEnv`, payload schema, and `c.set()`.

---

### `hub/src/socket/server.ts` and `hub/src/socket/socketTypes.ts` (socket server, event-driven)

**Analog:** `hub/src/socket/server.ts`, `hub/src/socket/socketTypes.ts`

**Imports pattern** (server lines 1-14):

```typescript
import { Server as Engine } from '@socket.io/bun-engine'
import { Server, type DefaultEventsMap } from 'socket.io'
import { jwtVerify } from 'jose'
import { z } from 'zod'
import { constantTimeEquals } from '../utils/crypto'
import { parseAccessToken } from '../utils/accessToken'
```

**Socket data pattern to narrow** (`socketTypes.ts` lines 4-7):

```typescript
export type SocketData = {
    namespace?: string
    userId?: number
}
```

**CLI auth pattern to rewrite** (server lines 102-110):

```typescript
const token = typeof auth?.token === 'string' ? auth.token : null
const parsedToken = token ? parseAccessToken(token) : null
if (!parsedToken || !constantTimeEquals(parsedToken.baseToken, configuration.cliApiToken)) {
    return next(new Error('Invalid token'))
}
socket.data.namespace = parsedToken.namespace
next()
```

**Terminal JWT pattern to narrow** (server lines 126-141):

```typescript
const verified = await jwtVerify(token, deps.jwtSecret, { algorithms: ['HS256'] })
const parsed = jwtPayloadSchema.safeParse(verified.payload)
if (!parsed.success) {
    return next(new Error('Invalid token payload'))
}
socket.data.userId = parsed.data.uid
socket.data.namespace = parsed.data.ns
next()
```

**Target pattern:** `SocketData` keeps `userId` only. CLI auth compares whole token. Terminal JWT schema is `{ uid: z.number() }`.

---

### `hub/src/socket/handlers/cli/*` (socket handlers, event-driven)

**Analogs:** `hub/src/socket/handlers/cli/index.ts`, `sessionHandlers.ts`, `machineHandlers.ts`, `terminalHandlers.ts`, `types.ts`

**Access result pattern to collapse** (`types.ts` lines 1-5):

```typescript
export type AccessErrorReason = 'namespace-missing' | 'access-denied' | 'not-found'

export type AccessResult<T> =
    | { ok: true; value: T }
    | { ok: false; reason: AccessErrorReason }
```

**Aggregator access pattern to rewrite** (`index.ts` lines 51-79):

```typescript
const namespace = typeof socket.data.namespace === 'string' ? socket.data.namespace : null

const resolveSessionAccess = (sessionId: string): AccessResult<StoredSession> => {
    if (!namespace) {
        return { ok: false, reason: 'namespace-missing' }
    }
    const session = store.sessions.getSessionByNamespace(sessionId, namespace)
    // access-denied if id exists in another namespace
}
```

**Event handler validation pattern to keep** (`sessionHandlers.ts` lines 74-97):

```typescript
socket.on('message', (data: unknown) => {
    const parsed = messageSchema.safeParse(data)
    if (!parsed.success) {
        return
    }
    const sessionAccess = resolveSessionAccess(sid)
    if (!sessionAccess.ok) {
        emitAccessError('session', sid, sessionAccess.reason)
        return
    }
})
```

**Versioned callback pattern to keep, minus namespace arg** (`sessionHandlers.ts` lines 179-190):

```typescript
const result = store.sessions.updateSessionMetadata(
    sid,
    metadata,
    expectedVersion,
    sessionAccess.value.namespace
)
if (result.result === 'success') {
    cb({ result: 'success', version: result.version, metadata: result.value })
} else if (result.result === 'version-mismatch') {
    cb({ result: 'version-mismatch', version: result.version, metadata: result.value })
} else {
    cb({ result: 'error' })
}
```

**Machine handler twin pattern** (`machineHandlers.ts` lines 56-77, 110-137):

```typescript
const parsed = machineUpdateMetadataSchema.safeParse(data)
if (!parsed.success) {
    cb({ result: 'error' })
    return
}
const machineAccess = resolveMachineAccess(id)
if (!machineAccess.ok) {
    cb({ result: 'error', reason: machineAccess.reason })
    return
}
```

**Target pattern:** `AccessErrorReason` should drop `namespace-missing`; access resolvers should use `getSession(id)` / `getMachine(id)` only and return `not-found` for absence. Remove access-denied branches unless a separate non-namespace authorization check remains.

---

### `hub/src/socket/handlers/terminal.ts` (socket handler, event-driven)

**Analog:** `hub/src/socket/handlers/terminal.ts`

**Validation schema pattern** (lines 6-21):

```typescript
const terminalCreateSchema = TerminalOpenPayloadSchema

const terminalWriteSchema = z.object({
    terminalId: z.string().min(1),
    data: z.string()
})
```

**Session/CLI resolution pattern to rewrite** (lines 23-34, 48-58, 71-83):

```typescript
export type TerminalHandlersDeps = {
    io: SocketServer
    getSession: (sessionId: string) => { active: boolean; namespace: string } | null
    terminalRegistry: TerminalRegistry
    maxTerminalsPerSocket: number
    maxTerminalsPerSession: number
}

const namespace = typeof socket.data.namespace === 'string' ? socket.data.namespace : null
```

```typescript
const cliSocket = cliNamespace.sockets.get(entry.cliSocketId)
if (!cliSocket || cliSocket.data.namespace !== namespace) {
    terminalRegistry.remove(entry.terminalId)
    // ...
}
```

```typescript
for (const socketId of room) {
    const cliSocket = cliNamespace.sockets.get(socketId)
    if (cliSocket && cliSocket.data.namespace === namespace) {
        return cliSocket.id
    }
}
```

**Active-session guard to keep** (lines 91-96):

```typescript
const session = getSession(sessionId)
if (!namespace || !session || session.namespace !== namespace || !session.active) {
    emitTerminalError(terminalId, 'Session is inactive or unavailable.')
    return
}
```

**Target pattern:** `getSession` returns `{ active: boolean } | null`; terminal create checks `!session || !session.active`. CLI socket lookup uses session room only, not namespace data.

---

### `hub/src/sync/sessionCache.ts`, `machineCache.ts`, `syncEngine.ts` (cache/service, CRUD + event-driven)

**Analogs:** `hub/src/sync/sessionCache.ts`, `hub/src/sync/machineCache.ts`, `hub/src/sync/syncEngine.ts`

**Session access pattern to collapse** (`sessionCache.ts` lines 25-58):

```typescript
getSessions(): Session[] {
    return Array.from(this.sessions.values())
}

getSessionsByNamespace(namespace: string): Session[] {
    return this.getSessions().filter((session) => session.namespace === namespace)
}

resolveSessionAccess(
    sessionId: string,
    namespace: string
): { ok: true; sessionId: string; session: Session } | { ok: false; reason: 'not-found' | 'access-denied' } {
    const session = this.sessions.get(sessionId) ?? this.refreshSession(sessionId)
    if (session) {
        if (session.namespace !== namespace) {
            return { ok: false, reason: 'access-denied' }
        }
        return { ok: true, sessionId, session }
    }
    return { ok: false, reason: 'not-found' }
}
```

**Session object mapping to narrow** (`sessionCache.ts` lines 128-153):

```typescript
const session: Session = {
    id: stored.id,
    namespace: stored.namespace,
    seq: stored.seq,
    // ...
}
this.sessions.set(sessionId, session)
this.publisher.emit({ type: existing ? 'session-updated' : 'session-added', sessionId, data: session })
```

**Machine twin pattern** (`machineCache.ts` lines 51-82, 130-145):

```typescript
getMachines(): Machine[] {
    return Array.from(this.machines.values())
}

getMachinesByNamespace(namespace: string): Machine[] {
    return this.getMachines().filter((machine) => machine.namespace === namespace)
}

getOrCreateMachine(id: string, metadata: unknown, runnerState: unknown, namespace: string): Machine {
    const stored = this.store.machines.getOrCreateMachine(id, metadata, runnerState, namespace)
    return this.refreshMachine(stored.id) ?? (() => { throw new Error('Failed to load machine') })()
}
```

**SyncEngine namespace resolver to delete** (`syncEngine.ts` lines 70-106):

```typescript
this.eventPublisher = new EventPublisher(sseManager, (event) => this.resolveNamespace(event))

private resolveNamespace(event: SyncEvent): string | undefined {
    if (event.namespace) {
        return event.namespace
    }
    if ('sessionId' in event) {
        return this.getSession(event.sessionId)?.namespace
    }
    if ('machineId' in event) {
        return this.machineCache.getMachine(event.machineId)?.namespace
    }
    return undefined
}
```

**Resume/local-handoff access pattern to rewrite** (`syncEngine.ts` lines 443-450, 513-520, 604-611):

```typescript
const access = this.sessionCache.resolveSessionAccess(sessionId, namespace)
if (!access.ok) {
    return {
        type: 'error',
        message: access.reason === 'access-denied' ? 'Session access denied' : 'Session not found',
        code: access.reason === 'access-denied' ? 'access_denied' : 'session_not_found'
    }
}
```

**Target pattern:** cache methods are owner-only: `getSessions()`, `getOnlineMachines()`, `resolveSessionAccess(sessionId)`. Remove `access_denied` codes only if no non-namespace branch remains.

---

### `hub/src/sync/eventPublisher.ts` and `hub/src/sse/sseManager.ts` (pub-sub + streaming)

**Analogs:** `hub/src/sync/eventPublisher.ts`, `hub/src/sse/sseManager.ts`

**Event enrichment pattern to delete** (`eventPublisher.ts` lines 9-33):

```typescript
constructor(
    private readonly sseManager: SSEManager,
    private readonly resolveNamespace: (event: SyncEvent) => string | undefined
) {
}

emit(event: SyncEvent): void {
    const namespace = this.resolveNamespace(event)
    const enrichedEvent = namespace ? { ...event, namespace } : event
    // listeners + SSE receive enrichedEvent
}
```

**SSE subscription shape to narrow** (`sseManager.ts` lines 5-11):

```typescript
export type SSESubscription = {
    id: string
    namespace: string
    all: boolean
    sessionId: string | null
    machineId: string | null
}
```

**Visibility registration pattern to update** (`sseManager.ts` lines 49-62):

```typescript
this.visibilityTracker.registerConnection(
    subscription.id,
    subscription.namespace,
    options.visibility ?? 'hidden'
)
return {
    id: subscription.id,
    namespace: subscription.namespace,
    all: subscription.all,
    sessionId: subscription.sessionId,
    machineId: subscription.machineId
}
```

**Relevance filter to keep, namespace filter to delete** (`sseManager.ts` lines 150-179):

```typescript
private shouldSend(connection: SSEConnection, event: SyncEvent): boolean {
    if (event.type !== 'connection-changed') {
        const eventNamespace = event.namespace
        if (!eventNamespace || eventNamespace !== connection.namespace) {
            return false
        }
    }

    if (event.type === 'message-received') {
        return connection.all || connection.sessionId === event.sessionId
    }
    if (event.type === 'connection-changed') {
        return true
    }
    if (connection.all) {
        return true
    }
    if ('sessionId' in event && connection.sessionId === event.sessionId) {
        return true
    }
    if ('machineId' in event && connection.machineId === event.machineId) {
        return true
    }
    return false
}
```

**Tests to rewrite:** `hub/src/sse/sseManager.test.ts` lines 6-121 currently tests namespace filtering and namespace-specific toast. Replace with all/sessionId/machineId filtering plus visible-connection toast behavior.

---

### `hub/src/visibility/visibilityTracker.ts` and push notification services (event-driven state tracking)

**Analogs:** `hub/src/visibility/visibilityTracker.ts`, `hub/src/push/pushNotificationChannel.ts`, `hub/src/push/pushService.ts`

**Visibility namespace state to collapse** (`visibilityTracker.ts` lines 3-18):

```typescript
export class VisibilityTracker {
    private readonly visibleConnections = new Map<string, Set<string>>()
    private readonly subscriptionToNamespace = new Map<string, string>()

    registerConnection(subscriptionId: string, namespace: string, state: VisibilityState): void {
        this.removeConnection(subscriptionId)
        this.subscriptionToNamespace.set(subscriptionId, namespace)
        if (state === 'visible') {
            this.addVisibleConnection(namespace, subscriptionId)
        }
    }
}
```

**Push/SSE fallback pattern to keep, minus namespace** (`pushNotificationChannel.ts` lines 38-55):

```typescript
const url = payload.data?.url ?? this.buildSessionPath(session.id)
if (this.visibilityTracker.hasVisibleConnection(session.namespace)) {
    const delivered = await this.sseManager.sendToast(session.namespace, {
        type: 'toast',
        data: { title: payload.title, body: payload.body, sessionId: session.id, url }
    })
    if (delivered > 0) {
        return
    }
}

await this.pushService.sendToNamespace(session.namespace, payload)
```

**Push batch cleanup pattern to keep** (`pushService.ts` lines 39-78):

```typescript
async sendToNamespace(namespace: string, payload: PushPayload): Promise<void> {
    const subscriptions = this.store.push.getPushSubscriptionsByNamespace(namespace)
    if (subscriptions.length === 0) {
        return
    }
    const body = JSON.stringify(payload)
    await Promise.all(subscriptions.map((subscription) => {
        return this.sendToSubscription(namespace, subscription, body)
    }))
}
```

**Target pattern:** visibility is global (`hasVisibleConnection()`), toast send no longer needs namespace, push service sends to all subscriptions and removes expired endpoints directly.

---

### `hub/src/web/routes/*.ts` and `hub/src/web/routes/guards.ts` (routes, request-response)

**Analogs:** `sessions.ts`, `machines.ts`, `events.ts`, `push.ts`, `cli.ts`, `guards.ts`

**Route imports pattern** (`sessions.ts` lines 1-8):

```typescript
import { Hono } from 'hono'
import { z } from 'zod'
import type { SyncEngine, Session } from '../../sync/syncEngine'
import type { WebAppEnv } from '../middleware/auth'
import { requireSessionFromParam, requireSyncEngine } from './guards'
```

**Engine guard pattern to keep** (`guards.ts` lines 5-14):

```typescript
export function requireSyncEngine(
    c: Context<WebAppEnv>,
    getSyncEngine: () => SyncEngine | null
): SyncEngine | Response {
    const engine = getSyncEngine()
    if (!engine) {
        return c.json({ error: 'Not connected' }, 503)
    }
    return engine
}
```

**Session guard to collapse** (`guards.ts` lines 16-33):

```typescript
const namespace = c.get('namespace')
const access = engine.resolveSessionAccess(sessionId, namespace)
if (!access.ok) {
    const status = access.reason === 'access-denied' ? 403 : 404
    const error = access.reason === 'access-denied' ? 'Session access denied' : 'Session not found'
    return c.json({ error }, status)
}
if (options?.requireActive && !access.session.active) {
    return c.json({ error: 'Session is inactive' }, 409)
}
```

**Machine guard to collapse** (`guards.ts` lines 49-63):

```typescript
const namespace = c.get('namespace')
const machine = engine.getMachine(machineId)
if (!machine) {
    return c.json({ error: 'Machine not found' }, 404)
}
if (machine.namespace !== namespace) {
    return c.json({ error: 'Machine access denied' }, 403)
}
return machine
```

**List route pattern to rewrite** (`sessions.ts` lines 88-115):

```typescript
const namespace = c.get('namespace')
const sessions = engine.getSessionsByNamespace(namespace)
    .sort((a, b) => {
        if (a.active !== b.active) {
            return a.active ? -1 : 1
        }
        return b.updatedAt - a.updatedAt
    })
    .map(toSessionSummary)

return c.json({ sessions })
```

**SSE route pattern to rewrite** (`events.ts` lines 48-100):

```typescript
const all = parseBoolean(query.all)
const sessionId = parseOptionalId(query.sessionId)
const machineId = parseOptionalId(query.machineId)
const subscriptionId = randomUUID()
const visibility = parseVisibility(query.visibility)
const namespace = c.get('namespace')
// validate session/machine, then:
manager.subscribe({
    id: subscriptionId,
    namespace,
    all,
    sessionId: resolvedSessionId,
    machineId,
    visibility,
    send: (event) => stream.writeSSE({ data: JSON.stringify(event) }),
    sendHeartbeat: async () => { /* heartbeat */ }
})
```

**CLI bearer route pattern to rewrite** (`cli.ts` lines 71-92):

```typescript
const raw = c.req.header('authorization')
// bearer regex validation
const token = parsed.data.replace(/^Bearer\s+/i, '')
const configuration = getConfiguration()
const parsedToken = parseAccessToken(token)
if (!parsedToken || !constantTimeEquals(parsedToken.baseToken, configuration.cliApiToken)) {
    return c.json({ error: 'Invalid token' }, 401)
}

c.set('namespace', parsedToken.namespace)
return await next()
```

**Target pattern:** web routes use no `c.get('namespace')`; CLI route env has no namespace variable. Existing Zod body/query validation and HTTP status conventions stay.

---

### `hub/src/store/*` (SQLite schema, modules, wrappers)

**Analogs:** `index.ts`, `types.ts`, `sessions.ts`, `machines.ts`, `pushSubscriptions.ts`, `users.ts`, wrappers, `versionedUpdates.ts`

**Store composition pattern to narrow** (`index.ts` lines 5-24, 35-45, 81-85):

```typescript
import { MachineStore } from './machineStore'
import { MessageStore } from './messageStore'
import { PushStore } from './pushStore'
import { SessionStore } from './sessionStore'
import { UserStore } from './userStore'
// ...
readonly users: UserStore
// ...
this.users = new UserStore(this.db)
```

**Required tables pattern to update** (`index.ts` lines 26-33):

```typescript
const SCHEMA_VERSION: number = 9
const REQUIRED_TABLES = [
    'sessions',
    'machines',
    'messages',
    'users',
    'push_subscriptions'
] as const
```

**Schema columns/indexes to delete or rewrite** (`index.ts` lines 162-244):

```typescript
CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    tag TEXT,
    namespace TEXT NOT NULL DEFAULT 'default',
    // ...
);
CREATE INDEX IF NOT EXISTS idx_sessions_tag_namespace ON sessions(tag, namespace);

CREATE TABLE IF NOT EXISTS machines (
    id TEXT PRIMARY KEY,
    namespace TEXT NOT NULL DEFAULT 'default',
    // ...
);
CREATE INDEX IF NOT EXISTS idx_machines_namespace ON machines(namespace);

CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    platform TEXT NOT NULL,
    platform_user_id TEXT NOT NULL,
    namespace TEXT NOT NULL DEFAULT 'default',
    // ...
);

CREATE TABLE IF NOT EXISTS push_subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    namespace TEXT NOT NULL,
    endpoint TEXT NOT NULL,
    // ...
    UNIQUE(namespace, endpoint)
);
```

**Session row mapping to narrow** (`sessions.ts` lines 8-53):

```typescript
type DbSessionRow = {
    id: string
    tag: string | null
    namespace: string
    machine_id: string | null
    // ...
}

function toStoredSession(row: DbSessionRow): StoredSession {
    return {
        id: row.id,
        tag: row.tag,
        namespace: row.namespace,
        // ...
    }
}
```

**Session CRUD pattern to rewrite** (`sessions.ts` lines 56-118, 371-400):

```typescript
export function getOrCreateSession(
    db: Database,
    tag: string,
    metadata: unknown,
    agentState: unknown,
    namespace: string,
    // ...
): StoredSession {
    const existing = db.prepare(
        'SELECT * FROM sessions WHERE tag = ? AND namespace = ? ORDER BY created_at DESC LIMIT 1'
    ).get(tag, namespace) as DbSessionRow | undefined
    // insert namespace into sessions
}

export function getSession(db: Database, id: string): StoredSession | null {
    const row = db.prepare('SELECT * FROM sessions WHERE id = ?').get(id) as DbSessionRow | undefined
    return row ? toStoredSession(row) : null
}
```

**Versioned update helper to rewrite** (`versionedUpdates.ts` lines 5-18, 28-48):

```typescript
type VersionedUpdateArgs<T> = {
    db: Database
    table: string
    id: string
    namespace: string
    field: string
    // ...
}

const result = args.db.prepare(
    `UPDATE ${args.table}
     SET ${setClauses.join(', ')}
     WHERE id = @id AND namespace = @namespace AND ${args.versionField} = @expectedVersion`
).run({
    id: args.id,
    namespace: args.namespace,
    expectedVersion: args.expectedVersion,
    // ...
})
```

**Push upsert pattern to rewrite** (`pushSubscriptions.ts` lines 25-49):

```typescript
db.prepare(`
    INSERT INTO push_subscriptions (
        namespace, endpoint, p256dh, auth, created_at
    ) VALUES (
        @namespace, @endpoint, @p256dh, @auth, @created_at
    )
    ON CONFLICT(namespace, endpoint)
    DO UPDATE SET
        p256dh = excluded.p256dh,
        auth = excluded.auth,
        created_at = excluded.created_at
`).run({ namespace, endpoint: subscription.endpoint, /* ... */ })
```

**User store delete target** (`users.ts` lines 5-20, 23-80):

```typescript
type DbUserRow = {
    id: number
    platform: string
    platform_user_id: string
    namespace: string
    created_at: number
}
// getUser, getUsersByPlatformAndNamespace, addUser, removeUser
```

**Target pattern:** new schema omits `users` table and all namespace columns/indexes. Store modules query by id/tag/endpoint only. `push_subscriptions` uses `UNIQUE(endpoint)`. `updateVersionedField` filters by `id` and version only.

---

### `shared/src/schemas.ts` and `shared/src/socket.ts` (shared schemas/types)

**Analogs:** `shared/src/schemas.ts`, `shared/src/socket.ts`

**Session schema source to narrow** (`schemas.ts` lines 183-207):

```typescript
export const SessionSchema = z.object({
    id: z.string(),
    namespace: z.string(),
    seq: z.number(),
    // ...
})

export type Session = z.infer<typeof SessionSchema>
```

**Event schema source to narrow** (`schemas.ts` lines 209-281):

```typescript
const SessionEventBaseSchema = z.object({
    namespace: z.string().optional()
})

const SessionChangedSchema = SessionEventBaseSchema.extend({
    sessionId: z.string()
})

export const SyncEventSchema = z.discriminatedUnion('type', [
    SessionChangedSchema.extend({ type: z.literal('session-added'), data: z.unknown().optional() }),
    // ...
])
```

**Socket reason source to narrow** (`socket.ts` lines 6-7, 164-179):

```typescript
export type SocketErrorReason = 'namespace-missing' | 'access-denied' | 'not-found'
// ...
'update-metadata': (data: { sid: string; expectedVersion: number; metadata: unknown }, cb: (answer: {
    result: 'error'
    reason?: SocketErrorReason
} | /* ... */) => void) => void
```

**Target pattern:** remove `Session.namespace`, remove `SessionEventBaseSchema.namespace`, and drop `namespace-missing`. Let generated TypeScript failures drive hub/cli/web cleanup.

---

### `cli/src/api/types.ts` and `cli/src/api/api.ts` (client schema mirror, request-response)

**Analogs:** `cli/src/api/types.ts`, `cli/src/api/api.ts`

**Shared import pattern** (`types.ts` lines 1-16):

```typescript
import {
    AgentStateSchema,
    AttachmentMetadataSchema,
    CodexCollaborationModeSchema,
    MetadataSchema,
    PermissionModeSchema,
    TodosSchema
} from '@hapi/protocol/schemas'
import { z } from 'zod'
```

**CLI mirror schema to narrow** (`types.ts` lines 105-127):

```typescript
export const CreateSessionResponseSchema = z.object({
    session: z.object({
        id: z.string(),
        namespace: z.string(),
        seq: z.number(),
        // ...
    })
})
```

**Client mapping to narrow** (`api.ts` lines 64-103, 115-152):

```typescript
const parsed = CreateSessionResponseSchema.safeParse(response.data)
if (!parsed.success) {
    throw apiValidationError('Invalid /cli/sessions response', response)
}
const raw = parsed.data.session
return {
    id: raw.id,
    namespace: raw.namespace,
    seq: raw.seq,
    // ...
}
```

**Target pattern:** remove `namespace` from local schema and returned `Session` mapping. Keep response validation and `apiValidationError` behavior.

---

### `web/src/types/api.ts` and `web/src/hooks/useSSE.ts` (web API mirror + streaming hook)

**Analogs:** `web/src/types/api.ts`, `web/src/hooks/useSSE.ts`

**API type mirror pattern:** keep existing exported DTO names and import shape; remove only `namespace` properties from Session-like response types. Do not move canonical contracts into `shared/` in this phase because Phase 7 owns wire-contract unification.

**SSE hook pattern:** keep current EventSource setup, token/query handling, TanStack Query cache updates, and reconnect behavior. Remove namespace reads/writes from event payload assumptions only; do not redesign patch fallback or unknown-key handling because Phase 7 owns the SSE patch contract.

**Target pattern:** `web/src/types/api.ts` mirrors the namespace-free server responses, and `web/src/hooks/useSSE.ts` continues handling all/sessionId/machineId event relevance without any namespace field or `:ns` token assumption.

---

### `scripts/check-no-cut-agents.sh` (guard script, batch validation)

**Analog:** `scripts/check-no-cut-agents.sh`

**Pattern and whitelist shape to extend** (lines 1-20):

```bash
#!/usr/bin/env bash
# scripts/check-no-cut-agents.sh
#
# Phase-1 + Phase-2 ripgrep guard. Fails the build if any business-code
# reference to a forbidden keyword leaks outside the whitelist below.
set -euo pipefail
PATTERN='\b(claude|codex|gemini|opencode|telegram|serverchan|elevenlabs|grammy)\b'
```

**Whitelist style** (lines 21-31):

```bash
WHITELIST=(
  # === Infra (never agent code)
  --glob '!.planning/**'
  --glob '!CHANGELOG.md'
  --glob '!**/.gitignore'
  --glob '!node_modules/**'
  --glob '!dist/**'
  --glob '!bun.lock'
  --glob '!.git/**'
  --glob '!scripts/check-no-cut-agents.sh'
)
```

**Failure message pattern** (lines 116-125):

```bash
if rg -i "${WHITELIST[@]}" "$PATTERN" .; then
  echo ""
  echo "❌ Non-Cursor / external-channel literals found outside whitelist."
  # ...
  exit 1
fi
echo "✅ No non-Cursor agent literals outside whitelist."
```

**Target pattern:** extend the forbidden pattern with `namespace|:ns` for `cli/src`, `hub/src`, `web/src`, `shared/src`, with explicit false-positive whitelist entries only. Keep current rg + whitelist structure.

## Shared Patterns

### Zod Validation

**Source:** route and socket handlers

**Apply to:** Auth route, CLI route, web routes, socket handlers, shared schemas.

```typescript
const parsed = schema.safeParse(data)
if (!parsed.success) {
    return c.json({ error: 'Invalid body' }, 400)
}
```

For socket callbacks:

```typescript
const parsed = updateMetadataSchema.safeParse(data)
if (!parsed.success) {
    cb({ result: 'error' })
    return
}
```

### Constant-Time Token Compare

**Source:** `hub/src/web/routes/auth.ts` lines 24-28 and `hub/src/socket/server.ts` lines 102-110.

**Apply to:** `/api/auth`, `/api/cli/*`, and `/cli` Socket.IO middleware.

```typescript
const parsedToken = parseAccessToken(token)
if (!parsedToken || !constantTimeEquals(parsedToken, configuration.cliApiToken)) {
    return c.json({ error: 'Invalid token' }, 401)
}
```

Use the full parsed string, not `baseToken`.

### Owner JWT

**Source:** `hub/src/web/routes/auth.ts` and `hub/src/web/middleware/auth.ts`.

**Apply to:** Web auth and terminal socket auth.

```typescript
const token = await new SignJWT({ uid: userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('4h')
    .sign(jwtSecret)
```

```typescript
const jwtPayloadSchema = z.object({
    uid: z.number()
})
```

### Single-Owner Access

**Source:** `hub/src/web/routes/guards.ts`, `hub/src/socket/handlers/cli/index.ts`, `hub/src/sync/sessionCache.ts`.

**Apply to:** Session/machine route guards, CLI socket access resolvers, terminal access, resume/handoff.

```typescript
const session = engine.getSession(sessionId)
if (!session) {
    return c.json({ error: 'Session not found' }, 404)
}
if (options?.requireActive && !session.active) {
    return c.json({ error: 'Session is inactive' }, 409)
}
```

### SQLite Store Modules

**Source:** `hub/src/store/sessions.ts`, `hub/src/store/sessionStore.ts`, `hub/src/store/versionedUpdates.ts`.

**Apply to:** Session, machine, push subscription store cleanup.

Keep the module + wrapper split:

```typescript
export function getSession(db: Database, id: string): StoredSession | null {
    const row = db.prepare('SELECT * FROM sessions WHERE id = ?').get(id) as DbSessionRow | undefined
    return row ? toStoredSession(row) : null
}
```

```typescript
export class SessionStore {
    constructor(private readonly db: Database) {}

    getSession(id: string): StoredSession | null {
        return getSession(this.db, id)
    }
}
```

### SSE Relevance Filtering

**Source:** `hub/src/sse/sseManager.ts` lines 158-179.

**Apply to:** SSE manager and event route.

```typescript
if (event.type === 'message-received') {
    return connection.all || connection.sessionId === event.sessionId
}
if (event.type === 'connection-changed') {
    return true
}
if (connection.all) {
    return true
}
if ('sessionId' in event && connection.sessionId === event.sessionId) {
    return true
}
if ('machineId' in event && connection.machineId === event.machineId) {
    return true
}
return false
```

Delete only namespace checks; keep these relevance checks.

### Tests

**Source:** `hub/src/store/namespace.test.ts`, `hub/src/sse/sseManager.test.ts`, `hub/src/socket/handlers/terminal.test.ts`.

**Apply to:** namespace fixture cleanup and replacement tests.

Use small fake stores/sockets and assert behavior directly:

```typescript
const store = new Store(':memory:')
const session = store.sessions.getOrCreateSession('tag', { path: '/alpha' }, null, 'alpha')
expect(store.sessions.getSession(session.id)?.id).toBe(session.id)
```

After cleanup, this should no longer pass namespace arguments.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `hub/scripts/migrate-namespace-isolation.ts` or equivalent offline migration entry | script | SQLite batch migration | No existing offline migration script. Use `Store` schema SQL and runtime migration transaction style from `hub/src/store/index.ts`; keep it out of `Store.initSchema()` runtime path. |

## Metadata

**Analog search scope:** `cli/src`, `hub/src`, `web/src`, `shared/src`, `scripts`  
**Files scanned:** 57 namespace/platform/user/token matches plus selected route/store/socket analogs  
**Project rules:** `.cursor/rules/` not present; no project `.cursor/skills` or `.agents/skills` found  
**Pattern extraction date:** 2026-05-21  

