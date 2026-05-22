# Phase 7: Wire contracts unification & SSE patch contract — Research

**Researched:** 2026-05-22
**Domain:** Wire-protocol consolidation (Zod schemas + SSE event contract) across `shared/`, `cli/`, `hub/`, `web/`
**Confidence:** HIGH (all findings empirically verified via direct file read + grep over the four source trees)

<user_constraints>
## User Constraints (from 07-CONTEXT.md)

### Locked Decisions

- **D-111**: `Machine + MachineMetadata + RunnerState` lift to `shared/src/schemas.ts`; cli + web + hub `machineCache.ts` become re-exports (zero duplicate declarations).
- **D-112**: Message wire (`MessageMetaSchema / UserMessageSchema / AgentMessageSchema / MessageContentSchema`) lifts to `shared/`; cli re-exports. Researcher picks `schemas.ts` vs `messages.ts` placement.
- **D-113**: cli `CreateSessionResponseSchema` inline shape (with `metadata: z.unknown().nullable()` / `agentState: z.unknown().nullable()`) narrows to `z.object({ session: SessionSchema })`.
- **D-114**: `SessionsResponse / SessionResponse / MessagesResponse / MachinesResponse / SpawnResponse` lift to `shared/`. Phase 7 covers stable wrappers only; non-stable (git / file-search / list-directory / upload) stay until Phase 8/9.
- **D-115**: `RunnerState.status` / `shutdownSource` keep the loose `z.union([z.enum, z.string])` shape; narrow to pure enum is **Phase 10**.
- **D-116**: Strict patch-schema path chosen over full-payload broadcasts. Parse failure on web = `console.error` + drop (no refetch fallback). SQLite legacy-data fallout (old `'codex'` messages, old `flavor` metadata) is **Phase 10** schema-version reject.
- **D-117**: `SessionPatchSchema` = strict object, every field optional. Field set covers `active`, `activeAt`, `thinking`, `updatedAt`, `permissionMode`, `model`, `modelReasoningEffort`, `effort`, `backgroundTaskCount` (researcher must close the exhaustive enumeration — see §1 below).
- **D-118**: `MachinePatchSchema` = strict object, currently only `active: literal(false)` + optional `activeAt`. Researcher confirms hub does not emit other partial machine shapes (see §1 below).
- **D-119**: `SyncEventSchema` `data` field narrows from `z.unknown().optional()` to a discriminated union: `session-added` = `SessionSchema` only; `session-updated` = `SessionSchema | SessionPatchSchema`; `machine-updated` = `MachineSchema | MachinePatchSchema | z.null()`.
- **D-120**: useSSE parse failure = `console.error` + drop. No call to `queueSessionListInvalidation` / `queueSessionDetailInvalidation` / `queueMachinesInvalidation` on the schema-success path.
- **D-121**: Delete 7 narrow functions in `web/src/hooks/useSSE.ts` (`hasUnknownSessionPatchKeys`, `getSessionPatch`, `isSessionRecord`, `isMachineRecord`, `isInactiveMachinePatch`, `isMachineMetadata`, `hasRecordShape`) and the local `SessionPatch` type. Replace with `SyncEventSchema.safeParse` + discriminator branches. Cache mutators stay; their parameter type comes from the shared schema.
- **D-122**: Delete `MetadataSchema.flavor` field (shared); delete all flavor writes (cli) and all flavor reads (hub display / web display / hub routing).
- **D-123**: `AGENT_MESSAGE_PAYLOAD_TYPE` flips from `'codex' as const` to `'cursor' as const`. JSDoc "wire-protocol legacy literal — owned by Phase 7" anchor removed. Constant consumers do not change (the value changes, the import does not).
- **D-124**: `scripts/check-no-cut-agents.sh` loses the `AGENT_MESSAGE_PAYLOAD_TYPE` line-anchored post-filter and the Phase-5 territory `'codex'` whitelist. `'codex'` becomes zero-tolerance across `cli/src/ hub/src/ web/src/ shared/src/`.
- **D-125**: 4 slices (shared lift → hub broadcast/flavor → cli+web collapse + useSSE rewrite → guard tighten + contract test). Each slice gated by `bun typecheck` + `bun run test` green.
- **D-126**: ripgrep zero-tolerance keyword set (`hasUnknownSessionPatchKeys`, `getSessionPatch` in `web/src/hooks/`, `interface Machine\b` in `cli/src/ web/src/`, `^export type Machine =` in `cli/src/ web/src/ hub/src/`, `RunnerStateSchema` / `MachineMetadataSchema` in `cli/src/ web/src/`, `'codex'` everywhere, `flavor:` writes everywhere).
- **D-127**: 3 test classes — shared schema strict-reject unit tests, `web/src/hooks/useSSE.test.tsx` (new file) strictly typed event stream, hub broadcast contract test (every `publisher.emit` payload passes `SyncEventSchema.parse`).
- **D-128**: No `build:single-exe`. No new madge sweep. Existing `madge --circular cli/src/cursor` (Phase 6) stays.

### Claude's Discretion

- Placement of new schemas (`schemas.ts` vs new file vs `messages.ts`) — researcher chose `shared/src/schemas.ts` (single point + co-location with `SessionSchema` / `SyncEventSchema`); `messages.ts` is utilities, not schemas. See §1.
- `SessionPatchSchema` written as `.strict().partial()` vs explicit `.optional()` — researcher recommends **explicit `.optional()`** (lets tests assert individual `.shape.backgroundTaskCount`).
- `session-added.data` strict-required-full vs union — researcher recommends **strict full**: hub `refreshSession` (sessionCache.ts:139) is the only `session-added` emitter and always passes a full Session.
- useSSE parse failure: dev `console.error` only + drop (recommended); `onError` callback wiring stays Phase 11 (REFT-02 reconnect tests own that surface).
- `eventPublisher.emit` dev-mode `SyncEventSchema.parse` self-check — recommended (catches "hub schema drift vs web schema upgrade" silently). Production skips the parse cost.
- `RunnerState.status` / `shutdownSource` narrow — researcher recommends **leave as-is** for Phase 10 (D-115 stands); no cli call-site evidence justifies an opportunistic narrow.

### Deferred Ideas (OUT OF SCOPE)

- All REFH-01…04 (Hub internal decoupling) → Phase 8.
- REFW-01/02/03 (Web internal decoupling) → Phase 9.
- REFC-01/02 (SQLite migration deletion + schema-version reject + readonly config) → Phase 10.
- REFT-01/02/03 (test gaps incl. SSE reconnect invariant) → Phase 11.
- README / AGENTS / docs / website prose `'codex'` mentions → Phase 12 (CUT-12).
- CURS-01…05 (v2 Cursor capabilities) → Milestone 2; do not pre-reserve schema fields.
- Hub route file restructure (`sessions.ts` split) → Phase 8 REFH-03. Phase 7 only lifts the response wrappers.

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| REFA-03 | `shared/` is the only wire-contract source — `Session / Machine / Message / RunnerState` DTOs + Zod schemas live there; cli / hub / web local mirrors all deleted | §2 (duplicate inventory), §3 (response wrappers), §4 (placement decision) |
| REFA-04 | SSE patch contract strictified — `hasUnknownSessionPatchKeys()` heuristic refetch is removed; SSE emits full-or-strict-patch only | §1 (publisher.emit field enumeration), §5 (`session-added` strict-full recommendation), §6 (useSSE rewrite), §10 (validation architecture) |

</phase_requirements>

## Summary

Phase 7 is a wire-contract collapse phase. The codebase already has a clean shared base (`SessionSchema`, `SyncEventSchema` discriminated union, `AgentStateSchema`, `MetadataSchema`, `TodosSchema`, `TeamStateSchema`, `DecryptedMessageSchema`) in `shared/src/schemas.ts`; what remains are: (a) three parallel `Machine` / `RunnerState` / `MachineMetadata` declarations across cli + web + hub, (b) cli-local Message wire schemas, (c) two `unknown`-typed fields inside `SyncEventSchema` that force web to use 7 hand-rolled type-guards plus a known-buggy heuristic refetch, (d) one `'codex'` survivor at `shared/src/modes.ts:9`, and (e) one `flavor: z.string().nullish()` survivor at `shared/src/schemas.ts:49`.

The empirical enumeration of every `publisher.emit({...})` in hub confirms `SessionPatchSchema` needs exactly 9 fields and `MachinePatchSchema` needs at most 2 (`active`, optional `activeAt`). The `session-added` channel is always full-payload (only one emitter — `sessionCache.refreshSession` line 139); the discrimination between full and patch on `session-updated` is therefore a `'metadata' in data` check or an `id in data` check that the discriminated union encodes naturally.

The `'codex'` rename has zero ripple: the only source-tree literal is the constant declaration itself (`shared/src/modes.ts:9`); all consumers already import `AGENT_MESSAGE_PAYLOAD_TYPE`. The `flavor` field removal has wide ripple but mostly deletion paths — 9 reader sites + 3 writer sites across cli/hub/web/shared.

**Primary recommendation:** Execute the 4-slice plan exactly as scoped in D-125. Slice 1 in `shared/` is the largest single-package patch but the cleanest (no cross-package coupling). Slices 2–3 are TypeScript-error-driven (narrow the wire types → compiler enumerates collapse sites). Slice 4 is purely script + JSDoc + last test.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Wire schema definition | `shared/` (Zod source of truth) | — | Single point; cli / hub / web import |
| Hub → Web SSE event emission | `hub/src/sync/{sessionCache,machineCache,messageService}.ts` via `eventPublisher.emit` | `hub/src/sse/sseManager.broadcast` | Cache mutators produce events; SSE manager is transport |
| Web SSE event consumption + cache mutation | `web/src/hooks/useSSE.ts::handleSyncEvent` | `web/src/lib/message-window-store.ts` (message ingestion side) | Sole consumer; TanStack Query cache mutators stay local |
| Hub `metadata.flavor` write | `cli/src/agent/sessionFactory.ts::buildSessionMetadata` | `cli/src/cursor/runCursor.ts` (pass-through) | CLI is the metadata producer; hub never writes `flavor` directly |
| Hub `metadata.flavor` read (routing) | `hub/src/web/routes/{sessions,permissions}.ts` (`?? 'cursor'` fallback) | `hub/src/sync/syncEngine.ts::resolveFlavor / resolveLocalResumeTarget` | Hub reads only for permission / resume routing; after D-122 these collapse to the constant `'cursor'` |
| Hub `metadata.flavor` read (display) | `hub/src/notifications/sessionInfo.ts::getAgentName` | — | Push-notification label; collapses to fixed string `'Cursor'` post-D-122 |
| Web `metadata.flavor` read (display) | `web/src/components/{SessionList,SessionHeader,SessionChat}.tsx`, `web/src/router.tsx` | — | UI icon + agent type label; collapses to single-Cursor presentation |
| Hub broadcast contract validation | `hub/src/sse/sseManager.test.ts` or `hub/src/sync/sessionCache.test.ts` (new `SyncEventSchema.parse` assertion) | — | Contract test guards against schema-drift between hub emits and web schema |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `zod` | ^4.2.1 (verified `shared/package.json`, `hub/package.json`) | Schema + type derivation | Already the wire-contract substrate across all three packages [VERIFIED: shared/package.json] |
| `@tanstack/react-query` | ^5.90.12 (verified `web/package.json`) | Cache + query invalidation in useSSE | Existing; not changing in Phase 7 [VERIFIED: web/package.json] |
| `bun` test runner | workspace-native | Unit + integration tests | Phase 1–6 toolchain; `bun typecheck && bun run test` is the slice gate [VERIFIED: prior phase summaries] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `EventSource` (browser-native) | n/a | SSE consumer in `useSSE` | Mocked in Vitest/Bun test for the new `useSSE.test.tsx` |
| `@testing-library/react` (existing in web/) | check `web/package.json` | useSSE hook unit test harness | New `useSSE.test.tsx` |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Strict patch schema (D-116 / D-117) | Full payload broadcast on every change | Saves no code, adds bandwidth — rejected by D-116 |
| `.strict().partial()` for `SessionPatchSchema` | Explicit `.optional()` per field | Semantically equivalent; explicit form lets `schema.shape.backgroundTaskCount.isOptional()` assertions work — recommended |
| Lift Message wire to `shared/src/messages.ts` | Lift to `shared/src/schemas.ts` | `messages.ts` is utilities (`isObject`, `isAgentChatVisibleMessage`); mixing Zod schemas there confuses concerns. Recommend `schemas.ts` |

**Installation:** No new dependencies. All work is pure refactor within existing zod/react-query/bun-test infrastructure.

**Version verification:** Verified via direct file read:

```bash
shared/package.json → zod ^4.2.1
hub/package.json    → zod ^4.2.1
web/package.json    → @tanstack/react-query ^5.90.12
```

## Package Legitimacy Audit

Phase 7 installs **no new packages**. No legitimacy audit required.

## Architecture Patterns

### System Architecture Diagram

```
[CLI session writes message wire] ──┐
                                     │
                                     ▼
                          hub/src/store (SQLite)
                                     │
                                     ▼
        ┌────────────────────────────────────────────────────┐
        │ hub/src/sync (sessionCache, machineCache,          │
        │              messageService)                       │
        │   .publisher.emit({type, ..., data})  ←─── Phase 7 │
        │                                          schema    │
        │                                          alignment │
        └────────────────────────────────────────────────────┘
                                     │
                                     ▼
                      eventPublisher.emit ──→ listeners
                                              + sseManager.broadcast
                                                       │
                                                       ▼
                                       (Web client EventSource)
                                                       │
                                                       ▼
        ┌────────────────────────────────────────────────────┐
        │ web/src/hooks/useSSE.ts::handleSyncEvent           │
        │   SyncEventSchema.safeParse(parsed)  ←──── Phase 7 │
        │     ├── parse OK → discriminator branch:           │
        │     │     session-added → upsertSummary + setDetail│
        │     │     session-updated, full → upsert + set     │
        │     │     session-updated, patch → patchSummary +  │
        │     │                              patchDetail     │
        │     │     session-removed → remove                 │
        │     │     machine-updated, full → upsertMachine    │
        │     │     machine-updated, patch/null → remove     │
        │     │     messages-* / heartbeat / connection /    │
        │     │     toast → existing behaviour               │
        │     └── parse FAIL → console.error + drop          │
        │                       (NO refetch — D-120)         │
        └────────────────────────────────────────────────────┘
                                     │
                                     ▼
                    TanStack Query cache mutations
                    (no invalidate on schema-success path)
```

Component-to-implementation mapping:

| Conceptual node | Implementation file(s) | Phase 7 change |
|-----------------|------------------------|----------------|
| Wire schema source | `shared/src/schemas.ts` (+ `shared/src/types.ts` re-exports) | Add `MachineSchema`, `MachineMetadataSchema`, `RunnerStateSchema`, `SessionPatchSchema`, `MachinePatchSchema`, Message wire schemas; tighten `SyncEventSchema.data`; remove `MetadataSchema.flavor`; remove `SessionSummaryMetadata.flavor` |
| Wire-tag constant | `shared/src/modes.ts:9` | Flip `'codex'` → `'cursor'`; rewrite JSDoc |
| Session emit producer | `hub/src/sync/sessionCache.ts` | Conform 13 `publisher.emit` sites to new schema; remove flavor writes (none in this file; lives in cli sessionFactory) |
| Machine emit producer | `hub/src/sync/machineCache.ts` | Replace local `interface Machine` + local metadata schema with shared re-export; conform 4 `publisher.emit` sites |
| Session emit consumer | `web/src/hooks/useSSE.ts` | Delete 7 narrow functions + `SessionPatch` local type; rewrite `handleSyncEvent` to `SyncEventSchema.safeParse` + discriminator |
| Hub HTTP wrappers | `hub/src/web/routes/sessions.ts` etc. | Routes return inline objects today (no named type) — no hub edits; web `web/src/types/api.ts` will re-export shared wrappers |

### Recommended Project Structure

No new directories. Files touched:

```
shared/src/
├── schemas.ts          # +MachineSchema, +MachineMetadataSchema,
│                       #   +RunnerStateSchema, +SessionPatchSchema,
│                       #   +MachinePatchSchema, +Message wire schemas;
│                       #   tighten SyncEventSchema.data; remove
│                       #   MetadataSchema.flavor
├── modes.ts            # AGENT_MESSAGE_PAYLOAD_TYPE = 'cursor' as const;
│                       #   rewrite JSDoc
├── sessionSummary.ts   # Remove SessionSummaryMetadata.flavor and the
│                       #   `flavor: session.metadata.flavor ?? null` copy
├── types.ts            # Add exports for the new schemas/types
├── schemas.test.ts     # NEW or extend flavors.test.ts (D-127#1)
└── responses.ts        # NEW — SessionsResponse, SessionResponse,
                          MessagesResponse, MachinesResponse,
                          SpawnResponse (D-114)
```

(Alternative for response wrappers: put inline in `schemas.ts` to avoid file proliferation; researcher leans `responses.ts` because they are pure type aliases, not Zod schemas, so a dedicated file matches the existing `sessionSummary.ts` precedent.)

### Pattern 1: Discriminated-union narrowing

**What:** Tighten an existing `z.unknown()` field inside an already-discriminated union to a sub-union, then let TypeScript drive the consumer collapse.

**When to use:** Whenever the wire layer carries `z.unknown` and the consumer has hand-rolled type-guards (the useSSE-style anti-pattern).

**Example:**

```typescript
// shared/src/schemas.ts (after Phase 7)
const SessionEventBase = SessionChangedSchema.extend({ data: SessionSchema })
const SessionPatchEvent = SessionChangedSchema.extend({ data: SessionPatchSchema })

export const SyncEventSchema = z.discriminatedUnion('type', [
    SessionChangedSchema.extend({
        type: z.literal('session-added'),
        data: SessionSchema             // strict full (recommended, §5 below)
    }),
    SessionChangedSchema.extend({
        type: z.literal('session-updated'),
        data: z.union([SessionSchema, SessionPatchSchema])
    }),
    // ... other variants unchanged
])
```

### Pattern 2: Schema-derived parameter type

**What:** Replace ad-hoc `type SessionPatch = Partial<Pick<Session, ...>>` with `z.infer<typeof SessionPatchSchema>`.

```typescript
// web/src/hooks/useSSE.ts (after Phase 7)
import { SyncEventSchema, type SessionPatch } from '@hapi/protocol/schemas'

const patchSessionSummary = (sessionId: string, patch: SessionPatch): boolean => { ... }
```

### Anti-Patterns to Avoid

- **Hand-rolled narrow functions on `unknown`:** `isSessionRecord`, `hasUnknownSessionPatchKeys`, etc. The whole point of Phase 7 is to delete these and use `safeParse`.
- **`.passthrough()` on patch schemas:** Defeats the strict-reject behaviour D-117/D-118 rely on.
- **Fallback to refetch on parse failure:** Violates D-120; converts a contract bug into hidden tail-latency.
- **Re-introducing `data: z.unknown()` to dodge a strict-reject in the hub:** Slice 2 contract test guards against this.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Patch vs full discrimination | Heuristic key-set diff (`hasUnknownSessionPatchKeys`) | `z.union([SessionSchema, SessionPatchSchema])` inside `SyncEventSchema` + `.safeParse` | Heuristic misses fields silently (e.g. `backgroundTaskCount` today triggers full-list refetch every emit) |
| EventSource mocking in test | Real-`EventSource` integration test | Inline `EventSource` shim (existing web test infra has it; verify in Wave 0) | Faster, no network |
| Strict-reject behaviour | `.refine(data => !('unknownKey' in data))` | `z.object({...}).strict()` | Zod's `.strict()` is the canonical primitive for this; refinements are weaker and slower |

**Key insight:** All Phase 7 mechanics are vanilla Zod-4 features. No library work, only refactor.

## Runtime State Inventory

> Phase 7 is a wire-contract rename + collapse phase. SQLite already holds artifacts of the old contract.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | (a) SQLite `messages.content` rows where `content.type === 'codex'` (every cursor agent message ever stored) — will be rejected by the post-D-123 discriminator. (b) SQLite `sessions.metadata` rows containing `flavor: 'cursor'` (or any historical non-cursor value) | **None this phase.** Accepted as Phase 10 schema-version reject fallback per D-116 / D-123. PLAN.md must document the user-visible behaviour: existing DB rows fail to decode after `bun start`; user wipes `~/.happy/db.sqlite` (or equivalent) and reconnects. |
| Live service config | None — hub is the only live service; its config does not embed `'codex'` or `flavor` values | None |
| OS-registered state | None — no Task Scheduler / launchd / systemd / pm2 names depend on `flavor` or `'codex'` | None |
| Secrets/env vars | None — no env var name carries `flavor` or `'codex'` | None |
| Build artifacts | None — pure source rename + schema change; no compiled artifact cached outside Bun's incremental output | None (Bun rebuilds on next `bun typecheck`) |

**Important nuance:** `MetadataSchema` (shared/src/schemas.ts:27) is a plain `z.object()`, **not** `.strict()`. Zod-4 default behaviour is *strip unknown keys*, not reject. So old SQLite rows containing `flavor: 'cursor'` will be silently stripped on parse — **no decode failure**. The only decode-failure category that Phase 10 must cover is `messages.content.type === 'codex'` (discriminator literal mismatch). PLAN.md should call this out explicitly so the team doesn't pre-emptively migrate `metadata.flavor` data — it self-cleans on next write.

## Common Pitfalls

### Pitfall 1: `MetadataSchema` not made `.strict()` — old `flavor` data is silently stripped, not rejected

**What goes wrong:** CONTEXT.md D-122 says "strict schema rejects unknown fields"; reading the existing `MetadataSchema` shows it is `z.object()` (default = strip). If Phase 7 also adds `.strict()` to `MetadataSchema`, every old SQLite session row breaks on next read.

**Why it happens:** Mixing up "the new `SessionPatchSchema` is strict" (true) with "all schemas in Phase 7 should be strict" (false).

**How to avoid:** Leave `MetadataSchema` as default `z.object()`. Only `SessionPatchSchema`, `MachinePatchSchema`, and any new `MessageContentSchema` discriminated union variants should be `.strict()`.

**Warning signs:** Plan task says "tighten `MetadataSchema` to `.strict()`" — reject in plan-check.

### Pitfall 2: `hub/src/sse/sseManager.broadcast` typing already constrains `SyncEvent`

**What goes wrong:** Slice 2 contract test author assumes the broadcast site accepts `unknown` and asserts `SyncEventSchema.parse(payload)` over a captured mock. But `EventPublisher.emit(event: SyncEvent)` and `SSEManager.broadcast(event: SyncEvent)` are already typed via `SyncEvent` from `@hapi/protocol/types`. Once `SyncEventSchema.data` tightens (Slice 1), the TypeScript compiler will reject any non-conformant `publisher.emit(...)` call in `sessionCache.ts` / `machineCache.ts` / `messageService.ts` **at the slice boundary**.

**Why it happens:** Confusing the type-level guard (compile-time, free) with the runtime contract test (which catches data shape bugs that survive type erasure — e.g. nested `Session.metadata` containing extra fields).

**How to avoid:** Slice 2 still benefits from a runtime contract test (catches: (a) `dev mode SyncEventSchema.parse` regressions; (b) data drift from CLI side that lands in cache then gets re-emitted). But the test's value-add over the type checker is narrower than CONTEXT.md implies. PLAN.md should keep the contract test (D-127#3) but scope it to "exercise representative cache state transitions and assert each emit `safeParse` succeeds" — not "guard against missing fields at compile time" (the type checker does that).

### Pitfall 3: `flavor` field has unexpected reader on the resume path

**What goes wrong:** Deleting `MetadataSchema.flavor` is straightforward in shared, cli writes, and display UI. But `hub/src/sync/syncEngine.ts:514` reads `metadata.flavor` for a **defense-in-depth check** that explicitly rejects historical non-cursor SQLite rows (`Sessions of flavor "${historicalFlavor}" are no longer supported`). After deleting the field from `MetadataSchema`, this read becomes a type error.

**Why it happens:** P5 RESEARCH explicitly noted this defense; Phase 5 left the runtime check live because `MetadataSchema.flavor` was kept as `z.string().nullish()`. Phase 7 is what retracts that.

**How to avoid:** PLAN.md needs an explicit task to **delete the historical-flavor guard block** at `syncEngine.ts:507-521` (the `historicalFlavor != null && historicalFlavor !== 'cursor'` branch). After D-122, this branch is unreachable by construction (no flavor in the schema = no flavor in the parsed metadata).

**Warning signs:** Compiler error `Property 'flavor' does not exist on type 'Metadata'` at `syncEngine.ts:514` during Slice 2 — that's the planned trigger, not a bug.

### Pitfall 4: `web/src/components/SessionList.tsx::FlavorIcon` + `FLAVOR_BADGES` is a presentation tier hangover

**What goes wrong:** D-122 says "web `SessionMetadataSummary.flavor` field delete". The cascade includes the `FlavorIcon` React component and its `FLAVOR_BADGES` lookup table (`SessionList.tsx:498-499`). If the plan only narrows the type without deleting the component, the file fails type-check.

**How to avoid:** PLAN.md tasks for Slice 3 (cli + web collapse) must include:
- Delete `FlavorIcon` component definition (`SessionList.tsx:498-499` and its render-site at `:594`).
- Delete `s.metadata?.flavor` reads at `SessionList.tsx:418,564`.
- Delete flavor branches in `SessionHeader.tsx:111,160`, `SessionChat.tsx:111`, `router.tsx:340`, `useSessionActions.ts:67`.
- Decide what UI rendering looks like with flavor removed (recommend: just hide the icon since it was always "cursor" anyway post-Phase 5).

### Pitfall 5: `MessageContentSchema` discriminator with new literal will reject old SQLite rows

**What goes wrong:** After D-123 (`AGENT_MESSAGE_PAYLOAD_TYPE = 'cursor'`), any new `AgentMessageSchema` whose `content.type` is a literal of the constant value will reject old SQLite rows containing `'codex'`. This is intended and matches D-116 / Phase 10 fallback, but the plan-checker must verify nobody writes a `.passthrough()` or `.or(z.literal('codex'))` compatibility shim.

**How to avoid:** The current `AgentMessageSchema` (`cli/src/api/types.ts:176-184`) declares `content: z.object({ type: z.literal('output'), data: z.unknown() })`. The `'output'` literal is **already not** the agent payload type — `'codex'` lives elsewhere (in the wire envelope outside the message content). Re-read where `AGENT_MESSAGE_PAYLOAD_TYPE` is consumed before assuming the schema discriminator needs to change. Only the **consumer that compares `someMessage.type === AGENT_MESSAGE_PAYLOAD_TYPE`** propagates the new value; `AgentMessageSchema.content.type` is statically `'output'` and unaffected.

  Verification: `hub/src/sync/todos.ts` and `hub/src/sync/sessionModel.test.ts` import the constant and compare; the schema discriminator literal in `AgentMessageSchema.content.type` is `'output'`, not the agent type identifier.

## Code Examples

### Example 1: `SessionPatchSchema` (D-117 — recommended explicit form)

```typescript
// shared/src/schemas.ts
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

export type SessionPatch = z.infer<typeof SessionPatchSchema>
```

### Example 2: `MachinePatchSchema` (D-118)

```typescript
// shared/src/schemas.ts
export const MachinePatchSchema = z.object({
    active: z.literal(false),
    activeAt: z.number().optional()
}).strict()

export type MachinePatch = z.infer<typeof MachinePatchSchema>
```

(Note: hub only emits `{ active: false }` today — `activeAt` field is added defensively per CONTEXT.md D-118; see §1 inventory below.)

### Example 3: `SyncEventSchema` data-field tightening (D-119, with §5 recommendation)

```typescript
// shared/src/schemas.ts (selected variants)
SessionChangedSchema.extend({
    type: z.literal('session-added'),
    data: SessionSchema                          // strict full — never patch (§5)
}),
SessionChangedSchema.extend({
    type: z.literal('session-updated'),
    data: z.union([SessionSchema, SessionPatchSchema])
}),
MachineChangedSchema.extend({
    type: z.literal('machine-updated'),
    data: z.union([MachineSchema, MachinePatchSchema, z.null()])
}),
```

### Example 4: useSSE rewrite skeleton (D-121)

```typescript
// web/src/hooks/useSSE.ts (post-Phase 7)
import { SyncEventSchema } from '@hapi/protocol/schemas'

const handleMessage = (message: MessageEvent<string>) => {
    if (typeof message.data !== 'string') return
    let parsed: unknown
    try { parsed = JSON.parse(message.data) } catch { return }

    const result = SyncEventSchema.safeParse(parsed)
    if (!result.success) {
        console.error('[useSSE] dropped malformed event', result.error)
        return                                   // D-120: drop, NO refetch
    }
    handleSyncEvent(result.data)
}

const handleSyncEvent = (event: SyncEvent) => {
    if (event.type === 'session-updated') {
        const data = event.data
        if ('metadata' in data) {                // full Session
            queryClient.setQueryData(queryKeys.session(event.sessionId), { session: data })
            upsertSessionSummary(data)
        } else {                                 // SessionPatch (strict-shape)
            patchSessionDetail(event.sessionId, data)
            patchSessionSummary(event.sessionId, data)
        }
    }
    // ... other branches similar
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `data: z.unknown()` + hand-rolled narrow funcs | Discriminated union of `Schema \| PatchSchema` | Phase 7 | Compile-time exhaustiveness; runtime strict-reject |
| Heuristic patch-key allow-list (`new Set(['active', ...])`) | `.strict()` patch schema | Phase 7 | `backgroundTaskCount` bug fixed by construction |
| Parse failure → refetch list | Parse failure → console.error + drop | Phase 7 (D-120) | DB pressure removed; explicit failure |
| Per-package wire types (cli + web + hub each defines `Machine`) | Single shared definition + re-exports | Phase 7 (REFA-03) | Type drift impossible |

**Deprecated/outdated:**
- `MetadataSchema.flavor: z.string().nullish()` — P5 explicitly marked as "temporary backward-compat reservation"; Phase 7 retracts.
- `AGENT_MESSAGE_PAYLOAD_TYPE = 'codex'` — P5 D-81 anchored for Phase 7 rename; now executed.
- 7 useSSE narrow functions + `SessionPatch` local type — replaced by schema-derived `z.infer`.

## §1 — `publisher.emit` field-set inventory (closing the D-117 / D-118 enumeration)

**Method:** Direct grep of `publisher\.emit\(` across `hub/src/`, then read each call site.

### `hub/src/sync/sessionCache.ts` — every `data` field that ever appears

| Line | Caller | `type` | `data` keys (patch-shape unless noted) |
|------|--------|--------|----------------------------------------|
| 71 | `refreshSession` (deletion path) | `session-removed` | — (no `data` field) |
| 139 | `refreshSession` | `session-added` or `session-updated` | **Full `Session`** (entire built object — covers `id`, `seq`, `createdAt`, `updatedAt`, `active`, `activeAt`, `metadata`, `metadataVersion`, `agentState`, `agentStateVersion`, `thinking`, `thinkingAt`, `backgroundTaskCount`, `todos`, `teamState`, `model`, `modelReasoningEffort`, `effort`, `permissionMode`) |
| 231–243 | `handleSessionAlive` (broadcast on mode/active/thinking change) | `session-updated` | `active`, `activeAt`, `thinking`, `permissionMode`, `model`, `modelReasoningEffort`, `effort` |
| 263–270 | `markMessageQueued` | `session-updated` | `thinking`, `updatedAt` |
| 283–287 | `applyBackgroundTaskDelta` | `session-updated` | `backgroundTaskCount` (single field — **the bug** that triggers `hasUnknownSessionPatchKeys = true`) |
| 316–320 | `recordSessionActivity` | `session-updated` | `updatedAt` |
| 339 | `handleSessionEnd` | `session-updated` | `active: false`, `thinking: false`, `backgroundTaskCount: 0` |
| 353 | `expireInactive` | `session-updated` | `active: false` |
| 422 | `applySessionConfig` | `session-updated` | **Full `Session`** (`data: session`) — note: emits full session for config changes |
| 472 | `deleteSession` | `session-removed` | — |
| 507, 509 | `mergeSessionData` | `messages-invalidated` | — |
| 603 | `mergeSessionData` (delete old) | `session-removed` | — |
| 613 | `mergeSessionData` (refresh new) | `session-updated` | **Full `Session`** (`data: refreshed`) |

**Patch-field union (excluding full-session paths):**
`active`, `activeAt`, `thinking`, `updatedAt`, `permissionMode`, `model`, `modelReasoningEffort`, `effort`, `backgroundTaskCount` — **9 fields total**.

**Decision:** `SessionPatchSchema` must include all 9 as `.optional()`. Matches D-117 exactly; no missed fields. ✅

### `hub/src/sync/machineCache.ts` — every `data` field that ever appears

| Line | Caller | `type` | `data` keys |
|------|--------|--------|-------------|
| 72 | `refreshMachine` (deletion) | `machine-updated` | `null` |
| 127 | `refreshMachine` | `machine-updated` | **Full `Machine`** |
| 154 | `handleMachineAlive` | `machine-updated` | **Full `Machine`** |
| 165 | `expireInactive` | `machine-updated` | `{ active: false }` (only) |

**Patch-field union:** `active` (always literal `false` in current code). No `activeAt`-only emit. No other patch shape.

**Decision:** `MachinePatchSchema = z.object({ active: z.literal(false), activeAt: z.number().optional() }).strict()` — `activeAt` kept optional per CONTEXT.md D-118 (defensive forward-compat; no current emit uses it, but no harm in optional). ✅

### `hub/src/sync/messageService.ts` — only emits non-session/non-machine events

| Type | Lines | Notes |
|------|-------|-------|
| `message-cancelled` | 181, 200, 237, 286 | Existing schema fields (`sessionId`, `messageId`, optional `localId`) — no change |
| `messages-consumed` | 227, 266, 458 | Existing schema fields (`sessionId`, `localIds`, `invokedAt`) — no change |
| `message-received` | 417 | Existing schema field (`message: DecryptedMessage`) — no change |

No `session-*` or `machine-*` emits from `messageService.ts`. Out of scope for `SessionPatchSchema` / `MachinePatchSchema` design.

## §2 — Duplicate type declarations (closing the SC#1 inventory)

| File | Lines | What's declared (current) | Phase 7 action |
|------|-------|---------------------------|----------------|
| `cli/src/api/types.ts` | 32–55 | `MachineMetadataSchema` (Zod, with `.transform` for `workspaceRoot ↔ workspaceRoots`) | Lift to `shared/src/schemas.ts`; cli `re-export`s. Preserve `.transform`. |
| `cli/src/api/types.ts` | 57 | `export type MachineMetadata` | Re-export from shared |
| `cli/src/api/types.ts` | 59–73 | `RunnerStateSchema` (Zod, with loose `status` / `shutdownSource` union per D-115) | Lift to shared; cli re-exports |
| `cli/src/api/types.ts` | 75 | `export type RunnerState` | Re-export from shared |
| `cli/src/api/types.ts` | 77–88 | `export type Machine = {...}` (TS-only, references local `MachineMetadata` + `RunnerState`) | Delete; re-export from shared |
| `cli/src/api/types.ts` | 102–122 | `CreateSessionResponseSchema` with **`metadata: z.unknown().nullable()`** + **`agentState: z.unknown().nullable()`** (the narrow target of D-113) | Replace with `z.object({ session: SessionSchema })` |
| `cli/src/api/types.ts` | 152–158 | `MessageMetaSchema` | Lift to shared; cli re-exports |
| `cli/src/api/types.ts` | 163–172 | `UserMessageSchema` | Lift to shared; cli re-exports |
| `cli/src/api/types.ts` | 176–183 | `AgentMessageSchema` | Lift to shared; cli re-exports |
| `cli/src/api/types.ts` | 187 | `MessageContentSchema` (union) | Lift to shared; cli re-exports |
| `web/src/types/api.ts` | 26–40 | `SessionMetadataSummary` (with `flavor` field) | Replace with re-export of `SessionSummaryMetadata` from shared (after D-122 removes `flavor` from both) |
| `web/src/types/api.ts` | 50–64 | `RunnerState` (TS-only, loose mirror of cli) | Delete; re-export from shared |
| `web/src/types/api.ts` | 66–77 | `Machine` (TS-only, narrower than cli — only `id`, `active`, `metadata`, `runnerState`) | Delete; re-export shared `Machine`. **NOTE the shape mismatch:** web's local type currently omits `seq`, `createdAt`, `updatedAt`, `activeAt`, `metadataVersion`, `runnerStateVersion`. After shared re-export, web consumers will see the full shape. Verify no web code does object-spread that would now include accidental fields (it's safe but worth a slice 3 sweep). |
| `web/src/types/api.ts` | 89–101 | `SessionsResponse`, `SessionResponse`, `MessagesResponse`, `MachinesResponse` | Lift to shared (D-114); web re-exports |
| `web/src/types/api.ts` | 118–120 | `SpawnResponse` | Lift to shared (D-114); web re-exports |
| `web/src/types/api.ts` | 240 | `SyncEvent = ProtocolSyncEvent` | Already a re-export — keep |
| `hub/src/sync/machineCache.ts` | 6–16 | `machineMetadataSchema` (Zod, hub-local, looser than cli version — all fields optional, no transform) | Delete; replace with import of shared `MachineMetadataSchema`. **Diff with cli version:** hub-local treats `host` / `platform` / `happyCliVersion` as optional and post-processes with `'unknown'` fallback; cli version requires them. Phase 7 must decide which wins. **Recommendation:** keep hub's defensive optional shape (hub may receive incomplete metadata from old CLI clients during reconnect storms); refactor cli `MachineMetadataSchema` to match (all-optional + `.transform` for workspaceRoots). Document the choice in PLAN.md. |
| `hub/src/sync/machineCache.ts` | 18–38 | `export interface Machine` | Delete; replace with `import type { Machine } from '@hapi/protocol/types'` |
| `hub/src/web/routes/*.ts` | (none) | Routes return inline `c.json({...})` objects — **no named Response types declared** | No deletions; response wrappers lift only happens shared-side; hub consumers continue to satisfy via TS structural typing. |

**Verification:** `interface Machine\b` zero hits expected in `cli/src/ web/src/ hub/src/sync/` after slice 3 + slice 2 (only allowed: `class MachineCache` is not a match for `interface Machine\b`). `RunnerStateSchema` / `MachineMetadataSchema` zero hits in `cli/src/ web/src/` (only legal location: `shared/src/schemas.ts`).

## §3 — Response wrapper inventory (closing D-114)

Source of truth = `web/src/types/api.ts` (named types) cross-checked with hub `return c.json({...})` sites:

| Wrapper | Shape | Web declaration | Hub emit verification | Lift target |
|---------|-------|-----------------|----------------------|-------------|
| `SessionsResponse` | `{ sessions: SessionSummary[] }` | `web/src/types/api.ts:89` | `hub/src/web/routes/sessions.ts:109` `c.json({ sessions })` ✓ | `shared/src/responses.ts` |
| `SessionResponse` | `{ session: Session }` | `web/src/types/api.ts:90` | `hub/src/web/routes/sessions.ts:123` `c.json({ session: sessionResult.session })` ✓ | `shared/src/responses.ts` |
| `MessagesResponse` | `{ messages: DecryptedMessage[]; page: { limit, nextBeforeSeq, nextBeforeAt, hasMore } }` | `web/src/types/api.ts:91-99` | hub routes/messages.ts (not re-read here; trusted from web consumer + page shape match) | `shared/src/responses.ts` |
| `MachinesResponse` | `{ machines: Machine[] }` | `web/src/types/api.ts:101` | hub routes/machines.ts (trusted) | `shared/src/responses.ts` |
| `SpawnResponse` | `{ type: 'success', sessionId: string } \| { type: 'error', message: string }` | `web/src/types/api.ts:118-120` | `hub/src/web/routes/sessions.ts:162` `c.json({ type: 'success', sessionId: result.sessionId })` ✓ | `shared/src/responses.ts` |

**Out-of-scope wrappers (defer to Phase 8 REFH-03 or Phase 9 REFW-03):** `MachinePathsExistsResponse`, `MachineListDirectoryResponse`, `GitCommandResponse`, `FileSearchResponse`, `ListDirectoryResponse`, `FileReadResponse`, `UploadFileResponse`, `DeleteUploadResponse`, `GitStatusFiles`, `SlashCommandsResponse`, `SkillsResponse`, `PushVapidPublicKeyResponse`, `AuthResponse` — all keep their web-local definitions for Phase 7.

## §4 — Placement decision: `schemas.ts` vs `messages.ts` vs `responses.ts`

`shared/src/messages.ts` contains 6 utility functions (`isRoleWrappedRecord`, `unwrapRoleWrappedRecordEnvelope`, `isAgentChatVisibleSystemSubtype`, `isAgentChatVisibleMessage`, `isRedundantGoalStatusMessageText`, `isRedundantGoalStatusEventContent`) and one type alias — **no Zod schemas**. Mixing wire schemas into this file confuses concerns.

**Recommended placement:**

| Item | File | Rationale |
|------|------|-----------|
| `MachineSchema`, `MachineMetadataSchema`, `RunnerStateSchema` | `shared/src/schemas.ts` (extend) | Same file as `SessionSchema` — co-located wire schemas |
| `SessionPatchSchema`, `MachinePatchSchema` | `shared/src/schemas.ts` | Co-located with `SyncEventSchema` that consumes them |
| `MessageMetaSchema`, `UserMessageSchema`, `AgentMessageSchema`, `MessageContentSchema` | `shared/src/schemas.ts` | Same reason — single source of truth for wire schemas |
| Tightened `SyncEventSchema` | `shared/src/schemas.ts` (mutate in place) | Already there |
| `SessionsResponse / SessionResponse / MessagesResponse / MachinesResponse / SpawnResponse` (TS-only) | `shared/src/responses.ts` (NEW) | Pure TS aliases, no Zod — mirrors existing `sessionSummary.ts` precedent |
| Re-exports | `shared/src/types.ts` + `shared/src/index.ts` | Single import surface for consumers |

## §5 — `session-added` shape recommendation (Claude's Discretion item from CONTEXT.md)

**Recommendation:** `session-added.data = SessionSchema` (strict full; **not** `z.union([SessionSchema, SessionPatchSchema])`).

**Evidence:** Only one emitter exists — `hub/src/sync/sessionCache.ts:139` inside `refreshSession`:

```typescript
this.publisher.emit({
    type: existing ? 'session-updated' : 'session-added',
    sessionId,
    data: session                  // full Session object
})
```

The `session-added` branch (`!existing`) is only reachable on first-load of a session into the in-memory cache map — there is no "previous state" to patch against. Logically, `session-added` is always full. Tightening the schema to forbid patch payloads on this event:
1. Documents the invariant in the wire contract.
2. Prevents future regressions where a contributor wires a patch into `session-added`.
3. Keeps the web discriminator branch trivial — `session-added` always means `setQueryData(detail, { session: data })` + `upsertSummary(data)`.

## §6 — useSSE rewrite call-site map (closing D-121)

The 7 narrow functions are **only called inside `useSSE.ts` itself** (one file). Grep confirms zero external imports.

| Function | Lines (definition) | Call sites (inside `useSSE.ts::handleSyncEvent`) | Cache mutator it feeds |
|----------|--------------------|---------------------------------------------------|------------------------|
| `hasRecordShape` | 45–47 | 50, 61, 116, 125, 134, 546 | All other narrow functions (compose) |
| `isSessionRecord` | 49–58 | 515 (full-vs-patch fork) | `upsertSessionSummary` + `setQueryData(session)` |
| `getSessionPatch` | 60–102 | 519 | `patchSessionSummary`, `patchSessionDetail` |
| `hasUnknownSessionPatchKeys` | 104–110 | 530 (the bug — triggers `queueSessionListInvalidation` + `queueSessionDetailInvalidation` whenever ≥1 unrecognized field) | `queueSessionListInvalidation`, `queueSessionDetailInvalidation` (**this branch deletes per D-120**) |
| `isMachineMetadata` | 112–122 | 130 (composed inside `isMachineRecord`) | (indirect) |
| `isMachineRecord` | 124–131 | 542 (full-machine fork) | `upsertMachine` |
| `isInactiveMachinePatch` | 133–135 | 544 | `removeMachine` |

After Phase 7:
- All 7 functions deleted.
- `handleSyncEvent` calls `SyncEventSchema.safeParse(parsed)` at the top, then branches on `event.type` and (for `session-updated` / `machine-updated`) on a single key-existence check inside the union:
  - `session-updated`: `'metadata' in data` distinguishes full Session from SessionPatch (only full Session carries `metadata`).
  - `machine-updated`: `data === null` → remove; `'id' in data` → full Machine; else strict patch (`active: false`).
- `queueSessionListInvalidation` / `queueSessionDetailInvalidation` / `queueMachinesInvalidation` are **only** called in the existing parse-failure path of `handleMessage` (lines 554–574), and after D-120 the parse-failure path drops + logs without invalidating. After Phase 7, the three queue functions become **unused** and can be deleted as well (verify via TypeScript "no unused" lint or compiler `--noUnusedLocals`). PLAN.md must include a task to delete `queueSessionListInvalidation`, `queueSessionDetailInvalidation`, `queueMachinesInvalidation`, `flushInvalidations`, `scheduleInvalidationFlush`, `invalidationTimerRef`, `pendingInvalidationsRef`, and `INVALIDATION_BATCH_MS` — this is a significant cleanup beyond the 7 narrow functions.

## §7 — `MetadataSchema.flavor` read/write site map (closing D-122)

**Writers (delete the write):**

| File:line | Action |
|-----------|--------|
| `cli/src/agent/sessionFactory.ts:80` | Delete `flavor: options.flavor,` line in `buildSessionMetadata` return |
| `cli/src/agent/sessionFactory.ts:144,193` | Delete `flavor: options.flavor,` lines |
| `cli/src/agent/sessionFactory.ts:20,54,177` | Delete `flavor: string` field from option types (`SessionBootstrapOptions`, `buildSessionMetadata` opts param, `bootstrapExistingSession` opts) |
| `cli/src/cursor/runCursor.ts:54,59` | Delete `flavor: 'cursor',` keys in two sessionFactory call sites |
| `cli/src/agent/types.ts:74` | Delete `opts?: { flavor?: AgentFlavor }` from `setModel` signature (or narrow to just `{}` / `undefined`) |

**Readers — routing / business logic (collapse `?? 'cursor'` fallback to constant):**

| File:line | Current code | Post-Phase 7 |
|-----------|--------------|--------------|
| `hub/src/web/routes/permissions.ts:59-61` | `const flavor = session.metadata?.flavor ?? 'cursor'; if (!isPermissionModeAllowedForFlavor(mode, flavor)) {...}` | `if (!isPermissionModeAllowedForFlavor(mode, 'cursor')) {...}` — or simplify further: `isPermissionModeAllowedForFlavor` is single-flavor today, can be removed entirely (consider for Phase 9 / out of scope here; leave the call, just pass `'cursor'` constant) |
| `hub/src/web/routes/sessions.ts:145-147` | Same pattern | Same collapse |
| `hub/src/web/routes/sessions.ts:293-302` | `getPermissionModesForFlavor(flavor)` etc. | Pass `'cursor'` constant or refactor — recommend pass constant, defer helper consolidation to Phase 9 |
| `hub/src/web/routes/sessions.ts:331-332` | `supportsModelChange(flavor)` | Pass `'cursor'` |
| `hub/src/web/routes/sessions.ts:414` | `const agent = sessionResult.session.metadata?.flavor ?? 'cursor'` | Replace with `const agent = 'cursor'` |
| `hub/src/sync/syncEngine.ts:391` | `private resolveFlavor(_session: Session): AgentFlavor { return 'cursor' }` (already constant) | Keep — already cursor-only; signature already returns `AgentFlavor` literal type. Can inline at call sites if desired (Phase 8 cleanup). |
| `hub/src/sync/syncEngine.ts:426,458,549` | `flavor: this.resolveFlavor(session)` / `flavor: target.flavor` | Keep (still needed as part of `LocalResumeTarget` / `ResumableSession` shape — those types live in `shared/src/resume.ts:8` which uses `AgentFlavorSchema = z.literal('cursor')`). **Not deleted; only metadata.flavor is deleted, not the resume-target.flavor field.** Plan-checker: do not confuse these. |
| `hub/src/sync/syncEngine.ts:507-521` | Historical-flavor defense block (`historicalFlavor = metadata.flavor; if (historicalFlavor != null && historicalFlavor !== 'cursor') return error`) | **Delete entire block** (Pitfall #3 above) |

**Readers — display only (collapse to single-Cursor presentation):**

| File:line | Action |
|-----------|--------|
| `hub/src/notifications/sessionInfo.ts:14-18` (`getAgentName`) | Collapse to `export function getAgentName(_session: Session): string { return 'Cursor' }` — or delete entirely if callers can hard-code. Verify caller in `hub/src/push/pushNotificationChannel.ts:3` and inline. |
| `web/src/router.tsx:340` | Delete read of `session?.metadata?.flavor` and the variable it produces |
| `web/src/components/SessionChat.tsx:111` | Delete `const agentFlavor = props.session.metadata?.flavor ?? null` and any downstream usage |
| `web/src/components/SessionList.tsx:418,498-499,564,594` | Delete `FlavorIcon` component, `FLAVOR_BADGES` lookup, and all flavor-reading branches. Render no icon, or render a fixed Cursor icon (UI decision — recommend fixed icon to retain visual identity) |
| `web/src/components/SessionHeader.tsx:111,160` | Delete flavor reads + the conditional rendering of `{session.metadata?.flavor?.trim() || 'unknown'}` text label |
| `web/src/hooks/mutations/useSessionActions.ts:67-68` | Delete `if (isKnownFlavor(agentFlavor) && !isPermissionModeAllowedForFlavor(mode, agentFlavor))` guard — collapse to `isPermissionModeAllowedForFlavor(mode, 'cursor')` or delete entirely |
| `shared/src/sessionSummary.ts:8,34` | Delete `flavor?: string \| null` field from `SessionSummaryMetadata`; delete `flavor: session.metadata.flavor ?? null` from `toSessionSummary` |
| `shared/src/schemas.ts:49` | Delete `flavor: z.string().nullish()` line |
| `web/src/types/api.ts:35` | Delete `flavor?: string \| null` from `SessionMetadataSummary` (or delete the whole local type once it re-exports from shared `SessionSummaryMetadata`) |

**Test fixtures (existing tests pass `flavor: 'cursor'` in metadata literals — strip from fixtures):**

| File | Approximate count |
|------|-------------------|
| `hub/src/sync/sessionModel.test.ts` | 30+ occurrences (lines 27, 44, 60, 76, 82, 99, …, 1032) |
| `hub/src/web/routes/cli.test.ts` | 4 occurrences (lines 68, 87, 105, 124) |
| `hub/src/web/routes/sessions.test.ts` | 6 occurrences |
| `hub/src/sync/aliveEvents.test.ts` | 7 occurrences |
| `hub/src/push/pushNotificationChannel.test.ts` | 1 occurrence |
| `cli/src/agent/sessionFactory.test.ts` | 5 occurrences |
| `cli/src/commands/resume.test.ts` | 3 occurrences |
| `web/src/components/SessionList.test.ts`, `SessionList.directory-action.test.tsx` | 2 occurrences |
| `shared/src/resume.test.ts` | 2 occurrences (these are in `ResumableSession` / `LocalResumeTarget` fixtures where `flavor: 'cursor'` is a **valid required field of those shapes** — DO NOT delete; only delete `flavor` inside `metadata: {...}` literals) |

**Plan-checker note:** Distinguish `flavor` inside `metadata: { ... flavor: 'cursor' ... }` (delete) from `flavor` as a top-level field of `ResumableSession` / `LocalResumeTarget` (keep — these are defined in `shared/src/resume.ts:8` and survive Phase 7).

## §8 — `'codex'` literal inventory (closing D-123 / D-124)

**Grep result:** `'codex'` in `cli/src/ hub/src/ web/src/ shared/src/` = **exactly 1 hit** → `shared/src/modes.ts:9` (the constant declaration itself).

All consumers (`hub/src/sync/todos.ts`, `hub/src/sync/sessionModel.test.ts`, cli message-write paths, web payload-type comparisons) already import `AGENT_MESSAGE_PAYLOAD_TYPE` and use the constant — verified by P5 verification report (`05-VERIFICATION.md`).

**Action set for D-123:**
1. `shared/src/modes.ts:9`: flip `'codex'` → `'cursor'`.
2. `shared/src/modes.ts:1-8` JSDoc: replace block with `wire-tag for cursor agent message envelope`.

**Action set for D-124 (`scripts/check-no-cut-agents.sh`):**
1. Line 13 (header comment "Phase-5 flavor cut — single residue...") — rewrite as historical artifact comment or delete.
2. Line 84: delete `SURVIVORS_FILTERED=$(echo "$SURVIVORS" | grep -v "shared/src/modes.ts:.*AGENT_MESSAGE_PAYLOAD_TYPE = 'codex' as const" || true)` post-filter; change variable to use `$SURVIVORS` directly.
3. Lines 91, 96: remove "AGENT_MESSAGE_PAYLOAD_TYPE wire literal" language from the error / success echoes.
4. Tighten: after D-123 + D-124, `'codex'` in `cli/src hub/src web/src shared/src` must be 0 (verified). The existing `PATTERN='\b(claude|codex|gemini|opencode|telegram|serverchan|elevenlabs|grammy)\b'` sweep does the work; just remove the whitelist.

## §9 — `SyncEvent` consumer audit (where else `SyncEvent` is consumed besides useSSE)

| File | Usage | Phase 7 impact |
|------|-------|----------------|
| `hub/src/sync/eventPublisher.ts:1,4,17` | `import type { SyncEvent }`; `emit(event: SyncEvent)` | Type narrows automatically; **add optional dev-mode `SyncEventSchema.parse(event)` (Claude's Discretion — recommended)** as the contract self-check |
| `hub/src/sse/sseManager.ts` (broadcast site) | Accepts `SyncEvent` | Type narrows automatically; no edits |
| `web/src/hooks/useSSE.ts:11` | `import type { SyncEvent }` (cast on line 573) | The `as SyncEvent` cast at line 573 disappears (replaced by `safeParse`) |
| `web/src/types/api.ts:240` | `export type SyncEvent = ProtocolSyncEvent` | No change |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | After flipping `MetadataSchema` field set, default Zod `z.object()` *strips* unknown keys rather than rejecting | Pitfall #1, §7 | If misread, old SQLite rows with `flavor` survive without issue (low risk; this is Zod-4 documented default behaviour but worth a quick `bun test` smoke before scheduling Phase 10 cleanup) |
| A2 | Hub-local `machineMetadataSchema` (all-optional + 'unknown' fallback) vs cli `MachineMetadataSchema` (strict required + transform) — recommend keeping hub's defensive shape | §2, D-111 | If wrong, slice 2 hub broadcast contract test fails because hub receives incomplete machine metadata that the new shared schema rejects |
| A3 | `session-added` is always full-payload — only one emitter in entire hub | §5, §1 | Verified via grep (`refreshSession:139` is the sole site); risk = 0 |
| A4 | Web's local `Machine` type omits `seq/createdAt/updatedAt/activeAt/metadataVersion/runnerStateVersion`; after shared re-export these become visible — no consumer breaks because (a) no consumer spreads `Machine` into JSON serialization, (b) TanStack Query cache stores them as opaque values | §2 | If wrong, a UI component might accidentally render or spread these new fields. Slice 3 `bun typecheck` will not catch this — recommend a quick visual smoke on `MachineList` and `SessionList` (out-of-scope per D-128 build-single-exe deferral, but a manual `bun dev` pageload is cheap) |
| A5 | Phase 11 (REFT-02 SSE reconnect / patch-loss invariant) owns reconnect-loss test scenarios; Phase 7 only covers happy-path strictly-typed event stream + parse-failure drop | CONTEXT.md `<deferred>` | If wrong, Phase 7 tests overreach into reconnect logic and bleed scope; Phase 11 plan loses content. Verify in PLAN.md test list |
| A6 | Cli `MessageMetaSchema / UserMessageSchema / AgentMessageSchema / MessageContentSchema` move to shared without consumer breakage (cli paths already import them from `cli/src/api/types.ts` which becomes a re-export shim) | §2 / D-112 | Low — `bun typecheck` catches any consumer using a type that disappears |
| A7 | `'cursor'` rename of `AGENT_MESSAGE_PAYLOAD_TYPE` has no source-tree consumers — only one literal hit at the constant itself; all readers already import the symbol. (Verified via grep) | §8 | Zero risk for source code. SQLite legacy data IS affected — Phase 10 reject |

## Open Questions

1. **`hub/src/sync/machineCache.ts` local schema vs `cli/src/api/types.ts::MachineMetadataSchema` — which becomes canonical?**
   - What we know: They disagree on required-ness of `host` / `platform` / `happyCliVersion`. Cli writes the metadata; hub reads it.
   - What's unclear: Whether the hub-side optional shape is defensive (handling stale CLI clients) or just sloppy (matches what cli ought to send anyway).
   - Recommendation: Adopt the **defensive optional shape** in `shared/`. Update cli `buildMachineMetadata` to confirm it always sends `host/platform/happyCliVersion` (no behavioural change needed — it already does). Document the optional-ness in the schema JSDoc so future contributors don't tighten naively.

2. **`isPermissionModeAllowedForFlavor` / `getPermissionModesForFlavor` / `supportsModelChange` helpers — collapse opportunistically?**
   - What we know: After D-122 these always receive `'cursor'` as their argument. The helpers themselves are no-ops in single-flavor world.
   - What's unclear: Whether collapsing them is in-scope for Phase 7 or deferred.
   - Recommendation: **Out of scope for Phase 7.** D-114 keeps helper consolidation deferred to Phase 9 REFW-03 / Phase 8 cleanup. PLAN.md just collapses the `?? 'cursor'` fallback at call sites; leaves the helpers alone.

3. **Should `MetadataSchema` become `.strict()` for forward defence?**
   - What we know: It is currently default `z.object()` (strip).
   - What's unclear: Does the project want strict-reject behaviour to surface contract drift at metadata write time?
   - Recommendation: **No.** Keep strip behaviour. The Pitfall #1 risk (silently breaking old SQLite rows that carry `flavor`) outweighs the contract-drift benefit. If forward defence is desired, address it during Phase 10 (REFC-01 schema-version reject) as a holistic strict-mode pass.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `bun` | typecheck + test gate every slice | ✓ (verified in prior phases) | workspace-pinned | — |
| `zod` | New schema definitions | ✓ | 4.2.1 | — |
| `@tanstack/react-query` | useSSE cache mutators (unchanged) | ✓ | 5.90.12 | — |
| `EventSource` mock for web test | New `useSSE.test.tsx` | ✓ (web has Vitest/Bun test setup; verify in Wave 0) | — | If absent: hand-rolled `class MockEventSource { onmessage, onopen, onerror; dispatch(data) { this.onmessage({ data } as any) } }` |
| `madge` | Existing `madge --circular cli/src/cursor` (Phase 6 D-108#4 — kept per D-128) | ✓ | existing | — |
| `ripgrep` (`rg`) | `scripts/check-no-cut-agents.sh` guard | ✓ | existing | — |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:** None.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Bun test (bun's built-in test runner) — verified by prior phases (P5/P6 all used `bun test` + `bun run test`) |
| Config file | Per-package: `cli/`, `hub/`, `web/`, `shared/` each have collocated `*.test.ts` / `*.test.tsx`; no monorepo-level config beyond `package.json` scripts |
| Quick run command | `bun run test` (workspace root — runs all packages) |
| Full suite command | `bun typecheck && bun run test` (Phase 7 slice gate) |
| Package-scoped run | `cd shared && bun test schemas.test.ts` etc. |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| REFA-03 | `Session/Machine/Message/RunnerState` defined exactly once in `shared/` | static / structural | `bash scripts/check-no-cut-agents.sh` + new D-126 keyword grep in same script | ❌ guard script extension (Wave 0 already exists; needs D-126 additions in slice 4) |
| REFA-03 | cli `MachineMetadataSchema` + `RunnerStateSchema` parse behaviour preserved after shared lift | unit | `cd cli && bun test api` (existing test suite continues to pass after re-export) | ✓ existing |
| REFA-04 | `SessionPatchSchema` rejects unknown fields | unit | `cd shared && bun test schemas.test.ts` (new) | ❌ Wave 0 |
| REFA-04 | `MachinePatchSchema` rejects unknown fields and non-`false` `active` | unit | `cd shared && bun test schemas.test.ts` (new) | ❌ Wave 0 |
| REFA-04 | `SyncEventSchema` parses all 12 event types (incl. each `data` variant for session-added/updated and machine-updated full+patch+null) | unit | `cd shared && bun test schemas.test.ts` (new) | ❌ Wave 0 |
| REFA-04 | useSSE handles full `session-added`, single-field `session-updated` patch (incl. `backgroundTaskCount`), full + inactive machine-updated, and parse failures (drop + no invalidate) | hook integration | `cd web && bun test src/hooks/useSSE.test.tsx` (new) | ❌ Wave 0 |
| REFA-04 | Every `publisher.emit` in hub conforms to `SyncEventSchema` | contract | `cd hub && bun test src/sse/sseManager.test.ts` (or extend `src/sync/sessionCache.test.ts`) | ❌ Wave 0 (file extension) |
| SC#1 ripgrep gate | Zero duplicate declarations | guard | `bash scripts/check-no-cut-agents.sh` with new D-126 block | ❌ Wave 0 (slice 4) |
| SC#2 / SC#3 | `hasUnknownSessionPatchKeys` zero hits; no refetch fallback branch | guard | Same script | ❌ Wave 0 |
| SC#4 | `bun typecheck` + `bun run test` green | gate | `bun typecheck && bun run test` at workspace root | ✓ existing |

### Sampling Rate

- **Per task commit:** `bun typecheck` (~10s) + targeted `bun test path/to/file.test.ts` (~2s).
- **Per slice merge:** `bun typecheck && bun run test` workspace-wide.
- **Phase gate (end of slice 4):** Full suite + `bash scripts/check-no-cut-agents.sh` + the D-126 keyword block must all exit 0.

### Wave 0 Gaps

- [ ] `shared/src/schemas.test.ts` (new file, OR extend `shared/src/flavors.test.ts` with a new `describe('SessionPatchSchema')` / `describe('MachinePatchSchema')` / `describe('SyncEventSchema strictification')` block) — covers D-127#1.
- [ ] `web/src/hooks/useSSE.test.tsx` (new file — current useSSE has no test) — covers D-127#2. Needs EventSource mock + React-Query test-harness (`QueryClientProvider` wrapper). Reuse any existing harness in `web/src/` (verify in slice 1 if web tests have a shared `renderHook` setup).
- [ ] `hub/src/sse/sseManager.test.ts` OR `hub/src/sync/sessionCache.test.ts` — add a new `describe('publisher.emit contract')` block asserting `SyncEventSchema.parse` succeeds against captured emit payloads — covers D-127#3.
- [ ] `scripts/check-no-cut-agents.sh` D-126 sweep block addition (slice 4) — covers the 6 keyword zero-tolerance checks (`hasUnknownSessionPatchKeys`, `getSessionPatch` in `web/src/hooks/`, `interface Machine\b` + `^export type Machine =` in cli/web, `RunnerStateSchema` + `MachineMetadataSchema` in cli/web, `'codex'` in all source trees, `flavor:` writes in cli/hub source).

### Validation Design Notes (Phase-7-specific)

- **`backgroundTaskCount` regression test** is the most valuable single test in D-127#2 — it is the **direct activate-the-bug** case for the `hasUnknownSessionPatchKeys` heuristic that Phase 7 deletes. PLAN.md should call out this test as the "smoking-gun fixture" and require it as a slice-3 gate.
- **Contract test scope (D-127#3):** Per Pitfall #2, the runtime contract test value-add over the TypeScript checker is narrow once `SyncEventSchema.data` tightens. Scope the test to "drive `SessionCache` / `MachineCache` through representative state transitions (alive, end, mode change, background-task delta, machine deactivate, deletion, merge) and assert every captured `publisher.emit` argument is `SyncEventSchema.safeParse(args).success === true`." This catches **data-shape** drift the type checker cannot (nested object mutation, runtime field synthesis).

## Project Constraints (from .cursor/rules/)

(Repository contains `.cursor/rules/gitnexus.mdc` — mandates GitNexus MCP usage for impact analysis and rename safety. Phase 7 is a high-leverage rename + schema change: when planning, prefer `gitnexus_impact` over grep for the 7 narrow function call-site enumeration if the index is fresh. Researcher used direct grep here because GitNexus tool freshness was not verified at research time; planner should confirm before final task list.)

## Security Domain

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Phase 7 does not touch auth |
| V3 Session Management | no | Hub session model unchanged; only wire DTO names align |
| V4 Access Control | no | No access-control surface change |
| V5 Input Validation | **yes** | Zod `.strict()` on patch schemas + `.safeParse` on SSE input is precisely the V5.1 / V5.3 control (strict input validation, reject malformed input) |
| V6 Cryptography | no | No crypto |

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Malformed SSE payload from hub (could be benign drift or compromised hub) crashing web client | Tampering | `SyncEventSchema.safeParse` + drop (no `.parse` throwing into React Query) — implemented in D-120 |
| Unknown-key injection via `metadata` write | Tampering | `MetadataSchema` is intentionally non-strict (strip) per A1; injection cannot persist as a structured field, only as a stripped value |
| SQLite-stored legacy `'codex'` message bypass after rename | Spoofing (low — single-user local) | Discriminator literal rejects on parse; Phase 10 schema-version reject is the documented user-facing flow |

No new threat surface introduced by Phase 7. Strict patch schemas tighten input validation (improvement).

## Sources

### Primary (HIGH confidence)

- `hub/src/sync/sessionCache.ts` (full file read) — every `publisher.emit` site enumerated
- `hub/src/sync/machineCache.ts` (full file read) — every `publisher.emit` site enumerated
- `hub/src/sync/messageService.ts` (lines 170–470 read) — confirmed no session/machine emits in this file
- `hub/src/sync/eventPublisher.ts` (full file read) — confirmed emit pipeline
- `hub/src/sync/syncEngine.ts` (lines 400–560 read) — flavor reader sites + historical defense block
- `hub/src/notifications/sessionInfo.ts` (full file read) — `getAgentName` flavor reader
- `web/src/hooks/useSSE.ts` (full file read) — 7 narrow functions + call sites + cache mutators
- `web/src/types/api.ts` (full file read) — Response wrapper inventory
- `cli/src/api/types.ts` (full file read) — duplicate Machine / RunnerState / Message wire declarations
- `cli/src/agent/sessionFactory.ts` (lines 1–200 read) — flavor writers
- `shared/src/schemas.ts` (full file read) — current schema state
- `shared/src/modes.ts` (full file read) — AGENT_MESSAGE_PAYLOAD_TYPE current value + JSDoc
- `shared/src/messages.ts` (full file read) — confirmed utilities-only, not schemas
- `shared/src/sessionSummary.ts` (full file read) — SessionSummary `flavor` propagator
- `scripts/check-no-cut-agents.sh` (lines 1–120 read) — current Phase-5 whitelist + post-filter
- `shared/package.json`, `hub/package.json`, `web/package.json` — version verification
- `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md` (Phase 7 SC#1-#4 section), `.planning/config.json` — phase scope + workflow flags

### Secondary (MEDIUM confidence)

- `.planning/phases/07-CONTEXT.md` (every decision verbatim re-mapped to source)
- `.planning/phases/05-CONTEXT.md`, `05-RESEARCH.md`, `06-CONTEXT.md` — inherited templates + anchored decisions
- `.planning/STATE.md` — prior-phase verification of `'codex'` literal exhaustion

### Tertiary (LOW confidence)

- None. All claims grounded in direct file read.

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — versions verified by direct file read of `package.json` files
- Architecture / responsibility map: HIGH — every reader/writer site grep-verified
- `publisher.emit` field set: HIGH — full file enumeration, not sampled
- Duplicate type inventory: HIGH — full file read of all four source `types.ts` files
- Common pitfalls: MEDIUM — Pitfall #1 (MetadataSchema strict-vs-strip) is a Zod-4 behaviour claim verified by docs but not by a live runtime test; recommend a 60-second smoke in slice 1 to confirm
- Test framework: HIGH — verified by prior phase summary commands

**Research date:** 2026-05-22
**Valid until:** 2026-06-21 (30-day window — wire-contract refactor scope is stable; Zod 4.x API will not drift)
