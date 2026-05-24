---
phase: 01-cursor-runtime-config-contract
verified: 2026-05-24T02:24:09Z
status: gaps_found
score: 2/4 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 2/4
  gaps_closed:
    - "Hub spawn boundary rejects unsupported effort/modelReasoningEffort before session creation."
    - "Web no longer exposes a separate effort mutation and sends selected model only from new-session spawn."
    - "Runner spawn contract exposes model only; selected-runtime-config-rejected is scoped to explicit model launch failure."
    - "Durable turnCompletionMarker exists in store/schema/summary and survives basic authoritative refetch."
  gaps_remaining:
    - "Unsupported effort-only session-config requests still receive success-like acknowledgements on active and inactive paths."
    - "A late ready/turn-completed event after new work can re-persist a stale completion marker and flip the row back to completed."
  regressions: []
gaps:
  - truth: "User can start a Cursor session with selected model and effort, then see those values persisted in session metadata."
    status: partial
    reason: "Unsupported effort/modelReasoningEffort can no longer be sent from Web spawn or Hub spawn, but internal session-config paths still acknowledge effort-only payloads as applied/applies-next-run instead of failing/no-op reporting. That leaves the public runtime config contract success-like for unsupported effort while Cursor effort support is unverified."
    artifacts:
      - path: "cli/src/cursor/runCursor.ts"
        issue: "applyCursorSessionConfig({ effort, modelReasoningEffort }) returns { applied: { permissionMode } } when no model is present."
      - path: "hub/src/sync/syncEngineSession.ts"
        issue: "Inactive applySessionConfig returns status: applies-next-run for effort-only payloads because hasRuntimeConfigRequest includes unsupported effort fields."
      - path: "hub/src/sync/syncEngineSession.test.ts"
        issue: "Existing tests assert success-like effort-only behavior instead of rejection/no-op semantics."
    missing:
      - "Return an explicit failed/no-op runtime config result for effort-only or modelReasoningEffort-only active RPC payloads."
      - "Return an explicit failed/no-op runtime config result for inactive effort-only requests instead of applies-next-run."
      - "Add active and inactive tests proving unsupported effort-only config is not success-like and is not persisted."
  - truth: "User can scan each session's status, model, and effort from the mobile session list as live strict patches arrive."
    status: failed
    reason: "New work clears the durable completion marker, but a delayed ready/turn-completed event can still run after that clear and re-persist completionMarker/statusKind=completed, making an in-progress row look completed/unread."
    artifacts:
      - path: "hub/src/sync/sessionLivenessService.ts"
        issue: "recordSessionActivity(..., { kind: 'turn-completed' }) unconditionally writes setSessionTurnCompletionMarker, sets thinking=false, and deletes pendingThinkingUntilBySessionId."
      - path: "hub/src/sync/sessionLivenessService.test.ts"
        issue: "Tests cover clear-on-new-work and persist-on-ready separately, but not late ready after new work."
    missing:
      - "Ignore or demote stale turn-completed activity while a queued-thinking grace window is active for newer work."
      - "Add a regression test: complete a turn, call markMessageQueued(), deliver late turn-completed activity, and assert thinking stays true plus in-memory/store turnCompletionMarker remain null."
deferred: []
---

# Phase 1: Cursor Runtime Config Contract Verification Report

**Phase Goal:** Users can discover available Cursor runtime options, start sessions with selected model/effort, switch models in-session with truthful state, and scan live status from the mobile session list.
**Verified:** 2026-05-24T02:24:09Z
**Status:** gaps_found
**Re-verification:** Yes - after gap closure plans 01-11 through 01-15 and code review.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|---|---|---|
| 1 | User can discover available Cursor models from the local Cursor CLI before launch and sees a clear failure state when discovery fails. | VERIFIED | `cli/src/cursor/modelDiscovery.ts` and `cli/src/api/apiMachine.ts` wire `discover-cursor-models` to local Cursor model discovery; Hub exposes `GET /api/machines/:id/cursor/models`; Web uses `useCursorModels`/`ModelSelector`. Prior focused tests remain present. |
| 2 | User can start a Cursor session with selected model and effort, then see those values persisted in session metadata. | FAILED | Spawn-time unsupported effort is blocked and Web effort mutation is removed, but effort-only session-config is still success-like: `applyCursorSessionConfig({ effort, modelReasoningEffort })` returned `{"applied":{"permissionMode":"default"}}`; inactive Hub config returns `applies-next-run` for unsupported effort-only payloads. |
| 3 | User can request an in-session model switch and see whether it applied, is pending, failed, or applies on the next run based on real CLI runtime behavior. | VERIFIED | `POST /api/sessions/:id/model` calls `applySessionConfig({ model })`; active CLI returns a parsed status-bearing `CursorRuntimeConfigApplyResult`; Hub persists only acknowledged `model`; Web composer renders applied/pending/failed/applies-next-run locally. |
| 4 | User can scan each session's status, model, and effort from the mobile session list as live strict patches arrive. | FAILED | Durable markers now survive basic refetch, but `recordSessionActivity(... turn-completed)` can re-persist a stale completion marker after `markMessageQueued()` has cleared it for new work. This violates the required "cleared by new work" behavior. |

**Score:** 2/4 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `hub/src/web/routes/machines.ts` | Reject unsupported spawn effort | VERIFIED | `hasUnsupportedRuntimeEffort()` returns 400 before `spawnBodySchema`/engine invocation. |
| `cli/src/modules/common/rpcTypes.ts` | Runner spawn contract without unsupported effort fields | VERIFIED | `SpawnSessionOptions` has `model`, `permissionMode`, `yolo`, etc.; no `effort` or `modelReasoningEffort`. |
| `cli/src/runner/run.ts` | Selected model launch and rejection classifier | VERIFIED | `buildCliArgs()` emits `--model` only for `options.model`; `toSafeSpawnFailure()` maps selected-runtime rejection only when `options.model` exists. |
| `web/src/api/client.ts` | Web client without unsupported effort mutation | VERIFIED | `setModel()` exists; no `setEffort()` or `/effort` route call remains. |
| `web/src/hooks/mutations/useSessionActions.ts` | Session actions without unsupported effort mutation | VERIFIED | Hook exposes `setModel` and permission/session actions only. |
| `web/src/components/AssistantChat/StatusBar.tsx` | Read-only effort metadata display | VERIFIED | `effortLabel = modelReasoningEffort ?? effort ?? null` renders metadata without effort controls. |
| `hub/src/sync/syncEngineSession.ts` | Active/inactive config persistence gate | PARTIAL | Persists only model/permissionMode, but returns success-like statuses for unsupported effort-only requests. |
| `cli/src/cursor/runCursor.ts` | Runner set-session-config handler | PARTIAL | Model changes return applies-next-run and effort fields are stripped when model is present, but effort-only payloads return `{ applied: { permissionMode } }`. |
| `hub/src/store/sessions.ts` / `shared/src/sessionSummary.ts` | Durable completion marker storage and summary derivation | VERIFIED | GSD artifact/key-link verification passed; `toSessionSummary()` derives completed from `turnCompletionMarker`. |
| `hub/src/sync/sessionLivenessService.ts` | Persist ready completion and clear on new work | PARTIAL | Basic persist/clear exists, but late ready after new work is not guarded. |
| `web/src/components/SessionList/SessionListItem.tsx` | Compact accessible status indicator | VERIFIED | Renders spinner/dot indicator from `statusKind`/`completionMarker`, with `aria-label`/`title`, and no row model/effort text. |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| Web new-session | Hub machine spawn | `NewSession` -> `useSpawnSession` -> `ApiClient.spawnSession` | WIRED | New session sends `model: resolvedModel`; auto maps to `undefined`; no effort fields. |
| Hub machine spawn | Runner spawn RPC | `spawnBodySchema` -> `SyncEngine.spawnSession` -> `RpcGateway.spawnSession` | WIRED | Unsupported effort rejected before engine; supported model forwarded. |
| Runner spawn RPC | Cursor process args | `apiMachine` -> `spawnSession` -> `buildCliArgs()` | WIRED | Model becomes `--model`; unsupported effort fields cannot be represented in `SpawnSessionOptions`. |
| Active session model switch | CLI runtime acknowledgement | `config.ts` -> `SyncEngineSession.applySessionConfig` -> `RpcGateway.requestSessionConfig` -> `runCursor` handler | WIRED | Model route is status-bearing and persistence is gated on `applied`/`applies-next-run`. |
| Effort-only session config | Runtime config result | `applySessionConfig` / `applyCursorSessionConfig` | PARTIAL | Unsupported effort is not persisted, but responses are success-like instead of failed/no-op. |
| Ready-turn completion | Authoritative summaries | `SessionLivenessService` -> store marker -> `SessionRepository.refreshSession` -> `toSessionSummary` | PARTIAL | Basic refetch path works; late ready after new work can overwrite the clear. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|---|---|---|---|---|
| `ModelSelector` / `useCursorModels` | `models` | `agent models` via runner RPC and Hub route | Yes | FLOWING |
| `NewSession/index.tsx` | `resolvedModel` | User-selected discovered model; `auto` becomes undefined | Yes | FLOWING |
| `buildCliArgs()` | `options.model` | Runner spawn RPC | Yes | FLOWING |
| `buildCliArgs()` | effort fields | N/A, unsupported by contract | No accepted input | VERIFIED |
| `applyCursorSessionConfig()` | effort-only payload | Session RPC payload | Success-like result despite unsupported input | HOLLOW |
| `toSessionSummary()` | `completionMarker` | Durable `turnCompletionMarker` | Yes for basic refetch | FLOWING |
| `SessionLivenessService.recordSessionActivity()` | `turnCompletionMarker` | Ready/turn-completed activity | Not correlated to current turn | HOLLOW |
| `SessionListItem.tsx` | `statusKind`/`completionMarker` | SSE patch or authoritative summary cache | Yes when source is correct | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| Focused runtime/status tests | `timeout 20s bun test hub/src/sync/sessionLivenessService.test.ts hub/src/sync/syncEngineSession.test.ts shared/src/sessionSummary.test.ts cli/src/cursor/runCursor.test.ts cli/src/runner/run.test.ts` | 38 pass, 0 fail | PASS_WITH_GAP |
| Effort-only active config probe | `bun -e "import { applyCursorSessionConfig } ..."` | Returned `{"applied":{"permissionMode":"default"}}` for `{ effort, modelReasoningEffort }` | FAIL |
| Plan artifact verification | `gsd-sdk query verify.artifacts` for 01-13/01-14/01-15 | All declared artifacts exist and pass basic checks | PASS |
| Plan key-link verification | `gsd-sdk query verify.key-links` for 01-13/01-14/01-15 | Declared patterns found | PASS_WITH_GAP |

`PASS_WITH_GAP` means the existing tests pass, but they do not assert the failed edge case or currently encode the wrong success-like behavior.

### Probe Execution

No phase-specific `scripts/**/tests/probe-*.sh` probes were declared or discovered.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| CURS-01 | 01-01, 01-02, 01-03, 01-04 | Discover available Cursor models from local CLI with clear failure state. | SATISFIED | Model discovery path is wired from local Cursor CLI through runner RPC, Hub route, Web hook, and selector. |
| CURS-02 | 01-04, 01-11, 01-12, 01-14, 01-15 | Start session with selected model/effort and keep runtime metadata truthful. | BLOCKED | Spawn/Web/runner effort surfaces were removed, but active and inactive effort-only session-config requests still acknowledge unsupported effort as successful/applies-next-run. |
| CURS-03 | 01-01, 01-05, 01-06, 01-07, 01-09 | Request in-session model switch and see applied/pending/failed/applies-next-run. | SATISFIED | Model route and composer state remain status-bearing; failed/applies-next-run are rendered composer-local. |
| CURS-04 | 01-01, 01-07, 01-08, 01-10, 01-13 | Scan session status/model/effort from mobile list through strict patches and authoritative summary convergence. | BLOCKED | Basic strict patch/refetch paths exist, but late ready after new work can reintroduce stale completed/unread status. |

No additional Phase 1 requirement IDs are mapped in `.planning/REQUIREMENTS.md`; CURS-01 through CURS-04 are accounted for.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|---|---:|---|---|---|
| `cli/src/cursor/runCursor.test.ts` | 83 | Test name says effort-only payloads are not runtime config changes but expects `{ applied: { permissionMode: 'default' } }` | WARNING | Encodes the success-like acknowledgement that review flagged. |
| `hub/src/sync/syncEngineSession.test.ts` | 102 | Effort-only inactive config test expects `status: 'applies-next-run'` | WARNING | Confirms unsupported effort-only input is not persisted but still treated as future success. |

No unreferenced `TBD`, `FIXME`, or `XXX` debt markers were found in the focused phase files.

### Human Verification Required

None at this stage. The blockers are observable in source and direct probes; mobile/manual UAT should wait until gaps are closed.

### Gaps Summary

Two gaps block Phase 1 goal achievement:

1. Unsupported effort-only session-config requests still get success-like acknowledgements. The implementation prevents persistence in the tested paths, but the runtime contract remains misleading for effort/modelReasoningEffort while Cursor effort support is unverified.
2. Durable completion markers are not protected against late ready events. New work clears the marker, but a stale turn-completed event can immediately re-persist it and make active work appear completed.

Structured gaps are in frontmatter for `/gsd-plan-phase --gaps`.

---

_Verified: 2026-05-24T02:24:09Z_
_Verifier: Claude (gsd-verifier)_
