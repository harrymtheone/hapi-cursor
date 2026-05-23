---
phase: 03-cut-multi-user-namespace-isolation
plan: 05
subsystem: shared-contracts
tags: [zod, sync-events, socket-io, cli-api, namespace-cut]

requires:
  - phase: 03-cut-multi-user-namespace-isolation
    provides: owner-only route, socket, SSE, visibility, and push callsites from Plans 03-03 and 03-04
provides:
  - Namespace-free shared Session and SyncEvent schemas
  - Namespace-free socket error reason contract
  - Hub sync cache DTOs that omit namespace while store internals remain temporary
  - CLI response schemas and session fixtures without Session.namespace
affects: [03-06-schema-cleanup, 03-07-namespace-guard, phase-07-wire-contract-unification]

tech-stack:
  added: []
  patterns: [namespace-free-dtos, owner-only-sync-events, temporary-store-scope-bridge]

key-files:
  created:
    - .planning/phases/03-cut-multi-user-namespace-isolation/03-05-SUMMARY.md
  modified:
    - shared/src/schemas.ts
    - shared/src/socket.ts
    - hub/src/sync/sessionCache.ts
    - hub/src/sync/machineCache.ts
    - hub/src/sync/syncEngine.ts
    - hub/src/sync/sessionModel.test.ts
    - cli/src/api/types.ts
    - cli/src/api/api.ts
    - cli/src/api/api.extraHeaders.test.ts
    - cli/src/agent/sessionFactory.test.ts

key-decisions:
  - "Delete namespace from public shared/client DTOs now, while keeping the physical SQLite namespace column as an internal store-only detail until Plan 03-06."
  - "Use owner-only sync cache events and access results; namespace mismatch/access-denied branches are no longer emitted by sync contracts."
  - "Commit shared and CLI mirror cleanup together because deleting Session.namespace from shared immediately breaks the CLI Session type mirror under D-47."

patterns-established:
  - "Sync cache objects map store rows into namespace-free Session and Machine DTOs before publishing."
  - "Temporary store-only scope access stays inside sync cache implementation and does not flow into emitted events or client-visible objects."
  - "CLI API mappings return protocol Session objects without local namespace mirrors."

requirements-completed: [CUT-09]

duration: 5min 13s
completed: 2026-05-21
---

# Phase 03 Plan 05: Shared and Client Namespace Contract Cut Summary

**Shared Session/SyncEvent/socket contracts and CLI mirrors now expose owner-only, namespace-free runtime objects while SQLite cleanup remains isolated to Plan 03-06.**

## Performance

- **Duration:** 5min 13s
- **Started:** 2026-05-21T04:26:49Z
- **Completed:** 2026-05-21T04:32:02Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments

- Removed `Session.namespace`, event-level namespace base schemas, and `namespace-missing` from shared runtime contracts.
- Updated `SessionCache`, `MachineCache`, and `SyncEngine` to publish namespace-free session/machine/event objects.
- Removed CLI response schema, API mapping, and fixture expectations for `Session.namespace`.
- Confirmed web mirror files already had no namespace or `:ns` assumptions.

## Task Commits

The implementation was committed as one green D-47 slice:

1. **Tasks 03-05-01/03-05-02: Delete shared and client namespace contracts** - `c5bc308` (feat)

_Note: The shared `Session` type is consumed directly by CLI mirrors. Splitting the shared and CLI changes into separate green commits left `bun typecheck` failing, so the two implementation tasks were committed together._

## Files Created/Modified

- `shared/src/schemas.ts` - removes namespace from `SessionSchema` and `SyncEventSchema`.
- `shared/src/socket.ts` - drops `namespace-missing` from socket error reasons.
- `hub/src/sync/sessionCache.ts` - publishes namespace-free `Session` objects and events.
- `hub/src/sync/machineCache.ts` - publishes namespace-free `Machine` objects.
- `hub/src/sync/syncEngine.ts` - removes namespace access-denied branches from sync-level owner APIs.
- `hub/src/sync/sessionModel.test.ts` - updates sync expectations for namespace-free events and owner-only dedup semantics.
- `cli/src/api/types.ts` - removes namespace from `CreateSessionResponseSchema`.
- `cli/src/api/api.ts` - stops returning namespace in CLI `Session` mappings.
- `cli/src/api/api.extraHeaders.test.ts` and `cli/src/agent/sessionFactory.test.ts` - remove namespace fields from fixtures.

## Decisions Made

- Store row scope remains a temporary internal implementation detail until Plan 03-06 removes the physical schema columns and old store APIs.
- Owner-only dedup no longer preserves duplicates by tenant boundary; sessions with the same native agent session ID are evaluated in one owner space.
- Direct root `bun test` is not a valid way to run CLI Vitest files that use `vi.hoisted`; the focused CLI check used the package test command while the full root suite also passed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Combined coupled shared and CLI mirror cleanup**
- **Found during:** Task 03-05-01 verification
- **Issue:** Removing `Session.namespace` from shared contracts immediately broke CLI API mappings and fixtures that import the shared `Session` type.
- **Fix:** Removed the CLI response-schema, mapping, and fixture namespace fields in the same implementation commit.
- **Files modified:** `cli/src/api/types.ts`, `cli/src/api/api.ts`, `cli/src/api/api.extraHeaders.test.ts`, `cli/src/agent/sessionFactory.test.ts`
- **Verification:** focused CLI Vitest command, focused source scans, `bun typecheck && bun run test`
- **Committed in:** `c5bc308`

**2. [Rule 3 - Blocking] Kept temporary store scope internal to sync cache persistence writes**
- **Found during:** Task 03-05-01 implementation
- **Issue:** Some store update/delete methods still require the old physical row scope until Plan 03-06 deletes the schema column.
- **Fix:** Used store-row data only inside sync cache persistence calls while omitting it from all published DTOs and events.
- **Files modified:** `hub/src/sync/sessionCache.ts`, `hub/src/sync/machineCache.ts`, `hub/src/sync/syncEngine.ts`
- **Verification:** focused sync tests, focused source scans, `bun typecheck && bun run test`
- **Committed in:** `c5bc308`

---

**Total deviations:** 2 auto-fixed (both Rule 3 blocking)
**Impact on plan:** The public contract goal is complete. The only temporary storage detail left is explicitly owned by Plan 03-06.

## TDD Gate Compliance

- RED/GREEN commits were not separated for this plan. The shared schema deletion and CLI mirror deletion had to land together to keep the repository green under D-47.
- Full post-commit verification passed after the combined implementation commit.

## Verification

- `bun test hub/src/sync/sessionModel.test.ts hub/src/sync/aliveEvents.test.ts` - exit 0, 37 pass / 5 skip.
- Focused shared/sync scan: `rg -n 'namespace|namespace-missing|SessionEventBaseSchema' shared/src hub/src/sync` - no matches.
- Focused CLI Vitest command: `cd cli && bun run test -- src/api/api.extraHeaders.test.ts src/agent/sessionFactory.test.ts` - exit 0, 5 pass.
- Focused CLI/web mirror scan: `rg -n 'namespace|:ns' cli/src/api cli/src/agent/sessionFactory.test.ts web/src/types/api.ts web/src/hooks/useSSE.ts` - no matches.
- Post-commit D-47 gate: `bun typecheck && bun run test` - exit 0.

## Known Stubs

None. Stub-pattern scan produced only test array initializers and existing null checks; no UI-visible placeholder or incomplete data wiring was introduced.

## Threat Flags

None. This plan removes fields from existing DTO/event contracts and introduces no new network endpoint, auth path, file access pattern, dependency, or schema trust boundary.

## Issues Encountered

- GitNexus staged impact reported `critical` because `SessionCache` and `MachineCache` feed realtime, session, notification, and route flows. The planned blast radius was expected and covered by focused sync tests plus the full D-47 gate.
- Running the CLI Vitest files through root `bun test` fails because Bun's test runner does not provide `vi.hoisted`; the package-level Vitest command and full root test suite pass.
- `scripts/check-no-cut-agents.sh` still prints `rg: command not found` while exiting 0. This is pre-existing and remains owned by Plan 03-07.
- Existing unrelated working-tree changes remain: `AGENTS.md`, `.claude/`, and `CLAUDE.md`. They were not staged or modified by this plan.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Plan 03-06 can now delete the physical SQLite namespace columns, old store namespace methods, users table, and offline migration surface without any shared/client DTOs depending on namespace.

## Self-Check: PASSED

- Found summary file: `.planning/phases/03-cut-multi-user-namespace-isolation/03-05-SUMMARY.md`
- Found commit: `c5bc308`

---
*Phase: 03-cut-multi-user-namespace-isolation*
*Completed: 2026-05-21*
