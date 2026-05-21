---
phase: 04-cut-deployment-infrastructure
plan: 03
subsystem: cli
tags: [logger, doctor, remote-logging, diagnostics, cut-11]

requires:
  - phase: 04-cut-deployment-infrastructure
    provides: relay runtime and relay configuration deletion from Plans 04-01 and 04-02
provides:
  - Local-only CLI logger with no remote fetch/upload path to HAPI_API_URL
  - Doctor diagnostics without the dangerous remote-log toggle
  - Regression tests for local logging and doctor output behavior
affects: [phase-04, cut-deployment-infrastructure, cut-11]

tech-stack:
  added: []
  patterns:
    - local-only CLI diagnostics
    - focused Vitest regression tests for deletion guards

key-files:
  created:
    - cli/src/ui/logger.test.ts
    - cli/src/ui/doctor.test.ts
    - .planning/phases/04-cut-deployment-infrastructure/04-03-SUMMARY.md
  modified:
    - cli/src/ui/logger.ts
    - cli/src/ui/doctor.ts

key-decisions:
  - "Removed the dangerous remote-log upload path outright instead of keeping a disabled flag, compatibility warning, or replacement export feature."
  - "Preserved legitimate HAPI_API_URL doctor visibility as direct-connect configuration while deleting only remote-log usage."

patterns-established:
  - "CUT-11 logger coverage constructs Logger with a temp local log path and asserts fetch is never called even when legacy remote-log env is set."
  - "Doctor diagnostics tests assert the dangerous toggle is absent while direct-connect HAPI_API_URL remains visible."

requirements-completed: [CUT-11]

duration: 21 min
completed: 2026-05-21
---

# Phase 04 Plan 03: Remote Logging and Doctor Cleanup Summary

**CLI diagnostics now stay local-only: logger writes console/files without remote uploads, and doctor no longer advertises the removed remote-log toggle.**

## Performance

- **Duration:** 21 min
- **Started:** 2026-05-21T09:15:29Z
- **Completed:** 2026-05-21T09:36:02Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Removed the `DANGEROUSLY_LOG_TO_SERVER_FOR_AI_AUTO_DEBUGGING` + `HAPI_API_URL` upload branch from `cli/src/ui/logger.ts`, including the remote URL field, `sendToRemoteServer`, `fetch` call, and fire-and-forget remote branch.
- Added `cli/src/ui/logger.test.ts` proving local log entries are still written and `globalThis.fetch` is not called even with the legacy remote-log env and `HAPI_API_URL` set.
- Removed the dangerous remote-log toggle from `getEnvironmentInfo()` and printed doctor output while preserving legitimate `HAPI_API_URL` direct-connect diagnostics.
- Added `cli/src/ui/doctor.test.ts` covering the removed toggle and preserved direct-connect URL output.

## Task Commits

Each task was committed atomically:

1. **Task 04-03-01: Make CLI logger local-only with regression coverage** - `3dc66a1` (feat)
2. **Task 04-03-02: Remove doctor remote-log toggle display with coverage** - `b71295a` (feat)

**Plan metadata:** committed separately after state/roadmap updates.

## Files Created/Modified

- `cli/src/ui/logger.ts` - Removed remote upload state, fetch upload method, dangerous env gate, and remote branch from local file logging.
- `cli/src/ui/logger.test.ts` - Added temp-file regression coverage for local logging and no fetch uploads.
- `cli/src/ui/doctor.ts` - Removed dangerous remote-log env from environment info and printed diagnostics.
- `cli/src/ui/doctor.test.ts` - Added console-output regression coverage for absent remote-log toggle and preserved `HAPI_API_URL`.
- `.planning/phases/04-cut-deployment-infrastructure/04-03-SUMMARY.md` - Execution summary and verification record.

## Decisions Made

- Proceeded after explicit user approval despite GitNexus reporting CRITICAL pre-edit impact for `Logger` and `logToFile`; the staged change-detection risk for each committed task was LOW.
- Kept the logger change scoped to deletion of the remote upload path and one testing export for `Logger`, avoiding broader logger formatting or behavior refactors.
- Treated `HAPI_API_URL` as legitimate direct-connect configuration outside the removed logger upload path.

## GitNexus Impact Notes

- Pre-edit impact analysis for `Logger` reported CRITICAL risk: 39 direct importers and 68 impacted symbols, with no affected indexed processes.
- Pre-edit impact analysis for `Logger.logToFile` reported CRITICAL risk: 24 affected execution flows across Runner, Handlers, Cursor, Agent, Terminal, Commands, and Watcher areas.
- Pre-edit impact analysis for `getEnvironmentInfo` and `runDoctorCommand` reported LOW risk with direct runner/doctor callers.
- Staged detect for Task 04-03-01 reported LOW risk with no affected execution processes.
- Staged detect for Task 04-03-02 reported LOW risk with no affected execution processes.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed doctor test harness imports and spy capture**
- **Found during:** Task 04-03-02 (Remove doctor remote-log toggle display with coverage)
- **Issue:** The new doctor test initially omitted `afterEach` from Vitest imports, then restored the console spy before reading captured calls.
- **Fix:** Imported `afterEach` and captured console output before restoring the spy.
- **Files modified:** `cli/src/ui/doctor.test.ts`
- **Verification:** `cd cli && bun run test src/ui/doctor.test.ts` passed.
- **Committed in:** `b71295a`

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** The fix was limited to the planned regression test and did not broaden implementation scope.

## Issues Encountered

- The plan-specified focused commands with `--runInBand` cannot run on the repo's Vitest 4.0.16 CLI because Vitest rejects `--runInBand` as an unknown option before executing tests. Equivalent focused commands without that unsupported flag passed:
  - `cd cli && bun run test src/ui/logger.test.ts`
  - `cd cli && bun run test src/ui/doctor.test.ts`
- Full `bun typecheck && bun run test` passed after each task; web tests continued to emit existing jsdom navigation "Not implemented" console noise while exiting 0.

## Verification

- `cd cli && bun run test src/ui/logger.test.ts` passed.
- `cd cli && bun run test src/ui/doctor.test.ts` passed.
- `bun typecheck && bun run test` passed after Task 04-03-01.
- `bun typecheck && bun run test` passed after Task 04-03-02 and final plan verification.
- Source sweep confirmed `cli/src/ui/logger.ts` contains no `DANGEROUSLY_LOG_TO_SERVER_FOR_AI_AUTO_DEBUGGING`, `dangerouslyUnencryptedServerLoggingUrl`, `sendToRemoteServer`, or `fetch(`.
- Source sweep confirmed `cli/src/ui/doctor.ts` contains no `DANGEROUSLY_LOG_TO_SERVER_FOR_AI_AUTO_DEBUGGING` or `DANGEROUSLY_LOG_TO_SERVER`.

## Known Stubs

None. Stub scan only matched existing empty-object local accumulators/fallbacks in `logger.ts` and `doctor.ts`; these are not UI/data stubs and were not introduced as incomplete behavior.

## Threat Flags

None - this plan removed a CLI runtime network upload boundary and did not add new endpoints, auth paths, file access patterns, or schemas.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Ready for Plan 04-04 to remove remaining build/runtime tunwg assets, extend guard coverage, and run the final Phase 04 build gate.

## Self-Check: PASSED

- Summary file created at `.planning/phases/04-cut-deployment-infrastructure/04-03-SUMMARY.md`.
- Task commit `3dc66a1` exists.
- Task commit `b71295a` exists.
- Created test files exist: `cli/src/ui/logger.test.ts`, `cli/src/ui/doctor.test.ts`.
- No tracked files were deleted by either task commit.

---
*Phase: 04-cut-deployment-infrastructure*
*Completed: 2026-05-21*
