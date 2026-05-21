---
phase: 2
slug: cut-external-integration-channels
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-05-21
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Phase 2 is pure-deletion refactor; validation is dominated by "does the codebase still typecheck/test/grep clean" rather than new behavior assertions.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (per-package, via `bun run test`) |
| **Config file** | `cli/vitest.config.ts`, `hub/vitest.config.ts` (none in `web/`) |
| **Quick run command** | `bun typecheck` (whole workspace) |
| **Full suite command** | `bun run test` (cli + hub) |
| **Estimated runtime** | ~30s typecheck, ~60s tests |

---

## Sampling Rate

- **After every task commit:** `bun typecheck`
- **After every plan wave:** `bun run test`
- **After every CUT-* commit (D-31):** `bun typecheck && bun run test`
- **Before `/gsd:verify-work`:** full suite green + ripgrep guard green + `bun.lock` regenerated
- **Max feedback latency:** 60s

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 02-01-* | 01 (CUT-06 hub) | 1 | CUT-06 | — | N/A | unit + smoke | `bun typecheck && cd hub && bun run test` | ✅ existing | ⬜ pending |
| 02-02-* | 02 (CUT-06 web) | 2 | CUT-06 | — | N/A | typecheck + build | `bun typecheck && cd web && bun run build` | ✅ existing | ⬜ pending |
| 02-03-* | 03 (CUT-07) | 3 | CUT-07 | — | N/A | typecheck + build | `bun typecheck && bun run test && cd web && bun run build` | ✅ existing | ⬜ pending |
| 02-04-* | 04 (CUT-08) | 4 | CUT-08 | — | N/A | unit + typecheck | `bun typecheck && cd hub && bun run test` | ✅ existing | ⬜ pending |
| 02-05-* | 05 (final cleanup + guard) | 5 | CUT-06/07/08 | — | N/A | guard script + lockfile | `bun typecheck && bun run test && bash scripts/check-no-cut-agents.sh` | ✅ existing (Phase 1) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

Phase 2 SC mapping:
- **SC#1** ↔ `bun typecheck` + `bun run test` after each commit
- **SC#2** ↔ ripgrep guard script (extended in commit #5) — zero matches for `telegram` / `serverchan` / `elevenlabs` / `grammy` outside whitelist
- **SC#3** ↔ assertion in guard script: `package.json` declares no `grammy` / `@elevenlabs/react`; `hub/src/index.ts` channel array length == 1
- **SC#4** ↔ guard script keyword check covers `TELEGRAM_BOT_TOKEN` / `TELEGRAM_NOTIFICATION` / `SERVERCHAN_SENDKEY` / `SERVERCHAN_NOTIFICATION` (subset of `telegram` / `serverchan` zero-match)
- **SC#5** ↔ `/api/auth` body schema is `z.object({ accessToken: z.string() })`; existing test in `hub/src/web/routes/auth.test.ts` (or equivalent) covers access-token branch

---

## Wave 0 Requirements

- [x] Existing Vitest infrastructure covers all phase requirements (per Phase 1 — no new test framework needed)
- [x] Ripgrep guard script from Phase 1 exists at `scripts/check-no-cut-agents.sh` (verified against `.planning/phases/01-cut-non-cursor-agents/01-VERIFICATION.md` + `01-05-PLAN.md`) — extension only, no new infrastructure
- [x] Phase 1 guard script location confirmed in 02-05-PLAN.md `<read_first>` and `<files>` (= `scripts/check-no-cut-agents.sh`)

*No new test infrastructure. Wave 0 is verification-only.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Hub starts cleanly with no Telegram bot init logs / no ServerChan channel registration | CUT-06, CUT-08 | Boot-time observability not asserted in unit tests | `cd hub && bun run dev` → confirm startup banner shows only Web Push channel |
| Web app loads without Telegram WebApp SDK errors in console | CUT-06 | Browser console state | Open `http://localhost:5173` → DevTools console → no `Telegram is not defined` errors |
| Composer no longer shows voice mic button | CUT-07 | Visual regression | Open session view → composer toolbar has no mic icon |

*All other phase behaviors have automated verification (typecheck, test, ripgrep).*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify (commit-level grain ensures this)
- [ ] Wave 0 covers all MISSING references (none — re-uses Phase 1 infra)
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
