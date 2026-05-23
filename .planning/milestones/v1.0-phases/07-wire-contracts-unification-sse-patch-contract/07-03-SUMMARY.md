---
phase: 07-wire-contracts-unification-sse-patch-contract
plan: 03
subsystem: wire-contracts
tags: [cli, web, useSSE, type-collapse, sse-rewrite, zod, vitest]
requires:
  - phase: 07-01
    provides: shared Machine/Session/message schemas and strict SyncEventSchema
  - phase: 07-02
    provides: hub broadcast conformance proof for strict SyncEventSchema
provides:
  - cli and web wire mirrors collapsed onto @hapi/protocol schemas/types
  - cli writer-side flavor plumbing removed from session bootstrap/model APIs
  - useSSE strict SyncEventSchema.safeParse consumer with no refetch fallback queue
  - MockEventSource regression coverage for typed SSE union branches
affects: [phase-07, web-sse, cli-api-types, shared-session-summary]
tech-stack:
  added: []
  patterns:
    - shared wire contracts via @hapi/protocol re-exports
    - SSE runtime validation with SyncEventSchema.safeParse
    - cache mutation only for schema-accepted SSE patches
key-files:
  created:
    - web/src/hooks/useSSE.test.tsx
  modified:
    - cli/src/api/types.ts
    - cli/src/agent/sessionFactory.ts
    - cli/src/agent/types.ts
    - cli/src/cursor/runCursor.ts
    - shared/src/sessionSummary.ts
    - web/src/types/api.ts
    - web/src/hooks/useSSE.ts
    - web/src/components/SessionList.tsx
key-decisions:
  - "useSSE drops malformed SSE events after SyncEventSchema.safeParse failure; it no longer invalidates or refetches as a fallback."
  - "SessionList renders no agent flavor badge after deleting FlavorIcon/FLAVOR_BADGES, because the UI is Cursor-only."
  - "SessionSummary now includes backgroundTaskCount so the strict patch path can update session-list cache without invalidation."
patterns-established:
  - "Thin API type shells: cli/web local API type files should re-export shared wire contracts rather than mirror Zod/type shapes."
  - "Strict SSE ingestion: parse JSON, safeParse SyncEventSchema, then branch on the typed discriminator."
requirements-completed: [REFA-03, REFA-04]
duration: 11min
completed: 2026-05-22
---

# Phase 07 Plan 03: Wire Contracts Unification SSE Patch Contract Summary

**CLI and web wire mirrors now consume shared protocol schemas, while web SSE processing accepts only canonical SyncEventSchema events and mutates cache without malformed-event refetch fallbacks.**

## Performance

- **Duration:** 11min
- **Started:** 2026-05-22T14:11:00Z
- **Completed:** 2026-05-22T14:22:00Z
- **Tasks:** 7 completed
- **Files modified:** 25

## Accomplishments

- Collapsed `cli/src/api/types.ts` and `web/src/types/api.ts` onto `@hapi/protocol` schemas/types, removing local mirrors for machine, runner, message, response, and session-summary metadata contracts.
- Removed remaining CLI writer-side `flavor` plumbing from session bootstrap options, `runCursor` call sites, and `AgentBackend.setModel`.
- Rewrote `web/src/hooks/useSSE.ts` around `SyncEventSchema.safeParse`, deleting the seven hand-rolled narrowers and the invalidation queue/fallback-to-refetch path.
- Added `web/src/hooks/useSSE.test.tsx` with MockEventSource coverage for full session/machine payloads, patch payloads, null/removal payloads, and malformed event drops.
- Deleted `FlavorIcon` and `FLAVOR_BADGES` from `SessionList`; the row now renders without an agent flavor badge.

## Task Commits

Each implementation task was committed atomically:

1. **Task 1: Collapse CLI API wire mirrors** - `54d7c98` (`refactor`)
2. **Task 2: Remove CLI flavor bootstrap plumbing** - `ec49019` (`refactor`)
3. **Task 3: Collapse web API wire mirrors** - `47577fd` (`refactor`)
4. **Task 4: Consume canonical SSE event schema** - `e668f83` (`refactor`)
5. **Task 5: Add useSSE strict event tests** - `63a0fe8` (`test`)
6. **Task 6: Remove SessionList flavor icon** - `ffe40f5` (`refactor`)
7. **Task 7: Slice 3 gate** - no code commit; verification-only task

**Plan metadata:** captured in the final docs commit for this summary and GSD tracking update.

## Files Created/Modified

- `web/src/hooks/useSSE.test.tsx` - New Vitest + MockEventSource contract tests for typed SSE event handling.
- `web/src/hooks/useSSE.ts` - Strict `SyncEventSchema.safeParse` ingestion and typed discriminator branches; no local narrowers or invalidation queue.
- `shared/src/sessionSummary.ts` - Adds `backgroundTaskCount` to shared session summaries so patch-only SSE events update list cache directly.
- `cli/src/api/types.ts` - Re-exports shared wire schemas/types and narrows create/get response wrappers with `SessionSchema`/`MachineSchema`.
- `web/src/types/api.ts` - Re-exports shared API response and wire types; local web mirror types removed.
- `cli/src/agent/sessionFactory.ts`, `cli/src/cursor/runCursor.ts`, `cli/src/agent/types.ts` - Remaining CLI flavor option plumbing removed.
- `web/src/components/SessionList.tsx` - Flavor badge UI deleted.

## Decisions Made

- Used no icon in `SessionList` after deleting `FlavorIcon`, rather than adding another fixed Cursor badge, because the current product surface is already Cursor-only.
- Added `backgroundTaskCount` to `SessionSummary` instead of treating it as detail-only state; this lets the list cache observe the hub's strict single-field background-task patches without invalidation.
- Kept malformed SSE handling fail-closed and local: malformed schema events log `"[useSSE] dropped malformed event"` and are ignored with no cache mutation or query invalidation.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Updated dependent test fixtures for shared `SessionSummary` shape**
- **Found during:** Task 5 (useSSE strict event tests)
- **Issue:** Adding `backgroundTaskCount` to the canonical shared `SessionSummary` exposed two existing SessionList test factories that returned incomplete summaries.
- **Fix:** Added `backgroundTaskCount: 0` to those factories.
- **Files modified:** `web/src/components/SessionList.test.ts`, `web/src/components/SessionList.directory-action.test.tsx`
- **Verification:** `cd web && bun run typecheck && bun run test src/hooks/useSSE.test.tsx` and full workspace gate passed.
- **Committed in:** `63a0fe8`

**Total deviations:** 1 auto-fixed (Rule 3)
**Impact on plan:** Required to make the new shared summary contract type-safe; no scope expansion beyond the SSE patch contract.

## Issues Encountered

- `cd web && bun test src/hooks/useSSE.test.tsx` used Bun's built-in runner and failed because jsdom setup is provided by Vitest config. Running through `bun run test src/hooks/useSSE.test.tsx` used the repository's Vitest environment and passed.
- One initial table-driven test dispatched to the first MockEventSource instance instead of the latest instance. The helper now selects the active latest source, and all 10 SSE tests pass.

## Verification

- `cd cli && bun typecheck && bun run test` passed during CLI tasks.
- `cd web && bun run typecheck` passed during web type-collapse and SSE rewrite tasks.
- `cd web && bun run typecheck && bun run test src/hooks/useSSE.test.tsx` passed with 10/10 tests.
- `cd web && bun run typecheck && bun run test src/components/SessionList.test.ts src/components/SessionList.directory-action.test.tsx` passed with 14/14 tests.
- Workspace gate passed: `bun typecheck && bun run test`.
- Required zero-hit scans passed for deleted useSSE narrowers, invalidation queue symbols, local CLI/web mirror declarations, and `FlavorIcon`.

## Known Stubs

None.

## Threat Flags

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

REFA-03 and REFA-04 are complete for Slice 3. Downstream work can rely on shared protocol schemas as the single source of truth and on `useSSE` rejecting malformed event payloads without broad query invalidation.

## Self-Check: PASSED

- Summary file exists at `.planning/phases/07-wire-contracts-unification-sse-patch-contract/07-03-SUMMARY.md`.
- Task commits verified in git log: `54d7c98`, `ec49019`, `47577fd`, `e668f83`, `63a0fe8`, `ffe40f5`.
- Full gate verified with `bun typecheck && bun run test`.

---
*Phase: 07-wire-contracts-unification-sse-patch-contract*
*Completed: 2026-05-22*
