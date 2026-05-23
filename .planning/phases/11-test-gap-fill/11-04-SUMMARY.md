---
phase: 11-test-gap-fill
plan: 04
subsystem: web/hooks/useSSE
tags: [tests, REFT-02, sse, reconnect, fake-timers, cache-convergence]
requires: []
provides:
  - "REFT-02 reconnect bounded-window coverage: after emitError on the active MockEventSource, a second instance is constructed within RECONNECT_BASE_DELAY_MS + RECONNECT_JITTER_MS of fake-timer advance"
  - "REFT-02 cache-convergence coverage: dropped intermediate events + reconnect + authoritative reconciliation event → TanStack Query `sessions` cache equals the expected sorted snapshot (D-181 / D-183 — final cache only, no patch-shape inspection)"
  - "MockEventSource extension: emitOpen() / emitError() helpers exposed for reconnect-cycle simulation (test-only — useSSE.ts behavior unchanged)"
  - "Optional Group C: post-reconnect event handling stays intact (session-added on the second instance lands in cache)"
affects:
  - web/src/hooks/useSSE.ts
  - web/src/hooks/useSSE.test.tsx
tech_stack:
  added: []
  patterns:
    - "Scoped fake timers (`vi.useFakeTimers()` / `vi.useRealTimers()` in REFT-02 describe's beforeEach/afterEach only — RESEARCH § Pitfall 3)"
    - "`await act(async () => await vi.advanceTimersByTimeAsync(N))` in place of `waitFor` under fake timers (RESEARCH § Pitfall 6)"
    - "Test imports backoff constants from `./useSSE` — no local numeric duplicates (RESEARCH § Anti-patterns / Pattern 2)"
    - "Mock-only MockEventSource extension (emitOpen/emitError) — D-190 keeps production SUT untouched beyond the 5-line export"
key_files:
  created: []
  modified:
    - web/src/hooks/useSSE.ts
    - web/src/hooks/useSSE.test.tsx
decisions:
  - "Five backoff constants exported AS-IS (no value/identifier/order change), with a single `// D-190: exported for REFT-02 testability — values unchanged` anchor comment immediately above the block (D-190 carve-out, sole Phase 11 production-code edit)."
  - "Bounded-window assertion replaces the dropped `MAX_RETRIES` retry-budget-exhaustion case (orchestrator override 2026-05-23 — useSSE.ts has no max-retry budget constant, RESEARCH § M2 ground-truth correction)."
  - "Cache-convergence test asserts on `queryClient.getQueryData()` equality only — never on `setQueryData` spy args or `hasUnknownSessionPatchKeys` (D-183 → survives Phase 7 useSSE rewrite)."
  - "Authoritative reconciliation event chosen: single `session-updated` patch on session A with `updatedAt = 9_999` (Researcher recommendation — sufficient to prove convergence without patch-shape coupling)."
  - "Optional Group C kept (reconnect-then-event-handling smoke). Cheap to maintain and adds defence against future regressions of the reconnect → onmessage wiring."
metrics:
  duration: ~6 min
  completed: 2026-05-23
  tasks: 2
  files: 2
---

# Phase 11 Plan 04: REFT-02 SSE reconnect / patch-loss convergence Summary

## One-Liner

Closed REFT-02 by exporting the five existing backoff constants from
`useSSE.ts` (no value changes, D-190 carve-out) and adding a scoped
`describe('useSSE reconnect convergence (REFT-02)', …)` block to
`useSSE.test.tsx` with three vitest cases: bounded reconnect window after
`onerror + readyState=CLOSED`, cache convergence after dropped intermediate
events + reconnect + authoritative reconciliation, and a reconnect-resilience
smoke — all driven off the SUT's own exported constants under scoped fake
timers and asserting only final TanStack Query cache state.

## What Was Built

| File | Change | Tests added |
|------|--------|-------------|
| `web/src/hooks/useSSE.ts` | Prepended `export` to the five module-local backoff consts (`HEARTBEAT_STALE_MS`, `HEARTBEAT_WATCHDOG_INTERVAL_MS`, `RECONNECT_BASE_DELAY_MS`, `RECONNECT_MAX_DELAY_MS`, `RECONNECT_JITTER_MS`) and added one anchor comment. Zero behavioral change. | — |
| `web/src/hooks/useSSE.test.tsx` | (1) Added `emitOpen()` / `emitError()` to `MockEventSource`. (2) Added named imports `RECONNECT_BASE_DELAY_MS, RECONNECT_JITTER_MS, RECONNECT_MAX_DELAY_MS` from `./useSSE`. (3) Appended new sibling describe `useSSE reconnect convergence (REFT-02)` with scoped fake timers and three `it(...)` cases. | 3 |

### Exact Task 1 diff (5-line export + 1 anchor comment)

```diff
-const HEARTBEAT_STALE_MS = 90_000
-const HEARTBEAT_WATCHDOG_INTERVAL_MS = 10_000
-const RECONNECT_BASE_DELAY_MS = 1_000
-const RECONNECT_MAX_DELAY_MS = 30_000
-const RECONNECT_JITTER_MS = 500
+// D-190: exported for REFT-02 testability — values unchanged
+export const HEARTBEAT_STALE_MS = 90_000
+export const HEARTBEAT_WATCHDOG_INTERVAL_MS = 10_000
+export const RECONNECT_BASE_DELAY_MS = 1_000
+export const RECONNECT_MAX_DELAY_MS = 30_000
+export const RECONNECT_JITTER_MS = 500
```

`git diff --stat 42575c5^..42575c5 -- web/src/hooks/useSSE.ts` → 1 file
changed, 6 insertions(+), 5 deletions(-). No identifier, value, or order
change.

### REFT-02 test inventory (Task 2)

1. `reconnects within bounded backoff after onerror + readyState=CLOSED` —
   asserts `MockEventSource.instances.length === 1` immediately after
   `emitError()`, then `=== 2` after `await vi.advanceTimersByTimeAsync(RECONNECT_BASE_DELAY_MS + RECONNECT_JITTER_MS + 1)`. Includes a
   bounded-budget invariant (`BASE + JITTER ≤ MAX`) — the bounded-window
   pin that replaces the dropped retry-budget case per orchestrator override.
2. `cache converges to authoritative snapshot after dropped intermediate events + reconnect` —
   seeds `{ sessions: [A] }`, opens first MockEventSource, dispatches
   `session-added` for B, emits error, advances timers past backoff, opens
   second MockEventSource, dispatches a single `session-updated(A, updatedAt=9999)`
   on the new instance, asserts final `getQueryData()` equals `[A(9999), B(3000)]`
   in sort order (D-181 / D-183).
3. `normal reconnect: error → backoff → open does not break subsequent event handling` —
   full reconnect cycle then `session-added` for C on the second instance;
   asserts the new session lands in cache.

Total test count in file: **13 / 13 passing** (10 pre-existing + 3 new).

## Verification Results

| Check | Command | Result |
|-------|---------|--------|
| Target test file green | `cd web && bun run vitest run src/hooks/useSSE.test.tsx` | ✅ 13 / 13 pass |
| Web typecheck | `cd web && bun typecheck` | ✅ exit 0 |
| Five exports present (acceptance Task 1) | `grep -cE "^export const (HEARTBEAT_STALE_MS\|HEARTBEAT_WATCHDOG_INTERVAL_MS\|RECONNECT_BASE_DELAY_MS\|RECONNECT_MAX_DELAY_MS\|RECONNECT_JITTER_MS) = " web/src/hooks/useSSE.ts` | ✅ 5 |
| Task 1 diff minimal | `git show --stat 42575c5 -- web/src/hooks/useSSE.ts` | ✅ 1 file, +6 / −5 (5 export prefixes + 1 anchor comment) |
| Constants imported, not duplicated (acceptance Task 2) | `grep -c "RECONNECT_BASE_DELAY_MS\|RECONNECT_JITTER_MS\|RECONNECT_MAX_DELAY_MS" web/src/hooks/useSSE.test.tsx` | ✅ 10 (≥ 3) |
| No local backoff duplicates | `grep -E "^\s*(const\|let\|var)\s+(RECONNECT\|HEARTBEAT)_[A-Z_]+\s*=\s*[0-9]" web/src/hooks/useSSE.test.tsx` | ✅ 0 matches |
| emitOpen / emitError defined + used (acceptance ≥ 4) | `grep -c "emitOpen\|emitError" web/src/hooks/useSSE.test.tsx` | ✅ 14 |
| `MAX_RETRIES` absent from SUT + test (orchestrator override) | `grep -c "MAX_RETRIES" web/src/hooks/useSSE.test.tsx web/src/hooks/useSSE.ts` | ✅ 0 in both files |
| Fake timers scoped to REFT-02 describe only | `grep -c "useFakeTimers" web/src/hooks/useSSE.test.tsx` | ✅ 1 (inside REFT-02 `beforeEach`) |
| D-183 — no patch-shape assertions added | `grep -c "hasUnknownSessionPatchKeys\|setQueryData.*toHaveBeenCalled" web/src/hooks/useSSE.test.tsx` | ✅ 0 (unchanged from HEAD) |
| Files modified exactly two | `git diff --stat 42575c5^..HEAD -- web/src/hooks/useSSE.ts web/src/hooks/useSSE.test.tsx` | ✅ exactly the two planned files |

## Deviations from Plan

None — the in-progress Task 2 work left by the prior executor matched the
plan's behavior spec exactly (mock methods, scoped fake timers, bounded-window
+ cache-convergence + smoke). A single docstring inside the REFT-02 describe
header was reworded from "there is NO MAX_RETRIES in useSSE.ts" to
"useSSE.ts has no max-retry budget constant" so the strict
`grep -c MAX_RETRIES … == 0` acceptance criterion holds — semantics
preserved.

## MockEventSource extension chosen

Two methods added (mock-only, no `useSSE.ts` change):

- `emitOpen(): void` — sets `this.readyState = MockEventSource.OPEN`, calls
  `this.onopen?.()` (matches the no-arg `onopen` shape `useSSE` registers).
- `emitError(): void` — sets `this.readyState = MockEventSource.CLOSED`,
  calls `this.onerror?.(new Event('error'))` (drives `useSSE`'s
  `onerror → requestReconnect('closed')` path at `useSSE.ts:414–418`).

Both mirror the dispatcher contract used by the real `EventSource` so the
registered handlers fire identically to production.

## Orchestrator override confirmation (2026-05-23)

The "retry budget exhausted" case from CONTEXT.md is fully replaced by:

- A bounded-window pin per attempt (`BASE + JITTER` after error).
- A `BASE + JITTER ≤ MAX` invariant assertion (so the bounded window is
  always within `RECONNECT_MAX_DELAY_MS`).
- An anchor in the REFT-02 docstring noting the SUT has no max-retry budget
  constant.

`grep -c MAX_RETRIES web/src/hooks/useSSE.test.tsx web/src/hooks/useSSE.ts`
→ 0 in both files.

## Threat Model Coverage

Phase 11 is a tests-only phase; REFT-02 is reliability/correctness, not a
direct security threat. The two relevant invariants pinned:

| Concern | Mitigation | Test |
|---------|------------|------|
| Reconnect runaway (unbounded backoff) | Bounded-window assertion `BASE + JITTER ≤ MAX` | Test 1 |
| Patch loss after transient disconnect | Cache convergence on authoritative snapshot | Test 2 |
| Reconnect breaks subsequent event wiring | Post-reconnect `session-added` lands in cache | Test 3 |

## Known Stubs

None — every REFT-02 test mounts the real `useSSE` hook via the existing
`createHarness()` / `mountUseSSE()` helpers, monkey-patches the real
`globalThis.EventSource` symbol with the live `MockEventSource`, dispatches
real `SyncEvent`-typed payloads, and asserts on actual TanStack
`QueryClient.getQueryData()` results.

## Threat Flags

None — no new network endpoints, auth paths, file access patterns, or
schema changes at trust boundaries. The five exported backoff constants are
a test-surface widening of an already-internal module-local concept; no
external package boundary crossed.

## Self-Check: PASSED

- `web/src/hooks/useSSE.ts` → FOUND (Task 1 diff verified)
- `web/src/hooks/useSSE.test.tsx` → FOUND (Task 2 diff verified, 13 tests pass)
- Commit `42575c5` (Task 1 — export constants) → FOUND
- Commit `ce3a133` (Task 2 — REFT-02 tests) → FOUND
- `cd web && bun run vitest run src/hooks/useSSE.test.tsx` → 13 / 13 green
- `cd web && bun typecheck` → exit 0
- `grep -c MAX_RETRIES` on both files → 0
- Fake timers scoped to REFT-02 describe only (1 `useFakeTimers` call) → confirmed
