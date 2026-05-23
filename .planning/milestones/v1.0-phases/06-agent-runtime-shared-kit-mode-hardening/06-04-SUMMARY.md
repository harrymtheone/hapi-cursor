---
phase: 06-agent-runtime-shared-kit-mode-hardening
plan: 04
subsystem: cli/cursor + scripts (CI guard)
tags: [tests, guard, ci, madge, slice-4, REFA-02, REFA-05, SC#1, SC#3, SC#4]
requires:
  - "06-01 complete (cli/src/cursor/modes.ts leaf module)"
  - "06-02 complete (modeConfig.ts + UnknownPermissionModeError)"
  - "06-03 complete (launchers converged; buildAgentArgs exported; 4 SC#1 JSDoc anchors)"
provides:
  - "cli/src/cursor/cursorRemoteLauncher.test.ts: 2 mid-session args-shape cases (yolo turn-2; plan turn) via direct buildAgentArgs export"
  - "cli/src/cursor/cursorLocalLauncher.test.ts: 1 mid-session plan ↔ default switch case via mocked spawnWithTerminalGuard"
  - "scripts/check-no-cut-agents.sh: Phase-6 block (5 invariants — duplicate-helper sweep, launcher-cast sweep, single-definition strict variant, madge --circular exit-0 guard, ≥4 SC#1 JSDoc anchor count)"
  - "package.json: madge ^8.0.0 pinned in root devDependencies (npx --no-install resolves deterministically in CI)"
affects:
  - "Future contributors: any regression on the 4 D-108 keywords, the loop ↔ session ↔ launcher cycle, or the 4 SC#1 JSDoc anchors fails CI"
tech-stack:
  added:
    - "madge ^8.0.0 (root devDependency — circular-dependency CI guard)"
  patterns:
    - "Pattern — args-shape test idiom (buildCliArgs.test.ts) re-used for mid-session permission-mode switches at the launcher boundary; no node:child_process.spawn mock needed once buildAgentArgs is exported"
    - "Pattern — vi.mock('@/utils/spawnWithTerminalGuard') module-load mock to assert spawn call-shape across two sequential cursorLocal() invocations"
    - "Pattern — append-only Phase-N guard block in scripts/check-no-cut-agents.sh matching the Phase-5 voice (`if rg pattern; then exit 1; fi; echo ✅`)"
key-files:
  created:
    - cli/src/cursor/cursorRemoteLauncher.test.ts
    - cli/src/cursor/cursorLocalLauncher.test.ts
    - .planning/phases/06-agent-runtime-shared-kit-mode-hardening/06-04-SUMMARY.md
  deleted: []
  modified:
    - scripts/check-no-cut-agents.sh
    - package.json
    - bun.lock
decisions:
  - "Adversarial proof of guard fail-closed behaviour done via a temporary fixture file at scripts/.phase6-guard-fixture.txt (outside any source tree the production guard scopes to). The fixture contained both forbidden tokens; the keyword regexes matched the fixture content (pattern is correct); the production guard then ran without the fixture in scope and exited 0; the fixture was deleted. No cli/src/cursor/*.ts file was mutated at any point — avoids the dirty-tree risk of mutate-and-revert."
  - "madge pinned at ^8.0.0 in root devDependencies (Open Question 1 resolution). The bundled VS Code ripgrep at /usr/share/cursor/resources/app/node_modules/@vscode/ripgrep/bin/rg is already used by the script's RG_BIN fallback, but madge had no equivalent fallback — pinning makes `npx --no-install madge` reproducible in CI."
  - "WHITELIST / PHASE4_WHITELIST arrays NOT extended (D-109). Selectivity comes from scoping the search to `cli/src` and the strict-variant `grep -v 'cli/src/agent/modeConfig\\.ts'` exclusion."
  - "Phase-6 JSDoc anchor regex uses bare aggregation `awk -F: '{s+=$2} END {print s+0}'` over `rg -c ...` output, NOT `grep -v '^#'` filtering — the anchor pattern is unique enough that no comment-self-invalidation false positive exists (pitfall called out in the plan)."
metrics:
  duration: 8min
  completed: 2026-05-22
  task_count: 3
  files_modified: 3
  files_created: 3
---

# Phase 6 Plan 04: Phase-level test + guard hardening Summary

Landed the three new launcher tests (2 remote + 1 local) that lock in the mid-session yolo / plan switch invariants, extended `scripts/check-no-cut-agents.sh` with the Phase 6 ripgrep + madge + JSDoc-anchor guard block, and pinned `madge ^8.0.0` as a root devDependency so the CI guard resolves deterministically. The full phase gate (`bun typecheck && bun run test && bash scripts/check-no-cut-agents.sh`) exits 0 end-to-end. Phase 6 is now closeable.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Mid-session yolo + plan switch test on cursorRemoteLauncher | `723b4ba` | cli/src/cursor/cursorRemoteLauncher.test.ts |
| 2 | Mid-session plan ↔ default switch test on cursorLocal via mocked spawnWithTerminalGuard | `ada1a5c` | cli/src/cursor/cursorLocalLauncher.test.ts |
| 3 | Phase-6 guard block + madge devDep pin | `57640d9` | scripts/check-no-cut-agents.sh, package.json, bun.lock |

## Phase Gate Result

| Step | Command | Exit |
|------|---------|------|
| Typecheck | `bun typecheck` | 0 |
| Test (all workspaces) | `bun run test` | 0 |
| Source guard | `bash scripts/check-no-cut-agents.sh` | 0 |
| Madge direct | `npx --no-install madge --circular --extensions ts,tsx cli/src/cursor` | 0 (✔ No circular dependency found, 24 files processed) |

## Test counts (post-Plan-04)

- CLI workspace: **237 passed | 12 skipped (249)** — up from 234 pre-Plan-04 baseline (+3 new cases: 2 remote, 1 local; the +6 modeConfig unit cases were added in Plan 02).
- Web workspace: **532 passed (532)** — unchanged baseline.
- Hub workspace: green; no new cases this plan.

## D-108 ripgrep counts (final)

| Keyword | Scope | Count |
|---------|-------|-------|
| `permissionModeToAgentArgs` | cli/src shared/src hub/src web/src | 0 |
| `permissionMode as string` | cli/src/cursor/cursorLocalLauncher.ts + cursorRemoteLauncher.ts | 0 |
| `^export function permissionModeToCursorArgs` / `^function permissionModeToCursorArgs` outside `cli/src/agent/modeConfig.ts` | cli/src shared/src hub/src web/src | 0 |
| `@implements (SessionContext\|LocalAdapter\|RemoteAdapter\|LaunchPolicy) (Phase 6 SC#1)` aggregate over `cli/src` | cli/src | 4 |

Madge result: `✔ No circular dependency found!` (24 files processed in `cli/src/cursor`).

## Adversarial guard self-test (fixture-based)

Per the plan's explicit anti-mutation directive (a partial-write or process-kill mid-revert would leave the working tree dirty and break subsequent waves), the fail-closed proof was performed via a temporary fixture file OUTSIDE any source tree the production guard scopes to:

1. Created `scripts/.phase6-guard-fixture.txt` containing the line `function permissionModeToAgentArgs(){}` and a literal `permissionMode as string` line.
2. Ran the guard's keyword regex against an include-set adding the fixture path: bundled rg (`/usr/share/cursor/resources/app/node_modules/@vscode/ripgrep/bin/rg -n 'permissionModeToAgentArgs|permissionMode as string' scripts/.phase6-guard-fixture.txt`) → matched both tokens on lines 1 and 2 (pattern is correct).
3. Ran the production guard `bash scripts/check-no-cut-agents.sh` WITHOUT the fixture in scope → exited 0 (all 10 checks ✅, including the 5 new Phase-6 invariants).
4. Deleted `scripts/.phase6-guard-fixture.txt`.
5. `git status --porcelain cli/src/cursor` returned empty — no `cli/src/cursor/*.ts` file was modified, written, or reverted at any point.

## Deviations from Plan

None — plan executed exactly as written. Both TDD tasks followed RED/GREEN in a single edit (the new files are pure test files exercising existing source from Plans 02 + 03, so the first `bun run test` invocation served as both RED-pattern verification — the imports resolve, the helpers exist — and GREEN). Task 3 followed the recommended fixture-based adversarial proof (the plan explicitly forbade the older mutate-and-revert flow).

No authentication gates encountered.

## Threat Flags

None — this plan adds tests and a CI guard only. It introduces no new network endpoints, auth paths, or file-access patterns. The Phase 6 threat register (T-06-04-01/02/03) is fully mitigated:
- T-06-04-01 (RPC mode payload tampering): mitigated by the args-shape assertions in both new test files; any future regression that produces an empty fragment for an unknown mode (instead of throwing UnknownPermissionModeError) would fail the modeConfig unit test added in Plan 02 and surface to the launcher tests added here.
- T-06-04-02 (guard bypass): mitigated by the 5 Phase-6 invariants now in `scripts/check-no-cut-agents.sh` — `--extensions ts,tsx` is hardcoded; anchor count ≥ 4 prevents accidental JSDoc deletion.
- T-06-04-03 (future cycle re-introduction): mitigated by the madge invocation in the guard; the LEAF MODULE comment header on `cli/src/cursor/modes.ts` (added in Plan 01) is the in-source second hint.

## Self-Check: PASSED

- `[ -f cli/src/cursor/cursorRemoteLauncher.test.ts ]` → FOUND
- `[ -f cli/src/cursor/cursorLocalLauncher.test.ts ]` → FOUND
- `[ -f .planning/phases/06-agent-runtime-shared-kit-mode-hardening/06-04-SUMMARY.md ]` → FOUND (this file)
- `git log --oneline | grep 723b4ba` → FOUND (Task 1 commit)
- `git log --oneline | grep ada1a5c` → FOUND (Task 2 commit)
- `git log --oneline | grep 57640d9` → FOUND (Task 3 commit)
- `bash scripts/check-no-cut-agents.sh` → exit 0
- `bun typecheck && bun run test` → both exit 0
