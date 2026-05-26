---
phase: 02-skills-visibility-and-session-policy
plan: 03
subsystem: ui
tags: [react, tanstack-query, skills, skill-policy, vitest, hapi-protocol]

requires:
  - phase: 02-01
    provides: SkillSummary, SkillPolicyState, isSkillSuggestible in @hapi/protocol
  - phase: 02-02
    provides: Hub POST /skill-policy and metadata persistence
provides:
  - Web ApiClient skill policy mutations aligned with Hub routes
  - useSessionActions skillPolicyMutation and resetSkillPolicyMutation
  - Policy-filtered $ autocomplete via getEffectiveSkillSuggestions
affects:
  - 02-04 (CLI preamble uses same policy helpers)
  - 02-06 (Skills policy sheet wires mutations and composer affordance)

tech-stack:
  added: []
  patterns:
    - "Re-export protocol skill types from web/types/api.ts instead of duplicating"
    - "Session metadata skillPolicy passed into useSkills from SessionPage"
    - "Pure getEffectiveSkillSuggestions helper for testable autocomplete filtering"

key-files:
  created:
    - web/src/hooks/queries/useSkills.test.ts
  modified:
    - web/src/types/api.ts
    - web/src/api/client.ts
    - web/src/hooks/mutations/useSessionActions.ts
    - web/src/hooks/queries/useSkills.ts
    - web/src/router.tsx
    - shared/src/index.ts

key-decisions:
  - "Export skillPolicy helpers from @hapi/protocol root so Web imports match other protocol surfaces"
  - "skillPolicyMutation accepts single-key or full-map writes; resetSkillPolicyMutation is separate"

patterns-established:
  - "Filter discovery skills with valid && isSkillSuggestible before fuzzy/recent ordering"
  - "recent-skills localStorage only reorders allowed skills (D-18)"

requirements-completed: [SKIL-02, SKIL-03]

duration: 3min
completed: 2026-05-26
---

# Phase 02 Plan 03: Web Policy Wire Summary

**Web skill policy HTTP mutations and session-policy-filtered $ autocomplete using shared @hapi/protocol types**

## Performance

- **Duration:** 3 min
- **Started:** 2026-05-26T05:32:54Z
- **Completed:** 2026-05-26T05:35:30Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- Removed duplicate `SkillSummary` / `SkillsResponse` from `web/src/types/api.ts`; `getSkills` returns `ListSkillsResponse` (D-05)
- Added `setSkillPolicy`, `applySkillPolicy`, `resetSkillPolicy` on `ApiClient` and TanStack mutations on `useSessionActions` with session invalidation (D-08)
- `getEffectiveSkillSuggestions` filters disabled and invalid skills; `SessionPage` passes `session.metadata.skillPolicy` (D-12, D-18)
- Vitest table coverage for disabled, enabled, inherited, invalid, and recent-ordering cases

## Task Commits

1. **Task 1: ApiClient and remove duplicate SkillSummary** - `e7538ee` (feat)
2. **Task 2: Policy-aware useSkills suggestions** - `4fb3ff3` (test), `0a22900` (feat)

## GitNexus Impact

| Symbol | Risk | Direct callers |
|--------|------|----------------|
| `useSkills` | LOW | `SessionPage` |
| `ApiClient.getSkills` | LOW | `useSkills` queryFn |

`detect_changes` after execution: **low** risk, 0 affected processes.

## Files Created/Modified

- `web/src/api/client.ts` - Skill policy POST methods; `ListSkillsResponse` on `getSkills`
- `web/src/hooks/mutations/useSessionActions.ts` - Policy mutations + invalidation
- `web/src/hooks/queries/useSkills.ts` - `getEffectiveSkillSuggestions` + optional `skillPolicy` param
- `web/src/hooks/queries/useSkills.test.ts` - Policy filter regression tests
- `web/src/router.tsx` - Passes `session.metadata.skillPolicy` into `useSkills`
- `web/src/types/api.ts` - Re-exports protocol skill types; no local duplicate
- `shared/src/index.ts` - Re-exports `skillPolicy` helpers

## Decisions Made

- Exported `isSkillSuggestible` from `@hapi/protocol` package entry so Web does not reach into internal paths
- Combined single-key and full-map writes in one `skillPolicyMutation` union; dedicated `resetSkillPolicyMutation`

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Root `bun run typecheck` fails on pre-existing `cli/src/cursor/skillPolicyPreamble.test.ts` (02-04 scope); `web` package typecheck passes

## TDD Gate Compliance

- RED: `4fb3ff3` test(02-03)
- GREEN: `0a22900` feat(02-03)

## Next Phase Readiness

- Web can mutate policy and filter autocomplete; ready for 02-04 CLI preamble and 02-06 policy sheet UI
- SSE metadata branch in `useSSE` already refreshes session cache when Hub emits full metadata (no change required this plan)

## Self-Check: PASSED

- FOUND: web/src/hooks/queries/useSkills.test.ts
- FOUND: web/src/api/client.ts (setSkillPolicy, applySkillPolicy, resetSkillPolicy)
- FOUND: commit e7538ee
- FOUND: commit 4fb3ff3
- FOUND: commit 0a22900

---
*Phase: 02-skills-visibility-and-session-policy*
*Completed: 2026-05-26*
