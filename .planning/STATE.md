---
gsd_state_version: 1.0
milestone: v1.1
milestone_name: Cursor mobile features
status: executing
stopped_at: Completed 01-09-PLAN.md
last_updated: "2026-05-23T16:51:35.112Z"
last_activity: 2026-05-23
progress:
  total_phases: 5
  completed_phases: 0
  total_plans: 10
  completed_plans: 9
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-23 after v1.1 milestone start)

**Core value:** 让 Cursor Agent 在手机端达到与桌面 Cursor IDE 等同的可用性
**Current focus:** Phase 01 — cursor-runtime-config-contract

## Current Position

Phase: 01 (cursor-runtime-config-contract) — EXECUTING
Plan: 2 of 10
Status: Ready to execute
Last activity: 2026-05-23

Progress: [█████████░] 90%

## Performance Metrics

**Velocity:**

- Total plans completed: 3
- Average duration: 4min
- Total execution time: 0.18 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1. Cursor Runtime Config Contract | 3/8 | 11min | 4min |
| 2. Skills Visibility and Session Policy | TBD | - | - |
| 3. MCP Inventory and Session Policy | TBD | - | - |
| 4. Mobile Screenshot Display | TBD | - | - |
| 5. Integration Guards and Mobile E2E | TBD | - | - |

**Recent Trend:**

- Last 5 plans: 01-01 (2min), 01-02 (4min), 01-05 (5min)
- Trend: baseline

*Updated after each plan completion*

| Phase 01 P05 | 5min | 2 tasks | 9 files |
| Phase 01 P03 | 6min | 2 tasks | 10 files |
| Phase 01 P04 | 6min | 2 tasks | 8 files |
| Phase 01 P06 | 10min | 2 tasks | 9 files |
| Phase 01 P07 | 6min | 2 tasks | 8 files |
| Phase 01 P08 | 8min | 2 tasks | 13 files |
| Phase 01 P09 | 4min | 2 tasks | 5 files |

## Accumulated Context

### Decisions

Full decision log archived in `PROJECT.md` Key Decisions table and per-phase `DISCUSSION-LOG.md` files under `.planning/milestones/v1.0-phases/`.

Recent decisions affecting current work:

- v1.1 reset numbering starts at Phase 1 for this milestone.
- Runtime config comes first so model/effort/session metadata is real before policy and UI surfaces depend on it.
- Skills and MCP are separate phases because their discovery, enforcement, and safety risks differ.
- Integration/quality requirements close the milestone in Phase 5 after feature slices exist.
- [Phase 01]: Use enumerated safe runtime config failure reasons so raw Cursor CLI stderr cannot enter normal UI contracts.
- [Phase 01]: Keep Cursor model ids as unconstrained non-empty strings instead of shipping a static model catalog.
- [Phase 01]: Run Cursor model discovery only through local agent models and return safe categorized failures. — Preserves runtime truth and avoids static model catalogs.
- [Phase 01]: Expose model discovery as a machine-scoped RPC because discovery happens before session launch. — A session-scoped handler cannot serve the new-session panel before launch.
- [Phase 01]: Preserve auto launch failures while labeling explicit selected runtime rejection with selected-runtime-config-rejected. — Selected config rejection must be clear without silently falling back to auto.
- [Phase 01]: Report active model and effort changes as applies-next-run until HAPI has a proven hot-switch control path. — Preserves runtime truthfulness until a verified control path exists.
- [Phase 01]: Preserve permission-mode config on the existing applied response path while model and effort use the shared status contract. — Avoids widening the shared schema after a CRITICAL file-level impact check.
- [Phase 01]: Inactive model route requests persist metadata as applies-next-run state through the engine path. — Inactive sessions cannot acknowledge active runtime changes, but metadata can be queued for the next run.
- [Phase 01]: Keep machine-scoped Cursor model discovery behind the authenticated Hub machine route and delegate through SyncEngine/RpcGateway. — Preserves architecture and avoids direct Hub shell execution.
- [Phase 01]: Cache Cursor model discovery results for 30000ms per machine id and sanitize rejected request errors. — Prevents repeated runtime discovery and keeps raw transport details out of UI state.
- [Phase 01]: Keep auto as a selector-only sentinel and pass undefined unless the user selects a discovered raw Cursor model id. — Preserves unspecified launches and prevents sending auto as a model id.
- [Phase 01]: Map only selected-runtime-config-rejected to launch rejection copy. — Web does not parse stderr or generic process output to infer runtime rejection.
- [Phase 01]: Preserve Hub truth for Web model switching by returning CursorRuntimeConfigApplyResult through ApiClient.setModel and useSessionActions.setModel.
- [Phase 01]: Keep model switch feedback in SessionChat composer/status state rather than chat timeline messages.
- [Phase 01]: Map runtime failure reasons through localized safe copy before rendering switch status.
- [Phase 01]: Use runtimeModelSwitchSupported as the authoritative hot-switch capability gate for composer model selector access.
- [Phase 01]: Keep the composer model box read-only by default and open selector only when runtime support, approved options, and idle state are all true.
- [Phase 01]: Preserve failed model switch retry targets in composer switch state instead of adding timeline events.
- [Phase 01]: Derive session-list attention state from shared statusKind/completionMarker/errorMarker summary fields. — Session rows need a compact live status source while model/effort remain composer-adjacent.
- [Phase 01]: Keep completed-session read state local to Web and keyed by session id plus completion marker. — Read state is local UI state, and the marker key lets later completed results become unread again.
- [Phase 01]: Merge strict SSE status marker patches directly into TanStack summary caches without adding malformed-event refetch fallback. — Preserves strict patch rejection while keeping runtime status fields live.
- [Phase 01]: ---

phase: 01-cursor-runtime-config-contract
plan: 09
subsystem: web-runtime-config
tags: [react, vitest, cursor-runtime, composer, model-discovery]

requires:

  - phase: 01-cursor-runtime-config-contract
    provides: Machine-scoped Cursor model discovery from 01-03 and status-bearing Web model switch results from 01-06/01-07
provides:

  - Session-scoped Cursor model discovery wiring for live composer model switching
  - Runtime switch support and model option props from SessionChat to HappyComposer
  - Regression coverage for live model option forwarding and discovered model selector behavior

affects: [composer-model-status, web-runtime-config, session-chat]

tech-stack:
  added: []
  patterns:

    - SessionPage derives runtime model options from authenticated machine-scoped Cursor discovery.
    - SessionChat forwards runtime switch support and discovered options without creating timeline messages.

key-files:
  created:

    - .planning/phases/01-cursor-runtime-config-contract/01-09-SUMMARY.md
  modified:

    - web/src/router.tsx
    - web/src/components/SessionChat.tsx
    - web/src/components/SessionChat.test.tsx
    - web/src/components/AssistantChat/HappyComposer.test.tsx

key-decisions:

  - "Use `useCursorModels(api, session.metadata.machineId, Boolean(machineId))` as the live-session source of runtime model truth."
  - "Expose runtime model switching only when discovery returns `status: 'ok'` with at least one model id."
  - "Keep Auto as a selector-only `null` sentinel and preserve raw Cursor model ids in the live composer selector."

patterns-established:

  - "Live session model options use the same raw-id plus optional label format as new-session discovery."
  - "Composer switch feedback remains local to `SessionChat` state and `HappyComposer` status props."

requirements-completed: [CURS-03]

duration: 4min
completed: 2026-05-23
---

# Phase 01 Plan 09: Live Composer Runtime Options Summary

**Live session composer model switching now uses machine-scoped Cursor discovery and reaches the existing status-bearing model mutation path**

## Performance

- **Duration:** 4 min
- **Started:** 2026-05-23T16:46:31Z
- **Completed:** 2026-05-23T16:50:44Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Added RED coverage proving `SessionChat` must forward runtime switch support and discovered model options, and proving `HappyComposer` opens discovered raw Cursor model ids without showing unavailable copy.
- Wired `SessionPage` to discover Cursor models for the selected session machine via `useCursorModels(api, machineId, Boolean(machineId))`.
- Derived live composer model options with `Auto (unspecified)` as `null`, followed by raw Cursor model ids with optional labels.
- Threaded `runtimeModelSwitchSupported` and `availableModelOptions` through `SessionChat` into `HappyComposer`, letting existing `setModel` status handling surface applied, failed, pending, or applies-next-run results without timeline messages.

## Task Commits

1. **Task 1 RED: Add failing coverage for live composer runtime options** - `3186683` (test)
2. **Task 2 GREEN: Wire session-scoped Cursor discovery into SessionChat** - `3f68abb` (feat)

**Plan metadata:** committed with this summary.

## Files Created/Modified

- `web/src/router.tsx` - Imports `useCursorModels`, maps discovered session-machine model ids into live composer options, and passes runtime support/options to `SessionChat`.
- `web/src/components/SessionChat.tsx` - Adds optional runtime switch support and model option props, forwarding them unchanged to `HappyComposer`.
- `web/src/components/SessionChat.test.tsx` - Covers supported and unsupported runtime switch prop forwarding plus applies-next-run feedback without chat timeline additions.
- `web/src/components/AssistantChat/HappyComposer.test.tsx` - Covers opening discovered runtime model options, suppressing unavailable copy on the supported idle path, and calling `onModelChange` with the raw model id.
- `.planning/phases/01-cursor-runtime-config-contract/01-09-SUMMARY.md` - Captures execution evidence and close-out state for this plan.

## Decisions Made

- Used `session.metadata.machineId` as the discovery key because model discovery is machine-scoped and already authenticated through the Hub/CLI RPC path.
- Kept support false with empty options for loading, error, missing machine id, and empty discovery results so unavailable copy remains truthful.
- Did not add timeline events or parse runtime stderr in Web; existing `SessionChat` model switch state remains the only feedback surface.

## GitNexus Impact

- `SessionPage`: LOW risk, 1 direct caller (`SessionDetailRoute`), 0 affected processes.
- `SessionChat`: LOW risk, 1 direct caller (`SessionPage`), 0 affected processes.
- `HappyComposer`: LOW risk, 1 direct caller (`SessionChat`), 0 affected processes.
- Pre-commit `detect_changes`: Task 1 low risk with no indexed changed symbols; Task 2 low risk with changed symbols in `SessionPage` and `SessionChat`, 0 affected processes.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- `bun run test` failed in the pre-existing CLI runner integration suite before reaching Web: 12 `runner.integration.test.ts` cases timed out in `beforeEach` while stopping the runner. This is outside the Web runtime model wiring scope; scoped Web verification passed.
- `SessionChat.test.tsx` continues to print the existing duplicate React key warning for `session-1`, previously documented in Plan 06. It does not fail the tests and was not introduced by this plan.
- jsdom navigation "not implemented" console noise appears in the full Web suite from existing settings/router tests; all Web tests still pass.

## Known Stubs

None. Stub-pattern scan found only ordinary initialized empty objects/arrays and null checks in the modified production files, not UI data stubs.

## Threat Flags

None. The modified files use planned threat-model surfaces only: authenticated `useCursorModels` discovery, safe `null` Auto sentinel mapping, and existing localized composer status display.

## TDD Gate Compliance

- RED commit present before implementation: `3186683`
- GREEN commit present after RED: `3f68abb`
- No refactor commit was needed.

## Verification

- `cd web && bun run test -- SessionChat HappyComposer` - failed as expected in RED with missing runtime switch props.
- `cd web && bun run test -- SessionChat HappyComposer useCursorModels NewSession` - passed, 41 tests across 8 files.
- `bun run typecheck` - passed across CLI, Web, and Hub.
- `bun run test:web` - passed, 673 tests across 90 files.
- `bash scripts/check-no-cut-agents.sh` - passed all repository guards.
- `bun run test` - failed in unrelated CLI runner integration `beforeEach` timeouts before Web tests; documented above.
- Source assertion: `web/src/router.tsx` calls `useCursorModels(api, sessionMachineId, Boolean(sessionMachineId))`.
- Source assertion: `web/src/router.tsx` passes `runtimeModelSwitchSupported` and `availableModelOptions` into `SessionChat`.
- Source assertion: `web/src/components/SessionChat.tsx` forwards `runtimeModelSwitchSupported` and `availableModelOptions` into `HappyComposer`.
- Source assertion: `SessionChat.test.tsx` keeps model switch feedback out of the `HappyThread` raw message count.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

UAT Test 3's frontend gate is closed: when a session has a machine id and discovery succeeds, the live composer can open the model selector and request a raw Cursor model id through the existing Hub/CLI status-bearing path. Ready for Plan 10 to handle the remaining UAT gap.

## Self-Check: PASSED

- Found `.planning/phases/01-cursor-runtime-config-contract/01-09-SUMMARY.md`.
- Found `web/src/router.tsx`.
- Found `web/src/components/SessionChat.tsx`.
- Found `web/src/components/SessionChat.test.tsx`.
- Found `web/src/components/AssistantChat/HappyComposer.test.tsx`.
- Found task commit `3186683`.
- Found task commit `3f68abb`.

---

*Phase: 01-cursor-runtime-config-contract*
*Completed: 2026-05-23* — ---
phase: 01-cursor-runtime-config-contract
plan: 09
subsystem: web-runtime-config
tags: [react, vitest, cursor-runtime, composer, model-discovery]

requires:

  - phase: 01-cursor-runtime-config-contract
    provides: Machine-scoped Cursor model discovery from 01-03 and status-bearing Web model switch results from 01-06/01-07
provides:

  - Session-scoped Cursor model discovery wiring for live composer model switching
  - Runtime switch support and model option props from SessionChat to HappyComposer
  - Regression coverage for live model option forwarding and discovered model selector behavior

affects: [composer-model-status, web-runtime-config, session-chat]

tech-stack:
  added: []
  patterns:

    - SessionPage derives runtime model options from authenticated machine-scoped Cursor discovery.
    - SessionChat forwards runtime switch support and discovered options without creating timeline messages.

key-files:
  created:

    - .planning/phases/01-cursor-runtime-config-contract/01-09-SUMMARY.md
  modified:

    - web/src/router.tsx
    - web/src/components/SessionChat.tsx
    - web/src/components/SessionChat.test.tsx
    - web/src/components/AssistantChat/HappyComposer.test.tsx

key-decisions:

  - "Use `useCursorModels(api, session.metadata.machineId, Boolean(machineId))` as the live-session source of runtime model truth."
  - "Expose runtime model switching only when discovery returns `status: 'ok'` with at least one model id."
  - "Keep Auto as a selector-only `null` sentinel and preserve raw Cursor model ids in the live composer selector."

patterns-established:

  - "Live session model options use the same raw-id plus optional label format as new-session discovery."
  - "Composer switch feedback remains local to `SessionChat` state and `HappyComposer` status props."

requirements-completed: [CURS-03]

duration: 4min
completed: 2026-05-23
---

# Phase 01 Plan 09: Live Composer Runtime Options Summary

**Live session composer model switching now uses machine-scoped Cursor discovery and reaches the existing status-bearing model mutation path**

## Performance

- **Duration:** 4 min
- **Started:** 2026-05-23T16:46:31Z
- **Completed:** 2026-05-23T16:50:44Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Added RED coverage proving `SessionChat` must forward runtime switch support and discovered model options, and proving `HappyComposer` opens discovered raw Cursor model ids without showing unavailable copy.
- Wired `SessionPage` to discover Cursor models for the selected session machine via `useCursorModels(api, machineId, Boolean(machineId))`.
- Derived live composer model options with `Auto (unspecified)` as `null`, followed by raw Cursor model ids with optional labels.
- Threaded `runtimeModelSwitchSupported` and `availableModelOptions` through `SessionChat` into `HappyComposer`, letting existing `setModel` status handling surface applied, failed, pending, or applies-next-run results without timeline messages.

## Task Commits

1. **Task 1 RED: Add failing coverage for live composer runtime options** - `3186683` (test)
2. **Task 2 GREEN: Wire session-scoped Cursor discovery into SessionChat** - `3f68abb` (feat)

**Plan metadata:** committed with this summary.

## Files Created/Modified

- `web/src/router.tsx` - Imports `useCursorModels`, maps discovered session-machine model ids into live composer options, and passes runtime support/options to `SessionChat`.
- `web/src/components/SessionChat.tsx` - Adds optional runtime switch support and model option props, forwarding them unchanged to `HappyComposer`.
- `web/src/components/SessionChat.test.tsx` - Covers supported and unsupported runtime switch prop forwarding plus applies-next-run feedback without chat timeline additions.
- `web/src/components/AssistantChat/HappyComposer.test.tsx` - Covers opening discovered runtime model options, suppressing unavailable copy on the supported idle path, and calling `onModelChange` with the raw model id.
- `.planning/phases/01-cursor-runtime-config-contract/01-09-SUMMARY.md` - Captures execution evidence and close-out state for this plan.

## Decisions Made

- Used `session.metadata.machineId` as the discovery key because model discovery is machine-scoped and already authenticated through the Hub/CLI RPC path.
- Kept support false with empty options for loading, error, missing machine id, and empty discovery results so unavailable copy remains truthful.
- Did not add timeline events or parse runtime stderr in Web; existing `SessionChat` model switch state remains the only feedback surface.

## GitNexus Impact

- `SessionPage`: LOW risk, 1 direct caller (`SessionDetailRoute`), 0 affected processes.
- `SessionChat`: LOW risk, 1 direct caller (`SessionPage`), 0 affected processes.
- `HappyComposer`: LOW risk, 1 direct caller (`SessionChat`), 0 affected processes.
- Pre-commit `detect_changes`: Task 1 low risk with no indexed changed symbols; Task 2 low risk with changed symbols in `SessionPage` and `SessionChat`, 0 affected processes.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- `bun run test` failed in the pre-existing CLI runner integration suite before reaching Web: 12 `runner.integration.test.ts` cases timed out in `beforeEach` while stopping the runner. This is outside the Web runtime model wiring scope; scoped Web verification passed.
- `SessionChat.test.tsx` continues to print the existing duplicate React key warning for `session-1`, previously documented in Plan 06. It does not fail the tests and was not introduced by this plan.
- jsdom navigation "not implemented" console noise appears in the full Web suite from existing settings/router tests; all Web tests still pass.

## Known Stubs

None. Stub-pattern scan found only ordinary initialized empty objects/arrays and null checks in the modified production files, not UI data stubs.

## Threat Flags

None. The modified files use planned threat-model surfaces only: authenticated `useCursorModels` discovery, safe `null` Auto sentinel mapping, and existing localized composer status display.

## TDD Gate Compliance

- RED commit present before implementation: `3186683`
- GREEN commit present after RED: `3f68abb`
- No refactor commit was needed.

## Verification

- `cd web && bun run test -- SessionChat HappyComposer` - failed as expected in RED with missing runtime switch props.
- `cd web && bun run test -- SessionChat HappyComposer useCursorModels NewSession` - passed, 41 tests across 8 files.
- `bun run typecheck` - passed across CLI, Web, and Hub.
- `bun run test:web` - passed, 673 tests across 90 files.
- `bash scripts/check-no-cut-agents.sh` - passed all repository guards.
- `bun run test` - failed in unrelated CLI runner integration `beforeEach` timeouts before Web tests; documented above.
- Source assertion: `web/src/router.tsx` calls `useCursorModels(api, sessionMachineId, Boolean(sessionMachineId))`.
- Source assertion: `web/src/router.tsx` passes `runtimeModelSwitchSupported` and `availableModelOptions` into `SessionChat`.
- Source assertion: `web/src/components/SessionChat.tsx` forwards `runtimeModelSwitchSupported` and `availableModelOptions` into `HappyComposer`.
- Source assertion: `SessionChat.test.tsx` keeps model switch feedback out of the `HappyThread` raw message count.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

UAT Test 3's frontend gate is closed: when a session has a machine id and discovery succeeds, the live composer can open the model selector and request a raw Cursor model id through the existing Hub/CLI status-bearing path. Ready for Plan 10 to handle the remaining UAT gap.

## Self-Check: PASSED

- Found `.planning/phases/01-cursor-runtime-config-contract/01-09-SUMMARY.md`.
- Found `web/src/router.tsx`.
- Found `web/src/components/SessionChat.tsx`.
- Found `web/src/components/SessionChat.test.tsx`.
- Found `web/src/components/AssistantChat/HappyComposer.test.tsx`.
- Found task commit `3186683`.
- Found task commit `3f68abb`.

---

*Phase: 01-cursor-runtime-config-contract*
*Completed: 2026-05-23*

### Pending Todos

None yet.

### Blockers / Concerns

No blockers. Research flags remain for phase planning: Cursor model list output, per-session skill enforcement, per-session MCP enforcement, and screenshot result shape.

## Deferred Items

Items acknowledged and carried forward from previous milestone close:

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| Code quality | `reducerTimeline.ts` decomposition | Non-blocking carry-forward | v1.0 close |
| Shared contract | Cursor permission-mode helper promotion to `shared/` | Non-blocking carry-forward | v1.0 close |
| Quality gate | Lint not enforced in CI | Covered by v1.1 QUAL-01 | v1.0 close |
| Backlog | M2-BL-01..10 | Review during phase planning as needed | v1.0 close |

## Session Continuity

Last session: 2026-05-23T16:51:35.109Z
Stopped at: Completed 01-09-PLAN.md
Resume file: None

---

*Note: v1.0 detail lives in `.planning/milestones/v1.0-phases/` and milestone archives. v1.1 execution should use `.planning/ROADMAP.md` as the active phase source.*
