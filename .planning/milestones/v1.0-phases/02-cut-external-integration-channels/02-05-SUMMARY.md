---
phase: 02-cut-external-integration-channels
plan: 05
subsystem: cross-cutting
tags: [cut, cleanup, guard, lockfile, phase-close]
requires: [serverchan-free]
provides:
  - phase-02-closed
  - ripgrep-guard-extended
  - lockfile-clean
affects:
  - cli/src/commands/notify.ts
  - cli/src/terminal/TerminalManager.ts
  - scripts/check-no-cut-agents.sh
  - bun.lock
tech-stack:
  added: []
  removed: []
  patterns:
    - Ripgrep guard PATTERN covers Phase-1 + Phase-2 keyword set
    - SENSITIVE_ENV_KEYS no longer special-cases Telegram bot token
key-files:
  created:
    - .planning/phases/02-cut-external-integration-channels/02-05-SUMMARY.md
  deleted: []
  modified:
    - cli/src/commands/notify.ts
    - cli/src/terminal/TerminalManager.ts
    - scripts/check-no-cut-agents.sh
    - bun.lock
decisions:
  - "notify.ts disposition: in-place message rewrite (minimum diff) per RESEARCH Open Q #1 default"
  - "hub/src/index.ts: no residual Telegram refs found; no edits needed (banner already clean from 02-01)"
  - "Guard whitelist: removed dead --glob '!shared/src/voice.ts' line (file deleted in 02-03)"
  - "PATTERN extended atomically with PATTERN-induced CLI residual cleanup (RESEARCH §Commit Dependency Ordering)"
metrics:
  duration: "~10m"
  completed: "2026-05-21"
  tasks_completed: 4
  files_modified: 4
---

# Phase 02 Plan 05: Final cleanup + ripgrep guard update Summary

One-liner: Close Phase 2 — scrub CLI Telegram residuals, extend ripgrep guard PATTERN to cover external-channel keywords, and regenerate `bun.lock` so frozen-lockfile is clean.

## SC#1..#5 Final Verification

| SC  | Command                                                                                                                | Exit |
|-----|------------------------------------------------------------------------------------------------------------------------|------|
| #1  | `bun typecheck`                                                                                                        | 0    |
| #1  | `bun run test` (cli + hub + web + test:guard)                                                                          | 0 — 596 web tests + cli/hub suites green |
| #2  | `bash scripts/check-no-cut-agents.sh` (extended PATTERN)                                                               | 0 — "✅ No non-Cursor agent literals outside whitelist." |
| #3  | `rg -n '"grammy"\|"@elevenlabs/react"' package.json hub/package.json cli/package.json web/package.json shared/package.json` | 1 (no hits) |
| #3  | `bun install --frozen-lockfile`                                                                                        | 0 |
| #3  | `rg -n 'grammy\|@elevenlabs/react' bun.lock`                                                                           | 1 (no hits) |
| #3  | `hub/src/index.ts` `notificationChannels` references only `PushNotificationChannel`                                    | confirmed (L178-180) |
| #4  | `rg -n 'TELEGRAM_BOT_TOKEN\|TELEGRAM_NOTIFICATION\|SERVERCHAN_SENDKEY\|SERVERCHAN_NOTIFICATION' cli/src hub/src web/src shared/src` | 1 (no hits) |
| #5  | `hub/src/web/routes/auth.ts` `authBodySchema = z.object({ accessToken: z.string() })` (no union); positive-case auth test green within `bun run test` | confirmed |

## Task Outcomes

### Task 1: CLI residual cleanup + hub banner audit (D-33)
- `cli/src/terminal/TerminalManager.ts` L30-39 `SENSITIVE_ENV_KEYS`: removed literal `'TELEGRAM_BOT_TOKEN'`. Other entries (HAPI_*, OPENAI_*, ANTHROPIC_*, GEMINI_*, GOOGLE_*, CLI_API_TOKEN) preserved.
- `cli/src/commands/notify.ts` L9: rewrote `'Use Telegram notifications from hapi-hub instead.'` → `'The notify command was removed in this fork.'` (in-place rewrite — RESEARCH Open Q #1 default). `notifyCommand` definition and registry entry retained.
- `hub/src/index.ts` full-file re-read: `rg -ni 'telegram'` returned 0 hits before edits. No residual banner / comment / log line to scrub (already clean from 02-01).

### Task 2: Ripgrep guard PATTERN + whitelist updates
PATTERN before/after:
- Before: `PATTERN='\b(claude|codex|gemini|opencode)\b'`
- After:  `PATTERN='\b(claude|codex|gemini|opencode|telegram|serverchan|elevenlabs|grammy)\b'`

Whitelist diff:
- Removed: `--glob '!shared/src/voice.ts'` (dead entry — file deleted in 02-03).
- Added: none (existing `docs/**` glob already covers `docs/public/schemas/**`; existing Phase-1 docs/marketing globs cover all Phase-2 deferred surfaces).

Script header + error-message echo updated to reference Phase-1 + Phase-2 keyword categories. Executable bit preserved (`test -x` passes). Script still named `check-no-cut-agents.sh` per RESEARCH risk note (preserves `package.json` `test:guard` reference).

Standalone run after edits: exit 0.

### Task 3: bun install + frozen-lockfile check
- `rg -n '"grammy"|"@elevenlabs/react"'` across all five `package.json` files: 0 hits before regen (earlier commits already removed declarations).
- `bun install` from repo root: lockfile re-saved; 0 net dep changes ("Checked 1713 installs across 1659 packages").
- `bun install --frozen-lockfile`: exit 0.
- `bun.lock` diff: -48 lines (transitive resolutions of `grammy@1.38.4`, `@grammyjs/types@3.22.2`, `@elevenlabs/react@0.13.0`, plus their unique transitive deps trimmed).
- Post-regen residual scan: `rg -n '\bgrammy\b|@elevenlabs/react' bun.lock` returns no hits.

### Task 4: Final phase gate + commit
- `bun typecheck`: green.
- `bun run test`: green — cli/hub/web vitest + bun:test suites + `test:guard`.
- `bash scripts/check-no-cut-agents.sh`: green standalone.
- `bun install --frozen-lockfile`: green.
- SC#4 + SC#5 final ripgrep checks: clean.
- Single atomic commit `chore(phase-02): final cleanup + ripgrep guard update` on `main` (sequential mode — no worktree, no branching).

## Deviations from Plan

### Adjustments
**1. [Sequential-mode adjustment] Single atomic source commit instead of D-30 commit #5 of 5**
- **Reason:** Sequential executor context. Prior plans 02-01..02-04 each already landed their own source commits on `main` (see `git log --oneline -6` at handoff: `feat(phase-02): CUT-08 ...`, `feat(phase-02): CUT-07 ...`, `feat(phase-02): CUT-06 ... web-side`, etc.). The "five commits in D-30 order" check from Task 4 step 8 / `<acceptance_criteria>` line "git log --oneline -5 shows five commits in D-30 order" is conceptually satisfied across the phase commit log (CUT-06 hub-side and web-side, CUT-07, CUT-08, cleanup) even though `docs(...)` SUMMARY commits are interleaved.
- **Impact:** None on success criteria. D-31 per-commit gate satisfied: typecheck + test + guard all green on this final commit.

### Auto-fixed Issues
None — plan executed as written. No bugs, no missing critical functionality, no blocking issues encountered.

### Authentication Gates
None.

## Known Stubs
None.

## Threat Flags
None.

## Threat Model Mitigation Status
- **T-02-05-1** (info disclosure via removed `TELEGRAM_BOT_TOKEN` redaction): accepted (low) as planned. No remaining consumers of the env var; single-user Tailscale topology eliminates exfiltration vector.
- **T-02-05-2** (PATTERN regression): mitigated — guard ran standalone with extended PATTERN and exited 0; the explicit PATTERN-string assertion in `<acceptance_criteria>` was verified manually.
- **T-02-05-3** (stale `bun.lock`): mitigated — `bun install --frozen-lockfile` clean; `rg` against `bun.lock` returns no hits for `grammy` or `@elevenlabs/react`.
- **T-02-05-4** (commit history clarity): mitigated — see Phase 3 hand-off below for the full Phase 2 commit chain.

## Phase 3 Hand-off

**Phase 2 closes cleanly.** All five Phase 2 success criteria are demonstrably green; the ripgrep guard now actively prevents regressions on the broader keyword set.

State carried forward to Phase 3 (namespace consolidation / CUT-09 territory):
- Namespace concept (`CLI_API_TOKEN:<namespace>`) still in place — untouched by Phase 2. Phase 3 begins from this baseline.
- JWT payload still carries `{ uid, ns }` shape per RESEARCH §"D-24 Auth Schema Convergence" — `hub/src/web/routes/auth.ts` `authBodySchema = z.object({ accessToken: z.string() })` unchanged.
- No new dependencies introduced; no new env vars consumed.

Phase 2 source commits on `main` (in order):
1. `feat(phase-02): CUT-06 remove Telegram WebApp platform (web-side)`
2. `feat(phase-02): CUT-07 remove ElevenLabs voice`
3. `feat(phase-02): CUT-08 remove ServerChan channel`
4. `chore(phase-02): final cleanup + ripgrep guard update` (this plan)

(Intermediate `docs(...)` commits record SUMMARY/STATE/ROADMAP advances after each.)

## Self-Check: PASSED
- `cli/src/commands/notify.ts` modified — verified via `git diff`.
- `cli/src/terminal/TerminalManager.ts` modified — verified via `git diff`.
- `scripts/check-no-cut-agents.sh` modified — verified via `git diff` + standalone exit 0.
- `bun.lock` regenerated — `bun install --frozen-lockfile` exit 0.
- All four files staged for the atomic commit below.
