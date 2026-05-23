---
phase: 8
slug: hub-internal-decoupling
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-22
---

# Phase 8 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source: `08-RESEARCH.md` § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `bun test` (Bun built-in test runner) |
| **Config file** | none — Bun discovers `*.test.ts`; `hub/package.json` declares `"test": "bun test"` |
| **Quick run command** | `cd hub && bun test <affected files>` |
| **Full suite command** | `bun run test` (root, all workspaces) + `bun typecheck` |
| **Estimated runtime** | ~30 seconds full hub suite; sub-second for per-task slice |
| **Mocking** | `bun:test` `mock()` / `mock.module()`; fake timers via `setSystemTime` or vi-compat layer |

---

## Sampling Rate

- **After every task commit:** `cd hub && bun test <directly affected files>` (sub-second).
- **After every plan wave:** `cd hub && bun test` (full hub suite, ~30s).
- **Phase gate (before `/gsd:verify-work`):** `bun typecheck && bun run test && bash scripts/check-no-cut-agents.sh && bash scripts/check-no-circular-hub.sh`.
- **Max feedback latency:** ~30 seconds wave-level; sub-second task-level.

---

## Per-Requirement Verification Map

| Req ID | Behavior | Test Type | Automated Command | File Exists |
|--------|----------|-----------|-------------------|-------------|
| REFH-01 | SessionCache facade public methods unchanged; per-service logic intact | unit | `cd hub && bun test src/sync/sessionRepository.test.ts src/sync/sessionLivenessService.test.ts src/sync/sessionConfigService.test.ts src/sync/sessionMergeService.test.ts src/sync/sessionCache.test.ts` | ❌ W0 (4 new files; redistribute existing cases) |
| REFH-02 | SyncEngine sub-facades; SSE consumes shared `SyncEvent`; no `import .* from .*sync/syncEngine` in `hub/src/sse/` | unit + ripgrep | `rg "from .*sync/syncEngine" hub/src/sse/` returns 0; existing `messageService.test.ts`, `rpcGateway.test.ts`, `aliveEvents.test.ts` cover sub-facades | ❌ W0 guard sweep |
| REFH-03 | `ApiRouteError` shape `{ error: { code, message, details? } }`; `parseJsonBody` → 400/`invalid-body`; `withSession` → 404/`not-found`; `withEngine` → 503/`engine-unavailable` | unit | `cd hub && bun test src/web/middleware/apiRouteError.test.ts src/web/routes/sessions/__tests__/` | ❌ W0 all new files |
| REFH-04 | `KeepaliveScheduler.shutdown()` cancels all handles; cancelled callback never fires; SIGINT handler invokes scheduler + syncEngine shutdown | unit | `cd hub && bun test src/utils/scheduler.test.ts src/index.test.ts` (or `src/shutdown.test.ts`) | ❌ W0 both files |
| SC#1 (file budgets) | `wc -l hub/src/sync/*.ts` < 400 each; `hub/src/web/routes/sessions/*.ts` < 250 each | shell guard | Phase-8 block in `scripts/check-no-cut-agents.sh` (`wc -l` assertions) | ❌ W0 guard additions |
| SC#2 (SSE no reverse import) | `rg "import .* from .*['\"]\.\./sync/syncEngine['\"]" hub/src/sse/` → 0 hits | ripgrep guard | `bash scripts/check-no-cut-agents.sh` | ❌ W0 guard line |
| SC#3 (routes split + helpers + ApiRouteError) | `hub/src/web/routes/sessions/` exists with 5 files; `rg "throw new HTTPException" hub/src/web/routes/` only inside whitelisted helpers | structural + ripgrep | guard script | ❌ W0 guard line |
| SC#4 (timer routing + SIGINT) | `rg "setInterval\(\|setTimeout\(" hub/src/{sse,sync,socket,notifications}/` outside whitelisted promise-sleep + `scheduler.ts` → 0 | ripgrep guard | guard script | ❌ W0 guard line |
| SC#5 (madge + bun green) | madge 0 cycles in `hub/src/`; `bun typecheck` 0 errors; `bun run test` green | madge + bun | `bash scripts/check-no-circular-hub.sh && bun typecheck && bun run test` | scheduler.test.ts must exist before phase gate |

---

## Wave 0 Requirements

- [ ] `hub/src/utils/scheduler.test.ts` — REFH-04 (shutdown, cancel, name uniqueness, callback never fires after cancel).
- [ ] `hub/src/index.test.ts` **or** `hub/src/shutdown.test.ts` — SIGINT handler unit test (REFH-04 SC#4).
- [ ] `hub/src/sync/sessionRepository.test.ts` — Slice 1 (cases redistributed from `sessionModel.test.ts`).
- [ ] `hub/src/sync/sessionLivenessService.test.ts` — Slice 1 (from `aliveEvents.test.ts` + `sessionModel.test.ts`).
- [ ] `hub/src/sync/sessionConfigService.test.ts` — Slice 1.
- [ ] `hub/src/sync/sessionMergeService.test.ts` — Slice 1 (merge / dedup cases).
- [ ] `hub/src/web/middleware/apiRouteError.test.ts` — Slice 3 (JSON shape contract).
- [ ] `hub/src/web/routes/sessions/__tests__/{lifecycle,config,upload,read}.test.ts` — Slice 3 (redistributed from `sessions.test.ts`).
- [ ] `scripts/check-no-circular-hub.sh` — Slice 4 inception.
- [ ] Phase-8 block appended to `scripts/check-no-cut-agents.sh` — Slice 4.

Framework install: none — Bun test is already configured.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| SIGINT keeps stdout/stderr drained on real `kill -INT` (process-level integration) | REFH-04 SC#4 | Process-level SIGINT mocking is unreliable across vitest/Bun process boundary; D-141 explicitly chooses unit-level handler invocation over real signals. | `cd hub && bun run dev` then in another shell `kill -INT <pid>`; observe scheduler debug log lists all cancelled handles, then process exits 0. |

*All other phase behaviors have automated verification.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
