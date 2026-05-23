---
phase: 07-wire-contracts-unification-sse-patch-contract
plan: 04
subsystem: guard-script
tags: [guard-script, ripgrep, phase-gate, verification, wire-contracts]
requires:
  - phase: 07-wire-contracts-unification-sse-patch-contract
    provides: "07-01 shared schema lift, 07-02 hub broadcast conformance, 07-03 cli/web/useSSE collapse"
provides:
  - "D-124 retired AGENT_MESSAGE_PAYLOAD_TYPE='codex' whitelist removal"
  - "D-126 Phase-7 wire-contract sweep block in scripts/check-no-cut-agents.sh"
  - "Full Phase 7 gate proof for REFA-03 and REFA-04"
affects: [phase-07, guard-script, wire-contracts, sse-contract]
tech-stack:
  added: []
  patterns:
    - "fail-closed ripgrep guard blocks with narrow post-filters"
    - "shared wire-contract zero-tolerance source sweep"
key-files:
  created:
    - .planning/phases/07-wire-contracts-unification-sse-patch-contract/07-04-SUMMARY.md
  modified:
    - scripts/check-no-cut-agents.sh
    - hub/src/sync/aliveEvents.test.ts
    - hub/src/sync/sessionModel.test.ts
    - hub/src/web/routes/sessions.test.ts
    - hub/src/push/pushNotificationChannel.test.ts
key-decisions:
  - "Phase-7 guard checks target actual declarations/usages while preserving legitimate top-level resume-target flavor."
  - "Hub metadata.flavor test fixtures were stripped so the new metadata.flavor sweep enforces the completed contract surface."
patterns-established:
  - "Guard extensions should prefer declaration-shaped ripgrep patterns over broad symbol hits when re-exports/import usages are legitimate."
requirements-completed: [REFA-03, REFA-04]
duration: 5min 24s
completed: 2026-05-22
---

# Phase 07 Plan 04: Wire Contract Guard Closure Summary

**Phase 7 wire-contract invariants are now enforced by the source guard: no retired `codex` exception, no `useSSE` heuristic reintroduction, no duplicate wire declarations, and no metadata flavor writes.**

## Performance

- **Duration:** 5min 24s
- **Started:** 2026-05-22T14:24:10Z
- **Completed:** 2026-05-22T14:29:34Z
- **Tasks:** 3 completed
- **Files modified:** 6

## Accomplishments

- Removed the D-124 `AGENT_MESSAGE_PAYLOAD_TYPE='codex'` line-anchored post-filter and rewrote the Phase-5 guard text so `'codex'` is no longer an allowed runtime-source survivor.
- Appended a 70-line Phase-7 D-126 sweep block to `scripts/check-no-cut-agents.sh` covering the six REFA-03/REFA-04 invariants.
- Stripped leftover hub test metadata `flavor: 'cursor'` fixtures caught by the new guard while preserving legitimate top-level resume-target `flavor`.
- Proved Phase 7 closure with `bun typecheck && bun run test && bash scripts/check-no-cut-agents.sh`.

## Task Commits

Each implementation task was committed atomically:

1. **Task 1: Delete D-124 retirements** - `d13a8df` (`refactor`)
2. **Task 2: Append Phase-7 D-126 sweeps** - `bb68f8d` (`feat`)
3. **Task 3: Phase 7 final gate** - no code commit; verification-only task

## Files Created/Modified

- `scripts/check-no-cut-agents.sh` - Removed the legacy codex wire-literal exception and added the Phase-7 D-126 source sweeps.
- `hub/src/sync/aliveEvents.test.ts` - Removed obsolete metadata flavor fixture fields.
- `hub/src/sync/sessionModel.test.ts` - Removed obsolete metadata flavor fixture fields and relaxed one resume-target equality to allow the legitimate top-level flavor.
- `hub/src/web/routes/sessions.test.ts` - Removed obsolete metadata flavor fixture field.
- `hub/src/push/pushNotificationChannel.test.ts` - Removed obsolete metadata flavor fixture field.

## Line-Range Surgery

- D-124 deletion: `scripts/check-no-cut-agents.sh` changed by 8 insertions / 12 deletions in `d13a8df`, removing `SURVIVORS_FILTERED` and all "wire literal exception" messaging.
- D-126 append: `scripts/check-no-cut-agents.sh` gained a 70-line Phase-7 block after the Phase-6 block in `bb68f8d`.
- New block checks: `hasUnknownSessionPatchKeys`, `getSessionPatch`, duplicate `Machine` declarations, duplicate `RunnerStateSchema` / `MachineMetadataSchema` declarations, quoted `'codex'` literals, and metadata flavor writes.

## Verification

- `bash scripts/check-no-cut-agents.sh` passed after Task 1.
- `bash scripts/check-no-cut-agents.sh` passed after Task 2.
- Impacted hub tests passed after the fixture cleanup: 50 passed / 0 failed across `aliveEvents`, `sessionModel`, route, and push notification tests.
- Full phase gate passed: `bun typecheck && bun run test && bash scripts/check-no-cut-agents.sh`.
- Test counts after the final gate:
  - CLI: 237 passed, 12 skipped
  - Hub: 155 passed
  - Web: 541 passed
- 07-03 baseline was CLI 237 / Hub 155 / Web 541, so the final gate maintained the completed slice-3 suite size.
- Smoking-gun regression guard passed: `session-updated patch with only backgroundTaskCount mutates summary without invalidate (Phase 7 REFA-04 regression guard)`.

### Final Guard Stdout

```text
✅ No non-Cursor agent literals outside whitelist.
✅ No Phase-3 namespace residue in source scope.
✅ No Phase-4 deployment-infrastructure / remote-log residue outside whitelist.
✅ No Phase-5 legacy flavor identifiers in source scope.
✅ No non-cursor flavor === '<literal>' branches in source scope.
✅ No Phase-6 duplicate permissionModeToAgentArgs in source scope.
✅ No Phase-6 'permissionMode as string' casts in launcher files.
✅ permissionModeToCursorArgs defined only in cli/src/agent/modeConfig.ts.
✅ No circular dependencies in cli/src/cursor (madge).
✅ Phase-6 SC#1 concept tags present (count=4).
✅ No Phase-7 hasUnknownSessionPatchKeys residue in source scope.
✅ No Phase-7 getSessionPatch residue in web hooks.
✅ No duplicate Phase-7 Machine declarations outside shared/.
✅ No duplicate Phase-7 RunnerState/MachineMetadata schema declarations outside shared/.
✅ No Phase-7 'codex' literals in source scope.
✅ Phase-7 wire-contract sweeps clean (D-126).
```

## Phase 7 Success Criteria Evidence

- **SC#1 / REFA-03:** `bash scripts/check-no-cut-agents.sh` passed duplicate `Machine`, `RunnerStateSchema`, and `MachineMetadataSchema` sweeps; independent `rg` checks for duplicate declarations returned zero source hits.
- **SC#2 / REFA-04:** `hasUnknownSessionPatchKeys` returned zero source hits and the background-task SSE regression test passed.
- **SC#3 / canonical SSE consumer:** `getSessionPatch` returned zero hits under `web/src/hooks/`; malformed-event tests passed without invalidation.
- **SC#4 / full gate:** `bun typecheck && bun run test && bash scripts/check-no-cut-agents.sh` exited 0.

## Decisions Made

- The RunnerState/MachineMetadata guard matches declaration shapes, not every legitimate schema import/use. This enforces the single-source contract without breaking consumers that parse with the shared schemas.
- The metadata flavor guard keeps top-level resume-target flavor via narrow post-filters because `LocalResumeTarget` / `ResumableSession` still carry `flavor: 'cursor'` by design; only metadata flavor was deleted.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Removed hub metadata flavor test fixture residue**
- **Found during:** Task 2 (Append Phase-7 D-126 sweeps)
- **Issue:** The new metadata flavor sweep exposed leftover `flavor: 'cursor'` fields in hub test metadata fixtures. Leaving them would make `bash scripts/check-no-cut-agents.sh` fail immediately.
- **Fix:** Removed obsolete metadata flavor fixture fields from hub sync, route, and push tests. Kept legitimate top-level resume-target flavor and adjusted one equality assertion to `expect.objectContaining(...)` so it does not encode the deleted metadata field.
- **Files modified:** `hub/src/sync/aliveEvents.test.ts`, `hub/src/sync/sessionModel.test.ts`, `hub/src/web/routes/sessions.test.ts`, `hub/src/push/pushNotificationChannel.test.ts`
- **Verification:** `bash scripts/check-no-cut-agents.sh`; `cd hub && bun test src/sync/aliveEvents.test.ts src/sync/sessionModel.test.ts src/web/routes/cli.test.ts src/web/routes/sessions.test.ts src/push/pushNotificationChannel.test.ts`
- **Committed in:** `bb68f8d`

---

**Total deviations:** 1 auto-fixed (Rule 3)  
**Impact on plan:** The fix tightened the intended guard scope and removed old contract residue. No production behavior changed.

## Issues Encountered

None. Full phase verification passed.

## Known Stubs

None.

## Threat Flags

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Phase 7 is complete. REFA-03 and REFA-04 are closed and enforced by CI guard checks. The project is ready for `/gsd:verify-work` and then Phase 8 planning/execution.

## Self-Check: PASSED

- FOUND: `.planning/phases/07-wire-contracts-unification-sse-patch-contract/07-04-SUMMARY.md`
- FOUND: `scripts/check-no-cut-agents.sh`
- FOUND: task commit `d13a8df`
- FOUND: task commit `bb68f8d`
- VERIFIED: `bun typecheck && bun run test && bash scripts/check-no-cut-agents.sh` exits 0

---
*Phase: 07-wire-contracts-unification-sse-patch-contract*  
*Completed: 2026-05-22*
