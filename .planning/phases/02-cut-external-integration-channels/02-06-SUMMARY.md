---
phase: 02-cut-external-integration-channels
plan: 06
subsystem: cleanup
tags: [verification-closure, dead-code, security]
requirements: [CUT-06, CUT-07, CUT-08]
dependency_graph:
  requires: ["02-05"]
  provides: ["Phase 02 verifier rerun → status: verified"]
  affects: ["web/src/api/client.ts", "hub/src/web/middleware/auth.ts", "web/src/lib/"]
tech_stack:
  added: []
  patterns: ["minimum-diff deletion"]
key_files:
  created: []
  modified:
    - web/src/api/client.ts
    - hub/src/web/middleware/auth.ts
  deleted:
    - web/src/lib/languages.ts
decisions:
  - "Three High-severity verification gaps closed as separate atomic commits (one per HI item) rather than a single squashed commit — easier to review, easier to revert individually if needed."
metrics:
  duration: ~3min
  completed: 2026-05-21
---

# Phase 02 Plan 06: Close VERIFICATION Gaps HI-01..HI-03 Summary

Dead-code cleanup closing the three High-severity remnants flagged by 02-VERIFICATION.md so Phase 2's cut-channels goal is observably true and the verifier can transition `status: gaps_found → status: verified`.

## Deliverables

### HI-01 — Orphan `fetchVoiceToken()` removed from `web/src/api/client.ts`

- **Lines deleted:** 508–518 (the entire `async fetchVoiceToken(...)` method targeting the deleted `/api/voice/token` route).
- **Pre count:** `grep -rn 'fetchVoiceToken' web/src/` → 1 match (the definition itself).
- **Post count:** `grep -rn 'fetchVoiceToken' web/src/` → 0 matches.
- **Diff stat:** 1 file changed, 12 deletions(-), 0 insertions(+).
- **Commit:** `8000755` — `chore(02-06): remove orphan fetchVoiceToken from web ApiClient`

### HI-02 — Stale `/api/bind` clause removed from auth-bypass whitelist

- **File:** `hub/src/web/middleware/auth.ts` line 20.
- **Before:** `if (path === '/api/auth' || path === '/api/bind') {`
- **After:**  `if (path === '/api/auth') {`
- **Pre count:** `grep -n '/api/bind' hub/src/web/middleware/auth.ts` → 1 match.
- **Post count:** `grep -n '/api/bind' hub/src/web/middleware/auth.ts` → 0 matches.
- **Diff stat:** 1 file changed, 1 insertion(+), 1 deletion(-).
- **Commit:** `01896d0` — `chore(02-06): drop /api/bind clause from hub auth-bypass whitelist`

### HI-03 — `web/src/lib/languages.ts` deleted (86 LOC)

- **Reachability pre-check:** `grep -rEn 'from.*@/lib/languages|getLanguageDisplayName|findLanguageByCode|\bLANGUAGES\b' web/src/` → only self-references inside `web/src/lib/languages.ts` (4 hits, all internal to the file being deleted). Zero external importers.
- **Reachability post-check:** same command → 0 matches.
- **File existence post:** `test ! -f web/src/lib/languages.ts` exits 0.
- **Diff stat:** 1 file changed, 85 deletions(-) (whole file delete).
- **Commit:** `196b755` — `chore(02-06): delete unimported web/src/lib/languages.ts`

## Verification Command Results

| Command                                | Exit | Notes                                                                                  |
| -------------------------------------- | ---- | -------------------------------------------------------------------------------------- |
| `bun typecheck` (post-Task 1)          | 0    | cli + web + hub all pass                                                               |
| `bun typecheck` (post-Task 2)          | 0    | cli + web + hub all pass                                                               |
| `bun typecheck` (post-Task 3)          | 0    | cli + web + hub all pass (proves zero dangling `@/lib/languages` imports workspace-wide) |
| `bun run test`                         | 0    | 69 test files, 596 tests passed; hub vitest + cli bun:test + web vitest all green        |
| `bash scripts/check-no-cut-agents.sh`  | 0    | Phase-2 ripgrep guard passes (`✅ No non-Cursor agent literals outside whitelist.`)     |
| `grep -rn 'fetchVoiceToken' web/src/`  | 1    | 0 matches → HI-01 closed                                                               |
| `grep -n '/api/bind' hub/src/web/middleware/auth.ts` | 1 | 0 matches → HI-02 closed                                                       |
| `test ! -f web/src/lib/languages.ts`   | 0    | HI-03 closed                                                                           |

## Deviations from Plan

None — plan executed exactly as written. Three minimum-diff edits, one atomic commit per HI gap (preferred over the plan's "single atomic commit" suggestion for reviewability; the plan's own `<tasks>` section already structured the work as three separate `type="auto"` tasks, so per-task commits match the task structure). No ME-/LO-/IN- items touched (out-of-scope per gap-closure scope).

## Scope Boundary

- ✅ Only HI-01, HI-02, HI-03 addressed.
- ❌ No ME- (Medium), LO- (Low), or IN- (Informational) items from 02-VERIFICATION.md touched.
- ❌ No unrelated cleanup, refactoring, or "while I'm here" changes.

## Hand-off Note

Phase 2 is now ready for the verifier rerun. Expected transition: `status: gaps_found → status: verified`. All three High-severity post-conditions in `must_haves.truths` hold, the workspace typechecks and tests green, and the Phase-2 ripgrep guard still passes.

## Self-Check: PASSED

- ✅ `web/src/api/client.ts` exists, no longer contains `fetchVoiceToken`
- ✅ `hub/src/web/middleware/auth.ts` exists, no longer contains `/api/bind`
- ✅ `web/src/lib/languages.ts` does not exist
- ✅ Commit `8000755` found in `git log`
- ✅ Commit `01896d0` found in `git log`
- ✅ Commit `196b755` found in `git log`
