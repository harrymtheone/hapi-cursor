# Phase 01: Cursor Runtime Config Contract - Research

**Researched:** 2026-05-23
**Domain:** Cursor Agent CLI runtime configuration, HAPI session metadata, strict SSE patches, mobile runtime UI
**Confidence:** HIGH for launch/discovery and existing HAPI contract; MEDIUM for true hot-switch behavior because Cursor documents `/model` but HAPI does not yet have a local stdin-control path.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
## Implementation Decisions

### Model Discovery
- **D-01:** The trusted source for available models is the local Cursor CLI/runtime discovery result only. Do not ship an internal fallback list of common model names.
- **D-02:** Trigger model discovery when the new-session panel opens. Use a short cache, and show discovery failure directly inside the selector.
- **D-03:** If discovery fails overall or returns no usable models, show a short safe reason, a retry action, and allow the user to continue with "auto/unspecified model". Do not expose raw stderr in the normal mobile UI.
- **D-04:** Display the raw Cursor model id as the primary value. Lightweight labels or grouping are acceptable, but HAPI must not rename models in a way that hides the real id.

### Launch Config
- **D-05:** Default new-session runtime config is "auto/unspecified". Only pass and persist model/effort when the user explicitly chooses them.
- **D-06:** Treat effort as a Cursor runtime/model capability, not a HAPI-owned promise. Show effort controls only when Cursor discovery or verified runtime behavior confirms support; otherwise keep effort as auto/unspecified and do not invent common options.
- **D-07:** Model/effort chosen for a session should be visible near the chat input/model control. The session list should not show model.
- **D-08:** If Cursor rejects a selected model/effort at launch, fail clearly and explain that the selected config was not accepted. Do not silently fallback to another model or auto mode.

### In-Session Model Switching
- **D-09:** If true hot switching is available, the model information box can be clicked open as a selector. If true hot switching is not available, the box is read-only and cannot be opened.
- **D-10:** Switching feedback belongs inside the same model information box: applying, applied, failed. Failed state can expose a short reason and retry.
- **D-11:** Disable switching while the agent is busy, thinking, or running tools. Show that switching is available once the session is idle.
- **D-12:** Do not insert model-switch success/failure events into the chat timeline. Keep the timeline clean and update only the model information box/status.

### Session List Status
- **D-13:** The session list should use compact status indicators, not model/effort text. Running and thinking use spinner-style icons. Waiting for input and waiting for approval both use one yellow dot. Error uses a red dot. Completed/unread result uses a green dot.
- **D-14:** Status labels should be visually hidden or available through hover/accessibility labels. Normal mobile list rows should show only the icon/dot unless an error needs a short visible hint.
- **D-15:** A completed session shows green only while the completed result is unread. After the user opens/views it, the indicator becomes gray.
- **D-16:** If input and approval are both pending, show one yellow dot. The UI does not need separate priority or stacked indicators.

### Claude's Discretion
- Researcher/planner should verify the real Cursor CLI model discovery and hot-switch behavior before choosing final API shape.
- Planner may choose the smallest code path that preserves the decisions above, especially around existing `Session` fields and strict SSE patches.

### Deferred Ideas (OUT OF SCOPE)
## Deferred Ideas

None - discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CURS-01 | User can discover available Cursor models from the local Cursor CLI before launch, with a clear failure state. | Cursor CLI exposes `agent models` and `agent --list-models`; installed CLI version `2026.05.20-2b5dd59` returned account-specific model IDs. [VERIFIED: local CLI] Official Cursor parameters docs list `--list-models` and `models`. [CITED: https://cursor.com/docs/cli/reference/parameters] |
| CURS-02 | User can start a Cursor session with selected model/effort and see those values persisted in session metadata. | HAPI already stores `model`, `model_reasoning_effort`, and `effort` on sessions and carries them through CLI create-session calls, hub store, shared schemas, and SSE patches. [VERIFIED: codebase] Cursor CLI supports launch-time `--model`. [CITED: https://cursor.com/docs/cli/reference/parameters] |
| CURS-03 | User can request an in-session model switch and see applied, pending, failed, or applies-next-run state backed by real CLI runtime behavior. | Cursor documents `/model` for interactive model set/list and prints "use --model <id> (or /model <id> in interactive mode) to switch"; HAPI currently lacks a local launcher stdin-control path and remote launcher spawns one headless process per queued batch, so the plan must represent true hot switch only if implemented and proven, otherwise "applies next run/turn". [CITED: https://cursor.com/docs/cli/reference/slash-commands] [VERIFIED: local CLI] [VERIFIED: codebase] |
| CURS-04 | User can scan session status, model, and effort from the mobile session list, updated live through strict patches. | Phase context revises this requirement: session list shows compact status indicators only; model/effort belongs near the chat input/model control. Strict `SessionPatchSchema` already carries `active`, `thinking`, `model`, `modelReasoningEffort`, `effort`, and `backgroundTaskCount`. [VERIFIED: codebase] [VERIFIED: phase context] |
</phase_requirements>

## Summary

Use the local Cursor CLI as the only model discovery source. The installed runtime provides both `agent models` and `agent --list-models`, and official Cursor docs list `models`, `--list-models`, and `--model`. [VERIFIED: local CLI] [CITED: https://cursor.com/docs/cli/reference/parameters] The planner should add a small CLI-side discovery RPC, a hub/web route, a short-lived web-facing cache, and a parser for the simple `id - label` output shape; it should not ship any static fallback model catalog. [VERIFIED: codebase]

HAPI already has most persistence and patch contract pieces: `SessionSchema` has `model`, `modelReasoningEffort`, and `effort`; SQLite stores those columns; `SessionPatchSchema` is strict and includes model/effort fields; `useSSE` merges strict session patches into detail and summary caches. [VERIFIED: codebase] The main planning risk is not storage, but runtime truthfulness: existing `set-session-config` RPC applies only permission mode, existing Cursor sessions keep `model` as a readonly constructor value, and no local launcher control path writes `/model` to the child process stdin. [VERIFIED: codebase]

**Primary recommendation:** implement model discovery and launch-time selection first, then expose in-session model changes as a discriminated runtime state: true hot switch only after a proven local `/model` control path exists; otherwise remote/headless changes should be reported as applies to the next spawned Cursor Agent run. [VERIFIED: codebase] [CITED: https://cursor.com/docs/cli/reference/slash-commands]

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Cursor model discovery | CLI / Runner | Hub API, Web selector | Only the local Cursor runtime knows account-specific available models; hub/web should request and cache, not invent. [VERIFIED: local CLI] |
| Launch-time model selection | CLI / Runner | Hub API, SQLite store, Web new-session UI | Runtime args are owned by the CLI runner; hub validates/routes; store persists selected values for session metadata and SSE. [VERIFIED: codebase] |
| In-session model switch state | CLI runtime adapter | Hub config service, Web composer status box | Whether a switch applies now is runtime behavior. Hub should persist only the result/status the CLI reports. [VERIFIED: codebase] |
| Mobile model/effort display | Web chat composer/status bar | Shared protocol, Hub SSE | Phase context assigns model/effort visibility to the chat input/model control, not session rows. [VERIFIED: phase context] |
| Session list attention status | Web session list | Shared session summary, Hub SSE | Session list already has `active`, `thinking`, `pendingRequestsCount`, and timestamps; compact indicator rendering belongs in UI. [VERIFIED: codebase] |

## Project Constraints (from .cursor/rules/)

- Use GitNexus MCP for code intelligence in this repo, pass `repo: "hapi-cursor"`, and use `query` before grep for unfamiliar code. GitNexus index was stale and `npx gitnexus analyze --skip-agents-md --skip-skills` failed with `Cannot destructure property 'package' of 'node.target' as it is null`, so this research treats graph output as approximate and relies on current source reads. [VERIFIED: .cursor/rules] [VERIFIED: shell]
- Run `impact` before editing any function/class/method symbol, and `detect_changes` before committing. This research only creates a planning doc and does not edit code symbols. [VERIFIED: .cursor/rules]
- Follow GSD workflow artifacts; direct repo edits outside GSD are disallowed unless the user bypasses it. This task is running inside a GSD phase-research workflow. [VERIFIED: .cursor/rules]
- TypeScript strict, Bun workspaces, shared protocol first, 4-space indentation, co-located tests, named exports, Zod at external boundaries, and `@/*` path aliases per package. [VERIFIED: AGENTS.md] [VERIFIED: .planning/codebase/STACK.md]
- Cursor-only, single-user, local-first over Tailscale, no backward compatibility requirement, and do not reintroduce prohibited non-Cursor agent/channel names in implementation. [VERIFIED: AGENTS.md] [VERIFIED: README.md]
- User-facing web strings should route through `useTranslation()`, not hardcoded literals. [VERIFIED: .planning/PROJECT.md conventions]

## Standard Stack

### Core

| Library / Runtime | Version | Purpose | Why Standard |
|-------------------|---------|---------|--------------|
| Cursor Agent CLI (`agent` / `cursor-agent`) | `2026.05.20-2b5dd59` | Discover models, launch sessions with `--model`, and provide interactive `/model`. | This is the trusted local runtime source required by D-01. [VERIFIED: local CLI] |
| Bun | `1.3.14` | Package manager, runtime, test runner for repo scripts. | Repo package manager and runtime target. [VERIFIED: package.json] [VERIFIED: shell] |
| TypeScript | `5.9.3` via `bunx tsc` | Strict compile-time contract across workspaces. | Existing repo standard. [VERIFIED: shell] |
| Zod | `^4.2.1` | Runtime validation for shared schemas, route bodies, and wire events. | Existing external-boundary validation library. [VERIFIED: package.json] |
| Hono | `^4.11.2` | Hub REST routes for discovery/config endpoints. | Existing hub HTTP framework. [VERIFIED: hub/package.json] |
| Socket.IO | `^4.8.3` | Hub/CLI RPC and session lifecycle transport. | Existing RPC path for web -> hub -> CLI requests. [VERIFIED: hub/package.json] [VERIFIED: cli/package.json] |
| React | `^19.2.3` | Mobile PWA UI. | Existing web stack. [VERIFIED: web/package.json] |
| TanStack Query | `^5.90.12` | Server-state cache invalidated/patched by SSE. | Existing web query/cache layer. [VERIFIED: web/package.json] |

### Supporting

| Library / Tool | Version | Purpose | When to Use |
|----------------|---------|---------|-------------|
| Vitest | `4.0.16` | CLI/web tests. | Use for `cli/` and `web/` co-located tests. [VERIFIED: package.json] [VERIFIED: shell] |
| Bun test | `1.3.14` | Hub/shared tests. | Use for `hub/` and shared protocol tests per repo rule. [VERIFIED: package.json] |
| Playwright | `1.49.1` | Future mobile E2E smoke. | Phase 1 can defer broad E2E to Phase 5, but status/model UI can add focused component tests now. [VERIFIED: package.json] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `agent models` / `agent --list-models` | Hardcoded model list | Violates D-01 and goes stale as Cursor account/model availability changes. [VERIFIED: phase context] [VERIFIED: local CLI] |
| Existing Socket.IO RPC gateway | Direct web shell execution | Direct shelling from web is not an existing security/architecture pattern; hub should route to CLI/machine RPC. [VERIFIED: codebase] |
| Existing `Session` fields | Separate web-only runtime state | Would bypass strict shared contract and reload/reconnect persistence. [VERIFIED: codebase] |

**Installation:** No new external packages are recommended for this phase. [VERIFIED: package.json]

**Version verification:** Existing dependency versions were verified from workspace `package.json` files and local commands (`bun --version`, `agent --version`, `bunx tsc --version`, `bunx vitest --version`). [VERIFIED: shell]

## Package Legitimacy Audit

No external package install is recommended for Phase 01, so the package legitimacy gate is not applicable. [VERIFIED: package.json]

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| None | n/a | n/a | n/a | n/a | n/a | No install |

**Packages removed due to slopcheck [SLOP] verdict:** none.
**Packages flagged as suspicious [SUS]:** none.

## Architecture Patterns

### System Architecture Diagram

```text
New Session Panel opens
    |
    v
Web discovery hook
    |
    v
Hub REST route: discover Cursor models
    |
    v
Machine/CLI RPC: run local Cursor model discovery
    |
    v
Cursor CLI: agent models / agent --list-models
    |
    v
Parse id + label + discovery status
    |
    v
Web selector cache
    |-- success/non-empty --> show raw model ids + labels
    |-- failure/empty ----> show safe reason + retry + auto/unspecified

Create session
    |
    v
Web sends selected model only if explicit
    |
    v
Hub /api/machines/:id/spawn
    |
    v
CLI runner buildCliArgs -> hapi cursor --model <id>
    |
    v
runCursor bootstrap -> /cli/sessions persists model/effort
    |
    v
Session alive/config updates -> strict SessionPatchSchema -> SSE -> Web cache
```

### Recommended Project Structure

```text
shared/src/
├── schemas.ts              # Cursor model discovery/config schemas if shared across cli/hub/web
└── types.ts                # Export shared types

cli/src/cursor/
├── modelDiscovery.ts       # Execute and parse Cursor model discovery
├── runCursor.ts            # Apply set-session-config truthfully
└── session.ts              # Mutable runtime model/effort state if supported

cli/src/api/
└── apiMachine.ts           # Register machine-level discovery RPC

hub/src/web/routes/
├── machines.ts             # Add machine-scoped model discovery route or dedicated runtime route
└── sessions/config.ts      # Return switch status, not just ok

web/src/components/NewSession/
├── ModelSelector.tsx       # Loading/error/retry/autounspecified states
└── index.tsx               # Trigger discovery on panel open

web/src/components/AssistantChat/
├── StatusBar.tsx           # Model info box near composer
└── useHappyComposerState.ts # Enable selector only when runtime support exists
```

### Pattern 1: Runtime Discovery via CLI RPC

**What:** Add a machine-level RPC from hub to CLI that runs `agent models` or `agent --list-models`, parses stdout into `{ id, label, isDefault?, isCurrent? }`, and returns a discriminated `{ status: 'ok' | 'error' }` result with safe errors. [VERIFIED: local CLI] [VERIFIED: codebase]

**When to use:** When the new-session panel opens and a selected machine is known. [VERIFIED: phase context]

**Example:**

```typescript
// Source: Cursor docs parameters + installed CLI output.
type CursorModelDiscoveryResult =
    | { status: 'ok'; models: Array<{ id: string; label: string; isDefault?: boolean; isCurrent?: boolean }>; discoveredAt: number }
    | { status: 'error'; reason: string; discoveredAt: number }
```

### Pattern 2: Explicit-Only Launch Config

**What:** Preserve `undefined` as "do not pass/persist an explicit runtime choice" and use `null` only for explicit clearing in session config APIs. Existing launch code already omits `--model` unless `options.model` exists. [VERIFIED: codebase]

**When to use:** New-session create flow and resumed session launch. [VERIFIED: phase context]

**Example:**

```typescript
// Existing pattern from web NewSession:
const resolvedModel = model !== 'auto' ? model : undefined
```

### Pattern 3: Truthful Switch State

**What:** Change model mutation responses from `{ ok: true }` to a status-bearing shape such as `{ status: 'applied' | 'pending' | 'failed' | 'applies-next-run'; model?: string | null; reason?: string }`. [VERIFIED: codebase]

**When to use:** In-session model changes near the composer. The UI can show "applied" only when CLI reports applied. [VERIFIED: phase context]

**Example:**

```typescript
// Source: Cursor slash command docs confirm /model exists; HAPI must still verify its own control path.
type CursorRuntimeConfigApplyResult =
    | { status: 'applied'; model: string | null }
    | { status: 'applies-next-run'; model: string | null }
    | { status: 'failed'; reason: string }
```

### Anti-Patterns to Avoid

- **Static model catalog:** violates D-01 and hides account-specific availability. [VERIFIED: phase context]
- **Silent fallback to auto:** violates D-08; if Cursor rejects a model, surface a clear launch failure. [VERIFIED: phase context]
- **Persist-before-runtime-ack for active sessions:** current `SyncEngineSession.applySessionConfig` correctly asks CLI first for active sessions; keep this invariant for model switching. [VERIFIED: codebase]
- **Chat timeline switch events:** D-12 explicitly keeps model switch feedback out of the chat timeline. [VERIFIED: phase context]
- **Session-list model text:** phase context corrects CURS-04; keep model/effort near composer, not on mobile list rows. [VERIFIED: phase context]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cursor model availability | Internal enum of model ids | `agent models` / `agent --list-models` discovery | Cursor account/model availability is runtime-owned and changes independently. [VERIFIED: local CLI] |
| Runtime validation | Ad hoc type checks spread through tiers | Zod schemas in `shared/` and route-local Zod bodies | Existing repo contract pattern and strict SSE event parsing already depend on Zod. [VERIFIED: codebase] |
| Session persistence | New browser-only store | Existing `Session` fields and SQLite columns | Reload, hub restart, and SSE reconnect depend on durable session fields. [VERIFIED: codebase] |
| Live patch transport | Polling session detail/list | Existing strict SSE patches and TanStack Query cache updates | `useSSE` already patches session details and summaries. [VERIFIED: codebase] |
| Hot switch UX state | Optimistic success toast only | Status-bearing config response from CLI/hub | Runtime support differs by local interactive vs remote/headless path. [VERIFIED: codebase] |

**Key insight:** The hard part is truthful runtime state, not storage. Storage and patches exist; the plan must add discovery and a statusful runtime apply contract. [VERIFIED: codebase]

## Common Pitfalls

### Pitfall 1: Treating `auto` as a Concrete Model

**What goes wrong:** HAPI persists or passes `auto` as a model id when the user did not choose a model. [VERIFIED: phase context]
**Why it happens:** Existing UI state uses string `'auto'`, while backend launch code treats `undefined` as unspecified. [VERIFIED: codebase]
**How to avoid:** Keep "auto/unspecified" as UI-only sentinel and pass `undefined` at launch. [VERIFIED: codebase]
**Warning signs:** SQLite session row has `model = 'auto'` for a default launch. [VERIFIED: codebase]

### Pitfall 2: Enabling Effort Controls Without Runtime Proof

**What goes wrong:** UI offers effort choices that Cursor does not support or that are already encoded into model ids. [VERIFIED: local CLI]
**Why it happens:** The discovered model ids include effort-like suffixes such as `-low`, `-medium`, `-high`, `-xhigh`, but the installed CLI help did not expose a separate `--effort` flag. [VERIFIED: local CLI]
**How to avoid:** Keep separate effort controls hidden unless Cursor discovery/runtime behavior confirms a separate capability. [VERIFIED: phase context]
**Warning signs:** Planner adds hardcoded effort dropdown options. [VERIFIED: phase context]

### Pitfall 3: Claiming Hot Switch When HAPI Can Only Apply Next Run

**What goes wrong:** Web says "applied" but the active Cursor process still uses the old model. [VERIFIED: codebase]
**Why it happens:** Current `set-session-config` RPC only applies permission mode; `CursorSession.model` is readonly and remote launcher builds args from `session.model` for each spawned process. [VERIFIED: codebase]
**How to avoid:** Return `applies-next-run` for remote/headless until mutable runtime model state is implemented, and keep local hot switch read-only unless HAPI can inject `/model` into interactive Cursor safely. [VERIFIED: codebase] [CITED: https://cursor.com/docs/cli/reference/slash-commands]
**Warning signs:** `SessionConfigService` stores a model for an active session without checking the CLI response. [VERIFIED: codebase]

### Pitfall 4: Breaking Strict SSE Patches

**What goes wrong:** New patch fields are emitted without updating `SessionPatchSchema`, causing web to drop malformed events. [VERIFIED: codebase]
**Why it happens:** `useSSE` parses all events with `SyncEventSchema.safeParse`. [VERIFIED: codebase]
**How to avoid:** Add any new switch-status fields to shared schemas first, then update CLI/hub/web atomically. [VERIFIED: codebase]
**Warning signs:** Console logs `[useSSE] dropped malformed event`. [VERIFIED: codebase]

### Pitfall 5: Showing Raw Stderr in Mobile UI

**What goes wrong:** Discovery failure leaks noisy logs, paths, tokens, or account details. [VERIFIED: phase context]
**Why it happens:** CLI command failures often include raw stderr. [ASSUMED]
**How to avoid:** CLI/hub should log detail locally and return short safe categories such as `cursor-cli-unavailable`, `not-authenticated`, `timed-out`, or `empty-model-list`. [VERIFIED: phase context]
**Warning signs:** Mobile selector prints full command output. [VERIFIED: phase context]

## Code Examples

Verified patterns from official/local sources:

### Cursor Model Discovery Command

```bash
# Source: https://cursor.com/docs/cli/reference/parameters and local CLI 2026.05.20-2b5dd59
agent models
agent --list-models
```

### Cursor Launch-Time Model Selection

```bash
# Source: https://cursor.com/docs/cli/reference/parameters
agent --model gpt-5.2
```

### Cursor Interactive Model Switch

```text
# Source: https://cursor.com/docs/cli/reference/slash-commands
/model <model-id>
```

### Existing HAPI Spawn Args Pattern

```typescript
// Source: cli/src/runner/run.ts
if (options.model) {
    args.push('--model', options.model);
}
```

### Existing Strict Patch Pattern

```typescript
// Source: shared/src/schemas.ts
export const SessionPatchSchema = z.object({
    active: z.boolean().optional(),
    thinking: z.boolean().optional(),
    model: z.string().nullable().optional(),
    modelReasoningEffort: z.string().nullable().optional(),
    effort: z.string().nullable().optional()
}).strict()
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hardcoded or absent model choices in HAPI new-session UI | Runtime discovery from Cursor CLI via `agent models` / `--list-models` | Phase 01 planned | Prevents stale model lists and supports account-specific availability. [VERIFIED: local CLI] |
| Launch-only model arg | Cursor also documents interactive `/model` | Current Cursor docs | Enables possible true local hot switch, but HAPI still needs a control path to use it. [CITED: https://cursor.com/docs/cli/reference/slash-commands] |
| Session list model/effort display in original roadmap wording | Model/effort near composer; session list compact status only | Phase discussion | Planner must follow context over earlier CURS-04 wording. [VERIFIED: phase context] |

**Deprecated/outdated:**
- Static `MODEL_OPTIONS.cursor = []` as final UX: it is acceptable as current placeholder, but Phase 01 should replace it with runtime discovery. [VERIFIED: codebase]
- Boolean `{ ok: true }` for model apply: insufficient for CURS-03 because the user needs applied/pending/failed/applies-next-run state. [VERIFIED: codebase] [VERIFIED: requirements]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | CLI discovery failures may include raw stderr with noisy local details. | Common Pitfalls | If wrong, safe error mapping is still harmless; if right and ignored, UI may leak sensitive or confusing output. |

## Open Questions — RESOLVED

1. **RESOLVED: Should model discovery be machine-scoped or session-scoped?**
   - What we know: New-session discovery runs before a session exists and requires a selected machine/runner. [VERIFIED: phase context] [VERIFIED: codebase]
   - Resolution: For Phase 01, implement machine-scoped discovery through the runner/CLI machine RPC and keep session-scoped discovery out of scope. Future local terminal discovery is not required by this phase because discovery is triggered from the new-session panel before a session exists. [VERIFIED: phase context] [VERIFIED: codebase]

2. **RESOLVED: Can HAPI safely inject `/model <id>` into local interactive Cursor?**
   - What we know: Cursor documents `/model`; HAPI local launcher currently spawns `agent` under terminal guard and does not retain a child stdin writer for RPC control. [CITED: https://cursor.com/docs/cli/reference/slash-commands] [VERIFIED: codebase]
   - Resolution: Phase 01 must not claim true local hot switching. Unless the executor finds and proves an existing robust child-stdin/PTY control path while implementing the plan, the UI presents switching as unavailable/read-only or applies-next-run according to runtime response. [VERIFIED: codebase] [VERIFIED: phase context]

3. **RESOLVED: How should separate effort be represented?**
   - What we know: Installed CLI exposes many effort-like model ids but no separate `--effort` flag in help. [VERIFIED: local CLI]
   - Resolution: Treat separate effort as unsupported unless discovery or verified runtime behavior exposes it as a real capability. Phase 01 must not add a free-standing effort selector or hardcoded effort options; display effort only when it exists in session metadata or verified runtime output. [VERIFIED: local CLI] [VERIFIED: phase context]

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Bun | Typecheck/tests/scripts | yes | 1.3.14 | Blocking if missing. [VERIFIED: shell] |
| Node.js | Tooling and `bunx` wrappers | yes | v20.18.2 | Use Bun for project commands where possible. [VERIFIED: shell] |
| Cursor Agent CLI `agent` | Model discovery and runtime launch | yes | 2026.05.20-2b5dd59 | `cursor-agent` symlink/binary also available. [VERIFIED: shell] |
| Cursor Agent CLI `cursor-agent` | Alternate binary name from README prerequisite | yes | 2026.05.20-2b5dd59 | Use `agent` because current code spawns `agent`. [VERIFIED: shell] [VERIFIED: codebase] |
| TypeScript compiler | Typecheck | yes | 5.9.3 | Blocking if missing. [VERIFIED: shell] |
| Vitest | CLI/web tests | yes | 4.0.16 | Blocking for CLI/web test tasks. [VERIFIED: shell] |

**Missing dependencies with no fallback:** none found for research and planning. [VERIFIED: shell]

**Missing dependencies with fallback:** none found. [VERIFIED: shell]

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.16 for CLI/web; Bun test for hub/shared. [VERIFIED: package.json] |
| Config file | `web/vitest.config.ts`; CLI uses Vitest defaults; hub uses Bun test. [VERIFIED: file scan] |
| Quick run command | `bun run typecheck` plus targeted package tests. [VERIFIED: package.json] |
| Full suite command | `bun run test` and `bun run madge:check`. [VERIFIED: package.json] |

### Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| CURS-01 | Discovery returns parsed model list or safe failure state | CLI unit + hub route + web component | `cd cli && bun run test -- cursorModelDiscovery` then targeted hub/web tests after files exist | No, Wave 0 needed. [VERIFIED: file scan] |
| CURS-02 | Explicit model passes through spawn, CLI create-session, store, session metadata, and SSE | Existing tests plus additions | `cd cli && bun run test -- buildCliArgs sessionFactory` and `cd hub && bun test sessionConfigService` | Partial. [VERIFIED: file scan] |
| CURS-03 | Active switch returns applied/failed/applies-next-run truthfully and UI shows status without timeline events | CLI unit + hub route + web component | Target new tests around `runCursor`, `sessions/config`, `SessionChat` | Partial, but status shape missing. [VERIFIED: codebase] |
| CURS-04 | Session list status indicators update live from strict patches; model/effort stays near composer | Web component + SSE hook | `cd web && bun run test -- useSSE SessionListItem HappyComposer` | Partial. [VERIFIED: file scan] |

### Sampling Rate

- **Per task commit:** targeted package test for touched package plus `bun run typecheck`. [VERIFIED: package.json]
- **Per wave merge:** `bun run test` and `bun run madge:check`. [VERIFIED: package.json]
- **Phase gate:** `bun run typecheck`, `bun run test`, `bun run madge:check`, and `bash scripts/check-no-cut-agents.sh`. [VERIFIED: AGENTS.md]

### Wave 0 Gaps

- [ ] `cli/src/cursor/modelDiscovery.ts` and `cli/src/cursor/modelDiscovery.test.ts` — covers CURS-01 parser, timeout, empty list, safe error mapping. [VERIFIED: file scan]
- [ ] Hub model discovery route/RPC tests — covers CURS-01 request path and failure shape. [VERIFIED: file scan]
- [ ] `web/src/components/NewSession/ModelSelector.test.tsx` — covers loading/error/retry/auto states. [VERIFIED: file scan]
- [ ] `hub/src/web/routes/sessions/__tests__/config.test.ts` updates — covers status-bearing model switch responses for CURS-03. Existing config tests exist but current route returns `{ ok: true }`. [VERIFIED: codebase]
- [ ] `web/src/components/SessionList/SessionListItem.test.tsx` updates — covers compact status indicators and no model text in list rows. [VERIFIED: codebase]

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|------------------|
| V2 Authentication | yes | Existing JWT web auth and CLI token auth; do not add anonymous discovery endpoints. [VERIFIED: codebase] |
| V3 Session Management | yes | Existing session IDs and active-session guards; active config changes must go through `withActiveSession`/engine. [VERIFIED: codebase] |
| V4 Access Control | yes | Machine discovery/spawn must remain scoped to authenticated web user and online machine; no global shell endpoint. [VERIFIED: codebase] |
| V5 Input Validation | yes | Zod route schemas and shared Zod wire schemas. [VERIFIED: codebase] |
| V6 Cryptography | no new crypto | Existing token/JWT mechanisms only; no new crypto needed. [VERIFIED: codebase] |

### Known Threat Patterns for HAPI Cursor Runtime Config

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Command injection through model id | Tampering / Elevation | Use `spawn`/argument arrays, validate discovered ids, never shell-concatenate model values. Existing code uses argument arrays for Cursor launch. [VERIFIED: codebase] |
| Raw stderr leakage to mobile | Information Disclosure | Return short safe reason to web; log detailed stderr locally only. [VERIFIED: phase context] |
| Unauthorized model discovery | Information Disclosure | Protect discovery route with existing web auth and machine scoping. [VERIFIED: codebase] |
| False applied state | Repudiation / Integrity | Persist active-session config only after CLI returns status-bearing result. [VERIFIED: codebase] |
| Stale SSE fields dropped | Integrity | Update shared schema before emitting new strict patch fields. [VERIFIED: codebase] |

## Sources

### Primary (HIGH confidence)

- `https://cursor.com/docs/cli/reference/parameters` - verified `--model`, `--list-models`, and `models` command. [CITED: https://cursor.com/docs/cli/reference/parameters]
- `https://cursor.com/docs/cli/reference/slash-commands` - verified `/model` command. [CITED: https://cursor.com/docs/cli/reference/slash-commands]
- Installed Cursor Agent CLI `2026.05.20-2b5dd59` - verified `agent --help`, `cursor-agent --help`, `agent models`, and `agent --list-models`. [VERIFIED: local CLI]
- Current source files: `shared/src/schemas.ts`, `shared/src/sessionSummary.ts`, `hub/src/sync/sessionConfigService.ts`, `hub/src/sync/syncEngineSession.ts`, `hub/src/web/routes/machines.ts`, `hub/src/web/routes/sessions/config.ts`, `cli/src/cursor/runCursor.ts`, `cli/src/cursor/cursorLocal.ts`, `cli/src/cursor/cursorRemoteLauncher.ts`, `cli/src/runner/run.ts`, `web/src/hooks/useSSE.ts`, `web/src/components/NewSession/index.tsx`, `web/src/components/NewSession/ModelSelector.tsx`, `web/src/components/AssistantChat/useHappyComposerState.ts`. [VERIFIED: codebase]
- `.planning/phases/01-cursor-runtime-config-contract/01-CONTEXT.md` - locked phase decisions and CURS-04 correction. [VERIFIED: phase context]

### Secondary (MEDIUM confidence)

- Cursor docs search snippets from `cursor.com/docs/cli/overview` and `cursor.com/docs/cli/using` corroborated mode and non-interactive CLI behavior; direct overview fetch timed out, using fetched `using` page plus parameter/slash reference as authoritative sources. [CITED: https://cursor.com/docs/cli/using]

### Tertiary (LOW confidence)

- Assumption that raw Cursor discovery failures may include sensitive/noisy stderr; no failure was induced during research. [ASSUMED]

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - verified from workspace manifests, installed tools, and official Cursor docs. [VERIFIED: package.json] [VERIFIED: shell] [CITED: https://cursor.com/docs/cli/reference/parameters]
- Architecture: HIGH - existing HAPI flows read directly from source; GitNexus was stale and not used as authority. [VERIFIED: codebase]
- Pitfalls: MEDIUM - storage/SSE/runtime pitfalls are verified; stderr-leak detail is assumed as a conservative security posture. [VERIFIED: codebase] [ASSUMED]

**Research date:** 2026-05-23
**Valid until:** 2026-06-22 for HAPI architecture; 2026-05-30 for Cursor CLI runtime behavior because Cursor model and slash-command surfaces may change quickly.
