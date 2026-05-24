---
phase: 01-cursor-runtime-config-contract
plan: 13
subsystem: session-status
tags: [sqlite, session-summary, hub-sync, sse, durable-state]

requires:
  - phase: 01-cursor-runtime-config-contract
    provides: Live idle and completion marker patches from 01-10
  - phase: 01-cursor-runtime-config-contract
    provides: Unsupported effort filtering from 01-12, 01-14, and 01-15
provides:
  - Durable per-session turn completion marker stored in SQLite
  - Authoritative session summaries that preserve completed status after refetch/reload
  - Liveness persistence and clearing rules for completion markers
affects: [session-list, hub-store, hub-sync, shared-protocol, web-sse-cache]

tech-stack:
  added: []
  patterns:
    - Durable runtime status truth lives in Hub, while read/viewed state stays local to Web.
    - Ready-turn completion markers are persisted before completed patches are emitted.

key-files:
  created:
    - .planning/phases/01-cursor-runtime-config-contract/01-13-SUMMARY.md
  modified:
    - hub/src/store/index.ts
    - hub/src/store/types.ts
    - hub/src/store/sessions.ts
    - hub/src/store/sessionStore.ts
    - hub/src/sync/sessionRepository.ts
    - hub/src/sync/sessionLivenessService.ts
    - shared/src/schemas.ts
    - shared/src/sessionSummary.ts
    - web/src/hooks/useSSE.test.tsx

key-decisions:
  - "Persist only the runtime completion marker in Hub; keep viewed/read completion state local to Web."
  - "Use schema version 11 and the existing fail-fast mismatch policy instead of adding runtime migrations."
  - "Clear the durable marker only when new queued work starts, not on idle keepalive patches."

patterns-established:
  - "Session.turnCompletionMarker is the durable source for completed unread status after authoritative summary rebuilds."
  - "SessionLivenessService writes marker state before emitting status patches so Hub store and SSE cache converge."

requirements-completed: [CURS-04]

duration: 5min
completed: 2026-05-24
---

# Phase 01 Plan 13: Durable Completion Marker Summary

**SQLite-backed turn completion markers keep completed session-list status durable across refetch, reload, and reconnect**

## Performance

- **Duration:** 5 min
- **Started:** 2026-05-24T02:11:19Z
- **Completed:** 2026-05-24T02:16:44Z
- **Tasks:** 2
- **Files modified:** 18

## Accomplishments

- Added `turn_completion_marker` to the sessions table with schema version 11, store mapping, setter/clearer helpers, and explicit shared `Session.turnCompletionMarker` parsing.
- Updated `toSessionSummary()` so thinking, waiting, and background work supersede stale markers, then durable completion markers produce completed summaries after `/api/sessions` style refetches.
- Persisted ready-turn completion markers from `SessionLivenessService.recordSessionActivity()` and cleared them from `markMessageQueued()` when new work starts, while keepalive-only updates preserve them.
- Covered the behavior in shared schema/summary tests, Hub store/liveness/session-model tests, and existing Web SSE regression tests for keepalive preservation and thinking-patch clearing.

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: Durable marker contract tests** - `9838f43` (test)
2. **Task 1 GREEN: Store/schema/summary marker plumbing** - `1575a68` (feat)
3. **Task 2 RED: Liveness persistence tests** - `a0dd286` (test)
4. **Task 2 GREEN: Liveness marker persistence and clearing** - `748efa5` (feat)

_Note: Both planned tasks used TDD test and implementation commits._

## Files Created/Modified

- `hub/src/store/index.ts` - Bumps SQLite schema to 11 and adds the nullable `turn_completion_marker` column.
- `hub/src/store/types.ts`, `hub/src/store/sessions.ts`, `hub/src/store/sessionStore.ts` - Thread the durable marker through stored session rows and expose set/clear helpers.
- `hub/src/sync/sessionRepository.ts` - Copies the durable marker into in-memory `Session` objects during refresh/reload.
- `hub/src/sync/sessionLivenessService.ts` - Persists ready-turn completion markers, clears them on queued work, and preserves them across keepalive.
- `shared/src/schemas.ts`, `shared/src/sessionSummary.ts` - Add the shared marker field and derive authoritative completed summaries from it.
- `shared/src/sessionSummary.test.ts`, `shared/src/schemas.test.ts`, `hub/src/store/index.test.ts`, `hub/src/store/namespace.test.ts`, `hub/src/sync/sessionLivenessService.test.ts`, `hub/src/sync/sessionModel.test.ts`, `web/src/hooks/useSSE.test.tsx` - Regression coverage for durable completion marker behavior and type fixtures.
- `cli/src/api/api.ts`, `cli/src/api/api.extraHeaders.test.ts`, `cli/src/agent/sessionFactory.test.ts` - Type plumbing for the expanded shared session contract.

## Decisions Made

- Kept Hub persistence limited to the runtime completion marker. Web still owns viewed/read state keyed by session id plus marker.
- Chose a schema version bump without runtime migration logic, matching the repo's no-backward-compatibility SQLite policy.
- Kept Web SSE production code unchanged because existing strict patch tests already cover marker preservation across keepalive and clearing on thinking patches.

## GitNexus Impact

- Task 1 prechecks: `SCHEMA_VERSION`, `createSchema`, `toStoredSession`, `getOrCreateSession`, `SessionSchema`, and `toSessionSummary` were LOW risk. Broad `SessionStore` class impact was CRITICAL because it is central; the change was additive and covered by store/session tests and typecheck.
- Task 2 prechecks: `SessionRepository.refreshSession` was CRITICAL because it feeds cache, route, resume, and notification flows; `recordSessionActivity` and `markMessageQueued` were LOW. Verification targeted refresh/liveness/session model paths directly.
- Pre-commit `detect_changes` for Task 1 GREEN reported CRITICAL due schema and refresh-session flows; Task 2 GREEN reported MEDIUM. Both were covered by targeted tests, typecheck, madge, guard, and broad `bun run test`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Updated schema-version fixture after schema bump**
- **Found during:** Task 1 verification
- **Issue:** `hub/src/store/namespace.test.ts` still asserted schema version 10 after the planned bump to 11.
- **Fix:** Updated the test name and assertion to version 11.
- **Files modified:** `hub/src/store/namespace.test.ts`
- **Verification:** `cd hub && bun test src/store src/sync/sessionModel.test.ts`; `bun run typecheck`
- **Committed in:** `1575a68`

**2. [Rule 3 - Blocking] Threaded the required shared marker field through CLI/Web fixtures and API mapping**
- **Found during:** Task 1 typecheck
- **Issue:** Making parsed `Session.turnCompletionMarker` explicit surfaced missing fields in CLI/Web session fixtures and CLI API session mapping.
- **Fix:** Added the marker field to the CLI API mapper and affected test fixtures.
- **Files modified:** `cli/src/api/api.ts`, `cli/src/api/api.extraHeaders.test.ts`, `cli/src/agent/sessionFactory.test.ts`, `web/src/hooks/useSSE.test.tsx`
- **Verification:** `bun run typecheck`
- **Committed in:** `1575a68`

**3. [Rule 3 - Blocking] Narrowed session-updated patch test before reading marker field**
- **Found during:** Task 2 typecheck
- **Issue:** A new liveness test read `completionMarker` from the `session-updated` union without first narrowing to patch data.
- **Fix:** Added an `'completionMarker' in update.data` guard before the assertion.
- **Files modified:** `hub/src/sync/sessionLivenessService.test.ts`
- **Verification:** `bun run typecheck`
- **Committed in:** `748efa5`

---

**Total deviations:** 3 auto-fixed (3 blocking/type-safety issues)
**Impact on plan:** All fixes were required to keep the planned shared/session contract compile-safe. No package installs, new endpoints, auth changes, malformed-event refetch fallback, or Web read-state persistence were introduced.

## Issues Encountered

None. Targeted checks, repository guards, and broad `bun run test` all passed.

## Known Stubs

None. No placeholders, TODO/FIXME stubs, mock-only UI data flow, or hardcoded empty UI state were introduced by this plan.

## Threat Flags

None. The plan touched the expected SQLite/session status trust boundary from the threat model and did not add new network endpoints, auth paths, file access patterns, or package installs.

## TDD Gate Compliance

- RED commits present before implementation: `9838f43`, `a0dd286`
- GREEN commits present after RED: `1575a68`, `748efa5`
- No separate refactor commit was needed.

## Verification

- `cd shared && bun test sessionSummary.test.ts schemas.test.ts` - passed, 47 tests.
- `cd hub && bun test src/store src/sync/sessionModel.test.ts` - passed, 52 tests.
- `cd hub && bun test src/sync/sessionLivenessService.test.ts src/sync/sessionModel.test.ts` - passed, 42 tests.
- `cd web && bun run test -- useSSE SessionListItem` - passed, 25 tests.
- `bun run typecheck` - passed across CLI, Web, and Hub.
- `bun run madge:check` - passed with no circular dependencies.
- `bash scripts/check-no-cut-agents.sh` - passed.
- `bun run test` - passed.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Phase 1 gap closure is complete for durable completed/unread session-list status. A completed ready turn now survives authoritative refetch/reload/reconnect, new queued work clears the durable marker, and idle keepalives preserve it.

## Self-Check: PASSED

- Found `.planning/phases/01-cursor-runtime-config-contract/01-13-SUMMARY.md`.
- Found all 18 source and test files listed above.
- Found task commits `9838f43`, `1575a68`, `a0dd286`, and `748efa5`.
- Relevant targeted checks, typecheck, madge, guard, and broad `bun run test` passed.

---

*Phase: 01-cursor-runtime-config-contract*
*Completed: 2026-05-24*
