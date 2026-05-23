---
phase: 01-cursor-runtime-config-contract
plan: 10
subsystem: session-status
tags: [sse, session-summary, cursor-runtime, hub-sync, react-query]

requires:
  - phase: 01-cursor-runtime-config-contract
    provides: Compact session-list status indicators and strict SSE status marker patches from 01-08
  - phase: 01-cursor-runtime-config-contract
    provides: Live composer runtime switch option wiring from 01-09
provides:
  - Idle active Cursor sessions derive idle/viewed list state instead of spinner state
  - CLI ready events propagate completion markers through Hub session-updated patches
  - Web SSE cache convergence preserves completed markers across idle keepalives and clears them on new work
affects: [session-list, sse-cache, hub-cli-socket, shared-protocol]

tech-stack:
  added: []
  patterns:
    - Turn activity status is derived separately from runner process liveness.
    - Ready-event completion markers flow through strict session-updated patches.

key-files:
  created:
    - hub/src/sync/sessionActivity.test.ts
    - .planning/phases/01-cursor-runtime-config-contract/01-10-SUMMARY.md
  modified:
    - shared/src/sessionSummary.ts
    - shared/src/sessionSummary.test.ts
    - hub/src/sync/sessionActivity.ts
    - hub/src/socket/handlers/cli/sessionHandlers.ts
    - hub/src/sync/sessionLivenessService.ts
    - hub/src/sync/sessionLivenessService.test.ts
    - hub/src/sync/sessionCache.ts
    - hub/src/sync/sessionModel.test.ts
    - hub/src/sync/syncEngine.ts
    - hub/src/sync/syncEngineSession.ts
    - hub/src/socket/handlers/cli/index.ts
    - hub/src/socket/server.ts
    - hub/src/index.ts
    - web/src/hooks/useSSE.ts
    - web/src/hooks/useSSE.test.tsx

key-decisions:
  - "Treat active runner liveness as connection state only; real turn work is thinking, waiting, or background-task activity."
  - "Classify existing role-wrapped agent ready events as turn-completed activity instead of adding a new CLI event type."
  - "Keep completed-marker read state local to Web; Hub only emits completionMarker values for runtime truth."

patterns-established:
  - "Session activity callbacks can carry a typed activity classification while default message activity remains the existing updatedAt-only path."
  - "New work status patches clear stale completion and error markers explicitly."

requirements-completed: [CURS-04]

duration: 8min
completed: 2026-05-23
---

# Phase 01 Plan 10: Idle and Completion Status Markers Summary

**Turn-activity status semantics with ready-event completion markers for live Cursor session rows**

## Performance

- **Duration:** 8 min
- **Started:** 2026-05-23T16:53:26Z
- **Completed:** 2026-05-23T17:00:10Z
- **Tasks:** 2
- **Files modified:** 16

## Accomplishments

- Redefined shared session summary status so a connected but idle Cursor session reports `idle`, while thinking, pending requests, background tasks, completed, and error states keep their intended precedence.
- Added Hub ready-event activity classification and completion-marker SSE patches so normal live turn completion can produce the green unread completed session-list indicator without ending the session.
- Updated Web SSE patch convergence so completed and error markers survive keepalive-only patches and clear when a new thinking/running/waiting status starts.

## Task Commits

1. **Task 1 RED: Status activity regression tests** - `ffb864b` (test)
2. **Task 1 GREEN: Turn-activity status derivation** - `f00dff4` (feat)
3. **Task 2 RED: Ready completion marker tests** - `27d8716` (test)
4. **Task 2 GREEN: Ready completion marker propagation** - `dc52af6` (feat)

_Note: Both planned tasks used TDD test and implementation commits._

## Files Created/Modified

- `shared/src/sessionSummary.ts` - Removes runner liveness from busy status derivation.
- `shared/src/sessionSummary.test.ts` - Covers blank active idle sessions and background-work running status.
- `hub/src/sync/sessionActivity.ts` - Adds typed session activity classification for ready turn completion.
- `hub/src/sync/sessionActivity.test.ts` - Covers strict ready-event classification and arbitrary string rejection.
- `hub/src/socket/handlers/cli/sessionHandlers.ts` - Passes classified activity from CLI messages to session activity handling.
- `hub/src/sync/sessionLivenessService.ts` - Emits completion marker patches for ready turns and clears stale markers when new work starts.
- `hub/src/sync/sessionLivenessService.test.ts` - Covers ready completion patches and new-turn marker clearing.
- `hub/src/sync/sessionCache.ts`, `hub/src/sync/syncEngine.ts`, `hub/src/sync/syncEngineSession.ts`, `hub/src/socket/handlers/cli/index.ts`, `hub/src/socket/server.ts`, `hub/src/index.ts` - Thread typed activity through existing Hub layers.
- `hub/src/sync/sessionModel.test.ts` - Verifies CLI ready messages carry turn-completed activity through socket handlers.
- `web/src/hooks/useSSE.ts` - Preserves completed/error markers across keepalives and clears stale markers on explicit/new work status.
- `web/src/hooks/useSSE.test.tsx` - Covers idle keepalive, completion marker preservation, and new thinking marker clearing.

## Decisions Made

- Kept ready completion on the existing CLI ready-event path. This avoids a new wire event and constrains spoofing risk to the existing role-wrapped event shape.
- Kept `shouldRecordSessionActivity` as a compatibility wrapper over `classifySessionActivity`, while new Hub code consumes the typed classification.
- Treated full-suite runner integration timeouts as an environment issue because they failed in `cli/src/runner/runner.integration.test.ts` before exercising changed session status code, while targeted shared/hub/web tests and typecheck passed.

## GitNexus Impact

- `toSessionSummary`: LOW risk, 0 indexed direct callers or affected processes.
- `useSSE`: LOW risk, direct caller `AppInner` plus hook tests; affected `AppInner` process.
- `shouldRecordSessionActivity`: HIGH risk, direct caller `registerSessionHandlers`; affected `registerCliHandlers` and `registerSessionHandlers` processes.
- `registerSessionHandlers`: HIGH risk, direct callers `registerCliHandlers` and tests; affected Hub socket startup flow.
- `SessionLivenessService.recordSessionActivity`: LOW risk, direct caller `SessionCache.recordSessionActivity`; affected Sync constructor process.
- `SessionLivenessService.markMessageQueued`: LOW risk, direct caller `SessionCache.markMessageQueued`.
- Pre-commit `detect_changes` for Task 2 GREEN reported CRITICAL overall due the changed Hub startup/socket path; targeted tests and typecheck covered the touched flows.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Tightened optional `statusKind` narrowing for Web typecheck**
- **Found during:** Task 2 GREEN verification
- **Issue:** The Task 1 Web patch branch returned `patch.statusKind` after only an own-property check, but TypeScript still treated it as possibly undefined.
- **Fix:** Added an explicit `patch.statusKind !== undefined` guard.
- **Files modified:** `web/src/hooks/useSSE.ts`
- **Verification:** `bun run typecheck`; `cd web && bun run test -- useSSE SessionListItem`
- **Committed in:** `dc52af6`

**2. [Rule 3 - Blocking] Aligned ready activity test with typed classifier shape**
- **Found during:** Task 2 GREEN verification
- **Issue:** The RED socket-flow assertion expected a string, while the classifier contract returns `{ kind: 'turn-completed' }`.
- **Fix:** Updated the assertion and callback capture type to expect the classifier object.
- **Files modified:** `hub/src/sync/sessionModel.test.ts`
- **Verification:** `cd hub && bun test src/sync/sessionActivity.test.ts src/sync/sessionLivenessService.test.ts src/sync/sessionModel.test.ts`
- **Committed in:** `dc52af6`

---

**Total deviations:** 2 auto-fixed (2 blocking issues)
**Impact on plan:** Both fixes were narrow verification/type-safety corrections. No package installs, new endpoints, auth changes, broad refetch fallback, or session-row model/effort text were introduced.

## Issues Encountered

- `bun run test` failed in `cli/src/runner/runner.integration.test.ts` beforeEach with 12 hook timeouts while stopping/starting the runner integration environment. This appears unrelated to the changed shared/Hub/Web session status code: targeted shared, Hub, Web, typecheck, madge, and banned-literal guards passed. Existing dev runner/session processes were present in the local environment, so the failure is documented for follow-up instead of auto-fixed.

## Known Stubs

None. Stub-pattern scan found no new placeholder UI, empty mock data flow, TODO, or FIXME in the created/modified source files.

## Threat Flags

None. The plan touched existing CLI socket and Hub SSE trust boundaries described in the plan threat model, but did not add new endpoints, auth paths, file access patterns, package installs, or schema trust boundaries.

## TDD Gate Compliance

- RED commits present before implementation: `ffb864b`, `27d8716`
- GREEN commits present after RED: `f00dff4`, `dc52af6`
- No separate refactor commit was needed.

## Verification

- `cd shared && bun test sessionSummary.test.ts` - passed, 6 tests.
- `cd hub && bun test src/sync/sessionLivenessService.test.ts src/sync/sessionModel.test.ts src/sync/sessionActivity.test.ts` - passed, 41 tests.
- `cd web && bun run test -- useSSE SessionListItem` - passed, 25 tests across 2 files.
- `bun run typecheck` - passed across CLI, Web, and Hub.
- `bun run madge:check` - passed with no circular dependencies.
- `bash scripts/check-no-cut-agents.sh` - passed.
- `bun run test` - failed in CLI runner integration beforeEach timeouts; see Issues Encountered.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Phase 1 plan work is complete for UAT Test 4 from the relevant code and targeted verification perspective. The remaining caveat is the unrelated local runner integration timeout in the broad suite.

## Self-Check: PASSED

- Found `.planning/phases/01-cursor-runtime-config-contract/01-10-SUMMARY.md`.
- Found all 16 created/modified source and test files listed above.
- Found task commits `ffb864b`, `f00dff4`, `27d8716`, and `dc52af6`.
- Relevant automated tests and typecheck passed; broad `bun run test` caveat documented under Issues Encountered.

---

*Phase: 01-cursor-runtime-config-contract*
*Completed: 2026-05-23*
