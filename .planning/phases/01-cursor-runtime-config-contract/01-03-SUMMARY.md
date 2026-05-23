---
phase: 01-cursor-runtime-config-contract
plan: 03
subsystem: hub-web-runtime-discovery
tags: [hono, react, vitest, bun-test, cursor-runtime, socket-rpc]

requires:
  - phase: 01-cursor-runtime-config-contract
    provides: Shared Cursor model discovery result schema from 01-01
  - phase: 01-cursor-runtime-config-contract
    provides: Machine-scoped CLI discovery RPC and safe runtime rejection code from 01-02
provides:
  - Authenticated Hub route for machine-scoped Cursor model discovery
  - SyncEngine and RpcGateway bridge to `discover-cursor-models`
  - Web API client method and short-cache `useCursorModels` hook
  - Safe selected runtime config rejection propagation through Web spawn responses
affects: [new-session-model-selector, web-runtime-config, hub-machine-rpc]

tech-stack:
  added: []
  patterns:
    - Schema-validated machine RPC responses with shared Zod contracts
    - Web hook cache keyed by machine id with retry bypass
    - Safe request error sanitization before UI state

key-files:
  created:
    - web/src/hooks/useCursorModels.ts
    - web/src/hooks/useCursorModels.test.tsx
    - .planning/phases/01-cursor-runtime-config-contract/01-03-SUMMARY.md
  modified:
    - hub/src/sync/rpcGateway.ts
    - hub/src/sync/syncEngineRpc.ts
    - hub/src/sync/syncEngine.ts
    - hub/src/web/routes/machines.ts
    - hub/src/web/routes/machines.test.ts
    - shared/src/responses.ts
    - web/src/api/client.ts
    - web/src/types/api.ts

key-decisions:
  - "Keep model discovery behind the existing authenticated machine route and online-machine guard rather than adding any direct shell path to Hub."
  - "Parse machine RPC discovery results with `CursorModelDiscoveryResultSchema` at the Hub boundary and pass normal safe discovery errors through as HTTP 200 data."
  - "Cache both successful and safe error discovery results for 30000ms per machine id, while sanitizing rejected HTTP/request failures to a generic hook error."

patterns-established:
  - "Hub machine-scoped runtime metadata routes should delegate through `SyncEngine` and `RpcGateway` and validate shared protocol results before returning."
  - "Web runtime discovery hooks expose `result`, `isLoading`, `error`, `retry`, and `lastFetchedAt`, with `enabled` controlling whether network requests occur."

requirements-completed: [CURS-01]

duration: 6min
completed: 2026-05-23
---

# Phase 01 Plan 03: Hub and Web Model Discovery Summary

**Authenticated machine-scoped Cursor model discovery from Web through Hub to the local runner, with safe error preservation and a 30-second Web cache**

## Performance

- **Duration:** 6 min
- **Started:** 2026-05-23T15:05:25Z
- **Completed:** 2026-05-23T15:10:51Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments

- Added `GET /api/machines/:id/cursor/models`, requiring an existing online machine and delegating discovery through `SyncEngine` and `RpcGateway`.
- Added `RpcGateway.discoverCursorModels()` using `machineRpc(machineId, 'discover-cursor-models', {})` and `CursorModelDiscoveryResultSchema` validation.
- Preserved safe CLI spawn rejection codes such as `selected-runtime-config-rejected` through Hub and shared Web response typing.
- Added `ApiClient.getCursorModels()` and `useCursorModels()` with a 30000ms machine-keyed cache, retry bypass, disabled state, safe discovery error handling, and sanitized rejected-request errors.

## Task Commits

1. **Task 1 RED: Add Hub discovery route tests** - `ec143e8` (test)
2. **Task 1 GREEN: Expose Hub Cursor model discovery** - `53c8814` (feat)
3. **Task 2 RED: Add Web hook tests** - `ea58072` (test)
4. **Task 2 GREEN: Add Web discovery hook** - `a19c37d` (feat)
5. **Guard fix: Keep SyncEngine under file-size guard** - `e05e4b2` (fix)

_Note: Both planned tasks used TDD test and implementation commits._

## Files Created/Modified

- `hub/src/web/routes/machines.ts` - Adds the authenticated online-machine discovery route.
- `hub/src/web/routes/machines.test.ts` - Covers discovery success, safe discovery error data, missing/offline machines, invalid transport failure, and selected runtime rejection code preservation.
- `hub/src/sync/rpcGateway.ts` - Adds schema-validated machine RPC discovery and preserves safe spawn error codes.
- `hub/src/sync/syncEngineRpc.ts` - Adds the RPC facade delegate for discovery.
- `hub/src/sync/syncEngine.ts` - Adds the public discovery delegate and trims stale header comments to preserve file-size guards.
- `shared/src/responses.ts` - Allows Web spawn error responses to include the safe selected-runtime rejection code.
- `web/src/api/client.ts` - Adds `getCursorModels(machineId)`.
- `web/src/types/api.ts` - Re-exports `CursorModelDiscoveryResult` for Web API typing.
- `web/src/hooks/useCursorModels.ts` - Adds the short-cache discovery hook.
- `web/src/hooks/useCursorModels.test.tsx` - Covers cache, retry, disabled, safe error result, and sanitized rejected-request behavior.

## Decisions Made

- Kept safe `{ status: 'error', reason, discoveredAt }` discovery results as normal response data instead of converting them to HTTP failures. This preserves D-03 and lets Web localize selector states.
- Treated offline machines as a 409 route-level guard before discovery so Hub does not attempt machine RPC against an inactive runner.
- Sanitized rejected Web API calls to `Failed to discover Cursor models` in hook state so raw transport or runtime details do not flow to UI state.

## GitNexus Impact

- `RpcGateway`: MEDIUM risk, 7 direct dependents, 1 affected process, Sync module affected.
- `RpcGateway.spawnSession`: LOW risk, 2 direct callers, affected `resumeSession` process.
- `SyncEngineMachine`: HIGH risk, 7 direct dependents, 3 affected processes. No edits were made to this class.
- `SyncEngineRpc`: HIGH risk, 21 direct dependents through the facade. Edited additively with targeted Hub/Web tests and typecheck.
- `SyncEngine`: CRITICAL risk, 34 direct importers. Edited additively with a public delegate plus non-runtime comment trim; final `detect_changes` reported medium risk centered on `AppInner -> ApiClient` and `ResumeSession -> GetSocketIdForMethod`.
- `createMachinesRoutes`: LOW risk, 1 direct caller, 2 affected processes.
- `ApiClient`: CRITICAL risk, 46 direct dependents, 1 affected Web process. Edited additively with targeted hook tests and typecheck.
- `getCursorModels` and `useCursorModels`: UNKNOWN before creation because the symbols did not exist.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Reworked Web hook test clock control**
- **Found during:** Task 2 GREEN
- **Issue:** `vi.useFakeTimers()` stalled Testing Library `waitFor()` in the new hook tests, causing deterministic behavior tests to time out.
- **Fix:** Replaced fake timers with a `Date.now()` spy so cache timestamps remain deterministic while React updates use real timers.
- **Files modified:** `web/src/hooks/useCursorModels.test.tsx`
- **Verification:** `cd web && bun run test -- useCursorModels`
- **Committed in:** `a19c37d`

**2. [Rule 3 - Blocking] Restored Phase 8 file-size guard**
- **Found during:** Final verification
- **Issue:** Adding a `SyncEngine` delegate pushed `hub/src/sync/syncEngine.ts` over the guarded 400-line budget.
- **Fix:** Removed stale non-runtime header comments from `syncEngine.ts`, bringing the file back under the guard without changing behavior.
- **Files modified:** `hub/src/sync/syncEngine.ts`
- **Verification:** `bash scripts/check-no-cut-agents.sh`; `bun run typecheck`
- **Committed in:** `e05e4b2`

---

**Total deviations:** 2 auto-fixed (2 blocking issues)
**Impact on plan:** Both fixes were required for verification stability. No external packages, direct shell discovery, or architecture changes were introduced.

## Issues Encountered

- GitNexus returned HIGH/CRITICAL risk for the existing facades because they are widely imported. The implementation stayed additive, avoided editing `SyncEngineMachine`, and used targeted tests plus root typecheck.
- The repo guard caught the `SyncEngine` file-size budget after implementation; the final guard passed after the non-runtime trim.

## Known Stubs

None. Stub-pattern scan found only intentional empty defaults in tests and object initialization in RPC code.

## Threat Flags

None. The new Web-to-Hub route and Hub-to-CLI machine RPC surfaces match the plan threat model T-01-07 through T-01-09.

## TDD Gate Compliance

- RED commits present before implementation: `ec143e8`, `ea58072`
- GREEN commits present after RED: `53c8814`, `a19c37d`

## Verification

- `cd hub && bun test src/web/routes/machines.test.ts` - passed, 6 tests.
- `cd web && bun run test -- useCursorModels` - passed, 5 tests.
- `bun run typecheck` - passed across CLI, Web, and Hub.
- `bash scripts/check-no-cut-agents.sh` - passed after guard fix.
- Source assertion: `hub/src/web/routes/machines.ts` contains `/machines/:id/cursor/models`.
- Source assertion: Hub discovery uses `machineRpc(machineId, 'discover-cursor-models', {})` and no Hub model discovery code imports `node:child_process`.
- Source assertion: `web/src/hooks/useCursorModels.ts` has `CURSOR_MODELS_CACHE_TTL_MS = 30000` and respects the `enabled` parameter.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

The new-session UI can now call a safe Web hook to discover Cursor model ids from the selected online runner machine. Downstream selector UI work can render loading, safe discovery failure, retry, and auto/unspecified states without inventing a static model catalog.

## Self-Check: PASSED

- Found `.planning/phases/01-cursor-runtime-config-contract/01-03-SUMMARY.md`.
- Found `web/src/hooks/useCursorModels.ts`.
- Found `web/src/hooks/useCursorModels.test.tsx`.
- Found `hub/src/web/routes/machines.ts`.
- Found `hub/src/sync/rpcGateway.ts`.
- Found `web/src/api/client.ts`.
- Found task commit `ec143e8`.
- Found task commit `53c8814`.
- Found task commit `ea58072`.
- Found task commit `a19c37d`.
- Found guard fix commit `e05e4b2`.

---

*Phase: 01-cursor-runtime-config-contract*
*Completed: 2026-05-23*
