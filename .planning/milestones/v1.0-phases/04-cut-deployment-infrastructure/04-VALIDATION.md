---
phase: 04
slug: cut-deployment-infrastructure
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-21
---

# Phase 04 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest for CLI/web, Bun test for hub, shell guard for cut keywords |
| **Config file** | `cli/vitest.config.ts`, `web/vitest.config.ts`; hub uses package-level `bun test` |
| **Quick run command** | `bun typecheck && bun run test` |
| **Full suite command** | `bun typecheck && bun run test && bun run build:single-exe` |
| **Estimated runtime** | ~300 seconds |

---

## Sampling Rate

- **After every task commit:** Run `bun typecheck && bun run test`
- **After every plan wave:** Run `bun typecheck && bun run test`
- **Before `/gsd:verify-work`:** Run `bun typecheck && bun run test && bun run build:single-exe`
- **Max feedback latency:** 300 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 01 | 1 | CUT-10 | T-04-01 | Built-in relay/tunwg startup path cannot run or expose token-bearing QR/direct relay URL | typecheck + guard | `bun typecheck && bun run test:guard` | partial | pending |
| 04-02-01 | 02 | 1 | CUT-10 | T-04-02 | Old relay env/settings surface is removed or explicitly rejected, not silently accepted | unit + typecheck | `bun typecheck && bun run test` | partial | pending |
| 04-03-01 | 03 | 1 | CUT-11 | T-04-03 | CLI logging stays local-only and never uploads logs to `HAPI_API_URL` | unit | `cd cli && bun run test src/ui/logger.test.ts --runInBand` | missing W0 | pending |
| 04-03-02 | 03 | 1 | CUT-11 | T-04-03 | Doctor output does not surface the dangerous remote-log toggle | unit | `cd cli && bun run test src/ui/doctor.test.ts --runInBand` | missing W0 | pending |
| 04-04-01 | 04 | 2 | CUT-10, CUT-11 | T-04-01 / T-04-03 | Build artifact pipeline has no tunwg download/embed step and keyword guard blocks regressions | build + guard | `bun typecheck && bun run test && bun run build:single-exe` | partial | pending |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

- [ ] `cli/src/ui/logger.test.ts` — covers CUT-11 local-only logging and verifies no remote `fetch` upload path remains.
- [ ] `cli/src/ui/doctor.test.ts` — covers CUT-11 doctor output without `DANGEROUSLY_LOG_TO_SERVER_FOR_AI_AUTO_DEBUGGING`.
- [ ] `hub/src/config/serverSettings.test.ts` — add legacy relay-field rejection cases if implementation exposes old relay settings keys.
- [ ] `scripts/check-no-cut-agents.sh` — extend the existing guard for `tunwg`, `HAPI_RELAY_`, `DANGEROUSLY_LOG_TO_SERVER_FOR_AI_AUTO_DEBUGGING`, and plan-level relay-mode/hosted-web sweeps.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Local service managers no longer pass `hapi hub --relay` | CUT-10 | Host-local systemd/launchd/pm2 state is outside repo source control | If the user runs HAPI as a long-lived service, inspect the service command and remove `--relay` / `--no-relay` manually. |
| Stale built/runtime artifacts do not mislead verification | CUT-10 | Existing `dist-exe/` or `~/.hapi/runtime` contents may predate Phase 04 | After source changes, run a clean `bun run build:single-exe`; delete stale local artifacts only if verification observes old tunwg output. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all missing references
- [ ] No watch-mode flags
- [ ] Feedback latency < 300s
- [ ] `nyquist_compliant: true` set in frontmatter once Wave 0 and plan coverage are verified

**Approval:** pending
