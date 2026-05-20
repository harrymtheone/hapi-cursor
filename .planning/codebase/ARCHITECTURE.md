<!-- refreshed: 2026-05-20 -->
# Architecture

**Analysis Date:** 2026-05-20

## System Overview

```text
┌──────────────────────────────────────────────────────────────────────┐
│                              CLI (cli/)                              │
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐  │
│ │  Claude      │ │  Codex       │ │ Cursor/Gemini│ │  OpenCode    │  │
│ │ `claude/`    │ │ `codex/`     │ │ `cursor/`    │ │ `opencode/`  │  │
│ │              │ │              │ │ `gemini/`    │ │              │  │
│ └──────┬───────┘ └──────┬───────┘ └──────┬───────┘ └──────┬───────┘  │
│        └─────────────────┴────────┬───────┴────────────────┘         │
│                                   ▼                                  │
│           Shared loop + handlers (`modules/common/`)                 │
│             Runner daemon (`runner/`) │ Terminal (Ink `ui/ink/`)     │
└──────────────────────────────────┬───────────────────────────────────┘
                                   │ Socket.IO `/cli` (auth: CLI_API_TOKEN[:ns])
                                   │ REST `/cli/*` (session/machine bootstrap)
                                   ▼
┌──────────────────────────────────────────────────────────────────────┐
│                              HUB (hub/)                              │
│ ┌────────────────────────┐ ┌──────────────────────────────────────┐  │
│ │ Bun HTTP (Hono)        │ │ Socket.IO (`/cli`, `/terminal`)      │  │
│ │ `web/server.ts`        │ │ `socket/server.ts`                   │  │
│ │ routes in `web/routes/`│ │ handlers in `socket/handlers/`       │  │
│ └───────────┬────────────┘ └────────────────┬─────────────────────┘  │
│             │                               │                        │
│             ▼                               ▼                        │
│ ┌──────────────────────────────────────────────────────────────────┐ │
│ │                  SyncEngine (`sync/syncEngine.ts`)               │ │
│ │   ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌──────────────┐  │ │
│ │   │SessionCache│ │MachineCache│ │MessageSvc  │ │ RpcGateway   │  │ │
│ │   │            │ │            │ │            │ │              │  │ │
│ │   └────────────┘ └────────────┘ └────────────┘ └──────────────┘  │ │
│ │                EventPublisher → SSE + notifications              │ │
│ └────────────────────────────────┬─────────────────────────────────┘ │
│                                  │                                   │
│      ┌───────────────────────────┼───────────────────────────┐       │
│      ▼                           ▼                           ▼       │
│ ┌──────────┐            ┌────────────────┐         ┌──────────────┐  │
│ │  Store   │            │ Notifications  │         │  Telegram    │  │
│ │ `store/` │            │ Push/ServerChan│         │  bot         │  │
│ │ SQLite   │            │ /Telegram      │         │ `telegram/`  │  │
│ └──────────┘            └────────────────┘         └──────────────┘  │
└──────────────────────────────────┬───────────────────────────────────┘
                                   │ SSE `/api/events` │ REST `/api/*`
                                   │ Socket.IO `/terminal` (JWT)
                                   ▼
┌──────────────────────────────────────────────────────────────────────┐
│                              WEB (web/)                              │
│  React 19 + Vite PWA, TanStack Router + Query, Tailwind, assistant-ui│
│  ┌──────────────┐ ┌────────────┐ ┌─────────────┐ ┌────────────────┐  │
│  │ routes/      │ │ components/│ │ hooks/      │ │ chat/ (reducer │  │
│  │ router.tsx   │ │ SessionChat│ │ queries/    │ │  + normalize)  │  │
│  │              │ │ SessionList│ │ mutations/  │ │ realtime/      │  │
│  │              │ │ NewSession │ │ useSSE      │ │ (voice)        │  │
│  └──────────────┘ └────────────┘ └─────────────┘ └────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘

                    Shared types/schemas (`shared/src/`)
            Imported as `@hapi/protocol` by cli, hub, web
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| CLI command router | Parse argv, dispatch to subcommand | `cli/src/commands/registry.ts` |
| CLI agent loops | Wrap external agent (Claude/Codex/etc), stream events | `cli/src/{claude,codex,cursor,gemini,opencode}/loop.ts` |
| CLI hub client | Socket.IO + REST client, auth, versioned updates | `cli/src/api/api.ts`, `cli/src/api/apiSession.ts` |
| CLI runner | Background daemon to spawn/manage remote sessions | `cli/src/runner/run.ts`, `cli/src/runner/controlServer.ts` |
| Hub entrypoint | Wire store, sync engine, sockets, web, telegram, tunnel | `hub/src/index.ts` |
| Hub HTTP server | Hono app, CORS, auth middleware, route mounting | `hub/src/web/server.ts` |
| Hub Socket.IO | `/cli` (CLI_API_TOKEN) + `/terminal` (JWT) namespaces | `hub/src/socket/server.ts` |
| SyncEngine | Facade over session/machine/message/rpc caches | `hub/src/sync/syncEngine.ts` |
| SessionCache | In-memory session state w/ versioning + activity expiry | `hub/src/sync/sessionCache.ts` |
| MessageService | Message persistence, pagination, send-to-CLI delivery | `hub/src/sync/messageService.ts` |
| RpcGateway | Route web→hub→CLI RPC calls via socket | `hub/src/sync/rpcGateway.ts` |
| EventPublisher | Fan-out SyncEvent → SSE subscribers + listeners | `hub/src/sync/eventPublisher.ts` |
| SSE manager | Server-Sent Events stream w/ heartbeats | `hub/src/sse/sseManager.ts` |
| Store | SQLite persistence (sessions/messages/machines/users) | `hub/src/store/index.ts` |
| NotificationHub | Dispatch SyncEvent → push/telegram/serverchan channels | `hub/src/notifications/notificationHub.ts` |
| Telegram bot | Mini App entrypoint + permission/notification callbacks | `hub/src/telegram/bot.ts` |
| Tunnel manager | Optional WireGuard/TLS relay tunnel | `hub/src/tunnel/tunnelManager.ts` |
| Web App | React PWA with chat + session list + terminal | `web/src/App.tsx`, `web/src/main.tsx` |
| Web router | TanStack Router route tree | `web/src/router.tsx` |
| Web API client | REST wrapper, JWT auth, optimistic updates | `web/src/api/client.ts` |
| Chat reducer | Normalize agent events into UI timeline | `web/src/chat/reducer.ts`, `web/src/chat/normalize.ts` |
| Shared protocol | Types/schemas/socket events used across packages | `shared/src/types.ts`, `shared/src/socket.ts`, `shared/src/schemas.ts` |

## Pattern Overview

**Overall:** Hub-and-spoke client-server with a thin shared protocol package. The hub is the single source of truth; the CLI is a long-lived agent client; the web app is a thin reactive view.

**Key Characteristics:**
- Local-first: hub runs on the user's machine; CLI connects over localhost or a tunnel.
- Bidirectional sync: CLI pushes session/message/state events; hub broadcasts SSE updates; web→hub→CLI RPC for actions.
- Versioned optimistic concurrency: `versionedUpdate.ts` (CLI) and `store/versionedUpdates.ts` (hub) reject stale updates.
- Namespace-scoped multi-tenancy via `CLI_API_TOKEN:<namespace>` suffix.
- Agent-agnostic core: each agent flavor lives in its own subdirectory but shares `cli/src/modules/common/`.
- Single binary deployment: `bun build:single-exe` embeds web assets + tunwg into one executable.

## Layers

**Shared protocol (`shared/src/`):**
- Purpose: Source-of-truth types/schemas consumed by every package.
- Location: `shared/src/`
- Contains: `types.ts` (Session/Message/Machine), `schemas.ts` (Zod), `socket.ts` (event names), `messages.ts`, `flavors.ts`, `models.ts`, `modes.ts`.
- Depends on: zod only.
- Used by: cli, hub, web (imported as `@hapi/protocol` via bun workspace alias).

**CLI agent layer (`cli/src/{claude,codex,cursor,gemini,opencode,agent}`):**
- Purpose: Wrap each external coding agent CLI as a streamable session.
- Pattern: Per-flavor `runX.ts` entry → `loop.ts` event pump → `session.ts` state → `xxxLocal.ts` / `xxxRemote.ts` launcher.
- Depends on: `cli/src/modules/common/` for shared handlers (bash, git, ripgrep, files, slash commands, skills).

**CLI hub-client layer (`cli/src/api/`):**
- Purpose: Single Socket.IO + REST client to the hub.
- Files: `api.ts`, `apiSession.ts`, `apiMachine.ts`, `auth.ts`, `versionedUpdate.ts`, `hubExtraHeaders.ts`, `rpc/RpcHandlerManager.ts`.

**CLI runner (`cli/src/runner/`):**
- Purpose: Detached daemon that owns long-lived sessions and accepts spawn/list requests via a local HTTP control server.
- Files: `run.ts`, `controlServer.ts`, `controlClient.ts`, `worktree.ts`.

**Hub I/O layer (`hub/src/web/`, `hub/src/socket/`):**
- Purpose: External interfaces (HTTP, Socket.IO, SSE).
- Hono app under `web/server.ts`; route modules in `web/routes/`.
- Socket namespaces wired in `socket/server.ts`; handlers in `socket/handlers/cli/`.

**Hub sync layer (`hub/src/sync/`):**
- Purpose: Stateful glue between sockets, store, and clients.
- Composes: `SessionCache`, `MachineCache`, `MessageService`, `RpcGateway`, `EventPublisher` behind `SyncEngine`.

**Hub persistence (`hub/src/store/`):**
- Purpose: SQLite via better-sqlite3, JSON-encoded payloads.
- Sub-stores: `sessionStore.ts`, `messageStore.ts`, `machineStore.ts`, `userStore.ts`, `pushStore.ts`.

**Hub side-channels (`hub/src/{notifications,push,serverchan,telegram,tunnel,visibility}/`):**
- Purpose: Optional, hot-pluggable notification channels and the relay tunnel.

**Web app (`web/src/`):**
- Presentation: `components/`, `routes/`.
- State/data: `hooks/queries/` (TanStack Query) + `hooks/mutations/` + `hooks/useSSE.ts`.
- Chat domain: `chat/` reducer + normalizers turn raw events into a UI timeline.
- Realtime extras: `realtime/` for ElevenLabs voice + Socket.IO terminal.

## Data Flow

### Primary Request Path (web user sends a message)

1. User types in composer → `useSendMessage` mutation (`web/src/hooks/mutations/useSendMessage.ts`).
2. POST `/api/sessions/:id/messages` → `createMessagesRoutes` (`hub/src/web/routes/messages.ts`).
3. Handler calls `SyncEngine` (`hub/src/sync/syncEngine.ts`) which delegates to `MessageService.send(...)` (`hub/src/sync/messageService.ts`).
4. `MessageService` persists via `Store.messages` (`hub/src/store/messageStore.ts`) and emits Socket.IO `message` to the CLI socket bound to that session.
5. CLI `apiSession.ts` receives the event, hands off to the agent loop (e.g. `cli/src/claude/loop.ts`).
6. Agent emits stream events → CLI calls `apiSession.updateState/updateMetadata` (versioned) → hub `SessionCache.applyUpdate` (`hub/src/sync/sessionCache.ts`).
7. `EventPublisher` (`hub/src/sync/eventPublisher.ts`) fans out a `SyncEvent` to SSE subscribers and to `NotificationHub`.
8. Web subscribes via SSE (`web/src/hooks/useSSE.ts`); cache invalidation triggers TanStack Query refetch; `chat/reducer.ts` integrates new events into the timeline.

### Web→CLI RPC (e.g. list files, git status)

1. Web hook (e.g. `useGitStatusFiles`) → REST endpoint in `hub/src/web/routes/git.ts`.
2. Route invokes `SyncEngine.rpcCall(...)` → `RpcGateway.call(...)` (`hub/src/sync/rpcGateway.ts`).
3. Gateway emits `rpc-request` on the CLI socket; CLI dispatches via `cli/src/api/rpc/RpcHandlerManager.ts` to handlers in `cli/src/modules/common/handlers/`.
4. Response flows back through the same socket; gateway resolves the awaiting promise; route returns JSON.

### CLI heartbeat / activity

1. CLI sends `session-alive` / `machine-alive` periodically (`cli/src/api/apiSession.ts`, `cli/src/api/apiMachine.ts`).
2. `socket/handlers/cli/sessionHandlers.ts` forwards to `SyncEngine.handleSessionAlive / handleMachineAlive`.
3. `SyncEngine.inactivityTimer` (5 s) expires stale sessions via `expireInactive` (`hub/src/sync/syncEngine.ts:89`).

### Terminal session (xterm.js)

1. Web opens Socket.IO connection to `/terminal` namespace with JWT (`web/src/hooks/useTerminalSocket.ts`).
2. `hub/src/socket/handlers/terminal.ts` validates the JWT and creates a terminal entry in `TerminalRegistry` (`hub/src/socket/terminalRegistry.ts`).
3. Hub asks CLI (over `/cli`) to create the PTY; CLI manages it via `cli/src/terminal/TerminalManager.ts`.
4. Bidirectional `terminal:write` / `terminal:resize` / `terminal:close` events relay between web↔hub↔CLI; idle terminals are GC'd after `HAPI_TERMINAL_IDLE_TIMEOUT_MS`.

**State Management:**
- Server state: SQLite is durable truth; `SessionCache` / `MachineCache` mirror it in memory and use `applyVersionedUpdate` to reject stale writes (`hub/src/store/versionedUpdates.ts`).
- Web state: TanStack Query cache keyed by `queryKeys` (`web/src/lib/query-keys.ts`); SSE events trigger `invalidateQueries`. Chat timeline kept in a reducer outside of Query (`web/src/chat/reducer.ts`).
- CLI state: per-session in-memory state in `*/session.ts`; persisted user config in `~/.hapi/settings.json` via `cli/src/persistence.ts`.

## Key Abstractions

**Session:**
- Purpose: A single agent conversation owned by a CLI/machine, with `metadata`, `agentState`, `messages`, `mode` (local/remote), `permissionMode`, `model`.
- Examples: `shared/src/types.ts`, persisted in `hub/src/store/sessionStore.ts`.
- Pattern: Versioned dual-document (metadata + agent state) + activity timestamp.

**Machine:**
- Purpose: A host running the CLI runner; advertises agent flavors and workspace roots.
- Examples: `hub/src/store/machineStore.ts`, `hub/src/sync/machineCache.ts`.

**SyncEvent:**
- Purpose: Union of all server-side updates broadcast to clients.
- Examples: `shared/src/socket.ts` (event names), `hub/src/sync/eventPublisher.ts`.

**Agent flavor:**
- Purpose: Enum of supported agents (`claude`, `codex`, `cursor`, `gemini`, `opencode`).
- File: `shared/src/flavors.ts`; per-flavor implementation in `cli/src/<flavor>/`.

**RPC method:**
- Purpose: Typed request/response between hub and CLI tools (bash, git, ripgrep, file ops, slash commands, skills).
- Files: `hub/src/sync/rpcGateway.ts`, `cli/src/modules/common/registerCommonHandlers.ts`, `cli/src/modules/common/handlers/`.

**Permission request:**
- Purpose: User approval/denial of agent tool calls.
- Files: `cli/src/modules/common/permission/BasePermissionHandler.ts`, `hub/src/web/routes/permissions.ts`.

**Versioned update:**
- Purpose: Optimistic concurrency for metadata/agent state.
- Files: `cli/src/api/versionedUpdate.ts`, `hub/src/store/versionedUpdates.ts`.

## Entry Points

**CLI binary:**
- Location: `cli/src/index.ts` → `cli/src/commands/runCli.ts` → `cli/src/commands/registry.ts`.
- Triggers: User runs `hapi`, `hapi codex`, `hapi runner start`, etc.
- Default subcommand: `claudeCommand` (when no subcommand matches).

**Hub process:**
- Location: `hub/src/index.ts`.
- Triggers: `hapi hub` (or alias `hapi server`), or directly via `bun run dev:hub`.
- Responsibilities: Load config, init store + jwt + vapid, build socket/web servers, optionally start tunnel and telegram bot.

**Web app:**
- Location: `web/src/main.tsx` → `web/src/App.tsx` → `web/src/router.tsx`.
- Triggers: Browser loads `/index.html` (served by hub or static host).

**Single binary:**
- Location: `cli/local-client-launcher.ts` is the entry for the all-in-one build; the same `runCli` is invoked, with `hub`/`server` subcommands embedding the hub.

## Architectural Constraints

- **Threading:** Single-threaded JS event loop everywhere (Bun and browser). No worker threads in CLI/hub. PTYs run as child processes managed by `cli/src/terminal/TerminalManager.ts`.
- **Global state:** Hub keeps module-level singletons in `hub/src/index.ts` (`syncEngine`, `webServer`, `sseManager`, `visibilityTracker`, `notificationHub`, `tunnelManager`, `happyBot`). Configuration accessor is module-singleton via `hub/src/configuration.ts` (`getConfiguration()`).
- **Versioned writes:** Any update to session metadata or agent state MUST go through `applyVersionedUpdate` to avoid losing concurrent edits. Direct store mutation bypasses the gate.
- **Namespace isolation:** Every store query must scope by `namespace`; the CLI auth handshake stores it on `socket.data.namespace` (`hub/src/socket/server.ts:109`), and `JWT` payloads carry `ns`.
- **No backward compatibility (project rule):** Breaking protocol/schema changes are allowed; bump `shared/src/version.ts` and adjust all packages atomically.
- **TypeScript strict:** All packages enforce strict mode via `tsconfig.base.json`.
- **Path alias:** `@/*` → `./src/*` per package; cross-package imports use `@hapi/protocol`.

## Anti-Patterns

### Calling the Store directly from route handlers

**What happens:** A REST route reads/writes via `store.sessions.*` instead of going through `SyncEngine`.
**Why it's wrong:** Bypasses cache, event emission, activity tracking, and namespace checks; web clients won't see updates and stale entries linger.
**Do this instead:** Use `getSyncEngine()` injected into route factories (see `hub/src/web/routes/sessions.ts`) and call methods on `SyncEngine`.

### Emitting events to all Socket.IO clients

**What happens:** Code calls `io.emit(...)` to broadcast.
**Why it's wrong:** Leaks data across namespaces; CLI tokens are namespace-scoped and SSE is filtered by namespace via `EventPublisher.resolveNamespace`.
**Do this instead:** Publish a `SyncEvent` through `EventPublisher` (`hub/src/sync/eventPublisher.ts`) or target the specific CLI socket from `RpcGateway`.

### Unversioned metadata writes

**What happens:** CLI sends a metadata patch without bumping the version.
**Why it's wrong:** Concurrent updates from another client can win silently; clients observe regressions.
**Do this instead:** Use the `versionedUpdate` helper (`cli/src/api/versionedUpdate.ts`); on the hub side, `applyVersionedUpdate` in `hub/src/store/versionedUpdates.ts` rejects stale versions.

### Reading CLI state from web via REST polling

**What happens:** A new hook polls `/api/sessions/:id` every few seconds.
**Why it's wrong:** Doubles server load and competes with SSE; the canonical pattern is "query once, invalidate on SSE event".
**Do this instead:** Subscribe in `useSSE` and call `queryClient.invalidateQueries(queryKeys.session(id))` from the event handler.

### Putting agent-specific logic into shared modules

**What happens:** Flavor-specific quirks leak into `cli/src/modules/common/`.
**Why it's wrong:** Couples agents; breaks the agent-agnostic abstraction.
**Do this instead:** Keep flavor logic in `cli/src/<flavor>/` and expose flavor-agnostic interfaces (see `cli/src/agent/sessionBase.ts`, `loopBase.ts`).

## Error Handling

**Strategy:** Errors thrown locally; route handlers convert to JSON `{ error }` with appropriate HTTP status. Socket handlers `ack(false, message)` on RPC failure. CLI surfaces fatal errors through `cli/src/ui/logger.ts` and `~/.hapi/logs/`.

**Patterns:**
- Hono routes return `c.json({ error }, status)` and rely on the global Hono `logger()` middleware (`hub/src/web/server.ts:71`).
- RPC errors propagate as `{ ok: false, error }` via `RpcGateway` and become thrown errors on the web side.
- Versioned-update conflicts return `version_conflict` rather than throwing, so callers can decide whether to retry.
- CLI catches bootstrap errors at top-level in `cli/src/commands/runCli.ts` callers; `cli/src/index.ts` uses `void runCli()` (errors surface via runtime UI/logger).

## Cross-Cutting Concerns

**Logging:**
- Hub: `console.log` with `[Hub]` / `[Web]` / `[Tunnel]` prefixes; Hono `logger()` middleware for HTTP.
- CLI: Structured logger in `cli/src/ui/logger.ts`; writes to `~/.hapi/logs/`.
- Web: `console.log` in dev only; production gates behind `import.meta.env.DEV`.

**Validation:**
- Zod schemas in `shared/src/schemas.ts` reused across cli/hub/web.
- Hub additionally validates JWT payloads and socket handshake payloads inline (e.g. `jwtPayloadSchema` in `hub/src/socket/server.ts`).

**Authentication:**
- CLI ↔ Hub: `CLI_API_TOKEN[:namespace]` shared secret, verified with `parseAccessToken` + `constantTimeEquals` (`hub/src/utils/`).
- Web ↔ Hub: JWT (HS256) issued by `/api/auth` with `{ uid, ns }`; verified by `createAuthMiddleware` (`hub/src/web/middleware/auth.ts`).
- Telegram: initData verification in `hub/src/web/telegramInitData.ts`; bindings stored per namespace.

**Configuration:**
- Layered: env vars → `~/.hapi/settings.json` → defaults. Hub uses `hub/src/configuration.ts::createConfiguration`; CLI uses `cli/src/configuration.ts` + `cli/src/persistence.ts`.
- Per-config `source` ('env' | 'file' | 'default' | 'generated') reported at hub startup (`hub/src/index.ts:32`).

---

*Architecture analysis: 2026-05-20*
