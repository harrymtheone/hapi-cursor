---
phase: 01-cursor-runtime-config-contract
plan: 05
subsystem: cli-hub-runtime-config
tags: [cursor-runtime, socket-rpc, hono, zod, bun-test, vitest]

requires:
  - phase: 01-cursor-runtime-config-contract
    provides: Shared Cursor runtime config apply-result schema from 01-01
  - phase: 01-cursor-runtime-config-contract
    provides: Cursor runtime discovery and safe selected-runtime launch rejection from 01-02
provides:
  - Truthful CLI set-session-config responses for active model and effort changes
  - Active-session Hub persistence gate for applied and applies-next-run acknowledgements
  - Status-bearing session model route responses
affects: [web-runtime-config, composer-model-status, session-config-api]

tech-stack:
  added: []
  patterns:
    - Shared Zod parsing for CLI runtime config acknowledgements
    - Active sessions persist model metadata only after runtime acknowledgement
    - Inactive sessions store model metadata as applies-next-run state

key-files:
  created:
    - hub/src/sync/syncEngineSession.test.ts
    - .planning/phases/01-cursor-runtime-config-contract/01-05-SUMMARY.md
  modified:
    - cli/src/cursor/runCursor.ts
    - cli/src/cursor/runCursor.test.ts
    - hub/src/sync/syncEngine.ts
    - hub/src/sync/syncEngineSession.ts
    - hub/src/sync/sessionConfigService.ts
    - hub/src/sync/sessionConfigService.test.ts
    - hub/src/web/routes/sessions/config.ts
    - hub/src/web/routes/sessions/__tests__/_fixtures.ts
    - hub/src/web/routes/sessions/__tests__/config.test.ts

key-decisions:
  - "Report active model and effort changes as applies-next-run until HAPI has a proven hot-switch control path."
  - "Keep permission-mode config on the existing legacy applied response path to avoid widening the shared runtime config schema during a high-risk plan."
  - "Let inactive model route requests persist metadata through the same engine path and return applies-next-run status."

patterns-established:
  - "CLI set-session-config validates model/effort payloads before returning shared apply results."
  - "Hub parses CLI apply results with CursorRuntimeConfigApplyResultSchema before persistence."
  - "Failed runtime apply acknowledgements return to callers without mutating stored session model metadata."

requirements-completed: [CURS-03]

duration: 5min
completed: 2026-05-23
---

# Phase 01 Plan 05: Truthful Runtime Config Apply Summary

**Status-bearing Cursor runtime config acknowledgements from CLI RPC through Hub persistence and session model route responses**

## Performance

- **Duration:** 5 min
- **Started:** 2026-05-23T14:58:04Z
- **Completed:** 2026-05-23T15:02:58Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments

- Added CLI `set-session-config` handling that validates runtime config payloads and returns `applies-next-run` for model/effort changes instead of claiming unsupported hot switching.
- Updated Hub active-session config flow to parse shared apply results, persist only `applied` / `applies-next-run` model fields, and skip persistence for `failed`.
- Changed `POST /api/sessions/:id/model` to return the status-bearing apply result for active and inactive sessions instead of `{ ok: true }`.
- Added regression tests for CLI apply results, Hub persistence gating, no empty config emission, inactive next-run metadata, failed no-persist behavior, and safe route errors.

## Task Commits

1. **Task 1 RED: Add CLI runtime config apply tests** - `60afe22` (test)
2. **Task 1 GREEN: Return truthful CLI runtime config status** - `7f673a0` (feat)
3. **Task 2 RED: Add Hub runtime config status tests** - `73e46e1` (test)
4. **Task 2 GREEN: Propagate runtime config apply status** - `c5352e1` (feat)

_Note: Both planned tasks used TDD test and implementation commits._

## Files Created/Modified

- `cli/src/cursor/runCursor.ts` - Validates session config RPC payloads and returns shared apply results for model/effort requests.
- `cli/src/cursor/runCursor.test.ts` - Covers permission-mode applied behavior, applies-next-run model status, invalid payload failure, and no timeline event side effects.
- `hub/src/sync/syncEngineSession.ts` - Parses active CLI acknowledgements and gates persistence on `applied` / `applies-next-run`.
- `hub/src/sync/syncEngine.ts` - Returns the apply result from the session facade.
- `hub/src/sync/sessionConfigService.ts` - Skips no-op empty config emissions while preserving field-specific persistence.
- `hub/src/sync/sessionConfigService.test.ts` - Covers model/effort persistence and empty-config no-op behavior.
- `hub/src/sync/syncEngineSession.test.ts` - Covers active applies-next-run persistence and failed no-persist behavior.
- `hub/src/web/routes/sessions/config.ts` - Returns model apply results and allows inactive next-run metadata updates.
- `hub/src/web/routes/sessions/__tests__/_fixtures.ts` - Supports status-bearing apply result fixtures.
- `hub/src/web/routes/sessions/__tests__/config.test.ts` - Covers active, inactive, failed, and rejected model route outcomes.

## Decisions Made

- Model and effort updates return `applies-next-run` because no proven local hot-switch control path exists in the edited code.
- The shared apply-result schema was not widened for permission mode. A file-level GitNexus check on `shared/src/schemas.ts` reported CRITICAL risk, so permission mode remains on the existing legacy `{ applied: { permissionMode } }` path while model/effort uses the shared status contract.
- The model route uses `withSession()` instead of `withActiveSession()` so inactive sessions can store requested metadata as applies-next-run state.

## GitNexus Impact

- `runCursor`: LOW risk, 0 direct callers, 0 affected processes.
- `CursorSession`: MEDIUM risk, 10 direct callers/importers, affected processes `runCursor` and `runMainLoop`; no `CursorSession.model` mutation was added.
- `SyncEngineSession.applySessionConfig`: LOW risk, 1 direct caller, affected module `Sync`.
- `SessionConfigService.applySessionConfig`: LOW risk, 1 direct caller, affected module `Sync`.
- `createConfigRoutes`: LOW risk, 1 direct caller, affected processes `createSessionsRoutes` and `createWebApp`.
- `shared/src/schemas.ts`: CRITICAL file-level risk, 20 direct importers; no shared schema edit was made.
- Pre-commit `detect_changes`: Task 1 implementation MEDIUM risk across `runCursor` flows; Task 2 implementation MEDIUM risk across session config persistence flows.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Preserved permission-mode compatibility without schema widening**
- **Found during:** Task 1 GREEN
- **Issue:** The plan required permission-mode changes to remain applied, but the existing shared runtime config apply schema does not include `permissionMode`.
- **Fix:** Kept permission-mode-only RPC responses on the existing legacy applied shape and used shared status results only for model/effort requests.
- **Files modified:** `cli/src/cursor/runCursor.ts`, `hub/src/sync/syncEngineSession.ts`
- **Verification:** `cd cli && bun run test -- runCursor`; Hub config tests; `bun run typecheck`
- **Committed in:** `7f673a0`, `c5352e1`

**2. [Rule 1 - Bug] Avoided session-updated events for empty config writes**
- **Found during:** Task 2 RED
- **Issue:** `SessionConfigService.applySessionConfig(sessionId, {})` emitted `session-updated` even when no fields were applied.
- **Fix:** Added an early no-op return when no supported config fields are present.
- **Files modified:** `hub/src/sync/sessionConfigService.ts`
- **Verification:** `cd hub && bun test src/sync/sessionConfigService.test.ts src/sync/syncEngineSession.test.ts src/web/routes/sessions/__tests__/config.test.ts`
- **Committed in:** `c5352e1`

---

**Total deviations:** 2 auto-fixed (1 missing critical functionality, 1 bug)
**Impact on plan:** Both fixes preserve the runtime acknowledgement invariant without expanding scope or altering completed Plan 01-01/01-02 behavior.

## Issues Encountered

- `rg` was unavailable in the shell environment, so checkpoint and stub scans used the Cursor ripgrep tool instead.
- GitNexus could not resolve `CursorRuntimeConfigApplyResultSchema` directly; a file-level schema impact check was used and came back CRITICAL, so shared schema edits were avoided.

## Known Stubs

None. Stub-pattern scan only found intentional nullable fields and empty test arrays.

## Threat Flags

None. The model route, active CLI RPC boundary, and SSE update path were all planned threat-model surfaces for this plan.

## TDD Gate Compliance

- RED commits present before implementation: `60afe22`, `73e46e1`
- GREEN commits present after RED: `7f673a0`, `c5352e1`

## Verification

- `cd cli && bun run test -- runCursor` - passed, 7 tests.
- `cd hub && bun test src/sync/sessionConfigService.test.ts src/sync/syncEngineSession.test.ts src/web/routes/sessions/__tests__/config.test.ts` - passed, 18 tests.
- `bun run typecheck` - passed across CLI, Web, and Hub.
- `bash scripts/check-no-cut-agents.sh` - passed.
- Source assertion: `cli/src/cursor/runCursor.ts` imports and validates with `CursorRuntimeConfigApplyResultSchema`.
- Source assertion: `hub/src/web/routes/sessions/config.ts` returns the model apply result instead of `{ ok: true }`.
- Source assertion: failed apply results in `hub/src/sync/syncEngineSession.ts` do not call `SessionConfigService.applySessionConfig`.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Web API and composer work can now consume status-bearing model route responses without inventing optimistic applied state. The current backend truth remains applies-next-run for model/effort changes until a future plan proves a true hot-switch control path.

## Self-Check: PASSED

- Found `.planning/phases/01-cursor-runtime-config-contract/01-05-SUMMARY.md`.
- Found `cli/src/cursor/runCursor.ts`.
- Found `cli/src/cursor/runCursor.test.ts`.
- Found `hub/src/sync/syncEngine.ts`.
- Found `hub/src/sync/syncEngineSession.ts`.
- Found `hub/src/sync/syncEngineSession.test.ts`.
- Found `hub/src/sync/sessionConfigService.ts`.
- Found `hub/src/sync/sessionConfigService.test.ts`.
- Found `hub/src/web/routes/sessions/config.ts`.
- Found `hub/src/web/routes/sessions/__tests__/_fixtures.ts`.
- Found `hub/src/web/routes/sessions/__tests__/config.test.ts`.
- Found task commit `60afe22`.
- Found task commit `7f673a0`.
- Found task commit `73e46e1`.
- Found task commit `c5352e1`.

---

*Phase: 01-cursor-runtime-config-contract*
*Completed: 2026-05-23*
