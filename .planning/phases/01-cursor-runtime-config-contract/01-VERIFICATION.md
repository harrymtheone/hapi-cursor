---
phase: 01-cursor-runtime-config-contract
verified: 2026-05-24T12:00:00Z
status: passed
score: 4/4 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 2/4
  gaps_closed:
    - "Active and inactive effort-only / modelReasoningEffort-only set-session-config return status failed (01-16); no success-like applied or applies-next-run."
    - "Late turn-completed after markMessageQueued is demoted while queued-thinking grace window is active (01-17)."
  gaps_remaining: []
  regressions: []
---

# Phase 1: Cursor Runtime Config Contract Verification Report

**Phase Goal:** Users can discover available Cursor runtime options, start sessions with selected model/effort, switch models in-session with truthful state, and scan live status from the mobile session list.
**Verified:** 2026-05-24T12:00:00Z
**Status:** passed
**Re-verification:** Yes — after gap-closure plans 01-16 and 01-17

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|---|---|---|
| 1 | User can discover available Cursor models from the local Cursor CLI before launch and sees a clear failure state when discovery fails. | VERIFIED | `discoverCursorModels` in `cli/src/cursor/modelDiscovery.ts` registered on `discover-cursor-models` RPC (`apiMachine.ts`); Hub `GET /api/machines/:id/cursor/models` via `syncEngine.discoverCursorModels`; Web `useCursorModels` + `ModelSelector` in composer/new-session flows. |
| 2 | User can start a Cursor session with selected model and effort, then see those values persisted in session metadata. | VERIFIED | `NewSession` sends `model: resolvedModel` only (no effort fields); Hub spawn rejects unsupported effort (`hasUnsupportedRuntimeEffort` in `machines.ts`); effort-only session-config returns `status: 'failed'` on CLI (`applyCursorSessionConfig`) and Hub inactive branch (`syncEngineSession.ts`); model persists via spawn/cache; effort displays read-only from session metadata (`StatusBar` `effortLabel`). |
| 3 | User can request an in-session model switch and see whether it applied, is pending, failed, or applies on the next run based on real CLI runtime behavior. | VERIFIED | `POST /api/sessions/:id/model` → `applySessionConfig({ model })`; CLI returns typed `CursorRuntimeConfigApplyResult`; Hub persists only on `applied`/`applies-next-run`; Web `SessionChat` / `StatusBar` render applying/applied/failed/applies-next-run. |
| 4 | User can scan each session's status, model, and effort from the mobile session list as live strict patches arrive. | VERIFIED | Durable `turnCompletionMarker` in store + `toSessionSummary()`; `SessionListItem` renders `statusKind`/`completionMarker` with accessible labels; `isStaleCompletion` guard in `sessionLivenessService.ts` prevents late `turn-completed` from re-persisting marker after `markMessageQueued()` (regression test at line 220). |

**Score:** 4/4 truths verified

### Deferred Items

None. Remaining gaps from prior verification are closed; no items deferred to later phases.

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `cli/src/cursor/modelDiscovery.ts` | Local model discovery | VERIFIED | Parses Cursor CLI model list; timeout/failure paths tested. |
| `hub/src/web/routes/machines.ts` | Spawn effort rejection + model route | VERIFIED | `hasUnsupportedRuntimeEffort()` returns 400 before spawn. |
| `cli/src/cursor/runCursor.ts` | Session config handler | VERIFIED | Effort-only returns `status: 'failed'`; model returns `applies-next-run`. |
| `hub/src/sync/syncEngineSession.ts` | Active/inactive config apply | VERIFIED | Inactive effort-only returns failed; `hasRuntimeConfigRequest` is model-only. |
| `hub/src/sync/sessionLivenessService.ts` | Completion marker + stale guard | VERIFIED | `isStaleCompletion` checks `pendingThinkingUntilBySessionId` before marker write. |
| `hub/src/store/sessions.ts` / `shared/src/sessionSummary.ts` | Durable completion marker | VERIFIED | Marker stored and derived into `statusKind: 'completed'`. |
| `web/src/components/SessionList/SessionListItem.tsx` | Compact status indicator | VERIFIED | Spinner/dot from `statusKind`; no row model/effort text (model/effort in chat status bar). |
| `web/src/api/client.ts` / `useSessionActions` | Model switch without effort mutation | VERIFIED | `setModel()` present; no `setEffort` or `/effort` route. |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| Web new-session | Hub spawn | `spawnSession({ model })` | WIRED | No effort fields in spawn payload. |
| Hub spawn | Runner | `spawnBodySchema` → RPC | WIRED | Unsupported effort rejected at boundary. |
| Model switch route | CLI runtime | `applySessionConfig` → `requestSessionConfig` → `applyCursorSessionConfig` | WIRED | Status-bearing result; persistence gated. |
| Effort-only config | Failed result | `applyCursorSessionConfig` / inactive `syncEngineSession` | WIRED | Probe and tests return `status: 'failed'`, not applied/applies-next-run. |
| `markMessageQueued` → late `turn-completed` | Stale demotion | `isStaleCompletion` + `touchSessionUpdatedAt` only | WIRED | Regression test locks thinking=true and null marker. |
| Ready completion | Authoritative summary | `setSessionTurnCompletionMarker` → `toSessionSummary` | WIRED | Basic refetch + stale-after-queue paths covered. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|---|---|---|---|---|
| `useCursorModels` | `models` | Runner RPC + Hub route | Yes | FLOWING |
| `applyCursorSessionConfig` | effort-only result | Session RPC | `status: 'failed'` with model echo | FLOWING |
| `toSessionSummary` | `completionMarker` | Durable store marker | Yes | FLOWING |
| `recordSessionActivity` | `turnCompletionMarker` | Guarded turn-completed | Stale events demoted during grace window | FLOWING |
| `SessionListItem` | `statusKind` | SSE patch / summary cache | Yes when source correct | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| Focused runtime/status tests | `bun test hub/src/sync/sessionLivenessService.test.ts hub/src/sync/syncEngineSession.test.ts shared/src/sessionSummary.test.ts cli/src/cursor/runCursor.test.ts cli/src/runner/run.test.ts` | 41 pass, 0 fail | PASS |
| Effort-only active config probe | `bun -e "applyCursorSessionConfig({ effort, modelReasoningEffort })"` | `{"status":"failed",...}` | PASS |
| Plan 01-16 artifacts | `gsd-sdk query verify.artifacts 01-16-PLAN.md` | 4/4 passed | PASS |

### Probe Execution

No phase-specific `scripts/**/tests/probe-*.sh` probes declared or discovered. Step 7c: SKIPPED.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| CURS-01 | 01-01–01-04, 01-03 | Discover Cursor models with clear failure state. | SATISFIED | Discovery RPC + Hub route + Web hook/selector. |
| CURS-02 | 01-02, 01-04, 01-11–01-16 | Start with model/effort metadata; truthful runtime config. | SATISFIED | Model spawn + persistence; effort read-only; effort-only config returns failed on CLI and Hub inactive paths. |
| CURS-03 | 01-05–01-07, 01-09 | In-session model switch with real CLI statuses. | SATISFIED | Model route, composer states, persistence gate. |
| CURS-04 | 01-08, 01-10, 01-13, 01-17 | Mobile session list live status via strict patches. | SATISFIED | Durable markers + stale late-ready guard + `SessionListItem` indicators. |

No orphaned Phase 1 requirement IDs in `.planning/REQUIREMENTS.md`.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|---|---:|---|---|---|
| — | — | None blocking | — | Prior success-like effort tests flipped to `status: 'failed'` expectations. |

No unreferenced `TBD`, `FIXME`, or `XXX` debt markers in gap-closure files.

### Human Verification Required

None. Prior blockers were observable in source and tests; automated checks now pass.

### Gaps Summary

Prior gaps from plans 01-16 and 01-17 are closed:

1. **Effort-only session-config** — `applyCursorSessionConfig` and inactive `SyncEngineSession.applySessionConfig` return typed `failed` results; tests at `runCursor.test.ts:83` and `syncEngineSession.test.ts:129` encode failed semantics; active probe confirms non-success-like response.
2. **Late turn-completed** — `isStaleCompletion` in `sessionLivenessService.ts:179` demotes stale activity during the queued-thinking grace window; regression test `recordSessionActivity ignores late turn-completed after markMessageQueued` passes.

Phase 1 goal is achieved. Ready to proceed to Phase 2.

---

_Verified: 2026-05-24T12:00:00Z_
_Verifier: Claude (gsd-verifier)_
