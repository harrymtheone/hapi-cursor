# Phase 7: Wire contracts unification & SSE patch contract — Pattern Map

**Mapped:** 2026-05-22
**Files analyzed:** 14 (3 new test files + 11 modify/rewrite)
**Analogs found:** 13 / 14 (one no-analog: EventSource mocking — no existing prior art in web/)

## File Classification

| New / Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---------------------|------|-----------|----------------|---------------|
| **NEW** `shared/src/schemas.test.ts` | test (Zod schema unit) | request-response (parse/safeParse) | `shared/src/resume.test.ts` | exact (same role + flow + framework `bun:test`) |
| **NEW** `web/src/hooks/useSSE.test.tsx` | test (hook integration) | event-driven (EventSource → React Query cache) | `web/src/hooks/mutations/useSendMessage.test.tsx` (renderHook + QueryClient harness only); **no analog** for EventSource shim | partial (role-match; transport-mock no analog) |
| **NEW or extend** `hub/src/sync/sessionCache.test.ts` *(preferred)* — or extend `hub/src/sse/sseManager.test.ts` | test (broadcast contract) | event-driven (cache → publisher → Zod parse) | `hub/src/sync/aliveEvents.test.ts` | exact (same role: mock `EventPublisher`, drive `SessionCache` through transitions, assert emit payloads) |
| **MODIFY** `shared/src/schemas.ts` | schema (Zod source of truth) | declarative type/wire | self (`SessionSchema` block, lines 182–202; `SyncEventSchema` discriminatedUnion, 214–274) | exact (same file; in-place extension) |
| **MODIFY** `shared/src/modes.ts` | wire-tag constant | declarative | self (existing line 9 `'codex' as const`) | exact (one-character value flip + JSDoc) |
| **NEW** `shared/src/responses.ts` | TS type aliases (HTTP response wrappers) | declarative | `shared/src/sessionSummary.ts` (pure TS type module, no Zod) | exact (same role: TS-only file co-located with schemas.ts) |
| **MODIFY** `shared/src/sessionSummary.ts` | TS type + transformer | transform | self (lines 1–56) | exact (in-place field delete + transformer line delete) |
| **MODIFY** `cli/src/api/types.ts` | wire schema + re-export | declarative | self (existing re-export block at lines 19–24 and 30) | exact (extend the same re-export idiom) |
| **MODIFY** `web/src/types/api.ts` | TS type + re-export | declarative | self (existing re-export block lines 9–24) | exact (extend same re-export idiom) |
| **MODIFY** `hub/src/sync/machineCache.ts` | cache class + local schema/interface | event-driven | `cli/src/api/types.ts:19-24` re-export pattern (for the `Machine` interface lift); self for emit sites | exact (re-export idiom established cross-package) |
| **REWRITE** `web/src/hooks/useSSE.ts` | React hook (SSE consumer) | event-driven (EventSource → discriminator → mutator) | self (handlers + cache mutators stay; narrows + invalidation queue deleted) | exact (in-place rewrite; preserve mutator skeletons at lines 350–472) |
| **MODIFY (delete writes)** `cli/src/agent/sessionFactory.ts` | metadata constructor | transform | self (current `buildSessionMetadata` body) | exact (field deletion) |
| **MODIFY (delete reads)** `hub/src/sync/syncEngine.ts`, `hub/src/web/routes/{sessions,permissions}.ts`, `hub/src/notifications/sessionInfo.ts`, `web/src/components/{SessionList,SessionHeader,SessionChat}.tsx`, `web/src/router.tsx`, `web/src/hooks/mutations/useSessionActions.ts` | various display/routing | transform | self (per-file `?? 'cursor'` collapses) | exact (per-call-site mechanical edit; RESEARCH §7 enumerates) |
| **AUGMENT** `scripts/check-no-cut-agents.sh` | guard script | batch (ripgrep sweep) | self (Phase-5 / Phase-6 sweep blocks, lines 82–217) | exact (append a Phase-7 block following the established `if rg ... fi` pattern) |

---

## Pattern Assignments

### NEW `shared/src/schemas.test.ts` (test, schema-unit)

**Analog:** `shared/src/resume.test.ts` (chosen over `shared/src/flavors.test.ts` because resume.test.ts directly exercises `safeParse` on schemas defined in `schemas.ts`, which is exactly what the new file does).

**Imports pattern** (resume.test.ts lines 1–4):

```typescript
import { describe, expect, it } from 'bun:test'
import { LocalResumeTargetSchema, ResumableSessionSchema } from './resume'
import { SyncEventSchema } from './schemas'
import { SessionEndReasonSchema } from './socket'
```

**Core schema-parse pattern** (resume.test.ts lines 6–25, 48–56):

```typescript
describe('resume schemas', () => {
    it('accepts a local resume target', () => {
        const parsed = LocalResumeTargetSchema.safeParse({
            sessionId: 'hapi-session-1',
            flavor: 'cursor',
            // ... full literal payload ...
            permissionMode: 'default'
        })
        expect(parsed.success).toBe(true)
    })

    it('accepts handoff in session-ended sync events', () => {
        const parsed = SyncEventSchema.safeParse({
            type: 'session-ended',
            sessionId: 'hapi-session-1',
            reason: 'handoff'
        })
        expect(parsed.success).toBe(true)
    })
})
```

**Strict-reject assertion pattern** (resume.test.ts lines 58–71 — required vs optional):

```typescript
it('requires invokedAt in messages-consumed sync events', () => {
    expect(SyncEventSchema.safeParse({
        type: 'messages-consumed',
        sessionId: 'hapi-session-1',
        localIds: ['local-1']
    }).success).toBe(false)

    expect(SyncEventSchema.safeParse({
        type: 'messages-consumed',
        sessionId: 'hapi-session-1',
        localIds: ['local-1'],
        invokedAt: 123
    }).success).toBe(true)
})
```

**How to apply for Phase 7:** Add three `describe` blocks (`'SessionPatchSchema'`, `'MachinePatchSchema'`, `'SyncEventSchema data union'`). For each patch field listed in D-117 / RESEARCH §1, write a positive `safeParse({ [field]: validValue }).success === true` assertion plus a `safeParse({ unknownField: 1 }).success === false` strict-reject. For `SyncEventSchema`, write per-discriminator parse cases: `session-added` strict-full, `session-updated` full + patch variants, `machine-updated` full / patch / null.

**Auxiliary table-of-cases analog** (`shared/src/flavors.test.ts`): use this style if planner prefers one-test-per-assertion granularity (one `test()` per patch field). Either pattern is acceptable; `resume.test.ts` style with one `it()` per logical group is more compact.

---

### NEW `web/src/hooks/useSSE.test.tsx` (test, hook integration)

**Analog (test harness only):** `web/src/hooks/mutations/useSendMessage.test.tsx`.

**Framework note:** Web uses **Vitest** (`vi.mock`, `vi.fn`, `vi.clearAllMocks`), **not** `bun:test`. Imports come from `vitest` + `@testing-library/react` + `@tanstack/react-query`. Do NOT copy the `bun:test` import idiom from the shared/hub analogs into this file.

**Imports + QueryClient wrapper pattern** (useSendMessage.test.tsx lines 1–31):

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useSSE } from './useSSE'

vi.mock('@/lib/message-window-store', () => ({
    clearMessageWindow: vi.fn(),
    getMessageWindowState: vi.fn(() => ({ messages: [], pending: [] })),
    ingestIncomingMessages: vi.fn(),
    markMessagesConsumed: vi.fn(),
    removeOptimisticMessage: vi.fn(),
    updateMessageStatus: vi.fn()
}))

function createWrapper() {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
    })
    return function Wrapper({ children }: { children: ReactNode }) {
        return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    }
}
```

**renderHook pattern** (useSendMessage.test.tsx lines 46–58):

```typescript
const { result } = renderHook(
    () => useSSE({ enabled: true, token: 't', baseUrl: 'http://x', subscription: { all: true }, onEvent: vi.fn() }),
    { wrapper: createWrapper() }
)

await waitFor(() => { expect(/* assertion */).toBe(true) })
```

**EventSource mock — NO existing analog in web/.** Use the fallback from RESEARCH § Environment Availability:

```typescript
// Top of useSSE.test.tsx
class MockEventSource {
    onmessage: ((event: { data: string }) => void) | null = null
    onopen: (() => void) | null = null
    onerror: ((error: unknown) => void) | null = null
    readyState = 0
    constructor(public url: string) {
        MockEventSource.instances.push(this)
    }
    close() { this.readyState = 2 }
    dispatch(payload: unknown) {
        this.onmessage?.({ data: JSON.stringify(payload) })
    }
    static instances: MockEventSource[] = []
    static reset() { MockEventSource.instances = [] }
}

beforeEach(() => {
    MockEventSource.reset()
    ;(globalThis as { EventSource: typeof EventSource }).EventSource =
        MockEventSource as unknown as typeof EventSource
})
```

**Cache assertion pattern (no existing analog — derived from `useSendMessage.test.tsx::waitFor`):**

Seed `queryClient.setQueryData(queryKeys.sessions, { sessions: [...] })` before dispatching the SSE event; after `MockEventSource.instances[0].dispatch(event)` + `await waitFor(...)`, assert `queryClient.getQueryData(queryKeys.sessions)` reflects the patch (or did NOT change, for the parse-failure / `backgroundTaskCount` no-invalidate cases).

**How to apply for Phase 7:** One `describe('useSSE handleSyncEvent')` with sub-cases per D-127#2:
1. Full `session-added` → cache holds `setQueryData(detail)` + `upsertSessionSummary` upserts the summary.
2. `backgroundTaskCount` single-field patch → `patchSessionSummary` mutates count; `queryClient.invalidateQueries` spy is NOT called.
3. Each other `session-updated` patch field (active / thinking / activeAt / updatedAt / permissionMode / model / modelReasoningEffort / effort).
4. Full `machine-updated` → `upsertMachine`. Inactivate patch `{ active: false }` → `removeMachine`. `data: null` → `removeMachine`.
5. Malformed payload (unknown event type, unknown patch field, missing required field) → `console.error` spy called; cache unchanged; `invalidateQueries` spy NOT called.

---

### NEW (or extend) `hub/src/sync/sessionCache.test.ts` (test, broadcast contract)

**Analog:** `hub/src/sync/aliveEvents.test.ts` (same hub package, mocks `EventPublisher`, drives `SessionCache` through real transitions, captures emits into an array).

**Recommendation:** Create new file `hub/src/sync/sessionCache.test.ts` (no existing) — keeps `sseManager.test.ts` focused on visibility/relevance filtering, which is its current concern. Extending `aliveEvents.test.ts` is the secondary option.

**Imports pattern** (aliveEvents.test.ts lines 1–8):

```typescript
import { describe, expect, it } from 'bun:test'
import type { SyncEvent } from '@hapi/protocol/types'
import { SyncEventSchema } from '@hapi/protocol/schemas'   // NEW — for Phase 7 contract
import { Store } from '../store'
import type { EventPublisher } from './eventPublisher'
import { MachineCache } from './machineCache'
import { SessionCache } from './sessionCache'
```

**Mock-publisher capture pattern** (aliveEvents.test.ts lines 10–16):

```typescript
function createPublisher(events: SyncEvent[]): EventPublisher {
    return {
        emit: (event: SyncEvent) => {
            events.push(event)
        }
    } as unknown as EventPublisher
}
```

**Drive-and-assert pattern** (aliveEvents.test.ts lines 31–73, abbreviated):

```typescript
const store = new Store(':memory:')
const events: SyncEvent[] = []
const cache = new SessionCache(store, createPublisher(events))

const session = cache.getOrCreateSession(
    'session-id',
    { path: '/tmp/project', host: 'localhost' /* flavor key DELETED post-D-122 */ },
    null
)
// drive: handleSessionAlive, markMessageQueued, applyBackgroundTaskDelta,
//        recordSessionActivity, handleSessionEnd, expireInactive,
//        applySessionConfig, mergeSessionData (covers all 13 emit sites
//        enumerated in RESEARCH §1)
cache.applyBackgroundTaskDelta(session.id, 1)
cache.handleSessionEnd(session.id, 'completed')

// Phase 7 contract assertion (NEW):
for (const event of events) {
    const result = SyncEventSchema.safeParse(event)
    if (!result.success) {
        throw new Error(`emit violates SyncEventSchema: ${JSON.stringify(event)} — ${result.error.message}`)
    }
    expect(result.success).toBe(true)
}
```

**How to apply for Phase 7:** Drive `SessionCache` + `MachineCache` through the representative transition matrix per D-127#3 (alive, mode change, background-task delta, session end, machine activate/inactivate, deletion, merge). Assert every captured emit `SyncEventSchema.safeParse(event).success === true`. This catches data-shape drift the type checker cannot (Pitfall #2 in RESEARCH).

---

### MODIFY `shared/src/schemas.ts` (add patch + machine + message schemas; tighten SyncEvent.data; delete `flavor`)

**Analog:** self — existing `SessionSchema` (lines 182–202) and `SyncEventSchema` (lines 214–274).

**Existing `z.object({ ... })` schema pattern** (lines 27–52):

```typescript
export const MetadataSchema = z.object({
    path: z.string(),
    host: z.string(),
    version: z.string().optional(),
    // ... fields ...
    flavor: z.string().nullish(),                    // ← DELETE this line (D-122)
    capabilities: SessionCapabilitiesSchema.optional(),
    worktree: WorktreeMetadataSchema.optional()
})

export type Metadata = z.infer<typeof MetadataSchema>
```

**Existing discriminatedUnion variant pattern** (lines 214–274) — apply for the data-tightening edit:

```typescript
SessionChangedSchema.extend({
    type: z.literal('session-added'),
    data: z.unknown().optional()                     // ← REPLACE with SessionSchema (§5 strict-full)
}),
SessionChangedSchema.extend({
    type: z.literal('session-updated'),
    data: z.unknown().optional()                     // ← REPLACE with z.union([SessionSchema, SessionPatchSchema])
}),
MachineChangedSchema.extend({
    type: z.literal('machine-updated'),
    data: z.unknown().optional()                     // ← REPLACE with z.union([MachineSchema, MachinePatchSchema, z.null()])
}),
```

**New schema additions** (place adjacent to `SessionSchema`, before `SyncEventSchema`):

```typescript
export const MachineMetadataSchema = z.object({
    host: z.string().optional(),
    platform: z.string().optional(),
    happyCliVersion: z.string().optional(),
    displayName: z.string().optional(),
    homeDir: z.string().optional(),
    happyHomeDir: z.string().optional(),
    happyLibDir: z.string().optional(),
    workspaceRoot: z.string().optional(),
    workspaceRoots: z.array(z.string()).optional()
}).transform(({ workspaceRoot, workspaceRoots, ...rest }) => {
    const normalizedWorkspaceRoots = Array.from(new Set(
        Array.isArray(workspaceRoots)
            ? workspaceRoots.filter((p): p is string => typeof p === 'string' && p.trim().length > 0)
            : workspaceRoot
                ? [workspaceRoot]
                : []
    ))
    return {
        ...rest,
        workspaceRoots: normalizedWorkspaceRoots.length > 0 ? normalizedWorkspaceRoots : undefined
    }
})

export const RunnerStateSchema = z.object({
    status: z.union([z.enum(['running', 'shutting-down']), z.string()]),     // D-115: keep loose for Phase 10
    pid: z.number().optional(),
    httpPort: z.number().optional(),
    startedAt: z.number().optional(),
    shutdownRequestedAt: z.number().optional(),
    shutdownSource: z.union([z.enum(['mobile-app', 'cli', 'os-signal', 'unknown']), z.string()]).optional(),
    lastSpawnError: z.object({
        message: z.string(),
        pid: z.number().optional(),
        exitCode: z.number().nullable().optional(),
        signal: z.string().nullable().optional(),
        at: z.number()
    }).nullable().optional()
})

export const MachineSchema = z.object({
    id: z.string(),
    seq: z.number(),
    createdAt: z.number(),
    updatedAt: z.number(),
    active: z.boolean(),
    activeAt: z.number(),
    metadata: MachineMetadataSchema.nullable(),
    metadataVersion: z.number(),
    runnerState: RunnerStateSchema.nullable(),
    runnerStateVersion: z.number()
})

export const SessionPatchSchema = z.object({
    active: z.boolean().optional(),
    activeAt: z.number().optional(),
    thinking: z.boolean().optional(),
    updatedAt: z.number().optional(),
    permissionMode: PermissionModeSchema.optional(),
    model: z.string().nullable().optional(),
    modelReasoningEffort: z.string().nullable().optional(),
    effort: z.string().nullable().optional(),
    backgroundTaskCount: z.number().optional()
}).strict()

export const MachinePatchSchema = z.object({
    active: z.literal(false),
    activeAt: z.number().optional()
}).strict()
```

**Source:** Schema bodies lifted verbatim from `cli/src/api/types.ts:32–73` (MachineMetadataSchema + RunnerStateSchema — preserve `.transform` per Assumption A6 / D-111); Machine TS shape promoted to Zod from `cli/src/api/types.ts:77–88`; patch shapes designed per RESEARCH §1 and Examples 1–2.

**Message wire schemas** (lift verbatim from `cli/src/api/types.ts:152–187` per D-112 / RESEARCH §4):

```typescript
export const MessageMetaSchema = z.object({
    sentFrom: z.string().optional(),
    fallbackModel: z.string().nullable().optional(),
    customSystemPrompt: z.string().nullable().optional(),
    appendSystemPrompt: z.string().nullable().optional(),
    allowedTools: z.array(z.string()).nullable().optional(),
    disallowedTools: z.array(z.string()).nullable().optional()
})

export const UserMessageSchema = z.object({
    role: z.literal('user'),
    content: z.object({
        type: z.literal('text'),
        text: z.string(),
        attachments: z.array(AttachmentMetadataSchema).optional()
    }),
    localKey: z.string().optional(),
    meta: MessageMetaSchema.optional()
})

export const AgentMessageSchema = z.object({
    role: z.literal('agent'),
    content: z.object({
        type: z.literal('output'),
        data: z.unknown()
    }),
    meta: MessageMetaSchema.optional()
})

export const MessageContentSchema = z.union([UserMessageSchema, AgentMessageSchema])
```

---

### NEW `shared/src/responses.ts` (TS-only HTTP response wrappers)

**Analog:** `shared/src/sessionSummary.ts` (existing pure-TS module co-located with `schemas.ts`; no Zod; `import type` only).

**Imports pattern** (sessionSummary.ts line 1):

```typescript
import type { Session, WorktreeMetadata } from './schemas'
```

**Type alias pattern** (sessionSummary.ts lines 3–24):

```typescript
export type SessionSummaryMetadata = {
    // ...
}

export type SessionSummary = {
    // ...
}
```

**How to apply for Phase 7:** Mirror the wrapper definitions verbatim from `web/src/types/api.ts:89–101,118–120`, but `import type { Session, DecryptedMessage } from './schemas'` and `import type { Machine } from './schemas'` (new) and `import type { SessionSummary } from './sessionSummary'`:

```typescript
import type { DecryptedMessage, Machine, Session } from './schemas'
import type { SessionSummary } from './sessionSummary'

export type SessionsResponse = { sessions: SessionSummary[] }
export type SessionResponse = { session: Session }
export type MessagesResponse = {
    messages: DecryptedMessage[]
    page: {
        limit: number
        nextBeforeSeq: number | null
        nextBeforeAt: number | null
        hasMore: boolean
    }
}
export type MachinesResponse = { machines: Machine[] }
export type SpawnResponse =
    | { type: 'success'; sessionId: string }
    | { type: 'error'; message: string }
```

Add `export * from './responses'` (or per-symbol re-exports) to `shared/src/types.ts` and `shared/src/index.ts` following the existing surfacing convention.

---

### MODIFY `shared/src/modes.ts` (rename `'codex'` → `'cursor'`)

**Existing pattern at line 9** (per RESEARCH §8 — only `'codex'` survivor in entire source tree):

```typescript
export const AGENT_MESSAGE_PAYLOAD_TYPE = 'codex' as const   // ← change literal only
```

**Action:** Flip literal; rewrite JSDoc block per D-123:

```typescript
/**
 * wire-tag for cursor agent message envelope
 */
export const AGENT_MESSAGE_PAYLOAD_TYPE = 'cursor' as const
```

All consumers (`hub/src/sync/todos.ts`, `hub/src/sync/sessionModel.test.ts`, cli message-write paths) already import the symbol — zero edits in consumers (RESEARCH §8 + Assumption A7).

---

### MODIFY `shared/src/sessionSummary.ts` (delete `flavor` field + copy line)

**Existing code (lines 3–11, 29–37)** — exact deletion targets:

```typescript
export type SessionSummaryMetadata = {
    name?: string
    path: string
    machineId?: string
    summary?: { text: string }
    flavor?: string | null            // ← DELETE this line (D-122)
    worktree?: WorktreeMetadata
    agentSessionId?: string
}

// ...

const metadata: SessionSummaryMetadata | null = session.metadata ? {
    name: session.metadata.name,
    path: session.metadata.path,
    machineId: session.metadata.machineId ?? undefined,
    summary: session.metadata.summary ? { text: session.metadata.summary.text } : undefined,
    flavor: session.metadata.flavor ?? null,    // ← DELETE this line
    worktree: session.metadata.worktree,
    agentSessionId: session.metadata.cursorSessionId ?? undefined
} : null
```

---

### MODIFY `cli/src/api/types.ts` (collapse to re-exports)

**Analog:** self — existing re-export block at lines 19–24 and 30:

```typescript
export type {
    AgentState,
    AttachmentMetadata,
    Metadata,
    Session
} from '@hapi/protocol/types'
export type SessionPermissionMode = PermissionMode

export { AgentStateSchema, AttachmentMetadataSchema, MetadataSchema }
```

**How to apply for Phase 7:** Extend the existing `export type { ... } from '@hapi/protocol/types'` block to include `Machine`, `MachineMetadata`, `RunnerState`, `MessageMeta`, `UserMessage`, `AgentMessage`, `MessageContent`. Add a Zod re-export line:

```typescript
export {
    AgentStateSchema,
    AttachmentMetadataSchema,
    MachineMetadataSchema,
    MachineSchema,
    MessageContentSchema,
    MessageMetaSchema,
    MetadataSchema,
    RunnerStateSchema,
    UserMessageSchema,
    AgentMessageSchema
} from '@hapi/protocol/schemas'
```

**Delete** lines 32–88 (local `MachineMetadataSchema` / `RunnerStateSchema` / `Machine`) and lines 152–189 (local message schemas).

**`CreateSessionResponseSchema` narrow** (D-113) — replace lines 102–122 inline schema with:

```typescript
export const CreateSessionResponseSchema = z.object({
    session: SessionSchema    // import SessionSchema from '@hapi/protocol/schemas'
})
```

(`GetSessionResponseSchema = CreateSessionResponseSchema` at line 143 stays.)

---

### MODIFY `web/src/types/api.ts` (collapse to re-exports)

**Analog:** self — existing re-export block at lines 9–24:

```typescript
export type {
    AgentState,
    AttachmentMetadata,
    PermissionMode,
    Session,
    SessionSummary,
    SessionSummaryMetadata,
    TeamMember,
    // ...
    WorktreeMetadata
} from '@hapi/protocol/types'
```

**How to apply for Phase 7:**
1. Extend the existing block to include `Machine`, `RunnerState`, `MessagesResponse`, `MachinesResponse`, `SessionResponse`, `SessionsResponse`, `SpawnResponse`.
2. Delete the local `SessionMetadataSummary` type (lines 26–40) — `SessionSummaryMetadata` (re-exported from shared) is the canonical name post-D-122.
3. Delete local `RunnerState` (50–64) and `Machine` (66–77).
4. Delete local `SessionsResponse / SessionResponse / MessagesResponse / MachinesResponse / SpawnResponse` (89–101, 118–120).
5. Keep line 240 `export type SyncEvent = ProtocolSyncEvent` unchanged.

Out-of-scope wrappers (`MachinePathsExistsResponse`, `GitCommandResponse`, etc., per RESEARCH §3) keep their web-local definitions.

---

### MODIFY `hub/src/sync/machineCache.ts` (re-export `Machine`; conform emits)

**Re-export idiom analog:** `cli/src/api/types.ts:19–24`.

**Existing local declarations** (lines 6–38):

```typescript
const machineMetadataSchema = z.object({ /* all-optional shape */ })   // ← DELETE
export interface Machine { /* ... */ }                                 // ← DELETE
```

**Apply:**

```typescript
import type { Machine } from '@hapi/protocol/types'
import { MachineMetadataSchema } from '@hapi/protocol/schemas'

export type { Machine }   // optional re-export so downstream importers don't break
```

Per RESEARCH §2 Open Question 1 + Assumption A2: the lifted `MachineMetadataSchema` must adopt the hub-side **defensive all-optional shape** with `.transform` from cli; this is what the shared schema (above) already does.

**Emit conformance** — for each `publisher.emit({...})` in `machineCache.ts` (lines 72, 127, 154, 165), confirm payload matches one of `MachineSchema | MachinePatchSchema | null`. The strict TS narrow on `SyncEventSchema.data` (Slice 1) will surface any drift at slice-boundary compile time (Pitfall #2).

---

### REWRITE `web/src/hooks/useSSE.ts` (the centerpiece)

**Analog:** self — preserve cache-mutator skeletons at lines 350–472 (`upsertSessionSummary`, `patchSessionSummary`, `patchSessionDetail`, `removeSessionSummary`, `upsertMachine`, `removeMachine`); these are stable React-Query operations.

**Delete pattern** — lines 33 (local `SessionPatch`), 45–135 (7 narrow functions + `hasRecordShape`), 189–194 (invalidation refs + `INVALIDATION_BATCH_MS` import on line 31), 294–348 (`flushInvalidations`, `scheduleInvalidationFlush`, `queueSessionListInvalidation`, `queueSessionDetailInvalidation`, `queueMachinesInvalidation`), 625–636 (cleanup of invalidation timer in the effect teardown).

**Imports pattern (replacement):**

```typescript
import { SyncEventSchema, type SessionPatch } from '@hapi/protocol/schemas'
import type {
    Machine,
    MachinesResponse,
    Session,
    SessionResponse,
    SessionsResponse,
    SessionSummary,
    SyncEvent
} from '@hapi/protocol/types'   // or '@/types/api' once that file re-exports
```

**Core safeParse + dispatch pattern** (replace lines 554–574):

```typescript
const handleMessage = (message: MessageEvent<string>) => {
    if (typeof message.data !== 'string') return
    let parsed: unknown
    try { parsed = JSON.parse(message.data) } catch { return }

    const result = SyncEventSchema.safeParse(parsed)
    if (!result.success) {
        console.error('[useSSE] dropped malformed event', result.error)
        return                                    // D-120: NO refetch fallback
    }
    handleSyncEvent(result.data)
}
```

**Discriminator branch pattern (replace lines 510–549):**

```typescript
if (event.type === 'session-updated') {
    const data = event.data
    if ('metadata' in data) {
        // full Session (only full Session carries `metadata`)
        queryClient.setQueryData<SessionResponse>(
            queryKeys.session(event.sessionId), { session: data }
        )
        upsertSessionSummary(data)
    } else {
        // SessionPatch — strict-shape, known keys only
        patchSessionDetail(event.sessionId, data)
        patchSessionSummary(event.sessionId, data)
    }
}

if (event.type === 'session-added') {
    // §5: always full
    queryClient.setQueryData<SessionResponse>(
        queryKeys.session(event.sessionId), { session: event.data }
    )
    upsertSessionSummary(event.data)
}

if (event.type === 'machine-updated') {
    const data = event.data
    if (data === null) {
        removeMachine(event.machineId)
    } else if ('id' in data) {
        upsertMachine(data)
    } else {
        // MachinePatchSchema — strict { active: false, activeAt? }
        removeMachine(event.machineId)
    }
}
```

**Mutator parameter type swap:** Change `patch: SessionPatch` in the local mutator function signatures (lines 369, 405) so the imported `SessionPatch = z.infer<typeof SessionPatchSchema>` flows through; the `Object.prototype.hasOwnProperty.call` checks at lines 393–394 still work because `SessionPatch` has all-optional keys.

**Cleanup:** After deleting the 3 queue-invalidation function definitions, also delete their references in the effect teardown (lines 625–631) and the destructured `pendingInvalidationsRef` initializer (lines 189–194).

---

### MODIFY (cli flavor writers — D-122 / RESEARCH §7)

**Analog:** self (per file). Each call site is a mechanical key deletion.

**File:line targets** (verbatim from RESEARCH §7 — writers):

| File:line | Action |
|-----------|--------|
| `cli/src/agent/sessionFactory.ts:80,144,193` | Delete `flavor: options.flavor,` lines inside `buildSessionMetadata` returns |
| `cli/src/agent/sessionFactory.ts:20,54,177` | Delete `flavor: string` field from `SessionBootstrapOptions` / `buildSessionMetadata` opts / `bootstrapExistingSession` opts |
| `cli/src/cursor/runCursor.ts:54,59` | Delete `flavor: 'cursor',` keys in two sessionFactory call sites |
| `cli/src/agent/types.ts:74` | Delete `opts?: { flavor?: AgentFlavor }` from `setModel` signature |

**Pattern:** Object-literal key removal (no logic change). Compiler/test suite catches every consumer post-edit.

---

### MODIFY (hub + web flavor readers — D-122 / RESEARCH §7)

**Pattern:** Replace `metadata?.flavor ?? 'cursor'` with literal `'cursor'`; delete display-side flavor reads entirely.

**Hub routing/business-logic readers** (collapse `?? 'cursor'` to literal):

| File:line | Before | After |
|-----------|--------|-------|
| `hub/src/web/routes/permissions.ts:59-61` | `const flavor = session.metadata?.flavor ?? 'cursor'; isPermissionModeAllowedForFlavor(mode, flavor)` | `isPermissionModeAllowedForFlavor(mode, 'cursor')` |
| `hub/src/web/routes/sessions.ts:145-147,293-302,331-332,414` | Same `?? 'cursor'` pattern (4 sites) | Pass `'cursor'` constant; defer helper consolidation to Phase 9 |
| `hub/src/sync/syncEngine.ts:507-521` | Historical-flavor defense block (`historicalFlavor = metadata.flavor; if (historicalFlavor != null && historicalFlavor !== 'cursor') return error`) | **Delete entire block** — unreachable post-D-122 (Pitfall #3) |
| `hub/src/sync/syncEngine.ts:391,426,458,549` | `resolveFlavor()` / `flavor: this.resolveFlavor(session)` | **Keep** — `resume.ts::LocalResumeTarget` carries a `flavor: 'cursor'` literal field (Pitfall §7 plan-checker note) |

**Hub + web display-only readers:**

| File:line | Action |
|-----------|--------|
| `hub/src/notifications/sessionInfo.ts:14-18` (`getAgentName`) | Collapse to `return 'Cursor'` (or delete + inline at caller `hub/src/push/pushNotificationChannel.ts:3`) |
| `web/src/router.tsx:340` | Delete `session?.metadata?.flavor` read |
| `web/src/components/SessionChat.tsx:111` | Delete `agentFlavor` const + downstream usage |
| `web/src/components/SessionList.tsx:418,498-499,564,594` | Delete `FlavorIcon` component, `FLAVOR_BADGES` lookup table, and the `s.metadata?.flavor` reads. Render fixed Cursor icon or no icon. (Pitfall #4) |
| `web/src/components/SessionHeader.tsx:111,160` | Delete flavor reads + the `{session.metadata?.flavor?.trim() \|\| 'unknown'}` text label |
| `web/src/hooks/mutations/useSessionActions.ts:67-68` | Collapse `isKnownFlavor(agentFlavor) && !isPermissionModeAllowedForFlavor(mode, agentFlavor)` to `!isPermissionModeAllowedForFlavor(mode, 'cursor')` |

**Test-fixture strip pattern (RESEARCH §7 — readers/tests):**

Strip `flavor: 'cursor'` keys inside `metadata: { ... flavor: 'cursor' ... }` literals across:
- `hub/src/sync/sessionModel.test.ts` (~30 occurrences)
- `hub/src/web/routes/cli.test.ts` (4 occurrences)
- `hub/src/web/routes/sessions.test.ts` (6 occurrences)
- `hub/src/sync/aliveEvents.test.ts` (7 occurrences)
- `hub/src/push/pushNotificationChannel.test.ts` (1 occurrence)
- `cli/src/agent/sessionFactory.test.ts` (5 occurrences)
- `cli/src/commands/resume.test.ts` (3 occurrences)
- `web/src/components/SessionList.test.ts`, `SessionList.directory-action.test.tsx` (2 occurrences)

**Plan-checker invariant (RESEARCH §7):** DO NOT delete `flavor: 'cursor'` when it appears as a **top-level field** of `ResumableSession` / `LocalResumeTarget` (e.g. `shared/src/resume.test.ts`); only delete from inside `metadata: { ... }` literals.

---

### AUGMENT `scripts/check-no-cut-agents.sh` (Phase 7 guard block)

**Analog:** self — established Phase-3/4/5/6 sweep block pattern (lines 82–217).

**Existing sweep-block pattern** (Phase-6 block, lines 162–217):

```bash
# === Phase-6 ripgrep sweeps + madge guard — D-108
PHASE6_DUPLICATE_HELPER='\bpermissionModeToAgentArgs\b'
PHASE6_SOURCE_DIRS=(cli/src shared/src hub/src web/src)

if "$RG_BIN" -n "$PHASE6_DUPLICATE_HELPER" "${PHASE6_SOURCE_DIRS[@]}"; then
  echo ""
  echo "❌ Phase-6 duplicate helper permissionModeToAgentArgs still present."
  echo "   Use cli/src/agent/modeConfig.permissionModeToCursorArgs instead."
  exit 1
fi
echo "✅ No Phase-6 duplicate permissionModeToAgentArgs in source scope."
```

**Phase 1/5 whitelist removal pattern** (lines 82–96 — the `'codex'` post-filter to DELETE per D-124):

```bash
SURVIVORS=$("$RG_BIN" -n -i "${WHITELIST[@]}" "$PATTERN" . || true)
# DELETE the next line (D-124):
SURVIVORS_FILTERED=$(echo "$SURVIVORS" | grep -v "shared/src/modes.ts:.*AGENT_MESSAGE_PAYLOAD_TYPE = 'codex' as const" || true)
if [ -n "$SURVIVORS_FILTERED" ]; then
  # ... error ...
# REPLACE with direct $SURVIVORS test:
if [ -n "$SURVIVORS" ]; then
  echo "$SURVIVORS"
  echo "❌ Non-Cursor / external-channel literals found outside whitelist."
  exit 1
fi
echo "✅ No non-Cursor agent literals outside whitelist."
```

Also rewrite header comments (lines 4–17) — remove the "Phase-5 single residue" rationale; the residue is gone.

**Apply for Phase 7 — append new D-126 block after the Phase-6 block (~line 217):**

```bash
# === Phase-7 wire-contract sweeps — D-126
PHASE7_SOURCE_DIRS=(cli/src hub/src web/src shared/src)

# (#1) useSSE-internal narrow heuristics — zero hits anywhere
if "$RG_BIN" -n '\bhasUnknownSessionPatchKeys\b' "${PHASE7_SOURCE_DIRS[@]}"; then
  echo "❌ Phase-7 hasUnknownSessionPatchKeys residue (REFA-04: SSE patch contract strictified)."
  exit 1
fi

# (#2) getSessionPatch — zero hits in web/src/hooks/
if "$RG_BIN" -n '\bgetSessionPatch\b' web/src/hooks; then
  echo "❌ Phase-7 getSessionPatch residue in web/src/hooks/ (use SyncEventSchema discriminator)."
  exit 1
fi

# (#3) interface Machine + export type Machine — only allowed in shared/
DUP_MACHINE=$("$RG_BIN" -n '^\s*export\s+(interface|type)\s+Machine\b' \
  cli/src hub/src web/src \
  | grep -v 'hub/src/sync/machineCache\.ts:.*export type { Machine }' \
  || true)
if [ -n "$DUP_MACHINE" ]; then
  echo "$DUP_MACHINE"
  echo "❌ Phase-7 duplicate Machine declaration (REFA-03: shared single source)."
  exit 1
fi

# (#4) RunnerStateSchema / MachineMetadataSchema — only allowed in shared/src/schemas.ts
DUP_SCHEMA=$("$RG_BIN" -n '\b(RunnerStateSchema|MachineMetadataSchema)\b' cli/src web/src \
  | grep -v 'from .@hapi/protocol' \
  || true)
if [ -n "$DUP_SCHEMA" ]; then
  echo "$DUP_SCHEMA"
  echo "❌ Phase-7 duplicate RunnerStateSchema/MachineMetadataSchema declaration."
  exit 1
fi

# (#5) 'codex' literal — zero-tolerance across all four runtime source trees
#     (already covered by PATTERN sweep after D-124 whitelist removal; this is a belt-and-suspenders check)
if "$RG_BIN" -n "['\\\"]codex['\\\"]" "${PHASE7_SOURCE_DIRS[@]}"; then
  echo "❌ Phase-7 'codex' literal residue (D-123 rename to 'cursor' complete)."
  exit 1
fi

# (#6) flavor field writes — zero hits in cli/src + hub/src (source-string scan)
FLAVOR_WRITES=$("$RG_BIN" -n "flavor:\s*['\\\"]|\.flavor\s*=" cli/src hub/src \
  | grep -v -E '(LocalResumeTarget|ResumableSession|resume\.ts)' \
  || true)
if [ -n "$FLAVOR_WRITES" ]; then
  echo "$FLAVOR_WRITES"
  echo "❌ Phase-7 metadata.flavor write residue (D-122 deleted the field)."
  exit 1
fi
echo "✅ Phase-7 wire-contract sweeps clean (D-126)."
```

**Plan-checker note:** the post-filters for the LocalResumeTarget / resume.ts hits in (#6) preserve the legitimate `flavor` field on resume-target shapes (RESEARCH §7 / Pitfall plan-checker note).

---

## Shared Patterns

### Pattern A — Schema co-location + re-export

**Source:** `shared/src/schemas.ts` (single Zod source) + `cli/src/api/types.ts:19–24` (re-export idiom) + `web/src/types/api.ts:9–24` (re-export idiom).

**Apply to:** All package boundaries (cli ⇄ shared, web ⇄ shared, hub ⇄ shared).

```typescript
// shared/src/schemas.ts — define once with Zod
export const FooSchema = z.object({...})
export type Foo = z.infer<typeof FooSchema>

// shared/src/types.ts and shared/src/index.ts — surface
export type { Foo } from './schemas'
export { FooSchema } from './schemas'

// cli/src/api/types.ts — re-export (zero local declaration)
export type { Foo } from '@hapi/protocol/types'
export { FooSchema } from '@hapi/protocol/schemas'
```

### Pattern B — `safeParse` + discriminator branch (replaces hand-rolled `unknown` narrows)

**Source:** RESEARCH Example 4 + existing `SyncEventSchema` discriminatedUnion (schemas.ts:214–274).

**Apply to:** `web/src/hooks/useSSE.ts` (the rewrite). Replace 7 narrow functions with one `safeParse` at the entry and a single-key branching test (`'metadata' in data`, `'id' in data`, `data === null`) inside the resulting typed union.

### Pattern C — Mock-publisher capture for emit-contract tests

**Source:** `hub/src/sync/aliveEvents.test.ts:10–16` (`createPublisher(events)`).

**Apply to:** New `hub/src/sync/sessionCache.test.ts` Phase 7 contract block. Drive the cache through state transitions, then assert `SyncEventSchema.safeParse(emit).success === true` for every captured event.

### Pattern D — `bun:test` for shared/hub/cli vs **Vitest** for web

**Source:** `shared/src/resume.test.ts` + `hub/src/sync/aliveEvents.test.ts` (both use `from 'bun:test'`); `web/src/hooks/mutations/useSendMessage.test.tsx` (uses `from 'vitest'`).

**Apply to:** Pick the framework based on package — never mix. `useSSE.test.tsx` is Vitest (`vi.mock`, `vi.fn`, `@testing-library/react`). `schemas.test.ts` and `sessionCache.test.ts` are bun-test (`describe / it / expect` from `'bun:test'`).

### Pattern E — Source-tree ripgrep sweep with whitelist + post-filter

**Source:** `scripts/check-no-cut-agents.sh` (Phase-1 through Phase-6 sweep blocks).

**Apply to:** Phase 7 D-126 additions. Use the `if "$RG_BIN" -n PATTERN DIRS; then ... exit 1; fi` idiom; add post-filters for legitimate hits (e.g. resume-target `flavor` keep).

### Pattern F — Strict-reject schema (`.strict()`) for forward-defense vs default strip

**Source:** New `SessionPatchSchema` / `MachinePatchSchema` (RESEARCH Example 1–2).

**Apply to:** Patch schemas only. **Do NOT** apply `.strict()` to `MetadataSchema` (Pitfall #1) — keep default strip behaviour to silently drop legacy `flavor` data from SQLite.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| EventSource mock for `web/src/hooks/useSSE.test.tsx` | test fixture (transport mock) | event-driven | No existing EventSource test infrastructure in `web/`. Fallback is hand-rolled `MockEventSource` class per RESEARCH § Environment Availability. |

---

## Metadata

**Analog search scope:**
- `shared/src/**/*.test.ts` (3 files)
- `web/src/**/*.test.{ts,tsx}` (62 files; filtered to hooks/mutations + components)
- `hub/src/sync/**/*.test.ts` (5 files) + `hub/src/sse/**/*.test.ts` (1 file)
- `shared/src/schemas.ts`, `shared/src/sessionSummary.ts`, `shared/src/messages.ts`, `shared/src/modes.ts`, `shared/src/responses.ts` (does not yet exist)
- `cli/src/api/types.ts`
- `web/src/types/api.ts`, `web/src/hooks/useSSE.ts`
- `hub/src/sync/machineCache.ts`
- `scripts/check-no-cut-agents.sh`

**Files scanned:** ~80 across the four packages.

**Pattern extraction date:** 2026-05-22
