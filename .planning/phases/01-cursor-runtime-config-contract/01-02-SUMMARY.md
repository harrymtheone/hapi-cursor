---
phase: 01-cursor-runtime-config-contract
plan: 02
subsystem: cli-runtime-config
tags: [cursor-cli, model-discovery, socket-rpc, vitest, typescript]

requires:
  - phase: 01-cursor-runtime-config-contract
    provides: Shared Cursor model discovery result schema from 01-01
provides:
  - Local Cursor model discovery runner and parser
  - Machine-scoped `discover-cursor-models` RPC handler
  - Safe selected-runtime-config launch rejection code
affects: [hub-runtime-config, web-runtime-config, new-session-model-selector]

tech-stack:
  added: []
  patterns:
    - Spawn Cursor runtime commands with argument arrays and timeout guards
    - Validate CLI-to-Hub runtime discovery results with shared Zod schemas
    - Preserve auto/unspecified launch behavior while shaping explicit runtime config failures

key-files:
  created:
    - cli/src/cursor/modelDiscovery.ts
    - cli/src/cursor/modelDiscovery.test.ts
    - cli/src/api/apiMachine.test.ts
    - cli/src/runner/run.test.ts
    - .planning/phases/01-cursor-runtime-config-contract/01-02-SUMMARY.md
  modified:
    - cli/src/api/apiMachine.ts
    - cli/src/modules/common/rpcTypes.ts
    - cli/src/runner/run.ts

key-decisions:
  - "Run model discovery only through the local `agent models` runtime command and return safe categorized errors instead of any static fallback list."
  - "Expose discovery as a machine-scoped RPC because it happens before a session exists."
  - "Classify explicit selected runtime launch failures with `selected-runtime-config-rejected` while leaving auto/unspecified launch failures unchanged."

patterns-established:
  - "Cursor model discovery errors log raw stderr locally with `[cursor-model-discovery]` but never return raw stdout or stderr."
  - "Runner spawn errors can carry optional safe codes while preserving the existing `errorMessage` contract."

requirements-completed: [CURS-01]

duration: 4min
completed: 2026-05-23
---

# Phase 01 Plan 02: Cursor Model Discovery RPC Summary

**Local Cursor runtime model discovery via `agent models`, exposed through a machine-scoped RPC with safe failure states and explicit runtime rejection reporting**

## Performance

- **Duration:** 4 min
- **Started:** 2026-05-23T14:51:32Z
- **Completed:** 2026-05-23T14:55:45Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments

- Added `parseCursorModelList()` and `discoverCursorModels()` with raw id preservation, no static model catalog, argument-array spawning, a 5000ms timeout, local stderr logging, and shared schema validation.
- Registered machine-level `discover-cursor-models` beside runner session spawn handling, with no session-scoped discovery handler.
- Added safe `selected-runtime-config-rejected` classification for explicit model/effort launch failures while preserving ordinary auto/unspecified spawn failures.
- Added focused Vitest coverage for parser behavior, timeout/unavailable/auth failures, RPC registration, and explicit-runtime spawn failure shaping.

## Task Commits

1. **Task 1 RED: Add Cursor model discovery tests** - `9f7378d` (test)
2. **Task 1 GREEN: Implement Cursor model discovery** - `d4fc1af` (feat)
3. **Task 2 RED: Add runtime discovery RPC tests** - `72e53b9` (test)
4. **Task 2 GREEN: Expose discovery RPC and safe runtime rejection** - `e959a4b` (feat)

_Note: Both planned tasks used TDD test and implementation commits._

## Files Created/Modified

- `cli/src/cursor/modelDiscovery.ts` - Runs `agent models`, parses Cursor model ids, categorizes safe discovery failures, and validates results.
- `cli/src/cursor/modelDiscovery.test.ts` - Covers model list parsing, raw id preservation, empty output, timeout, missing CLI, auth failure, and stderr non-exposure.
- `cli/src/api/apiMachine.ts` - Registers the machine-scoped `discover-cursor-models` RPC and propagates optional safe spawn error codes.
- `cli/src/api/apiMachine.test.ts` - Verifies the discovery RPC registration returns a schema-valid result.
- `cli/src/modules/common/rpcTypes.ts` - Allows runner spawn errors to carry `selected-runtime-config-rejected`.
- `cli/src/runner/run.ts` - Adds safe explicit-runtime failure shaping in the runner spawn path.
- `cli/src/runner/run.test.ts` - Verifies explicit runtime config failures are labeled safely and auto launches are not mislabeled.
- `.planning/phases/01-cursor-runtime-config-contract/01-02-SUMMARY.md` - Records execution results.

## Decisions Made

- Used the installed Cursor runtime command as the only discovery source. This satisfies D-01 and avoids stale fallback model ids.
- Kept discovery machine-scoped because the model list is needed before session launch and depends on the selected runner machine.
- Added an optional spawn error code rather than replacing the existing `errorMessage` shape, keeping current runner callers intact while allowing downstream Hub/Web plans to branch on a safe code.

## GitNexus Impact

- `ApiMachineClient`: LOW risk, 2 direct callers/importers, affected processes `run` and `startRunner`, affected module `Runner`.
- `ApiMachineClient.setRPCHandlers`: LOW risk, 1 direct caller, affected processes `run` and `startRunner`, affected module `Runner`.
- `startRunner`: LOW risk, 1 direct caller, affected process `run`, affected module `Runner`.
- `buildCliArgs`: LOW risk, 2 direct callers, affected process `spawnSession`, affected module `Runner`.
- Pre-commit `detect_changes`: no affected indexed symbols for new test/module files; Task 2 implementation diff reported HIGH because it touches runner spawn/session processes, which were covered by targeted tests and typecheck.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Timeout classification wins before child exit**
- **Found during:** Task 1 GREEN
- **Issue:** Killing the fake child process during timeout emitted `exit` synchronously, allowing the generic nonzero failure path to resolve before `timed-out`.
- **Fix:** Resolve the `timed-out` result before killing the child.
- **Files modified:** `cli/src/cursor/modelDiscovery.ts`
- **Verification:** `cd cli && bun run test -- modelDiscovery`
- **Committed in:** `d4fc1af`

**2. [Rule 3 - Blocking] Tightened TypeScript types after implementation**
- **Found during:** Task 2 GREEN
- **Issue:** Typecheck caught test fixture config gaps, parser predicate narrowing, spawn child stream typing, and helper argument typing.
- **Fix:** Added required test fixture fields, rewrote parser narrowing explicitly, made child streams nullable-safe, and typed `toSafeSpawnFailure()` against `SpawnSessionOptions`.
- **Files modified:** `cli/src/api/apiMachine.test.ts`, `cli/src/cursor/modelDiscovery.ts`, `cli/src/runner/run.ts`
- **Verification:** `bun run typecheck`
- **Committed in:** `e959a4b`

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking issue)
**Impact on plan:** Both fixes were required for correctness and type safety. No scope expansion beyond the planned CLI discovery/RPC work.

## Issues Encountered

- The targeted command `cd cli && bun run test -- apiMachine run` also matched existing runner-related tests. The integration test detected the hub was not running and skipped 12 integration cases as designed; all selected test files passed.

## Known Stubs

None.

## Threat Flags

None. The new subprocess and machine RPC surfaces are the planned threat-model boundaries T-01-04, T-01-05, and T-01-06.

## TDD Gate Compliance

- RED commits present before implementation: `9f7378d`, `72e53b9`
- GREEN commits present after RED: `d4fc1af`, `e959a4b`

## Verification

- `cd cli && bun run test -- modelDiscovery` - passed, 7 tests.
- `cd cli && bun run test -- modelDiscovery apiMachine run` - passed, 28 tests and 12 skipped integration cases.
- `bun run typecheck` - passed across CLI, Web, and Hub.
- `bash scripts/check-no-cut-agents.sh` - passed.
- Source assertion: `cli/src/cursor/modelDiscovery.ts` contains no hardcoded model catalog or fallback model ids.
- Source assertion: process execution uses `spawn('agent', ['models']` with an argument array.
- Source assertion: no session-scoped discovery handler was introduced.
- Source assertion: discovery error results expose safe `reason` only, without `stdout` or `stderr` fields.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Hub/Web plans can now request local runtime model discovery from an online runner machine and can distinguish explicit selected-runtime launch rejection from ordinary auto/unspecified spawn failures.

## Self-Check: PASSED

- Found `.planning/phases/01-cursor-runtime-config-contract/01-02-SUMMARY.md`.
- Found `cli/src/cursor/modelDiscovery.ts`.
- Found `cli/src/cursor/modelDiscovery.test.ts`.
- Found `cli/src/api/apiMachine.ts`.
- Found `cli/src/api/apiMachine.test.ts`.
- Found `cli/src/modules/common/rpcTypes.ts`.
- Found `cli/src/runner/run.ts`.
- Found `cli/src/runner/run.test.ts`.
- Found task commit `9f7378d`.
- Found task commit `d4fc1af`.
- Found task commit `72e53b9`.
- Found task commit `e959a4b`.

---

*Phase: 01-cursor-runtime-config-contract*
*Completed: 2026-05-23*
