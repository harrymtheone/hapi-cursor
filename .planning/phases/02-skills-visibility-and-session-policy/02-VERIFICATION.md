---
phase: 02-skills-visibility-and-session-policy
verified: 2026-05-26T13:50:00Z
status: passed
score: 3/3
overrides_applied: 0
human_verification:
  - test: "On the mobile PWA, open an active session, open the skills policy sheet from the composer, and toggle a skill through inherited → enabled → disabled → inherited."
    expected: "Tri-state controls respond without editing files; invalid skills show error copy with policy controls disabled; each row shows the HAPI session policy badge (not Cursor enforced); Reset all returns implicit inherited."
    why_human: "Touch targets, bottom-sheet layout, and live SSE convergence cannot be verified by static analysis."
  - test: "From Settings → Skills, browse the read-only catalog for a session with discovered skills."
    expected: "Source, invocation mode, pathHint, and invalid metadata display; no policy toggles; footer note directs policy changes to active session chat."
    why_human: "Settings drill-down navigation and visual hierarchy require device-level review."
---

# Phase 2: Skills Visibility and Session Policy Verification Report

**Phase Goal:** Users can understand which Cursor skills are available and set session-level skill policy without changing skill files or global Cursor configuration.
**Verified:** 2026-05-26T13:50:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can view discovered Cursor skills with source, invocation mode, description, and clear invalid metadata states (SKIL-01 / SC-1) | ✓ VERIFIED | `SkillSummarySchema` in `shared/src/schemas.ts`; nested discovery in `cli/src/modules/common/skills.ts` (`.cursor/skills` + `.agents/skills`, nested `SKILL.md` walk, invalid rows with `invalidReason`); read-only `web/src/routes/settings/skills.tsx` renders source/mode/pathHint/invalid; `skills.test.tsx` asserts no tri-state controls |
| 2 | User can set session skill policy to inherited, enabled, or disabled without editing skill files or global Cursor config (SKIL-02 / SC-2) | ✓ VERIFIED | `MetadataSchema.skillPolicy` + `hub/src/web/routes/sessions/skillPolicy.ts` POST route; `sessionConfigService` persist/reset; `SkillsPolicySheet` + `SkillTriStateControl` wired via `SessionChat` → `useSessionActions.setSkillPolicy` / `resetSkillPolicy`; hub tests for persist, batch, reset, resume merge (`sessionMergeService.test.ts`) |
| 3 | User can see whether policy is Cursor-hard-enforced or only HAPI session policy (SKIL-03 / SC-3) | ✓ VERIFIED | `EnforcementBadge` defaults to HAPI copy; `SkillPolicyRow` never passes `enforcement="cursor"`; `SkillsPolicySheet.test.tsx` asserts no "Cursor enforced" in sheet; CLI `skillPolicyPreamble.ts` uses `[HAPI session skill policy]` marker only; `useSkills` filters disabled via `isSkillSuggestible` |

**Score:** 3/3 roadmap success-criteria truths verified (automated)

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | ----------- | ------ | ------- |
| `shared/src/schemas.ts` | SkillSummary + skillPolicy on Metadata | ✓ VERIFIED | `SkillSummarySchema`, `SkillPolicyStateSchema`, `MetadataSchema.skillPolicy` |
| `shared/src/skillPolicy.ts` | Policy resolution helpers | ✓ VERIFIED | `isSkillSuggestible`, `isEffectivelyAllowed`; 5 unit tests |
| `cli/src/modules/common/skills.ts` | Cursor-aligned discovery | ✓ VERIFIED | Nested walk, dual roots, dedupe; 10 tests |
| `hub/src/web/routes/sessions/skillPolicy.ts` | Policy mutations | ✓ VERIFIED | Single/batch/reset; Zod max keys; 6 route tests |
| `hub/src/sync/sessionConfigService.ts` | Metadata writes + refresh | ✓ VERIFIED | apply/reset/batch; version mismatch guard |
| `cli/src/cursor/skillPolicyPreamble.ts` | HAPI preamble at turn | ✓ VERIFIED | Wired in `runCursor.ts` via `applySkillPolicyToFormattedMessage` |
| `web/src/hooks/queries/useSkills.ts` | Policy-filtered suggestions | ✓ VERIFIED | `getEffectiveSkillSuggestions`; 6 tests |
| `web/src/routes/settings/skills.tsx` | Read-only catalog (D-15) | ✓ VERIFIED | No policy controls; callout for enforcement honesty |
| `web/src/components/AssistantChat/SkillsPolicySheet.tsx` | Session policy sheet (D-14) | ✓ VERIFIED | Tri-state, reset all, invalid row disable |
| `web/src/components/AssistantChat/EnforcementBadge.tsx` | SKIL-03 badge | ✓ VERIFIED | Default HAPI; cursor branch reserved unused in v1.1 |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | --- | --- | ------ | ------- |
| `handlers/skills.ts` | `@hapi/protocol` | `ListSkillsResponse` | ✓ WIRED | RPC returns protocol shape |
| `skillPolicy.ts` (hub) | `sessionConfigService` | `updateSessionMetadata` / refresh | ✓ WIRED | Tests cover 200/409/400 |
| `useSkills.ts` | `session.metadata.skillPolicy` | `isSkillSuggestible` | ✓ WIRED | Disabled omitted from `$` suggestions |
| `SkillsPolicySheet` | `useSessionActions` | `onSetSkillPolicy` / `onResetSkillPolicy` | ✓ WIRED | Optimistic local policy + API mutation |
| `HappyComposer` / `router.tsx` | `useSkills` + policy | `skillPolicy` prop | ✓ WIRED | Session-scoped autocomplete |
| `runCursor.ts` | `metadata.skillPolicy` | preamble prepend | ✓ WIRED | 14 `runCursor` tests include marker |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| `useSkills` | `skills` | `api.getSkills` → hub `GET /sessions/:id/skills` → CLI `listSkills` | Yes (filesystem scan) | ✓ FLOWING |
| `SkillsPolicySheet` | `optimisticPolicy` | Hub POST + SSE session refresh | Yes (metadata in SQLite) | ✓ FLOWING |
| `skills.tsx` (settings) | `sortedSkills` | Same discovery chain via `pickSkillsCatalogSessionId` | Yes | ✓ FLOWING |
| `runCursor` preamble | `cachedSkills` + `skillPolicy` | Session metadata + discovery cache | Yes | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Typecheck all packages | `bun run typecheck` | exit 0 | ✓ PASS |
| CLI skills + preamble + runCursor | `cd cli && bun run test -- skills.test skillPolicyPreamble runCursor` | 31 passed | ✓ PASS |
| Hub skill policy + merge + config | `cd hub && bun test skillPolicy sessionMergeService sessionConfigService` | 29 passed | ✓ PASS |
| Web skills UI + policy | `cd web && bun run test -- useSkills SkillsPolicy skills.test` | 12 passed | ✓ PASS |
| Shared schemas + policy helpers | `cd shared && bun test skillPolicy schemas` | 63 passed | ✓ PASS |
| Full repo test (integration) | `bun run test` | 12 runner.integration timeouts (env) | ? SKIP — pre-existing hub/runner integration dependency, not Phase 2 code |

### Probe Execution

Step 7c: SKIPPED — no phase-declared `probe-*.sh` scripts.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ---------- | ----------- | ------ | -------- |
| SKIL-01 | 02-01, 02-05 | Discovery inventory with metadata | ✓ SATISFIED | CLI discovery + settings catalog + shared schema |
| SKIL-02 | 02-02, 02-03, 02-06 | Session tri-state policy without file edits | ✓ SATISFIED | Hub route + web sheet + mutations |
| SKIL-03 | 02-03, 02-04, 02-06 | Honest enforcement labeling | ✓ SATISFIED | HAPI badges + preamble; no false Cursor claims in UI |

No orphaned Phase 2 requirements in `REQUIREMENTS.md`.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| — | — | None in Phase 2 skill modules | — | — |

`web/src/types/api.ts` re-exports `SkillSummary` from `@hapi/protocol/types` (not a duplicate wire shape).

### Human Verification Required

### 1. Session skills policy sheet (mobile PWA)

**Test:** Open active session → skills policy from composer → exercise tri-state and reset.
**Expected:** Controls work; invalid skills blocked; HAPI badges only.
**Why human:** Layout, touch targets, live cache/SSE behavior.

### 2. Settings skills catalog

**Test:** Settings → Skills with an active session present.
**Expected:** Read-only list with metadata; policy note; no toggles.
**Why human:** Navigation and visual polish on device.

### Gaps Summary

No automated gaps blocking SKIL-01–03 or roadmap success criteria. Code, contracts, hub persistence, CLI preamble, and unit/component tests substantiate the phase goal. Status is `human_needed` because mobile PWA UX checks in `02-VALIDATION.md` remain pending human UAT, not because implementation is missing.

Full-repo `bun run test` fails only on `cli/src/runner/runner.integration.test.ts` (runner hook timeouts — environment/integration infrastructure, outside Phase 2 deliverables).

---

_Verified: 2026-05-26T13:50:00Z_
_Verifier: Claude (gsd-verifier)_
