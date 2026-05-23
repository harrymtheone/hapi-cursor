---
phase: 01-cursor-runtime-config-contract
plan: 04
subsystem: web-runtime-config
tags: [react, vitest, cursor-runtime, i18n, tanstack-query]

requires:
  - phase: 01-cursor-runtime-config-contract
    provides: Web Cursor model discovery hook and safe spawn rejection code from 01-03
  - phase: 01-cursor-runtime-config-contract
    provides: CLI/Hub selected runtime rejection contract from 01-02 and 01-03
provides:
  - Discovery-aware new-session model selector states
  - Panel-mounted Cursor model discovery trigger
  - Explicit-only model spawn payload wiring
  - Localized selected runtime rejection copy
affects: [new-session-launch, web-runtime-config, cursor-model-discovery]

tech-stack:
  added: []
  patterns:
    - Runtime discovery UI keeps `auto` as a Web-only sentinel and sends `undefined` for unspecified launches.
    - Web maps only structured `selected-runtime-config-rejected` responses to launch rejection copy.

key-files:
  created:
    - web/src/components/NewSession/ModelSelector.test.tsx
    - web/src/components/NewSession/NewSession.test.tsx
    - web/src/hooks/mutations/useSpawnSession.test.tsx
    - .planning/phases/01-cursor-runtime-config-contract/01-04-SUMMARY.md
  modified:
    - web/src/components/NewSession/ModelSelector.tsx
    - web/src/components/NewSession/index.tsx
    - web/src/hooks/mutations/useSpawnSession.ts
    - web/src/lib/locales/en.ts
    - web/src/lib/locales/zh-CN.ts

key-decisions:
  - "Keep `auto` as a selector-only sentinel and pass `undefined` to `spawnSession` unless the user selects a discovered raw Cursor model id."
  - "Map only the safe backend `selected-runtime-config-rejected` code to launch rejection copy; generic spawn failures keep their original safe message."
  - "Do not add separate effort controls because discovery/runtime behavior does not prove a standalone effort capability."

patterns-established:
  - "New-session runtime discovery state is passed through `ModelSelector` as data, loading, safe error, and retry props."
  - "Discovered model option labels begin with the raw Cursor model id and append secondary labels without replacing the id."

requirements-completed: [CURS-01, CURS-02]

duration: 6min
completed: 2026-05-23
---

# Phase 01 Plan 04: New-Session Runtime Model Selector Summary

**Discovery-aware new-session model selector with raw Cursor ids, safe retry states, and explicit-only launch payloads**

## Performance

- **Duration:** 6 min
- **Started:** 2026-05-23T15:13:56Z
- **Completed:** 2026-05-23T15:19:37Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments

- Added a discovery-aware `ModelSelector` that always offers `Auto (unspecified)`, renders loading/empty/safe-error states, exposes retry, and keeps raw Cursor model ids as primary option text.
- Wired `NewSession` to call `useCursorModels(props.api, machineId, Boolean(machineId))` while the panel is mounted, then pass discovery state into the selector.
- Preserved explicit-only launch behavior with `model !== 'auto' ? model : undefined`, and localized only structured selected-runtime rejection responses.
- Added focused Vitest coverage for selector states, discovery trigger, auto vs explicit spawn payloads, and runtime rejection copy.

## Task Commits

1. **Task 1 RED: Add selector discovery state tests** - `cb2ca9d` (test)
2. **Task 1 GREEN: Render discovery-aware model selector** - `55062bd` (feat)
3. **Task 2 RED: Add launch runtime wiring tests** - `df4e0d5` (test)
4. **Task 2 GREEN: Wire model discovery into new-session launch** - `e60e882` (feat)

_Note: Both planned tasks used TDD test and implementation commits._

## Files Created/Modified

- `web/src/components/NewSession/ModelSelector.tsx` - Renders auto, loading, success, empty, and safe error discovery states with localized copy.
- `web/src/components/NewSession/ModelSelector.test.tsx` - Covers selector loading, success, empty, error/retry, and raw id preservation.
- `web/src/components/NewSession/index.tsx` - Enables Cursor model discovery for the selected machine and preserves explicit-only spawn payloads.
- `web/src/components/NewSession/NewSession.test.tsx` - Covers model discovery on render and auto/explicit model launch payloads.
- `web/src/hooks/mutations/useSpawnSession.ts` - Maps only `selected-runtime-config-rejected` to localized launch rejection copy.
- `web/src/hooks/mutations/useSpawnSession.test.tsx` - Covers safe rejection localization and generic error preservation.
- `web/src/lib/locales/en.ts` - Adds English runtime discovery and launch rejection strings.
- `web/src/lib/locales/zh-CN.ts` - Adds Simplified Chinese runtime discovery and launch rejection strings.

## Decisions Made

- Used the existing `useCursorModels` hook directly from `NewSession` with a mounted/selected-machine enabled flag. The new-session panel only exists while open, so `Boolean(machineId)` is the effective panel-open discovery gate.
- Kept `Auto (unspecified)` localized under `newSession.model.autoUnspecified` and retained `auto` as the option value so existing form state remains simple while launch payloads stay truthful.
- Left effort controls absent. The plan and research require effort to remain auto/unspecified unless runtime discovery proves a separate effort capability.

## GitNexus Impact

- `ModelSelector`: LOW risk, 1 direct caller (`NewSession`), 0 affected processes.
- `NewSession`: LOW risk, 1 direct caller (`NewSessionPage`), 0 affected processes.
- `useSpawnSession`: LOW risk, 1 direct caller (`NewSession`), 0 affected processes.
- Pre-commit `detect_changes`: Task 1 implementation LOW risk with 2 changed selector symbols and 0 affected processes; Task 2 implementation LOW risk with 5 changed Web symbols and 0 affected processes.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added Testing Library cleanup to selector tests**
- **Found during:** Task 1 GREEN
- **Issue:** The Web test setup does not globally clean up rendered DOM between tests, causing duplicate `Auto (unspecified)` options across selector cases.
- **Fix:** Added `afterEach(() => cleanup())` to `ModelSelector.test.tsx`.
- **Files modified:** `web/src/components/NewSession/ModelSelector.test.tsx`
- **Verification:** `cd web && bun run test -- ModelSelector`
- **Committed in:** `55062bd`

**2. [Rule 3 - Blocking] Completed Web machine fixture shape**
- **Found during:** Task 2 GREEN
- **Issue:** `bun run typecheck` required the transformed `MachineMetadata` test fixture to include the `workspaceRoots` field.
- **Fix:** Added `workspaceRoots: undefined` to the `NewSession.test.tsx` machine fixture.
- **Files modified:** `web/src/components/NewSession/NewSession.test.tsx`
- **Verification:** `bun run typecheck`
- **Committed in:** `e60e882`

---

**Total deviations:** 2 auto-fixed (2 blocking test/type issues)
**Impact on plan:** Both fixes were required for stable verification. No behavior scope expansion, package installs, effort controls, or raw stderr parsing were introduced.

## Issues Encountered

- Initial RED test drafts had syntax errors from incorrect `describe`/helper closing braces. These were fixed before committing the RED gates.
- Task 2 verification initially failed on the Web machine fixture type; the fixture was corrected and the targeted tests plus root typecheck passed.

## Known Stubs

None. Stub-pattern scan found only existing empty-string checks for form state in `NewSession/index.tsx`, not UI data stubs.

## Threat Flags

None. The Hub discovery result to Web UI, Web form to Hub spawn route, and Cursor launch failure to Web copy are the planned threat-model surfaces for this plan.

## TDD Gate Compliance

- RED commits present before implementation: `cb2ca9d`, `df4e0d5`
- GREEN commits present after RED: `55062bd`, `e60e882`

## Verification

- `cd web && bun run test -- ModelSelector` - passed, 4 tests.
- `cd web && bun run test -- ModelSelector NewSession useSpawnSession` - passed, 8 tests.
- `bun run typecheck` - passed across CLI, Web, and Hub.
- `bash scripts/check-no-cut-agents.sh` - passed.
- Source assertion: `ModelSelector.tsx` uses `useTranslation()` for new discovery copy and contains no hardcoded English discovery strings.
- Source assertion: English locale text for `newSession.model.autoUnspecified` is `Auto (unspecified)`, while the option value remains `auto`.
- Source assertion: `NewSession/index.tsx` calls `useCursorModels` with `machineId` and `Boolean(machineId)`.
- Source assertion: `resolvedModel` maps only non-`auto` values to the spawn payload.
- Source assertion: no hardcoded effort option array was added in `NewSession` or `ModelSelector`.
- Source assertion: Web maps only `selected-runtime-config-rejected` and does not parse raw stderr/process output for runtime rejection.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

New-session launch now consumes runtime-owned model discovery, so downstream session model/status UI can rely on sessions being started with either no explicit model or a real discovered Cursor id. Safe launch rejection copy is localized without exposing process output.

## Self-Check: PASSED

- Found `.planning/phases/01-cursor-runtime-config-contract/01-04-SUMMARY.md`.
- Found `web/src/components/NewSession/ModelSelector.tsx`.
- Found `web/src/components/NewSession/ModelSelector.test.tsx`.
- Found `web/src/components/NewSession/index.tsx`.
- Found `web/src/components/NewSession/NewSession.test.tsx`.
- Found `web/src/hooks/mutations/useSpawnSession.ts`.
- Found `web/src/hooks/mutations/useSpawnSession.test.tsx`.
- Found `web/src/lib/locales/en.ts`.
- Found `web/src/lib/locales/zh-CN.ts`.
- Found task commit `cb2ca9d`.
- Found task commit `55062bd`.
- Found task commit `df4e0d5`.
- Found task commit `e60e882`.

---

*Phase: 01-cursor-runtime-config-contract*
*Completed: 2026-05-23*
