---
phase: 07-wire-contracts-unification-sse-patch-contract
verified: 2026-05-22T14:36:45Z
status: passed
score: 4/4 must-haves verified
overrides_applied: 0
---

# Phase 7: Wire Contracts Unification & SSE Patch Contract Verification Report

**Phase Goal:** `shared/` is the only source of `Session / Machine / Message / RunnerState` DTOs and SSE event payloads; the web client no longer guesses about the server contract.
**Verified:** 2026-05-22T14:36:45Z
**Status:** passed
**Re-verification:** No - initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|---|---|---|
| 1 | `Session`, `Machine`, `Message`, `RunnerState`, and their Zod schemas are defined exactly once in `shared/src/schemas.ts`; duplicate declarations are absent from cli/web/hub targets. | VERIFIED | `shared/src/schemas.ts` defines `MachineMetadataSchema`, `RunnerStateSchema`, `MachineSchema`, message schemas, `SessionPatchSchema`, `MachinePatchSchema`, and typed `SyncEventSchema`. Source sweep found no duplicate `Machine`, `RunnerStateSchema`, or `MachineMetadataSchema` declarations outside shared. `cli/src/api/types.ts` and `web/src/types/api.ts` are re-export shells. |
| 2 | `hasUnknownSessionPatchKeys()` and heuristic patch-key detection are removed; SSE uses strict patch schemas from shared. | VERIFIED | Source sweep found zero hits for `hasUnknownSessionPatchKeys`, `getSessionPatch`, local shape narrowers, and the invalidation queue symbols. `SessionPatchSchema` and `MachinePatchSchema` are strict in `shared/src/schemas.ts`. |
| 3 | Front-end SSE handlers consume the canonical schema directly and update TanStack Query cache without fallback-to-refetch branches. | VERIFIED | `web/src/hooks/useSSE.ts` parses incoming JSON with `SyncEventSchema.safeParse`, logs and drops malformed schema events, and branches on the typed discriminator. `web/src/hooks/useSSE.test.tsx` proves `backgroundTaskCount` patches mutate cache without `invalidateQueries`. |
| 4 | Typecheck/tests pass and new tests exercise the strictly typed event stream. | VERIFIED | Targeted verifier rerun passed: `cd shared && bun test schemas.test.ts` (30 tests), `cd hub && bun test src/sync/sessionCache.test.ts` (6 tests), `cd web && bun run test src/hooks/useSSE.test.tsx` (10 tests), and `bash scripts/check-no-cut-agents.sh`. Orchestrator evidence also reports full `bun typecheck && bun run test` and phase regression `bun run test` passed. |

**Score:** 4/4 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `shared/src/schemas.ts` | Canonical schemas and typed `SyncEventSchema` | VERIFIED | Contains canonical machine, runner, message, strict patch schemas, and `session-added`/`session-updated`/`machine-updated` typed data arms. `MetadataSchema` has no `flavor` field. |
| `shared/src/schemas.test.ts` | Shared schema and discriminator coverage | VERIFIED | 30 passing tests cover strict patch behavior, `backgroundTaskCount`, `session-added` full payload requirement, machine null/patch/full payloads, message content, and legacy `flavor` strip behavior. |
| `shared/src/responses.ts` | Shared response wrapper aliases | VERIFIED | Exports `SessionsResponse`, `SessionResponse`, `MessagesResponse`, `MachinesResponse`, and `SpawnResponse`. |
| `shared/src/types.ts` / `shared/src/index.ts` | Shared type surfacing | VERIFIED | `shared/src/types.ts` re-exports schema-derived wire types and response aliases; `shared/src/index.ts` exports `responses` type surface. SDK key-link regex missed this because symbols are split across multiline export blocks, but manual read verifies the link. |
| `shared/src/modes.ts` | Cursor wire envelope tag | VERIFIED | `AGENT_MESSAGE_PAYLOAD_TYPE = 'cursor' as const`; legacy codex anchor text absent. |
| `hub/src/sync/sessionCache.test.ts` | Hub emit contract test | VERIFIED | Captures representative `SessionCache` and `MachineCache` emits and validates each with `SyncEventSchema.safeParse`; includes exact `{ backgroundTaskCount }`, full-session config, `data:null`, and `{ active:false }` tests. |
| `hub/src/sync/machineCache.ts` | Shared machine metadata/runner schema consumption | VERIFIED | Imports `MachineMetadataSchema` and `RunnerStateSchema` from `@hapi/protocol/schemas`; no local machine metadata schema remains. |
| `hub/src/sync/eventPublisher.ts` | Dev/test schema drift self-check | VERIFIED | Runs non-production `SyncEventSchema.safeParse(event)` and logs violations without blocking listeners or SSE broadcast. |
| `cli/src/api/types.ts` | CLI wire mirror collapsed | VERIFIED | Uses `SessionSchema`/`MachineSchema`; re-exports shared machine, runner, and message schemas/types from `@hapi/protocol`; no local wire schema declarations remain. SDK regex missed the multiline import/export shape, but manual read verifies the link. |
| `web/src/types/api.ts` | Web wire mirror collapsed | VERIFIED | Re-exports shared session, machine, runner, response, and summary metadata types; keeps only web-local non-wire response shapes. |
| `web/src/hooks/useSSE.ts` | Strict SSE consumer | VERIFIED | Uses `SyncEventSchema.safeParse`; no deleted narrowers or invalidation queue symbols remain; malformed schema events log and drop. |
| `web/src/hooks/useSSE.test.tsx` | Strict event-stream tests | VERIFIED | Uses `renderHook` with `useSSE`, `MockEventSource`, and 10 passing tests over full, patch, null, and malformed events. SDK regex missed this because `renderHook` and `useSSE` are on separate lines, but manual read verifies the link. |
| `scripts/check-no-cut-agents.sh` | Phase 7 guard sweeps | VERIFIED | Contains Phase 7 D-126 sweeps for heuristic residue, duplicate wire declarations, `codex` literals, and metadata flavor writes; targeted guard rerun passed. |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `shared/src/types.ts` | `shared/src/schemas.ts` | Type re-export | VERIFIED | Multiline export block includes `Machine`, `MachineMetadata`, `MachinePatch`, `MessageContent`, `MessageMeta`, `RunnerState`, `SessionPatch`, and related wire types from `./schemas`. |
| `shared/src/index.ts` | `shared/src/responses.ts` | Barrel export | VERIFIED | `export type * from './responses'` is present. |
| `hub/src/sync/sessionCache.test.ts` | `@hapi/protocol/schemas` | Runtime contract assertion | VERIFIED | Imports `SyncEventSchema` and calls `SyncEventSchema.safeParse` for captured events. |
| `hub/src/sync/machineCache.ts` | `@hapi/protocol/schemas` | Shared schema imports | VERIFIED | Imports `MachineMetadataSchema` and `RunnerStateSchema`; calls `safeParse`. |
| `hub/src/sync/eventPublisher.ts` | `@hapi/protocol/schemas` | Non-production self-check | VERIFIED | Imports `SyncEventSchema`; calls `safeParse` in `emit`. |
| `cli/src/api/types.ts` | `@hapi/protocol/schemas` / `@hapi/protocol/types` | Wire schema/type re-export | VERIFIED | Imports `SessionSchema`/`MachineSchema`; re-exports `MachineMetadataSchema`, `RunnerStateSchema`, message schemas, and shared wire types. |
| `web/src/hooks/useSSE.ts` | `@hapi/protocol/schemas` | Runtime SSE validation | VERIFIED | Imports `SyncEventSchema` and `type SessionPatch`; calls `SyncEventSchema.safeParse(parsed)`. |
| `web/src/hooks/useSSE.test.tsx` | `web/src/hooks/useSSE.ts` | Hook integration | VERIFIED | Imports `useSSE`, mounts it with `renderHook`, and drives events through `MockEventSource`. |
| `scripts/check-no-cut-agents.sh` | `cli/src`, `hub/src`, `web/src`, `shared/src` | Guard sweeps | VERIFIED | `PHASE7_SOURCE_DIRS=(cli/src hub/src web/src shared/src)` and all six Phase 7 checks are present. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|---|---|---|---|---|
| `hub/src/sync/sessionCache.test.ts` | Captured `SyncEvent[]` | Real `SessionCache` / `MachineCache` methods backed by in-memory `Store` | Yes | VERIFIED - representative runtime emits parse through `SyncEventSchema`. |
| `hub/src/sync/eventPublisher.ts` | `event` | All hub publisher callers | Yes | VERIFIED - dev/test self-check validates event payload before listener/SSE fan-out without blocking delivery. |
| `web/src/hooks/useSSE.ts` | Parsed SSE `SyncEvent` | Browser `EventSource` message data parsed by `SyncEventSchema.safeParse` | Yes | VERIFIED - accepted events mutate Query cache; malformed schema events are dropped without refetch. |
| `web/src/hooks/useSSE.test.tsx` | Query cache state | `MockEventSource.dispatch()` with full, patch, null, and malformed event payloads | Yes | VERIFIED - assertions cover detail cache, session list cache, machines cache, and no-invalidate behavior. |
| `scripts/check-no-cut-agents.sh` | Ripgrep results | Runtime source trees in `cli/src`, `hub/src`, `web/src`, `shared/src` | Yes | VERIFIED - guard rerun passed and printed all Phase 7 success lines. |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| Shared strict patch schemas and typed `SyncEventSchema` work | `cd shared && bun test schemas.test.ts` | 30 pass, 0 fail | PASS |
| Hub representative emits conform to `SyncEventSchema` | `cd hub && bun test src/sync/sessionCache.test.ts` | 6 pass, 0 fail | PASS |
| Web strict SSE consumer updates cache without invalidation fallback | `cd web && bun run test src/hooks/useSSE.test.tsx` | 10 pass, 0 fail | PASS |
| Phase 7 source guard catches drift | `bash scripts/check-no-cut-agents.sh` | All Phase 7 guard lines passed, including no `hasUnknownSessionPatchKeys`, no `getSessionPatch`, no duplicate machine/schema declarations, no `codex` literals, and clean D-126 sweeps | PASS |
| Full phase gate | `bun typecheck && bun run test && bash scripts/check-no-cut-agents.sh` | Orchestrator evidence and 07-04 summary report pass; not re-run in full by verifier to keep verification focused | PASS |

### Probe Execution

No phase-declared `scripts/*/tests/probe-*.sh` probes were found or required for this phase. Step 7c: SKIPPED (no probe-based verification declared).

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| REFA-03 | 07-01, 07-02, 07-03, 07-04 | `shared/` is the only wire contract source; duplicate DTO/Zod mirrors removed from cli/hub/web. | SATISFIED | Canonical schemas and response aliases live in `shared/src`; `cli/src/api/types.ts` and `web/src/types/api.ts` re-export shared contracts; hub `machineCache` consumes shared schemas; Phase 7 guard duplicate-declaration sweeps passed. |
| REFA-04 | 07-01, 07-02, 07-03, 07-04 | SSE patch contract strict; no heuristic whole-list refetch in `useSSE`. | SATISFIED | `SessionPatchSchema` and `MachinePatchSchema` are strict; `SyncEventSchema` uses typed data arms; `useSSE` consumes `SyncEventSchema.safeParse`; deleted heuristic/invalidation symbols have zero source hits; web SSE tests prove `backgroundTaskCount` patch mutates cache without invalidation. |

No orphaned Phase 7 requirements found in `.planning/REQUIREMENTS.md`: traceability maps only REFA-03 and REFA-04 to Phase 7, and both appear in every Phase 7 plan frontmatter.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|---|---|---|---|---|
| None | - | - | - | No blocker debt markers (`TBD`, `FIXME`, `XXX`) found in modified Phase 7 source files. Matches for `return null` in `hub/src/sync/machineCache.ts` are legitimate control-flow for absent/invalid machine rows, not stubs. Matches for `flavor: 'cursor'` are limited to legitimate top-level resume-target fixtures or explicit schema strip tests, not metadata writes. |

### Human Verification Required

None. Phase 7 is a wire-contract, schema, test, and guard phase with observable automated evidence. No visual, external-service, or manual PWA flow is required for this phase's stated goal.

### Gaps Summary

No blocking gaps found. The two SDK key-link misses were false negatives caused by multiline import/export formatting, and manual source reads verified the actual wiring. The ROADMAP progress table still shows Phase 7 as in progress in the prose file, but `gsd-sdk query roadmap.analyze --raw` detects all 4 plans and summaries as complete; this is metadata drift, not a Phase 7 code-delivery gap.

---

_Verified: 2026-05-22T14:36:45Z_
_Verifier: Claude (gsd-verifier)_
