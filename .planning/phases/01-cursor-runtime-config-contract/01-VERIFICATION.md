---
phase: 01-cursor-runtime-config-contract
verified: 2026-05-24T14:31:00Z
status: passed
score: 4/4 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: passed
  previous_score: 4/4
  wave: "gaps-only round 3 — closed plan 01-21 (UAT Test 6 / CURS-04 / D-15: refresh-stable viewed completion markers)"
  gaps_closed:
    - "UAT Test 6 / CURS-04 / D-15: page refresh wiped persisted viewedCompletionMarkers because the prune effect treated transient empty loading renders as authoritative; non-selected previously-viewed completed sessions flipped back to green/unread (01-21)."
  gaps_remaining: []
  regressions: []
  prior_waves:
    - "round 1: 01-18 (UAT Test 3 / CURS-03 hot-switch truth), 01-19 (UAT Test 5 part 1 / CURS-04 SSE subscription scope), 01-20 (UAT Test 5 part 2 / CURS-04 viewed-marker localStorage baseline)"
  known_flake:
    file: "cli/src/runner/runner.integration.test.ts"
    nature: "12 beforeEach hook timeouts; pre-existing runner-infra issue last touched in 255867d; not touched by 01-18/19/20/21."
    classification: "NOT a regression from this wave; documented in 01-18 SUMMARY 'Deferred Issues'."
---

# Phase 1: Cursor Runtime Config Contract Verification Report

**Phase Goal:** Users can discover available Cursor runtime options, start sessions with selected model/effort, switch models in-session with truthful state, and scan live status from the mobile session list (including viewed-completion markers that survive page refresh).
**Verified:** 2026-05-24T14:31:00Z
**Status:** passed
**Re-verification:** Yes — after gap-closure plan 01-21 (round 3, on top of rounds 1+2: 01-18/19/20).

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|---|---|---|
| 1 | User can discover available Cursor models from the local Cursor CLI before launch and sees a clear failure state when discovery fails. | VERIFIED | `discoverCursorModels` in `cli/src/cursor/modelDiscovery.ts` registered on `discover-cursor-models` RPC; Hub `GET /api/machines/:id/cursor/models` via `syncEngine.discoverCursorModels`; Web `useCursorModels` + `ModelSelector` consumed in composer/new-session flows. (Unchanged from prior verification — no regression.) |
| 2 | User can start a Cursor session with selected model and effort, then see those values persisted in session metadata. | VERIFIED | `NewSession` sends only `model`; Hub spawn rejects unsupported effort (`hasUnsupportedRuntimeEffort`); effort-only session-config returns `status: 'failed'` (`applyCursorSessionConfig` and `syncEngineSession.applySessionConfig` inactive branch). Model persists via spawn/cache; effort displays read-only via `StatusBar` `effortLabel`. (Unchanged.) |
| 3 | User can request an in-session model switch and see whether it applied, is pending, failed, or applies on the next run based on real CLI runtime behavior. | VERIFIED | 01-18 closure (preserved): `applyCursorSessionConfig` invokes `state.syncModel?.(config.model ?? null)` (`cli/src/cursor/runCursor.ts:83`), `CursorSession.setModel` (`session.ts:63`) mutates the launcher source-of-truth, and `cursorRemoteLauncher.runMainLoop` builds args with `model: batch.mode.model ?? session.model` (`cursorRemoteLauncher.ts:101`). Web composer big label gated by `previousModel` (StatusBar/SessionChat); en/zh-CN copy reads "Applies next message" / "下一条消息生效". |
| 4 | User can scan each session's status, model, and effort from the mobile session list as live strict patches arrive, **and viewed completion markers stay viewed across page refresh**. | VERIFIED | 01-19 closure (preserved): `web/src/App.tsx:279` uses `useMemo(() => ({ all: true }), [])` unconditionally — cross-session `session-updated` patches keep flowing to non-selected rows. 01-20 closure (preserved): `SessionList.tsx` persists `viewedCompletionMarkers` to `localStorage` (key `hapi.session-list.viewed-completion-markers`). **01-21 closure (new):** prune effect at `web/src/components/SessionList.tsx:143-150` early-returns when `props.isLoading && props.sessions.length === 0`, so transient empty refresh renders no longer wipe persisted markers; `props.isLoading` added to effect deps so prune re-runs when authoritative data lands. |

**Score:** 4/4 truths verified

### Deferred Items

None.

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `cli/src/cursor/runCursor.ts` | Mutable currentModel + syncModel callback (01-18) | VERIFIED | Unchanged from round 2; `state.syncModel?.(config.model ?? null)` and registration in `set-session-config` handler present. |
| `cli/src/cursor/session.ts` | `setModel` setter; model no longer `readonly` (01-18) | VERIFIED | Unchanged from round 2. |
| `cli/src/cursor/cursorRemoteLauncher.ts` | `runMainLoop` prefers `batch.mode.model` (01-18) | VERIFIED | Unchanged from round 2. |
| `web/src/components/AssistantChat/StatusBar.tsx` | `previousModel`-gated BIG label (01-18) | VERIFIED | Unchanged from round 2. |
| `web/src/components/SessionChat.tsx` | `previousModel` capture + reset-on-confirm effect (01-18) | VERIFIED | Unchanged from round 2. |
| `web/src/lib/locales/{en,zh-CN}.ts` | Locale rename to `appliesNextMessage` (01-18) | VERIFIED | Unchanged from round 2. |
| `web/src/App.tsx` | Unconditional `{ all: true }` SSE subscription (01-19) | VERIFIED | Unchanged from round 2. |
| `web/src/App.test.tsx` | Subscription-scope regression sentry (01-19) | VERIFIED | Unchanged from round 2. |
| `web/src/hooks/useSSE.test.tsx` | Cross-session patch convergence sentry (01-19) | VERIFIED | Unchanged from round 2. |
| `web/src/components/SessionList.tsx` | localStorage-backed viewed markers (01-20) **+ transient-empty-loading guard (01-21)** | VERIFIED | `VIEWED_COMPLETION_MARKERS_STORAGE_KEY` + lazy hydrate + write-through preserved. **New (01-21):** prune effect at `:143-150` early-returns when `props.isLoading && props.sessions.length === 0`; `props.isLoading` added to effect deps at `:176`. Prune semantics for absent / stale markers unchanged once authoritative data arrives. |
| `web/src/components/SessionList.viewed-persistence.test.tsx` | Persistence regression coverage **+ transient-empty-loading regression (01-21)** | VERIFIED | Existing hydrate / write-through / prune / storage-failure cases preserved. **New (01-21)** at `:144-211`: `does not prune persisted viewed markers during a transient empty loading render` — seeds `{ sessionA: 10, sessionB: 20 }`, renders with `sessions=[]` + `isLoading=true` + `selectedSessionId='sessionB'`, asserts both markers persist; then rerenders with both sessions loaded and asserts two `Viewed` indicators (no `Unread result`). |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `applyCursorSessionConfig` model branch | mutable `currentModel` / `CursorSession.setModel` | `syncModel` callback | WIRED | Unchanged from round 2. |
| `session.onUserMessage` queue push | `cursorRemoteLauncher.runMainLoop` `buildAgentArgs` | `batch.mode.model` per turn | WIRED | Unchanged from round 2. |
| `SessionChat.handleModelChange` | `StatusBar` BIG label | `modelSwitchState.previousModel` | WIRED | Unchanged from round 2. |
| `App.eventSubscription` | `useSSE` → EventSource URL | `{ all: true }` always | WIRED | Unchanged from round 2. |
| `useSSE.patchSessionSummary` | `queryKeys.sessions` cache | dispatch by `event.sessionId` | WIRED | Unchanged from round 2. |
| `SessionList` viewed state | `localStorage` | `hapi.session-list.viewed-completion-markers` key | WIRED | Lazy initializer + write-through + prune-on-render preserved. |
| **`SessionList` prune effect (01-21)** | **`localStorage` writes** | **`props.isLoading` authoritative gate** | **WIRED** | **Early-return when `isLoading && sessions.length === 0` prevents non-authoritative mutation; effect re-runs when `isLoading` flips false because it's in the deps array.** |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|---|---|---|---|---|
| `applyCursorSessionConfig` model branch | `state.syncModel` invocation | Validated Zod payload | Yes | FLOWING |
| `cursorRemoteLauncher.runMainLoop` | `model` arg to `buildAgentArgs` | `batch.mode.model` per-turn queue entry | Yes | FLOWING |
| `StatusBar.modelLabel` | `previousModel` vs `props.model` | `modelSwitchState` from SessionChat | Yes | FLOWING |
| `App.eventSubscription` | subscription scope | Stable `{ all: true }` literal | Yes — Hub fans out all sessions' patches | FLOWING |
| `SessionList.viewedCompletionMarkers` | persisted map | `localStorage` (browser); pruned only against authoritative `props.sessions` (post-loading) | **Yes — survives refresh because transient `isLoading && sessions.length === 0` no longer triggers prune (01-21)** | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| 01-21 fix code present in `SessionList.tsx` prune effect | `rg "props.isLoading && props.sessions.length === 0" web/src/components/SessionList.tsx` | match at `:148` inside the prune `useEffect` (lines 143-150) | PASS |
| 01-21 regression test present in `SessionList.viewed-persistence.test.tsx` | `rg "does not prune persisted viewed markers during a transient empty loading render" web/src/components/SessionList.viewed-persistence.test.tsx` | match at `:144` | PASS |
| 01-21 commits land on branch | `git log --oneline -10` | `c455ad9` (test RED), `687be08` (fix GREEN), `b6dab34` (docs) all present per 01-21 SUMMARY | PASS |
| 01-21 SUMMARY reports test convergence | `web/src/components/SessionList.viewed-persistence.test.tsx`: 5/5 passed; SessionList suite: 35/35 across 7 files; typecheck + madge + check-no-cut-agents all green | per 01-21 SUMMARY §Verification | PASS (per phase summary) |

### Probe Execution

No phase-specific `scripts/**/tests/probe-*.sh` probes declared or discovered. Step 7c: SKIPPED.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| CURS-01 | 01-01..04 | Discover Cursor models with clear failure state | SATISFIED | Discovery RPC + Hub route + Web hook/selector unchanged; no regression. |
| CURS-02 | 01-02, 01-04, 01-11..16 | Start with model/effort metadata; truthful runtime config | SATISFIED | Model spawn + persistence; effort read-only; effort-only config returns `failed` on CLI and Hub inactive paths. |
| CURS-03 | 01-05..07, 01-09, 01-18 | In-session model switch with real CLI statuses | SATISFIED | 01-18 closure — CLI runtime mutates and re-spawns with the new model; Web BIG label gated by `previousModel`; locale rename live. |
| CURS-04 | 01-08, 01-10, 01-13, 01-17, 01-19, 01-20, **01-21** | Mobile session list live status via strict patches **+ refresh-stable viewed-completion markers** | SATISFIED | 01-19 keeps SSE `{ all: true }`; 01-20 persists viewed markers; **01-21 prevents transient empty refresh renders from wiping persisted markers — closes UAT Test 6 / D-15.** |

REQUIREMENTS.md confirms all four IDs (CURS-01..04) map to Phase 1 with status `Complete` (`.planning/REQUIREMENTS.md:13-16, :93-96`). No orphaned Phase 1 requirement IDs.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|---|---:|---|---|---|
| — | — | None blocking | — | No unreferenced `TBD`/`FIXME`/`XXX` markers in the 01-21 modified files (`SessionList.tsx`, `SessionList.viewed-persistence.test.tsx`); no `placeholder`/stub returns; the new prune-effect guard is a real conditional with no debt comments. |

### Human Verification Required

None. UAT Test 6 (CURS-04 / D-15 — refresh-stable viewed completion markers) is now locked by automated regression coverage at `SessionList.viewed-persistence.test.tsx:144-211`, which exercises the exact scenario the user reported: persisted markers across `sessions=[] + isLoading=true` followed by an authoritative loaded list. Combined with rounds 1+2 (CLI hot-switch contract test, App SSE subscription scope sentry, useSSE cross-session convergence sentry, SessionList persistence + storage-failure tests), all four observable truths are programmatically gated.

### Gaps Summary

Wave gap for plan 01-21 is closed:

1. **Refresh-stable viewed completion markers (01-21)** — `SessionList.tsx` prune effect now early-returns on `props.isLoading && props.sessions.length === 0` (lines 143-150), with `props.isLoading` added to effect deps so prune resumes once authoritative data arrives. Regression test `does not prune persisted viewed markers during a transient empty loading render` (test file lines 144-211) seeds `{ sessionA: 10, sessionB: 20 }`, renders an empty-loading state, asserts persistence, then asserts both `Viewed` indicators after the loaded rerender. Commits `c455ad9` (test) / `687be08` (fix) / `b6dab34` (docs) all landed.

Prior wave closures (rounds 1+2: 01-18 hot-switch contract, 01-19 SSE `{ all: true }`, 01-20 localStorage baseline) remain VERIFIED and unchanged.

Known pre-existing flake (`cli/src/runner/runner.integration.test.ts` beforeEach timeouts, last touched in `255867d`, untouched by this wave) remains excluded by user instruction — not a regression introduced by 01-21.

Phase 1 goal remains achieved across all four observable truths. UAT Test 6 / CURS-04 / D-15 — closed.

---

_Verified: 2026-05-24T14:31:00Z_
_Verifier: Claude (gsd-verifier)_
