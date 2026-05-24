---
phase: 01-cursor-runtime-config-contract
plan: 19
subsystem: web-sse
tags: [web, sse, subscription, session-list, status-convergence, gap-closure]
gap_closure: true
requirements: [CURS-04]
dependency_graph:
  requires:
    - 01-08-SUMMARY.md (compact session-list status indicators)
    - 01-10-SUMMARY.md (idle / completion status markers)
    - 01-13-SUMMARY.md (durable completion markers across refetch)
  provides:
    - web/src/App.tsx (unconditional `{ all: true }` SSE subscription)
    - web/src/App.test.tsx (subscription-scope regression sentry — new)
    - web/src/hooks/useSSE.test.tsx (cross-session patch convergence sentry)
  affects:
    - mobile session list status convergence while a chat session is open
tech-stack:
  added: []
  patterns:
    - "Stable, dependency-less `useMemo(() => ({ all: true }), [])` SSE subscription scope — the Hub fanout filter is the only place to narrow streams, and we never narrow it."
    - "Hoisted `vi.hoisted({...})` mock state for capturing `useSSE` call args across multiple `render` passes in a single Vitest case (App.test.tsx pattern)."
key-files:
  created:
    - web/src/App.test.tsx
  modified:
    - web/src/App.tsx
    - web/src/hooks/useSSE.test.tsx
decisions:
  - "Kept the LOCKED direction from the gap brief: `{ all: true }` always; no second per-session SSE stream, no Hub-side rework. Single-user Tailscale deployment makes the information-disclosure threat (T-01-19-01) accept-grade."
  - "Did NOT delete the `selectedSessionId` computation — it is still consumed by `handleSseConnect` (per-session detail invalidation) and `handleSseEvent` (`messages-invalidated` gate)."
  - "App.test.tsx mocks `useSSE` and the auth/router/runtime stack rather than wiring a real router — keeps the regression intent-level (subscription shape) without re-asserting unrelated App behavior."
metrics:
  duration: ~7m
  completed: 2026-05-24
---

# Phase 01 Plan 19: Always-On Global SSE Subscription Summary

One-liner: Closed UAT Test 5 part 1 / CURS-04 / D-13 by dropping the `{ sessionId: selectedSessionId }` narrowing branch in `web/src/App.tsx`'s `eventSubscription`, so the mobile SessionList keeps converging on idle/thinking/running/waiting/error/completed status for every session even while the user is inside one chat session.

## What changed

### Production (Task 2 — feat baefa20)

- `web/src/App.tsx`: `eventSubscription` is now `useMemo(() => ({ all: true }), [])`. The previous narrowing branch (`if (selectedSessionId) return { sessionId: selectedSessionId }`) is gone. `selectedSessionId` is still computed and still drives `handleSseConnect` (per-session detail invalidation) and `handleSseEvent` (`messages-invalidated` gate); only the SSE subscription scope was widened. Comment in the file pins the CURS-04 / 01-19 / debug-doc rationale.

### Tests (Task 1 — test e28fc68)

- `web/src/App.test.tsx` (new, co-located per AGENTS.md): single Vitest case `'App SSE subscription scope is always { all: true } regardless of selected session'`. Mocks `@/hooks/useSSE` to capture every `subscription` argument, mocks `@tanstack/react-router` (`useMatchRoute`/`useLocation`/`useRouter`/`Outlet`), the auth hooks, and the leaf components needed to render past the auth gate. Renders App twice — once at `/` and once at `/sessions/sessionA` — and asserts that the most recent `useSSE` call always received `subscription: { all: true }` and never a `subscription` with a `sessionId` key. Failed RED before Task 2 with `expected { sessionId: 'sessionA' } to deeply equal { all: true }`; passes GREEN after.
- `web/src/hooks/useSSE.test.tsx`: appended sentry case `"session-updated event for a non-selected session updates that session's SessionList summary cache entry while another session is open (cross-session patch convergence)"`. Seeds two summaries (`sessionA`, `sessionB` with `statusKind: 'thinking'`), seeds `sessionA`'s detail cache, dispatches a `session-updated` for `sessionB` with the completion patch shape used by Plan 13, and asserts the SessionList summary for `sessionB` flips to `statusKind: 'completed' / completionMarker: 7000 / thinking: false` while `sessionA`'s detail cache is untouched. Passed under the existing `useSSE` (it already dispatches by `event.sessionId`); now locks that contract going forward.

## How it works now

Before: when the user opened any `/sessions/:sessionId` route, App memoized `eventSubscription` to `{ sessionId: selectedSessionId }`, the EventSource URL flipped from `?all=true` to `?sessionId=<id>`, and the Hub filtered every other session's `session-updated` patches out of the stream. SessionList rows for non-selected sessions froze on whichever `statusKind` was last cached — exactly the spinner-stuck behavior in `.planning/debug/session-list-spinner-stuck.md`.

After: `eventSubscription` is a stable `{ all: true }` literal, the EventSource URL stays `?all=true`, and the Hub keeps fanning out every session's patches. `useSSE.patchSessionSummary` continues to dispatch by `event.sessionId`, so each session's row re-renders independently. The selected session's detail view still receives its own `session-updated` patches via the same all-stream — the detail cache is keyed by session id, not by subscription scope.

## GitNexus impact

Pre-edit `impact` checks (per `.cursor/rules/gitnexus.mdc`): `AppInner` LOW (1 upstream — `App`), `useSSE` LOW (1 upstream — `AppInner`). No HIGH/CRITICAL surfaces. No other readers of `eventSubscription` exist (it is a local memoized value).

## Deviations from Plan

None — plan executed exactly as written. No auto-fixes (Rules 1-3) were needed; tests and types passed on the first run after Task 2.

## Verification

- `cd web && bun run test -- App useSSE` → 6 files, 47 tests, all green.
- `cd web && bun run test` → 91 files, 685 tests, all green.
- `bun run typecheck` (cli + web + hub) → clean.
- `bash scripts/check-no-cut-agents.sh` → Phase 12 + Phase 10 guards PASS.
- `bun run madge:check` → 0 circular dependencies.

## Threat surface

No new endpoints, schemas, or trust boundaries introduced. The widened subscription scope is the same `{ all: true }` scope already reachable on the root route — no information-disclosure delta for the authenticated user. Threats T-01-19-01 (accept), T-01-19-02 (mitigate via single-EventSource-per-key), and T-01-19-03 (mitigate via cross-session convergence test) hold as planned.

## Self-Check: PASSED

- File `web/src/App.test.tsx`: FOUND.
- File `web/src/App.tsx` (modified): FOUND, contains `useMemo(() => ({ all: true }), [])` and no `sessionId: selectedSessionId` literal.
- File `web/src/hooks/useSSE.test.tsx` (modified): FOUND, contains `cross-session patch convergence`.
- Commit `e28fc68` (test RED): FOUND.
- Commit `baefa20` (feat GREEN): FOUND.
