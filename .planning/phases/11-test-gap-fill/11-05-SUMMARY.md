---
phase: 11-test-gap-fill
plan: 05
subsystem: testing/guards-and-coverage
tags: [phase-close, ripgrep-guard, coverage, non-regression, REFT-01, REFT-02, REFT-03]
requires: [11-01, 11-02, 11-03, 11-04]
provides:
  - "Phase 11 ripgrep guard block in scripts/check-no-cut-agents.sh: sub-check #1 (REFT-01 source-of-truth — no `permissionMode === '<literal>'` outside cli/src/{agent,cursor}/ + test files) and sub-check #2 (TESTING.md cross-runner — no `bun:test` in cli|web, no `vitest` in hub|shared)"
  - "Phase 11 coverage table + non-regression verdict in 11-DISCUSSION-LOG.md (### Phase 11 Coverage After) — GREEN for the two real-baseline scopes; the three unavailable scopes declared the new baseline per RESEARCH Open Question #3"
  - "Phase 11 Gate Results section in 11-DISCUSSION-LOG.md confirming all closing-slice commands green (cli/hub/web typecheck, root `bun run test`, full guard script)"
affects:
  - scripts/check-no-cut-agents.sh
  - .planning/phases/11-test-gap-fill/11-DISCUSSION-LOG.md
  - web/src/hooks/useSSE.test.tsx
tech_stack:
  added: []
  patterns:
    - "Ripgrep structural pattern (`permissionMode\\s*===\\s*['\\\"]`) — disjoint from Phase 5 (`flavor === ...`), Phase 6 (`permissionModeToAgentArgs` / `permissionMode as string` cast), Phase 10 (config field names)"
    - "Glob-based whitelist for sub-check #1 (`!cli/src/agent/**`, `!cli/src/cursor/**`, `!**/*.test.ts(x)`) — no per-file allowlist entries"
    - "Cross-runner import sanity (sub-check #2) — opposite-runner import zero-tolerance per package, mirroring Phase 8 D-143 #1 reverse-import sweep idiom"
    - "Append-before-final-PASS placement — same cadence as Phase 5/6/8/9/10 blocks"
key_files:
  created:
    - .planning/phases/11-test-gap-fill/11-05-SUMMARY.md
  modified:
    - scripts/check-no-cut-agents.sh
    - .planning/phases/11-test-gap-fill/11-DISCUSSION-LOG.md
    - web/src/hooks/useSSE.test.tsx
decisions:
  - "Phase 11 guard block adopted verbatim from RESEARCH § Code Examples (orchestrator-decided pattern from override 2026-05-23). No widening, narrowing, or quoting change."
  - "Sub-check #1 whitelist is glob-based ONLY (`!cli/src/agent/**`, `!cli/src/cursor/**`, `!**/*.test.ts(x)`) — no per-file allowlist; `cli/src/agent/permissionMatrix.test.ts` survives via the test-glob exclusion, `cli/src/agent/modeConfig.ts` (the legitimate home of `permissionModeToCursorArgs`) survives via the `cli/src/agent/**` exclusion."
  - "Phase 7 #1 guard tripped on a pre-existing comment in `web/src/hooks/useSSE.test.tsx` (introduced by plan 11-04) that mentioned the deleted symbol `hasUnknownSessionPatchKeys` by name. Fixed under Rule 3 (blocking issue) by rewording the comment to `deleted patch-shape heuristic` — same semantics, no Phase 7 territory modified, scope-of-fix limited to the 2-line comment."
  - "Coverage capture uses `--coverage.reporter=text` (vitest 4.x flag) instead of plan-literal `--reporter=text` (which vitest interprets as a custom reporter module path) — same Rule 3 deviation that plan 11-01 took."
  - "Three of five SC#4 scopes (cli/cursor, cli/agent, web/useSSE) remain `unavailable` because `@vitest/coverage-v8` is still not declared as a dev-dep on `main`. Per RESEARCH § Open Question #3 fallback + plan 11-01 SUMMARY guidance, these scopes are declared the new Phase 11 baseline as `unavailable`. Phase 12 verification can decide whether to install the dev-dep and capture real numbers."
  - "Non-regression verdict GREEN: the two real-baseline scopes (hub/web/routes/auth.ts 18.18% → 100.00%, hub/sse/sseManager.ts 79.82% → 79.82%) both pass; the three unavailable scopes are n/a (declared-baseline rider)."
metrics:
  duration_minutes: 8
  tasks_completed: 2
  files_changed: 3
  completed_date: 2026-05-23
---

# Phase 11 Plan 05: Phase 11 guard block + coverage close Summary

## One-Liner

Closed Phase 11 by appending the orchestrator-decided ripgrep guard block (REFT-01 `permissionMode === '<literal>'` source-of-truth invariant + TESTING.md cross-runner import sanity) to `scripts/check-no-cut-agents.sh`, recording Phase 11 coverage numbers + non-regression verdict GREEN in `11-DISCUSSION-LOG.md` (hub auth.ts 18.18% → 100.00%, hub sseManager.ts held at 79.82%; cli + web v8-coverage scopes still `unavailable` and declared the new Phase 11 baseline), and confirming the full closing-slice gate (cli/hub/web typecheck, root `bun run test`, full guard script) green on Phase 11 HEAD `d3e5279`.

## What Was Built

| File | Change | Lines |
|------|--------|-------|
| `scripts/check-no-cut-agents.sh` | Appended `# ===== Phase 11 — REFT guards =====` block immediately before final `echo "✅ Phase 10 guard PASS."`. Two sub-checks active. | +50 / −0 |
| `web/src/hooks/useSSE.test.tsx` | Reworded a Phase-7-tripping comment from `hasUnknownSessionPatchKeys` to `deleted patch-shape heuristic` (Rule 3 fix). | +2 / −2 |
| `.planning/phases/11-test-gap-fill/11-DISCUSSION-LOG.md` | Appended `## Phase 11 Coverage After (captured 2026-05-23)` 5-row table + verdict, and `## Phase 11 Gate Results (2026-05-23)` checklist. | +47 / −0 |

### Phase 11 guard block — exact placement

Inserted between Phase 10's last sub-check echo (`✅ Phase 10 #5: …`) and the script-final `✅ Phase 10 guard PASS.` PASS line. Block contents:

1. Comment header `# ===== Phase 11 — REFT guards =====` + rationale (REFT-01 source-of-truth invariant; TESTING.md cross-runner anti-pattern; cross-reference to Phase 6 #3 for `permissionModeToCursorArgs` definition uniqueness, NOT duplicated).
2. `PHASE11_BRANCH_PATTERN='permissionMode\s*===\s*['\''"]'` and `PHASE11_SOURCE_DIRS=(cli/src hub/src web/src shared/src)`.
3. **Sub-check #1** (REFT-01): `rg -n "$PHASE11_BRANCH_PATTERN" "${PHASE11_SOURCE_DIRS[@]}" --glob '!**/*.test.ts' --glob '!**/*.test.tsx' --glob '!cli/src/agent/**' --glob '!cli/src/cursor/**'` — non-empty triggers the failure message (`hardcoded permissionMode === '<literal>' outside cli/src/{agent,cursor}/. Route the decision through permissionModeToCursorArgs (cli/src/agent/modeConfig.ts) or getCapability(...) so the matrix test in permissionMatrix.test.ts owns the contract.`) and `exit 1`. Empty: `✅ Phase 11 #1: no permissionMode === '<literal>' branches outside cli/src/{agent,cursor}/.`
4. **Sub-check #2** (TESTING.md cross-runner): `rg -n "from\s+['\"]bun:test['\"]" cli/src web/src` and `rg -n "from\s+['\"]vitest['\"]" hub/src shared/src` — either non-empty fails. Both empty: `✅ Phase 11 #2: test-runner imports respect package boundaries.`
5. Closing `✅ Phase 11 guard PASS (REFT-01..03).`

### Disjointness with prior phase blocks (re-verified post-edit)

| Prior phase pattern | New Phase 11 pattern | Disjoint? |
|---------------------|----------------------|-----------|
| Phase 5 `flavor\s*===\s*['"]` | `permissionMode\s*===\s*['"]` | ✅ different identifier |
| Phase 6 `permissionModeToAgentArgs` (deleted helper name) | `permissionMode\s*===` (literal comparison) | ✅ different syntax shape |
| Phase 6 `permissionMode as string` (TS cast) | `permissionMode === '<literal>'` (binary `===`) | ✅ `as` vs `===` |
| Phase 7/8/9/10 — config field names, schema names, file-size budgets, etc. | unrelated semantic domain | ✅ |

### Mutation tests (manual; reverted before commit)

| Mutation | Expected sub-check fire | Actual |
|----------|-------------------------|--------|
| `echo "if (permissionMode === 'plan') {}" > cli/src/_phase11_mutation_test.ts` | #1 fails | ✅ `❌ Phase 11 REFT-01: hardcoded permissionMode === '<literal>' outside cli/src/{agent,cursor}/.` |
| `echo "import { describe } from 'bun:test'" > cli/src/_phase11_mutation_test2.ts` | #2 fails | ✅ `❌ Phase 11 #2: 'bun:test' imported in cli/ or web/ (must use Vitest).` |
| Both files removed → re-run guard | All Phase 1–11 PASS lines | ✅ |

## Phase 11 Coverage After — verdict GREEN

| Scope | Phase 11 (this capture) | Phase 10 baseline | Delta | Verdict |
|-------|--------------------------|-------------------|-------|---------|
| cli/src/cursor/ | unavailable — `@vitest/coverage-v8` missing | unavailable | n/a | n/a (declared-baseline rider) |
| cli/src/agent/ | unavailable — `@vitest/coverage-v8` missing | unavailable | n/a | n/a (declared-baseline rider) |
| hub/src/web/routes/auth.ts | **100.00% lines / 100.00% funcs** | 18.18% lines / 0.00% funcs | **+81.82 pp lines** | ✅ |
| hub/src/sse/ (sseManager.ts) | 79.82% lines / 57.14% funcs | 79.82% / 57.14% | 0.00 pp | ✅ |
| web/src/hooks/useSSE.ts | unavailable — `@vitest/coverage-v8` missing | unavailable | n/a | n/a (declared-baseline rider) |

**Verdict: GREEN with declared-baseline rider.** Both real-baseline scopes pass non-regression (`auth.ts` ≥ baseline by +81.82 pp; `sseManager.ts` exact match). The three `unavailable` scopes carry the same status forward and are declared the new Phase 11 baseline per RESEARCH § Open Question #3 fallback + plan 11-01 SUMMARY guidance. Per D-188: no CI gate added.

Bonus: `hub/src/web/middleware/auth.ts` at **100.00% lines / 100.00% funcs** (out of original SC#4 five-scope contract — REFT-03 added 10 middleware tests; recorded incidentally by the same `bun test --coverage` run, noted for Phase 12 reference).

## Phase 11 Gate Results

- ✅ `cd cli && bun typecheck` → exit 0
- ✅ `cd hub && bun typecheck` → exit 0
- ✅ `cd web && bun typecheck` → exit 0
- n/a `cd shared && bun typecheck` → no `typecheck` script in `shared/package.json` (plan permits skip)
- ✅ `bun run test` (repo root) → exit 0 — runs `test:cli && test:hub && test:web && test:guard` sequentially
- ✅ `bash scripts/check-no-cut-agents.sh` → exit 0 (Phase 1–11 PASS lines all printed)

Phase 11 ready for verify-phase.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] Phase 7 #1 guard tripped on a pre-existing comment in `web/src/hooks/useSSE.test.tsx`**

- **Found during:** Task 1 verification (`bash scripts/check-no-cut-agents.sh` after appending the Phase 11 block).
- **Issue:** The Phase 7 sweep (`hasUnknownSessionPatchKeys` zero-tolerance) does not exclude test files. Plan 11-04 added a doc-comment line referencing the deleted symbol by name (`*   D-183  Phase-7 safety: no assertions on setQueryData arg shape or\n *          hasUnknownSessionPatchKeys; only on getQueryData() equality.`), which made the entire guard script fail with `❌ Phase-7 hasUnknownSessionPatchKeys residue found (REFA-04).` — blocking Task 1's `bash scripts/check-no-cut-agents.sh` verify step.
- **Fix:** Reworded the comment to reference `the deleted patch-shape heuristic` instead of the deleted symbol's literal name. Two-line edit in the same JSDoc block. No Phase 7 guard territory modified (Phase 7 guard kept intact); no test behavior changed; semantics of the documentation comment preserved.
- **Files modified:** `web/src/hooks/useSSE.test.tsx` (2 lines reworded inside an existing JSDoc block, comment-only change).
- **Commit:** `d3e5279` (combined with Task 1's guard-block append).

**2. [Rule 3 — Blocking] `--reporter=text` rejected by vitest 4.x as a custom reporter path (same as plan 11-01)**

- **Found during:** Task 2 Part A, cli coverage attempt.
- **Issue:** Plan literal command `bun run vitest run --coverage --reporter=text ...` makes vitest 4.x try to load `text` as a custom reporter module and crash with `Failed to load url text`.
- **Fix:** Used `--coverage.reporter=text` (the vitest 4.x flag for the coverage text reporter) — semantically identical, plan-author-intended output. Same deviation taken in plan 11-01.
- **Files modified:** none.
- **Commit:** n/a (changed the executed command, not the plan or any tracked file).

### Could-not-fix issues (carried forward as `unavailable` per Plan 11-01 fallback)

**3. `@vitest/coverage-v8` still not installed in `cli/package.json` or `web/package.json`**

- Same root cause as plan 11-01's baseline capture; installing the dev-dep would mutate workspace install state and was not part of the plan's 2 tasks. Per RESEARCH § Open Question #3 + plan 11-01 SUMMARY guidance, the three v8-coverage scopes are declared the new Phase 11 baseline as `unavailable`. Phase 12 verification can decide whether to capture real numbers.

### Auth gates

None.

## Threat Flags

None — Phase 11 is a tests + guards close-out plan. The two new ripgrep checks are zero-trust source guards (not network endpoints, not auth paths, not file access patterns, not schema changes at trust boundaries). The Rule 3 comment fix is a pure documentation touch.

## Known Stubs

None — both committed artifacts (the guard block, the DISCUSSION-LOG sections) are fully populated with real values; no placeholders, no TODOs, no empty arrays/objects flowing to UI.

## Self-Check

- File exists: `scripts/check-no-cut-agents.sh` (modified) → FOUND
- File exists: `.planning/phases/11-test-gap-fill/11-DISCUSSION-LOG.md` (modified) → FOUND
- File exists: `web/src/hooks/useSSE.test.tsx` (modified) → FOUND
- File exists: `.planning/phases/11-test-gap-fill/11-05-SUMMARY.md` (this file) → FOUND
- `grep -c "===== Phase 11 — REFT guards =====" scripts/check-no-cut-agents.sh` → 1
- `grep -E "PHASE11_BRANCH_PATTERN='permissionMode" scripts/check-no-cut-agents.sh` → 1 match
- `grep -q '^## Phase 11 Coverage After' .planning/phases/11-test-gap-fill/11-DISCUSSION-LOG.md` → ✓
- `grep -q '^## Phase 11 Gate Results' .planning/phases/11-test-gap-fill/11-DISCUSSION-LOG.md` → ✓
- Commit `d3e5279` (Task 1 — Phase 11 guard block + Phase 7 comment fix) → FOUND in `git log`
- Commit `c0657e6` (Task 2 — DISCUSSION-LOG coverage + gate results) → FOUND in `git log`
- `bash scripts/check-no-cut-agents.sh` → exit 0 with all Phase 1–11 PASS lines
- `bun run test` (repo root) → exit 0
- Mutation simulations both fired correctly and were reverted before Task 1 commit

## Self-Check: PASSED

## Commits

- `d3e5279` — feat(11-05): append Phase 11 REFT guard block to check-no-cut-agents.sh
- `c0657e6` — docs(11-05): record Phase 11 coverage + gate results in DISCUSSION-LOG
