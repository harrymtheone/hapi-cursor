---
phase: 07-wire-contracts-unification-sse-patch-contract
plan: 02
subsystem: hub-sync-wire-contract
tags: [hub, sse, broadcast-contract, machine-cache, sync-engine]
requires:
  - phase: 07-wire-contracts-unification-sse-patch-contract
    provides: shared SyncEventSchema, SessionPatchSchema, MachinePatchSchema, MachineMetadataSchema from 07-01
provides:
  - Runtime contract test proving representative SessionCache and MachineCache emits conform to SyncEventSchema
  - MachineCache metadata decode routed through shared MachineMetadataSchema with stale-row fallbacks preserved
  - Dev/test EventPublisher.emit schema drift self-check that logs without blocking delivery
affects: [hub-sync, sse-contract, phase-07]
tech-stack:
  added: []
  patterns:
    - mock-publisher capture for hub emit-contract tests
    - shared-schema defensive decode at hub read boundary
    - non-blocking dev/test schema self-check before broadcast
key-files:
  created:
    - hub/src/sync/sessionCache.test.ts
  modified:
    - hub/src/sync/machineCache.ts
    - hub/src/sync/eventPublisher.ts
    - hub/src/sync/sessionCache.test.ts
key-decisions:
  - "EventPublisher.emit self-check is observability-only: non-production safeParse logs violations but still notifies listeners and broadcasts."
  - "MachineCache preserves defensive stale-row fallback at the read site before using shared MachineMetadataSchema, keeping shared as the only schema source."
patterns-established:
  - "Hub emit contract tests capture EventPublisher.emit payloads and validate them with SyncEventSchema.safeParse."
requirements-completed: [REFA-03, REFA-04]
duration: 3min 26s
completed: 2026-05-22
---

# Phase 7 Plan 2: Hub Broadcast Contract Summary

Runtime hub broadcast contract proof now covers SessionCache and MachineCache emits, with MachineCache fully collapsed onto shared MachineMetadataSchema and EventPublisher carrying a non-blocking dev/test schema-drift self-check.

## Performance

- **Duration:** 3min 26s
- **Started:** 2026-05-22T14:04:53Z
- **Completed:** 2026-05-22T14:08:19Z
- **Tasks:** 4 completed
- **Files modified:** 3

## Accomplishments

- Added `hub/src/sync/sessionCache.test.ts`, covering representative `SessionCache` and `MachineCache` transitions and asserting every captured `publisher.emit` payload passes `SyncEventSchema.safeParse`.
- Proved the smoking-gun `backgroundTaskCount` single-field `session-updated` patch is schema-valid at runtime.
- Removed the hub-local `machineMetadataSchema` from `machineCache.ts`; shared `MachineMetadataSchema` is now the only machine metadata schema source.
- Added non-production `EventPublisher.emit` validation that logs schema violations without throwing, returning early, or blocking SSE/listener delivery.

## Task Commits

Each implementation task was committed atomically:

1. **Task 1: Hub broadcast contract test** - `372b55c` (`test`)
2. **Task 2: MachineCache shared metadata schema collapse** - `9d8d248` (`refactor`)
3. **Task 3: EventPublisher dev self-check** - `cf5c006` (`feat`)
4. **Task 4: Slice gate verification** - no code commit; verification-only task, covered by the final metadata commit

## Files Created/Modified

- `hub/src/sync/sessionCache.test.ts` - New emit contract test for SessionCache and MachineCache runtime payloads.
- `hub/src/sync/machineCache.ts` - Replaced local metadata schema with shared `MachineMetadataSchema.safeParse` after defensive fallback massaging.
- `hub/src/sync/eventPublisher.ts` - Added dev/test `SyncEventSchema.safeParse` self-check before existing listener and SSE delivery.

## Verification

- `cd hub && bun test src/sync/sessionCache.test.ts` passed: 6 tests, 34 assertions before the Task 2 type-narrowing cleanup; 6 tests, 33 assertions after.
- `cd hub && bun typecheck && bun test src/sync/sessionCache.test.ts` passed after Task 2.
- `cd hub && bun typecheck && bun test src/sync` passed: 80 sync tests.
- `bun typecheck && bun run test` passed at workspace root:
  - CLI: 237 passed, 12 skipped
  - Hub: 155 passed, including 6 new `sessionCache.test.ts` contract tests
  - Web: 532 passed
  - Guard: `scripts/check-no-cut-agents.sh` exited 0
- The full gate produced no `[eventPublisher] emit violates SyncEventSchema` logs.

## Test Count Delta

07-01's summary recorded a 532-test baseline. The current root test command reports package-level counts: 237 CLI passed, 155 Hub passed, and 532 Web passed, for 924 passed tests plus 12 skipped CLI integration tests. The new contract file contributes 6 passing Hub tests.

## Decisions Made

- Kept the EventPublisher self-check non-blocking because `EventPublisher.emit` has CRITICAL blast radius: 18 direct callers and 5 sync/notification processes depend on delivery behavior.
- Preserved MachineCache's existing `'unknown'` fallback for missing required machine metadata fields, but moved validation to the shared schema so REFA-03 remains single-source.
- Used a private SQLite delete in the test fixture only to simulate a cached machine whose backing row disappears, which is required to exercise the existing `data: null` emit branch.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Test Bug] Fixed machine transition fixtures in the new contract test**
- **Found during:** Task 1 (Hub broadcast contract test)
- **Issue:** The first draft did not actually drive the `machine-updated` inactive patch or cached-row-missing `data: null` transitions, causing the intended red run to fail for fixture reasons.
- **Fix:** Added a Store-backed MachineCache fixture and a targeted SQLite row delete helper so `refreshMachine` exercises the cached-row-missing branch; adjusted timestamps so `expireInactive` emits `{ active: false }`.
- **Files modified:** `hub/src/sync/sessionCache.test.ts`
- **Verification:** `cd hub && bun test src/sync/sessionCache.test.ts`
- **Committed in:** `372b55c`

**2. [Rule 3 - Blocking] Tightened full-session test narrowing for hub typecheck**
- **Found during:** Task 2 (MachineCache shared metadata schema collapse)
- **Issue:** `bun typecheck` rejected the Task 1 `applySessionConfig` assertion because `session-updated.data` is `Session | SessionPatch` and an `expect()` call did not narrow the union.
- **Fix:** Replaced the expectation-only check with a runtime guard that throws unless `metadata in update.data`, giving TypeScript the full `Session` branch.
- **Files modified:** `hub/src/sync/sessionCache.test.ts`
- **Verification:** `cd hub && bun typecheck && bun test src/sync/sessionCache.test.ts`
- **Committed in:** `9d8d248`

---

**Total deviations:** 2 auto-fixed (1 test bug, 1 blocking typecheck fix)  
**Impact on plan:** Both fixes were confined to the new contract test and strengthened the intended verification. No production scope expanded.

## Issues Encountered

None. Full slice verification passed.

## Known Stubs

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Plan 07-03 can proceed with the hub contract now proven at runtime. Remaining Phase 7 work is the cli/web duplicate cleanup and `useSSE` strict-schema consumer rewrite.

## Self-Check: PASSED

- FOUND: `hub/src/sync/sessionCache.test.ts`
- FOUND: `hub/src/sync/machineCache.ts`
- FOUND: `hub/src/sync/eventPublisher.ts`
- FOUND: task commit `372b55c`
- FOUND: task commit `9d8d248`
- FOUND: task commit `cf5c006`
- VERIFIED: `bun typecheck && bun run test` exits 0

---
*Phase: 07-wire-contracts-unification-sse-patch-contract*  
*Completed: 2026-05-22*
