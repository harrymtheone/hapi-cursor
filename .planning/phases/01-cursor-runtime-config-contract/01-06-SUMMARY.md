---
phase: 01-cursor-runtime-config-contract
plan: 06
subsystem: web-runtime-config
tags: [react, vitest, cursor-runtime, i18n, tanstack-query]

requires:
  - phase: 01-cursor-runtime-config-contract
    provides: Status-bearing session model route responses from 01-05
  - phase: 01-cursor-runtime-config-contract
    provides: Shared Cursor runtime config apply-result schema from 01-01
provides:
  - Typed Web API model mutation result
  - Session action mutation result propagation
  - Session-local composer model switch state
  - Localized switch feedback/status vocabulary
affects: [composer-model-status, web-runtime-config, session-chat]

tech-stack:
  added: []
  patterns:
    - Web model mutations return the Hub's status-bearing runtime apply result.
    - SessionChat owns transient model switch state and passes it to composer/status props.
    - Runtime failure reasons are mapped to localized safe copy before display.

key-files:
  created:
    - web/src/hooks/mutations/useSessionActions.test.ts
    - web/src/components/SessionChat.test.tsx
    - .planning/phases/01-cursor-runtime-config-contract/01-06-SUMMARY.md
  modified:
    - web/src/api/client.ts
    - web/src/hooks/mutations/useSessionActions.ts
    - web/src/components/SessionChat.tsx
    - web/src/components/AssistantChat/HappyComposer.tsx
    - web/src/components/AssistantChat/StatusBar.tsx
    - web/src/lib/locales/en.ts
    - web/src/lib/locales/zh-CN.ts

key-decisions:
  - "Preserve Hub truth by returning `CursorRuntimeConfigApplyResult` through `ApiClient.setModel` and `useSessionActions().setModel` instead of synthesizing optimistic Web success."
  - "Keep model switch feedback as session-local composer/status state, not chat timeline messages."
  - "Map safe runtime failure reasons through existing localized safe reason copy before rendering status text."

patterns-established:
  - "Composer-adjacent model switch feedback uses `ModelSwitchState` with idle/applying/applied/pending/failed/applies-next-run states."
  - "SessionChat switch handlers set applying before mutation, then store the returned status or failed rejection state."

requirements-completed: [CURS-03]

duration: 10min
completed: 2026-05-23
---

# Phase 01 Plan 06: Web Model Switch State Summary

**Status-bearing Web model switch mutations with session-local composer feedback and localized runtime state copy**

## Performance

- **Duration:** 10 min
- **Started:** 2026-05-23T15:22:12Z
- **Completed:** 2026-05-23T15:32:34Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments

- Changed `ApiClient.setModel()` to return `Promise<CursorRuntimeConfigApplyResult>` from the Hub model route.
- Updated `useSessionActions().setModel()` to propagate applied, applies-next-run, failed, and pending-compatible results while preserving query invalidation and HTTP rejection behavior.
- Added `SessionChat` model switch state that sets `applying` before mutation, stores the returned status/reason, uses error haptics for failed/rejected switches, and keeps switch feedback out of the chat timeline.
- Passed switch state through `HappyComposer` to `StatusBar`, where safe localized copy renders near the composer controls.
- Added English and Simplified Chinese locale keys for composer switch feedback and session status vocabulary.

## Task Commits

1. **Task 1 RED: Add model action result tests** - `4b31bb2` (test)
2. **Task 1 GREEN: Return model apply results in Web actions** - `b83a71d` (feat)
3. **Task 2 RED: Add session switch state tests** - `72ab8c1` (test)
4. **Task 2 GREEN: Surface session model switch state** - `e89fe40` (feat)

_Note: Both planned tasks used TDD test and implementation commits._

## Files Created/Modified

- `web/src/api/client.ts` - Imports `CursorRuntimeConfigApplyResult` and returns the parsed model route JSON from `setModel()`.
- `web/src/hooks/mutations/useSessionActions.ts` - Returns the model mutation apply result from `setModel()` while preserving session/list invalidation.
- `web/src/hooks/mutations/useSessionActions.test.ts` - Covers applied, applies-next-run, failed result propagation and HTTP failure rejection.
- `web/src/components/SessionChat.tsx` - Owns session-local model switch state and passes it to composer props without touching message/timeline APIs.
- `web/src/components/SessionChat.test.tsx` - Covers applying/applied/applies-next-run/failed state propagation, haptics, rejection handling, and no timeline message append.
- `web/src/components/AssistantChat/HappyComposer.tsx` - Accepts `modelSwitchState` and forwards it to `StatusBar`.
- `web/src/components/AssistantChat/StatusBar.tsx` - Renders localized switch feedback and maps safe runtime reasons without exposing raw errors.
- `web/src/lib/locales/en.ts` - Adds English switch and session status copy.
- `web/src/lib/locales/zh-CN.ts` - Adds matching Simplified Chinese switch and session status keys.

## Decisions Made

- Relied on the Hub response as the source of truth for switch outcomes. Web no longer discards the JSON body and does not create optimistic applied state.
- Kept switch feedback local to the composer/status area. `handleModelChange` does not call message send, timeline, or chat reducer APIs.
- Displayed only safe reason categories already represented in locale copy. Unknown raw strings are not rendered as status reasons.

## GitNexus Impact

- `ApiClient.setModel`: LOW risk, 1 direct caller (`useSessionActions`), 1 affected process.
- `useSessionActions`: HIGH risk, 3 direct callers (`SessionChat`, `SessionHeader`, `SessionListItem`), affected process `SessionList`. User approved proceeding after checkpoint.
- `SessionChat`: LOW risk, 1 direct caller (`SessionPage`), 0 affected processes.
- `HappyComposer`: LOW risk, 1 direct caller (`SessionChat`), 0 affected processes.
- `StatusBar`: HIGH risk, 1 direct caller (`HappyComposer`), affected process `HappyComposer`. User approved proceeding after checkpoint.
- Pre-commit `detect_changes`: Task 1 implementation MEDIUM risk affecting `AppInner -> ApiClient`; Task 2 implementation MEDIUM risk affecting `HappyComposer` flows.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Kept hook test in planned `.test.ts` filename without JSX**
- **Found during:** Task 1 RED
- **Issue:** The initial hook test used JSX in `useSessionActions.test.ts`, causing Vite/esbuild to fail before the RED behavior assertions could run.
- **Fix:** Replaced the test wrapper JSX with `createElement()` while keeping the planned `useSessionActions.test.ts` filename.
- **Files modified:** `web/src/hooks/mutations/useSessionActions.test.ts`
- **Verification:** `cd web && bun run test -- useSessionActions`
- **Committed in:** `4b31bb2`

**2. [Rule 3 - Blocking] Held model mutation promise open for applying-state coverage**
- **Found during:** Task 2 GREEN
- **Issue:** The component test used an immediately resolved apply result, so React advanced from `applying` to final status before the test could observe the intermediate state.
- **Fix:** Switched the test to a controlled promise that verifies `applying`, then resolves to `applied`.
- **Files modified:** `web/src/components/SessionChat.test.tsx`
- **Verification:** `cd web && bun run test -- SessionChat useSessionActions`
- **Committed in:** `e89fe40`

**3. [Rule 3 - Blocking] Narrowed apply-result reason access for TypeScript**
- **Found during:** Task 2 GREEN
- **Issue:** `bun run typecheck` correctly rejected direct `result.reason` access on the `applied` variant, which has no `reason` property.
- **Fix:** Used an explicit `'reason' in result` check before copying safe reason state.
- **Files modified:** `web/src/components/SessionChat.tsx`
- **Verification:** `bun run typecheck`
- **Committed in:** `e89fe40`

---

**Total deviations:** 3 auto-fixed (3 blocking issues)
**Impact on plan:** Fixes were limited to test stability and TypeScript correctness. No package installs, architecture changes, timeline events, or optimistic status shims were introduced.

## Issues Encountered

- GitNexus reported HIGH impact for `useSessionActions` and `StatusBar`; execution stopped at checkpoint and resumed only after explicit approval.
- Targeted `SessionChat` tests log an existing React duplicate-key warning because `SessionChat` renders two sibling children with `key={props.session.id}`. This is outside the plan scope and did not fail verification.
- The shell environment did not have `rg` installed, so stub/source scans used Cursor's ripgrep tool instead.

## Known Stubs

None. Stub-pattern scan found no TODO/FIXME/placeholder/empty UI-data stubs in files created or modified by this plan.

## Threat Flags

None. The Hub config response to Web mutation, SessionChat-to-composer state boundary, and safe failure reason display were all planned threat-model surfaces for this plan.

## TDD Gate Compliance

- RED commits present before implementation: `4b31bb2`, `72ab8c1`
- GREEN commits present after RED: `b83a71d`, `e89fe40`

## Verification

- `cd web && bun run test -- useSessionActions` - passed, 4 tests.
- `cd web && bun run test -- SessionChat useSessionActions` - passed, 15 tests across 3 files.
- `bun run typecheck` - passed across CLI, Web, and Hub.
- `bun run test` - passed.
- `bun run madge:check` - passed.
- `bash scripts/check-no-cut-agents.sh` - passed.
- Source assertion: `web/src/api/client.ts` imports `CursorRuntimeConfigApplyResult` and returns `request<CursorRuntimeConfigApplyResult>()` from `setModel()`.
- Source assertion: `useSessionActions` exposes `setModel: (model: string | null) => Promise<CursorRuntimeConfigApplyResult>`.
- Source assertion: `SessionChat.tsx` has session-local `modelSwitchState` and passes it to composer/status props.
- Source assertion: `SessionChat.tsx` `handleModelChange` does not call message-send, timeline, or chat reducer APIs.
- Source assertion: `web/src/lib/locales/en.ts` contains exact English strings `Applying...`, `Applied`, `Applies next run`, and `Switch failed. Retry`.
- Source assertion: `web/src/lib/locales/zh-CN.ts` contains matching keys for every English key added.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Plan 07 can render composer switch feedback from a concrete `modelSwitchState` prop instead of inventing UI-only status. Web now preserves backend truth for applied, pending, failed, and applies-next-run outcomes while keeping the chat timeline clean.

## Self-Check: PASSED

- Found `.planning/phases/01-cursor-runtime-config-contract/01-06-SUMMARY.md`.
- Found `web/src/api/client.ts`.
- Found `web/src/hooks/mutations/useSessionActions.ts`.
- Found `web/src/hooks/mutations/useSessionActions.test.ts`.
- Found `web/src/components/SessionChat.tsx`.
- Found `web/src/components/SessionChat.test.tsx`.
- Found `web/src/components/AssistantChat/HappyComposer.tsx`.
- Found `web/src/components/AssistantChat/StatusBar.tsx`.
- Found `web/src/lib/locales/en.ts`.
- Found `web/src/lib/locales/zh-CN.ts`.
- Found task commit `4b31bb2`.
- Found task commit `b83a71d`.
- Found task commit `72ab8c1`.
- Found task commit `e89fe40`.

---

*Phase: 01-cursor-runtime-config-contract*
*Completed: 2026-05-23*
