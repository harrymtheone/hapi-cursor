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

- **After every plan commit:** Run `bun typecheck && bun run test`
- **After every plan wave:** Run `bun typecheck && bun run test`; after Plan 03-07, also run the Phase 03 ripgrep guard for `namespace|:ns`
- **Before `/gsd:verify-work`:** Full suite and zero-keyword guard must be green
- **Max feedback latency:** one plan commit; plans are dependency-ordered green slices so old namespace-bearing internals may coexist temporarily only until their later deletion plan

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 1 | CUT-09 | T-03-01 | Access token parser/config accepts colon-bearing opaque secrets and deletes parser namespace symbols | unit/source | `bun test hub/src/utils/accessToken.test.ts hub/src/config/cliApiToken.test.ts` plus focused auth token `rg`, then `bun typecheck && bun run test` | yes | pending |
| 03-01-02 | 01 | 1 | CUT-09 | T-03-02 | `/api/cli/*` bearer auth compares the whole opaque token and does not set namespace route state | source | focused CLI route `rg`, then `bun typecheck && bun run test` | yes | pending |
| 03-02-01 | 02 | 2 | CUT-09 | T-03-04 | Session/machine store facades expose namespace-free id/version APIs while old internals temporarily coexist | unit/source | `bun test hub/src/store/*.test.ts` plus store facade `rg`, then `bun typecheck && bun run test` | yes | pending |
| 03-02-02 | 02 | 2 | CUT-09 | T-03-04 | Push store exposes namespace-free subscription facades for later push service migration | unit/source | `bun test hub/src/store/*.test.ts` plus push store facade `rg`, then `bun typecheck && bun run test` | yes | pending |
| 03-02-03 | 02 | 2 | CUT-09 | T-03-05 | SessionCache, MachineCache, and SyncEngine expose owner-only access/list/create/update APIs | unit/source | `bun test hub/src/sync/sessionModel.test.ts hub/src/sync/aliveEvents.test.ts` plus sync facade `rg`, then `bun typecheck && bun run test` | yes | pending |
| 03-03-01 | 03 | 3 | CUT-09 | T-03-06..T-03-07 | Web auth signs/verifies `{ uid }`; WebAppEnv narrowing and every Hono route/guard `c.get('namespace')` cleanup happen in the same green slice | unit/integration/source | `bun test hub/src/web/routes/sessions.test.ts` plus focused web auth/route `rg`, then `bun typecheck && bun run test` | yes | pending |
| 03-03-02 | 03 | 3 | CUT-09 | T-03-08 | Events route, SSEManager subscription shape, EventPublisher constructor, and SyncEngine constructor/callsite cleanup happen together while preserving relevance filters | unit/source | `bun test hub/src/sse/sseManager.test.ts` plus focused realtime `rg`, then `bun typecheck && bun run test` | yes | pending |
| 03-04-01 | 04 | 4 | CUT-09 | T-03-08 | `/cli` Socket.IO auth compares the whole opaque token; SocketData deletion, server writes, terminal access, and CLI handler reads are cleaned up atomically | unit/source | `bun test hub/src/socket/handlers/terminal.test.ts` plus focused socket/server/socketTypes/handler `rg`, then `bun typecheck && bun run test` | yes | pending |
| 03-04-02 | 04 | 4 | CUT-09 | T-03-09 | Visibility and push delivery collapse to single-owner global behavior without namespace | unit/source | `bun test hub/src/push/pushNotificationChannel.test.ts hub/src/notifications/notificationHub.test.ts` plus focused push `rg`, then `bun typecheck && bun run test` | yes | pending |
| 03-05-01 | 05 | 5 | CUT-09 | T-03-10 | Shared Session/SyncEvent/socket contracts and hub sync DTOs contain no namespace fields/reasons | unit/source | `bun test hub/src/sync/sessionModel.test.ts hub/src/sync/aliveEvents.test.ts` plus shared/sync `rg`, then `bun typecheck && bun run test` | yes | pending |
| 03-05-02 | 05 | 5 | CUT-09 | T-03-11 | CLI and web mirrors no longer expect `Session.namespace` or token `:ns` assumptions | unit/source | `bun test cli/src/api/api.extraHeaders.test.ts cli/src/agent/sessionFactory.test.ts` plus CLI/web mirror `rg`, then `bun typecheck && bun run test` | yes | pending |
| 03-06-01 | 06 | 6 | CUT-09 | T-03-12 | Runtime schema v10 deletes namespace columns/indexes and the users store/table | unit/source | `bun test hub/src/store/*.test.ts` plus runtime schema `rg`, then `bun typecheck && bun run test` | yes | pending |
| 03-06-02 | 06 | 6 | CUT-09 | T-03-12 | Store SQL helpers and wrappers delete old namespace methods and params | unit/source | `bun test hub/src/store/*.test.ts` plus store source `rg`, then `bun typecheck && bun run test` | yes | pending |
| 03-06-03 | 06 | 6 | CUT-09 | T-03-13..T-03-14 | Offline migration entry migrates v9 namespace-shaped data to schema version 10 and is not invoked at runtime | unit/source | `bun test hub/scripts/migrate-namespace-isolation.test.ts hub/src/store/*.test.ts` plus migration non-invocation `rg`, then `bun typecheck && bun run test` | planned | pending |
| 03-07-01 | 07 | 7 | CUT-09 | T-03-15..T-03-16 | Source guard rejects `namespace|:ns` in `cli/src`, `hub/src`, `web/src`, `shared/src`; full phase gate is green | guard/source | `bash scripts/check-no-cut-agents.sh && ! rg -n "namespace|:ns" cli/src hub/src web/src shared/src && bun typecheck && bun run test` | yes | pending |

---

## Wave 0 Requirements

- [ ] Plan 03-01 rewrites opaque token/config and `/api/cli/*` bearer token comparison only; WebAppEnv and SocketData cuts are deferred to their atomic consumer plans.
- [ ] Plan 03-02 adds namespace-free store/cache/SyncEngine facades before route/socket consumers migrate.
- [ ] Plan 03-03 migrates web auth, all Hono route/guard callsites, events route, SSEManager, EventPublisher, and SyncEngine event construction together.
- [ ] Plan 03-04 migrates SocketData, Socket.IO server writes, terminal access, CLI Socket.IO handlers, visibility, and push delivery together.
- [ ] Plan 03-05 deletes namespace from shared contracts and CLI/web mirrors after callsites are ready.
- [ ] Plan 03-06 deletes physical runtime namespace state and adds the offline v9-to-v10 migration fixture.
- [ ] Plan 03-07 updates `scripts/check-no-cut-agents.sh` with Phase 03 `namespace|:ns` rules and explicit source-scope scan.
- [x] Decide offline migration entry path/name before store schema implementation starts: `hub/scripts/migrate-namespace-isolation.ts`.

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
- [ ] Feedback latency is one plan commit
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
