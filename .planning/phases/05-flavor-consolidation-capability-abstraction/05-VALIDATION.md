---
phase: 5
slug: flavor-consolidation-capability-abstraction
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-05-22
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Filled by planner from `05-RESEARCH.md` §Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (via `bun run test`) |
| **Config file** | `shared/vitest.config.ts`, `hub/vitest.config.ts`, `cli/vitest.config.ts` |
| **Quick run command** | `bun --filter shared run test` |
| **Full suite command** | `bun typecheck && bun run test` |
| **Estimated runtime** | ~60–120 seconds |

---

## Sampling Rate

- **After every task commit:** Run `bun --filter <touched-package> run test` + `bun typecheck`
- **After every plan wave:** Run `bun typecheck && bun run test`
- **Before `/gsd:verify-work`:** Full suite + ripgrep source-guard must be green
- **Max feedback latency:** 120 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| _to be filled by planner_ | | | | | | | | | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `shared/src/flavors.test.ts` — rewrite to capability-table assertions (23 test cases per RESEARCH §Capability Lookup Test)
- [ ] `scripts/check-no-cut-agents.sh` (or equivalent source-guard) — additive patterns per D-84

*Planner: enumerate any other Wave-0 stubs the slicing needs.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| _none expected — phase is type/refactor only_ | CUT-05/REFA-01 | n/a | n/a |

*All phase behaviors have automated verification.*

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 120s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved (plan 05-08 phase-gate green: bun typecheck + bun run test (532 tests) + bash scripts/check-no-cut-agents.sh all exit 0)
