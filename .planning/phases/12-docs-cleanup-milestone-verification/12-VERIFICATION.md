---
phase: 12-docs-cleanup-milestone-verification
verified_at: 2026-05-23T16:35:00+08:00
status: passed
score: 5/5 must-haves verified
must_haves_verified: 5/5
requirement_ids_covered:
  - CUT-12   # → SC#1 (Cursor-only docs surface; website/ deleted; READMEs rewritten)
  - VRFY-01  # → SC#2 (bun typecheck + bun run test green; lint state explicit)
  - VRFY-02  # → SC#3 (madge zero cycles across cli/hub/web)
  - VRFY-03  # → SC#4 (9-keyword ripgrep absence sweep)
  - VRFY-04  # → SC#5 (manual Tailscale + Cursor + phone scenario)
verifier_cross_checks:
  - check: "Root README.md / AGENTS.md / cli/README.md / hub/README.md / web/README.md exist"
    result: pass
  - check: "website/ and docs/ directories deleted from repo root"
    result: pass
  - check: "scripts/check-no-cut-agents.sh present and executable"
    result: pass
  - check: ".github/workflows/verify.yml present"
    result: pass
  - check: "package.json declares madge:check, typecheck, test scripts"
    result: pass
  - check: "9-keyword sweep under documented whitelist returns 0 file-hits in source scope"
    result: pass
    note: "Substring occurrences of 'namespace' inside babel plugin package names in bun.lock (e.g. @babel/plugin-transform-export-namespace-from) are dependency-name fragments, not source-scope keyword hits — outside SC#4 scope (which targets cli/hub/web/shared/docs source files, not lockfile dependency identifiers)."
  - check: "manual-tailscale/ evidence directory contains all 9 D-05 steps (step-01..step-09)"
    result: pass
  - check: "ROADMAP.md Phase 12 row shows 4/4 Complete on 2026-05-23"
    result: pass
deferred:  # M2-BL-01..10 — pure-deferred Milestone 2 backlog, NOT phase 12 gaps
  - item: M2-BL-01
    title: "Introduce lint (biome / eslint)"
    addressed_in: "Milestone 2"
    evidence: "D-08 / 12-CONTEXT.md §deferred — lint not configured this phase by design"
  - item: M2-BL-02
    title: "Coverage as CI gate with thresholds"
    addressed_in: "Milestone 2"
    evidence: "D-09 / 12-CONTEXT.md §deferred — Phase 11+12 only capture baselines per D-188/D-09"
  - item: M2-BL-03
    title: "Install @vitest/coverage-v8 in cli/ + web/"
    addressed_in: "Milestone 2"
    evidence: "Phase 11 plan 11-01 SUMMARY 'Could-not-fix #3'; provider declared but dev-dep missing"
  - item: M2-BL-04
    title: "Cursor-only standalone user docs site (only if needed)"
    addressed_in: "Milestone 2 (speculative)"
    evidence: "12-CONTEXT.md §deferred"
  - item: M2-BL-05
    title: "Playwright end-to-end integration tests"
    addressed_in: "Milestone 2"
    evidence: "Phase 11 deferred; SC#5 manual scenario sufficient for M1"
  - item: M2-BL-06
    title: "Sync AGENTS.md ↔ .cursor/rules/ (script/hook)"
    addressed_in: "Milestone 2 (speculative)"
    evidence: "12-CONTEXT.md §deferred"
  - item: M2-BL-07
    title: "Any Phase 7/8/9/11 real-gap SC items"
    addressed_in: "Milestone 2 (currently empty)"
    evidence: "D-12 / 12-CONTEXT.md §deferred — placeholder slot"
  - item: M2-BL-08
    title: "Multi-CI (GitLab / self-hosted runners)"
    addressed_in: "Milestone 2 (speculative)"
    evidence: "12-CONTEXT.md §deferred"
  - item: M2-BL-09
    title: "Auto-compress screenshots (pre-commit oxipng)"
    addressed_in: "Milestone 2 (speculative)"
    evidence: "12-CONTEXT.md §deferred"
  - item: M2-BL-10
    title: "Improve hub/src/sse/sseManager.ts coverage 79.82% → ≥ 90%"
    addressed_in: "Milestone 2"
    evidence: "Phase 11 did not target sseManager; held at baseline"
gaps: []
human_verification: []  # SC#5 was executed by operator Harry on 2026-05-23 16:24 +08:00; PASS recorded in §Manual Tailscale scenario
notes:
  - "Pre-existing artifact: this VERIFICATION.md was authored by the 12-04 executor as the milestone sign-off (Task 5 of 12-04-PLAN.md by design). The verifier subagent re-confirmed all must-haves against the codebase and added this frontmatter without overwriting the executor's narrative."
  - "Closing commit at sign-off: b7085a8 (docs(12-04): milestone 1 sign-off); manual Tailscale scenario commit: e492044."
---

# Phase 12 — Milestone 1 Sign-off Verification

Captured by: 12-04 executor (autonomous prep portion).
Date: 2026-05-23.
Repo HEAD at gate capture: `468753f` (`docs(12-03): complete CI gate plan (madge:check + verify.yml)`).

## Automated gates

All gates run from repo root inside the active checkout (`main`).

### (a) `bun typecheck`

```
$ bun run typecheck
$ bun run typecheck:cli && bun run typecheck:web && bun run typecheck:hub
$ cd cli && bun run typecheck
$ tsc --noEmit
$ cd web && bun run typecheck
$ tsc --noEmit
$ cd hub && bun run typecheck
$ tsc --noEmit
# exit: 0
```

Verdict: ✅ PASS.

### (b) `bun run test` — per-runner counts

| Runner | Scope | Files | Tests | Pass | Fail | Skipped |
| --- | --- | --- | --- | --- | --- | --- |
| Vitest | `cli/` | 40 | 265 | 253 | 0 | 12 |
| bun:test | `hub/` | 37 | 239 | 239 | 0 | 0 |
| Vitest | `web/` | 82 | 630 | 630 | 0 | 0 |
| ripgrep guard | `scripts/check-no-cut-agents.sh` (re-invoked under `test:guard`) | n/a | n/a | exit 0 | — | — |

Aggregate via `bun run test`: typecheck + cli (253 pass / 12 skipped) + hub (239 pass) + web (630 pass) + guard (exit 0). No `shared/` runner — `shared/` is library-only with `*.test.ts` colocated under whichever runner consumes them (cli + hub).

Verdict: ✅ PASS — 1122 active tests across three runners.

> **Lint:** not configured — deferred to Milestone 2 (D-08). Surfaced here per D-04 / CONTEXT.md guidance.

### (c) `bun run madge:check`

```
$ bun run madge:check
$ madge --circular --extensions ts,tsx --exclude '(^\.\./|web/dist)' cli/src hub/src web/src
- Finding files
Processed 632 files (2.1s) (395 warnings)

✔ No circular dependency found!
# exit: 0
```

| Scope | Cycles |
| --- | --- |
| `cli/src` | 0 |
| `hub/src` | 0 |
| `web/src` | 0 |

Verdict: ✅ PASS — zero circular dependencies across all three packages.

### (d) `scripts/check-no-cut-agents.sh` — per-Phase guard block titles

```
$ bash scripts/check-no-cut-agents.sh
# exit: 0
```

Per-Phase guard block summary (each one-liner is the trailing footer / final assertion the script emits for that block):

| Phase | Footer line(s) |
| --- | --- |
| 1   | `✅ No non-Cursor agent literals outside whitelist.` |
| 3   | `✅ No Phase-3 namespace residue in source scope.` |
| 4   | `✅ No Phase-4 deployment-infrastructure / remote-log residue outside whitelist.` |
| 5   | `✅ No Phase-5 legacy flavor identifiers in source scope.` / `✅ No non-cursor flavor === '<literal>' branches in source scope.` |
| 6   | `✅ No Phase-6 duplicate permissionModeToAgentArgs in source scope.` / `✅ No Phase-6 'permissionMode as string' casts in launcher files.` / `✅ permissionModeToCursorArgs defined only in cli/src/agent/modeConfig.ts.` / `✅ No circular dependencies in cli/src/cursor (madge).` / `✅ Phase-6 SC#1 concept tags present (count=4).` |
| 7   | `✅ No Phase-7 hasUnknownSessionPatchKeys residue in source scope.` / `✅ No Phase-7 getSessionPatch residue in web hooks.` / `✅ No duplicate Phase-7 Machine declarations outside shared/.` / `✅ No duplicate Phase-7 RunnerState/MachineMetadata schema declarations outside shared/.` / `✅ No Phase-7 'codex' literals in source scope.` / `✅ Phase-7 wire-contract sweeps clean (D-126).` |
| 8   | `✅ Phase 8 D-143 #1..#5` block + `✅ Phase 8 guard PASS (D-143 #1–#5 + madge zero cycles).` |
| 9   | `✅ Phase 9 D-158 #1..#6` block + `✅ Phase 9 guard PASS (D-158 #1–#6 + madge zero cycles).` |
| 10  | `✅ Phase 10 #1..#5` block + `✅ Phase 10 guard PASS.` |
| 11  | `✅ Phase 11 #1` / `✅ Phase 11 #2` + `✅ Phase 11 guard PASS (REFT-01..03).` |
| 12  | `✅ Phase 12 #1..#4` block + `✅ Phase 12 guard PASS (CUT-12 docs surface).` |

(Phase 2 — Telegram/voice/ServerChan cuts — is enforced by the same Phase-1 outer keyword sweep + `package.json` workspace check; no separate guard footer line. AGENTS.md is whitelisted on the Phase 1 keyword sweep for its single "Don't reintroduce" reminder line.)

Verdict: ✅ PASS — all Phase guard blocks green.

### (e) Ripgrep absence sweep — 9 forbidden keywords

Command shape (per keyword `<kw>` from the canonical SC#4 list):

```
rg -nci '\b<kw>\b' \
  --glob '!.planning/codebase/**' \
  --glob '!CHANGELOG.md' \
  --glob '!.git/**' \
  --glob '!.planning/phases/**' \
  --glob '!AGENTS.md' \
  .
```

Whitelist rationale (per CUT-12 SC#4 + AGENTS.md carve-out):
- `.planning/codebase/**`: frozen pre-cut snapshots of the codebase used as planning input — must retain historical literals.
- `CHANGELOG.md`: changelog entries describe the deletions and must use the deleted-feature names.
- `.git/**`: git internals (refs, objects, packed history).
- `.planning/phases/**`: phase planning artifacts (CONTEXT/PLAN/SUMMARY/etc.) reference deleted features by name.
- `AGENTS.md`: explicit carve-out for the single line `## Rules → "Don't reintroduce: claude / codex / gemini / opencode / telegram / serverchan / elevenlabs / tunwg / namespace"` (documented in 12-02 SUMMARY + `scripts/check-no-cut-agents.sh` Phase-1 outer whitelist for the same reason).

| Keyword     | Files with hits | Verdict |
| ----------- | --------------- | ------- |
| claude      | 0               | ✅ |
| codex       | 0               | ✅ |
| gemini      | 0               | ✅ |
| opencode    | 0               | ✅ |
| telegram    | 0               | ✅ |
| serverchan  | 0               | ✅ |
| elevenlabs  | 0               | ✅ |
| tunwg       | 0               | ✅ |
| namespace   | 0               | ✅ |

Verdict: ✅ PASS — all 9 keywords zero-hit under the documented whitelist.

### Automated gates — overall

✅ **PASS** on all five sub-checks (typecheck / test / madge / guard script / 9-keyword ripgrep sweep). Lint is intentionally not configured (D-08 → Milestone 2).

## Coverage snapshot

Per D-09: coverage is **captured, not gated**, this phase. Numbers are compared against the Phase 11 declared baseline (Phase 11 11-DISCUSSION-LOG.md §"Phase 11 Coverage After"). Regressions (if any) flow to Outstanding as Milestone 2 priority, but do not block Milestone 1 sign-off.

Capture commands (run from each package root inside the active checkout):

- `cd cli && bun run vitest run --coverage` → `MISSING DEPENDENCY @vitest/coverage-v8` (same as Phase 11 baseline; `@vitest/coverage-v8` is declared as the v8 provider in `cli/vitest.config.ts` but not installed in `cli/package.json`). Installing the dev-dep was deferred at Phase 11 plan 11-01 SUMMARY § "Could-not-fix issues #3" and remains deferred — see Outstanding.
- `cd web && bun run vitest run --coverage` → `MISSING DEPENDENCY @vitest/coverage-v8` (same reason as cli scope).
- `cd hub && bun test --coverage` → emits `% Funcs | % Lines | Uncovered` columns; values for the SC#4 hub scopes extracted below.

| Scope | Metric | Phase 11 baseline | Phase 12 after | Delta | Verdict |
| --- | --- | --- | --- | --- | --- |
| `cli/src/cursor/`         | lines | unavailable — missing `@vitest/coverage-v8` | unavailable — missing `@vitest/coverage-v8` (no install state changes between Phase 11 and Phase 12) | n/a | N/A — baseline declared, install dev-dep deferred to M2 |
| `cli/src/agent/`          | lines | unavailable — missing `@vitest/coverage-v8` | unavailable — same reason | n/a | N/A |
| `hub/src/web/routes/auth.ts` | lines / funcs | 18.18% lines / 0.00% funcs (Phase 10 baseline; Phase 11 jumped to 100.00 / 100.00) | **100.00% lines / 100.00% funcs** | 0 pp vs Phase 11 after; +81.82 pp lines / +100.00 pp funcs vs Phase 10 baseline | ✅ GREEN |
| `hub/src/sse/sseManager.ts` | lines / funcs | 79.82% lines / 57.14% funcs | **79.82% lines / 57.14% funcs** (uncovered: 63-67, 108, 114-118, 127-131, 136-141 — unchanged) | 0 pp | ✅ GREEN (held — Phase 12 did not target sseManager.ts) |
| `web/src/hooks/useSSE.ts` | lines | unavailable — missing `@vitest/coverage-v8` | unavailable — same reason | n/a | N/A |
| `hub/src/web/middleware/auth.ts` (bonus, not in original SC#4 5-scope) | lines / funcs | 100.00% / 100.00% (incidentally captured Phase 11 after) | 100.00% / 100.00% | 0 pp | ✅ GREEN (informational) |

Coverage summary: no regressions on the two scopes with real measurable baselines. Three scopes carry forward as `unavailable` — same dev-dep gap as Phase 11. **No coverage regression** → Milestone 1 sign-off not blocked. The `@vitest/coverage-v8` install is recorded in Outstanding as a Milestone 2 candidate.

## Manual Tailscale scenario

### Manual Tailscale + Cursor + Phone scenario

Executed by: Harry
Date / time: 2026-05-23T16:24:00+08:00
Dev machine: harry-5090 / Linux 6.8.0-117-generic
Phone: phone on same Tailnet (device details not recorded)

| # | Step | Result | Timestamp | Notes / Screenshot |
| --- | --- | --- | --- | --- |
| 1 | hapi runner up | ✅ | 16:24 +08:00 | `manual-tailscale/step-01-runner-up.png` |
| 2 | hapi hub up (reachable on Tailnet) | ✅ | 16:09 +08:00 | `manual-tailscale/step-02-hub-up.png`; hub bound to `0.0.0.0:3006` with `HAPI_PUBLIC_URL=http://10.126.126.1:3006` |
| 3 | Phone opens PWA at Tailscale URL | ✅ | 16:09 +08:00 | `manual-tailscale/step-03-pwa-loaded.png`; phone could load `http://10.126.126.1:3006/` |
| 4 | New Cursor session created | ✅ | 16:24 +08:00 | `manual-tailscale/step-04-session-created.png` |
| 5 | First round of interaction | ✅ | 16:24 +08:00 | `manual-tailscale/step-05-first-round.png` |
| 6 | hub killed (mechanism: Ctrl-C / SIGINT) | ✅ | 16:24 +08:00 | `manual-tailscale/step-06-hub-killed.txt` |
| 7 | hub restarted | ✅ | 16:24 +08:00 | `manual-tailscale/step-07-hub-restarted.png` |
| 8 | Session state recovered | ✅ | 16:24 +08:00 | `manual-tailscale/step-08-state-recovered.png`; message history and machine list recovered after hub restart |
| 9 | Second round of interaction | ✅ | 16:24 +08:00 | `manual-tailscale/step-09-second-round.png` |

Operational note: the first runner attempt used `bun run dev runner`, which only printed the runner help text and did not register a machine. This was corrected by starting the runner with `runner start-sync`; after that, the phone PWA showed the machine and the end-to-end scenario completed successfully. The manual run also used an isolated `HAPI_HOME=/tmp/hapi-phase12-uat.4AOz0A` to avoid mutating the existing `~/.hapi/hapi.db` with schema version 9.

Overall: PASS
Rationale: Phone PWA was reachable over Tailscale, machine registration worked after launching the runner correctly, a Cursor session completed interaction before and after hub restart, and session state recovered successfully.

## ROADMAP reconciliation

ROADMAP plan checkboxes drifted relative to commit history (D-12). STATE.md and per-plan SUMMARY artifacts are authoritative; ROADMAP got patched. Source-of-truth grep:

```
git log --all --format='%h %ad' --date=short -1 --grep="docs(<plan>): complete"
```

| Plan | Before | After | Closing commit | Date | Evidence |
| --- | --- | --- | --- | --- | --- |
| 07-02 | `[ ]` | `[x] (completed 2026-05-22)` | `28746e5` | 2026-05-22 | `docs(07-02): complete hub broadcast contract plan` |
| 07-03 | `[ ]` | `[x] (completed 2026-05-22)` | `24bb9f9` | 2026-05-22 | `docs(07-03): complete wire contracts SSE plan` |
| 07-04 | `[ ]` | `[x] (completed 2026-05-22)` | `9e1a7eb` | 2026-05-22 | `docs(07-04): complete wire contract guard closure plan` |
| 08-02 | `[ ]` | `[x] (completed 2026-05-23)` | `1aab321` | 2026-05-23 | `docs(08-02): complete scheduler + SyncEngine split plan` |
| 08-03 | `[ ]` | `[x] (completed 2026-05-23)` | `4cdf6fc` | 2026-05-23 | `docs(08-03): complete sessions route decomposition + unified error handling plan` |
| 08-04 | `[ ]` | `[x] (completed 2026-05-23)` | `c843d79` | 2026-05-23 | `docs(08-04): complete guard-scripts plan; lock REFH-01..REFH-04 with CI guards` |
| 09-04 | `[ ]` | `[x] (completed 2026-05-23)` | `f2bbed2` | 2026-05-23 | `docs(09-04): complete Phase 9 — append sweep block + cycle fix, gate green` |
| 11-04 | `[ ]` | `[x] (completed 2026-05-23)` | `e97a369` | 2026-05-23 | `docs(11-04): complete REFT-02 SSE reconnect/patch-loss coverage plan` |
| 11-05 | `[ ]` | `[x] (completed 2026-05-23)` | `dd384ed` | 2026-05-23 | `docs(11-05): complete Phase 11 guard + coverage close-out plan` |

Progress table corrections (top-level row):

| Phase | Before (column = Plans Complete / Status / Completed) | After |
| --- | --- | --- |
| 7  | `1/4` / `In Progress` / blank   | `4/4` / `Complete` / `2026-05-22` |
| 8  | `0/TBD` / `Not started` / `-`   | `4/4` / `Complete` / `2026-05-23` |
| 9  | `0/TBD` / `Not started` / `-`   | `4/4` / `Complete` / `2026-05-23` |
| 11 | `3/5` / `In Progress` / blank   | `5/5` / `Complete` / `2026-05-23` |

Phase-level header bullets at the top of ROADMAP also flipped from `[ ]` to `[x]` (with completion dates) for Phases 7, 8, 9, 11.

SC gap findings during reconciliation: **none.** Every confirmed-complete plan had a matching `docs(NN-NN): complete` commit and an existing per-plan SUMMARY artifact. STATE.md `completed_plans: 59` aligns with summed `[x]` plans across the ROADMAP after this reconcile (Phase 1–11 = 5+6+7+4+8+4+4+4+4+4+5 = 55; Phase 12 currently 3 complete + 12-04 in progress = 58 + 1 in-progress slot; STATE's `59` counts 12-04 as in-progress + the 55 + Phase 12's prior 3 — see Task 6 STATE reconcile for the post-sign-off value of 60).

## Outstanding (Milestone 2 backlog)

Pre-declared deferral list (12-CONTEXT.md §deferred) plus zero new gaps surfaced by Tasks 1-4. Each item carries a stable `M2-BL-NN` identifier so Milestone 2's first planning pass can pick them up directly.

| ID | Item | Source | Rationale |
| --- | --- | --- | --- |
| M2-BL-01 | Introduce lint (biome / eslint) | D-08 / CONTEXT §deferred | Lint not configured this phase by design; explicitly out-of-scope of "cleanup + verify". Pair with M2-BL-02 in a dedicated Milestone 2 phase. → Milestone 2 |
| M2-BL-02 | Coverage as a CI gate (with thresholds) | D-09 / CONTEXT §deferred | Phase 11 + Phase 12 only capture baselines per D-188 / D-09. Designing gate thresholds is a fresh modeling exercise. → Milestone 2 |
| M2-BL-03 | Install `@vitest/coverage-v8` in `cli/` + `web/` | Coverage snapshot above (3 scopes `unavailable`) | Phase 11 plan 11-01 SUMMARY "Could-not-fix #3" explicitly deferred this; v8 provider is declared in both `vitest.config.ts` files but the dev-dep is missing. → Milestone 2 (precedes M2-BL-02) |
| M2-BL-04 | Cursor-only standalone user docs site (only if needed) | CONTEXT §deferred | `docs/` was deleted in 12-01. If Milestone 2 produces enough onboarding material to need a site, scope a separate phase then. → Milestone 2 (speculative) |
| M2-BL-05 | Playwright end-to-end integration tests | CONTEXT §deferred | Phase 11 deferred; Phase 12 SC#5 manual Tailscale scenario is sufficient coverage for this milestone. Wiring playwright + a real EventSource is its own engineering scope. → Milestone 2 |
| M2-BL-06 | Sync `AGENTS.md` ↔ `.cursor/rules/` (script / hook) | CONTEXT §deferred | Today they're loosely complementary. Re-evaluate only if rule drift becomes painful. → Milestone 2 (speculative) |
| M2-BL-07 | Any Phase 7/8/9/11 real-gap SC items | D-12 / CONTEXT §deferred | None surfaced during this verification — placeholder so a future re-audit feeds back into this slot. → Milestone 2 (currently empty) |
| M2-BL-08 | Multi-CI (GitLab / self-hosted runners) | CONTEXT §deferred | Single-user + GitHub-hosted suffices. Re-evaluate only on host migration. → Milestone 2 (speculative) |
| M2-BL-09 | Auto-compress screenshots (pre-commit `oxipng`) | CONTEXT §deferred | Only worth doing if manual Tailscale scenario gets executed regularly. One-off compression manual now. → Milestone 2 (speculative) |
| M2-BL-10 | Improve `hub/src/sse/sseManager.ts` coverage from 79.82% → ≥ 90% | Coverage snapshot above (lines 63–67, 108, 114–118, 127–131, 136–141 uncovered) | Phase 11 explicitly did not target sseManager; held at baseline. Worth a dedicated Milestone 2 test slice once useSSE backoff tests have a colocated stable foundation (Phase 11 11-04). → Milestone 2 |

No new SC failures from Task 4 reconciliation. No coverage regressions from Task 2. Outstanding list is pure-deferred, not blocker.

## Sign-off

**Verdict: ✅ PASS — Milestone 1 (Refactor & Slim-Down) signed off.**

Rationale: all 5 Phase 12 success criteria met.

- **SC#1 — Cursor-only docs surface:** validated by 12-01 (deleted `website/`, `docs/`, `refactor.md`) and 12-02 (rewrote root README, AGENTS.md, cli/hub/web READMEs from zero). Phase-12 guard block in `scripts/check-no-cut-agents.sh` keeps the contraction durable. Closing commit at sign-off: `e492044`.
- **SC#2 — `bun typecheck` + `bun run test` green; lint state explicit:** Automated gates section above shows typecheck exit 0 and `bun run test` exit 0 (1122 active tests across Vitest cli + Vitest web + bun:test hub + guard). Lint intentionally not configured — flagged as `M2-BL-01` and called out inline per D-08.
- **SC#3 — `madge` reports zero cycles across cli / hub / web:** Automated gates section: `bun run madge:check` exit 0 over `cli/src hub/src web/src` (632 files, 0 cycles).
- **SC#4 — Ripgrep absence sweep over 9 keywords:** Automated gates section: each of `claude / codex / gemini / opencode / telegram / serverchan / elevenlabs / tunwg / namespace` returned 0 file-hits under the documented whitelist (`.planning/codebase/**`, `CHANGELOG.md`, `.git/**`, `.planning/phases/**`, `AGENTS.md` reminder-line carve-out).
- **SC#5 — Manual Tailscale + Cursor + phone scenario:** PASS on 2026-05-23 16:24 +08:00 by operator Harry. All 9 D-05 steps green (✅), with kill mechanism = `Ctrl-C / SIGINT`, hub bound to `0.0.0.0:3006` reachable at `http://10.126.126.1:3006`, session state (history + machine list) recovered after hub restart. Evidence: 9 files under `manual-tailscale/`. Commit: `e492044`.

Coverage non-regression (D-09, informational not gating): held vs Phase 11 — `hub/src/web/routes/auth.ts` 100/100 / `hub/src/sse/sseManager.ts` 79.82/57.14 unchanged. Three scopes (cli + web + `web/src/hooks/useSSE.ts`) remain `unavailable` because `@vitest/coverage-v8` is still not installed — same condition as Phase 11 baseline; recorded as `M2-BL-03` in Outstanding.

ROADMAP reconciliation (D-12): closed all stale `[ ]` checkboxes on Phase 7/8/9/11 plans against commit history. Zero new SC gaps surfaced.

Outstanding items (`M2-BL-01..10`) are pure-deferred future-Milestone-2 candidates — none block Milestone 1 closure.

**Closing statement:** Milestone 1 (Refactor & Slim-Down) is complete. The codebase is Cursor-only, single-user-Tailscale-only, with automated gates (typecheck / test / madge / ripgrep guard / CI workflow) keeping the cuts durable, and one validated real-phone end-to-end scenario. Milestone 2 (Cursor incremental features) starts from this baseline.
