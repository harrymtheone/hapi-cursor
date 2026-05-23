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

_pending Task 2_

## Manual Tailscale scenario

_pending Task 3 (human-required — D-05 9-step checklist on Tailnet phone)_

## ROADMAP reconciliation

_pending Task 4_

## Outstanding (Milestone 2 backlog)

_pending Task 5_

## Sign-off

_pending Task 5 (verdict written after Task 4 ROADMAP reconcile + Task 3 manual scenario complete)_
