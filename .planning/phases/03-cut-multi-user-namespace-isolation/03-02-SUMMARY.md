---
phase: 03-cut-multi-user-namespace-isolation
plan: 02
subsystem: store-sync
tags: [sqlite, store-facade, sync-engine, namespace-cut, bun-test]

requires:
  - phase: 03-cut-multi-user-namespace-isolation
    provides: opaque CLI token parser and bearer auth from Plan 03-01
provides:
  - Namespace-free session and machine store create/versioned-update facades
  - Namespace-free push subscription upsert/list/delete facade
  - Owner-only SessionCache, MachineCache, and SyncEngine create/access facades
affects: [03-03-web-auth-routes, 03-04-socket-contract, 03-06-schema-cleanup]

tech-stack:
  added: []
  patterns: [typescript-overload-transition, owner-only-store-facade, owner-only-sync-access]

key-files:
  created:
    - .planning/phases/03-cut-multi-user-namespace-isolation/03-02-SUMMARY.md
  modified:
    - hub/src/store/sessions.ts
    - hub/src/store/sessionStore.ts
    - hub/src/store/machines.ts
    - hub/src/store/machineStore.ts
    - hub/src/store/pushSubscriptions.ts
    - hub/src/store/pushStore.ts
    - hub/src/store/versionedUpdates.ts
    - hub/src/store/namespace.test.ts
    - hub/src/sync/sessionCache.ts
    - hub/src/sync/machineCache.ts
    - hub/src/sync/syncEngine.ts
    - hub/src/sync/aliveEvents.test.ts

key-decisions:
  - "Expose owner-only facades as overloads on the existing store/cache/SyncEngine method names so later plans can migrate callsites without a parallel abstraction."
  - "Keep namespace-aware overloads temporarily for unmigrated route/socket/SSE consumers until Plans 03-03 through 03-06 delete them."
  - "Use the existing push_subscriptions physical namespace column only as a temporary storage detail for owner-only upserts; endpoint uniqueness remains physically unchanged until Plan 03-06."

patterns-established:
  - "Owner-only facade overloads: omit namespace arguments, delegate to id/tag/version SQL paths, and preserve legacy namespace overloads for current callers."
  - "Owner-only access resolution: `resolveSessionAccess(sessionId)` returns only ok/not-found semantics; namespace mismatch remains only on the legacy overload."

requirements-completed: [CUT-09]

duration: 6min 24s
completed: 2026-05-21
---

# Phase 03 Plan 02: Namespace-Free Store/Cache Facades Summary

**Owner-only store, cache, and SyncEngine facades now exist for sessions, machines, push subscriptions, and access resolution while old namespace internals remain temporarily for unmigrated consumers.**

## Performance

- **Duration:** 6min 24s
- **Started:** 2026-05-21T04:02:32Z
- **Completed:** 2026-05-21T04:08:36Z
- **Tasks:** 3
- **Files modified:** 12

## Accomplishments

- Added namespace-free overloads for `getOrCreateSession`, `updateSessionMetadata`, `updateSessionAgentState`, `getOrCreateMachine`, `updateMachineMetadata`, and `updateMachineRunnerState`.
- Added push facade methods `upsertPushSubscription(subscription)`, `getPushSubscriptions()`, and `removePushSubscription(endpoint)`.
- Added owner-only `SessionCache.resolveSessionAccess(sessionId)` and matching `SyncEngine.resolveSessionAccess(sessionId)` semantics with only `not-found` failure.
- Preserved old namespace-bearing methods such as `getSessionsByNamespace`, `getMachineByNamespace`, `getPushSubscriptionsByNamespace`, and namespace-aware overloads for later migration plans.

## Task Commits

Each TDD task was committed atomically:

1. **Task 03-02-01 RED: Specify owner-only store facades** - `4d6825d` (test)
2. **Task 03-02-01 GREEN: Add owner-only session and machine store facades** - `2923b99` (feat)
3. **Task 03-02-02 RED: Specify owner-only push store facade** - `3243cc7` (test)
4. **Task 03-02-02 GREEN: Add owner-only push store facade** - `261c70a` (feat)
5. **Task 03-02-03 RED: Specify owner-only sync facades** - `8553065` (test)
6. **Task 03-02-03 GREEN: Add owner-only sync facades** - `67132aa` (feat)

## Files Created/Modified

- `hub/src/store/sessions.ts` - owner-only session create/versioned update SQL paths.
- `hub/src/store/sessionStore.ts` - overload facade for namespace-free and legacy session methods.
- `hub/src/store/machines.ts` - owner-only machine create/versioned update SQL paths.
- `hub/src/store/machineStore.ts` - overload facade for namespace-free and legacy machine methods.
- `hub/src/store/versionedUpdates.ts` - id/version-only optimistic update path.
- `hub/src/store/pushSubscriptions.ts` - owner-only push upsert/list/delete helpers.
- `hub/src/store/pushStore.ts` - namespace-free push facade methods.
- `hub/src/store/namespace.test.ts` - TDD coverage for owner-only store and push facades.
- `hub/src/sync/sessionCache.ts` - owner-only session create and access overloads.
- `hub/src/sync/machineCache.ts` - owner-only machine create overload.
- `hub/src/sync/syncEngine.ts` - owner-only SyncEngine create and access overloads.
- `hub/src/sync/aliveEvents.test.ts` - TDD coverage for owner-only cache and SyncEngine APIs.

## Decisions Made

- Used overloads instead of new parallel method names so later plans can migrate callsites directly to the future final names.
- Left physical namespace columns, namespace-aware store methods, and namespace-aware cache/SyncEngine methods in place because Plan 03-06 owns schema deletion and Plans 03-03/03-04 own route/socket callsite migration.
- Kept owner-only access resolution free of namespace mismatch semantics; `access-denied` remains only on legacy namespace overloads.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added TypeScript overload compatibility for transitional old and new APIs**
- **Found during:** Task 03-02-01 verification
- **Issue:** Adding namespace-free methods on existing method names caused TypeScript to choose owner-only signatures for old namespace-bearing callsites.
- **Fix:** Added explicit overloads in store wrappers, SQL helpers, caches, and SyncEngine so old namespace callsites and new owner-only callsites both typecheck.
- **Files modified:** `hub/src/store/sessionStore.ts`, `hub/src/store/machineStore.ts`, `hub/src/store/sessions.ts`, `hub/src/store/machines.ts`, `hub/src/sync/sessionCache.ts`, `hub/src/sync/machineCache.ts`, `hub/src/sync/syncEngine.ts`
- **Verification:** `bun typecheck && bun run test`
- **Committed in:** `2923b99`, `67132aa`

**2. [Rule 3 - Blocking] Bridged owner-only push upsert onto the current physical schema**
- **Found during:** Task 03-02-02 implementation
- **Issue:** `push_subscriptions.namespace` is still `NOT NULL` and has no default, but schema deletion and endpoint-only uniqueness are explicitly deferred to Plan 03-06.
- **Fix:** Added the owner-only facade without changing physical uniqueness. The helper writes a deterministic endpoint-derived value into the existing namespace column as a temporary storage detail and deletes/lists by endpoint/all rows for the new facade.
- **Files modified:** `hub/src/store/pushSubscriptions.ts`, `hub/src/store/pushStore.ts`
- **Verification:** `bun test hub/src/store/*.test.ts && bun typecheck && bun run test`
- **Committed in:** `261c70a`

---

**Total deviations:** 2 auto-fixed (1 missing critical compatibility issue, 1 blocking physical-schema bridge)
**Impact on plan:** The plan remains within its scope: no physical namespace columns or endpoint uniqueness constraints were removed, and later plans now have owner-only APIs to migrate onto.

## Verification

- Task 03-02-01: `bun test hub/src/store/*.test.ts` - exit 0; focused store facade `rg` - exit 0; `bun typecheck && bun run test` - exit 0.
- Task 03-02-02: `bun test hub/src/store/*.test.ts` - exit 0; focused push facade `rg` - exit 0; `bun typecheck && bun run test` - exit 0.
- Task 03-02-03: `bun test hub/src/sync/sessionModel.test.ts hub/src/sync/aliveEvents.test.ts` - exit 0; focused sync facade `rg` - exit 0; `bun typecheck && bun run test` - exit 0.
- Final D-47 gate after plan commits: `bun typecheck && bun run test` - exit 0.

## Known Stubs

None. Stub-pattern scan hits were existing null checks, empty test arrays, and optional object defaults, not UI-visible stubs or placeholder data sources.

## Threat Flags

None. This plan adds facade methods over existing store/cache/sync trust boundaries and introduces no new network endpoint, auth path, file access pattern, or schema trust boundary.

## Issues Encountered

- The repository shell still lacks `rg` on `PATH`; focused source checks used Cursor's bundled ripgrep binary. `scripts/check-no-cut-agents.sh` still prints `rg: command not found` while exiting 0, which is pre-existing and remains owned by Plan 03-07.
- Existing unrelated working-tree changes were present during execution: `AGENTS.md`, `.claude/`, and `CLAUDE.md`. They were not staged or modified by this plan.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Plan 03-03 can migrate web auth/routes and realtime event routing onto owner-only `SyncEngine` APIs. Plan 03-04 can migrate Socket.IO and push delivery onto the new owner-only cache/store facades. Plan 03-06 still owns physical namespace column removal and endpoint-only push uniqueness.

## Self-Check: PASSED

- Found summary file: `.planning/phases/03-cut-multi-user-namespace-isolation/03-02-SUMMARY.md`
- Found commit: `4d6825d`
- Found commit: `2923b99`
- Found commit: `3243cc7`
- Found commit: `261c70a`
- Found commit: `8553065`
- Found commit: `67132aa`

---
*Phase: 03-cut-multi-user-namespace-isolation*
*Completed: 2026-05-21*
