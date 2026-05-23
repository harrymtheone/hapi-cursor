# Architecture Research

**Domain:** Cursor mobile control features in a CLI-Hub-Web bridge
**Researched:** 2026-05-23
**Confidence:** HIGH for existing HAPI integration points; MEDIUM for exact Cursor CLI per-session skill/MCP enforcement because official docs confirm inventory and global/project controls, but do not document a stable session-only toggle API.

## Standard Architecture

### System Overview

v1.1 should keep the existing three-layer shape. The new features are Cursor runtime controls, not a new runtime, transport, or deployment model.

```text
Phone / tablet PWA
    |
    | REST mutations, REST inventory reads, SSE cache updates
    v
Hub (Hono + SyncEngine + SQLite + SSE)
    |
    | Socket.IO RPC to active sessions and online machines
    v
CLI runner / Cursor session process
    |
    | agent flags and agent subcommands
    v
Cursor Agent CLI + local Cursor config
```

The Hub remains the policy and persistence boundary. The CLI remains the only component allowed to inspect local Cursor state, call `agent`, read skill files, read MCP config, and turn Cursor stream events into HAPI messages. The Web remains a thin mobile control surface backed by TanStack Query and strict shared wire schemas.

### Component Responsibilities

| Component | Responsibility | v1.1 Recommendation |
|-----------|----------------|---------------------|
| `shared/` protocol | Own all wire contracts and patch schemas | Add Cursor inventory/config/status schemas here before adding routes or UI |
| CLI Cursor runtime | Discover local Cursor capabilities and apply session config to future turns | Add model inventory, MCP inventory, richer skill inventory, session policy application, and screenshot conversion |
| Hub routes | Authenticate web requests, validate bodies, call `SyncEngine` | Extend session config routes and add inventory/policy routes under existing `/api/sessions` and `/api/machines` resources |
| Hub `SyncEngine` | Coordinate cache, SQLite, SSE, and CLI RPC | Keep active-session config path as Web -> Hub -> session RPC -> cache/store -> SSE |
| Hub SQLite store | Persist session selections and policy | Reuse existing session columns for model/effort; add one JSON config column or small per-session config table for toggles |
| Web API/hooks | Fetch inventory, mutate session policy, receive SSE patches | Add query keys/hooks/mutations rather than local-only state |
| Web session UI | Present status, model/effort, skill/MCP toggles, screenshots | Modify decomposed session list/chat/settings components, not the core router shape |

## Recommended Project Structure

```text
shared/src/
+-- cursor.ts                 # CursorModel, CursorSkill, CursorMcpServer, CursorSessionConfig schemas
+-- schemas.ts                # Session, SessionPatch, Metadata additions
+-- flavors.ts                # Cursor capability flags for model, effort, skills, MCP, images

cli/src/cursor/
+-- inventory/
|   +-- models.ts             # calls `agent models` or `agent --list-models`
|   +-- mcpServers.ts         # reads config and/or calls `agent mcp list`
|   +-- sessionPolicy.ts      # applies HAPI session policy to a Cursor turn
+-- utils/cursorEventConverter.ts
+-- runCursor.ts              # applies model/effort/toggle config to queued turns

cli/src/modules/common/handlers/
+-- cursorInventory.ts        # machine/session RPC handlers for models and MCP
+-- skills.ts                 # expand current skill listing to Cursor docs-compatible roots

hub/src/web/routes/
+-- sessions/config.ts        # model, effort, skill toggle, MCP toggle endpoints
+-- sessions/read.ts          # session-scoped skill/MCP reads where active session context matters
+-- machines.ts               # machine-scoped model/MCP inventory reads

web/src/hooks/
+-- queries/useCursorModels.ts
+-- queries/useMcpServers.ts
+-- queries/useSkills.ts      # extend current hook with enabled/disabled state
+-- mutations/useCursorSessionConfig.ts
```

### Structure Rationale

- **Inventory belongs near the CLI.** Cursor model lists, skill discovery, and MCP config are local-machine facts. The Hub should broker them through RPC, not reimplement local filesystem or Cursor CLI behavior.
- **Policy belongs in the Hub store.** Session-level toggles must survive PWA reloads and Hub restarts. They should be emitted through strict `SessionPatchSchema`, not held in browser state.
- **Presentation belongs in Web hooks/components.** Existing `ApiClient`, query keys, `useSSE`, and decomposed `SessionList` are already the correct extension points.

## Existing Substrate

Several v1.1 foundations already exist and should be reused.

| Area | Existing State | Implication |
|------|----------------|-------------|
| Session model/effort storage | `sessions.model`, `model_reasoning_effort`, and `effort` columns already exist | CURS-01/CURS-04 do not need a new schema for these scalar fields |
| Strict SSE patches | `SessionPatchSchema` already includes `model`, `modelReasoningEffort`, `effort`, `backgroundTaskCount` | Add new patch fields deliberately; do not revive heuristic refetching |
| Config application flow | `SyncEngineSession.applySessionConfig()` already calls active session RPC before cache/store update | Extend this path for all session-level controls |
| Model route stub | `POST /sessions/:id/model` exists but is disabled by `supportsModelChange('cursor') === false` | First model phase can turn on the capability and complete the CLI handler |
| Skills list route | `GET /sessions/:id/skills` already calls session RPC | Expand returned shape and discovery accuracy rather than starting over |
| Generated image UI | Web already has generated-image normalization, blob fetch, and image card display | Browser screenshots should enter this existing generated-image pipeline |

## Architectural Patterns

### Pattern 1: Shared Contract First

**What:** Add Zod schemas and exported types in `shared/` before Hub/Web/CLI code consumes new shapes.

**When to use:** Every v1.1 field that crosses process boundaries: model inventory, MCP server summary, skill summary, session policy, cursor status, and image metadata.

**Trade-offs:** Slightly more up-front typing, but it preserves the v1.0 invariant that `shared/` is the only wire contract source.

Recommended schemas:

```typescript
export const CursorModelSchema = z.object({
    id: z.string().min(1),
    label: z.string().min(1),
    available: z.boolean().default(true)
})

export const CursorSkillSchema = z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    source: z.enum(['project', 'user']),
    autoInvocation: z.boolean().optional(),
    enabledForSession: z.boolean()
})

export const CursorMcpServerSchema = z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    source: z.enum(['project', 'user', 'nested']),
    transport: z.enum(['stdio', 'http', 'sse', 'unknown']),
    status: z.enum(['enabled', 'disabled', 'connected', 'disconnected', 'unknown']),
    enabledForSession: z.boolean()
})
```

### Pattern 2: Inventory vs Policy Separation

**What:** Treat "what Cursor can see" and "what this HAPI session allows" as separate data.

**When to use:** Skills and MCP toggles. Cursor docs confirm automatic discovery of skills from known directories and MCP server management through `agent mcp`; HAPI still needs session-specific state.

**Trade-offs:** Requires merge logic in Hub/Web, but avoids mutating global or project Cursor config when the mobile user toggles a single session.

Recommended state:

```typescript
type CursorSessionConfig = {
    model: string | null
    effort: string | null
    disabledSkillNames: string[]
    disabledMcpServerIds: string[]
}
```

The CLI inventory reports all discovered skills/MCP servers. The Hub overlays `disabled*` lists from the session config before returning data to Web.

### Pattern 3: Active Session RPC Before Store Update

**What:** For active sessions, Hub asks the CLI to apply config first, then writes exactly what the CLI says was applied.

**When to use:** Model, effort, skill policy, MCP policy, and permission mode changes.

**Trade-offs:** Active changes can fail when the session socket is gone, but Web gets a real error instead of optimistic drift.

Current flow to preserve:

```text
Web mutation
  -> Hub route validates shared schema
  -> SyncEngine.applySessionConfig(sessionId, config)
  -> RpcGateway.requestSessionConfig(sessionId, config)
  -> CLI set-session-config handler returns { applied }
  -> SessionConfigService persists/cache-updates
  -> SSE session-updated patch/full session
  -> Web TanStack cache updates
```

For inactive sessions, the current direct cache/store path is correct: save the config and apply it when the session is resumed or spawned.

### Pattern 4: Mobile Images Through Generated Assets

**What:** Convert Cursor MCP image results into existing HAPI generated-image messages and serve blobs through the existing authenticated route.

**When to use:** `cursor-ide-browser` screenshots and any MCP result whose content includes an image block.

**Trade-offs:** The current generated image registry is CLI-process-local. That is enough for active-session display, but not enough for durable screenshot history after the CLI process exits. If durable screenshots are required, add Hub-owned asset persistence.

## Data Flow

### Model Inventory

```text
Web opens model picker
  -> GET /api/machines/:id/cursor-models
  -> Hub machine RPC: listCursorModels
  -> CLI calls Cursor CLI model listing command
  -> CLI normalizes to CursorModel[]
  -> Hub returns and Web caches by machine id
```

Official Cursor docs expose `--model`, `--list-models`, and the `models` command. Prefer the command that gives the most stable parseable output in the installed CLI. If output is text-only, keep parsing in `cli/src/cursor/inventory/models.ts` and cover it with fixtures.

### Model Switch

```text
Web selects model
  -> POST /api/sessions/:id/model { model }
  -> Hub validates model string and active session
  -> active: session RPC set-session-config { model }
  -> CLI updates currentModel and returns applied model
  -> Hub persists sessions.model and emits session-updated
  -> Web updates session detail and session list chip
  -> next remote turn spawns `agent ... --model <model>`
```

Important implementation detail: `runCursor.ts` currently keeps `currentModel` as a constant and the `set-session-config` handler only applies `permissionMode`. This must become mutable state, and `MessageQueue2` hashing should include the applied model/effort so queued turns are grouped correctly.

### Session Status / Effort / Model Metadata

```text
CLI keepAlive/session-alive
  -> includes thinking, mode, permissionMode, model, effort
  -> Hub session alive handler updates cache
  -> SessionPatch emits model/effort/thinking/active/backgroundTaskCount
  -> Web `useSSE` patches `queryKeys.sessions`
  -> SessionListItem renders status + model + effort
```

`SessionSummary` already contains `model` and `effort`. Add a derived `cursorStatus` only if the UI needs more than the existing `active`, `thinking`, pending request count, lifecycle metadata, and background task count. Prefer derivation in `toSessionSummary()` over duplicating status fields in SQLite.

### Skills Visibility and Toggles

```text
Web opens skill panel
  -> GET /api/sessions/:id/skills
  -> Hub reads session config and calls session RPC listSkills
  -> CLI scans Cursor skill roots for SKILL.md
  -> Hub overlays enabledForSession
  -> Web renders toggle list

Web toggles skill
  -> POST /api/sessions/:id/skills/:name { enabled }
  -> Hub updates session config through applySessionConfig
  -> active session RPC acknowledges applied disabledSkillNames
  -> SSE updates session detail/config
```

Official Cursor docs say skills are discovered from `.agents/skills`, `.cursor/skills`, and matching user-level roots, including nested skill directories. The current CLI implementation only scans top-level `.agents/skills` roots. v1.1 should align discovery with Cursor docs, but avoid editing skill files for mobile toggles.

Session-level enforcement needs a Cursor-specific spike. If Cursor Agent exposes no per-invocation skill disable API, the safe v1.1 behavior is: suppress disabled skills from HAPI suggestions and explicit mobile invocation, record the disabled policy, and add an agent instruction/policy only through a supported Cursor mechanism. Do not mutate skill frontmatter or rename skill folders from the phone.

### MCP Server List and Toggles

```text
Web opens MCP panel
  -> GET /api/sessions/:id/mcp-servers or /api/machines/:id/mcp-servers
  -> Hub calls CLI inventory RPC
  -> CLI reads project/global/nested mcp config and/or `agent mcp list`
  -> Hub overlays session disabledMcpServerIds
  -> Web renders status/source/transport/toggle

Web toggles MCP server for a session
  -> POST /api/sessions/:id/mcp-servers/:id { enabled }
  -> Hub persists session policy
  -> active session RPC acknowledges applied policy
```

Official Cursor docs confirm `agent mcp list`, `agent mcp list-tools`, `agent mcp enable`, and `agent mcp disable`, plus project/global/nested config precedence. Those commands are configuration controls, not documented as session-only toggles. HAPI should not call `agent mcp enable/disable` for per-session toggles because that mutates Cursor state outside the current HAPI session and can race concurrent sessions.

If no supported per-turn MCP allow/deny exists, treat v1.1 MCP toggle enforcement as a flagged phase: build inventory and policy first, then verify whether Cursor CLI has a session-scoped control. If it does not, expose toggles as HAPI policy with clear limitations rather than silently changing global/project MCP config.

### Browser Screenshot Display

```text
Cursor Agent emits MCP tool result with image content
  -> cursorEventConverter detects image block
  -> CLI writes image bytes to session asset path and registerGeneratedImage()
  -> CLI sends agent message { type: "generated-image", imageId, fileName, mimeType }
  -> Hub stores message as normal
  -> Web normalizeAgent creates GeneratedImageBlock
  -> ToolMessage fetches /api/sessions/:id/generated-images/:imageId
  -> Hub proxies readGeneratedImage RPC and returns image blob
```

The Web side is already mostly present. The missing piece is likely conversion and registration: `registerGeneratedImage()` exists, but current search did not find a caller. Add tests around Cursor MCP image result shapes, especially base64 image content from MCP tools.

## New vs Modified Components

### New Components

| Component | Package | Purpose |
|-----------|---------|---------|
| `shared/src/cursor.ts` | `shared` | Cursor model, skill, MCP, session config schemas |
| `cli/src/cursor/inventory/models.ts` | `cli` | Dynamic Cursor model discovery |
| `cli/src/cursor/inventory/mcpServers.ts` | `cli` | MCP server discovery with source/transport/status |
| `cli/src/cursor/inventory/sessionPolicy.ts` | `cli` | Applies HAPI session policy to Cursor turns where supported |
| `cli/src/modules/common/handlers/cursorInventory.ts` | `cli` | RPC handlers for model/MCP inventory |
| `hub/src/sync/cursorSessionConfigService.ts` or extension of `SessionConfigService` | `hub` | Owns structured Cursor session policy persistence |
| `web/src/hooks/queries/useCursorModels.ts` | `web` | Model inventory query |
| `web/src/hooks/queries/useMcpServers.ts` | `web` | MCP inventory query |
| `web/src/hooks/mutations/useCursorSessionConfig.ts` | `web` | Model/effort/skill/MCP mutations |

### Modified Components

| Component | Change |
|-----------|--------|
| `shared/src/schemas.ts` | Extend `SessionSchema`/`SessionPatchSchema` with Cursor config only if the UI needs config in session detail/list |
| `shared/src/sessionSummary.ts` | Include model/effort/status display fields needed by session list |
| `shared/src/flavors.ts` | Set Cursor `supportsModelChange`/`supportsEffort` to true and add skill/MCP/image capability slots |
| `hub/src/store/index.ts` | Bump schema version if adding a session config column/table |
| `hub/src/store/sessions.ts` | Persist and read Cursor session config JSON if using the session row |
| `hub/src/web/routes/sessions/config.ts` | Add effort, skill toggle, MCP toggle endpoints; complete model route |
| `hub/src/web/routes/sessions/read.ts` | Return richer skills and add MCP list route if session-scoped |
| `hub/src/web/routes/machines.ts` | Add machine-scoped model/MCP inventory routes |
| `hub/src/sync/rpcGateway.ts` | Add `listCursorModels`, `listMcpServers`, and extend `requestSessionConfig` payload |
| `cli/src/cursor/runCursor.ts` | Make model/effort/session policy mutable and returned from `set-session-config` |
| `cli/src/cursor/cursorRemoteLauncher.ts` | Pass model/effort/policy into each `agent` invocation |
| `cli/src/modules/common/skills.ts` | Match Cursor skill discovery roots and nested scanning |
| `cli/src/cursor/utils/cursorEventConverter.ts` | Convert MCP image results into generated-image messages |
| `web/src/api/client.ts` | Add inventory reads and config mutations |
| `web/src/lib/query-keys.ts` | Add model/MCP/session config query keys |
| `web/src/hooks/useSSE.ts` | Patch any new strict session config/status fields |
| `web/src/components/SessionList/SessionListItem.tsx` | Render compact status/model/effort metadata |

## Storage and Schema Implications

### Recommended SQLite Shape

Keep existing scalar columns:

```text
sessions.model
sessions.model_reasoning_effort
sessions.effort
```

Add one structured config field for toggle policy:

```text
sessions.cursor_config TEXT NULL
```

Stored JSON:

```json
{
  "disabledSkillNames": [],
  "disabledMcpServerIds": []
}
```

Rationale: model/effort are already first-class fields used by summaries and patches. Toggle policy is structured, session-scoped, small, and likely to evolve; a JSON field avoids a premature join table. Because this repo has no backward compatibility requirement, bump `SCHEMA_VERSION` and provide a clear offline rebuild/migration note if needed.

If query-by-toggle ever becomes necessary, split into `session_cursor_skill_policy` and `session_cursor_mcp_policy` tables later. It is unnecessary for single-user mobile control.

### Shared Patch Shape

Only add fields that Web needs to update without refetch:

```typescript
SessionPatchSchema.extend({
    cursorConfig: CursorSessionConfigSchema.optional(),
    cursorStatus: CursorStatusSchema.optional()
}).strict()
```

If `cursorStatus` can be derived from existing fields, skip it and keep patches smaller.

## Anti-Patterns

### Anti-Pattern 1: Mutating Cursor Global Config for Session Toggles

**What people do:** Call `agent mcp enable/disable` or edit skill files when the user toggles a server/skill in one HAPI session.

**Why it is wrong:** Cursor docs describe those as Cursor configuration controls. They affect more than the current HAPI session and can race other active sessions.

**Do this instead:** Store HAPI session policy separately. Apply it only through a verified per-invocation Cursor mechanism. If none exists, expose inventory and policy with a documented enforcement limitation.

### Anti-Pattern 2: Web-Local Toggle State

**What people do:** Keep skill/MCP toggles in React state or browser storage.

**Why it is wrong:** PWA reloads, multiple devices, and SSE reconnects will drift from the active CLI session.

**Do this instead:** Persist session policy in Hub SQLite and emit strict session patches.

### Anti-Pattern 3: Reintroducing Generic Agent Abstractions

**What people do:** Create flavor-neutral model, MCP, or skill frameworks for agents that are not in this repo.

**Why it is wrong:** v1.0 deliberately made this a Cursor-only, single-user system. Generic abstractions add maintenance surface without product value.

**Do this instead:** Use Cursor-named schemas and services. Keep the existing capability table only as a local feature gate for UI/route behavior.

### Anti-Pattern 4: Persisting Screenshots Only in CLI Memory

**What people do:** Register images only in the current CLI process map and assume mobile history will keep working forever.

**Why it is wrong:** Hub messages survive longer than the CLI image registry. Reloaded or resumed sessions can show broken image cards.

**Do this instead:** For v1.1 active display, reuse the existing route. If durable history is in scope, add Hub-owned session assets or a file-backed CLI registry with metadata that can be recovered.

## Suggested Build Order

1. **Shared contracts and capability gates**
   - Add Cursor inventory/config schemas.
   - Turn on `supportsModelChange` and `supportsEffort` only when CLI apply path is ready.
   - Add tests for strict patch acceptance/rejection.

2. **CLI inventory foundations**
   - Implement model listing from Cursor CLI.
   - Expand skill discovery to Cursor-documented roots and nested directories.
   - Implement MCP inventory without mutating Cursor config.

3. **Hub RPC, routes, and storage**
   - Add machine/session inventory RPCs.
   - Add `cursor_config` persistence or equivalent.
   - Extend `SessionConfigService` and `SyncEngineSession.applySessionConfig()`.

4. **Model switching end-to-end**
   - Complete the existing model route.
   - Make `runCursor.ts` model state mutable.
   - Verify inactive session resume and active remote next-turn behavior.

5. **Session list metadata**
   - Render model, effort, status chips in `SessionListItem`.
   - Use existing SSE patch fields where possible.

6. **Skills UI and session policy**
   - Return richer skill summaries.
   - Add session toggle mutation.
   - Verify actual enforcement mechanism before claiming disabled skills cannot auto-apply.

7. **MCP UI and session policy**
   - Add MCP server inventory.
   - Add session toggle mutation.
   - Do not call global/project enable/disable commands for session-only toggles.

8. **Browser screenshots**
   - Add Cursor event conversion for MCP image content.
   - Reuse generated-image message, route, and Web card.
   - Decide whether active-only or durable screenshot history is required.

9. **Verification**
   - `bun run typecheck`
   - `bun run test`
   - `bun run madge:check`
   - Mobile Tailscale smoke: create session, switch model, toggle policy, view session list metadata, invoke browser screenshot, reload PWA.

## Phase-Specific Research Flags

| Phase Topic | Risk | Recommendation |
|-------------|------|----------------|
| Session-level skills | MEDIUM | Verify Cursor has a per-invocation skill suppression mechanism; otherwise limit enforcement claims |
| Session-level MCP toggles | HIGH | Official docs show config-level enable/disable, not session-only toggles; spike before implementation |
| Model listing parser | MEDIUM | Prefer stable JSON if Cursor CLI offers it; otherwise fixture-test text parsing |
| Browser screenshots | MEDIUM | Confirm actual Cursor stream shape for MCP image results from `cursor-ide-browser` |
| Session status display | LOW | Existing active/thinking/pending/model/effort data already covers most UI needs |

## Sources

- Project context: `.planning/PROJECT.md`, `.planning/MILESTONES.md`
- Repo docs: `README.md`, `cli/README.md`, `hub/README.md`, `web/README.md`
- Existing contracts: `shared/src/schemas.ts`, `shared/src/sessionSummary.ts`, `shared/src/flavors.ts`
- Existing Hub flow: `hub/src/sync/syncEngineSession.ts`, `hub/src/sync/sessionConfigService.ts`, `hub/src/web/routes/sessions/config.ts`
- Existing CLI flow: `cli/src/cursor/runCursor.ts`, `cli/src/cursor/cursorRemoteLauncher.ts`, `cli/src/modules/common/skills.ts`
- Existing image path: `cli/src/modules/common/generatedImages.ts`, `hub/src/web/routes/git.ts`, `web/src/components/AssistantChat/messages/ToolMessage.tsx`
- Cursor official docs: `https://cursor.com/docs/cli/mcp`, `https://cursor.com/docs/mcp`, `https://cursor.com/docs/skills`
- Cursor CLI parameter evidence: official search result for `https://cursor.com/docs/cli/reference/parameters` confirmed `--model`, `--list-models`, `models`, and `mcp` commands; direct fetch timed out during research.

---
*Architecture research for: v1.1 Cursor mobile features*
*Researched: 2026-05-23*
