---
phase: 01-cursor-runtime-config-contract
plan: 14
subsystem: hub-runtime-config
tags: [cursor-runtime, session-config, socket-rpc, bun-test]

requires:
  - phase: 01-cursor-runtime-config-contract
    provides: Hub spawn effort rejection from 01-11
provides:
  - Active session-config effort fields no longer persist unless Cursor support is verified
  - Inactive/cache session-config effort fields no longer persist unless Cursor support is verified
  - Regression coverage for supported model and permissionMode behavior
affects: [session-config-rpc, session-cache, cursor-runtime-config]

tech-stack:
  added: []
  patterns:
    - Reject or strip unsupported runtime effort at session-config boundaries
    - Persist only acknowledged supported runtime config fields from active apply results

key-files:
  created:
    - .planning/phases/01-cursor-runtime-config-contract/01-14-SUMMARY.md
  modified:
    - cli/src/cursor/runCursor.ts
    - cli/src/cursor/runCursor.test.ts
    - hub/src/sync/sessionConfigService.ts
    - hub/src/sync/sessionConfigService.test.ts
    - hub/src/sync/syncEngineSession.ts
    - hub/src/sync/syncEngineSession.test.ts
    - hub/src/sync/sessionModel.test.ts

key-decisions:
  - "Reject or strip unsupported effort/modelReasoningEffort at the runner RPC and Hub persistence boundaries until Cursor runtime support is verified."
  - "Preserve model and permissionMode status-bearing behavior while preventing unsupported effort fields from being acknowledged as applied or persisted session config."

patterns-established:
  - "Active session-config persistence uses only acknowledged supported fields from `CursorRuntimeConfigApplyResult`."
  - "Inactive session-config persistence filters payloads down to supported model and permissionMode fields before cache/store writes."

requirements-completed: [CURS-02]

duration: 2min
completed: 2026-05-24
---

# Phase 01 Plan 14: Session-Config Effort Persistence Summary

**Session-config RPC and inactive persistence now strip unsupported effort fields while keeping supported model and permissionMode behavior intact**

## Performance

- **Duration:** 2 min
- **Started:** 2026-05-24T01:53:10Z
- **Completed:** 2026-05-24T01:54:25Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- Added RED coverage for active `set-session-config` requests proving unsupported `effort` and `modelReasoningEffort` cannot be persisted while supported model behavior remains status-bearing.
- Updated the Cursor runner RPC path and active Hub apply path so unsupported effort fields are not acknowledged as applied runtime config or written to cache/store state.
- Added RED coverage for inactive/cache-only session-config requests proving unsupported effort fields leave stored session config unchanged.
- Stripped inactive persistence to supported `model` and `permissionMode` fields while preserving model set/clear and permissionMode behavior.

## Task Commits

1. **Task 1 RED: Add failing active effort persistence tests** - `a7c5324` (test)
2. **Task 1 GREEN: Strip unsupported active config effort** - `6279b4e` (feat)
3. **Task 2 RED: Add failing inactive effort persistence tests** - `eba451e` (test)
4. **Task 2 GREEN: Strip unsupported inactive config effort** - `0a5aa28` (feat)

_Note: Both TDD tasks produced RED and GREEN commits._

## Files Created/Modified

- `cli/src/cursor/runCursor.ts` - Runner `set-session-config` handling no longer acknowledges unsupported effort fields as applied runtime config.
- `cli/src/cursor/runCursor.test.ts` - Covers unsupported effort behavior at the runner session-config RPC boundary.
- `hub/src/sync/syncEngineSession.ts` - Active apply persists only supported acknowledged fields; inactive apply filters cache writes down to supported fields.
- `hub/src/sync/syncEngineSession.test.ts` - Covers active and inactive effort stripping while preserving model apply behavior.
- `hub/src/sync/sessionConfigService.ts` - Store-backed session-config persistence ignores unsupported effort fields and emits only for supported config writes.
- `hub/src/sync/sessionConfigService.test.ts` - Covers ignored unsupported effort fields, effort-only no-op behavior, model clearing, and permissionMode updates.
- `hub/src/sync/sessionModel.test.ts` - Covers cache-level unsupported effort no-ops and existing model/keepalive/resume behavior.

## Decisions Made

- Kept unsupported effort as stored metadata only when it comes from existing create/keepalive paths still owned by other gap-closure plans; this plan blocks post-spawn session-config mutation paths.
- Returned existing session effort/modelReasoningEffort values in inactive apply results instead of echoing unsupported requested values, so UI state cannot interpret an unsupported request as persisted.
- Continued to return `applies-next-run` for inactive runtime config requests because selected model changes still queue for next launch.

## GitNexus Impact

- `SessionConfigService.applySessionConfig`: LOW risk, 1 direct caller, Sync module only, no affected indexed processes.
- `SyncEngineSession.applySessionConfig`: LOW risk, 1 direct caller, Sync module only, no affected indexed processes.
- Pre-commit `detect_changes`: LOW risk, 3 changed indexed symbols in `syncEngineSession.ts`, no affected indexed processes.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- RED tests already existed from the aborted executor and were preserved rather than duplicated.
- `rg` was not available in the shell environment for the stub scan; the Cursor ripgrep tool was used instead.
- No auth gates or package installs occurred.

## Known Stubs

None. Stub scan found no TODO/FIXME/placeholder UI data stubs in modified production files; test-only empty array/object helpers are local test fixtures, and existing `null` values are runtime config sentinels.

## Threat Flags

None. The Hub-to-CLI session RPC and Hub-to-store persistence trust boundaries were the planned surfaces for T-01-14-01 through T-01-14-04.

## TDD Gate Compliance

- Task 1 RED commit present before implementation: `a7c5324`
- Task 1 GREEN commit present after RED: `6279b4e`
- Task 2 RED commit present before implementation: `eba451e`
- Task 2 GREEN commit present after RED: `0a5aa28`
- No REFACTOR commit needed.

## Verification

- `cd hub && bun test src/sync/sessionConfigService.test.ts src/sync/syncEngineSession.test.ts src/sync/sessionModel.test.ts` - passed, 45 tests.
- `cd cli && bun run test -- runCursor` - passed, 9 tests.
- `bun run typecheck` - passed across CLI, Web, and Hub.
- `bash scripts/check-no-cut-agents.sh` - passed.
- Source assertion: `hub/src/sync/sessionConfigService.ts` no longer persists `effort` or `modelReasoningEffort`.
- Source assertion: `hub/src/sync/syncEngineSession.ts` strips inactive persistence payloads to supported `model` and `permissionMode`.
- Test assertion: active and inactive session-config effort/modelReasoningEffort requests do not update cache or store.
- Test assertion: model set/clear and permissionMode behavior still pass.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Session-config mutation paths are now truthful for unsupported effort. Plan 01-15 can remove the remaining unsupported effort surface from the CLI runner spawn contract without compensating for active or inactive session-config persistence.

## Self-Check: PASSED

- Found `.planning/phases/01-cursor-runtime-config-contract/01-14-SUMMARY.md`.
- Found `cli/src/cursor/runCursor.ts`.
- Found `cli/src/cursor/runCursor.test.ts`.
- Found `hub/src/sync/sessionConfigService.ts`.
- Found `hub/src/sync/sessionConfigService.test.ts`.
- Found `hub/src/sync/syncEngineSession.ts`.
- Found `hub/src/sync/syncEngineSession.test.ts`.
- Found `hub/src/sync/sessionModel.test.ts`.
- Found task commit `a7c5324`.
- Found task commit `6279b4e`.
- Found task commit `eba451e`.
- Found task commit `0a5aa28`.

---

*Phase: 01-cursor-runtime-config-contract*
*Completed: 2026-05-24*
