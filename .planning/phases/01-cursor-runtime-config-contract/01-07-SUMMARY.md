---
phase: 01-cursor-runtime-config-contract
plan: 07
subsystem: web-runtime-config
tags: [react, vitest, cursor-runtime, composer, mobile-ui]

requires:
  - phase: 01-cursor-runtime-config-contract
    provides: Session-local model switch state and localized feedback from 01-06
  - phase: 01-cursor-runtime-config-contract
    provides: Runtime model discovery and status-bearing apply results from 01-03 through 01-05
provides:
  - Composer-adjacent model information box with raw model id and verified effort metadata
  - Runtime-supported and idle-only model selector gate
  - Model shortcut and overlay actions controlled by the same selector gate
  - Failed/applied/applying/applies-next-run feedback inside composer controls
affects: [composer-model-status, web-runtime-config, session-chat]

tech-stack:
  added: []
  patterns:
    - Runtime selector visibility derives from a single capability and idle-state boolean.
    - Composer status owns model display and switch feedback without writing chat timeline events.

key-files:
  created:
    - web/src/components/AssistantChat/StatusBar.test.tsx
    - web/src/components/AssistantChat/HappyComposer.test.tsx
    - .planning/phases/01-cursor-runtime-config-contract/01-07-SUMMARY.md
  modified:
    - web/src/components/AssistantChat/StatusBar.tsx
    - web/src/components/AssistantChat/useHappyComposerState.ts
    - web/src/components/AssistantChat/useHappyComposerState.test.ts
    - web/src/components/AssistantChat/useHappyComposerHandlers.ts
    - web/src/components/AssistantChat/HappyComposer.tsx
    - web/src/components/AssistantChat/HappyComposer.test.tsx
    - web/src/components/SessionChat.tsx

key-decisions:
  - "Use `runtimeModelSwitchSupported` as the authoritative hot-switch capability gate; the static protocol helper remains false for Cursor until a proven runtime path exists."
  - "Render the model info box as read-only by default and open the selector only when runtime support, approved options, and idle state are all true."
  - "Keep retry state tied to the requested target model so failed switch feedback can invoke the same model-change action."

patterns-established:
  - "HappyComposer exposes `canOpenModelSelector` from `useHappyComposerState` and shares it with both overlay visibility and the composer model box."
  - "StatusBar renders raw model ids directly and only shows effort text from non-null session metadata."

requirements-completed: [CURS-03, CURS-04]

duration: 6min
completed: 2026-05-23
---

# Phase 01 Plan 07: Composer Runtime Model Status Summary

**Composer-adjacent runtime model box with raw model/effort visibility, truthful switch feedback, and runtime-gated selector access**

## Performance

- **Duration:** 6 min
- **Started:** 2026-05-23T15:35:32Z
- **Completed:** 2026-05-23T15:41:00Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments

- Added a single `canOpenModelSelector` gate requiring a model-change callback, proven runtime switch support, runtime-approved options, no thinking state, no background work, no pending requests, and enabled controls.
- Reused that gate for the floating model selector, model info box click behavior, and global model cycling shortcut.
- Rendered a compact composer model information box showing the raw current model id or localized `Auto (unspecified)`, optional verified effort metadata, and applying/applied/failed/applies-next-run feedback.
- Preserved failed switch retry target state in `SessionChat` without adding chat timeline messages.

## Task Commits

1. **Task 1 RED: Add composer selector gate tests** - `28ee1b2` (test)
2. **Task 1 GREEN: Gate composer model switching** - `96c46b9` (feat)
3. **Task 2 RED: Add composer model info tests** - `cda2bb5` (test)
4. **Task 2 GREEN: Render composer model information box** - `79d11e5` (feat)

_Note: Both planned tasks used TDD test and implementation commits._

## Files Created/Modified

- `web/src/components/AssistantChat/useHappyComposerState.ts` - Computes `canOpenModelSelector` from runtime support, approved options, and idle-state checks.
- `web/src/components/AssistantChat/useHappyComposerState.test.ts` - Covers supported idle, unsupported/unproven, thinking, background work, pending requests, and no-options gate states.
- `web/src/components/AssistantChat/useHappyComposerHandlers.ts` - Routes keyboard cycling and model selection through the same selector gate.
- `web/src/components/AssistantChat/StatusBar.tsx` - Renders the model information box, effort metadata, switch status copy, read-only state, and retry affordance.
- `web/src/components/AssistantChat/StatusBar.test.tsx` - Covers raw model display, auto display, effort display, switch status copy, retry, and read-only/clickable behavior.
- `web/src/components/AssistantChat/HappyComposer.tsx` - Threads selector gate, model effort fields, and model info click/retry handlers into `StatusBar`.
- `web/src/components/AssistantChat/HappyComposer.test.tsx` - Covers composer-adjacent model/effort rendering and supported versus unsupported selector behavior.
- `web/src/components/SessionChat.tsx` - Preserves switch target model state for failed retry feedback and passes `modelReasoningEffort` into the composer.

## Decisions Made

- Used runtime support as the hot-switch truth instead of the static Cursor flavor helper. The static helper is still false for Cursor, so keeping it in the gate would make true runtime support impossible to surface later.
- Kept the model box read-only by default. With no runtime support prop from `SessionChat`, current shipped behavior remains truthful: the model and effort are visible, but hot switching is not implied.
- Rendered retry as a model-box affordance that calls the same model-change handler with the stored target model, keeping switch feedback inside composer controls.

## GitNexus Impact

- `useHappyComposerState`: HIGH risk, 1 direct caller (`HappyComposer`), affected process `HappyComposer`, modules `AssistantChat`, `Components`, and `Queries`.
- `useHappyComposerHandlers`: HIGH risk, 1 direct caller (`HappyComposer`), affected process `HappyComposer`, modules `AssistantChat`, `Components`, and `Queries`.
- `StatusBar`: HIGH risk, 1 direct caller (`HappyComposer`), affected process `HappyComposer`, modules `AssistantChat`, `Components`, and `Queries`.
- `HappyComposerOverlays`: HIGH risk, 1 direct caller (`HappyComposer`), affected process `HappyComposer`; no edits were needed after the upstream gate controlled visibility.
- `HappyComposer`: LOW risk, 1 direct caller (`SessionChat`), 0 affected processes.
- `SessionChat`: LOW risk, 1 direct caller (`SessionPage`), 0 affected processes.
- Pre-commit `detect_changes`: Task 1 RED low risk; Task 1 GREEN medium risk affecting `HappyComposer` flows; Task 2 RED untracked new tests not mapped; Task 2 GREEN medium risk affecting `HappyComposer` flows.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Removed stale static model-change helper from the runtime gate**
- **Found during:** Task 2 GREEN
- **Issue:** `supportsModelChange('cursor')` is currently false by design. Leaving it in the new gate would prevent the selector from opening even when a future runtime-support signal is true.
- **Fix:** Made `runtimeModelSwitchSupported` the authoritative capability signal and kept the idle/options/control checks around it.
- **Files modified:** `web/src/components/AssistantChat/useHappyComposerState.ts`, `web/src/components/AssistantChat/HappyComposer.test.tsx`
- **Verification:** `cd web && bun run test -- useHappyComposerState HappyComposer StatusBar`; `bun run typecheck`
- **Committed in:** `79d11e5`

---

**Total deviations:** 1 auto-fixed (1 missing critical functionality)
**Impact on plan:** The fix preserves the plan's runtime-truth invariant and does not claim hot switching in current `SessionChat` behavior.

## Issues Encountered

- `StatusBar.test.tsx` and `HappyComposer.test.tsx` did not exist before this plan, so Task 2 created focused component tests from scratch.
- The new `HappyComposer` test harness needed a small `ComposerPrimitive.AddAttachment` mock and protocol capability mock so it could exercise the supported-idle path without rendering assistant-ui internals.
- Shell `rg` was unavailable during self-check, so commit verification used `git cat-file -e` after the first attempt.

## Known Stubs

None. Stub scan found only real input placeholder attributes and test helper default object parameters, not UI data stubs.

## Threat Flags

None. The modified files do not introduce new network endpoints, auth paths, file access patterns, or schema changes; they render planned session metadata and existing switch state inside composer UI.

## TDD Gate Compliance

- RED commits present before implementation: `28ee1b2`, `cda2bb5`
- GREEN commits present after RED: `96c46b9`, `79d11e5`

## Verification

- `cd web && bun run test -- useHappyComposerState` - passed, 9 tests.
- `cd web && bun run test -- useHappyComposerState HappyComposer StatusBar` - passed, 23 tests across 4 files.
- `bun run typecheck` - passed across CLI, Web, and Hub.
- `bash scripts/check-no-cut-agents.sh` - passed.
- Source assertion: `useHappyComposerState.ts` computes `canOpenModelSelector` from runtime support, runtime-approved options, idle state, and controls state.
- Source assertion: `useHappyComposerHandlers.ts` checks `canOpenModelSelector` before keyboard model cycling and model option selection.
- Source assertion: `StatusBar.tsx` renders `props.model` directly as the primary model value and falls back to `newSession.model.autoUnspecified`.
- Source assertion: `StatusBar.tsx` renders effort only from non-null `modelReasoningEffort` or `effort` props.
- Source assertion: failed and applies-next-run switch feedback render in `StatusBar.tsx`, not chat timeline components.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Plan 08 can finish the Phase 1 session-list status work with model/effort already removed from that surface and visible in the composer where the phase context requires it.

## Self-Check: PASSED

- Found `.planning/phases/01-cursor-runtime-config-contract/01-07-SUMMARY.md`.
- Found `web/src/components/AssistantChat/StatusBar.tsx`.
- Found `web/src/components/AssistantChat/StatusBar.test.tsx`.
- Found `web/src/components/AssistantChat/HappyComposer.tsx`.
- Found `web/src/components/AssistantChat/HappyComposer.test.tsx`.
- Found `web/src/components/AssistantChat/useHappyComposerState.ts`.
- Found `web/src/components/AssistantChat/useHappyComposerState.test.ts`.
- Found `web/src/components/AssistantChat/useHappyComposerHandlers.ts`.
- Found `web/src/components/SessionChat.tsx`.
- Found task commit `28ee1b2`.
- Found task commit `96c46b9`.
- Found task commit `cda2bb5`.
- Found task commit `79d11e5`.

---

*Phase: 01-cursor-runtime-config-contract*
*Completed: 2026-05-23*
