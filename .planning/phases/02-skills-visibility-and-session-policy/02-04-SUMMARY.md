---
phase: 02-skills-visibility-and-session-policy
plan: 04
subsystem: cli
tags: [skills, cursor, preamble, session-policy, vitest]

requires:
  - phase: 02-01
    provides: SkillSummary, isEffectivelyAllowed, metadata.skillPolicy schema
provides:
  - buildSkillPolicyPreamble deterministic one-line prefix
  - runCursor onUserMessage preamble prepend from cached discovery + live metadata.skillPolicy
  - ApiSessionClient.getMetadata for session policy reads
affects:
  - 02-06 Web skills sheet (honest HAPI-only enforcement copy aligns with CLI)
  - Cursor agent turns (optional preamble on user batches)

tech-stack:
  added: []
  patterns:
    - "HAPI session skill policy marker prefix; no Cursor enforcement claims"
    - "listSkills cached once per runCursor session; policy read per message"

key-files:
  created:
    - cli/src/cursor/skillPolicyPreamble.ts
    - cli/src/cursor/skillPolicyPreamble.test.ts
  modified:
    - cli/src/cursor/runCursor.ts
    - cli/src/cursor/runCursor.test.ts
    - cli/src/api/apiSession.ts
    - cli/src/agent/sessionFactory.ts

key-decisions:
  - "Preamble prepended once per formatted user message batch, not per attachment"
  - "Allowed skill names sorted lexicographically in preamble"
  - "skillPolicy preserved in pickExistingSessionMetadata on CLI session resume"

patterns-established:
  - "applySkillPolicyToFormattedMessage composes formatMessageWithAttachments output with optional preamble"

requirements-completed: [SKIL-03]

duration: 3min
completed: 2026-05-26
---

# Phase 2 Plan 04: CLI Skill Policy Preamble Summary

**Deterministic HAPI session skill policy preamble prepended to Cursor user message batches from cached discovery and live metadata.skillPolicy**

## Performance

- **Duration:** 3 min
- **Started:** 2026-05-26T05:31:36Z
- **Completed:** 2026-05-26T05:34:53Z
- **Tasks:** 2
- **Files modified:** 6

## GitNexus Impact

| Target | Risk | Notes |
|--------|------|-------|
| `runCursor` | LOW | 0 upstream callers in index |
| `onUserMessage` | LOW | 0 upstream callers in index |

## Accomplishments

- Added `buildSkillPolicyPreamble` / `applySkillPolicyToFormattedMessage` with `[HAPI session skill policy]` marker (D-11, D-13)
- Wired `runCursor` to cache `listSkills(workingDirectory)` at start and prepend preamble on `onUserMessage` using `session.getMetadata()?.skillPolicy` (D-10)
- Vitest coverage for preamble builder table cases and formatted-message prepend with disabled skills excluded

## Task Commits

1. **Task 1: buildSkillPolicyPreamble module** - `4579c1e` (test — includes implementation)
2. **Task 2: Wire preamble into runCursor onUserMessage** - `301fa1d` (feat)

## Files Created/Modified

- `cli/src/cursor/skillPolicyPreamble.ts` - Preamble builder and prepend helper
- `cli/src/cursor/skillPolicyPreamble.test.ts` - Table tests for policy filtering and marker wording
- `cli/src/cursor/runCursor.ts` - Cached skills + preamble on user message path
- `cli/src/cursor/runCursor.test.ts` - Prepend integration assertions
- `cli/src/api/apiSession.ts` - `getMetadata()` for live session policy
- `cli/src/agent/sessionFactory.ts` - Preserve `skillPolicy` on existing-session metadata merge

## Decisions Made

- Re-exported `applySkillPolicyToFormattedMessage` from `runCursor.ts` for focused tests without bootstrapping the full runner loop
- On `listSkills` failure, log and continue with empty cache (no preamble) rather than blocking sends

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] Preserve skillPolicy on CLI session resume metadata merge**
- **Found during:** Task 2
- **Issue:** `pickExistingSessionMetadata` omitted `skillPolicy`, so `bootstrapExistingSession` could strip Hub policy before first user message
- **Fix:** Copy `metadata.skillPolicy` when present in `pickExistingSessionMetadata`
- **Files modified:** `cli/src/agent/sessionFactory.ts`
- **Commit:** `301fa1d`

## TDD Gate Compliance

- `test(02-04)` commit precedes `feat(02-04)` for preamble builder; Task 1 implementation shipped in the test commit (acceptable combined RED+GREEN for new module)

## Self-Check: PASSED

- FOUND: cli/src/cursor/skillPolicyPreamble.ts
- FOUND: cli/src/cursor/skillPolicyPreamble.test.ts
- FOUND: cli/src/cursor/runCursor.ts
- FOUND: commit 4579c1e
- FOUND: commit 301fa1d
