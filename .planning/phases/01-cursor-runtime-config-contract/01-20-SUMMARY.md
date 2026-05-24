---
phase: 01-cursor-runtime-config-contract
plan: 20
subsystem: web/session-list
tags: [web, react, localStorage, persistence, ux, gap-closure]
requires:
  - 01-08 (compact session-list status indicators; viewedCompletionMarkers shape)
  - 01-13 (durable completion markers across refetch)
provides:
  - Browser-side persistence for viewed completion markers (refresh-stable)
affects:
  - web/src/components/SessionList.tsx
tech-stack:
  added: []
  patterns:
    - Lazy useState initializer + write-through + try/catch (matches useRecentPaths.ts)
key-files:
  created:
    - web/src/components/SessionList.viewed-persistence.test.tsx
  modified:
    - web/src/components/SessionList.tsx
decisions:
  - Storage key 'hapi.session-list.viewed-completion-markers' (dotted segments, structured value)
  - Inline loader/saver helpers in SessionList.tsx (no new hook — only one consumer)
  - Prune effect drops both absent-session entries AND stale-marker entries (matches D-15 semantics)
  - Loader validates numeric values, drops non-numeric silently (T-01-20-02)
  - No console warnings on storage failure (D-03 silent local degradation)
metrics:
  duration: 6m
  completed: 2026-05-24
---

# Phase 01 Plan 20: localStorage-backed Viewed Completion Markers Summary

**One-liner:** Replaced React-only `viewedCompletionMarkers` `useState` with a `localStorage`-backed map (key: `hapi.session-list.viewed-completion-markers`) so completed sessions stay gray after a page refresh — closing UAT Test 5 part 2.

## What Changed

- **`web/src/components/SessionList.tsx`** — Added module-scoped `loadViewedCompletionMarkers` / `saveViewedCompletionMarkers` helpers (SSR-guarded + try/catch + numeric-value validation). The `viewedCompletionMarkers` `useState` now uses `loadViewedCompletionMarkers` as a lazy initializer. `markCompletionViewed` now write-throughs to `localStorage`. A new `useEffect` keyed on `props.sessions` prunes entries whose session id is gone OR whose stored marker no longer matches the live `completionMarker` — naturally re-triggering green-unread when a NEW completion marker arrives on a previously-viewed session.
- **`web/src/components/SessionList.viewed-persistence.test.tsx`** (new) — Vitest regression coverage for hydrate-on-mount, write-through, prune, and storage-failure resilience. Uses the canonical `getByLabelText('Viewed')` aria-label assertion (matches `SessionListItem.test.tsx:174` and `SessionList.directory-action.test.tsx:137`); no new `data-testid` introduced on production code.

## Tasks Executed

| Task | Name                                                         | Commit    | Files                                                      |
|------|--------------------------------------------------------------|-----------|------------------------------------------------------------|
| 1    | RED — failing regression coverage (4 cases)                  | `d2de387` | `web/src/components/SessionList.viewed-persistence.test.tsx` |
| 2    | GREEN — back viewedCompletionMarkers with localStorage       | `b0caf9d` | `web/src/components/SessionList.tsx`, test file            |

## Verification

- `cd web && bun run test -- SessionList` → 7 files / 34 tests pass (incl. 4 new persistence cases).
- `cd web && bun run test` → 92 files / 689 tests pass.
- `bun run typecheck` → exit 0 (cli + web + hub).
- `bash scripts/check-no-cut-agents.sh` → exit 0 (banned-literal guard).
- `bun run madge:check` → exit 0, no circular dependency.
- GitNexus `impact(SessionList, upstream)` → LOW risk, only `SessionsPage` is a direct caller.
- GitNexus `detect_changes` → 4 changed symbols inside `SessionList.tsx`, 1 affected process (`SessionList → IsBrowser`), risk=medium (expected — adds browser-storage step).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Test scoping] Storage spies narrowed to the SessionList key**

- **Found during:** Task 2 verification — the initial Case 4 test stubbed `Storage.prototype.getItem` to throw unconditionally, which caused `I18nProvider` (which calls `localStorage.getItem('hapi:lang')`) to throw at mount time.
- **Issue:** The plan-prescribed `vi.spyOn(Storage.prototype, 'getItem').mockImplementation(...)` blanket override broke unrelated app code paths exercised by the `renderWithProviders` setup, producing a misleading failure that did not test SessionList resilience.
- **Fix:** Both the `setItem` and `getItem` spies now check `key === STORAGE_KEY` and only throw for `'hapi.session-list.viewed-completion-markers'`. All other localStorage calls (i18n, theme, recent paths) pass through to the real implementation.
- **Files modified:** `web/src/components/SessionList.viewed-persistence.test.tsx`
- **Commit:** `b0caf9d`
- **Plan precedent:** the plan explicitly allowed the alternative `vi.stubGlobal` route, so a key-scoped spy is within the documented design space.

## Auth Gates

None.

## Threat Flags

None — this plan adds only a same-origin browser storage hop scoped to the existing local-only "viewed state" surface. T-01-20-01..04 from PLAN.md are mitigated as planned.

## Known Stubs

None.

## Self-Check: PASSED

- `web/src/components/SessionList.tsx` exists — FOUND
- `web/src/components/SessionList.viewed-persistence.test.tsx` exists — FOUND
- Commit `d2de387` (RED) — FOUND in `git log`
- Commit `b0caf9d` (GREEN) — FOUND in `git log`
- Source assertions (RG): all required literals present
  - `'hapi.session-list.viewed-completion-markers'` appears in `SessionList.tsx` (3×: const + loader + saver) and in the test file (5×).
  - `loadViewedCompletionMarkers` appears 2× (helper + lazy initializer); `saveViewedCompletionMarkers` appears 3× (helper + write-through call + prune-effect call).
  - `typeof window` SSR guard present in both helpers; `try {` appears in both helpers.
  - `getByLabelText('Viewed')` present in the new test file.
  - No `from 'bun:test'` in the new test file (cross-runner discipline preserved).
  - No new `data-testid` on `SessionList.tsx` or `SessionListItem.tsx`.
  - `git status` shows zero changes outside `web/`.
