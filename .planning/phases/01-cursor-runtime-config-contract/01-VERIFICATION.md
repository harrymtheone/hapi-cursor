---
phase: 01-cursor-runtime-config-contract
verified: 2026-05-23T15:56:00Z
status: human_needed
score: 4/4 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Open the mobile PWA new-session panel with a local runner connected and compare the model selector with `agent models` output."
    expected: "The selector shows raw Cursor model ids, keeps Auto (unspecified) available, and shows safe retry/error copy if discovery is unavailable."
    why_human: "This verifies real browser presentation and account/runtime-dependent Cursor model availability."
  - test: "Start a real Cursor session from the mobile UI with an explicitly selected discovered model."
    expected: "The session starts without falling back to auto, and session detail/composer metadata shows the selected model through persistence and live updates."
    why_human: "This requires a running hub, runner, authenticated Cursor runtime, and actual session lifecycle."
  - test: "Request a model switch from the composer area while idle and while the session is busy."
    expected: "The composer model box reports applied, pending, failed, or applies-next-run truthfully; it does not add chat timeline messages."
    why_human: "True runtime switch behavior depends on the live Cursor process path and cannot be fully proven by static inspection."
  - test: "Exercise the session list on mobile across running, thinking, waiting, error, completed unread, and viewed-completed states."
    expected: "Rows show one compact accessible indicator with the expected color/spinner behavior, and model/effort text remains out of the row."
    why_human: "Visual density, accessibility affordances, and live SSE feel need browser/mobile confirmation."
---

# Phase 1: Cursor Runtime Config Contract Verification Report

**Phase Goal:** Users can discover available Cursor runtime options, start sessions with selected model/effort, switch models in-session with truthful state, and scan live status from the mobile session list.
**Verified:** 2026-05-23T15:56:00Z
**Status:** human_needed
**Re-verification:** No - initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can discover available Cursor models from the local Cursor CLI before launch and sees a clear failure state when discovery fails. | VERIFIED | `agent models` returned real model ids; `cli/src/cursor/modelDiscovery.ts` runs `spawn('agent', ['models'])`, parses raw ids, uses safe error reasons, and is exposed via `discover-cursor-models`, `GET /api/machines/:id/cursor/models`, `ApiClient.getCursorModels`, and `useCursorModels`. |
| 2 | User can start a Cursor session with selected model and effort, then see those values persisted in session metadata. | VERIFIED | `NewSession` maps only non-auto model values into spawn payloads; runner `buildCliArgs` passes `--model`; session creation and store/session config paths persist `model`, `modelReasoningEffort`, and `effort`. Separate effort UI is intentionally absent unless runtime support is proven, per D-06. |
| 3 | User can request an in-session model switch and see whether it applied, is pending, failed, or applies on the next run based on real CLI runtime behavior. | VERIFIED | Shared `CursorRuntimeConfigApplyResultSchema` supports all statuses; CLI returns `applies-next-run` for model/effort without claiming hot switch; Hub parses acknowledgements and persists only applied/applies-next-run fields; Web returns the status through `ApiClient.setModel` and renders feedback in `StatusBar`. |
| 4 | User can scan each session's status, model, and effort from the mobile session list as live strict patches arrive. | VERIFIED | Context D-07/D-13 corrects model/effort to composer-adjacent display. `SessionListItem` renders compact status indicators only; `StatusBar` renders raw model/effort near the composer; `SessionPatchSchema` and `useSSE` strictly merge model/effort/status marker patches. |

**Score:** 4/4 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `shared/src/schemas.ts` | Discovery, apply-result, and strict patch schemas | VERIFIED | Exports `CursorModelDiscoveryResultSchema`, `CursorRuntimeConfigApplyResultSchema`, and status marker patch fields. Tests reject raw stderr-like reason values and unknown patch fields. |
| `shared/src/sessionSummary.ts` | Summary status and marker derivation | VERIFIED | Exposes `statusKind`, `completionMarker`, and `errorMarker`; tests cover thinking, waiting, completed, and error states. |
| `cli/src/cursor/modelDiscovery.ts` | Local Cursor CLI discovery | VERIFIED | Uses argument-array spawn, no static model catalog, timeout, safe reasons, and local stderr logging only. |
| `cli/src/api/apiMachine.ts` | Machine-level discovery RPC | VERIFIED | Registers `discover-cursor-models` before session launch and validates the result with shared schema. |
| `cli/src/runner/run.ts` | Explicit runtime launch and safe rejection | VERIFIED | Passes `--model` only for explicit model and maps explicit runtime startup failures to `selected-runtime-config-rejected`. |
| `cli/src/cursor/runCursor.ts` | Runtime config acknowledgement | VERIFIED | Validates payloads and returns status-bearing `applies-next-run` for unsupported hot-switch model/effort changes. |
| `hub/src/sync/rpcGateway.ts` | Hub RPC bridge | VERIFIED | Bridges discovery through machine RPC, validates discovery result, and preserves selected runtime rejection code. |
| `hub/src/sync/syncEngineSession.ts` | Active/inactive config persistence gate | VERIFIED | Active sessions persist only acknowledged applied/applies-next-run fields; failed acknowledgements do not mutate model metadata. |
| `hub/src/web/routes/machines.ts` | Authenticated discovery route | VERIFIED | `GET /api/machines/:id/cursor/models` requires machine guard and delegates to SyncEngine/RpcGateway, not direct shell execution. |
| `hub/src/web/routes/sessions/config.ts` | Status-bearing model route | VERIFIED | `POST /api/sessions/:id/model` returns the apply result instead of `{ ok: true }`. |
| `web/src/hooks/useCursorModels.ts` | Short-cache discovery hook | VERIFIED | Uses 30000ms cache, enabled flag, retry bypass, and sanitized rejected-request errors. |
| `web/src/components/NewSession/ModelSelector.tsx` | Discovery-aware selector | VERIFIED | Always includes Auto (unspecified), renders loading/error/empty/retry states, and preserves raw ids as primary labels. |
| `web/src/components/SessionChat.tsx` | Session-local switch state | VERIFIED | Stores applying/result/failed state and passes it to composer without message/timeline APIs. |
| `web/src/components/AssistantChat/StatusBar.tsx` | Composer model box | VERIFIED | Renders raw model, optional effort metadata, read-only state, and switch result feedback in composer controls. |
| `web/src/components/SessionList/SessionListItem.tsx` | Compact list status indicator | VERIFIED | Renders spinner/dot indicators with accessible labels and no visible model/effort row text. |
| `web/src/hooks/useSSE.ts` | Strict live patch convergence | VERIFIED | Merges model, effort, modelReasoningEffort, statusKind, completionMarker, and errorMarker patches without unknown-field refetch fallback. |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| Web new-session panel | Local Cursor CLI model discovery | `useCursorModels` -> `ApiClient.getCursorModels` -> Hub route -> `SyncEngine.discoverCursorModels` -> `RpcGateway.discoverCursorModels` -> machine RPC -> `discoverCursorModels()` | WIRED | All tiers exist and targeted tests passed. |
| Explicit selected model | Cursor process launch and session persistence | `NewSession` resolved model -> Web spawn -> Hub spawn -> runner `buildCliArgs` -> `runCursor` bootstrap/session store | WIRED | `auto` remains UI-only; explicit model is passed and persisted. |
| Model route | CLI runtime acknowledgement | `POST /api/sessions/:id/model` -> `SyncEngineSession.applySessionConfig` -> `RpcGateway.requestSessionConfig` -> `runCursor` `set-session-config` | WIRED | Active acknowledgement parsed; failed result does not persist. |
| Switch result | Composer UI feedback | `ApiClient.setModel` -> `useSessionActions.setModel` -> `SessionChat.modelSwitchState` -> `HappyComposer` -> `StatusBar` | WIRED | Tests cover applied, applies-next-run, failed, rejected mutation, and no timeline message append. |
| SSE patches | Session list and composer state | `SessionPatchSchema` -> `SyncEventSchema` -> `useSSE.patchSessionSummary` / detail cache | WIRED | Tests cover model/effort/status marker patch convergence and unknown-field rejection. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|---|---|---|---|---|
| `ModelSelector.tsx` | `discoveryResult.models` | `useCursorModels` fetches `/api/machines/:id/cursor/models`, which reaches local `agent models` through machine RPC | Yes | FLOWING |
| `NewSession/index.tsx` | `resolvedModel` | User selection from discovered model ids; `auto` maps to `undefined` | Yes | FLOWING |
| `StatusBar.tsx` | `model`, `modelReasoningEffort`, `effort`, `modelSwitchState` | Shared session fields plus Hub model route result passed through `SessionChat`/`HappyComposer` | Yes | FLOWING |
| `SessionListItem.tsx` | `statusKind`, `completionMarker`, `errorMarker`, `completionViewed` | `toSessionSummary`, SSE patch cache, and local viewed marker state | Yes | FLOWING |
| `useSSE.ts` | session summary/detail patch fields | Strict `SyncEventSchema` parsed SSE messages | Yes | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| Local Cursor runtime exposes models | `timeout 10s agent models` | Returned non-empty model list including `auto`, raw model ids, and Cursor's `/model` tip | PASS |
| Shared contract and summary tests | `cd shared && bun test schemas.test.ts sessionSummary.test.ts` | 39 pass, 0 fail | PASS |
| CLI discovery/runtime tests | `cd cli && bun run test -- modelDiscovery runCursor apiMachine run` | 7 files passed; 32 passed, 12 skipped integration cases due no hub | PASS |
| Hub discovery/config route tests | `cd hub && bun test src/web/routes/machines.test.ts src/sync/sessionConfigService.test.ts src/sync/syncEngineSession.test.ts src/web/routes/sessions/__tests__/config.test.ts` | 24 pass, 0 fail | PASS |
| Web runtime/UI state tests | `cd web && bun run test -- useCursorModels ModelSelector NewSession useSpawnSession useSessionActions SessionChat useHappyComposerState HappyComposer StatusBar useSSE SessionListItem` | 13 files passed; 73 tests passed | PASS |
| Root typecheck | `bun run typecheck` | Passed across CLI, Web, and Hub | PASS |
| Full repository tests | `bun run test` | Passed; CLI 267 passed/12 skipped, plus Hub/Web/guard completed successfully | PASS |
| Circular dependency guard | `bun run madge:check` | No circular dependency found | PASS |
| Repo no-cut-agent guard | `bash scripts/check-no-cut-agents.sh` | All guard checks passed | PASS |
| Documented commits exist | `git cat-file -e` over all phase summary commit hashes | All documented phase commits exist | PASS |

### Probe Execution

No phase-specific `scripts/**/tests/probe-*.sh` probes were declared or required for this phase.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| CURS-01 | 01-01, 01-02, 01-03, 01-04 | User can discover available Cursor models from the local Cursor CLI before launch, with a clear failure state. | SATISFIED | Local `agent models` succeeded; CLI parser/runner, machine RPC, Hub route, Web hook, and selector safe states are wired and tested. |
| CURS-02 | 01-04 | User can start a Cursor session with selected model/effort and see those values persisted in session metadata. | SATISFIED | Explicit model is passed through spawn and persisted. Effort/modelReasoningEffort storage and backend paths exist; separate effort UI is intentionally hidden until runtime support is proven. |
| CURS-03 | 01-01, 01-05, 01-06, 01-07 | User can request an in-session model switch and see applied, pending, failed, or applies-next-run state backed by real CLI runtime behavior. | SATISFIED | Shared status schema, CLI applies-next-run truthfulness, Hub persistence gate, model route response, Web mutation result, and composer feedback are implemented and tested. |
| CURS-04 | 01-01, 01-07, 01-08 | User can scan session status, model, and effort from mobile, updated live through strict patches. | SATISFIED | Context correction places model/effort in composer; session list status indicators and strict SSE model/effort/status patches are implemented and tested. |

### Context Decisions Coverage

| Decision | Status | Evidence |
|---|---|---|
| D-01 | VERIFIED | Discovery uses local `agent models`; no static model catalog introduced in discovery contract. |
| D-02 | VERIFIED | `useCursorModels` runs from mounted new-session UI with selected machine and 30000ms cache. |
| D-03 | VERIFIED | Safe discovery reasons are schema-enumerated and localized; raw stderr is not returned. |
| D-04 | VERIFIED | Raw model ids are parsed and rendered as primary selector/model labels. |
| D-05 | VERIFIED | `auto` maps to `undefined`; explicit model only sent when selected. |
| D-06 | VERIFIED | No hardcoded separate effort selector; effort fields only display when non-null metadata exists. |
| D-07 | VERIFIED | Model/effort rendered in composer `StatusBar`, not session list rows. |
| D-08 | VERIFIED | Explicit selected-runtime rejection is structured as `selected-runtime-config-rejected`; no auto retry path found. |
| D-09 | VERIFIED | Composer selector opens only when `runtimeModelSwitchSupported`, options, and idle gate are true. |
| D-10 | VERIFIED | Applying/applied/failed/applies-next-run status propagates to composer model box. |
| D-11 | VERIFIED | Thinking, background work, pending requests, disabled controls, and missing options prevent selector opening. |
| D-12 | VERIFIED | Switch state remains local to composer/status; no chat timeline event path found. |
| D-13 | VERIFIED | Session list renders spinner/yellow/red/green/gray compact indicators, not model text. |
| D-14 | VERIFIED | Indicators include `aria-label` and `title`; normal row text is unchanged. |
| D-15 | VERIFIED | Completed read state is local Web state keyed by session id and `completionMarker`. |
| D-16 | VERIFIED | Waiting state derives from pending request count and renders one yellow indicator. |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|---|---:|---|---|---|
| `web/src/components/SessionChat.test.tsx` | n/a | React duplicate-key warning during targeted tests | WARNING | Existing test/runtime warning noted in summaries; tests still pass. Not blocking Phase 1 goal achievement, but should be cleaned up in a future quality pass. |

### Human Verification Required

#### 1. Real Model Discovery UI

**Test:** Open the mobile PWA new-session panel with a local runner connected and compare the selector with `agent models`.
**Expected:** Raw Cursor model ids are visible; Auto (unspecified) remains available; discovery failure shows safe retry/error copy.
**Why human:** Browser/mobile presentation and account/runtime availability need live confirmation.

#### 2. Real Selected-Model Launch

**Test:** Start a real Cursor session from mobile with a selected discovered model.
**Expected:** The session starts using the selected model without fallback, and composer/session metadata shows that model after persistence/live updates.
**Why human:** Requires live hub, runner, authenticated Cursor runtime, and session lifecycle.

#### 3. Runtime Switch Truthfulness

**Test:** Attempt model switching from the composer while idle and while busy.
**Expected:** The model information box reports applied, pending, failed, or applies-next-run truthfully, without timeline messages.
**Why human:** True runtime switch behavior depends on the live Cursor process path.

#### 4. Mobile Status Scan

**Test:** Inspect mobile rows across running, thinking, waiting, error, completed unread, and viewed-completed states.
**Expected:** One compact accessible indicator appears per row, model/effort stays out of the row, and viewed completion turns gray.
**Why human:** Visual density, accessibility affordances, and realtime SSE feel need browser/mobile validation.

### Gaps Summary

No automated implementation gaps found. All four roadmap success criteria, CURS-01 through CURS-04, and decisions D-01 through D-16 are supported by source evidence and passing checks. Status is `human_needed` only because UI/realtime/external Cursor runtime behaviors require end-of-phase UAT under verifier rules.

---

_Verified: 2026-05-23T15:56:00Z_
_Verifier: Claude (gsd-verifier)_
