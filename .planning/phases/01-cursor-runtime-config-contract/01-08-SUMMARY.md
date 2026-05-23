---
phase: 01-cursor-runtime-config-contract
plan: 08
subsystem: web-session-status
tags: [react, vitest, bun-test, sse, session-summary, accessibility]

requires:
  - phase: 01-cursor-runtime-config-contract
    provides: Composer-adjacent runtime model status from 01-07
  - phase: 01-cursor-runtime-config-contract
    provides: Strict runtime patch contract from 01-01 through 01-06
provides:
  - Compact accessible session-list status indicators
  - Session summary status/completion/error marker fields
  - Viewed completed-session marker tracking
  - Strict SSE cache convergence for status marker patches
affects: [session-list, sse-cache, web-runtime-config, shared-protocol]

tech-stack:
  added: []
  patterns:
    - Summary status derives from shared session data and strict SSE patch fields.
    - Session-list rows use one compact accessible indicator instead of runtime text.

key-files:
  created:
    - shared/src/sessionSummary.test.ts
    - .planning/phases/01-cursor-runtime-config-contract/01-08-SUMMARY.md
  modified:
    - shared/src/sessionSummary.ts
    - shared/src/schemas.ts
    - web/src/components/SessionList.tsx
    - web/src/components/SessionList/SessionListItem.tsx
    - web/src/components/SessionList/SessionListItem.test.tsx
    - web/src/components/SessionList.directory-action.test.tsx
    - web/src/components/SessionList.test.ts
    - web/src/hooks/useSSE.ts
    - web/src/hooks/useSSE.test.tsx
    - web/src/components/SessionChat.test.tsx
    - web/src/lib/locales/en.ts
    - web/src/lib/locales/zh-CN.ts

key-decisions:
  - "Derive compact row state from shared summary fields: statusKind, completionMarker, and errorMarker."
  - "Treat completion read state as web UI state keyed by session id and completion marker, so a later completed marker can become unread again."
  - "Keep strict SSE parsing and merge status marker patches directly into TanStack session summary caches without adding a refetch fallback."

patterns-established:
  - "Use `statusKind` plus nullable marker fields for list-level status, while keeping model and effort out of session rows."
  - "Use `hasOwnProperty` when applying nullable patch fields so explicit null clears differ from absent fields."

requirements-completed: [CURS-04]

duration: 8min
completed: 2026-05-23
---

# Phase 01 Plan 08: Compact Session Status Summary

**Compact live session-list indicators with shared status markers and strict SSE status patch convergence**

## Performance

- **Duration:** 8 min
- **Started:** 2026-05-23T15:43:02Z
- **Completed:** 2026-05-23T15:50:46Z
- **Tasks:** 2
- **Files modified:** 13

## Accomplishments

- Added `statusKind`, `completionMarker`, and `errorMarker` to `SessionSummary`, derived from session activity, pending requests, and completion/error end reasons.
- Replaced visible pending status text in session rows with one compact accessible indicator: spinner for running/thinking, yellow waiting dot, red error dot, green unread completion dot, and gray viewed/inactive dot.
- Added viewed completed-session tracking in `SessionList`, keyed by `session.id` plus `completionMarker`.
- Extended strict SSE patch handling so `statusKind`, `completionMarker`, and `errorMarker` patches converge into session summary caches without malformed-event fallback behavior.

## Task Commits

1. **Task 1 RED: Compact status indicator tests** - `6d92846` (test)
2. **Task 1 GREEN: Compact status indicators and summary markers** - `b015601` (feat)
3. **Task 2 RED: Strict status patch tests** - `4e48450` (test)
4. **Task 2 GREEN: Strict status patch cache convergence** - `f8022ad` (feat)
5. **Verification fix: Align model switch test expectations** - `5dced76` (test)

_Note: Both planned tasks used TDD test and implementation commits._

## Files Created/Modified

- `shared/src/sessionSummary.ts` - Adds summary status kind and completion/error marker derivation.
- `shared/src/schemas.ts` - Allows strict session patches to carry status and marker fields.
- `shared/src/sessionSummary.test.ts` - Covers thinking, waiting, completed marker, and error marker derivation.
- `web/src/components/SessionList.tsx` - Tracks viewed completion markers and passes viewed state to rows.
- `web/src/components/SessionList/SessionListItem.tsx` - Renders accessible compact indicators and removes visible pending/model/effort row status text.
- `web/src/hooks/useSSE.ts` - Merges strict status marker patches into summary cache state.
- `web/src/hooks/useSSE.test.tsx` - Covers model, effort, modelReasoningEffort, statusKind, completionMarker, errorMarker, and unknown-field rejection.
- `web/src/lib/locales/en.ts` and `web/src/lib/locales/zh-CN.ts` - Add thinking status label copy.
- `web/src/components/SessionChat.test.tsx` - Aligns full-suite model switch expectations with the existing retry target state.

## Decisions Made

- Status markers live in shared summary data rather than component-only inference. This keeps the list status surface reusable by SSE patches and tests.
- Viewed completion state remains in Web state instead of shared protocol state. It represents local user read state, not runtime session truth.
- SSE unknown-field handling remains strict. Unknown patch fields still log and leave caches untouched; no full-list refetch fallback was added.

## GitNexus Impact

- `toSessionSummary`: LOW risk, 0 direct callers, 0 affected processes.
- `SessionList`: LOW risk, 2 direct callers, 0 affected processes.
- `SessionListItem`: LOW risk, 2 direct callers, affected `SessionList` process.
- `useSSE`: LOW risk, 2 direct callers, affected `AppInner` process.
- `SessionPatchSchema`: LOW risk, 0 indexed direct callers.
- `SessionSchema`: LOW risk, 0 indexed direct callers.
- Pre-commit `detect_changes`: Task 1 GREEN reported MEDIUM risk due the session-list flow; Task 2 GREEN reported LOW risk with no affected processes.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Completed status-field fixture coverage after typecheck**
- **Found during:** Task 1 GREEN
- **Issue:** Adding required summary fields caused typecheck failures in existing Web summary fixtures, and TypeScript needed a non-null local completion marker for state updates.
- **Fix:** Added status marker defaults to affected fixtures and narrowed the completion marker before updating viewed state.
- **Files modified:** `web/src/components/SessionList.tsx`, `web/src/components/SessionList.test.ts`, `web/src/hooks/useSSE.test.tsx`
- **Verification:** `bun run typecheck`
- **Committed in:** `b015601`

**2. [Rule 3 - Blocking] Restored full Web test compatibility for model switch retry targets**
- **Found during:** Final full-suite verification
- **Issue:** Existing `SessionChat.test.tsx` assertions expected pre-01-07 switch state shapes, but the component now intentionally carries `targetModel` for retry.
- **Fix:** Updated the test expectations to include `targetModel: 'cursor-next'`.
- **Files modified:** `web/src/components/SessionChat.test.tsx`
- **Verification:** `cd web && bun run test -- SessionChat useSSE SessionListItem`; `bun run test`
- **Committed in:** `5dced76`

---

**Total deviations:** 2 auto-fixed (2 blocking issues)
**Impact on plan:** Both fixes were limited to verification and type safety. No package installs, architecture changes, new endpoints, or model/effort row text were introduced.

## Issues Encountered

- The initial shared RED test file had a brace typo before the failing behavioral assertions were confirmed; it was corrected before the RED commit.
- Targeted plan checks passed before the broad suite; `bun run test` then exposed the stale `SessionChat.test.tsx` expectation drift documented above.

## Known Stubs

None. Stub-pattern scan only found intentional nullable test fields and existing input placeholder locale strings.

## Threat Flags

None. The modified code does not introduce new network endpoints, auth paths, file access patterns, or trust-boundary schema changes beyond the planned strict SSE patch fields.

## TDD Gate Compliance

- RED commits present before implementation: `6d92846`, `4e48450`
- GREEN commits present after RED: `b015601`, `f8022ad`
- Verification fix after GREEN: `5dced76`

## Verification

- `cd shared && bun test sessionSummary.test.ts` - passed, 4 tests.
- `cd web && bun run test -- SessionListItem SessionList.directory-action` - passed, 12 tests.
- `cd web && bun run test -- useSSE SessionListItem` - passed, 22 tests.
- `bun run typecheck` - passed across CLI, Web, and Hub.
- `cd web && bun run test -- SessionChat useSSE SessionListItem` - passed, 33 tests across 4 files.
- `bun run test` - passed, including CLI, Hub, Web, and repo guard.
- `bun run madge:check` - passed with no circular dependencies.
- `bash scripts/check-no-cut-agents.sh` - passed.
- Source assertion: `SessionListItem.tsx` contains no `model` or `effort` text rendering.
- Source assertion: `SessionSummary` exposes `statusKind`, `completionMarker`, and `errorMarker`.
- Source assertion: status dots use `h-2 w-2`, and indicators use accessible labels/titles.
- Source assertion: `useSSE.ts` did not add a full-list refetch fallback for unknown patch fields.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Phase 1 is now complete from the plan set perspective: runtime model discovery, launch selection, composer model state, compact list status, and strict live patches are implemented and verified. The next step is phase-level verification before planning Phase 2.

## Self-Check: PASSED

- Found `.planning/phases/01-cursor-runtime-config-contract/01-08-SUMMARY.md`.
- Found `shared/src/sessionSummary.ts`.
- Found `shared/src/schemas.ts`.
- Found `shared/src/sessionSummary.test.ts`.
- Found `web/src/components/SessionList.tsx`.
- Found `web/src/components/SessionList/SessionListItem.tsx`.
- Found `web/src/hooks/useSSE.ts`.
- Found `web/src/hooks/useSSE.test.tsx`.
- Found task commit `6d92846`.
- Found task commit `b015601`.
- Found task commit `4e48450`.
- Found task commit `f8022ad`.
- Found verification fix commit `5dced76`.

---

*Phase: 01-cursor-runtime-config-contract*
*Completed: 2026-05-23*
