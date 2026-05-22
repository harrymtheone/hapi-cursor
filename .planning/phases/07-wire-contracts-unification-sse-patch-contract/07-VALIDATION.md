---
phase: 7
slug: wire-contracts-unification-sse-patch-contract
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-22
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Bun test (`bun:test`) for cli/hub/shared; Vitest + React Testing Library for web |
| **Config file** | `package.json` workspace scripts (`bun typecheck`, `bun run test`); `web/vitest.config.ts` |
| **Quick run command** | `bun typecheck && bun run test --filter <changed-workspace>` |
| **Full suite command** | `bun typecheck && bun run test` |
| **Estimated runtime** | ~60–90 seconds (full); ~10–30 seconds (workspace-scoped) |

---

## Sampling Rate

- **After every task commit:** Run `bun typecheck` in modified workspace(s) + targeted test file
- **After every plan wave:** Run `bun typecheck && bun run test` (full workspaces)
- **Before `/gsd:verify-work`:** Full suite must be green; `bash scripts/check-no-cut-agents.sh` exit 0
- **Max feedback latency:** ~90 seconds

---

## Per-Task Verification Map

> Filled in by planner during PLAN.md generation. Each task in PLAN.md MUST map to a row here referencing a test command + acceptance check.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 7-01-01 | 01 (shared) | 1 | REFA-03 | — | strict schemas reject unknown wire fields | unit | `bun test shared/src/schemas.test.ts` | ❌ W0 | ⬜ pending |
| 7-02-01 | 02 (hub) | 2 | REFA-04 | — | every `publisher.emit` payload validates against `SyncEventSchema` | contract | `bun test hub/src/sse/sseManager.test.ts` | ❌ W0 | ⬜ pending |
| 7-03-01 | 03 (cli+web) | 3 | REFA-03 | — | useSSE consumes typed events without refetch fallback | integration | `bun --cwd web test src/hooks/useSSE.test.tsx` | ❌ W0 | ⬜ pending |
| 7-04-01 | 04 (guard) | 4 | REFA-03,REFA-04 | — | source tree free of legacy wire literals | guard | `bash scripts/check-no-cut-agents.sh` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*Planner extends this table — one row per concrete task in each PLAN.md.*

---

## Wave 0 Requirements

- [ ] `shared/src/schemas.test.ts` (or extend `shared/src/flavors.test.ts`) — `SessionPatchSchema` / `MachinePatchSchema` / `SyncEventSchema` strict assertions; one assertion per patch field
- [ ] `web/src/hooks/useSSE.test.tsx` — new file; mock EventSource; strictly typed event stream cases incl. `backgroundTaskCount` single-field patch and parse-failure drop
- [ ] `hub/src/sse/sseManager.test.ts` (or extend `hub/src/sync/sessionCache.test.ts`) — contract test: every representative `publisher.emit` payload `SyncEventSchema.parse()` succeeds

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| SQLite rows with `content.type === 'codex'` rejected after rename (acceptance, not migration) | REFA-04 | Phase 10 schema-version reject is the documented fallback; Phase 7 explicitly does NOT write a migration (D-123) | After upgrade with old DB present, confirm decode failure surfaces a typed error rather than silent corruption. Document, do not auto-fix. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (shared schema tests + useSSE.test.tsx + hub contract test)
- [ ] No watch-mode flags
- [ ] Feedback latency < 90s
- [ ] `nyquist_compliant: true` set in frontmatter after planner fills per-task map

**Approval:** pending
