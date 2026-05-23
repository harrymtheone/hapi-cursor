---
phase: 10-config-cleanup
plan: 01
subsystem: cli + hub
tags: [legacy-removal, residue, env-rename, test-scaffolding, guard]
requires: []
provides:
  - RETIRED_COMMANDS resolver guard
  - HAPI_LISTEN_* env-rename in CLI hub launcher
  - Wave-0 configuration test skeletons (cli + hub)
  - Phase-10 guard block in scripts/check-no-cut-agents.sh
affects:
  - cli/src/commands/registry.ts
  - cli/src/commands/hub.ts
  - scripts/check-no-cut-agents.sh
tech_stack:
  added: []
  patterns:
    - RETIRED_COMMANDS map for hard-rejecting retired CLI subcommands with repair messages (D-160)
    - describe.skip / it.todo seeded test scaffolding (Wave-0)
key_files:
  created:
    - cli/src/commands/registry.test.ts
    - cli/src/configuration.test.ts
    - hub/src/configuration.test.ts
    - hub/src/store/index.test.ts
  modified:
    - cli/src/commands/registry.ts
    - cli/src/commands/hub.ts
    - scripts/check-no-cut-agents.sh
decisions:
  - "D-160: retired commands fail hard with repair message naming canonical replacement"
  - "Pitfall 4: CLI hub launcher must write HAPI_LISTEN_* (the env names the hub actually reads), not stale WEBAPP_*"
  - "D-173: Store schema-mismatch error includes dbPath + expected + found versions"
  - "Plan-04 staged guard checks (#1 legacy fields, #2 mutable setters, #5 singleton imports) kept as commented TODO blocks so they don't false-positive on in-flight code paths"
metrics:
  duration: ~10 min
  completed_date: 2026-05-23
  tasks_completed: 4
  files_changed: 7
---

# Phase 10 Plan 01: Land Legacy-Residue Removals + Wave-0 Test Scaffolding Summary

**One-liner:** Dropped the `hapi server` command alias with a hard repair-message guard, fixed the silently-broken `WEBAPP_*` → `HAPI_LISTEN_*` env rename in the CLI hub launcher, seeded four Wave-0 test files (one active CLI registry suite, two skipped config skeletons, one new Store schema/missing-table suite), and staged a Phase-10 guard block in `scripts/check-no-cut-agents.sh` with the alias + runtime-migration checks live and the legacy-field/setter/singleton checks held back for Plan 04.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Drop `hapi server` alias + add resolver repair guard | `5d1d794` | `cli/src/commands/registry.ts`, `cli/src/commands/registry.test.ts` |
| 2 | Fix WEBAPP_* env-rename bug in CLI hub launcher | `899b3d5` | `cli/src/commands/hub.ts` |
| 3 | Add Store schema-mismatch + missing-table tests | `a6b6552` | `hub/src/store/index.test.ts` |
| 4 | Seed configuration.test.ts skeletons + Phase-10 guard block | `1d7fcdc` | `cli/src/configuration.test.ts`, `hub/src/configuration.test.ts`, `scripts/check-no-cut-agents.sh` |

## What Was Built

### Task 1 — `RETIRED_COMMANDS` resolver guard (D-160)
- Removed `{ ...hubCommand, name: 'server' }` from the `COMMANDS` array.
- Added `RETIRED_COMMANDS: Record<string, string> = { server: 'hub' }` and a guard at the top of `resolveCommand` that throws `Unknown command "hapi ${subcommand}". Use "hapi ${replacement}" instead.` when the subcommand is in the retired map.
- `registry.test.ts` (vitest — matching the package's existing test convention) covers the four required behaviors: throw with both `hapi server` and `hapi hub` in the message, throw regardless of trailing args, `hub` still resolves to `hubCommand`, empty args still fall through to `cursorCommand`.

### Task 2 — `HAPI_LISTEN_*` env rename (Pitfall 4)
- `cli/src/commands/hub.ts` now writes `process.env.HAPI_LISTEN_HOST` / `process.env.HAPI_LISTEN_PORT`. The hub reads these names; `WEBAPP_*` were dead writes and `hapi hub --host X --port Y` was silently broken. No other change in the file.

### Task 3 — Store schema/missing-table coverage (D-173, D-175)
- New `hub/src/store/index.test.ts` using `bun:test` + `bun:sqlite`.
- `Store schema mismatch` builds a fresh DB once, reaches into the live `db` handle to read the canonical `SCHEMA_VERSION` (so the test doesn't hard-code the version constant), then sets `PRAGMA user_version` to a non-matching value and asserts the thrown message contains the `dbPath`, expected version, and found version.
- `Store missing required tables` drops the `sessions` table from a valid DB and asserts the thrown message names `sessions`.
- Both tests use `os.tmpdir()` fixtures via `mkdtempSync` and clean up with `afterEach`.

### Task 4 — Wave-0 test skeletons + Phase-10 guard block
- `cli/src/configuration.test.ts` (vitest): four `describe.skip` blocks naming pending behaviors (D-164 frozen config, D-160 reject `serverUrl`, D-161 reject `WEBAPP_*` env, D-167 malformed `settings.json`). Plan 03 will flip them on.
- `hub/src/configuration.test.ts` (bun:test): two `describe.skip` blocks (D-164, D-161). Plan 02 will flip them on. Inner placeholder `it(...)` bodies satisfy bun:test's 2-arg signature (avoiding `tsc` cross-project errors from the CLI tsconfig).
- `scripts/check-no-cut-agents.sh` Phase-10 block appended after the Phase-9 block, mirroring the Phase-8/Phase-9 cadence: numbered sub-checks, `echo "❌ ..."` + `exit 1` on failure, terminal `✅ Phase 10 guard PASS.` Two checks active (#3 alias removal, #4 zero runtime `migration-v*.ts`); three commented as `# Plan 04: enable after Plan 02 + Plan 03 land DI cutover` (#1 legacy-field reads, #2 mutable setters, #5 singleton imports).

## Deviations from Plan

### Test-framework convention (no deviation in spirit — the plan's `e.g. bun:test` was a recommendation pinned to "package's existing test conventions")
- The CLI package uses **vitest** (see `cli/package.json` `"test": "... vitest run"`) and existing CLI test files (`auth.test.ts`, `resume.test.ts`) import from `vitest`. New CLI test files (`cli/src/commands/registry.test.ts`, `cli/src/configuration.test.ts`) therefore import from `vitest`, matching package convention. Hub tests use `bun:test` (matching `hub/package.json` `"test": "bun test"` and the existing `hub/src/store/messages.test.ts`).

### Bun:test type signature follow-up (Rule 3 — auto-fix blocking issue)
- Initial Task-4 hub skeleton used `it.todo('name')` and `describe.skip('name', fn)` with no inner callback. The CLI `tsc --noEmit` (which transitively typechecks hub via project references) reported `TS2554: Expected 2-3 arguments, but got 1` on `it.todo(...)` for bun:test. Switched to `it('name', () => { /* Plan 02 will implement */ })` inside `describe.skip(...)` blocks — the suite is still skipped at runtime (bun reports `2 skip`), but the type signatures resolve. Amended the Task-4 commit (HEAD, not yet pushed, created in this conversation).

### No other deviations
- Threat-model items T-10-01-01 and T-10-01-02 were directly mitigated by Tasks 1 and 2 respectively (plan-mandated).
- No new packages installed.
- No architectural changes (Rule 4 did not trigger).

## Authentication Gates

None — no auth was required for any task.

## Known Stubs

None. The `describe.skip` / inline placeholder `it(...)` bodies in `cli/src/configuration.test.ts` and `hub/src/configuration.test.ts` are intentional Wave-0 scaffolding tracked by the plan:
- `cli/src/configuration.test.ts` — Plan 03 will replace `describe.skip` with active suites (4 behaviors).
- `hub/src/configuration.test.ts` — Plan 02 will replace `describe.skip` with active suites (2 behaviors).

## Verification

Run from repo root:

```
cd cli && bun x vitest run src/commands/registry.test.ts src/configuration.test.ts  # 4 pass + 4 todo
cd hub && bun test src/store/index.test.ts src/configuration.test.ts                 # 2 pass + 2 skip
bun run typecheck                                                                    # cli + web + hub all green
bun run test:cli                                                                     # 241 pass / 12 skipped / 4 todo
bun run test:hub                                                                     # 211 pass / 2 skip
bash scripts/check-no-cut-agents.sh                                                  # ends with ✅ Phase 10 guard PASS.
```

All commands pass on `1d7fcdc`.

## TDD Gate Compliance

Plan-level frontmatter is `type: execute` (not `type: tdd`), so the plan-level RED/GREEN/REFACTOR gate sequence is not required. Task-level `tdd="true"` tasks (Task 1, Task 3) added the failing-then-passing tests in a single commit per task — acceptable because the tests would have failed on `HEAD~N` (the alias still existed; the store test file didn't exist). No RED-first commits required by the plan.

## Self-Check: PASSED

- `cli/src/commands/registry.ts` exists and contains `RETIRED_COMMANDS` (verified via grep).
- `cli/src/commands/registry.test.ts` exists.
- `cli/src/commands/hub.ts` contains `HAPI_LISTEN_HOST` + `HAPI_LISTEN_PORT`, zero `WEBAPP_` hits.
- `cli/src/configuration.test.ts` + `hub/src/configuration.test.ts` exist.
- `hub/src/store/index.test.ts` exists and the two test cases pass.
- `scripts/check-no-cut-agents.sh` contains `Phase 10` (1+ hits), `name: 'server'` rejection (1+ hits), `Plan 04: enable` (3 hits).
- Commits: `5d1d794`, `899b3d5`, `a6b6552`, `1d7fcdc` — all present in `git log`.
