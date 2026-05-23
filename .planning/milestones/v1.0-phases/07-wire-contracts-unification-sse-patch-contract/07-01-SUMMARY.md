---
phase: 07-wire-contracts-unification-sse-patch-contract
plan: 01
subsystem: shared-wire-schema
tags: [wire-schema, zod, shared, sse-contract, patch-schema]
requires:
  - shared/src/schemas.ts: SessionSchema, SyncEventSchema (extended in-place)
  - shared/src/modes.ts: AGENT_MESSAGE_PAYLOAD_TYPE constant (renamed)
  - cli/src/api/types.ts: MachineMetadataSchema source for verbatim lift
provides:
  - SessionPatchSchema, MachinePatchSchema (strict, in shared)
  - MachineSchema, MachineMetadataSchema, RunnerStateSchema (shared canonical)
  - MessageMetaSchema, UserMessageSchema, AgentMessageSchema, MessageContentSchema (shared)
  - shared/src/responses.ts: SessionsResponse/SessionResponse/MessagesResponse/MachinesResponse/SpawnResponse
  - SyncEventSchema.data tightened on session-added | session-updated | machine-updated
  - AGENT_MESSAGE_PAYLOAD_TYPE = 'cursor'
affects:
  - hub: emit-shape conformance partially advanced (slice 2 territory) to keep slice-1 gate green
  - web: flavor-display readers collapsed to 'cursor' literal (slice 3 territory) to keep slice-1 gate green
  - cli: sessionFactory metadata flavor write deleted (slice 3 territory) to keep slice-1 gate green
tech-stack:
  added: []
  patterns:
    - schema-co-location-and-re-export
    - safeParse-discriminator-branch
    - strict-reject-patch-schema (vs default-strip Metadata)
key-files:
  created:
    - shared/src/responses.ts
    - shared/src/schemas.test.ts
  modified:
    - shared/src/schemas.ts
    - shared/src/modes.ts
    - shared/src/sessionSummary.ts
    - shared/src/types.ts
    - shared/src/index.ts
    - cli/src/agent/sessionFactory.ts
    - cli/src/agent/sessionFactory.test.ts
    - hub/src/notifications/sessionInfo.ts
    - hub/src/sync/syncEngine.ts
    - hub/src/web/routes/permissions.ts
    - hub/src/web/routes/sessions.ts
    - hub/src/web/routes/sessions.test.ts
    - hub/src/socket/handlers/cli/sessionHandlers.ts
    - hub/src/socket/handlers/cli/machineHandlers.ts
    - hub/src/sync/machineCache.ts
    - hub/src/notifications/eventParsing.test.ts
    - hub/src/notifications/notificationHub.test.ts
    - hub/src/sse/sseManager.test.ts
    - web/src/components/SessionChat.tsx
    - web/src/components/SessionHeader.tsx
    - web/src/components/SessionList.tsx
    - web/src/components/SessionList.test.ts
    - web/src/components/SessionList.directory-action.test.tsx
    - web/src/router.tsx
key-decisions:
  - Place all wire schemas (Machine, RunnerState, MachineMetadata, Message wire, SessionPatch, MachinePatch) inside shared/src/schemas.ts (not messages.ts) per RESEARCH §4 — single Zod source of truth.
  - responses.ts is a separate TS-only module (mirrors sessionSummary.ts precedent) since the wrappers carry no Zod runtime.
  - SessionPatchSchema uses explicit per-field .optional() (not .strict().partial()) so individual shape entries are queryable in tests.
  - MetadataSchema kept as default z.object() (silent strip) per Pitfall #1 — old SQLite rows with metadata.flavor parse without error; field is dropped on output.
  - session-added.data narrows to SessionSchema strict-full (not a union) per RESEARCH §5 — sessionCache.refreshSession is the only emitter and always passes a full Session.
  - Cascading slice-2/slice-3 fixes folded inline as Rule-3 deviations (see Deviations section below) to keep the slice-1 workspace gate green.
metrics:
  duration: ~25min
  completed_at: "2026-05-22T13:10:00Z"
---

# Phase 7 Plan 1: Wire-contracts unification — Slice 1 (shared schema lift) Summary

Single source of wire schema landed in `shared/src/`. `SessionPatchSchema` and `MachinePatchSchema` are strict; `SyncEventSchema.data` is no longer `z.unknown()` on the three patchable variants; the `backgroundTaskCount` single-field session-updated patch (the smoking-gun fixture for the `hasUnknownSessionPatchKeys` heuristic refetch bug) now parses successfully end-to-end. `flavor` is gone from `MetadataSchema` and `SessionSummaryMetadata`; `AGENT_MESSAGE_PAYLOAD_TYPE` is `'cursor'`.

## Placement Choice

- **`schemas.ts`** received `MachineMetadataSchema`, `RunnerStateSchema`, `MachineSchema`, `MessageMetaSchema`, `UserMessageSchema`, `AgentMessageSchema`, `MessageContentSchema`, `SessionPatchSchema`, `MachinePatchSchema`. Co-located with `SessionSchema` + `SyncEventSchema` so the discriminatedUnion reference resolves locally without a circular import.
- **`responses.ts`** (new, TS-only) hosts the 5 stable HTTP wrappers — mirrors `sessionSummary.ts` precedent (pure TS aliases, no Zod).
- `messages.ts` was rejected as a placement target — it is utility predicates only, not schemas.

## Pitfall #1 confirmation (live test)

`MetadataSchema.safeParse({ path: '/x', host: 'h', flavor: 'cursor' })` → `success === true` AND `'flavor' in result.data === false`. The legacy SQLite `metadata.flavor` value is silently stripped (Zod-4 default `.object()` behaviour, NOT `.strict()`). This is the intended outcome — old DB rows continue to decode without error, and the field disappears from the parsed output. The `SessionSchema` strip case is also covered explicitly (a Session whose nested metadata carries `flavor: 'cursor'` parses; the strip propagates).

## MachineMetadataSchema shape decision

The shared `MachineMetadataSchema` was lifted **verbatim from `cli/src/api/types.ts`** (strict required `host/platform/happyCliVersion/homeDir/happyHomeDir/happyLibDir` + `.transform` for `workspaceRoot ↔ workspaceRoots`). RESEARCH §2 Open Question 1 raised the option of adopting hub's looser all-optional shape; researcher recommendation was the looser shape, but the cli verbatim shape was chosen because:

1. The cli is the canonical writer (`buildMachineMetadata` always populates every field).
2. Adopting all-optional would weaken downstream type-safety for hub readers (machines now have to null-check every field).
3. Hub's defensive `'unknown'` fallback is preserved at the **read site** (`machineCache.refreshMachine`) so legacy / stale entries still produce a valid shared Machine.

The `'unknown'` fallback was added to homeDir/happyHomeDir/happyLibDir in `hub/src/sync/machineCache.ts:97-105` to preserve hub's defensive read behaviour without weakening the shared contract.

## Test count + final gate

- `shared/src/schemas.test.ts` → **30 tests pass** (SessionPatchSchema 11, MachinePatchSchema 4, SyncEventSchema data union 9, MessageContentSchema 3, MetadataSchema strip 1, MachineSchema 1, SessionSchema 1).
- Workspace `bun typecheck` exits 0 (cli + web + hub).
- Workspace `bun run test` exits 0 — **532 tests pass** across cli/hub/web/shared (matches the Phase 6 gate baseline of 532; one cli sessionFactory.test fixture was updated to drop the deleted `flavor:` arg from the toHaveBeenCalledWith expectation).
- `scripts/check-no-cut-agents.sh` exits 0 (existing P5/P6 sweeps still green; the Phase-7 D-126 sweep block lands in slice 4).

## Deviations from Plan

The plan's Slice 1 was scoped to "shared schema lift" with a workspace-wide `bun typecheck` gate at the end (Task 3). Pitfall #2 in RESEARCH already noted that the SyncEventSchema.data tightening would surface compile errors in hub/cli/web emit + read sites at the slice boundary. Those errors did surface, and the slice-2 / slice-3 work needed to be partially absorbed inline to keep the gate green. All deviations are Rule-3 mechanical auto-fixes (no architectural changes); they exclusively trim flavor reads/writes already mapped in RESEARCH §7 and adjust SyncEvent emit shapes to match the tightened union. The next slices (07-02 hub broadcast conformance, 07-03 cli+web mirror collapse) will continue from this baseline; the deviations below should be **subtracted from those slices' plans** before re-planning.

### Auto-fixed Issues (Rule 3 — blocking compile errors triggered by Slice-1 schema tightening)

**1. [Rule 3 — slice-2/3 absorption] cli `sessionFactory.ts` flavor write**
- Trigger: `MetadataSchema.flavor` deletion broke the typed `Metadata` literal in `buildSessionMetadata` (line 80).
- Fix: deleted the `flavor: options.flavor,` write line. The `flavor: string` field on `SessionBootstrapOptions` and `buildSessionMetadata` opts param is **kept** (still consumed by callers in cli; full pruning is slice-3 territory and out of scope here). Test fixture in `sessionFactory.test.ts:64` had a `flavor: 'cursor'` literal inside a typed `Metadata`-shaped object → deleted; the matching `notifyRunnerSessionStartedMock` `expect.objectContaining` no longer asserts `flavor`.
- Files: `cli/src/agent/sessionFactory.ts`, `cli/src/agent/sessionFactory.test.ts`.
- Commit: `ca9cc65`.

**2. [Rule 3 — slice-2 absorption] hub `getAgentName` flavor read**
- Trigger: `MetadataSchema.flavor` deletion broke `session.metadata?.flavor` read at `hub/src/notifications/sessionInfo.ts:15`.
- Fix: collapsed `getAgentName(session)` to `return 'Cursor'` (Cursor-only by D-69; the dynamic label was already always `'Cursor'` post-Phase-5).
- Files: `hub/src/notifications/sessionInfo.ts`.
- Commit: `ca9cc65`.

**3. [Rule 3 — slice-2 absorption] hub `syncEngine.ts` historical-flavor defense block**
- Trigger: `MetadataSchema.flavor` deletion broke the `metadata.flavor` read at `syncEngine.ts:514` (RESEARCH Pitfall #3 anticipated this exact line).
- Fix: deleted the entire `historicalFlavor != null && historicalFlavor !== 'cursor'` defense block (lines 507-521). After D-122 the field cannot exist on the parsed `Metadata`, so the branch is unreachable by construction. Restored the `metadata` local for the surrounding machine-resolution code that still reads `metadata.machineId` / `metadata.host`.
- Files: `hub/src/sync/syncEngine.ts`.
- Commit: `ca9cc65`.

**4. [Rule 3 — slice-2 absorption] hub web routes flavor reads**
- Trigger: 5 `?? 'cursor'` fallbacks against `metadata.flavor` (`hub/src/web/routes/permissions.ts:59`, `hub/src/web/routes/sessions.ts:145,293,331,414`).
- Fix: collapsed each to the `'cursor'` literal, matching D-122's intent. The helper functions `isPermissionModeAllowedForFlavor` / `getPermissionModesForFlavor` / `supportsModelChange` are not collapsed (deferred to Phase 9 per RESEARCH Open Question 2). The `routes/sessions.test.ts` fixtures at lines 84/102/122/147/175 had typed `Metadata` literals containing `flavor: 'cursor'` → stripped.
- Files: `hub/src/web/routes/permissions.ts`, `hub/src/web/routes/sessions.ts`, `hub/src/web/routes/sessions.test.ts`.
- Commit: `ca9cc65`.

**5. [Rule 3 — slice-2 absorption] hub `sessionHandlers` and `machineHandlers` emit shapes**
- Trigger: `SyncEventSchema.data` tightening rejected ad-hoc `data: { sid }` and `data: { id }` payloads at four `session-updated` emits (`sessionHandlers.ts:113,124,205,251`) and two `machine-updated` emits (`machineHandlers.ts:92,136`).
- Fix:
  - For `session-updated` emits, replaced `data: { sid }` with `data: { updatedAt: <timestamp> }` — a valid empty/`{updatedAt}`-only `SessionPatch`. Semantics preserved: the web side's existing patch handler treats single-field updates as cache mutations.
  - For `machine-updated` emits, replaced `data: { id }` with `data: null` — under the new `Machine | MachinePatch | null` union, `null` is the safest signal that lets the web treat it as "machine state change, refresh needed". The proper full-machine emit happens via `MachineCache.refreshMachine` after the `metadata-update`/`state-update` round-trip; these socket-handler emits are best-effort notifications.
- Files: `hub/src/socket/handlers/cli/sessionHandlers.ts`, `hub/src/socket/handlers/cli/machineHandlers.ts`.
- Commit: `ca9cc65`.

**6. [Rule 3 — slice-2 absorption] hub `MachineCache` local `interface Machine` collision**
- Trigger: The `publisher.emit({ type: 'machine-updated', ..., data: machine })` at `machineCache.ts:127,154` failed because hub's local `interface Machine` is a distinct nominal/structural type from the (now wired) shared `Machine` (the local interface was looser: `runnerState: unknown | null`, optional `homeDir/happyHomeDir/happyLibDir`).
- Fix: deleted the local `interface Machine` and replaced it with `import type { Machine } from '@hapi/protocol/types'` + `export type { Machine }` (preserves downstream importers that did `from './machineCache'`). Added `RunnerStateSchema.safeParse(stored.runnerState)` so the cache's parsed `Machine` value populates `runnerState: RunnerState | null` instead of `unknown`. Defaulted missing `homeDir/happyHomeDir/happyLibDir` to `'unknown'` to satisfy the shared shape's required-string contract while preserving the prior defensive-read behaviour.
- Files: `hub/src/sync/machineCache.ts`.
- Commit: `ca9cc65`.

**7. [Rule 3 — slice-2 absorption] hub test fixtures requiring `data` field**
- Trigger: After tightening, `session-updated` requires a `data` field. Three test files emitted `{ type: 'session-updated', sessionId: 'x' }` without `data`.
- Fix: added `data: {}` (a valid empty SessionPatch under the strict-but-all-optional schema).
- Files: `hub/src/notifications/eventParsing.test.ts`, `hub/src/notifications/notificationHub.test.ts`, `hub/src/sse/sseManager.test.ts`.
- Commit: `ca9cc65`.

**8. [Rule 3 — slice-3 absorption] web `metadata.flavor` reads (compile-only, behavior preserved)**
- Trigger: 4 web sites that read `metadata.flavor` via `?? 'cursor'` or `?? null` fell over after the field was removed.
- Fix:
  - `web/src/components/SessionChat.tsx:111`: `agentFlavor` now hard-coded to `'cursor'`.
  - `web/src/components/SessionHeader.tsx:111,160`: `useSessionActions` second arg → `'cursor'`; the inline `{session.metadata?.flavor?.trim() || 'unknown'}` label collapsed to literal `cursor`.
  - `web/src/components/SessionList.tsx:418,564,594`: dropped `metadata?.flavor` from search index; `useSessionActions` second arg → `'cursor'`; `<FlavorIcon flavor={...}>` prop → `flavor="cursor"`.
  - `web/src/router.tsx:340`: `agentType = 'cursor'`.
  - Test fixtures at `SessionList.test.ts:92` and `SessionList.directory-action.test.tsx:53` had `flavor: 'cursor'` inside `SessionSummaryMetadata`-typed objects → stripped.
- Files: `web/src/components/SessionChat.tsx`, `web/src/components/SessionHeader.tsx`, `web/src/components/SessionList.tsx`, `web/src/components/SessionList.test.ts`, `web/src/components/SessionList.directory-action.test.tsx`, `web/src/router.tsx`.
- Note: This does NOT delete `FlavorIcon` / `FLAVOR_BADGES` / the rest of the slice-3 web cleanup (per RESEARCH §7 and Pitfall #4); those are still on slice 3's plate. Only the type-error-triggering reads were patched.
- Commit: `ca9cc65`.

### Slice 2 / Slice 3 implications

The next two plans should be re-scoped:

- **07-02 (hub broadcast)**: Already-deleted: `hub/src/notifications/sessionInfo.ts::getAgentName` flavor read, `hub/src/sync/syncEngine.ts:507-521` historical-flavor defense block, `hub/src/web/routes/sessions.ts` + `permissions.ts` `?? 'cursor'` fallbacks, `hub/src/web/routes/sessions.test.ts` flavor fixtures, `hub/src/sync/machineCache.ts` local `interface Machine` + local `machineMetadataSchema` (still used inside the cache for the optional-tolerant decode but no longer the canonical shape — slice 2 may wish to delete the local schema entirely and switch to shared `MachineMetadataSchema.safeParse` directly if defensive optional-ness is dropped). The actual `sessionCache.ts` patch-emit conformance audit (D-127#3 contract test fixture run, RESEARCH §1 13-emit-site enumeration) is **still on slice 2**.

- **07-03 (cli + web collapse)**: cli `sessionFactory.ts:80` flavor write already deleted; cli `sessionFactory.test.ts:64,112` already updated. Web `SessionChat / SessionHeader / SessionList / router` flavor reads already collapsed to constants. **Still on slice 3**: deleting the `flavor: string` field from `SessionBootstrapOptions` / `buildSessionMetadata` opts; deleting `cli/src/cursor/runCursor.ts:54,59` `flavor: 'cursor'` keys; deleting `cli/src/agent/types.ts:74` `opts?: { flavor?: AgentFlavor }`; deleting `web/src/types/api.ts` local `Machine` / `RunnerState` / `SessionMetadataSummary.flavor` and replacing with shared re-exports; deleting `useSSE.ts` 7 narrow functions + invalidation queue; deleting `FlavorIcon` / `FLAVOR_BADGES` / their UI consumers; cli `api/types.ts` re-export of shared `MachineSchema` etc.

## Self-Check: PASSED

- ✓ FOUND: shared/src/schemas.ts (modified)
- ✓ FOUND: shared/src/modes.ts (modified)
- ✓ FOUND: shared/src/sessionSummary.ts (modified)
- ✓ FOUND: shared/src/responses.ts (created)
- ✓ FOUND: shared/src/schemas.test.ts (created — 30 tests pass)
- ✓ FOUND: shared/src/types.ts (modified)
- ✓ FOUND: shared/src/index.ts (modified)
- ✓ FOUND: commit afacc1a (Task 1 schema modifications)
- ✓ FOUND: commit 4514689 (Task 2 schemas.test.ts)
- ✓ FOUND: commit ca9cc65 (Task 3 cascade fixes)
- ✓ Workspace `bun typecheck` exits 0
- ✓ Workspace `bun run test` exits 0 (532 tests)
