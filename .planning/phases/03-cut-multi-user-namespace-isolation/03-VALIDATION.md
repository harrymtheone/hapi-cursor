---
phase: 03
slug: cut-multi-user-namespace-isolation
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-05-21
---

# Phase 03 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Bun test for hub; Vitest for CLI/Web where package tests use it |
| **Config file** | `cli/vitest.config.ts`, `web/vitest.config.ts`; hub uses `bun test` without separate Vitest config |
| **Quick run command** | `bun typecheck && bun run test` |
| **Full suite command** | `bun typecheck && bun run test` |
| **Estimated runtime** | Existing Phase 1/2 cadence; planner should keep each commit green rather than defer failures |

---

## Sampling Rate

- **After every task commit:** Run `bun typecheck && bun run test`
- **After every plan wave:** Run `bun typecheck && bun run test`, then the Phase 03 ripgrep guard for `namespace|:ns`
- **Before `/gsd:verify-work`:** Full suite and zero-keyword guard must be green
- **Max feedback latency:** one task commit; do not batch multiple namespace-surface rewrites behind a red build

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 1 | CUT-09 | T-03-01 | `CLI_API_TOKEN` is compared as one opaque secret, including colon-bearing values | unit | `bun test hub/src/utils/accessToken.test.ts` | yes | pending |
| 03-01-02 | 01 | 1 | CUT-09 | T-03-02 | JWT payload contains `uid` only; web/terminal middleware do not require `ns` | unit/integration | `bun test hub/src/socket/handlers/terminal.test.ts hub/src/web/routes/sessions.test.ts` | yes | pending |
| 03-02-01 | 02 | 1 | CUT-09 | T-03-03 | Store schema and methods do not scope sessions/machines/push by namespace | unit | `bun test hub/src/store/*.test.ts hub/src/sync/sessionModel.test.ts` | yes | pending |
| 03-02-02 | 02 | 1 | CUT-09 | T-03-04 | `users`/`UserStore` multi-platform binding storage is removed or proven unused | source/assertion | `bun typecheck && bun run test` | yes | pending |
| 03-03-01 | 03 | 2 | CUT-09 | T-03-05 | SSE keeps session/machine relevance filters without tenant filtering | unit | `bun test hub/src/sse/sseManager.test.ts` | yes | pending |
| 03-03-02 | 03 | 2 | CUT-09 | T-03-06 | Socket handlers and terminal access no longer emit namespace-specific errors | unit/integration | `bun test hub/src/socket/handlers/terminal.test.ts` | yes | pending |
| 03-04-01 | 04 | 3 | CUT-09 | — | Source guard rejects namespace residue in `cli/src`, `hub/src`, `web/src`, `shared/src` outside whitelist | guard | `bun run test` plus explicit `rg -n "namespace|:ns" cli/src hub/src web/src shared/src` check in plan verification | yes | pending |

---

## Wave 0 Requirements

- [ ] Rewrite `hub/src/utils/accessToken.test.ts` for opaque token semantics, including colon-bearing exact token behavior.
- [ ] Update or add auth/JWT tests so `{ uid }` is the only required claim.
- [ ] Rewrite or delete `hub/src/store/namespace.test.ts` into single-owner store/schema tests.
- [ ] Update `scripts/check-no-cut-agents.sh` or equivalent guard path with Phase 03 `namespace|:ns` rules and explicit whitelist.
- [ ] Decide offline migration entry path/name before store schema implementation starts.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Existing local DB migration safety | CUT-09 | Offline migration entry may require a copied real DB or synthetic v9 fixture; executor should not run destructive migration against the developer's live DB automatically | Run the offline migration against a temporary fixture DB only; verify sessions, machines, messages, and push subscriptions survive under single-owner schema |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all missing references
- [ ] No watch-mode flags
- [ ] Feedback latency is one task commit
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
