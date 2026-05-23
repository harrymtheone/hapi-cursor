---
phase: 12-docs-cleanup-milestone-verification
plan: 03
subsystem: ci-verification
tags: [VRFY-01, VRFY-02, VRFY-03, D-07, D-10, D-11, github-actions, madge, bun]
dependency_graph:
  requires:
    - "12-01 (Phase-12 guard installed; docs/website/refactor.md removed)"
    - "12-02 (docs surface stable: root + per-package READMEs + AGENTS.md rewritten)"
  provides:
    - "Root `madge:check` npm script (D-10) — single-command madge sweep over cli/src + hub/src + web/src"
    - ".github/workflows/verify.yml — push + pull_request gate running install → typecheck → test → madge → guard"
    - "VRFY-01 + VRFY-02 + VRFY-03 graduated from local-only to push-gated CI"
  affects:
    - "12-04 (final phase verification — relies on the verify workflow as canonical CI source of truth)"
tech_stack:
  added:
    - "GitHub Actions workflow: oven-sh/setup-bun@v1 with bun-version 1.3.14 (matches cli/package.json packageManager field + existing release.yml/test.yml workflows)"
  patterns:
    - "Single-job ubuntu-latest workflow; no matrix, no extra caching, no concurrency group, no workflow_dispatch (D-07: minimal CI)"
    - "Same commands runnable locally and in CI (`bun install --frozen-lockfile && bun typecheck && bun run test && bun run madge:check && bash scripts/check-no-cut-agents.sh`)"
key_files:
  created:
    - .github/workflows/verify.yml
  modified:
    - package.json
  deleted_trees: []
decisions:
  - "Bun version pinned to 1.3.14 — sourced from cli/package.json `packageManager: bun@1.3.14` (canonical) and corroborated by the two pre-existing workflows (release.yml + test.yml) which already pin 1.3.14, and by local `bun --version` = 1.3.14. No new .bun-version / .tool-versions file added; existing packageManager field is the source of truth."
  - "Used `oven-sh/setup-bun@v1` per D-07 plan spec. Existing release.yml + test.yml use @v2; this minor divergence is intentional (plan strictly says v1) and is harmless — setup-bun v1 supports bun-version 1.3.14 unchanged. If 12-04 wants to homogenize across all workflows, that's a follow-up trivially settled by editing one line."
  - "Madge script deviated slightly from D-10 verbatim text — added `--exclude '(^\\.\\./|web/dist)'` to keep the script idempotent when web/dist build artifacts are present locally (Vite emits ~60 vendored-mermaid cycles inside web/dist/assets that have nothing to do with web/src source code). In CI this guard is a no-op (cold checkout has no web/dist). Locally it lets `bun run madge:check` finish green without forcing developers to clean web/dist first. The Phase-6/8/9 per-package madge guards (`scripts/check-no-circular-{hub,web}.sh`) remain untouched and continue to do their own scoped sweeps."
  - "verify.yml has no concurrency group on purpose (D-07: minimal CI). If concurrent PRs starve CI minutes, that's tunable in a future plan."
metrics:
  duration: ~12min
  tasks: 2
  files_touched: 2 (1 created, 1 modified)
  completed_date: 2026-05-23
---

# Phase 12 Plan 03: CI Gate (madge:check + verify.yml) Summary

Two-task plan adding the push-gated CI surface for the milestone. Task 1 wires a single root-level `madge:check` npm script so the full madge sweep (cli/src + hub/src + web/src) is a one-liner both locally and inside CI. Task 2 creates `.github/workflows/verify.yml`, a deliberately-minimal GitHub Actions workflow that runs the canonical gate suite (install → typecheck → test → madge → ripgrep guard) on every push and pull_request. Bun version pinned to 1.3.14, matching `cli/package.json` `packageManager` field and the existing release/test workflows.

## One-liner

VRFY-01/02/03 graduated from local-only to push-gated: one `madge:check` npm script + one 19-line `verify.yml` workflow now run typecheck + test + madge + ripgrep guard on every push and PR with bun pinned to 1.3.14.

## Tasks

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Add root `madge:check` script + local sanity invocation | `07e22c1` | package.json |
| 2 | Create .github/workflows/verify.yml (push + pull_request, bun 1.3.14) | `b92c19c` | .github/workflows/verify.yml |

## Bun Version Pinning — Rationale

| Source | Value |
|---|---|
| `cli/package.json` `packageManager` field | `bun@1.3.14` |
| Existing `.github/workflows/release.yml` | pins `bun-version: 1.3.14` |
| Existing `.github/workflows/test.yml` | pins `bun-version: 1.3.14` |
| Local executor `bun --version` | `1.3.14` |
| Repo root `.bun-version` / `.tool-versions` | (none — packageManager field is canonical) |

Chosen: **1.3.14**. No new pinning file added; the `packageManager` field already serves that purpose and is honoured by `bun install`.

## madge:check — Exact Script

```
madge --circular --extensions ts,tsx --exclude '(^\.\./|web/dist)' cli/src hub/src web/src
```

D-10 prescribes `madge --circular --extensions ts,tsx cli/src hub/src web/src`. The `--exclude '(^\.\./|web/dist)'` patch is documented above (decisions[3]); CI sees an identical-behaviour cold checkout, local-dev sees a deterministic green run regardless of build-artifact presence. Phase-local madge guards (`scripts/check-no-circular-hub.sh`, `scripts/check-no-circular-web.sh`) are preserved verbatim per D-10 Claude's-Discretion note — they're complementary phase guards, not duplicates.

## verify.yml — Step List (D-07 order)

```yaml
name: verify
on:
  push:
  pull_request:
jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
        with:
          bun-version: 1.3.14
      - run: bun install --frozen-lockfile
      - run: bun typecheck
      - run: bun run test
      - run: bun run madge:check
      - run: bash scripts/check-no-cut-agents.sh
```

7 steps, exact D-07 order, no matrix / caching / concurrency / dispatch.

## Local Full-Gate Output (executor environment)

| Step | Result |
|---|---|
| `bun typecheck` | green (cli + web + hub `tsc --noEmit` all exit 0) |
| `bun run test` | green (cli Vitest, hub bun:test, web Vitest, then `scripts/check-no-cut-agents.sh` tail) — all Phase 1–12 guard sub-checks PASS |
| `bun run madge:check` | green — `✔ No circular dependency found!` across 632 ts/tsx files after web/dist exclusion |
| `bash scripts/check-no-cut-agents.sh` | green — all phase guard blocks (P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, P11, P12) PASS |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocker] madge:check exclude pattern for web/dist build artifacts**
- **Found during:** Task 1 verify (`bun run madge:check` exited 1 locally)
- **Issue:** Vite's `web/dist/assets/mermaid.core-*.js` build output contains ~63 vendored circular references that madge picks up via transitive traversal even with `--extensions ts,tsx`. These are gitignored build artifacts, not real source cycles. CI is unaffected (cold checkout has no `web/dist`), but local developers cannot run the script idempotently.
- **Fix:** Appended `--exclude '(^\.\./|web/dist)'` to the script string. After exclusion, madge reports `✔ No circular dependency found!` across 632 ts/tsx files. The script remains a single self-contained invocation per D-10 intent.
- **Files modified:** `package.json`
- **Commit:** `07e22c1`

### Pending — Deferred to user / 12-04

**1. [Rule 3 - Deferred] D-11 "CI green on PR" acceptance gate not observed in this execution**
- **What the plan asks:** Push the verify.yml commit to a feature branch / PR and observe a green Actions run end-to-end before declaring done.
- **Why deferred:** Executor environment has no `gh` auth (`gh auth status` → "You are not logged into any GitHub hosts") and the local repo is 295 commits ahead of `origin/main` — pushing/opening a PR is outside the safe-write scope for this executor and requires the human to coordinate the push. Per the orchestrator's `<pr_observation_note>`, this is the expected fallback: emit the script + workflow, complete the plan locally, mark PR-observation pending.
- **Verification path for closer:** When the next push lands on a branch with a PR, the `verify` workflow will run automatically. The closer should record the run URL and run id here (or in 12-04's verification artifact) before archiving Phase 12.
- **Files involved:** `.github/workflows/verify.yml`
- **Status:** Pending — to be observed by user or 12-04 closer.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: ci-trust-boundary | .github/workflows/verify.yml | Workflow runs on `pull_request` from forks. Currently it has no `permissions:` block (inherits repo default — typically `contents: read` for public repos with restricted defaults, but worth double-checking under "Settings → Actions → General"). No secrets are read by the workflow steps, so blast radius is bounded to compute exhaustion. 12-04 may want to add an explicit `permissions: { contents: read }` block as a belt-and-braces measure. |

## Known Stubs

None — both files are fully wired and serve their intended functional purpose.

## Self-Check: PASSED

- `[x]` `package.json` contains `madge:check` script — verified via `grep madge package.json`
- `[x]` `.github/workflows/verify.yml` exists — verified via `ls .github/workflows/verify.yml`
- `[x]` Commit `07e22c1` (Task 1) exists in `git log --oneline` — verified
- `[x]` Commit `b92c19c` (Task 2) exists in `git log --oneline` — verified
- `[x]` Local full gate (`bun typecheck && bun run test && bun run madge:check && bash scripts/check-no-cut-agents.sh`) exits 0 — verified
- `[ ]` D-11 "CI green on PR" acceptance — pending (see Deviations § Pending; deferred to user/12-04 per `<pr_observation_note>`)
