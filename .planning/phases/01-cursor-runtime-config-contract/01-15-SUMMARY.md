---
phase: 01-cursor-runtime-config-contract
plan: 15
subsystem: cli-runner-spawn-contract
tags: [cursor-runtime, runner, machine-rpc, vitest]

requires:
  - phase: 01-cursor-runtime-config-contract
    provides: Hub spawn effort rejection from 01-11 and session-config effort stripping from 01-14
provides:
  - CLI runner spawn contract exposes selected model without unsupported effort fields
  - Machine spawn RPC forwards selected model while dropping unsupported effort-shaped input
  - Cursor launch argument coverage for selected model, resume plus model, and unsupported effort omission
  - Selected-runtime rejection classification scoped to explicit selected model launches
affects: [runner-spawn, machine-rpc, cursor-runtime-config]

tech-stack:
  added: []
  patterns:
    - Model-only selected runtime launch contract at the CLI runner boundary
    - Selected-runtime-config rejection only for explicit selected model launch failures

key-files:
  created:
    - .planning/phases/01-cursor-runtime-config-contract/01-15-SUMMARY.md
  modified:
    - cli/src/modules/common/rpcTypes.ts
    - cli/src/api/apiMachine.ts
    - cli/src/api/apiMachine.test.ts
    - cli/src/runner/run.ts
    - cli/src/runner/run.test.ts
    - cli/src/runner/buildCliArgs.test.ts

key-decisions:
  - "Keep CLI runner spawn options model-only for selected runtime launch until Cursor exposes verified effort support."
  - "Classify selected-runtime-config-rejected only when an explicit selected model was present."
  - "Treat unsupported effort-shaped input at the runner boundary as ignored data, not as a selected runtime rejection trigger."

patterns-established:
  - "Runner spawn contracts remove unsupported runtime fields instead of preserving compatibility aliases."
  - "Launch argument tests cover supported Cursor flags and assert unsupported effort flags are never emitted."

requirements-completed: [CURS-02]

duration: 3min
completed: 2026-05-24
---

# Phase 01 Plan 15: CLI Runner Spawn Contract Summary

**CLI runner launches now accept selected model only, omit unsupported effort fields, and reserve selected-runtime rejection for explicit model failures**

## Performance

- **Duration:** 3 min
- **Started:** 2026-05-24T01:57:27Z
- **Completed:** 2026-05-24T02:00:34Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- Removed `effort` and `modelReasoningEffort` from `SpawnSessionOptions`, so the CLI runner spawn contract cannot carry unsupported effort config.
- Updated the machine `spawn-happy-session` handler to forward `model` while omitting effort-shaped payload fields before calling `spawnSession`.
- Narrowed `toSafeSpawnFailure()` so `selected-runtime-config-rejected` is produced only for explicit selected model launch failures.
- Added runner argument coverage proving selected model and resume plus selected model launch args are passed, and unsupported effort flags are never emitted.

## Task Commits

1. **Task 1 RED: Add failing CLI spawn contract test** - `2604e16` (test)
2. **Task 1 GREEN: Remove CLI spawn effort contract** - `f2c3c34` (feat)
3. **Task 2 coverage: Cover supported Cursor launch args** - `e6184b9` (test)

_Note: Task 2 launch-argument behavior was already green after the Task 1 typecheck-driven cleanup and existing `buildCliArgs()` implementation; see TDD Gate Compliance._

## Files Created/Modified

- `cli/src/modules/common/rpcTypes.ts` - Removes unsupported effort fields from `SpawnSessionOptions`.
- `cli/src/api/apiMachine.ts` - Drops unsupported effort-shaped fields from machine spawn RPC forwarding while preserving selected model forwarding.
- `cli/src/api/apiMachine.test.ts` - Proves selected model reaches `spawnSession` and effort fields do not.
- `cli/src/runner/run.ts` - Keeps `buildCliArgs()` on verified Cursor flags and scopes selected-runtime rejection to `options.model`.
- `cli/src/runner/run.test.ts` - Covers model-only selected-runtime rejection and unsupported effort-shaped ordinary failure behavior.
- `cli/src/runner/buildCliArgs.test.ts` - Covers selected model launch, resume plus model launch, and absence of invented effort flags.

## Decisions Made

- Removed unsupported effort from the CLI runner spawn type rather than adding compatibility shims, matching the repo's no-backward-compatibility stance and D-06 runtime-truth requirement.
- Preserved selected model launch behavior unchanged through both machine RPC forwarding and `buildCliArgs()`.
- Kept effort-shaped legacy input from broadening `selected-runtime-config-rejected`, because 01-11 and 01-14 now prevent supported code paths from sending unsupported effort to the runner.

## GitNexus Impact

- `SpawnSessionOptions`: LOW risk, 3 direct importers, no affected indexed processes.
- `ApiMachineClient.setRPCHandlers`: LOW risk, 1 direct test caller, no affected indexed processes.
- `buildCliArgs`: LOW risk, 2 direct callers, runner `spawnSession` flow affected.
- `toSafeSpawnFailure`: LOW risk, 2 direct callers, runner `spawnSession` flow affected.
- Pre-commit `detect_changes`: LOW risk; changed symbols were `ApiMachineClient`, `setRPCHandlers`, and `toSafeSpawnFailure`, with no affected indexed processes.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Removed stale runner effort references after spawn type removal**
- **Found during:** Task 1 (Remove unsupported effort from CLI spawn types)
- **Issue:** Removing `effort` and `modelReasoningEffort` from `SpawnSessionOptions` correctly made root typecheck fail on stale `toSafeSpawnFailure()` and `run.test.ts` references.
- **Fix:** Narrowed `toSafeSpawnFailure()` to `options.model` and updated tests so unsupported effort-shaped input preserves ordinary spawn failure behavior.
- **Files modified:** `cli/src/runner/run.ts`, `cli/src/runner/run.test.ts`
- **Verification:** `cd cli && bun run test -- apiMachine run`; `bun run typecheck`
- **Committed in:** `f2c3c34`

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** The fix was required to make the removed type surface compile and it directly implements D-08. No scope creep.

## Issues Encountered

- Task 2's added launch-argument tests passed immediately because `buildCliArgs()` already emitted only supported Cursor flags and the selected-runtime classifier had been narrowed during Task 1's required typecheck cleanup.
- The first guard run was accidentally invoked from `cli/` after a chained `cd`; it failed to find `scripts/check-no-cut-agents.sh`. The guard was rerun from the repo root and passed.
- Shell `rg` is not installed in this environment; commit self-check was rerun with `git cat-file`, and source/stub scans used the Cursor ripgrep tool.
- No auth gates or package installs occurred.

## Known Stubs

None. Stub scan found no TODO/FIXME/placeholder UI data stubs in modified production files. Existing `null`, empty object, and empty array values in modified runner/API files are runtime state initializers, not UI stubs.

## Threat Flags

None. The Hub-to-CLI machine RPC and CLI-to-Cursor launch trust boundaries were the planned surfaces for T-01-15-01 through T-01-15-04.

## TDD Gate Compliance

- Task 1 RED commit present before implementation: `2604e16`
- Task 1 GREEN commit present after RED: `f2c3c34`
- Task 2 did not produce a failing RED commit: the required `buildCliArgs()` launch behavior already existed, and the remaining change was coverage-only (`e6184b9`).
- No REFACTOR commit needed.

## Verification

- `cd cli && bun run test -- apiMachine` - failed in RED as expected before implementation, then passed after `f2c3c34`.
- `cd cli && bun run test -- buildCliArgs run` - passed, 29 tests and 12 skipped integration checks.
- `cd cli && bun run test -- apiMachine run` - passed, 31 tests and 12 skipped integration checks.
- `bun run typecheck` - passed across CLI, Web, and Hub.
- `bash scripts/check-no-cut-agents.sh` - passed from repo root.
- Source assertion: `cli/src/modules/common/rpcTypes.ts` has `model?: string` and no `effort` or `modelReasoningEffort` properties.
- Source assertion: `cli/src/api/apiMachine.ts` has no `effort` or `modelReasoningEffort` references in the spawn handler.
- Source assertion: `cli/src/runner/run.ts` emits `--resume` and `--model`, and does not emit effort flags.
- Test assertion: `apiMachine` tests prove selected model reaches `spawnSession` while unsupported effort fields do not.
- Test assertion: `buildCliArgs` tests prove selected model and resumed selected model launch args include only verified Cursor flags.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

The runner spawn contract is now aligned with the Hub spawn and session-config gap closures from 01-11 and 01-14. Remaining Phase 1 gap plans can focus on removing unsupported Web effort mutation and durable completion-marker refetch behavior.

## Self-Check: PASSED

- Found `.planning/phases/01-cursor-runtime-config-contract/01-15-SUMMARY.md`.
- Found `cli/src/modules/common/rpcTypes.ts`.
- Found `cli/src/api/apiMachine.ts`.
- Found `cli/src/api/apiMachine.test.ts`.
- Found `cli/src/runner/run.ts`.
- Found `cli/src/runner/run.test.ts`.
- Found `cli/src/runner/buildCliArgs.test.ts`.
- Found task commit `2604e16`.
- Found task commit `f2c3c34`.
- Found task commit `e6184b9`.

---

*Phase: 01-cursor-runtime-config-contract*
*Completed: 2026-05-24*
