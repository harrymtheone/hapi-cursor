---
phase: 11-test-gap-fill
plan: 01
subsystem: testing
tags: [coverage, baseline, phase-10, refactor-friendly-tests]
requires: []
provides:
  - "Phase 10 line-coverage baseline numbers in 11-DISCUSSION-LOG.md (heading `## Phase 10 Coverage Baseline (captured 2026-05-23)`)"
affects: []
tech_stack:
  added: []
  patterns:
    - "worktree-only baseline capture (parallel-wave-safe; never mutates active checkout)"
key_files:
  created: []
  modified:
    - .planning/phases/11-test-gap-fill/11-DISCUSSION-LOG.md
decisions:
  - "Three of five scopes (cli/cursor, cli/agent, web/useSSE) recorded as `unavailable — @vitest/coverage-v8 not installed` per RESEARCH Open Question #3 fallback; installing the missing dev-dep was out of scope on `main`."
  - "Plan 11-05 will treat the three unavailable scopes as 'Phase 11 numbers become the new baseline' and only assert non-regression for the two captured hub scopes (auth.ts 18.18%, sseManager.ts 79.82%)."
metrics:
  duration_minutes: 4
  tasks_completed: 1
  files_changed: 1
  completed_date: 2026-05-23
---

# Phase 11 Plan 01: Phase 10 Coverage Baseline Capture — Summary

**One-liner:** Captured Phase 10 line-coverage baseline for the five Phase 11 SUT scopes from `main` @ 9c58af9 via a disposable `/tmp/hapi-baseline-cov` worktree, recording two real numbers (hub auth.ts 18.18%, hub sseManager.ts 79.82%) and three explicit `unavailable` markers (cli/cursor, cli/agent, web/useSSE — `@vitest/coverage-v8` is not installed on main) in `11-DISCUSSION-LOG.md` for plan 11-05's SC#4 non-regression diff.

## What Was Built

A new section appended to `.planning/phases/11-test-gap-fill/11-DISCUSSION-LOG.md`:

- Heading `## Phase 10 Coverage Baseline (captured 2026-05-23)`
- Captured-from line: `main` @ `9c58af9`
- Capture mode: `worktree (clean)`
- 5-row markdown table (one row per Phase 11 SUT scope) with `Line Coverage` cell and `Source command` cell
- Notes paragraph explaining the missing-provider fallback and how plan 11-05 should consume the table

## Captured Numbers

| Scope | Line Coverage | Notes |
|-------|---------------|-------|
| cli/src/cursor/ | unavailable — `@vitest/coverage-v8` missing | Real baseline absent on main |
| cli/src/agent/ | unavailable — `@vitest/coverage-v8` missing | Real baseline absent on main |
| hub/src/web/routes/auth.ts | **18.18%** lines (0.00% funcs) | bun:test --coverage; uncovered 12–47 |
| hub/src/sse/ | **79.82%** lines (57.14% funcs) | Only file: `sseManager.ts`; uncovered 63–67,108,114–118,127–131,136–141 |
| web/src/hooks/useSSE.ts | unavailable — `@vitest/coverage-v8` missing | Real baseline absent on main |

## Execution Steps

1. Recorded pre-task git state: branch=`main`, HEAD=`9c58af9b011e31338be433718cd28a4cdbe75538`.
2. Created worktree: `git worktree add --detach /tmp/hapi-baseline-cov main` (initial `git worktree add /tmp/hapi-baseline-cov main` failed with `'main' is already checked out` — recovered via `--detach` per Rule 3).
3. Inside worktree: `bun install` (1626 packages), `cd cli && bun run tools:unpack` (extracted bundled tools to `tools/unpacked`).
4. Coverage commands:
   - `cd cli && bun run vitest run --coverage --coverage.reporter=text --coverage.include='src/cursor/**' --coverage.include='src/agent/**'` → exited 1 with `MISSING DEPENDENCY  Cannot find dependency '@vitest/coverage-v8'`. (Initial attempt with `--reporter=text` was rejected because vitest interprets `--reporter` as a custom reporter module path; corrected to `--coverage.reporter=text` per vitest 4.x flag schema — Rule 3 deviation.)
   - `cd hub && bun test --coverage` → produced full text coverage report; extracted `auth.ts` (18.18% lines) and `sseManager.ts` (79.82% lines).
   - `cd web && bun run vitest run --coverage --coverage.reporter=text --coverage.include='src/hooks/useSSE.ts'` → exited 1 with the same `@vitest/coverage-v8` missing-dependency error.
5. Cleanup: `git worktree remove --force /tmp/hapi-baseline-cov` → worktree gone (`git worktree list` shows only the active checkout).
6. Verified active checkout: branch=`main`, HEAD=`9c58af9b011e31338be433718cd28a4cdbe75538` (unchanged).
7. Wrote the 5-row table + notes to `11-DISCUSSION-LOG.md`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `git worktree add /tmp/hapi-baseline-cov main` rejected because `main` is already checked out**
- **Found during:** Task 1, step 2.
- **Issue:** The active checkout is on `main`, so a second checked-out worktree at `main` is forbidden by git.
- **Fix:** Re-ran with `--detach` (`git worktree add --detach /tmp/hapi-baseline-cov main`) — produces a detached worktree at the same SHA, which is functionally identical for read-only coverage capture and satisfies the plan's "tip of `main` per orchestrator override" requirement.
- **Files modified:** none.
- **Commit:** part of `aa81c23`.

**2. [Rule 3 - Blocking] `--reporter=text` flag rejected by vitest 4.x as a custom reporter module path**
- **Found during:** Task 1, step 3 (cli coverage attempt).
- **Issue:** Plan called the command exactly as `vitest run --coverage --reporter=text ...`. vitest 4.x interprets `--reporter=text` as a path to a custom reporter module and crashes with `Failed to load url text`.
- **Fix:** Replaced with `--coverage.reporter=text` (the vitest 4.x flag for selecting the coverage text reporter). This change is what the plan author intended — text-format coverage output.
- **Files modified:** none (changed the executed command, not the plan).
- **Commit:** part of `aa81c23`.

### Could-not-fix issues (recorded as `unavailable` per plan fallback)

**3. `@vitest/coverage-v8` not installed in `cli/package.json` or `web/package.json` on `main` @ 9c58af9**
- Both `cli/vitest.config.ts` and `web/vitest.config.ts` declare `coverage.provider: 'v8'`, but the corresponding npm package is not declared as a dev-dep on main.
- Installing the package would mutate `main`'s lockfile (out of scope for a read-only baseline-capture task), so per RESEARCH § Open Question #3 ("If any scope's number cannot be obtained, write `unavailable — <reason>`"), three of five scopes were marked `unavailable` with the explicit reason.
- Plan 11-05 must treat these three scopes as "Phase 11 sets the new baseline" rather than asserting non-regression against a missing number.

### Auth gates

None.

## Threat Flags

None — task is purely documentation; no code, network, auth, or schema surface introduced.

## Verification

- `grep -A 20 '## Phase 10 Coverage Baseline' .planning/phases/11-test-gap-fill/11-DISCUSSION-LOG.md` → shows heading + captured-from line + 5-row table ✓
- `git worktree list` → only `/home/harry/projects/hapi-cursor` ✓
- `git rev-parse --abbrev-ref HEAD` = `main` ✓ (matches pre-capture)
- `git rev-parse HEAD` (pre-commit) = `9c58af9b011e31338be433718cd28a4cdbe75538` ✓ (matches pre-capture)
- Active checkout source tree untouched — only `.planning/phases/11-test-gap-fill/11-DISCUSSION-LOG.md` modified by this plan.
- Pre-existing dirty paths (STATE.md, config.json, AGENTS.md deletion, untracked `.planning/` files from prior phases) were present BEFORE this task started and were not introduced by it. They remain unchanged.

## Self-Check

- File exists: `.planning/phases/11-test-gap-fill/11-DISCUSSION-LOG.md` ✓
- Heading present in file: `## Phase 10 Coverage Baseline (captured 2026-05-23)` ✓
- Commit `aa81c23` exists in `git log` ✓
- Worktree `/tmp/hapi-baseline-cov` removed ✓

## Self-Check: PASSED

## Commits

- `aa81c23` — docs(11-01): capture Phase 10 coverage baseline in DISCUSSION-LOG

## Known Stubs

None — plan output is documentation only; no UI/data wiring involved.
