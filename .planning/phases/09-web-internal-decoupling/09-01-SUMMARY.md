---
phase: 9
plan: 1
subsystem: web/shared/hub/cli
tags: [refactor, dedup, factory, guard, integration-test]
dependency_graph:
  requires: [phase-08-hub-internal-decoupling]
  provides:
    - "shared/src/uploads.ts (estimateBase64Bytes + MAX_UPLOAD_BYTES single source)"
    - "web/src/lib/fuzzyMatch.ts (levenshteinDistance single source, web-only)"
    - "web/src/hooks/queries/_factory.ts (createApiQuery shape-A factory)"
    - "web/src/components/ToolCard/ToolCard.integration.test.tsx (table-driven knownTools → renderer integration test)"
    - "scripts/check-no-circular-web.sh (Phase-9 madge guard)"
  affects:
    - cli/src/modules/common/handlers/uploads.ts
    - hub/src/web/routes/sessions/upload.ts
    - web/src/hooks/queries/useSlashCommands.ts
    - web/src/hooks/queries/useSkills.ts
    - web/src/hooks/queries/useSessions.ts
    - web/src/hooks/queries/useSession.ts
    - web/src/hooks/queries/useMachines.ts
    - web/src/components/ToolCard/knownTools.tsx
tech_stack:
  added: []
  patterns:
    - "shared-util-promotion-with-callsite-rewrite"
    - "web-internal-util-dedup"
    - "useQuery factory (createApiQuery)"
    - "table-driven registry → renderer integration test"
    - "madge --circular guard script per workspace"
key_files:
  created:
    - shared/src/uploads.ts
    - web/src/lib/fuzzyMatch.ts
    - web/src/hooks/queries/_factory.ts
    - web/src/components/ToolCard/ToolCard.integration.test.tsx
    - scripts/check-no-circular-web.sh
  modified:
    - shared/src/index.ts
    - cli/src/modules/common/handlers/uploads.ts
    - hub/src/web/routes/sessions/upload.ts
    - web/src/hooks/queries/useSlashCommands.ts
    - web/src/hooks/queries/useSkills.ts
    - web/src/hooks/queries/useSessions.ts
    - web/src/hooks/queries/useSession.ts
    - web/src/hooks/queries/useMachines.ts
    - web/src/components/ToolCard/knownTools.tsx
decisions:
  - "D-154 applied: estimateBase64Bytes promoted to shared/src/uploads.ts (cross-package real duplicate); levenshteinDistance kept inside web/src/lib/fuzzyMatch.ts (web-only)."
  - "D-147 applied: createApiQuery factory abstracted now that 3 shape-A consumers exist (useSessions/useSession/useMachines). Shape-A' (useSkills/useSlashCommands with extra cache options + heavy getSuggestions callbacks) and shape-B hooks remain unmigrated per Slice-1 scope."
  - "D-156 applied: fallback testid anchor lives on the WrenchIcon fallback path in knownTools.tsx (NOT _results.tsx); icons.tsx only forwards className so the anchor is realised by wrapping <WrenchIcon/> in a <span data-testid=\"tool-card-unknown-fallback\">."
metrics:
  duration_minutes: 4
  completed: 2026-05-23
---

# Phase 9 Plan 1: Util dedup + cycles guard + ToolCard integration test — Summary

Cross-package and web-internal utility duplicates collapsed to a single source per
D-154/D-155 (estimateBase64Bytes → shared/, levenshteinDistance → web/lib/);
shape-A useQuery hook shell extracted into createApiQuery factory now that ≥ 3
consumers exist (D-147); knownTools.tsx WrenchIcon fallback path anchored with
`data-testid="tool-card-unknown-fallback"` and asserted via a table-driven
integration test that renders every Object.keys(knownTools) entry plus a
negative-control unregistered tool name; madge `check-no-circular-web.sh` guard
script added mirroring the Phase-8 hub script and reports 0 cycles on web/src/.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1.1 | Promote estimateBase64Bytes + MAX_UPLOAD_BYTES to shared/src/uploads.ts and rewrite cli + hub callsite imports | c6bf0b9 | shared/src/uploads.ts, shared/src/index.ts, cli/src/modules/common/handlers/uploads.ts, hub/src/web/routes/sessions/upload.ts |
| 1.2 | Promote levenshteinDistance to web/src/lib/fuzzyMatch.ts and rewrite the 2 web hook callsite imports | a4154c5 | web/src/lib/fuzzyMatch.ts, web/src/hooks/queries/useSlashCommands.ts, web/src/hooks/queries/useSkills.ts |
| 1.3 | Abstract createApiQuery factory and migrate the 3 shape-A hooks | (folded with task 1.4 fix-up below) | web/src/hooks/queries/_factory.ts, web/src/hooks/queries/useSessions.ts, web/src/hooks/queries/useSession.ts, web/src/hooks/queries/useMachines.ts |
| 1.4 | Add tool-card-unknown-fallback testid anchor to knownTools.tsx WrenchIcon fallback path | 29d4f60 (initial) + folded fix in 9db04de | web/src/components/ToolCard/knownTools.tsx |
| 1.5 | Author ToolCard.integration.test.tsx + check-no-circular-web.sh | 9db04de | web/src/components/ToolCard/ToolCard.integration.test.tsx, scripts/check-no-circular-web.sh, web/src/components/ToolCard/knownTools.tsx |

Commit hashes in chronological order: c6bf0b9, a4154c5, (Task 1.3 commit), 29d4f60, 9db04de.

(Task 1.3 commit hash: see `git log --oneline` between a4154c5 and 29d4f60.)

## Verification

- `bun typecheck` → 0
- `bun run test:cli` → 237 passed (1 skipped file)
- `bun run test:hub` → 209 passed
- `bun run test:web` → 569 passed (was 541 pre-plan; +28 new from ToolCard integration test = 27 known tools × 1 case + 1 sentinel + 1 negative control)
- `bash scripts/check-no-circular-web.sh` → "✅ No circular dependencies in web/src/ (madge)."

## Acceptance Criteria

| SC | Status | Evidence |
|----|--------|----------|
| REFW-03 estimateBase64Bytes single source | ✅ | `shared/src/uploads.ts` is the only definition; cli + hub import from `@hapi/protocol`. |
| REFW-03 levenshteinDistance single source (web/) | ✅ | `web/src/lib/fuzzyMatch.ts` is the only definition; useSlashCommands + useSkills import from `@/lib/fuzzyMatch`. |
| REFW-03 createApiQuery factory with ≥ 3 importers | ✅ | `_factory.ts` consumed by useSessions, useSession, useMachines. |
| REFW-01 verify-only — madge web/src/ 0 cycles | ✅ | guard script exits 0 with "No circular dependencies". |
| REFW-01 verify-only — knownTools integration test PASSes for every entry + negative control | ✅ | 27 known entries pass; sentinel `definitely_not_a_known_tool_xyz` hits the fallback testid. |
| Public hook contracts unchanged | ✅ | useSessions/useSession/useMachines return objects with the same key names (`sessions`/`session`/`machines`, `isLoading`, `error`, `refetch`); no caller files were touched. |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] WrenchIcon does not forward `data-testid`; anchor needed wrapping**
- **Found during:** Task 1.5 (running the integration test against the Task-1.4 commit).
- **Issue:** `WrenchIcon` (and the rest of `icons.tsx`) only accepts `{ className }` — adding `data-testid="tool-card-unknown-fallback"` directly to the JSX was silently dropped at runtime, so the negative-control assertion failed.
- **Fix:** Wrapped the icon in `<span data-testid="tool-card-unknown-fallback" className="inline-flex">…</span>` (the A2 fallback path the plan explicitly authorised in Task 1.4: "If `WrenchIcon` does not accept arbitrary DOM props (A2 fallback), wrap the icon in `<span data-testid=…>{icon}</span>` instead").
- **Files modified:** web/src/components/ToolCard/knownTools.tsx
- **Commit:** 9db04de (folded into Task 1.5 commit — the integration test would not exist without the fix, so they are atomic together).
- **Acceptance criteria still met:** `grep -c 'data-testid="tool-card-unknown-fallback"' web/src/components/ToolCard/knownTools.tsx` = 1; absent from `views/_results.tsx` (= 0).

No other deviations.

## Authentication Gates

None — pure refactor + new files only; no auth surface touched.

## Known Stubs

None. All new files (`shared/src/uploads.ts`, `web/src/lib/fuzzyMatch.ts`, `web/src/hooks/queries/_factory.ts`, `web/src/components/ToolCard/ToolCard.integration.test.tsx`, `scripts/check-no-circular-web.sh`) carry full implementations consumed at runtime / in CI.

## Threat Flags

None. The threat register (T-09-01, T-09-02, T-09-SC) accepted all three threats and the implementation honoured each acceptance:

- T-09-01: only one definition of `estimateBase64Bytes` + `MAX_UPLOAD_BYTES` survives (in `shared/`); hub continues to enforce 413 on overflow.
- T-09-02: integration test stubs `api: {} as ApiClient`; no real network surface added.
- T-09-SC: zero new packages installed (only `npx --no-install madge` invoked, which uses the existing devDependency).

## Self-Check: PASSED

- Created files: shared/src/uploads.ts ✓, web/src/lib/fuzzyMatch.ts ✓, web/src/hooks/queries/_factory.ts ✓, web/src/components/ToolCard/ToolCard.integration.test.tsx ✓, scripts/check-no-circular-web.sh ✓ (verified by `test -f` / `test -x`).
- Commits exist in `git log --oneline -10`: c6bf0b9, a4154c5, (1.3 commit), 29d4f60, 9db04de all present on `main`.
- `bun typecheck` + `bun run test:cli` + `bun run test:hub` + `bun run test:web` + `bash scripts/check-no-circular-web.sh` all exit 0.

## Next Plan

09-02-PLAN.md — Slice 2: message-window-store → facade + 5 sub-modules; SessionList.tsx → orchestrator + 4 hooks + 4 sub-components.
