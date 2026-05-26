---
phase: 02-skills-visibility-and-session-policy
plan: 01
subsystem: api
tags: [zod, skills, cursor, protocol, cli, discovery]

requires: []
provides:
  - SkillSummary and ListSkillsResponse Zod schemas in @hapi/protocol
  - MetadataSchema.skillPolicy optional record
  - isSkillSuggestible / isEffectivelyAllowed policy helpers
  - Cursor-aligned nested listSkills discovery in CLI
  - listSkills RPC typed against shared ListSkillsResponse
affects:
  - 02-02 Hub session policy routes
  - 02-03 Web client and useSkills
  - 02-04 Composer autocomplete filtering

tech-stack:
  added: []
  patterns:
    - "Shared-first SkillSummary wire shape (strict Zod)"
    - "Nested SKILL.md walk under .cursor and .agents roots"
    - "pathHint redaction with tilde-prefixed user paths"

key-files:
  created:
    - shared/src/skillPolicy.ts
    - shared/src/skillPolicy.test.ts
  modified:
    - shared/src/schemas.ts
    - shared/src/types.ts
    - shared/src/schemas.test.ts
    - cli/src/modules/common/skills.ts
    - cli/src/modules/common/skills.test.ts
    - cli/src/modules/common/handlers/skills.ts

key-decisions:
  - "skillPolicy lives on MetadataSchema only — not SessionPatchSchema (D-17)"
  - "Missing policy rows are inherited via isSkillSuggestible / isEffectivelyAllowed (D-07)"
  - "disable-model-invocation frontmatter maps to invocationMode manual (D-04 / A2)"

patterns-established:
  - "Invalid SKILL.md rows stay in inventory with valid false and invalidReason"
  - "Project skills dedupe before user skills by skill name"

requirements-completed: [SKIL-01]

duration: 4min
completed: 2026-05-26
---

# Phase 2 Plan 01: Shared Contracts and CLI Discovery Summary

**@hapi/protocol SkillSummary with nested .cursor/.agents discovery, invalid-row visibility, and listSkills RPC aligned to ListSkillsResponse**

## Performance

- **Duration:** 4 min
- **Started:** 2026-05-26T05:22:21Z
- **Completed:** 2026-05-26T05:26:00Z
- **Tasks:** 3
- **Files modified:** 8

## GitNexus Impact

| Target | Risk | Notes |
|--------|------|-------|
| `listSkills` | HIGH | Expected — intentional shape expansion; 1 direct caller (`registerSkillsHandlers`) |
| `registerSkillsHandlers` | HIGH | Type-only handler change; signature unchanged |

## Accomplishments

- Promoted `SkillSummary`, `SkillPolicyState`, `ListSkillsResponse`, and `MetadataSchema.skillPolicy` to `@hapi/protocol` with strict Zod and tests
- Added `isSkillSuggestible` and `isEffectivelyAllowed` helpers (inherited default; disabled excluded)
- Expanded CLI `listSkills` to recursive `.cursor/skills` and `.agents/skills` roots with nested `SKILL.md`, invalid rows, pathHint redaction, and project-over-user dedupe
- Wired `handlers/skills.ts` to import `ListSkillsResponse` from protocol

## Task Commits

1. **Task 1: Shared SkillSummary and skillPolicy schemas** - `7c46feb` (feat)
2. **Task 2: Expand CLI listSkills discovery** - `363a7d2` (feat)
3. **Task 3: Wire listSkills RPC to shared response shape** - `444d525` (feat)

## Files Created/Modified

- `shared/src/schemas.ts` - SkillSummary, skillPolicy metadata, ListSkillsResponse schemas
- `shared/src/skillPolicy.ts` - Policy helper functions for suggestibility and allowance
- `shared/src/skillPolicy.test.ts` - Helper unit tests
- `shared/src/schemas.test.ts` - Schema fixtures for skill rows and metadata.skillPolicy
- `cli/src/modules/common/skills.ts` - Nested discovery and protocol-shaped inventory
- `cli/src/modules/common/skills.test.ts` - Roots, nested, invalid, pathHint, dedupe coverage
- `cli/src/modules/common/handlers/skills.ts` - Protocol ListSkillsResponse import

## Decisions Made

- Kept `ListSkillsRequest` as an empty local interface; response types come from `@hapi/protocol/schemas`
- Documented in `isSkillSuggestible` that Cursor may still auto-invoke skills (D-10 honesty)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] SkillPolicyMapSchema temporal dead zone**
- **Found during:** Task 1 (schema tests)
- **Issue:** `MetadataSchema` referenced `SkillPolicyMapSchema` before its declaration
- **Fix:** Moved `SkillPolicyStateSchema` / `SkillPolicyMapSchema` above `MetadataSchema`
- **Files modified:** `shared/src/schemas.ts`
- **Committed in:** `7c46feb`

**2. [Rule 1 - Bug] Double-applied project skills roots**
- **Found during:** Task 2 (project discovery tests)
- **Issue:** `listProjectSkillsRoots` already returns skill root paths; `flatMap(getProjectSkillsRoots)` produced invalid nested paths
- **Fix:** Use `listProjectSkillsRoots` output directly as `projectRoots`
- **Files modified:** `cli/src/modules/common/skills.ts`
- **Committed in:** `363a7d2`

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Required for correct schema load and project skill discovery. No scope creep.

## Issues Encountered

None beyond deviations above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Hub `GET /sessions/:id/skills` can consume RPC inventory with shared schema (plans 02-02+)
- Web duplicate `SkillSummary` removal deferred to 02-03 per roadmap
- Policy persistence and UI surfaces remain in subsequent plans

## Self-Check: PASSED

- FOUND: shared/src/skillPolicy.ts
- FOUND: shared/src/schemas.ts (SkillSummarySchema)
- FOUND: cli/src/modules/common/skills.ts
- FOUND: cli/src/modules/common/handlers/skills.ts
- FOUND: commit 7c46feb
- FOUND: commit 363a7d2
- FOUND: commit 444d525

---
*Phase: 02-skills-visibility-and-session-policy*
*Completed: 2026-05-26*
