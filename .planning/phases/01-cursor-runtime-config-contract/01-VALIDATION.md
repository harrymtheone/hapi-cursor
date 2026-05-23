---
phase: 01
slug: cursor-runtime-config-contract
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-23
---

# Phase 01 - Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.0.16 for `cli/` and `web/`; Bun test for `hub/` and `shared/`. |
| **Config file** | `web/vitest.config.ts`; package-local test scripts otherwise. |
| **Quick run command** | `bun run typecheck` plus targeted package tests for touched files. |
| **Full suite command** | `bun run test && bun run madge:check && bash scripts/check-no-cut-agents.sh` |
| **Estimated runtime** | Unknown until measured during execution. |

---

## Sampling Rate

- **After every task commit:** Run targeted package tests for touched code, then `bun run typecheck`.
- **After every plan wave:** Run `bun run test && bun run madge:check`.
- **Before `/gsd:verify-work`:** Run `bun run typecheck`, `bun run test`, `bun run madge:check`, and `bash scripts/check-no-cut-agents.sh`.
- **Max feedback latency:** One task commit; no three consecutive implementation tasks may proceed without automated verification.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 01-W0-01 | TBD | 0 | CURS-01 | T-01-01 / T-01-02 | Model ids are parsed from Cursor CLI output without shell concatenation; raw stderr is not exposed to mobile UI. | CLI unit | `cd cli && bun run test -- modelDiscovery` | no - W0 required | pending |
| 01-W0-02 | TBD | 0 | CURS-01 | T-01-03 | Authenticated, machine-scoped discovery returns safe success/error shapes. | hub route/RPC | `cd hub && bun test model-discovery` | no - W0 required | pending |
| 01-W0-03 | TBD | 0 | CURS-01, CURS-02 | T-01-02 | New-session selector exposes loading, empty, safe error, retry, and auto/unspecified states. | web component | `cd web && bun run test -- ModelSelector` | no - W0 required | pending |
| 01-W0-04 | TBD | 0 | CURS-03 | T-01-04 | Active model changes report `applied`, `failed`, or `applies-next-run` truthfully before persistence. | hub/CLI unit | `cd hub && bun test sessionConfigService` | partial - update required | pending |
| 01-W0-05 | TBD | 0 | CURS-04 | T-01-05 | Strict SSE patches update status/model controls without malformed events. | web hook/component | `cd web && bun run test -- useSSE SessionListItem HappyComposer` | partial - update required | pending |

---

## Wave 0 Requirements

- [ ] `cli/src/cursor/modelDiscovery.ts` and `cli/src/cursor/modelDiscovery.test.ts` - parser, timeout, empty list, and safe error mapping for CURS-01.
- [ ] Hub model discovery route/RPC tests - authenticated machine-scoped request path and failure shape for CURS-01.
- [ ] `web/src/components/NewSession/ModelSelector.test.tsx` - loading, error, retry, empty, and auto/unspecified states for CURS-01.
- [ ] Session config tests - status-bearing model switch responses for CURS-03.
- [ ] Session list/composer tests - compact status indicators and composer-adjacent model state for CURS-04.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real Cursor model discovery against the developer account | CURS-01 | Available models are account/runtime dependent. | Open the new-session panel with the local runner connected, confirm discovered model ids match `agent models`, then retry after inducing a discovery failure if practical. |
| Launch with a selected model accepted by Cursor | CURS-02 | End-to-end Cursor CLI acceptance depends on the installed runtime and account. | Start a session with an explicit discovered model, confirm the session runs and metadata/SSE show that model. |
| In-session switch truthfulness | CURS-03 | True hot switch depends on runtime path; remote/headless may only apply next run. | Try switching while idle and while busy; confirm UI reports applied/failed/applies-next-run according to observed runtime behavior. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies.
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify.
- [ ] Wave 0 covers all missing references.
- [ ] No watch-mode flags.
- [ ] Feedback latency measured during execution.
- [ ] `nyquist_compliant: true` set in frontmatter after validation passes.

**Approval:** pending
