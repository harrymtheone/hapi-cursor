# Phase 8: Hub internal decoupling - Research

**Researched:** 2026-05-22
**Domain:** Hub-internal TypeScript refactor (Hono 4.x + Bun + SQLite + Socket.IO + SSE)
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

D-129 through D-144 — see `08-CONTEXT.md` `<decisions>` section verbatim. Highlights binding research output:

- **D-129/D-130:** `SessionCache` (774 lines) → 4 services + a thin facade. Class name + public method signatures **unchanged**; callers do not change imports. Repository holds the **only** `Store` session handle.
- **D-131:** `mergeSessionData` keeps its current `Store`-level transaction; **no** `withTransaction` helper this phase.
- **D-132:** `SyncEngine` (722 lines) → 4 sub-facades by responsibility (session / machine / message / rpc), composition + lifecycle owner remains the `SyncEngine` class.
- **D-133:** `hub/src/sse/sseManager.ts:1` + `sseManager.test.ts:3` switch `SyncEvent` import from `../sync/syncEngine` to `@hapi/protocol/types`. **No** `events.ts` re-introduced in hub.
- **D-134:** Sub-facade exposure — recommend direct delegate (default zero caller change).
- **D-135:** `web/routes/sessions.ts` → 4 sub-files (`lifecycle / config / upload / read`) + `index.ts` returns `createSessionsRoutes(getSyncEngine)` with **unchanged** external signature; each sub-file < 250 lines.
- **D-136:** Helpers are **Hono middleware** form, write injected objects via `c.set(...)`; extend `WebAppEnv['Variables']` with `engine | session | machine | body`.
- **D-137:** `ApiRouteError extends HTTPException` + `code: string` (kebab-case); register `app.onError(...)` returning unified `{ error: { code, message, details? } }`. **No** `Result<T,E>` pattern.
- **D-138/D-139:** New `hub/src/utils/scheduler.ts::KeepaliveScheduler` with `everyMs / afterMs / cancel / shutdown`; mandatory `name`. DI-injected via constructor into `SyncEngine`, `SSEManager`, `TerminalRegistry`, `NotificationHub`. Promise-sleep retries at `syncEngine.ts:645,657` are **exempt**.
- **D-140/D-141:** Single shutdown hook in `hub/src/index.ts` registers SIGINT/SIGTERM and calls `scheduler.shutdown()` + `syncEngine.shutdown()` (existing). SIGINT testing uses vitest fake timers + direct invocation of the registered handler (no real `process.emit`).
- **D-142:** 4 slices: (1) SessionCache 4-split, (2) Scheduler + 4 timers + SyncEngine 4-split + SSE type swap, (3) sessions.ts 4-split + helpers + ApiRouteError, (4) guard sweep.
- **D-143:** Zero-tolerance ripgrep + madge keywords (enumerated below).
- **D-144:** Do not refactor any file ≤500 lines that is already single-responsibility (`messageService.ts`, `rpcGateway.ts`, `machineCache.ts`, `messages.ts`, `machines.ts`, …).

### Claude's Discretion

This phase has 7 Claude-discretion areas (see CONTEXT `### Claude's Discretion`). Of those, two were assigned to the researcher and are resolved below:

- **Helper location decision** → **CHOSEN: `hub/src/web/middleware/route-helpers.ts` single file** (see §"Helper Location Decision").
- **madge command form** → **CHOSEN:** `cd hub && npx --no-install madge --circular --extensions ts,tsx --exclude '(^\.\./|web/dist)' src/` packaged in **independent** `scripts/check-no-circular-hub.sh` (see §"madge Command").

The remaining 5 (sub-facade exposure style; details typing; dev-mode log mode; SIGINT await + 5s timeout; sub-app export shape) are left for the planner to resolve.

### Deferred Ideas (OUT OF SCOPE — do not address)

Verbatim from CONTEXT `<deferred>`:

- REFW-01/02/03 web-internal decoupling → Phase 9.
- REFC-01 SQLite migration deletion, REFC-02 readonly config + DI for `_setApiUrl()` → Phase 10. **Scheduler DI in this phase is pre-alignment, not full DI.**
- REFT-01/02/03 test gap-fill → Phase 11.
- `SessionCache` facade final removal → Phase 12 verification.
- `syncEngine.ts:645,657` promise-sleep retries → keep as-is + whitelist comment only.
- `hub/src/web/middleware/auth.ts` vs new helpers naming convergence → researcher choice (see Helper Location Decision).
- Full DI of `SyncEngine / SSEManager / TerminalRegistry / NotificationHub` (beyond scheduler) → Phase 10.
- `hub/src/notifications/` channel topology → out of v1.
- README / AGENTS / docs prose mentioning "SyncEngine 大类" → Phase 12.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| REFH-01 | `SessionCache` (774 lines) split into `sessionRepository / sessionLivenessService / sessionConfigService / sessionMergeService` | §"SessionCache Method Inventory" — every public method pre-sorted into 4 buckets. |
| REFH-02 | `SyncEngine` (722 lines) split; SSE no longer imports `SyncEngine` concretely, only `SyncEvent` from shared. | §"SyncEngine Method Inventory" + §"SSE → shared `SyncEvent` Swap". Confirmed `SyncEvent` is re-exported from `@hapi/protocol/types` (shared/src/types.ts:17 → schemas.ts:395). |
| REFH-03 | `parseJsonBody / withEngine / withSession / withActiveSession / withMachine` middleware + `ApiRouteError`; `sessions.ts` 4-way split by responsibility. | §"`sessions.ts` Handler Inventory", §"ApiRouteError Snippet", §"WebAppEnv typing change", §"Helper Location Decision". |
| REFH-04 | All `setInterval` in SSE / SyncEngine / terminalRegistry / notificationHub routed through one scheduler; all timers cleared on `process.exit` (SIGINT covered). | §"Recurring Timer Inventory" — 4 recurring + 1 per-session-debounce + 2 promise-sleep exemptions. §"Shutdown Hook State". |
</phase_requirements>

## Summary

CONTEXT.md (D-129…D-144) already locks every architectural boundary, file split, and verification keyword. The research job is therefore evidence collection, not re-design: enumerate every call site the planner needs to cite in `<read_first>` and `<acceptance_criteria>`, confirm a handful of upstream facts (Hono `HTTPException` shape, P7 `SyncEvent` export, `process.on('SIGINT')` pre-existing in `hub/src/index.ts`), surface one factual correction (sessions.ts has **14 handlers**, not 17), and decide the two researcher-assigned discretion items (helper file location, madge command shape).

The single madge cycle today is `sync/syncEngine.ts > sse/sseManager.ts` — caused entirely by `sseManager.ts:1` importing `SyncEvent` from `../sync/syncEngine`. Swapping that import to `@hapi/protocol/types` immediately drops madge to 0 cycles inside `hub/src/`. The 4 recurring `setInterval` / `setTimeout` sites enumerated by D-138 are verified intact at the exact lines named, and `hub/src/index.ts:161–162` already registers SIGINT/SIGTERM handlers, so this phase **extends** the existing shutdown closure rather than registering new listeners.

**Primary recommendation:** execute the 4-slice sequence from D-142 mechanically; almost no design decisions remain. The two non-mechanical risks are (a) `notificationHub.ts` uses a **per-session debounce map** of timeouts (not a single global timer) — the `afterMs(name, ...)` API must let the same `name` cancel-and-replace, or callers need an unambiguous cancel path; and (b) madge cannot be told `--exclude` paths reliably when run from repo root (it still walks `../../web/dist/` siblings), so the guard MUST `cd hub` and pass `--exclude '(^\.\./|web/dist)'` together.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Session in-memory state + persistence facade | Backend (`hub/src/sync/`) | — | All session reads/writes already live here; this phase only redistributes responsibilities. |
| Live-event fan-out to web | Backend SSE (`hub/src/sse/`) | — | Continues to be the SSE owner; reverse-import on `SyncEngine` is the bug being fixed. |
| Timer keepalive + shutdown orchestration | Backend utils (`hub/src/utils/scheduler.ts`, new) | Backend main entry (`hub/src/index.ts`) for DI + signal handlers | Single owner avoids drift; main entry owns OS signal coupling. |
| HTTP request shape validation + injection | Backend Hono middleware (`hub/src/web/middleware/`) | Backend Hono routes (`hub/src/web/routes/sessions/`) | Idiomatic Hono — middleware writes via `c.set(...)`, handlers read via `c.get(...)`. |
| Error → HTTP JSON mapping | Backend Hono error handler (`hub/src/web/server.ts::createWebApp` `app.onError`) | `ApiRouteError extends HTTPException` thrown from middleware + handlers | Hono recommends central `onError` for typed exceptions. |
| Wire event type definitions | Shared (`@hapi/protocol/types` → `shared/src/schemas.ts`) | — | Already established by P7 D-119; this phase only switches hub-side consumer. |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `hono` | `^4.11.2` (installed) | HTTP framework — provides `HTTPException`, `MiddlewareHandler`, `app.onError`, `app.route` composition | Already the project's HTTP framework; `HTTPException` is the documented base for thrown errors `[VERIFIED: node_modules/hono/dist/types/http-exception.d.ts]`. |
| `zod` | `^4.2.1` (installed) | Request body schema parsing inside `parseJsonBody(schema)` | Already used in every existing route file (`sessions.ts:13–37`). |
| `bun:test` (vitest-compatible fake timers via `Bun.test`) | bundled with Bun ≥1.3 | `scheduler.test.ts` SIGINT + cancel assertions | Project uses `bun test` (hub/package.json:12); no additional dep needed. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `madge` | `^8.0.0` (root devDependency) | Circular dependency guard for `hub/src/` | Slice 4 zero-cycle assertion. |
| `ripgrep` (`rg`) | system | Keyword sweeps for D-143 | Already wrapped by `scripts/check-no-cut-agents.sh` (uses `RG_BIN`). |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hono middleware writing to `c.set(...)` | HOF wrapper `withSession(handler)` | HOF wrapper breaks Hono's chainable `.get / .post` ergonomics and can't compose multiple injections; CONTEXT D-136 already rules this out. |
| Single `scheduler.afterMs(name, …)` for `notificationHub` per-session timers | Keep `notificationDebounce: Map<string, NodeJS.Timeout>` and call `scheduler.afterMs(\`notify:${sessionId}\`, …)` returning a handle stored in the map | Both work. Planner should specify which — the map already exists and is per-session; cleanest is `scheduler.afterMs` returning a handle, store handle in map, call `handle.cancel()` to replace. **No** action needed inside scheduler API. |

**Installation:** None. All packages already installed.

**Version verification:**
```bash
$ rg '"hono"' hub/package.json     # "^4.11.2"
$ rg '"madge"' package.json        # "^8.0.0"
$ rg '"zod"' hub/package.json      # "^4.2.1"
```
No new packages added in this phase. The Package Legitimacy Audit below is therefore vacuous.

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| _(none — this phase installs no new packages)_ | — | — | — | — | — | — |

**Packages removed due to slopcheck [SLOP] verdict:** none.
**Packages flagged as suspicious [SUS]:** none.

(slopcheck protocol skipped — no install actions in this phase.)

## Architecture Patterns

### System Architecture Diagram

```
                                ┌────────────────────────────────┐
                                │      hub/src/index.ts          │
                                │  (main: create scheduler,      │
                                │   wire DI, register SIGINT)    │
                                └──────────────┬─────────────────┘
                                               │ scheduler: KeepaliveScheduler
              ┌──────────────────┬─────────────┼────────────────┬─────────────────┐
              ▼                  ▼             ▼                ▼                 ▼
   ┌─────────────────┐  ┌────────────────┐  ┌──────────────┐  ┌─────────────┐  ┌──────────────┐
   │   SyncEngine    │  │  SSEManager    │  │ Terminal     │  │Notification │  │  WebApp      │
   │ (composition +  │  │  (heartbeat)   │  │ Registry     │  │ Hub         │  │ (Hono)       │
   │  lifecycle)     │  │                │  │ (per-entry   │  │ (per-       │  │              │
   │                 │  │                │  │  idleTimer)  │  │  session    │  │ app.onError  │
   │ ┌─────────────┐ │  └────────┬───────┘  └──────────────┘  │  notify     │  │   ↓          │
   │ │SessionCache │ │           │                            │  debounce)  │  │ ApiRouteError│
   │ │ (facade)    │ │           │                            └─────────────┘  │   JSON       │
   │ │             │ │           │ broadcast(event:                            │              │
   │ │ ┌─────────┐ │ │           │  shared SyncEvent)                          │  routes/     │
   │ │ │repo     │ │ │ ◄─────────┘                                             │  sessions/   │
   │ │ │liveness │ │ │                                                         │  {lifecycle, │
   │ │ │config   │ │ │                                                         │   config,    │
   │ │ │merge    │ │ │                                                         │   upload,    │
   │ │ └─────────┘ │ │                                                         │   read}      │
   │ └─────────────┘ │                                                         │              │
   │ session/machine │                                                         │ middleware:  │
   │ /message/rpc    │                                                         │ withEngine,  │
   │ sub-facades     │                                                         │ withSession, │
   └─────────────────┘                                                         │ ...          │
                                                                               └──────────────┘

   import path direction:  sse  ──►  @hapi/protocol/types  (SyncEvent)        (was: sse → syncEngine)
```

### Recommended Project Structure
```
hub/src/
├── index.ts                                 # scheduler singleton + SIGINT hook (existing :161-162)
├── utils/
│   └── scheduler.ts                         # NEW: KeepaliveScheduler
│   └── scheduler.test.ts                    # NEW
├── sync/
│   ├── sessionCache.ts                      # thin facade (delegates to 4 services)
│   ├── sessionRepository.ts                 # NEW: store-handle owner
│   ├── sessionLivenessService.ts            # NEW: alive / mark / expire (uses scheduler)
│   ├── sessionConfigService.ts              # NEW: applyConfig / rename / delete
│   ├── sessionMergeService.ts               # NEW: merge* / dedup* (transaction stays here)
│   ├── syncEngine.ts                        # composition + lifecycle owner
│   ├── syncEngineSession.ts                 # NEW sub-facade
│   ├── syncEngineMachine.ts                 # NEW sub-facade
│   ├── syncEngineMessage.ts                 # NEW sub-facade
│   ├── syncEngineRpc.ts                     # NEW sub-facade
│   └── (eventPublisher, machineCache, messageService, rpcGateway — UNCHANGED)
├── sse/
│   └── sseManager.ts                        # SyncEvent import switched + heartbeat via scheduler
├── socket/
│   └── terminalRegistry.ts                  # idleTimer via scheduler
├── notifications/
│   └── notificationHub.ts                   # per-session debounce via scheduler.afterMs
└── web/
    ├── server.ts                            # add app.onError(apiRouteErrorHandler)
    ├── middleware/
    │   ├── auth.ts                          # UNCHANGED (existing pattern reference)
    │   ├── route-helpers.ts                 # NEW: withEngine, withSession*, withMachine, parseJsonBody
    │   └── apiRouteError.ts                 # NEW: class + onError handler
    └── routes/
        ├── sessions.ts                      # DELETED — replaced by sessions/ dir
        └── sessions/
            ├── index.ts                     # createSessionsRoutes(getSyncEngine)
            ├── lifecycle.ts                 # resume, abort, archive, switch, PATCH /:id, DELETE /:id
            ├── config.ts                    # permission-mode, model
            ├── upload.ts                    # upload, upload/delete
            ├── read.ts                      # GET /sessions, GET /:id, slash-commands, skills
            └── __tests__/                   # tests by sub-file + apiRouteError.test.ts
```

### Pattern 1: Hono middleware injection with extended `Variables`
**What:** Middleware reads input, validates, then writes the typed object to `c.set(key, value)`; handler reads via `c.get(key)` which is typed by `WebAppEnv['Variables']`.
**When to use:** Any cross-cutting precondition (auth, body parse, resource resolution).
**Example:**
```typescript
// Source: hub/src/web/middleware/auth.ts (existing pattern, lines 15-46)
export function createAuthMiddleware(jwtSecret: Uint8Array): MiddlewareHandler<WebAppEnv> {
    return async (c, next) => {
        // ...verify...
        c.set('userId', parsed.data.uid)
        await next()
    }
}
```

### Pattern 2: Hono `app.route('/path', subApp)` composition
**What:** Mount a child `Hono<WebAppEnv>` instance on the parent at a path prefix; child app's chained route declarations remain typed against the same `WebAppEnv`.
**When to use:** Composing the 4 sub-files inside `routes/sessions/index.ts`.
**Example:**
```typescript
// Source: hub/src/web/server.ts:89 (existing usage)
app.route('/api', createSessionsRoutes(options.getSyncEngine))
```
For the inside of `routes/sessions/index.ts`:
```typescript
export function createSessionsRoutes(getSyncEngine: () => SyncEngine | null): Hono<WebAppEnv> {
    const app = new Hono<WebAppEnv>()
    app.route('/', createLifecycleRoutes(getSyncEngine))
    app.route('/', createConfigRoutes(getSyncEngine))
    app.route('/', createUploadRoutes(getSyncEngine))
    app.route('/', createReadRoutes(getSyncEngine))
    return app
}
```

### Pattern 3: `HTTPException` subclass + `app.onError`
**What:** Subclass `HTTPException` to attach domain fields (`code`, `details`); centralize JSON serialization in `app.onError`.
**Source for class signature:** `node_modules/hono/dist/types/http-exception.d.ts` (verbatim verification below).

### Anti-Patterns to Avoid
- **`return c.json({ error: ... }, 400)` from handler bodies** — current pattern; replaced by `throw new ApiRouteError(400, 'invalid-body', issues)` so error JSON shape is centralized.
- **Returning `Response | T` union from helpers** (current `requireSyncEngine` / `requireSessionFromParam` in `routes/guards.ts`) — forces every handler to do `if (x instanceof Response) return x`. Middleware-based injection eliminates this completely.
- **Registering `process.on('SIGINT', …)` from inside each subsystem** — collected via the existing `shutdown` closure in `hub/src/index.ts:152-162`; this phase **extends** that closure, does not register new listeners.
- **Calling `setInterval / setTimeout` directly inside `hub/src/{sse,sync,socket,notifications}/`** after this phase — guard catches re-introductions.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Per-request error → JSON mapping | Custom `try/catch` per handler | `ApiRouteError extends HTTPException` + `app.onError` | Hono provides the exception-to-response pipe; reuse it. |
| Hono request-scoped storage | A `WeakMap<Context, ...>` cache | `c.set(key, value)` typed via `WebAppEnv['Variables']` | Hono ships this; subverting it loses TS narrowing. |
| Composition of sub-routers | Re-declaring routes in `index.ts` | `app.route('/', subApp)` | Native Hono API used elsewhere in the codebase. |
| Mutex / coordination of dedup runs | A new lock library | Keep the existing `deduplicateInProgress` / `deduplicatePending` `Set<string>` pair (lines 14-15, 691-773 of `sessionCache.ts`) — moves into `sessionMergeService.ts` unchanged | The current pattern already coalesces correctly; transplant as-is. |

**Key insight:** This phase is structurally a *file split + DI threading* exercise, not a feature build. Almost every "don't hand-roll" question reduces to "keep the existing implementation, just relocate it."

## Runtime State Inventory

> Phase 8 is a code-structure refactor (split files, add a scheduler, swap one type import, restructure routes). It is **not** a rename / data-migration phase. No string, key, collection name, env var, or persisted artifact carries a name that this phase changes.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | **None** — no DB keys, collection names, user_ids, or persisted strings change. SessionCache → SessionRepository is an internal rename of the *class*; no persisted field is renamed. (Verified: ripgrep `SessionCache` only matches source/test files.) | None |
| Live service config | **None** — no external service (Tailscale, n8n, Cloudflare, Datadog) has any reference to `SessionCache` / `SyncEngine` / `KeepaliveScheduler`. | None |
| OS-registered state | **None** — no Windows Task Scheduler / pm2 / systemd / launchd unit names reference these classes. (Hub is launched directly via `bun run src/index.ts` per `hub/package.json:10`.) | None |
| Secrets / env vars | **None** — no env var name references any class in scope. JWT secret, VAPID keys, `CLI_API_TOKEN`, `HAPI_LISTEN_*` are all untouched. | None |
| Build artifacts | **None** — no compiled binary or registry artifact embeds the class names. The single-exe Bun build (`hub/scripts/generate-embedded-web-assets.ts` + `bun build`) re-bundles source on each run. | None |

**Canonical answer:** Nothing — verified. This is a pure source-tree restructure with no runtime cache invalidation surface.

## Common Pitfalls

### Pitfall 1: madge picks up sibling `web/dist/` even when scoped to `hub/src/`
**What goes wrong:** `npx madge --circular --extensions ts,tsx hub/src/` from repo root **and** `cd hub && npx madge --circular --extensions ts,tsx src/` both walk into `../../web/dist/assets/*.js` (mermaid bundle) and report 64 spurious cycles. Verified empirically: both produce `Found 64 circular dependencies!` dominated by `mermaid.core-*.js > architectureDiagram-*.js`.
**Why it happens:** madge resolves relative imports across directory boundaries — `web/dist` chunks have `import` statements that point sideways. There is no automatic project-root scoping.
**How to avoid:** Use `--exclude '(^\.\./|web/dist)'` from inside `hub/`. The literal command that works is documented in §"madge Command".
**Warning signs:** madge exit code 1 with output containing `../../web/dist/` — those are not real hub cycles.

### Pitfall 2: `notificationHub.ts:131` is per-session, not a single timer
**What goes wrong:** D-138 lists "notify timer" alongside the other 3 recurring timers, but `notificationHub.ts:131` actually creates a per-session debounce timeout stored in `notificationDebounce: Map<string, NodeJS.Timeout>` (line 11). Treating it as one global timer will break the per-session cancel-on-replace logic at lines 126-138 and the multi-timer cleanup loop at lines 34-37.
**Why it happens:** The class debounces permission notifications per session; each `checkForPermissionNotification` call clears the previous timer for that session and starts a new one.
**How to avoid:** Replace the call sites with `scheduler.afterMs(\`notify:${session.id}\`, this.permissionDebounceMs, fn)` returning a handle, store the handle in the map (typed as `ReturnType<KeepaliveScheduler['afterMs']>`), and call `handle.cancel()` to replace. `stop()` (lines 28-40) iterates the map and calls `handle.cancel()`. **Do not** assume one notify timer per process.
**Warning signs:** Tests in `notificationHub.test.ts` that assert "second permission within `permissionDebounceMs` debounces" will fail if the cancel-and-replace path is broken.

### Pitfall 3: SessionCache `mergeSessionData` is `private` — facade signature subtlety
**What goes wrong:** `mergeSessionData` (line 490) is `private`; `mergeSessions` and `mergeSessionHistory` (lines 475, 479) are the public entry points. When splitting into `sessionMergeService.ts`, you must keep `mergeSessionData` as either an internal method or a module-private function in the new service file — exposing it externally would expand the surface area beyond the facade.
**Why it happens:** The two public merge methods delegate to one private implementation with an `options` argument.
**How to avoid:** Inside `sessionMergeService.ts`, keep `mergeSessionData` as a `private` (or non-exported) method/function; expose only `mergeSessions` and `mergeSessionHistory` through the facade.

### Pitfall 4: Per-call `recordSessionActivity` injection into `MessageService`
**What goes wrong:** `MessageService` is constructed with a `(sessionId, updatedAt) => this.recordSessionActivity(...)` callback (`syncEngine.ts:77`). When `recordSessionActivity` moves into a sub-facade, the closure must still resolve to the same method semantically — or the callback signature changes.
**Why it happens:** It is a constructor-time bound callback into the `SyncEngine` instance.
**How to avoid:** Keep `SyncEngine.recordSessionActivity` as a thin pass-through delegate to `syncEngineSession.recordSessionActivity` — caller signature unchanged.

### Pitfall 5: `routes/guards.ts` will become dead code or migrate to middleware
**What goes wrong:** `requireSyncEngine` / `requireSession` / `requireSessionFromParam` / `requireMachine` (4 helpers in `hub/src/web/routes/guards.ts`, 56 lines total) return `Response | T` unions. After the middleware rewrite, no caller inside `routes/sessions/` will use them — but `messages.ts`, `machines.ts`, `permissions.ts` still do (per D-144, those files are not in scope).
**Why it happens:** D-144 says we may opportunistically replace usage in `messages.ts` / `machines.ts` but not required.
**How to avoid:** Leave `routes/guards.ts` in place this phase; the unused-in-`sessions/` helpers stay live because other routes still call them. Plan a follow-on cleanup later if/when full migration happens.

### Pitfall 6: `app.onError(apiRouteErrorHandler)` placement order in `createWebApp`
**What goes wrong:** Hono `app.onError` is registered once on the top-level app; it must be registered **before** routes that may throw `ApiRouteError`. Registering it after `app.route('/api', ...)` calls is fine in current Hono, but registering it inside the sub-router (instead of the top-level) won't intercept errors that bubble past sub-router boundaries.
**How to avoid:** Register `app.onError(...)` inside `createWebApp` in `hub/src/web/server.ts` immediately after `new Hono<WebAppEnv>()` (line 65) and before any `app.route(...)` call.

## Code Examples

### `ApiRouteError` class snippet (Slice 3 acceptance criteria)

```typescript
// Source: derived from node_modules/hono/dist/types/http-exception.d.ts (verified)
import { HTTPException } from 'hono/http-exception'
import type { ContentfulStatusCode } from 'hono/utils/http-status'

export class ApiRouteError extends HTTPException {
    readonly code: string
    readonly details?: unknown

    constructor(
        status: ContentfulStatusCode,
        code: string,
        details?: unknown,
        message?: string
    ) {
        super(status, { message: message ?? code })
        this.code = code
        this.details = details
    }
}

// Source: Hono docs — https://hono.dev/docs/api/exception
// Centralized handler — register in hub/src/web/server.ts::createWebApp
import type { Hono } from 'hono'
import type { WebAppEnv } from './middleware/auth'

export function registerApiErrorHandler(app: Hono<WebAppEnv>): void {
    app.onError((err, c) => {
        if (err instanceof ApiRouteError) {
            return c.json(
                {
                    error: {
                        code: err.code,
                        message: err.message,
                        ...(err.details !== undefined ? { details: err.details } : {})
                    }
                },
                err.status
            )
        }
        if (err instanceof HTTPException) {
            return err.getResponse()
        }
        console.error('[Hub] Unhandled error in route:', err)
        return c.json({ error: { code: 'internal-error', message: 'Internal server error' } }, 500)
    })
}
```

**Verified facts from `node_modules/hono/dist/types/http-exception.d.ts`:**
- `HTTPException extends Error`
- `readonly status: ContentfulStatusCode` (200–599 numeric)
- `constructor(status?: ContentfulStatusCode, options?: { res?, message?, cause? })`
- `getResponse(): Response` for the default formatter
- `code` is **not** a built-in field — adding it on the subclass is safe and idiomatic.

### `WebAppEnv` typing change (D-136)

The existing `WebAppEnv` lives in `hub/src/web/middleware/auth.ts:5-9`:
```typescript
// existing
export type WebAppEnv = {
    Variables: {
        userId: number
    }
}
```

Required change in **same file** (or extracted to `hub/src/web/types.ts` if planner prefers — but auth.ts is already the canonical home and `routes/guards.ts:3` already imports `WebAppEnv` from there):
```typescript
import type { SyncEngine, Session, Machine } from '../../sync/syncEngine'

export type WebAppEnv = {
    Variables: {
        userId: number
        engine: SyncEngine
        session: Session
        machine: Machine
        body: unknown                     // narrowed per-route via generics; see below
    }
}
```

For per-route body narrowing, the planner can either (a) keep `body: unknown` and cast at the call site, or (b) parameterize: `withEngine<Schema>(schema): MiddlewareHandler<WebAppEnv & { Variables: { body: z.infer<Schema> } }>` — Hono's `MiddlewareHandler` generic supports this. Recommend (a) for minimal churn: 14 handlers, one explicit `const body = c.get('body') as z.infer<typeof schema>` line each is acceptable.

### `KeepaliveScheduler` skeleton (D-138)

```typescript
// hub/src/utils/scheduler.ts
export type SchedulerHandle = {
    readonly name: string
    cancel(): void
}

export class KeepaliveScheduler {
    private readonly handles = new Set<SchedulerHandle>()

    everyMs(name: string, ms: number, fn: () => void): SchedulerHandle {
        const timer = setInterval(fn, ms)
        const handle: SchedulerHandle = {
            name,
            cancel: () => {
                clearInterval(timer)
                this.handles.delete(handle)
            }
        }
        this.handles.add(handle)
        return handle
    }

    afterMs(name: string, ms: number, fn: () => void): SchedulerHandle {
        const timer = setTimeout(() => {
            this.handles.delete(handle)
            fn()
        }, ms)
        const handle: SchedulerHandle = {
            name,
            cancel: () => {
                clearTimeout(timer)
                this.handles.delete(handle)
            }
        }
        this.handles.add(handle)
        return handle
    }

    shutdown(): void {
        for (const handle of Array.from(this.handles)) {
            handle.cancel()
        }
    }

    get activeCount(): number {
        return this.handles.size
    }
}
```

## SessionCache Method Inventory

Bucket assignments derived from method-name prefix per CONTEXT `<specifics>`. Every public method is enumerated; private methods follow their callers.

| Method | Line | Kind | Bucket | Notes |
|--------|------|------|--------|-------|
| `constructor(store, publisher)` | 19 | public ctor | **repository** (owns `store` ref) | Service receives store; livenes/config/merge receive `repository` reference. |
| `getSessions()` | 25 | public | repository | |
| `getSession(id)` | 29 | public | repository | |
| `resolveSessionAccess(id)` | 33–43 (overloaded) | public | repository | Overload signature must be preserved verbatim. |
| `getActiveSessions()` | 45 | public | repository | |
| `getOrCreateSession(...)` | 49–63 (overloaded) | public | repository | Overload signature. |
| `refreshSession(id)` | 65 | public | repository | All other services call this. |
| `reloadAll()` | 143 | public | repository | |
| `handleSessionAlive(payload)` | 150 | public | **liveness** | Mutates session state + emits events; no Store-write fan-out beyond setSessionModel/Effort which it reaches via `store` — pass `repository.getStore()` or expose narrow setters. |
| `markMessageQueued(id, time?)` | 247 | public | liveness | |
| `applyBackgroundTaskDelta(id, delta)` | 274 | public | liveness | |
| `recordSessionActivity(id, updatedAt)` | 290 | public | liveness | |
| `handleSessionEnd(payload)` | 323 | public | liveness | |
| `expireInactive(now?)` | 342 | public | liveness | Called by `inactivityTimer` — this is the timer's payload; scheduler wires here. |
| `applySessionConfig(id, cfg)` | 359 | public | **config** | |
| `renameSession(id, name)` | 425 | public | config | |
| `deleteSession(id)` | 452 | public | config | |
| `mergeSessions(old, new)` | 475 | public | **merge** | Delegates to private `mergeSessionData`. |
| `mergeSessionHistory(old, new, opts?)` | 479 | public | merge | Delegates to private `mergeSessionData`. |
| `mergeSessionData(...)` | 490 | **private** | merge (internal) | KEEP PRIVATE in the new file. |
| `mergeSessionMetadata(...)` | 617 | private | merge (internal) | |
| `mergeAgentState(...)` | 661 | private | merge (internal) | |
| `extractAgentSessionId(metadata)` | 684 | private | merge (internal) | |
| `deduplicateByAgentSessionId(id)` | 691 | public | merge | Coalescing `Set<string>` state at lines 14-15 moves with this method. |

**Service composition skeleton inside the new `sessionCache.ts` facade:**

```typescript
export class SessionCache {
    private readonly repository: SessionRepository
    private readonly liveness: SessionLivenessService
    private readonly config: SessionConfigService
    private readonly merge: SessionMergeService

    constructor(store: Store, publisher: EventPublisher) {
        this.repository = new SessionRepository(store, publisher)
        this.liveness = new SessionLivenessService(this.repository, publisher)
        this.config = new SessionConfigService(this.repository, publisher)
        this.merge = new SessionMergeService(this.repository, publisher)
    }
    // every existing public method becomes one delegate line
    getSessions() { return this.repository.getSessions() }
    handleSessionAlive(p) { this.liveness.handleSessionAlive(p) }
    // ...etc, 18 delegate methods, ~1 line each
}
```

Liveness / config / merge **must not** hold a direct `Store` reference; all DB access flows through `repository`. The exception is `applySessionConfig` and the merge flow, which currently call `store.sessions.setSessionModel(...)` etc. directly. Expose narrow setter methods on `SessionRepository` (`setSessionModel`, `setSessionModelReasoningEffort`, `setSessionEffort`, `updateSessionMetadata`, `setSessionTodos`, `setSessionTeamState`, `updateSessionAgentState`, `deleteSession`, `getStore().messages.mergeSessionMessages`) — or, simpler, expose a single `repository.store: Store` getter and keep the existing call patterns. **Planner choice** — both meet D-129's "唯一持有者" requirement if planner documents that the getter is the controlled access point.

## SyncEngine Method Inventory

Pre-sorted into 4 sub-facade buckets per D-132.

| Method | Line | Bucket | Notes |
|--------|------|--------|-------|
| `constructor(...)` | 64 | **lifecycle owner** (SyncEngine itself) | Composes sub-facades + scheduler injection. |
| `stop()` | 84 | lifecycle | Becomes `shutdown()` per D-132; fan-out to sub-facade shutdowns. |
| `subscribe(listener)` | 91 | lifecycle | Delegates to `eventPublisher`. |
| `handleRealtimeEvent(event)` | 145 | **session** | Manipulates sessionCache + machineCache + publisher; primary owner = session sub-facade (it owns session-related dedup paths). |
| `handleSessionAlive(payload)` | 174 | session | |
| `handleSessionEnd(payload)` | 188 | session | |
| `handleBackgroundTaskDelta(id, delta)` | 200 | session | |
| `recordSessionActivity(id, updatedAt)` | 204 | session | Called as injected callback in MessageService ctor (line 77). |
| `expireInactive()` (private) | 212 | session (private) | Called by `inactivityTimer`; sub-facade owns the scheduler handle. |
| `reloadAll()` (private) | 229 | session (private) | |
| `getSessions()` / `getSession()` / `resolveSessionAccess()` / `getActiveSessions()` / `getOrCreateSession()` | 95-247 | session | All pass-through to `sessionCache`. |
| `renameSession` / `deleteSession` / `applySessionConfig` | 317-361 | session | |
| `resolveLocalResumeTarget` / `listLocalResumableSessions` / `resumeSession` / `handoffSessionToLocal` | 399-620 | session | Complex async flow but topically a session-lifecycle concern. |
| `waitForSessionActive` / `waitForSessionInactive` | 638, 650 | session | Contain the `setTimeout(resolve, 250)` promise-sleep exemptions at :645 and :657. Move with the method. |
| `triggerDedupIfNeeded` (private) | 629 | session (private) | |
| `hasSameAgentSessionIds` (private) | 622 | session (private) | |
| `handleMachineAlive(payload)` | 208 | **machine** | |
| `getMachines()` / `getMachine()` / `getOnlineMachines()` / `getOrCreateMachine` | 114-251 | machine | Pass-through to `machineCache`. |
| `getMessagesPage` / `getDeliverableMessagesAfter` | 126, 141 | **message** | Pass-through to `messageService`. |
| `sendMessage` / `cancelQueuedMessage` / `sweepImmediateQueuedOnSessionEnd` | 253, 274, 281 | message | |
| `approvePermission` / `denyPermission` / `abortSession` / `archiveSession` / `switchSession` / `spawnSession` | 285-389 | **rpc** | All pass-through to `rpcGateway`. |
| `checkPathsExist` / `listMachineDirectory` / `getGitStatus` / `getGitDiffNumstat` / `getGitDiffFile` / `readSessionFile` / `readGeneratedImage` / `listDirectory` / `uploadFile` / `deleteUploadFile` / `runRipgrep` / `listSlashCommands` / `listSkills` | 662-720 | rpc | Pass-through. |
| `resolveFlavor` (private) | 391 | session (private) | |
| `resolveAgentResumeId` (private) | 395 | session (private) | |

**Predicted size per sub-facade:**
- `syncEngineSession.ts` ≈ 340 lines (largest — contains `resumeSession`, `resolveLocalResumeTarget`, `listLocalResumableSessions`, `handoffSessionToLocal`, plus all session helpers).
- `syncEngineMessage.ts` ≈ 50 lines.
- `syncEngineMachine.ts` ≈ 50 lines.
- `syncEngineRpc.ts` ≈ 180 lines.
- `syncEngine.ts` (facade) ≈ 200 lines (constructor + composition + ~40 delegate methods).

`syncEngineSession.ts` may push slightly above the 250 budget if all 4 resume-flow methods live there. Planner can either (a) accept ~340 lines (still well under the 400-line SC#1 budget for `hub/src/sync/`), or (b) carve `resume*` and `handoff*` into a thin 5th file (e.g. `syncEngineResume.ts`). **Recommended:** (a) — D-132 says 4 sub-facades; a 5th would inflate scope.

## `sessions.ts` Handler Inventory

> **Factual correction:** CONTEXT.md states "467 lines / 17 handlers". Live file has 467 lines (matches) but **14 handlers** (not 17), verified by `rg 'app\.(get|post|patch|delete|put)\(' hub/src/web/routes/sessions.ts`. The planner's acceptance criteria should reference 14 handlers, not 17. [VERIFIED: ripgrep against hub/src/web/routes/sessions.ts]

| # | Verb | Path | Line | Sub-file | Notes |
|---|------|------|------|----------|-------|
| 1 | GET | `/sessions` | 84 | **read** | Sort + map; no body. |
| 2 | GET | `/sessions/:id` | 112 | read | |
| 3 | POST | `/sessions/:id/resume` | 126 | **lifecycle** | Body parsed via `resumeBodySchema`. |
| 4 | POST | `/sessions/:id/upload` | 164 | **upload** | JSON body (base64 content) — `uploadSchema`. 50MB cap. **Not multipart** despite the verb name. |
| 5 | POST | `/sessions/:id/upload/delete` | 202 | upload | JSON body — `uploadDeleteSchema`. |
| 6 | POST | `/sessions/:id/abort` | 230 | lifecycle | No body. requireActive. |
| 7 | POST | `/sessions/:id/archive` | 245 | lifecycle | No body. requireActive. |
| 8 | POST | `/sessions/:id/switch` | 260 | lifecycle | No body. requireActive. |
| 9 | POST | `/sessions/:id/permission-mode` | 275 | **config** | Body `permissionModeSchema`. |
| 10 | POST | `/sessions/:id/model` | 312 | config | Body `modelSchema`. requireActive. |
| 11 | PATCH | `/sessions/:id` | 341 | lifecycle | Body `renameSessionSchema`. |
| 12 | DELETE | `/sessions/:id` | 371 | lifecycle | Custom 409 for active sessions. |
| 13 | GET | `/sessions/:id/slash-commands` | 399 | read | Async + merge logic. |
| 14 | GET | `/sessions/:id/skills` | 443 | read | Async. |

**Note on `/upload`:** despite CONTEXT's `<specifics>` mentioning "唯一处理 multipart / binary body 的两条路径", the actual implementation uses JSON-encoded base64 (`uploadSchema = { filename, content, mimeType }` at line 29-33, then `estimateBase64Bytes(content)` at line 181). Both upload routes **can** use `parseJsonBody(uploadSchema)` / `parseJsonBody(uploadDeleteSchema)` — there is no multipart handling to special-case. CONTEXT is incorrect on this point. [VERIFIED by reading sessions.ts:164-228]

**Sub-file budget projections (handler bodies only, before helper rewrite):**
- `lifecycle.ts`: handlers 3, 6, 7, 8, 11, 12 = ~150 lines pre-rewrite, < 100 lines post-helper-rewrite.
- `config.ts`: handlers 9, 10 = ~60 lines pre, ~40 post.
- `upload.ts`: handlers 4, 5 = ~70 lines pre, ~50 post.
- `read.ts`: handlers 1, 2, 13, 14 = ~110 lines pre, ~100 post (the `slash-commands` merge logic is heavy and not easily helper-able).
- `index.ts`: ~30 lines (composition).

All comfortably under the 250-line per-file budget from D-135.

## Recurring Timer Inventory

Result of `rg 'setInterval\(|setTimeout\(' hub/src/{sse,sync,socket,notifications}/` cross-referenced against D-138.

| File:Line | Function | Kind | Disposition | Whitelist marker |
|-----------|----------|------|-------------|------------------|
| `hub/src/sync/syncEngine.ts:81` | `inactivityTimer = setInterval(() => this.expireInactive(), 5_000)` | recurring | **Move to `scheduler.everyMs('inactivity', 5_000, ...)`** in `syncEngineSession.ts` | n/a (moved) |
| `hub/src/sse/sseManager.ts:124` | `heartbeatTimer = setInterval(() => ..., this.heartbeatMs)` | recurring | **Move to `scheduler.everyMs('sse-heartbeat', this.heartbeatMs, ...)`**. Note: currently created lazily in `ensureHeartbeat()` and torn down in `stopHeartbeat()` when connections drop to 0 — the scheduler-based version must preserve this lazy create / lazy stop semantic. Recommended: keep the `heartbeatTimer: SchedulerHandle \| null` field and call `handle.cancel()` in `stopHeartbeat()`. | n/a (moved) |
| `hub/src/socket/terminalRegistry.ts:122` | `entry.idleTimer = setTimeout(() => ..., this.idleTimeoutMs)` | one-shot per-entry (rescheduled on `markActivity`) | **Move to `scheduler.afterMs(\`terminal-idle:${entry.terminalId}\`, ..., fn)`**. The `clearTimeout(entry.idleTimer)` at lines 83 + 119 becomes `entry.idleTimer?.cancel()`. The field type changes from `ReturnType<typeof setTimeout> \| null` to `SchedulerHandle \| null`. | n/a (moved) |
| `hub/src/notifications/notificationHub.ts:131` | `const timer = setTimeout(() => ..., this.permissionDebounceMs)` stored in `notificationDebounce: Map<string, NodeJS.Timeout>` | per-session debounce, cancel-and-replace | **Move to `scheduler.afterMs(\`notify:${session.id}\`, ..., fn)`**; change map type to `Map<string, SchedulerHandle>`. The `clearTimeout(existingTimer)` calls at lines 87 and 128 become `existingTimer.cancel()`. The cleanup loop at lines 34-37 (`for (const timer of this.notificationDebounce.values()) clearTimeout(timer)`) becomes `... timer.cancel()`. See Pitfall 2. | n/a (moved) |
| `hub/src/sync/syncEngine.ts:645` | `await new Promise((resolve) => setTimeout(resolve, 250))` inside `waitForSessionActive` retry loop | promise-sleep | **EXEMPT** — keep as-is | `// scheduler-exempt: promise-sleep retry` on the line above (or end-of-line) |
| `hub/src/sync/syncEngine.ts:657` | `await new Promise((resolve) => setTimeout(resolve, 250))` inside `waitForSessionInactive` retry loop | promise-sleep | **EXEMPT** | `// scheduler-exempt: promise-sleep retry` |

**Test-file timer uses (NOT in scope of the guard — tests use `setTimeout` legitimately):**
- `hub/src/sync/sessionModel.test.ts:264, :952` — test sleeps.
- `hub/src/notifications/notificationHub.test.ts:7` — test `sleep` helper.

The ripgrep guard must scope to source files only (e.g. `--glob '!**/*.test.ts'`) or rely on the exemption-comment pattern.

## SessionCache Construction Sites (D-143 #2 — whitelist)

Result of `rg 'new SessionCache\(|class SessionCache' hub/src/`:

| Site | Disposition |
|------|-------------|
| `hub/src/sync/sessionCache.ts:11` (`class SessionCache`) | KEEP — the facade. The phase ends with exactly **1** class declaration. |
| `hub/src/sync/syncEngine.ts:71` (`new SessionCache(store, this.eventPublisher)`) | KEEP — the single production construction site. |
| `hub/src/sync/sessionCache.test.ts:28` (`new SessionCache(new Store(':memory:'), createPublisher(events))`) | KEEP — facade-level smoke test (D-129). |
| `hub/src/sync/sessionModel.test.ts` — 21 sites (lines 23, 40, 56, 72, 95, 116, 139, 160, 181, 204, 227, 278, 323, 760, 791, 813, 829, 879, 966, 1008, +1) | KEEP for now — these tests construct the facade directly. Per CONTEXT, cases will be **redistributed** into per-service test files (`sessionRepository.test.ts`, etc.) which will construct the **services directly** (`new SessionRepository(...)`), not `new SessionCache(...)`. After redistribution, `sessionModel.test.ts` should either be deleted or shrunk to facade-smoke-level. |
| `hub/src/sync/aliveEvents.test.ts` — 6 sites (lines 22, 78, 187, 215, 243, 270) | KEEP — same redistribution treatment; cases move to `sessionLivenessService.test.ts`. |

**Recommended guard pattern for D-143 #2:**
```bash
# Outside test files: exactly 2 occurrences (sessionCache.ts class + syncEngine.ts construction)
rg 'new SessionCache\(|class SessionCache' hub/src/ --glob '!**/*.test.ts' | wc -l   # must == 2
```
Inside test files, accept any count — the guard does not police test construction.

## SSE → shared `SyncEvent` Swap (D-133)

Verification: `SyncEvent` is exported from `@hapi/protocol/types` via the chain:
- `shared/src/types.ts:17` re-exports `SyncEvent` from `./schemas`.
- `shared/src/schemas.ts:395` declares `export type SyncEvent = z.infer<typeof SyncEventSchema>` (the schema is at `:333`).
- `hub/tsconfig.json` workspace resolution points `@hapi/protocol/types` at this file (this is the same path P7 D-119 already established and the same path `hub/src/sync/syncEngine.ts:11` already imports `Session`, `SyncEvent`, etc. from).

**Mechanical change for Slice 2:**

| File:Line | Change |
|-----------|--------|
| `hub/src/sse/sseManager.ts:1` | `import type { SyncEvent } from '../sync/syncEngine'` → `import type { SyncEvent } from '@hapi/protocol/types'` |
| `hub/src/sse/sseManager.test.ts:3` | same change |

After this edit, `madge --circular` inside `hub/src/` (with the `--exclude` flag) drops from `Found 1 circular dependency!` to `No circular dependencies found.`. [VERIFIED empirically: current madge run with `--exclude '(^\.\./|web/dist)'` reports exactly `sync/syncEngine.ts > sse/sseManager.ts`.]

## Shutdown Hook State (D-140)

Verified at `hub/src/index.ts:151-162`:

```typescript
// Handle shutdown
const shutdown = async () => {
    console.log('\nShutting down...')
    notificationHub?.stop()
    syncEngine?.stop()
    sseManager?.stop()
    webServer?.stop()
    process.exit(0)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
```

**Action for this phase:**
1. Insert `scheduler` creation immediately after configuration load (after line 99, before `visibilityTracker = new VisibilityTracker()` at line 103):
   ```typescript
   const scheduler = new KeepaliveScheduler()
   ```
2. Pass `scheduler` to constructors:
   - `new SSEManager(30_000, visibilityTracker, scheduler)` (line 104)
   - `new SyncEngine(store, socketServer.io, socketServer.rpcRegistry, sseManager, scheduler)` (line 125)
   - `new NotificationHub(syncEngine, notificationChannels, scheduler, options?)` (line 131) — note: 3rd param shifts; the existing `options?: NotificationHubOptions` becomes the 4th, or planner adds `scheduler` to the options object. Recommend: positional `scheduler` as required 3rd param, options stays 4th (smallest signature change).
   - `TerminalRegistry` is constructed inside `createSocketServer` (not in `index.ts`); the `createSocketServer` factory needs `scheduler` propagated through its options object.
3. Extend `shutdown` to call `scheduler.shutdown()` **first** (before subsystem stops), then existing stops, then `process.exit(0)`. The current ordering already calls `syncEngine?.stop()` etc., which would no longer touch their own timers (timers are owned by the scheduler now). The shutdown closure becomes:
   ```typescript
   const shutdown = async () => {
       console.log('\nShutting down...')
       scheduler.shutdown()
       notificationHub?.stop()
       syncEngine?.shutdown()     // renamed per D-132
       sseManager?.stop()
       webServer?.stop()
       process.exit(0)
   }
   ```
4. **Do not** add new `process.on(...)` registrations elsewhere. The closure capture covers the new scheduler.

**SIGINT test placement (D-141):** Recommend new file `hub/src/index.test.ts` (or `hub/src/shutdown.test.ts` if planner prefers to keep `index.ts` untested). The test mocks `scheduler.shutdown` / `syncEngine.shutdown`, invokes the `shutdown` handler directly (not via `process.emit('SIGINT')`), and asserts call order + that all mocks fired exactly once.

## Helper Location Decision

**CHOSEN:** Single file `hub/src/web/middleware/route-helpers.ts` (NOT a `routes/_helpers/` subdirectory).

**Justification (1 paragraph):** The existing `hub/src/web/middleware/auth.ts` is the canonical example of a Hono middleware factory in this codebase (`createAuthMiddleware(jwtSecret)` returning a `MiddlewareHandler<WebAppEnv>`). The new helpers — `withEngine`, `withSession`, `withActiveSession`, `withMachine`, `parseJsonBody` — share the same shape: factory functions returning `MiddlewareHandler<WebAppEnv>` that write to `c.set(...)`. Co-locating them under `middleware/route-helpers.ts` (a) keeps all middleware in one directory the way Hono conventions encourage, (b) lets `WebAppEnv['Variables']` stay in `middleware/auth.ts` (the only existing module that exports the type), avoiding a tug-of-war over where the type lives, and (c) avoids a leading-underscore `_helpers/` subdirectory which is a TypeScript anti-pattern (clashes with module resolution heuristics and looks like a private/internal Python convention). A second file `hub/src/web/middleware/apiRouteError.ts` houses `ApiRouteError` + the `app.onError` handler factory — keeping that separate from the per-request middleware preserves the "one Hono concept per file" pattern. Total new files in `hub/src/web/middleware/`: 2 (`route-helpers.ts`, `apiRouteError.ts`); existing `auth.ts` only gains `Variables` field additions.

## madge Command

**Empirical findings (just-run verification):**

| Command | Result |
|---------|--------|
| `npx madge --circular --extensions ts,tsx hub/src/` (from repo root) | `Found 64 circular dependencies!` — all from `../../web/dist/assets/mermaid.core-*` |
| `cd hub && npx madge --circular --extensions ts,tsx src/` | Same 64 spurious cycles (still walks up to `../../web/dist/`) |
| `cd hub && npx madge --circular --extensions ts,tsx --exclude '(^\.\./|web/dist)' src/` | **`Found 1 circular dependency! 1) sync/syncEngine.ts > sse/sseManager.ts`** — exactly the one cycle this phase eliminates. |

**Canonical command to bake into `scripts/check-no-circular-hub.sh`:**

```bash
#!/usr/bin/env bash
# scripts/check-no-circular-hub.sh
# Phase-8 madge guard — asserts hub/src/ has zero internal circular deps.
# The --exclude pattern filters out (a) any ../web/dist sibling sourcemap-derived
# walks and (b) any accidental import that resolved up out of hub/src/. Running
# from hub/ keeps madge's resolver scoped to the hub workspace.
set -euo pipefail

cd "$(dirname "$0")/.."
cd hub

output=$(npx --no-install madge --circular --extensions ts,tsx --exclude '(^\.\./|web/dist)' src/ 2>&1) || exit_code=$?
exit_code=${exit_code:-0}

if [ "$exit_code" -ne 0 ] || echo "$output" | grep -q '^[0-9]\+)'; then
    echo "❌ Phase-8 madge: circular dependency in hub/src/:" >&2
    echo "$output" >&2
    echo "Run: cd hub && npx madge --circular --extensions ts,tsx --exclude '(^\\.\\./|web/dist)' src/" >&2
    exit 1
fi

echo "✅ No circular dependencies in hub/src/ (madge)."
```

**Recommendation (researcher pick for D-142 Slice 4 ambiguity):** **independent script** `scripts/check-no-circular-hub.sh` invoked from `scripts/check-no-cut-agents.sh` at the end. Reasoning: keeps the madge output (which is multi-line and noisy on failure) out of the main ripgrep-grep script's `set -euo pipefail` flow; matches the Phase-6 precedent (`scripts/check-no-cut-agents.sh:195-203` runs madge inline but only on `cli/src/cursor` with no `web/dist` problem).

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `return c.json({ error }, status)` from each handler | `throw new ApiRouteError(status, code, details?)` + central `onError` | This phase | -150 LOC of repeated `if (X instanceof Response) return X` boilerplate; uniform error JSON for the entire `/api` surface. |
| `requireSyncEngine / requireSessionFromParam` returning `T \| Response` | `withEngine / withSession` Hono middleware that `c.set(...)` and throw on failure | This phase | Removes the `instanceof Response` ceremony, restores TS narrowing on the handler body. |
| Per-subsystem `setInterval` / `setTimeout` calls | `scheduler.everyMs(name, ...) / scheduler.afterMs(name, ...)` returning cancellable handles | This phase | Single shutdown surface; auditable list of active timers; SIGINT-clean. |
| `hub/src/sse/sseManager.ts` importing `SyncEvent` from `../sync/syncEngine` | Import from `@hapi/protocol/types` | This phase | Breaks last reverse-dependency; madge cycle count 1 → 0. |

**Deprecated/outdated within this phase's scope:**
- `routes/guards.ts:5–56` (`requireSyncEngine` / `requireSessionFromParam` / `requireMachine`) — **still used by `messages.ts`, `machines.ts`, `permissions.ts`** per D-144; do not delete. Will be retired in a future phase when those routes also migrate.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| _(none)_ | | | All factual claims in this research were verified against live source files (`ripgrep`, `wc -l`, `Read`), the Hono installed type declarations (`node_modules/hono/dist/types/http-exception.d.ts`), an actual `npx madge` run, and the shared `SyncEvent` export chain. The 1 fact that contradicts CONTEXT (14 handlers vs claimed 17) is **VERIFIED** against the live file, not assumed. | — |

## Open Questions

1. **CONTEXT.md says `sessions.ts` has "17 handlers"; verified live count is 14.**
   - What we know: live file has exactly 14 `app.<verb>(` declarations (verified by ripgrep).
   - What's unclear: whether CONTEXT was authored against an older revision with 3 more handlers that have since been removed, or whether the count is simply incorrect.
   - Recommendation: planner should use **14** in all `<acceptance_criteria>` and `<read_first>` blocks. No need to track down the discrepancy — the file is the ground truth.

2. **`notificationHub.ts` is per-session — should the scheduler `name` be `"notify:${sessionId}"` or something coarser?**
   - What we know: 1 timer per active session-with-pending-permission; cancel-and-replace per debounce window.
   - What's unclear: whether per-session names will cause log spam in dev mode (D-138 dev-mode console.debug discretion).
   - Recommendation: per-session name (planner picks). Dev-mode log can suppress `notify:*` names with a prefix filter if it gets noisy.

3. **`scheduler.afterMs` handle storage in `notificationHub.notificationDebounce` map — change map type or use a wrapper?**
   - What we know: the existing map type is `Map<string, NodeJS.Timeout>`; new handles are typed `SchedulerHandle`.
   - What's unclear: trivial — change to `Map<string, SchedulerHandle>`.
   - Recommendation: change the map type. The wrapper would add a layer for no benefit.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Bun | `bun test`, `bun typecheck`, `bun build` | ✓ (assumed — used by all prior phases) | ≥1.3 | — |
| `npx madge` | Slice 4 guard | ✓ | 8.0.0 (root devDep) | — |
| `rg` (ripgrep) | Slice 4 guard | ✓ (system or VS Code bundled — see `scripts/check-no-cut-agents.sh:23-30`) | — | — |
| Hono `HTTPException` import path `hono/http-exception` | Slice 3 `ApiRouteError` | ✓ | bundled with `hono@^4.11.2` | — |
| Hono `ContentfulStatusCode` import path `hono/utils/http-status` | Slice 3 `ApiRouteError` typing | ✓ | bundled | — |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** none.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | `bun test` (Bun built-in test runner) |
| Config file | none (Bun discovers `*.test.ts`); `hub/package.json:12` declares `"test": "bun test"` |
| Quick run command | `bun --filter @hapi/hub test` (or `cd hub && bun test`) |
| Full suite command | `bun run test` (root — runs all workspaces) + `bun typecheck` |
| Mocking | `bun:test` `mock()` / `mock.module()`; for fake timers use `setSystemTime` or Bun's `vi.useFakeTimers()` compat layer. |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| REFH-01 | SessionCache facade public methods unchanged; per-service logic intact | unit | `cd hub && bun test src/sync/sessionRepository.test.ts src/sync/sessionLivenessService.test.ts src/sync/sessionConfigService.test.ts src/sync/sessionMergeService.test.ts src/sync/sessionCache.test.ts` | ❌ all 4 new files Wave 0 (`sessionCache.test.ts` + `sessionModel.test.ts` + `aliveEvents.test.ts` exist as cases to redistribute) |
| REFH-02 | SyncEngine sub-facades; SSE consumes shared `SyncEvent`; no `import .* from .*sync/syncEngine` in `hub/src/sse/` | unit + ripgrep | `cd hub && bun test src/sync/syncEngine.test.ts` (if exists) + `rg "from .*sync/syncEngine" hub/src/sse/` returns 0 | ❌ guard sweep Wave 0; existing tests in `messageService.test.ts`, `rpcGateway.test.ts`, `aliveEvents.test.ts` already cover sub-facade behaviors indirectly |
| REFH-03 | `ApiRouteError` shape contract: `{ error: { code, message, details? } }`; `parseJsonBody` returns 400 + `code='invalid-body'`; `withSession` returns 404 + `code='not-found'`; `withEngine` returns 503 + `code='engine-unavailable'` | unit | `cd hub && bun test src/web/middleware/apiRouteError.test.ts src/web/routes/sessions/__tests__/` | ❌ all new files Wave 0 |
| REFH-04 | `KeepaliveScheduler.shutdown()` cancels all handles; cancelled handle's callback never fires; SIGINT handler invokes both `scheduler.shutdown()` and `syncEngine.shutdown()` | unit | `cd hub && bun test src/utils/scheduler.test.ts src/index.test.ts` (or `src/shutdown.test.ts`) | ❌ both files Wave 0 |
| SC#1 (file budgets) | `wc -l hub/src/sync/*.ts` per-file < 400; `hub/src/web/routes/sessions/*.ts` per-file < 250 | shell guard | `bash scripts/check-no-circular-hub.sh && bash scripts/check-no-cut-agents.sh` (Phase-8 block adds `wc -l` assertions) | ❌ guard additions Wave 0 |
| SC#2 (SSE no reverse import) | `rg "import .* from .*['\"]\\.\\./sync/syncEngine['\"]" hub/src/sse/` → 0 hits | ripgrep guard | `bash scripts/check-no-cut-agents.sh` | ❌ guard line Wave 0 |
| SC#3 (routes split + helpers + ApiRouteError) | sessions/ dir exists with 5 files; `rg "throw new HTTPException" hub/src/web/routes/` only inside whitelisted helper files | structural + ripgrep | guard script | ❌ guard line Wave 0 |
| SC#4 (timer routing + SIGINT) | `rg "setInterval\(\|setTimeout\(" hub/src/{sse,sync,socket,notifications}/` outside whitelisted promise-sleep + scheduler.ts → 0 | ripgrep guard | guard script | ❌ guard line Wave 0 |
| SC#5 (madge + bun green) | madge 0 cycles in `hub/src/`; `bun typecheck` 0 errors; `bun run test` green | madge + bun | `bash scripts/check-no-circular-hub.sh && bun typecheck && bun run test` | scheduler.test.ts must exist before phase gate can be assessed (Wave 0) |

### Sampling Rate
- **Per task commit:** `cd hub && bun test <directly affected files>` (~5-20 files; sub-second).
- **Per wave merge:** `cd hub && bun test` (full hub suite; usually < 30s on this codebase).
- **Phase gate:** `bun typecheck && bun run test && bash scripts/check-no-cut-agents.sh && bash scripts/check-no-circular-hub.sh`.

### Wave 0 Gaps
- [ ] `hub/src/utils/scheduler.test.ts` — covers REFH-04 (shutdown, cancel, name uniqueness, callback never fires after cancel).
- [ ] `hub/src/index.test.ts` **or** `hub/src/shutdown.test.ts` — SIGINT handler unit test (REFH-04 SC#4).
- [ ] `hub/src/sync/sessionRepository.test.ts` — Wave 1 (redistributed cases from `sessionModel.test.ts`).
- [ ] `hub/src/sync/sessionLivenessService.test.ts` — Wave 1 (redistributed from `aliveEvents.test.ts` + `sessionModel.test.ts`).
- [ ] `hub/src/sync/sessionConfigService.test.ts` — Wave 1.
- [ ] `hub/src/sync/sessionMergeService.test.ts` — Wave 1 (merge / dedup cases).
- [ ] `hub/src/web/middleware/apiRouteError.test.ts` — Wave 1 (JSON shape contract).
- [ ] `hub/src/web/routes/sessions/__tests__/lifecycle.test.ts` / `config.test.ts` / `upload.test.ts` / `read.test.ts` — Wave 1 (redistributed from `sessions.test.ts`).
- [ ] `scripts/check-no-circular-hub.sh` — Wave 1 (Slice 4 inception).
- [ ] Phase-8 block appended to `scripts/check-no-cut-agents.sh` — Wave 1 (Slice 4).

Framework install: none — Bun test is already configured.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Unchanged — `createAuthMiddleware` in `hub/src/web/middleware/auth.ts` is not modified in scope. |
| V3 Session Management | no | No web session lifecycle change; "sessions" here are CLI/agent sessions, not user sessions. |
| V4 Access Control | no | No authorization rule change; this is a refactor, not a permission boundary change. |
| V5 Input Validation | **yes** | `parseJsonBody(schema)` is the new uniform Zod-validation gate; rejects malformed input with `ApiRouteError(400, 'invalid-body', issues)`. Schemas (`uploadSchema` etc.) are re-used as-is from current `sessions.ts:9-37`. |
| V6 Cryptography | no | No crypto change. |
| V8 Data Protection | partial | `uploadSchema` keeps the 50 MB cap (`MAX_UPLOAD_BYTES = 50 * 1024 * 1024`, line 39); the helper rewrite must preserve this check (still done in the handler body after `parseJsonBody`, since it is a business rule beyond schema validation). |
| V12 Files & Resources | partial | Same — upload size cap preservation. |

### Known Threat Patterns for hub/Hono/Bun stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Body parsing DoS (huge JSON) | DoS | Bun.serve `maxRequestBodySize` already set at `hub/src/web/server.ts:204` (max of socket limit and 68 MiB); Zod schema validation rejects oversized fields. Preserved. |
| Path traversal via session ID param | Tampering | `withSession(idParam)` resolves through `engine.resolveSessionAccess(id)` which only returns sessions known to the cache — no filesystem touch. Preserved from existing `requireSessionFromParam`. |
| Error message leakage via `cause` | Info disclosure | `ApiRouteError`'s `message` field defaults to `code` (kebab-case identifier); the underlying `Error.cause` is not serialized to JSON. Centralized `onError` controls what fields are exposed. |
| Unhandled promise rejection in handler → 500 with stack | Info disclosure | `onError` catches all throws and returns `{ error: { code: 'internal-error', message: 'Internal server error' } }` — stack stays in `console.error` only. |

**No new attack surface.** The refactor preserves all existing input validation, size caps, and access checks while standardizing their error responses.

## Sources

### Primary (HIGH confidence)
- `node_modules/hono/dist/types/http-exception.d.ts` — full `HTTPException` declaration verified.
- `node_modules/hono/dist/types/utils/http-status.d.ts` — `ContentfulStatusCode` type origin.
- Hono official docs — Exception API: https://hono.dev/docs/api/exception (URL referenced in HTTPException JSDoc).
- Hono official docs — `app.route(path, subApp)` composition is the documented pattern for sub-router mounting.
- Live `npx madge --circular --extensions ts,tsx --exclude '(^\.\./|web/dist)' src/` run from `hub/` — produced exact 1-cycle output cited above.
- `hub/src/index.ts`, `hub/src/sync/sessionCache.ts`, `hub/src/sync/syncEngine.ts`, `hub/src/sse/sseManager.ts`, `hub/src/socket/terminalRegistry.ts`, `hub/src/notifications/notificationHub.ts`, `hub/src/web/routes/sessions.ts`, `hub/src/web/server.ts`, `hub/src/web/middleware/auth.ts`, `hub/src/web/routes/guards.ts`, `shared/src/types.ts`, `shared/src/schemas.ts` — all read in full or in relevant chunks.

### Secondary (MEDIUM confidence)
- `.planning/phases/07-wire-contracts-unification-sse-patch-contract/07-CONTEXT.md` D-119 — `SyncEvent` shared-source assertion (verified consistent with shared/src export chain).

### Tertiary (LOW confidence)
- _(none)_ — every claim in this document was verified against the live codebase or shipped library types.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every dep already installed; versions verified.
- Architecture: HIGH — CONTEXT.md locks every boundary; this research only enumerates call sites.
- Pitfalls: HIGH — empirically verified (madge command run; per-session debounce read line-by-line; SIGINT handlers grep'd).
- Method inventories: HIGH — line-by-line read of `sessionCache.ts` and `syncEngine.ts`.
- Handler inventory: HIGH — overrides CONTEXT's stated count with verified live count (14 not 17).

**Research date:** 2026-05-22
**Valid until:** 2026-06-22 (stable refactor; no fast-moving deps).
