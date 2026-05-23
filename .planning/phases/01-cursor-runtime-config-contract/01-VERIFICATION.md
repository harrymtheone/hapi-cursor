---
phase: 01-cursor-runtime-config-contract
verified: 2026-05-23T17:46:31Z
status: gaps_found
score: 2/4 must-haves verified
overrides_applied: 0
gaps:
  - truth: "User can start a Cursor session with selected model and effort, then see those values persisted in session metadata."
    status: failed
    reason: "Effort/modelReasoningEffort are accepted and persisted through API/session metadata paths but are not passed to the spawned Cursor process, so the UI/store can claim selected runtime config while Cursor launches with defaults."
    artifacts:
      - path: "cli/src/runner/run.ts"
        issue: "buildCliArgs emits --model but drops effort and modelReasoningEffort."
      - path: "web/src/api/client.ts"
        issue: "setEffort posts to /api/sessions/:id/effort, but no matching Hub route exists."
      - path: "hub/src/web/routes/sessions/config.ts"
        issue: "Only permission-mode and model config routes are mounted."
    missing:
      - "Either pass supported Cursor CLI effort flags at launch/resume, or remove/reject unsupported effort fields before persistence and selected-runtime rejection classification."
      - "Add launch argument coverage for model, effort, modelReasoningEffort, and resumed-session runtime fields."
      - "Remove or fully wire the exposed effort mutation contract."
  - truth: "User can scan each session's status, model, and effort from the mobile session list as live strict patches arrive."
    status: failed
    reason: "Unread turn-completion status exists only as a transient session-updated patch. Authoritative session refetch recomputes summaries from persisted Session data and loses statusKind=completed/completionMarker for still-active sessions."
    artifacts:
      - path: "hub/src/sync/sessionLivenessService.ts"
        issue: "recordSessionActivity emits completionMarker/statusKind but only persists updatedAt."
      - path: "shared/src/sessionSummary.ts"
        issue: "toSessionSummary derives completed markers only from endReason === 'completed', not from durable ready-turn completion state."
      - path: "hub/src/store/sessions.ts"
        issue: "No durable per-session field stores turn-completion status or marker."
    missing:
      - "Persist turn-completion marker/status or another durable per-session attention field."
      - "Have toSessionSummary derive completed unread state from that durable value after /api/sessions refetch."
      - "Clear the durable completion marker when new work starts."
deferred: []
---

# Phase 1: Cursor Runtime Config Contract Verification Report

**Phase Goal:** Users can discover available Cursor runtime options, start sessions with selected model/effort, switch models in-session with truthful state, and scan live status from the mobile session list.
**Verified:** 2026-05-23T17:46:31Z
**Status:** gaps_found
**Re-verification:** No - previous report had no structured gaps; later code review introduced blocker evidence.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|---|---|---|
| 1 | User can discover available Cursor models from the local Cursor CLI before launch and sees a clear failure state when discovery fails. | VERIFIED | `cli/src/cursor/modelDiscovery.ts` runs `spawn('agent', ['models'])`, preserves raw ids, categorizes safe failures, and is wired through machine RPC, `GET /api/machines/:id/cursor/models`, `ApiClient.getCursorModels`, and `useCursorModels`. |
| 2 | User can start a Cursor session with selected model and effort, then see those values persisted in session metadata. | FAILED | Model is passed as `--model`, but `buildCliArgs()` does not emit effort/modelReasoningEffort flags even though spawn/API/session metadata paths accept those fields. Persisted metadata can diverge from runtime launch state. |
| 3 | User can request an in-session model switch and see whether it applied, is pending, failed, or applies on the next run based on real CLI runtime behavior. | VERIFIED | `runCursor` validates runtime config and returns status-bearing applies-next-run for unproven model/effort hot switch; Hub gates persistence on applied/applies-next-run; Web renders result in composer status without timeline messages. |
| 4 | User can scan each session's status, model, and effort from the mobile session list as live strict patches arrive. | FAILED | Live status patches converge, but unread completion state is not durable. A normal ready-turn completion patch sets `completionMarker`; a later authoritative `/api/sessions` refetch calls `toSessionSummary()` and drops it unless `endReason === 'completed'`. |

**Score:** 2/4 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `shared/src/schemas.ts` | Discovery/apply schemas and strict patches | VERIFIED | Discovery/apply schemas exist; `SessionPatchSchema` includes model/effort/status marker fields and remains strict. |
| `cli/src/cursor/modelDiscovery.ts` | Local Cursor CLI model discovery | VERIFIED | Uses argument-array spawn, timeout, safe reasons, and no static model catalog. |
| `hub/src/web/routes/machines.ts` | Authenticated discovery and spawn route | PARTIAL | Discovery route is wired. Spawn route accepts effort/modelReasoningEffort and forwards them, but downstream runner launch drops them. |
| `cli/src/runner/run.ts` | Explicit runtime launch | FAILED | `buildCliArgs()` emits `--model` only; selected effort fields do not reach Cursor launch. |
| `hub/src/sync/syncEngineSession.ts` | Runtime acknowledgement persistence gate | VERIFIED | Persists acknowledged applied/applies-next-run fields and avoids failed persistence. |
| `hub/src/web/routes/sessions/config.ts` | Runtime config routes | PARTIAL | Model route is status-bearing. Effort route is absent despite Web client/hook code exposing it. |
| `web/src/components/AssistantChat/StatusBar.tsx` | Composer model/effort display and switch feedback | VERIFIED | Renders raw model/auto, optional effort metadata, and switch feedback in composer controls. |
| `web/src/components/SessionList/SessionListItem.tsx` | Compact accessible list status | VERIFIED | Renders spinner/dot indicators with labels and no visible model/effort text. |
| `hub/src/sync/sessionLivenessService.ts` | Completion marker source | PARTIAL | Emits live completion marker patches but does not persist durable marker state. |
| `shared/src/sessionSummary.ts` | Authoritative summary derivation | PARTIAL | Correctly treats blank active sessions as idle, but cannot reconstruct live ready-turn completion after refetch. |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| Web discovery | Local Cursor CLI | `useCursorModels` -> `ApiClient.getCursorModels` -> Hub route -> `RpcGateway.discoverCursorModels` -> CLI `discoverCursorModels()` | WIRED | Source and focused tests confirm real local discovery path. |
| Selected model launch | Cursor process | `NewSession` -> `spawnSession` -> Hub/RPC -> `buildCliArgs()` | WIRED | Explicit model becomes `--model`. |
| Selected effort launch | Cursor process | spawn/API/RPC fields -> `buildCliArgs()` | NOT_WIRED | `buildCliArgs()` drops effort and modelReasoningEffort. |
| In-session model switch | CLI acknowledgement | `POST /api/sessions/:id/model` -> `applySessionConfig` -> `set-session-config` | WIRED | Returns status-bearing result and does not claim unsupported hot switching. |
| Ready-turn completion | Session list live cache | CLI ready activity -> `SessionLivenessService.recordSessionActivity` -> SSE patch -> `useSSE` | PARTIAL | Works for live patch cache, but not for authoritative refetch/reload. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|---|---|---|---|---|
| `ModelSelector.tsx` / `useCursorModels.ts` | `result.models` | `agent models` through machine RPC | Yes | FLOWING |
| `NewSession/index.tsx` | `resolvedModel` | User-selected discovered raw id; auto maps to undefined | Yes | FLOWING |
| `buildCliArgs()` | `options.effort`, `options.modelReasoningEffort` | Hub spawn body / stored resume target | No | DISCONNECTED |
| `StatusBar.tsx` | `model`, `modelReasoningEffort`, `effort`, `modelSwitchState` | Session fields plus model route result | Yes | FLOWING |
| `SessionListItem.tsx` | `statusKind`, `completionMarker`, `completionViewed` | Live SSE patch and local viewed state | Partially | HOLLOW AFTER REFETCH |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| Shared schema/status contracts | `cd shared && bun test sessionSummary.test.ts schemas.test.ts` | 41 pass, 0 fail | PASS |
| Hub config/discovery/status tests | `cd hub && bun test ...sessionLivenessService... sessionModel... config... machines...` | 56 pass, 0 fail | PASS |
| Web discovery/session/composer/list/SSE tests | `cd web && bun run test -- useSSE SessionListItem SessionChat HappyComposer useCursorModels NewSession` | 66 pass, 0 fail; duplicate React key warnings remain | PASS_WITH_WARNING |
| CLI runtime focused tests | `cd cli && bun run test -- modelDiscovery runCursor run` | Non-integration matched files passed through `modelDiscovery`, `runCursor`, `run`, and `buildCliArgs`; command then entered known runner integration hang and was stopped | PARTIAL |
| Root typecheck | `bun run typecheck` | Passed across CLI, Web, and Hub | PASS |

### Probe Execution

No phase-specific `scripts/**/tests/probe-*.sh` probes were declared or discovered for this phase.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| CURS-01 | 01-01, 01-02, 01-03, 01-04 | Discover available Cursor models from local CLI with clear failure state. | SATISFIED | Discovery runs through local `agent models`, safe schemas, Hub route, Web hook, and selector states. |
| CURS-02 | 01-04 | Start a Cursor session with selected model/effort and see values persisted in session metadata. | BLOCKED | Model launch works. Effort/modelReasoningEffort can be accepted/persisted but are not passed to Cursor launch args. |
| CURS-03 | 01-01, 01-05, 01-06, 01-07, 01-09 | Request in-session model switch and see truthful applied/pending/failed/applies-next-run state. | SATISFIED | Model route and composer state use status-bearing apply results; unproven hot switch returns applies-next-run. |
| CURS-04 | 01-01, 01-07, 01-08, 01-10 | Scan session status/model/effort from mobile, updated live through strict patches. | BLOCKED | Live patches work, but unread completion status can be erased by normal authoritative refetch. |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|---|---:|---|---|---|
| `web/src/api/client.ts` | 358 | Exposed `setEffort()` posts to missing route | WARNING | Partially implemented effort mutation contract; compounds the selected-effort gap. |
| `web/src/components/SessionChat.test.tsx` | n/a | Duplicate React key warning during tests | WARNING | Known existing warning; not a blocker for Phase 1 goal, but should be cleaned up. |

### Human Verification Required

Human mobile UAT should wait until the blocker gaps are closed. Current failures are observable in source and do not require a human decision.

### Gaps Summary

Two blockers prevent Phase 1 from achieving the roadmap goal:

1. The selected runtime launch contract is incomplete for effort/modelReasoningEffort. The system accepts and persists these fields, and even labels failures as selected-runtime-config failures, but the runner only passes `--model` to Cursor.
2. Session-list unread completion status is not durable. Live SSE patches can show the green completion indicator, but a refetch/reload/reconnect convergence path rebuilds summaries from persisted sessions and loses that state.

Next recommended action: run `/gsd-plan-phase --gaps` for Phase 01 and close these two gaps before proceeding.

---

_Verified: 2026-05-23T17:46:31Z_
_Verifier: Claude (gsd-verifier)_
