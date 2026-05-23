---
phase: 11
slug: test-gap-fill
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-23
---

# Phase 11 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Full design rationale lives in `11-RESEARCH.md` § Validation Architecture — this file is the executable contract for plans + execute-phase + verify-phase.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework (cli)** | Vitest `^4.0.16` |
| **Framework (web)** | Vitest `^4.0.16` (jsdom) |
| **Framework (hub)** | `bun:test` (Bun 1.3.14) |
| **Config (cli)** | `cli/vitest.config.ts` |
| **Config (web)** | `web/vitest.config.ts` + `web/src/test/setup.ts` |
| **Config (hub)** | none — `bun test` auto-discovers `**/*.test.ts` |
| **Quick run command (per-file, cli)** | `cd cli && bun run vitest run <path>` |
| **Quick run command (per-file, web)** | `cd web && bun run vitest run <path>` |
| **Quick run command (per-file, hub)** | `cd hub && bun test <path>` |
| **Full suite command** | `bun run test` (repo root — runs cli + hub + web sequentially) |
| **Estimated runtime (full)** | ~20–40 seconds |

---

## Sampling Rate

- **After every task commit:** Run the per-file quick-run command for the touched test file (≤ 1 s).
- **After every plan wave:** Run the affected package's full suite (`bun run test:cli` / `:hub` / `:web` — exact name per `package.json`).
- **Before `/gsd:verify-work`:** `bun run test` (root) + `bash scripts/check-no-cut-agents.sh` + `bun typecheck` (per package) all green.
- **Max feedback latency:** 5 seconds for per-task quick runs.

---

## Per-Task Verification Map

> Populated by `gsd-planner` as PLAN.md task IDs are assigned. Skeleton rows below define the required columns; planner replaces them with one row per task.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 11-01-?? | 01 | 1 | REFT-01 | — | Permission matrix exhaustiveness | unit | `cd cli && bun run vitest run src/agent/permissionMatrix.test.ts` | ❌ W0 | ⬜ pending |
| 11-02-?? | 02 | ? | REFT-03 (route) | T-V2/V5/V7 | Negative auth route returns 4xx + no secret leak | unit (hono `app.request()`) | `cd hub && bun test src/web/routes/auth.test.ts` | ❌ W0 | ⬜ pending |
| 11-03-?? | 03 | ? | REFT-03 (middleware) | T-V2/V6/V7 | Negative middleware returns 401 + no secret leak | unit (hono middleware mount) | `cd hub && bun test src/web/middleware/auth.test.ts` | ❌ W0 | ⬜ pending |
| 11-04-?? | 04 | ? | REFT-02 | — | SSE reconnect + dropped-event → cache converges | unit (jsdom + fake timers) | `cd web && bun run vitest run src/hooks/useSSE.test.tsx` | ✅ extend | ⬜ pending |
| 11-05-?? | 05 | ? | Guard sweep | — | ripgrep guard exits 0 | shell | `bash scripts/check-no-cut-agents.sh` | ✅ extend | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `cli/src/agent/permissionMatrix.test.ts` — REFT-01 matrix test file (new).
- [ ] `hub/src/web/test-utils/assertNoSecretLeak.ts` — shared no-leak helper (new; non-test helper).
- [ ] `hub/src/web/routes/auth.test.ts` — REFT-03 route layer (new).
- [ ] `hub/src/web/middleware/auth.test.ts` — REFT-03 middleware layer (new).
- [ ] `web/src/hooks/useSSE.ts` — minimal `export` of 5 backoff constants (D-190 carve-out; no value change).
- [ ] `web/src/hooks/useSSE.test.tsx` — extend `MockEventSource` with `emitOpen()`/`emitError()` + new REFT-02 describe block.
- [ ] `scripts/check-no-cut-agents.sh` — append Phase 11 guard block (pattern in RESEARCH.md § Phase 11 Guard Pattern).

Framework install: **none required** — vitest, bun:test, jose, hono, jsdom, ripgrep all already present.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Coverage non-regression vs. Phase 10 | SC#4 | No CI gate this phase (D-188); baseline must be captured from `main` HEAD (per user decision 2026-05-23) | 1) `git stash` Phase 11 tests if needed. 2) `git checkout main` 3) `cd cli && bun run vitest run --coverage` (repeat for hub, web). 4) Record numbers in `11-DISCUSSION-LOG.md`. 5) Return to phase branch. 6) Re-run with new tests; diff. Record both in DISCUSSION-LOG. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
