---
phase: 01-cursor-runtime-config-contract
verified: 2026-05-24T13:53:00Z
status: passed
score: 4/4 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: passed
  previous_score: 4/4
  wave: "gaps-only round 2 — closed plans 01-18 (UAT Test 3), 01-19 (UAT Test 5 part 1), 01-20 (UAT Test 5 part 2)"
  gaps_closed:
    - "UAT Test 3 / CURS-03: in-session model switch did not actually change the model the next agent invocation used; composer big label flickered ahead of the model that answered the last turn (01-18)."
    - "UAT Test 5 part 1 / CURS-04: mobile session list froze on non-selected sessions while a chat session was open because SSE subscription narrowed to { sessionId } (01-19)."
    - "UAT Test 5 part 2 / CURS-04: viewed completion markers reset to green/unread on every refresh because they were React-only state (01-20)."
  gaps_remaining: []
  regressions: []
  known_flake:
    file: "cli/src/runner/runner.integration.test.ts"
    nature: "12 beforeEach hook timeouts; pre-existing runner-infra issue last touched in 255867d; not touched by 01-18/19/20."
    classification: "NOT a regression from this wave; documented in 01-18 SUMMARY 'Deferred Issues'."
---

# Phase 1: Cursor Runtime Config Contract Verification Report

**Phase Goal:** Users can discover available Cursor runtime options, start sessions with selected model/effort, switch models in-session with truthful state, and scan live status from the mobile session list.
**Verified:** 2026-05-24T13:53:00Z
**Status:** passed
**Re-verification:** Yes — after gap-closure plans 01-18, 01-19, 01-20.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|---|---|---|
| 1 | User can discover available Cursor models from the local Cursor CLI before launch and sees a clear failure state when discovery fails. | VERIFIED | `discoverCursorModels` in `cli/src/cursor/modelDiscovery.ts` registered on `discover-cursor-models` RPC; Hub `GET /api/machines/:id/cursor/models` via `syncEngine.discoverCursorModels`; Web `useCursorModels` + `ModelSelector` consumed in composer/new-session flows. (Unchanged from prior verification — no regression.) |
| 2 | User can start a Cursor session with selected model and effort, then see those values persisted in session metadata. | VERIFIED | `NewSession` sends only `model`; Hub spawn rejects unsupported effort (`hasUnsupportedRuntimeEffort`); effort-only session-config returns `status: 'failed'` (`applyCursorSessionConfig` and `syncEngineSession.applySessionConfig` inactive branch). Model persists via spawn/cache; effort displays read-only via `StatusBar` `effortLabel`. |
| 3 | User can request an in-session model switch and see whether it applied, is pending, failed, or applies on the next run based on real CLI runtime behavior. | VERIFIED | 01-18 closure: `applyCursorSessionConfig` now invokes `state.syncModel?.(config.model ?? null)` (`cli/src/cursor/runCursor.ts:83`), `CursorSession.setModel` (`session.ts:63`) mutates the launcher source-of-truth, and `cursorRemoteLauncher.runMainLoop` builds args with `model: batch.mode.model ?? session.model` (`cursorRemoteLauncher.ts:101`) — so the next `agent --resume <id> --model <new>` spawn picks up the per-turn model. Web composer big label is gated by `previousModel` (StatusBar/SessionChat) until the `session-updated` patch confirms the target, and en/zh-CN copy reads "Applies next message" / "下一条消息生效". |
| 4 | User can scan each session's status, model, and effort from the mobile session list as live strict patches arrive. | VERIFIED | 01-19 closure: `web/src/App.tsx:279` uses `useMemo(() => ({ all: true }), [])` unconditionally — the previous `{ sessionId: selectedSessionId }` narrowing branch is removed; cross-session `session-updated` patches keep flowing to non-selected session rows. 01-20 closure: `SessionList.tsx` persists `viewedCompletionMarkers` to `localStorage` (key `hapi.session-list.viewed-completion-markers`) with lazy hydrate, write-through, and prune-on-render. Durable `turnCompletionMarker` + `isStaleCompletion` (from earlier waves) remain in place. |

**Score:** 4/4 truths verified

### Deferred Items

None.

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `cli/src/cursor/runCursor.ts` | Mutable currentModel + syncModel callback | VERIFIED | `let currentModel`, `syncModel?:` field, `state.syncModel?.(config.model ?? null)` call, and `syncModel: (model) => { ... }` registration in `set-session-config` handler all present. |
| `cli/src/cursor/session.ts` | `setModel` setter; model no longer `readonly` | VERIFIED | Arrow-property `setModel = (model: string \| null): void => { ... }` at line 63 mirrors `setPermissionMode`. |
| `cli/src/cursor/cursorRemoteLauncher.ts` | `runMainLoop` prefers `batch.mode.model` | VERIFIED | `model: batch.mode.model ?? session.model` at line 101; `--resume <cursorSessionId>` preserved. |
| `web/src/components/AssistantChat/StatusBar.tsx` | `previousModel`-gated BIG label | VERIFIED | `previousModel` field on `ModelSwitchState`; `modelLabel` gate present; `composer.model.appliesNextMessage` rendered at line 143. |
| `web/src/components/SessionChat.tsx` | `previousModel` capture + reset-on-confirm effect | VERIFIED | `handleModelChange` captures `previousModel` and reset effect transitions back to `{ status: 'idle' }` when `session.model === targetModel`. |
| `web/src/lib/locales/{en,zh-CN}.ts` | Locale rename to `appliesNextMessage` | VERIFIED | `Applies next message` (en line 335) and `下一条消息生效` (zh-CN line 337); old `appliesNextRun` key removed everywhere in `web/src` (0 matches). |
| `web/src/App.tsx` | Unconditional `{ all: true }` SSE subscription | VERIFIED | `useMemo(() => ({ all: true }), [])` at line 279; no `sessionId: selectedSessionId` narrowing branch. |
| `web/src/App.test.tsx` | Subscription-scope regression sentry | VERIFIED | File present; locks `{ all: true }` across selected-session route changes. |
| `web/src/hooks/useSSE.test.tsx` | Cross-session patch convergence sentry | VERIFIED | New case `session-updated event for a non-selected session updates that session's SessionList summary cache entry while another session is open` present. |
| `web/src/components/SessionList.tsx` | localStorage-backed viewed markers | VERIFIED | `VIEWED_COMPLETION_MARKERS_STORAGE_KEY`, lazy initializer via `loadViewedCompletionMarkers`, write-through via `saveViewedCompletionMarkers` in `markCompletionViewed`, and prune effect — all present. |
| `web/src/components/SessionList.viewed-persistence.test.tsx` | Persistence regression coverage | VERIFIED | File present; covers hydrate, write-through, prune, and storage-failure resilience. |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `applyCursorSessionConfig` model branch | mutable `currentModel` / `CursorSession.setModel` | `syncModel` callback | WIRED | Optional-chained call in pure function; production registers callback in `set-session-config` handler. |
| `session.onUserMessage` queue push | `cursorRemoteLauncher.runMainLoop` `buildAgentArgs` | `batch.mode.model` per turn | WIRED | Queue carries `EnhancedMode.model`; launcher prefers it over `session.model`. |
| `SessionChat.handleModelChange` | `StatusBar` BIG label | `modelSwitchState.previousModel` | WIRED | Captured at click; honored while status ∈ {applying, pending, applies-next-run}; reset on session-updated patch matching target. |
| `App.eventSubscription` | `useSSE` → EventSource URL | `{ all: true }` always | WIRED | Hub fanout sees no narrowing filter; cross-session patches reach SessionList summary cache. |
| `useSSE.patchSessionSummary` | `queryKeys.sessions` cache | dispatch by `event.sessionId` | WIRED | New test case asserts non-selected session row updates. |
| `SessionList` viewed state | `localStorage` | `hapi.session-list.viewed-completion-markers` key | WIRED | Lazy initializer + write-through + prune effect; SSR-guarded with try/catch. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|---|---|---|---|---|
| `applyCursorSessionConfig` model branch | `state.syncModel` invocation | Validated Zod payload (`nullableRuntimeConfigValue`) | Yes — production always wires the callback | FLOWING |
| `cursorRemoteLauncher.runMainLoop` | `model` arg into `buildAgentArgs` | `batch.mode.model` from the per-turn queue entry | Yes — queue hash key includes `model`, so a switch yields a fresh batch boundary | FLOWING |
| `StatusBar.modelLabel` | `previousModel` vs `props.model` | `modelSwitchState` from SessionChat | Yes — capture-at-click; transition driven by Hub `session-updated` patch | FLOWING |
| `App.eventSubscription` | subscription scope | Stable `{ all: true }` literal | Yes — Hub fans out all sessions' patches | FLOWING |
| `SessionList.viewedCompletionMarkers` | persisted map | `localStorage` (browser); pruned against `props.sessions` | Yes — hydrates on mount, persists across refresh | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| CLI hot-switch unit + remote-launcher tests | `cd cli && bun run test -- runCursor cursorRemoteLauncher` | 2 files, 16 tests pass | PASS |
| Web composer + SSE + session-list tests | `cd web && bun run test -- StatusBar SessionChat App useSSE SessionList` | 16 files, 104 tests pass | PASS |

### Probe Execution

No phase-specific `scripts/**/tests/probe-*.sh` probes declared or discovered. Step 7c: SKIPPED.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| CURS-01 | 01-01..04 | Discover Cursor models with clear failure state | SATISFIED | Discovery RPC + Hub route + Web hook/selector unchanged; no regression. |
| CURS-02 | 01-02, 01-04, 01-11..16 | Start with model/effort metadata; truthful runtime config | SATISFIED | Model spawn + persistence; effort read-only; effort-only config returns `failed` on CLI and Hub inactive paths. |
| CURS-03 | 01-05..07, 01-09, **01-18** | In-session model switch with real CLI statuses | SATISFIED | 01-18 closes the gap — CLI runtime now actually mutates and re-spawns with the new model; Web BIG label gated by `previousModel`; locale rename live. |
| CURS-04 | 01-08, 01-10, 01-13, 01-17, **01-19, 01-20** | Mobile session list live status via strict patches | SATISFIED | 01-19 keeps SSE subscription `{ all: true }`; 01-20 persists viewed markers across refresh; durable completion markers and late-ready guard remain. |

No orphaned Phase 1 requirement IDs in `.planning/REQUIREMENTS.md`.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|---|---:|---|---|---|
| — | — | None blocking | — | No unreferenced `TBD`/`FIXME`/`XXX` markers in 01-18/01-19/01-20 modified files; no `placeholder`/stub returns; locale rename complete (zero leftover `appliesNextRun` literals in `web/src`). |

### Human Verification Required

None. UAT Test 3 (CURS-03 hot-switch) and UAT Test 5 (CURS-04 list convergence + viewed persistence) are now locked by automated regression tests at the CLI runtime contract, the Web composer state, the App SSE subscription scope, and the SessionList persistence layer. The remaining "truthful next-turn LLM identity" check is the same kind of manual UAT it has always been; it is now exercise-ready because the contract is correct in code.

### Gaps Summary

Wave gaps for plans 01-18, 01-19, 01-20 are closed:

1. **In-session model switch is now truthful** — CLI hot-switch mutation path (`syncModel` callback + `CursorSession.setModel`) is wired; remote launcher prefers `batch.mode.model`; Web composer big label gated by captured `previousModel`; locale rename to "Applies next message" complete in en + zh-CN.
2. **Mobile session list keeps converging** — App SSE subscription is unconditionally `{ all: true }`; non-selected session summaries continue to receive `session-updated` patches via the dispatch-by-`event.sessionId` path.
3. **Viewed completion markers survive refresh** — `viewedCompletionMarkers` is hydrated from `localStorage` and write-through on update, with SSR guard, try/catch, and prune-on-render.

Known pre-existing flake (`cli/src/runner/runner.integration.test.ts` beforeEach timeouts, last touched in `255867d`, untouched by this wave) is excluded by user instruction — not a regression introduced by 01-18/19/20.

Phase 1 goal remains achieved across all four observable truths.

---

_Verified: 2026-05-24T13:53:00Z_
_Verifier: Claude (gsd-verifier)_
