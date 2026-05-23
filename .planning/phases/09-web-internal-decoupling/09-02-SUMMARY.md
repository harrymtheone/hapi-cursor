---
phase: 9
plan: 2
subsystem: web
tags: [refactor, decomposition, facade, hooks, sub-components]
dependency_graph:
  requires: [phase-09-01]
  provides:
    - "web/src/lib/message-window-store.ts (28-line re-export facade)"
    - "web/src/lib/messageWindowState.ts (Map owner + accessors)"
    - "web/src/lib/messageWindowPersistence.ts (sessionStorage)"
    - "web/src/lib/messageWindowPaginationService.ts (fetch + trim)"
    - "web/src/lib/messageWindowMergeService.ts (ingest + optimistic)"
    - "web/src/lib/messageWindowSubscriptions.ts (subscribe/clear/seed)"
    - "web/src/components/SessionList.tsx (229-line orchestrator)"
    - "web/src/components/SessionList/SessionListHeader.tsx"
    - "web/src/components/SessionList/SessionListSearch.tsx"
    - "web/src/components/SessionList/SessionListItem.tsx"
    - "web/src/components/SessionList/SessionListEmpty.tsx"
    - "web/src/components/SessionList/SessionListIcons.tsx (Rule 3 support file)"
    - "web/src/components/SessionList/useSessionListData.ts"
    - "web/src/components/SessionList/useSessionListSearch.ts"
    - "web/src/components/SessionList/useSessionListSelection.ts"
    - "web/src/components/SessionList/useSessionListKeyboard.ts"
  affects:
    - web/src/router.tsx (no import change — public surface preserved)
    - web/src/components/SessionList.test.ts (passes unmodified)
    - web/src/components/SessionList.directory-action.test.tsx (passes unmodified)
    - web/src/lib/message-window-store.test.ts (passes unmodified)
tech_stack:
  added: []
  patterns:
    - "thin-re-export-facade + 5 sub-modules sharing Maps via exported accessors (Pitfall 1 enforcement)"
    - "orchestrator + 4 hooks + 4 sub-components composition (mirrors NewSession/index.tsx layout)"
    - "co-located *.test.* files for each new shard"
key_files:
  created:
    - web/src/lib/messageWindowState.ts
    - web/src/lib/messageWindowPersistence.ts
    - web/src/lib/messageWindowPaginationService.ts
    - web/src/lib/messageWindowMergeService.ts
    - web/src/lib/messageWindowSubscriptions.ts
    - web/src/lib/messageWindowState.test.ts
    - web/src/lib/messageWindowPersistence.test.ts
    - web/src/lib/messageWindowPaginationService.test.ts
    - web/src/lib/messageWindowMergeService.test.ts
    - web/src/lib/messageWindowSubscriptions.test.ts
    - web/src/components/SessionList/SessionListHeader.tsx
    - web/src/components/SessionList/SessionListSearch.tsx
    - web/src/components/SessionList/SessionListItem.tsx
    - web/src/components/SessionList/SessionListEmpty.tsx
    - web/src/components/SessionList/SessionListIcons.tsx
    - web/src/components/SessionList/useSessionListData.ts
    - web/src/components/SessionList/useSessionListSearch.ts
    - web/src/components/SessionList/useSessionListSelection.ts
    - web/src/components/SessionList/useSessionListKeyboard.ts
    - web/src/components/SessionList/SessionListHeader.test.tsx
    - web/src/components/SessionList/SessionListSearch.test.tsx
    - web/src/components/SessionList/SessionListItem.test.tsx
    - web/src/components/SessionList/SessionListEmpty.test.tsx
  modified:
    - web/src/lib/message-window-store.ts (1088 → 28 lines; pure re-export facade)
    - web/src/components/SessionList.tsx (953 → 229 lines; orchestrator only)
decisions:
  - "D-150 honored: message-window-store decomposition is a literal file-split; no semantics changed. The existing message-window-store.test.ts and SessionList.test.ts pass without modification, proving the public surface is preserved."
  - "RESEARCH Q8 Option A applied: 5-sub-module split (state / persistence / pagination / merge / subscriptions) keeps every sub-module < 400 lines. messageWindowState.ts at 387 — within the < 400 line budget."
  - "Pitfall 1 enforced via exported accessors getInternalState / updateInternalState / getInternalListeners (+ peekInternalState / setInternalState / setInternalListeners / deleteInternalListeners). The shared Maps (states, listeners, pendingVisibilityCacheBySession) live only in messageWindowState.ts; siblings consume them through the accessor surface."
  - "Deviation Rule 1 (bug-correction-not-architectural): the plan acceptance criterion stated `grep -c \"^export default\" SessionList.tsx == 1`, but the pre-refactor file uses a NAMED export (`export function SessionList`). The actual public contract — router.tsx imports `{ SessionList }` — uses the named-export form. Preserved that surface verbatim; the orchestrator's grep now reports 1 named `export function SessionList` instead. T-09-05 is mitigated by zero caller-import changes, not by export-style; the plan's literal grep is documented as a planner typo and superseded by the higher-level acceptance criterion `external callers require zero import changes`."
  - "Deviation Rule 3 (structural support): added one extra support file `SessionList/SessionListIcons.tsx` (91 lines) to host the shared inline-SVG icons (CopyPathButton, MachineIcon, ChevronIcon, PlusIconSmall). Without that extraction the orchestrator stays at 314 lines, violating the < 250 acceptance criterion. The file is not a barrel; it is a focused icons module sitting next to the 4 hook + 4 sub-component files. No external surface change."
metrics:
  duration_minutes: 18
  completed: 2026-05-23
---

# Phase 9 Plan 2: Decompose message-window-store + SessionList — Summary

`web/src/lib/message-window-store.ts` (1088 lines) and `web/src/components/SessionList.tsx`
(953 lines) — the two largest oversized files in the web workspace — are now thin
composition points over focused siblings. `message-window-store.ts` is a 28-line
re-export facade over 5 sub-modules (state / persistence / pagination / merge /
subscriptions), and `SessionList.tsx` is a 229-line orchestrator composing 4 hooks
+ 4 named sub-components + a small icons support file. The shared Maps that back
the message window (states, listeners, pendingVisibilityCacheBySession) live in
exactly one module (`messageWindowState.ts`) and are consumed via exported
accessors per RESEARCH Pitfall 1. Every public name re-exported by the facade
matches the pre-refactor surface, so external callers — `useMessages.ts`,
`useSSE.ts`, `SessionChat.tsx`, `router.tsx`, and both pre-existing test files
(`message-window-store.test.ts`, `SessionList.test.ts`, `SessionList.directory-action.test.tsx`)
— required zero import changes and pass unmodified.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 2.1 | Decompose message-window-store.ts into 5 sub-modules + thin re-export facade | 2217305 | web/src/lib/message-window-store.ts, web/src/lib/messageWindowState.ts, web/src/lib/messageWindowPersistence.ts, web/src/lib/messageWindowPaginationService.ts, web/src/lib/messageWindowMergeService.ts, web/src/lib/messageWindowSubscriptions.ts |
| 2.2 | Colocated tests for the 5 message-window sub-modules | f3a2c67 | web/src/lib/messageWindowState.test.ts, web/src/lib/messageWindowPersistence.test.ts, web/src/lib/messageWindowPaginationService.test.ts, web/src/lib/messageWindowMergeService.test.ts, web/src/lib/messageWindowSubscriptions.test.ts |
| 2.3 | Decompose SessionList.tsx into 4 hooks + 4 sub-components + orchestrator | c1d90df | web/src/components/SessionList.tsx + 10 SessionList/* files |
| 2.4 | Colocated tests for the 4 SessionList sub-components | 51af925 | web/src/components/SessionList/SessionListHeader.test.tsx, web/src/components/SessionList/SessionListSearch.test.tsx, web/src/components/SessionList/SessionListItem.test.tsx, web/src/components/SessionList/SessionListEmpty.test.tsx |

## File Size Budgets

| File | Lines | Budget |
|------|------:|-------:|
| web/src/lib/message-window-store.ts (facade) | 28 | < 80 |
| web/src/lib/messageWindowState.ts | 387 | < 400 |
| web/src/lib/messageWindowPersistence.ts | 143 | < 400 |
| web/src/lib/messageWindowPaginationService.ts | 301 | < 400 |
| web/src/lib/messageWindowMergeService.ts | 275 | < 400 |
| web/src/lib/messageWindowSubscriptions.ts | 67 | < 400 |
| web/src/components/SessionList.tsx (orchestrator) | 229 | < 250 |
| web/src/components/SessionList/useSessionListData.ts | 210 | < 250 |
| web/src/components/SessionList/useSessionListSearch.ts | 31 | < 250 |
| web/src/components/SessionList/useSessionListSelection.ts | 142 | < 250 |
| web/src/components/SessionList/useSessionListKeyboard.ts | 14 | < 250 |
| web/src/components/SessionList/SessionListHeader.tsx | 48 | < 250 |
| web/src/components/SessionList/SessionListSearch.tsx | 72 | < 250 |
| web/src/components/SessionList/SessionListItem.tsx | 208 | < 250 |
| web/src/components/SessionList/SessionListEmpty.tsx | 53 | < 250 |
| web/src/components/SessionList/SessionListIcons.tsx | 91 | < 250 |

All within budget.

## Verification

- `bun typecheck` exits 0 (cli + web + hub).
- `bun run test:web` exits 0 — 604 tests pass across 73 files.
- `bun run test:web -- message-window`: 15 existing facade tests pass unmodified.
- `bun run test:web -- messageWindow`: 24 new sub-module tests pass.
- `bun run test:web -- SessionList`: 25 tests pass (12 helper + 2 directory-action + 11 sub-component tests).
- Single-Map ownership grep: `grep -l "const states = new Map" web/src/lib/messageWindow*.ts` → only `messageWindowState.ts`. Same for `const listeners = new Map`.
- No `index.ts` barrel under `web/src/components/SessionList/`.
- External imports unchanged: `from '@/components/SessionList'` and `from '@/lib/message-window-store'` callers required zero edits.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] SessionList default-export grep is a planner typo; preserved the actual named-export surface**
- **Found during:** Task 2.3
- **Issue:** The plan's acceptance criterion `grep -c "^export default" SessionList.tsx == 1` could never pass — the pre-refactor file uses `export function SessionList` (named), and the only external caller (`web/src/router.tsx`) imports it as `import { SessionList } from '@/components/SessionList'`. Adding a default export would have either broken the caller (T-09-05) or introduced a dual export.
- **Fix:** Kept the named export verbatim. The higher-level T-09-05 mitigation ("external callers require zero import changes") is satisfied by zero caller diffs; the literal grep clause is superseded as a planner typo.
- **Files modified:** web/src/components/SessionList.tsx
- **Commit:** c1d90df

**2. [Rule 3 - Structural support] Added `SessionList/SessionListIcons.tsx` to hit the orchestrator < 250 line budget**
- **Found during:** Task 2.3
- **Issue:** With only the 4 plan-listed sub-components extracted, the orchestrator still hosted ~80 lines of inline SVG icons (CopyPathButton, MachineIcon, ChevronIcon, PlusIconSmall) used by the machine-group tree rendering, leaving SessionList.tsx at 314 lines — over the < 250 budget.
- **Fix:** Lifted those four icon helpers into one focused file (`SessionList/SessionListIcons.tsx`, 91 lines). Not a barrel; same flat-sibling layout as the 4 hooks + 4 sub-components.
- **Files modified:** web/src/components/SessionList.tsx, web/src/components/SessionList/SessionListIcons.tsx
- **Commit:** c1d90df

No architectural deviations (Rule 4) triggered. No package installs.

## Self-Check: PASSED

- All 11 created files (5 sub-modules + 5 sub-module tests + 1 facade rewrite) for message-window verified present and tested.
- All 14 created files (4 hooks + 4 sub-components + 1 icons support file + 4 sub-component tests + 1 orchestrator rewrite) for SessionList verified present and tested.
- Commit hashes 2217305 / f3a2c67 / c1d90df / 51af925 all present in `git log`.
- Full test suite green (604/604).
