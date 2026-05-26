---
phase: 02-skills-visibility-and-session-policy
plan: 05
subsystem: ui
tags: [react, settings, skills, tanstack-router, i18n]

requires:
  - phase: 02-03
    provides: useSkills hook and GET /sessions/:id/skills protocol wiring
provides:
  - Read-only /settings/skills catalog (D-15, SKIL-01)
  - SkillsSection settings index drill-down with discovery count subtitle
affects:
  - 02-06 (session policy sheet may link to catalog)

tech-stack:
  added: []
  patterns:
    - "Session-scoped skill discovery via pickSkillsCatalogSessionId (active session by activeAt, else latest updated)"
    - "Settings catalog mirrors models page chrome without Save or policy controls"

key-files:
  created:
    - web/src/routes/settings/skills.tsx
    - web/src/routes/settings/skills.test.tsx
    - web/src/routes/settings/skillsSession.ts
    - web/src/routes/settings/_sections/SkillsSection.tsx
  modified:
    - web/src/routes/settings/index.tsx
    - web/src/router.tsx
    - web/src/hooks/useAppGoBack.ts
    - web/src/hooks/queries/useSkills.ts
    - web/src/lib/locales/en.ts
    - web/src/lib/locales/zh-CN.ts

key-decisions:
  - "Catalog session id: most recently active session by activeAt, else most recently updated session"
  - "pathHint rendered from protocol only (T-02-10); no cwd concatenation in UI"

patterns-established:
  - "D-15 separation: settings catalog is browse-only; policy edits remain session-scoped (02-06)"

requirements-completed: [SKIL-01]

duration: 3min
completed: 2026-05-26
---

# Phase 02 Plan 05: Read-Only Skills Catalog Summary

**Read-only skills catalog at `/settings/skills` with settings index drill-down, session-scoped discovery, and SKIL-01 metadata rows — no policy toggles (D-15).**

## Performance

- **Duration:** 3 min
- **Started:** 2026-05-26T05:37:01Z
- **Completed:** 2026-05-26T05:40:26Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments

- Settings index **Skills catalog** row navigates to `/settings/skills` with count / error / loading subtitle.
- **SkillsCatalogPage** lists discovered skills (source pill, invocation mode, validity, pathHint) sorted project → user → name.
- Top callout and footer note clarify enforcement is per-session; tests assert no `setSkillPolicy` calls.

## Task Commits

1. **Task 1: Settings navigation and i18n shell** - `cfe682f` (feat)
2. **Task 2: Read-only SkillsCatalogPage** - `1c1bb4c` (test), `184f608` (feat)

## Files Created/Modified

- `web/src/routes/settings/_sections/SkillsSection.tsx` - Settings index drill-down row
- `web/src/routes/settings/skillsSession.ts` - Active-session picker for catalog discovery
- `web/src/routes/settings/skills.tsx` - Read-only catalog page
- `web/src/routes/settings/skills.test.tsx` - Read-only and invalid-row assertions
- `web/src/router.tsx` - `settingsSkillsRoute` at `/settings/skills`
- `web/src/hooks/useAppGoBack.ts` - Back from skills catalog to settings
- `web/src/hooks/queries/useSkills.ts` - `refetch` for catalog retry
- `web/src/lib/locales/en.ts`, `zh-CN.ts` - `settings.skills.*` keys

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED

- FOUND: web/src/routes/settings/skills.tsx
- FOUND: web/src/routes/settings/skills.test.tsx
- FOUND: web/src/routes/settings/_sections/SkillsSection.tsx
- FOUND: cfe682f
- FOUND: 1c1bb4c
- FOUND: 184f608
