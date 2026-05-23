---
phase: 03-cut-multi-user-namespace-isolation
plan: 06
subsystem: database
tags: [sqlite, store, migration, namespace-cut, bun-test]

requires:
  - phase: 03-cut-multi-user-namespace-isolation
    provides: namespace-free public Session/SyncEvent/socket contracts from Plan 03-05
provides:
  - Runtime SQLite schema version 10 without namespace columns, namespace indexes, or users table
  - Namespace-free session, machine, push, and versioned update store SQL helpers
  - Offline v9-to-v10 namespace isolation migration with synthetic fixture coverage
affects: [03-07-namespace-guard, phase-10-config-cleanup]

tech-stack:
  added: []
  patterns: [runtime-schema-version-rejection, offline-bun-sqlite-migration, endpoint-only-push-uniqueness]

key-files:
  created:
    - hub/scripts/migrate-namespace-isolation.ts
    - hub/scripts/migrate-namespace-isolation.test.ts
    - .planning/phases/03-cut-multi-user-namespace-isolation/03-06-SUMMARY.md
  modified:
    - hub/src/store/index.ts
    - hub/src/store/types.ts
    - hub/src/store/sessions.ts
    - hub/src/store/sessionStore.ts
    - hub/src/store/machines.ts
    - hub/src/store/machineStore.ts
    - hub/src/store/pushSubscriptions.ts
    - hub/src/store/pushStore.ts
    - hub/src/store/versionedUpdates.ts
    - hub/src/store/namespace.test.ts

key-decisions:
  - "Runtime Store now accepts only schema version 10; old namespace-shaped v9 databases must be handled by the offline script."
  - "The users table and UserStore remain deleted because owner identity is supplied by config/JWT code, not store-side platform binding."
  - "Push subscriptions are collapsed deterministically by endpoint during migration, keeping the newest created row for duplicate endpoints."

patterns-established:
  - "Runtime schema creation contains only namespace-free tables and rejects version mismatches instead of running compatibility migrations."
  - "Store helpers and wrappers expose id/tag/endpoint-only SQL paths with no namespace overloads or access-denied-by-scope branches."
  - "Offline migration scripts live under hub/scripts and are not imported or invoked by hub/src runtime store code."

requirements-completed: [CUT-09]

duration: 2min
completed: 2026-05-21
---

# Phase 03 Plan 06: Runtime Store Namespace Cut Summary

**SQLite runtime storage now runs on schema v10 with namespace-free store tables plus a tested offline v9-to-v10 migration path.**

## Performance

- **Duration:** 2min verification/finalization in this executor; task commits were already present on `HEAD`.
- **Started:** 2026-05-21T04:44:10Z
- **Completed:** 2026-05-21T04:46:00Z
- **Tasks:** 3
- **Files modified:** 12

## Accomplishments

- Bumped runtime schema to `SCHEMA_VERSION = 10` with required tables limited to `sessions`, `machines`, `messages`, and `push_subscriptions`.
- Removed physical namespace columns/indexes, the `users` table, and `UserStore` runtime composition.
- Collapsed store SQL helpers and wrappers to namespace-free signatures and id/tag/endpoint-only predicates.
- Added `hub/scripts/migrate-namespace-isolation.ts`, which requires an explicit DB path, transactionally rebuilds v9 namespace-shaped data into v10 tables, drops `users`, dedupes push rows by endpoint, and sets `PRAGMA user_version = 10`.

## Task Commits

TDD gates and implementation commits already existed on `HEAD` when this executor loaded the plan:

1. **Task 03-06-01 RED: Specify namespace-free runtime schema** - `48ea1e6` (test)
2. **Tasks 03-06-01/03-06-02 GREEN: Remove runtime namespace store state** - `b115ec4` (feat)
3. **Task 03-06-03 RED: Specify namespace isolation migration** - `b3965ae` (test)
4. **Task 03-06-03 GREEN: Add namespace isolation migration** - `ce4db66` (feat)

_Note: Task 03-06-02 was included in the runtime store-state implementation commit because the schema and final store helper signatures had to remain green together under D-47._

## Files Created/Modified

- `hub/src/store/index.ts` - schema v10 runtime DDL, required-table validation, and no runtime migration ladder for namespace removal.
- `hub/src/store/types.ts` - namespace-free store row types.
- `hub/src/store/sessions.ts` and `hub/src/store/sessionStore.ts` - session create/update/list/delete helpers without namespace parameters or predicates.
- `hub/src/store/machines.ts` and `hub/src/store/machineStore.ts` - machine create/update/list helpers without namespace parameters or predicates.
- `hub/src/store/pushSubscriptions.ts` and `hub/src/store/pushStore.ts` - endpoint-only push upsert/list/delete helpers using `UNIQUE(endpoint)`.
- `hub/src/store/versionedUpdates.ts` - optimistic updates now filter by id and expected version only.
- `hub/src/store/namespace.test.ts` - runtime schema and store facade coverage for namespace-free behavior.
- `hub/scripts/migrate-namespace-isolation.ts` - explicit-path offline migration from v9 namespace-shaped tables to v10 runtime tables.
- `hub/scripts/migrate-namespace-isolation.test.ts` - synthetic v9 fixture migration coverage.

## Decisions Made

- Kept the migration outside `hub/src` so the runtime store does not import, shell out to, or invoke the offline migration.
- Preserved messages exactly and rebuilt affected tables in a transaction with foreign keys disabled during the table swap.
- Deduped duplicate push endpoints by newest `created_at`, then highest `id`, producing two migrated push rows from the fixture's three v9 rows.

## Deviations from Plan

### Auto-fixed Issues

None - plan behavior was already implemented in the task commits and verified as written.

---

**Total deviations:** 0 auto-fixed.
**Impact on plan:** Runtime storage, helper APIs, and offline migration match the plan's expected namespace-free contract.

## TDD Gate Compliance

- RED commits exist for runtime schema and migration behavior: `48ea1e6`, `b3965ae`.
- GREEN commits exist after their RED gates: `b115ec4`, `ce4db66`.
- No separate refactor commit was needed.

## Verification

- Targeted store/schema gate: `bun test hub/src/store/*.test.ts` - exit 0, 18 pass.
- Runtime deletion gate: `test ! -e hub/src/store/users.ts && test ! -e hub/src/store/userStore.ts` - exit 0.
- Focused runtime schema scan: no matches for `users|UserStore|StoredUser|UNIQUE(namespace|idx_.*namespace|namespace TEXT` in `hub/src/store/index.ts` and `hub/src/store/types.ts`.
- Focused store helper scan: no matches for `namespace|ByNamespace|access-denied` in session, machine, push, and versioned update store helper files.
- Targeted migration gate: `bun test hub/scripts/migrate-namespace-isolation.test.ts hub/src/store/*.test.ts` - exit 0, 20 pass.
- Runtime non-invocation gate: no matches for `migrate-namespace-isolation|namespace.*migration` in `hub/src/store/index.ts`.
- Full D-47 gate: `bun typecheck && bun run test` - exit 0.

## Migration Fixture Shape

- Source fixture uses v9 `sessions`, `machines`, `messages`, `users`, and `push_subscriptions` tables with namespace columns/indexes and `UNIQUE(namespace, endpoint)`.
- Migrated row counts: `sessions=2`, `machines=1`, `messages=2`, `pushSubscriptions=2`.
- Duplicate push endpoint rows collapse to the newest row for `endpoint-1`, while `endpoint-2` is preserved.
- Destination tables are `machines`, `messages`, `push_subscriptions`, and `sessions`; `users` is dropped and `PRAGMA user_version` is `10`.

## Known Stubs

None. Stub-pattern scan found no UI-visible placeholders or data-source stubs in the files created or modified for this plan.

## Threat Flags

None. The offline migration file-access trust boundary is explicitly covered by the plan threat model and requires an explicit DB path; no additional network endpoint, auth path, dependency, or runtime schema trust boundary was introduced beyond the planned work.

## Issues Encountered

- `Store` impact analysis reported HIGH risk because direct importers include the hub startup path, sync layer, push service, socket handlers, and store tests. This was the expected blast radius for the planned physical schema cut.
- Shell `rg` is still missing from PATH, so focused source scans used Cursor's bundled ripgrep binary. `scripts/check-no-cut-agents.sh` still prints `rg: command not found` while exiting 0; Plan 03-07 owns the final namespace guard.
- Existing unrelated working-tree changes remain: `AGENTS.md`, `.claude/`, and `CLAUDE.md`. They were not staged or modified by this plan.

## User Setup Required

None - no external service configuration required. Existing v9 namespace-shaped databases must be backed up and migrated manually with the offline script before running this v10 runtime.

## Next Phase Readiness

Plan 03-07 can now enforce the final `namespace|:ns` source guard across `cli/src`, `hub/src`, `web/src`, and `shared/src`, with the migration fixture intentionally isolated under `hub/scripts`.

## Self-Check: PASSED

- Found summary file: `.planning/phases/03-cut-multi-user-namespace-isolation/03-06-SUMMARY.md`
- Found commit: `48ea1e6`
- Found commit: `b115ec4`
- Found commit: `b3965ae`
- Found commit: `ce4db66`

---
*Phase: 03-cut-multi-user-namespace-isolation*
*Completed: 2026-05-21*
