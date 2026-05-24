---
phase: 01-cursor-runtime-config-contract
plan: 12
subsystem: web-runtime-config
tags: [react, tanstack-query, cursor-runtime, web-api]

requires:
  - phase: 01-cursor-runtime-config-contract
    provides: Hub and CLI no longer accept unsupported effort in spawn/session-config paths.
provides:
  - Web API client and hooks no longer expose unsupported effort mutation paths.
  - New-session spawn calls send selected model only, with auto omitted.
  - Composer effort metadata remains display-only from session/runtime data.
affects: [phase-01-runtime-config, web-composer, web-new-session]

tech-stack:
  added: []
  patterns:
    - Display-only runtime metadata for unsupported effort fields.
    - Model-only Web runtime mutation contract until Cursor effort support is verified.

key-files:
  created: []
  modified:
    - web/src/api/client.ts
    - web/src/hooks/mutations/useSpawnSession.ts
    - web/src/hooks/mutations/useSessionActions.ts
    - web/src/hooks/mutations/useSessionActions.test.ts
    - web/src/hooks/mutations/useSpawnSession.test.tsx
    - web/src/components/NewSession/NewSession.test.tsx
    - web/src/components/SessionChat.tsx
    - web/src/components/SessionChat.test.tsx
    - web/src/components/AssistantChat/HappyComposer.tsx
    - web/src/components/AssistantChat/HappyComposer.test.tsx

key-decisions:
  - "Keep Web effort support display-only until Cursor exposes verified separate effort mutation support."
  - "Preserve raw selected model forwarding while removing all unsupported effort payload slots from Web spawn calls."

patterns-established:
  - "Unsupported runtime metadata may be displayed from session data, but must not grow mutation callbacks or request payload fields."

requirements-completed: [CURS-02]

duration: 3min
completed: 2026-05-24
---

# Phase 01 Plan 12: Remove Unsupported Web Effort Mutation Summary

**Web runtime config is now model-only for mutation, while existing effort metadata remains visible as read-only session/runtime truth.**

## Performance

- **Duration:** 3min
- **Started:** 2026-05-24T02:05:31Z
- **Completed:** 2026-05-24T02:08:42Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments

- Removed `ApiClient.setEffort()` and the missing `/api/sessions/:id/effort` route call from the Web client.
- Removed `effort` from Web spawn input, `useSpawnSession`, and `ApiClient.spawnSession()` serialization, so new-session auto sends no model/effort and explicit launch sends only the selected raw model id.
- Removed the composer effort mutation callback path from `useSessionActions`, `SessionChat`, and `HappyComposerProps` while preserving `modelReasoningEffort` and `effort` display props into the status bar.

## Task Commits

Each task was committed atomically through RED/GREEN evidence:

1. **Task 1 RED: Remove unsupported Web effort API and spawn payload** - `2cc044c` (test)
2. **Task 2 RED: Make composer effort display read-only** - `80f22e1` (test)
3. **Task 1/2 GREEN: Remove Web effort mutation surface and preserve display-only metadata** - `eb34a16` (feat)

## Files Created/Modified

- `web/src/api/client.ts` - Removed `setEffort()` and removed `effort` from spawn request serialization.
- `web/src/hooks/mutations/useSpawnSession.ts` - Removed `effort` from spawn mutation input and API forwarding.
- `web/src/hooks/mutations/useSessionActions.ts` - Removed `setEffort` from returned actions and pending-state calculation.
- `web/src/hooks/mutations/useSessionActions.test.ts` - Covers absence of `setEffort` and unchanged model apply-result propagation.
- `web/src/hooks/mutations/useSpawnSession.test.tsx` - Covers selected model forwarding without unsupported effort payload.
- `web/src/components/NewSession/NewSession.test.tsx` - Covers auto launch and explicit selected model launch without an effort argument.
- `web/src/components/SessionChat.tsx` - Removed effort mutation handler and callback prop wiring.
- `web/src/components/SessionChat.test.tsx` - Covers effort metadata as display-only composer props.
- `web/src/components/AssistantChat/HappyComposer.tsx` - Removed unsupported effort mutation callback props.
- `web/src/components/AssistantChat/HappyComposer.test.tsx` - Covers stored effort display without effort controls.

## Decisions Made

- Separate effort stays read-only in Web because the Hub/CLI paths do not have verified separate Cursor effort mutation support.
- Model mutation remains the only Web runtime config action in `useSessionActions`; effort can re-enter later only through a verified runtime contract.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Root typecheck after Task 1 implementation caught the downstream `SessionChat` stale `setEffort` reference. This was the planned Task 2 dependency and was resolved by removing the composer effort callback path.
- Focused `SessionChat` tests still print pre-existing duplicate React key warnings for `session-1`; tests pass and this plan did not change that warning source.

## Known Stubs

None.

## Authentication Gates

None.

## Verification

- `cd web && bun run test -- useSessionActions NewSession useSpawnSession` - PASS
- `cd web && bun run test -- SessionChat HappyComposer StatusBar` - PASS
- `cd web && bun run test -- useSessionActions NewSession useSpawnSession SessionChat HappyComposer StatusBar` - PASS (52 tests; pre-existing duplicate key warnings in `SessionChat.test.tsx`)
- `bun run typecheck` - PASS
- `bash scripts/check-no-cut-agents.sh` - PASS
- Source assertion: no Web source `setEffort`, `/effort`, `onEffortChange`, `onModelReasoningEffortChange`, or `effortMutation` remain outside tests.
- Source assertion: `web/src/api/client.ts` and `web/src/hooks/mutations/useSpawnSession.ts` contain no `effort` spawn payload path.

## Next Phase Readiness

Ready for `01-13-PLAN.md`, the remaining Phase 01 gap closure for durable completion markers across refetch.

## Self-Check: PASSED

- `01-12-SUMMARY.md` exists.
- Commits `2cc044c`, `80f22e1`, and `eb34a16` exist in git history.

---
*Phase: 01-cursor-runtime-config-contract*
*Completed: 2026-05-24*
