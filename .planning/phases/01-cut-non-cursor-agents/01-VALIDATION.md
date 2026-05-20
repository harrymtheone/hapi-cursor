---
phase: 1
slug: cut-non-cursor-agents
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-20
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Phase 1 is a pure-deletion phase. No new tests are written (D-07).
> Validation = ensure existing Cursor tests stay green + ripgrep guard catches regressions.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ^4.0.16 (per-workspace: cli, hub, web) |
| **Config file** | `cli/vitest.config.ts`, `hub/vitest.config.ts`, `web/vitest.config.ts` (existing) |
| **Quick run command** | `bun run test` (root — chains cli → hub → web sequentially) |
| **Full suite command** | `bun typecheck && bun run test` |
| **Phase guard command** | `bun run test:guard` (new — runs `scripts/check-no-cut-agents.sh`) |
| **Estimated runtime** | ~60–120 seconds full suite |

---

## Sampling Rate

- **After every task commit (within a CUT):** `cd <workspace> && bun run typecheck && bun run test` (fast iteration; per-workspace)
- **After every CUT commit (D-15 mandate):** root `bun typecheck && bun run test && bun run test:guard` — every commit MUST be green
- **Before `/gsd-verify-work`:** All 5 commits green + `bun install --frozen-lockfile` succeeds
- **Max feedback latency:** ~120 seconds (full suite + guard)

---

## Per-Task Verification Map

> Filled in by planner. Phase-1 task IDs follow `1-XX-YY` (plan-id, task-id).
> All verifications use existing test infrastructure — no new test files written.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 1-0X-YY | TBD | TBD | CUT-01..04 | — (no threats) | N/A — pure deletion | smoke + grep | `bun typecheck && bun run test && bun run test:guard` | ✅ existing | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `scripts/check-no-cut-agents.sh` — ripgrep guard script (pattern `\b(claude|codex|gemini|opencode)\b`, with whitelist from CONTEXT.md D-12 + RESEARCH.md §"ripgrep guard")
- [ ] Root `package.json` — add `"test:guard"` npm script and chain into `"test"`
- [ ] Verify A1: `rg "AgentRegistry" cli/src/` — confirm no callers outside `runAgentSession.ts` after CUT-03
- [ ] Verify A2: `rg "permissionAdapter|PermissionAdapter" cli/src/cursor/ cli/src/agent/loopBase.ts cli/src/agent/sessionBase.ts` — decide keep-vs-delete
- [ ] Verify A4: confirm Zod schemas in `shared/src/resume.ts` are NOT `.strict()` (else old SQLite rows error)
- [ ] Verify Q3: inspect `cli/scripts/build-executable.ts` + asset bundling — confirm no per-flavor binary references
- [ ] No new `*.test.ts` files this phase (D-07 hard rule)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `hapi` no-arg invocation routes to Cursor agent (D-10) | CUT-01..04 | CLI default-routing behavior; not asserted by existing tests | Run `hapi` in a clean tmp dir; expect Cursor cold-start prompt; no flavor-selector menu |
| `bun install --frozen-lockfile` clean (D-14 commit #5) | CUT-01..04 SC#5 | Lockfile regeneration is filesystem-side-effect | After CUT-01..04 commits, run `rm bun.lock && bun install && bun install --frozen-lockfile` — expect second run zero-diff |
| `.github/workflows/codex-*.yml` not parsed by GitHub Actions | CUT-02 SC#4 | GitHub Actions parse is server-side | After CUT-02 commit lands on main, confirm Actions tab shows no `codex-pr-review` / `codex-mention-response` workflows |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify (= `bun typecheck && bun run test && bun run test:guard`) — covered by D-15 per-commit gate
- [ ] Sampling continuity: every commit is a verification checkpoint (5 commits = 5 sample points)
- [ ] Wave 0 covers all MISSING references (guard script + A1/A2/A4 verifications)
- [ ] No watch-mode flags in CI command
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter after planner finalizes per-task map

**Approval:** pending — planner to fill per-task map and flip flag.
