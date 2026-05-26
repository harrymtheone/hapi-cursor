---
phase: 02-skills-visibility-and-session-policy
plan: 02
subsystem: api
tags: [skills, session-metadata, hono, sqlite, zod, bun-test]

requires:
  - phase: 02-01
    provides: SkillPolicyStateSchema, SkillPolicyMapSchema, MetadataSchema.skillPolicy, ListSkillsResponse
provides:
  - Versioned Hub writes for metadata.skillPolicy with SSE refresh
  - POST /sessions/:id/skill-policy (single, batch, reset)
  - Resume merge deep-union of skillPolicy maps
affects: [02-03, 02-04, 02-06]

tech-stack:
  added: []
  patterns:
    - "Skill policy mutations mirror renameSession metadata version path, not applySessionConfig"
    - "Route body union: { name, state } | { skillPolicy } | { reset: true }"

key-files:
  created:
    - hub/src/web/routes/sessions/skillPolicy.ts
    - hub/src/web/routes/sessions/__tests__/skillPolicy.test.ts
  modified:
    - hub/src/sync/sessionConfigService.ts
    - hub/src/sync/sessionConfigService.test.ts
    - hub/src/sync/sessionCache.ts
    - hub/src/sync/syncEngine.ts
    - hub/src/sync/syncEngineSession.ts
    - hub/src/sync/sessionMergeService.ts
    - hub/src/sync/sessionMergeService.test.ts
    - hub/src/web/routes/sessions/index.ts
    - hub/src/web/routes/sessions/__tests__/read.test.ts
    - hub/src/web/routes/sessions/__tests__/_fixtures.ts

key-decisions:
  - "Skill policy writes use dedicated SessionConfigService methods, not applySessionConfig (D-17)"
  - "Oversized maps rejected at Zod parse layer (invalid-body) consistent with config routes"
  - "mergeSessionMetadata unions skillPolicy with incoming precedence for resume (D-09)"

patterns-established:
  - "SyncEngine facade exposes applySkillPolicy, applySkillPolicyBatch, resetSessionSkillPolicy"
  - "Max 200 policy keys and 128-char skill names enforced on service and route schemas"

requirements-completed: [SKIL-02]

metrics:
  duration: 5min
  completed: 2026-05-26
---

# Phase 2 Plan 02: Hub Skill Policy Persistence Summary

**Hub persists per-session skill tri-state policy in SQLite metadata with versioned writes, authenticated POST mutations, and resume-safe merge.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-05-26T05:25:00Z
- **Completed:** 2026-05-26T05:30:38Z
- **Tasks:** 3
- **Files modified:** 11

## Accomplishments

- SessionConfigService applies single-key, full-map, and reset skillPolicy updates with optimistic metadata versioning and `refreshSession` SSE (D-06, D-08, D-16, D-19)
- POST `/sessions/:id/skill-policy` wired with auth, Zod validation, 409 on version conflict, and map size limits (T-02-03, T-02-04)
- `mergeSessionMetadata` unions `skillPolicy` on resume with incoming key precedence (D-09)
- GET skills test fixtures updated to protocol `SkillSummary` objects (D-05)

## Task Commits

1. **Task 1: SessionConfigService skill policy writes** - `aa896a3` (feat)
2. **Task 2: POST skill-policy route and auth wiring** - `9d45601` (feat)
3. **Task 3: Resume merge preserves skillPolicy** - `622eb3f` (feat)

## Files Created/Modified

- `hub/src/sync/sessionConfigService.ts` - applySkillPolicy, applySkillPolicyBatch, resetSessionSkillPolicy
- `hub/src/web/routes/sessions/skillPolicy.ts` - POST route with documented body shapes
- `hub/src/sync/sessionMergeService.ts` - skillPolicy deep merge on resume
- Test files for service, route, and merge scenarios

## Deviations from Plan

None - plan executed as written. Oversized-map rejection uses `invalid-body` at parseJsonBody (same as permission-mode routes) rather than a custom `invalid-skill-policy` code.

## GitNexus Impact (pre-edit)

- `SessionConfigService.renameSession`: LOW — Sync module chain (sessionCache → syncEngineSession → syncEngine)
- New methods follow same facade pattern; no HIGH/CRITICAL risk

## Self-Check: PASSED

- FOUND: hub/src/web/routes/sessions/skillPolicy.ts
- FOUND: hub/src/sync/sessionConfigService.ts (skill policy methods)
- FOUND: aa896a3, 9d45601, 622eb3f
