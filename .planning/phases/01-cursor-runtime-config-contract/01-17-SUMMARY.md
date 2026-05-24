---
phase: 01-cursor-runtime-config-contract
plan: 17
subsystem: sync
tags: [session-liveness, turn-completed, curs-04, queued-thinking, bun:test]

requires:
  - phase: 01-cursor-runtime-config-contract
    provides: "01-13 durable completion marker; 01-08 markMessageQueued clears marker for new work"
provides:
  - "isStaleCompletion guard in recordSessionActivity turn-completed branch"
  - "Regression test locking late turn-completed after markMessageQueued (CURS-04 / truth #4)"
affects:
  - "01-VERIFICATION truth #4"
  - "session list SSE status convergence (CURS-04)"

tech-stack:
  added: []
  patterns:
    - "Demote stale runner activity when pendingThinkingUntilBySessionId grace window is active"

key-files:
  created: []
  modified:
    - hub/src/sync/sessionLivenessService.ts
    - hub/src/sync/sessionLivenessService.test.ts

key-decisions:
  - "Stale turn-completed uses message-equivalent path (touchSessionUpdatedAt only) when thinking && pendingThinkingUntil > Date.now()"
  - "No turn/message sequence correlation in this plan; deferred to future hardening"

patterns-established:
  - "Queued-thinking grace window blocks completion marker re-persistence from delayed ready events"

requirements-completed: [CURS-04]

duration: 8min
completed: 2026-05-24
---

# Phase 01 Plan 17: Late turn-completed stale-completion guard Summary

**`recordSessionActivity` demotes delayed `turn-completed` inside the 15s queued-thinking grace window so new work cannot flip back to completed**

## Performance

- **Duration:** 8 min
- **Started:** 2026-05-24T02:43:00Z
- **Completed:** 2026-05-24T02:51:48Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Closed CURS-04 / 01-REVIEW CR-01 gap: late ready after `markMessageQueued()` no longer re-persists `turnCompletionMarker` or emits `statusKind: 'completed'`
- Preserved `pendingThinkingUntilBySessionId` and `thinking=true` while grace window is active
- Stale activity may still touch `updatedAt` via `touchSessionUpdatedAt` (no SSE message-loss regression)

## Task Commits

1. **Task 1: Write failing regression test** - `39d8460` (test)
2. **Task 2: Demote stale turn-completed** - `bdae15f` (feat)

**Plan metadata:** pending (docs commit follows)

## Files Created/Modified

- `hub/src/sync/sessionLivenessService.ts` - `isStaleCompletion` guard on `turn-completed` branch
- `hub/src/sync/sessionLivenessService.test.ts` - CURS-04 / truth #4 regression test

## Decisions Made

- Followed plan: guard uses in-memory `thinking` + `pendingThinkingUntilBySessionId > Date.now()`; no new schema or RPC surface
- Deferred sequence-id correlation for stale activity (plan `deferred:` frontmatter)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 01-VERIFICATION truth #4 unblocked for verifier re-run
- Future hardening: correlate ready/turn-completed to turn or message sequence id (tracked in plan frontmatter `deferred:`)

## Self-Check: PASSED

- FOUND: hub/src/sync/sessionLivenessService.ts
- FOUND: hub/src/sync/sessionLivenessService.test.ts
- FOUND: 39d8460
- FOUND: bdae15f

---
*Phase: 01-cursor-runtime-config-contract*
*Completed: 2026-05-24*
