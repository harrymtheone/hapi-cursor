---
phase: 01-cursor-runtime-config-contract
plan: 11
subsystem: hub-runtime-config
tags: [hono, zod, socket-rpc, cursor-runtime, bun-test]

requires:
  - phase: 01-cursor-runtime-config-contract
    provides: Cursor runtime discovery and selected-runtime rejection behavior from 01-02 through 01-05
provides:
  - Hub spawn route rejection for unsupported effort fields
  - Hub spawn RPC facades that forward model-only runtime launch config
  - Regression coverage for effort rejection before engine invocation
affects: [hub-spawn-boundary, runner-spawn-contract, cursor-runtime-config]

tech-stack:
  added: []
  patterns:
    - Strict Hub spawn body validation with an explicit unsupported effort error before engine invocation
    - Model-only Hub spawn payloads through SyncEngine, SyncEngineRpc, and RpcGateway

key-files:
  created:
    - .planning/phases/01-cursor-runtime-config-contract/01-11-SUMMARY.md
  modified:
    - hub/src/web/routes/machines.ts
    - hub/src/web/routes/machines.test.ts
    - hub/src/sync/rpcGateway.ts
    - hub/src/sync/syncEngineRpc.ts
    - hub/src/sync/syncEngine.ts
    - hub/src/sync/syncEngineSessionResume.ts
    - hub/src/sync/sessionModel.test.ts

key-decisions:
  - "Reject unsupported effort/modelReasoningEffort at the Hub spawn boundary instead of forwarding fields Cursor launch cannot honor."
  - "Keep selected model launch behavior unchanged by preserving raw model forwarding through the Hub spawn facades."
  - "Leave session metadata effort persistence untouched for later gap plans while removing effort from the spawn path only."

patterns-established:
  - "Unsupported runtime effort spawn input returns safe code `unsupported-runtime-effort` and does not call `engine.spawnSession`."
  - "Hub spawn facades accept only model, permission, yolo/session type, worktree, and resume token launch parameters."

requirements-completed: [CURS-02]

duration: 3min
completed: 2026-05-24
---

# Phase 01 Plan 11: Hub Spawn Effort Rejection Summary

**Hub spawn boundary now rejects unsupported separate effort config while preserving model-only Cursor launch behavior**

## Performance

- **Duration:** 3 min
- **Started:** 2026-05-24T01:43:09Z
- **Completed:** 2026-05-24T01:46:12Z
- **Tasks:** 1
- **Files modified:** 7

## Accomplishments

- Added RED coverage proving `effort` and `modelReasoningEffort` spawn bodies return HTTP 400 with `unsupported-runtime-effort` before `engine.spawnSession` is called.
- Removed unsupported effort parameters from `spawnBodySchema`, `SyncEngine.spawnSession`, `SyncEngineRpc.spawnSession`, and `RpcGateway.spawnSession`.
- Preserved selected model launch behavior and safe `selected-runtime-config-rejected` spawn errors.
- Updated resume-path coverage so stored model still forwards while unsupported effort fields do not re-enter the spawn RPC.

## Task Commits

1. **Task 1 RED: Add failing spawn effort rejection coverage** - `79b04e6` (test)
2. **Task 1 GREEN: Reject unsupported spawn effort config** - `974d221` (feat)

_Note: This TDD task produced RED and GREEN commits._

## Files Created/Modified

- `hub/src/web/routes/machines.ts` - Rejects unsupported effort spawn fields and validates model-only spawn bodies strictly.
- `hub/src/web/routes/machines.test.ts` - Covers effort/modelReasoningEffort rejection, no engine invocation, model-only forwarding, and existing safe model rejection propagation.
- `hub/src/sync/rpcGateway.ts` - Removes unsupported effort fields from machine RPC spawn payloads.
- `hub/src/sync/syncEngineRpc.ts` - Removes unsupported effort fields from the RPC facade signature.
- `hub/src/sync/syncEngine.ts` - Removes unsupported effort fields from the public Hub spawn facade.
- `hub/src/sync/syncEngineSessionResume.ts` - Resumes Cursor sessions with stored model, resume token, and permission mode only.
- `hub/src/sync/sessionModel.test.ts` - Verifies resumed spawn no longer forwards unsupported effort fields while preserving model, resume token, and permission mode behavior.

## Decisions Made

- Used an explicit safe error code, `unsupported-runtime-effort`, for unsupported effort spawn input so Web callers can distinguish this truthfulness boundary from generic invalid JSON/body failures.
- Made `spawnBodySchema` strict after adding the explicit effort precheck. This rejects unsupported shape drift at the external spawn boundary.
- Kept effort metadata persistence and config application intact because this plan only covers the Hub spawn boundary; follow-up plans 01-14 and 01-15 cover persistence/RPC and CLI runner launch contracts.

## GitNexus Impact

- `createMachinesRoutes`: LOW risk, 2 direct dependents, affected processes `createWebApp` and `main`.
- `RpcGateway.spawnSession`: LOW risk, 2 direct callers, affected process `resumeSession`.
- `SyncEngineRpc.spawnSession`: LOW risk, 1 direct caller, no affected processes.
- `SyncEngine.spawnSession`: LOW risk, 0 direct callers/processes.
- Pre-commit `detect_changes`: MEDIUM risk, changed Hub spawn route/facade symbols and affected `ResumeSession -> GetSocketIdForMethod`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Preserved resume token and permission argument positions**
- **Found during:** Task 1 GREEN
- **Issue:** Removing the unsupported effort parameters from the positional spawn signature shifted resume-token and permission-mode arguments.
- **Fix:** Updated `SyncEngineSessionResume` and resume tests so model, resume token, and permission mode still land in the correct spawn positions after effort removal.
- **Files modified:** `hub/src/sync/syncEngineSessionResume.ts`, `hub/src/sync/sessionModel.test.ts`
- **Verification:** `cd hub && bun test src/web/routes/machines.test.ts src/sync/sessionModel.test.ts`; `bun run typecheck`
- **Committed in:** `974d221`

---

**Total deviations:** 1 auto-fixed (1 blocking issue)
**Impact on plan:** The fix was required to keep existing resume behavior intact after the planned spawn signature contraction. No scope expansion beyond the Hub spawn boundary.

## Issues Encountered

- RED tests failed as expected before implementation: unsupported effort inputs returned 200 and old resumed spawn argument positions still carried unsupported runtime config.
- No auth gates or package installs occurred.

## Known Stubs

None. Stub scan found no TODO/FIXME/placeholder UI data stubs in modified production files; the only empty object match was an existing local accumulator in `rpcGateway.ts`.

## Threat Flags

None. The Web-to-Hub spawn boundary and Hub-to-runner RPC payload are the planned trust boundaries for T-01-11-01 and T-01-11-02.

## TDD Gate Compliance

- RED commit present before implementation: `79b04e6`
- GREEN commit present after RED: `974d221`
- No REFACTOR commit needed.

## Verification

- `cd hub && bun test src/web/routes/machines.test.ts src/sync/sessionModel.test.ts` - passed, 39 tests.
- `bun run typecheck` - passed across CLI, Web, and Hub.
- `bash scripts/check-no-cut-agents.sh` - passed.
- Source assertion: `hub/src/web/routes/machines.ts` `spawnBodySchema` no longer lists `effort` or `modelReasoningEffort`.
- Source assertion: `hub/src/sync/rpcGateway.ts`, `hub/src/sync/syncEngineRpc.ts`, and `hub/src/sync/syncEngine.ts` spawn signatures no longer include `effort` or `modelReasoningEffort`.
- Test assertion: Hub route tests prove effort/modelReasoningEffort spawn bodies return 400 and do not call the engine.
- Test assertion: Hub route tests prove model-only spawn still passes the selected model.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

The Hub spawn boundary is now truthful for separate effort: unsupported effort cannot enter the runner spawn path from Web. Plans 01-14 and 01-15 can close the remaining persistence/RPC and CLI runner surfaces without compensating for Hub route acceptance.

## Self-Check: PASSED

- Found `.planning/phases/01-cursor-runtime-config-contract/01-11-SUMMARY.md`.
- Found `hub/src/web/routes/machines.ts`.
- Found `hub/src/web/routes/machines.test.ts`.
- Found `hub/src/sync/rpcGateway.ts`.
- Found `hub/src/sync/syncEngineRpc.ts`.
- Found `hub/src/sync/syncEngine.ts`.
- Found `hub/src/sync/syncEngineSessionResume.ts`.
- Found `hub/src/sync/sessionModel.test.ts`.
- Found task commit `79b04e6`.
- Found task commit `974d221`.

---

*Phase: 01-cursor-runtime-config-contract*
*Completed: 2026-05-24*
