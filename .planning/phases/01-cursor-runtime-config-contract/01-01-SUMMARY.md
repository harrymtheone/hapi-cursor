---
phase: 01-cursor-runtime-config-contract
plan: 01
subsystem: shared-protocol
tags: [zod, typescript, protocol, cursor-runtime, bun-test]

requires: []
provides:
  - Shared Cursor model discovery result schema
  - Shared Cursor runtime config apply-result schema
  - Protocol type exports for downstream CLI, Hub, and Web plans
affects: [cli-runtime-config, hub-runtime-config, web-runtime-config, session-patches]

tech-stack:
  added: []
  patterns:
    - Strict Zod discriminated unions for runtime status contracts
    - Enumerated safe failure reasons for UI-facing runtime errors

key-files:
  created:
    - .planning/phases/01-cursor-runtime-config-contract/01-01-SUMMARY.md
  modified:
    - shared/src/schemas.ts
    - shared/src/types.ts
    - shared/src/schemas.test.ts

key-decisions:
  - "Use the same safe reason enum for model discovery and runtime config apply failures so raw stderr cannot enter normal UI contracts."
  - "Keep model ids as unconstrained non-empty strings so Cursor runtime ids remain primary values and no static model catalog is introduced."

patterns-established:
  - "Cursor runtime result contracts use strict status discriminators and nullable runtime fields."
  - "Protocol regressions live in shared/src/schemas.test.ts under Bun test."

requirements-completed: [CURS-01, CURS-03, CURS-04]

duration: 2min
completed: 2026-05-23
---

# Phase 01 Plan 01: Cursor Runtime Config Contract Summary

**Shared Zod protocol contract for Cursor model discovery and truthful runtime config apply results, with strict patch regression coverage**

## Performance

- **Duration:** 2 min
- **Started:** 2026-05-23T14:47:00Z
- **Completed:** 2026-05-23T14:48:50Z
- **Tasks:** 1
- **Files modified:** 3

## Accomplishments

- Added `CursorModelSummarySchema`, `CursorModelDiscoveryResultSchema`, and `CursorRuntimeConfigApplyResultSchema` in `shared/src/schemas.ts`.
- Exported `CursorModelSummary`, `CursorModelDiscoveryResult`, and `CursorRuntimeConfigApplyResult` through `shared/src/types.ts`.
- Added contract tests covering discovery success/error, all four apply statuses, safe reason rejection, and existing strict `SessionPatchSchema` behavior.

## Task Commits

1. **Task 1 RED: Add Cursor runtime contract tests** - `2247e5b` (test)
2. **Task 1 GREEN: Add Cursor runtime contract schemas and types** - `de38d31` (feat)

_Note: TDD gate used separate test and implementation commits._

## Files Created/Modified

- `shared/src/schemas.ts` - Defines strict Cursor model discovery and runtime config apply-result schemas.
- `shared/src/types.ts` - Re-exports inferred runtime config contract types for `@hapi/protocol` consumers.
- `shared/src/schemas.test.ts` - Covers the new protocol contracts and strict session patch rejection.
- `.planning/phases/01-cursor-runtime-config-contract/01-01-SUMMARY.md` - Records plan execution results.

## Decisions Made

- Used enumerated safe failure reasons for both discovery and apply results. This satisfies D-03 and keeps raw CLI stderr out of normal UI payloads.
- Kept Cursor model ids as non-empty strings instead of enumerating known ids. This satisfies D-01 and D-04 by preserving runtime-owned raw ids without a fallback catalog.
- Kept apply-result state as a strict status union with nullable `model`, `modelReasoningEffort`, and `effort` fields. This satisfies D-10 and gives downstream plans one truthful contract for applied, pending, failed, and applies-next-run states.

## GitNexus Impact

- `SessionPatchSchema`: LOW risk, 0 direct callers, 0 affected processes.
- `SyncEventSchema`: LOW risk, 0 direct callers, 0 affected processes.
- `SessionSchema`: LOW risk, 0 direct callers, 0 affected processes.
- Pre-commit `detect_changes`: LOW risk, 0 affected processes for both RED and GREEN commits.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- The first combined verification command ran `bun run typecheck` from `shared/`, where no package-local script exists. Re-ran `bun run typecheck` from the repository root successfully.

## Known Stubs

None.

## Threat Flags

None.

## Verification

- `cd shared && bun test schemas.test.ts` - passed, 35 tests.
- `bun run typecheck` - passed across CLI, Web, and Hub.
- `bash scripts/check-no-cut-agents.sh` - passed.
- Source assertion: `shared/src/schemas.ts` exports `CursorModelDiscoveryResultSchema` and `CursorRuntimeConfigApplyResultSchema`.
- Source assertion: `shared/src/types.ts` exports `CursorModelDiscoveryResult` and `CursorRuntimeConfigApplyResult`.
- Source assertion: no `sonnet`, `opus`, `gpt`, or `composer` literals in `shared/src/schemas.ts`.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Downstream CLI, Hub, and Web plans can import the shared runtime config contracts instead of inventing separate model discovery or apply-result shapes.

## Self-Check: PASSED

- Found `.planning/phases/01-cursor-runtime-config-contract/01-01-SUMMARY.md`.
- Found `shared/src/schemas.ts`.
- Found `shared/src/types.ts`.
- Found `shared/src/schemas.test.ts`.
- Found task commit `2247e5b`.
- Found task commit `de38d31`.

---

*Phase: 01-cursor-runtime-config-contract*
*Completed: 2026-05-23*
