---
phase: 01-cursor-runtime-config-contract
plan: 21
subsystem: web/session-list
tags: [web, react, localStorage, persistence, ux, gap-closure, refresh]
requires:
  - 01-20 (localStorage-backed viewedCompletionMarkers + prune effect baseline)
provides:
  - Refresh-stable viewed-marker persistence across transient empty loading renders
affects:
  - web/src/components/SessionList.tsx
tech-stack:
  added: []
  patterns:
    - Authoritative-only mutation guard (skip writes when source data is non-authoritative)
key-files:
  created: []
  modified:
    - web/src/components/SessionList.tsx
    - web/src/components/SessionList.viewed-persistence.test.tsx
decisions:
  - Smallest viable fix is in SessionList.tsx prune effect, not in useSessions.ts / _factory.ts
  - Authoritative signal = props.isLoading=false; loaded empty list still prunes correctly
  - Added props.isLoading to prune-effect deps so the effect re-runs when refresh completes
metrics:
  duration: 4m
  completed: 2026-05-24
  tasks: 2
  files_modified: 2
---

# Phase 01 Plan 21: Refresh-stable Viewed Completion Markers Summary

**One-liner:** Skip viewed-marker pruning during transient `isLoading && sessions.length === 0` renders so page refresh no longer wipes `hapi.session-list.viewed-completion-markers` — closing UAT Test 6 / CURS-04 / D-15.

## What Changed

- **`web/src/components/SessionList.tsx`** — Added an early-return guard at the top of the prune `useEffect`: when `props.isLoading && props.sessions.length === 0`, the effect does nothing, leaving persisted `viewedCompletionMarkers` untouched. Added `props.isLoading` to the effect's dependency array so the prune logic re-runs once authoritative data arrives. All other prune semantics (absent-session removal, stale-marker removal) remain unchanged.
- **`web/src/components/SessionList.viewed-persistence.test.tsx`** — Added regression test `does not prune persisted viewed markers during a transient empty loading render`. Seeds `{ sessionA: 10, sessionB: 20 }`, renders with `sessions=[]` + `isLoading=true` + `selectedSessionId='sessionB'`, asserts both markers persist in `localStorage`, then rerenders with both completed sessions loaded and asserts two `Viewed` indicators (no `Unread result`).

## Why

`SessionList` previously treated every `props.sessions` change as authoritative. On page refresh, TanStack Query data is briefly `undefined`; `useSessions.ts` maps that to `[]`; `_factory.ts` calls `select(query.data)` even when data is undefined. The first refresh render therefore arrived with `sessions=[]`, the prune effect saw "no live sessions", wiped persisted state to `{}`, and only the currently-selected session was re-marked viewed by the selected-session effect — turning all other previously-viewed completed sessions green/unread again.

## Verification

- `cd web && bun run test -- SessionList.viewed-persistence` — 5/5 passed (RED → GREEN confirmed: the new test failed before the fix with `Expected {sessionA:10,sessionB:20}, Received {}`, passes after).
- `cd web && bun run test -- SessionList` — 35/35 passed across 7 SessionList test files.
- `bun run typecheck` — passed (cli + web + hub).
- `bash scripts/check-no-cut-agents.sh` — passed (no forbidden literals).
- `bun run madge:check` — passed (no circular deps, 649 files).

## Deviations from Plan

None — plan executed exactly as written. The minor implementation polish (adding `props.isLoading` to the prune effect's deps array) is a strict-mode hygiene requirement implied by the prune guard and is consistent with the plan's "smallest production change" directive.

## Decisions Made

- **Authoritative-only signal:** `props.isLoading === false` is the authoritative threshold. Loaded empty lists (`isLoading=false`, `sessions.length=0`) still prune, preserving T-01-21-03 mitigation.
- **No upstream change:** `useSessions.ts` and `_factory.ts` were not touched. The transient `[]` render is correctly distinguishable in `SessionList` via the existing `isLoading` prop, so no hook-level change was needed.

## Risks Mitigated

- **T-01-21-02** Refresh loading render integrity — guard prevents non-authoritative writes.
- **T-01-21-03** Authoritative deletion still removes orphaned entries once `isLoading=false`.
- **T-01-21-01** Numeric validation + stale-marker pruning from Plan 01-20 unchanged.

## Self-Check: PASSED

- `web/src/components/SessionList.tsx` — modified (prune-effect guard + dep update).
- `web/src/components/SessionList.viewed-persistence.test.tsx` — modified (new regression test).
- Commit `c455ad9` (test RED) — present in `git log`.
- Commit `687be08` (fix GREEN) — present in `git log`.
