---
phase: 1
slug: cut-non-cursor-agents
status: draft
nyquist_compliant: true
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
| 1-01-0 | 01-01 | 1 | CUT-01 | T-01-01-N1 | n/a — Wave 0 verification + HEAD inventory (W0.0) | smoke + grep + file-create + inventory-superset | `bash scripts/check-no-cut-agents.sh; test -x scripts/check-no-cut-agents.sh; rg -q '"test:guard"' package.json; bun typecheck; test -f .planning/phases/01-cut-non-cursor-agents/01-WAVE0-FINDINGS.md; rg -q '## HEAD inventory' .planning/phases/01-cut-non-cursor-agents/01-WAVE0-FINDINGS.md` | ✅ existing | ⬜ pending |
| 1-01-1 | 01-01 | 1 | CUT-01 | T-01-01-N1 | n/a — deletion | file-absence | `! test -d cli/src/claude; ! test -f cli/src/commands/claude.ts; ! test -f cli/src/commands/hookForwarder.ts; ! test -f cli/src/agent/runners/runAgentSession.ts` | ✅ existing | ⬜ pending |
| 1-01-2 | 01-01 | 1 | CUT-01 | T-01-01-N1 | n/a — consumer rewrites | typecheck + grep + guard-shrink | `bun typecheck && bash scripts/check-no-cut-agents.sh` | ✅ existing | ⬜ pending |
| 1-01-2.5 | 01-01 | 1 | CUT-01 | T-01-01-N1 | W0.0-inventory CUT-01 rows processed | typecheck + guard + inventory-ledger | `bun typecheck && bash scripts/check-no-cut-agents.sh` | ✅ existing | ⬜ pending |
| 1-01-3 | 01-01 | 1 | CUT-01 | T-01-01-N1 | n/a — commit gate (D-15) | full suite + guard + commit | `bun typecheck && bun run test && bash scripts/check-no-cut-agents.sh && git log -1 --format='%s' \| grep -q 'CUT-01'` | ✅ existing | ⬜ pending |
| 1-02-1 | 01-02 | 2 | CUT-02 | T-01-02-N1 | n/a — deletion | file-absence | `! test -d cli/src/codex; ! test -f cli/src/commands/codex.ts; ! test -f .github/workflows/codex-pr-review.yml; ! test -f .github/workflows/codex-mention-response.yml; ! test -f cli/src/codex/happyMcpStdioBridge.ts; ! test -f scripts/dev/self-test-codex-web-env.sh; ! test -f scripts/dev/seed-codex-web-fixture.ts` | ✅ existing | ⬜ pending |
| 1-02-2 | 01-02 | 2 | CUT-02 | T-01-02-N1 | wire-constant import preserved | typecheck + grep + guard-shrink | `bun typecheck && bash scripts/check-no-cut-agents.sh` | ✅ existing | ⬜ pending |
| 1-02-2.5 | 01-02 | 2 | CUT-02 | T-01-02-N1 | W0.0-inventory CUT-02 rows processed | typecheck + guard + inventory-ledger | `bun typecheck && bash scripts/check-no-cut-agents.sh` | ✅ existing | ⬜ pending |
| 1-02-3 | 01-02 | 2 | CUT-02 | T-01-02-N1 | n/a — commit gate (D-15) | full suite + guard + commit | `bun typecheck && bun run test && bash scripts/check-no-cut-agents.sh && git log -1 --format='%s' \| grep -q 'CUT-02'` | ✅ existing | ⬜ pending |
| 1-03-1 | 01-03 | 3 | CUT-03 | T-01-03-N1 | n/a — deletion | file-absence | `! test -d cli/src/gemini; ! test -d cli/src/agent/backends; ! test -f cli/src/commands/gemini.ts` | ✅ existing | ⬜ pending |
| 1-03-2 | 01-03 | 3 | CUT-03 | T-01-03-N1 | dead-abstraction cleanup; A2 decision recorded | file-absence + grep | `! test -f cli/src/agent/AgentRegistry.ts && ! test -f cli/src/agent/types.ts && ! test -f cli/src/agent/rateLimitParser.ts && ! test -f cli/src/agent/internalEventFilter.ts` | ✅ existing | ⬜ pending |
| 1-03-3 | 01-03 | 3 | CUT-03 | T-01-03-N1 | n/a — consumer rewrites | typecheck + grep + guard-shrink | `bun typecheck && bash scripts/check-no-cut-agents.sh` | ✅ existing | ⬜ pending |
| 1-03-3.5 | 01-03 | 3 | CUT-03 | T-01-03-N1 | W0.0-inventory CUT-03 rows processed | typecheck + guard + inventory-ledger | `bun typecheck && bash scripts/check-no-cut-agents.sh` | ✅ existing | ⬜ pending |
| 1-03-4 | 01-03 | 3 | CUT-03 | T-01-03-N1 | n/a — commit gate (D-15) | full suite + guard + commit | `bun typecheck && bun run test && bash scripts/check-no-cut-agents.sh && git log -1 --format='%s' \| grep -q 'CUT-03'` | ✅ existing | ⬜ pending |
| 1-04-1 | 01-04 | 4 | CUT-04 | T-01-04-N1 | n/a — deletion | file-absence | `! test -d cli/src/opencode; ! test -f cli/src/commands/opencode.ts` | ✅ existing | ⬜ pending |
| 1-04-2 | 01-04 | 4 | CUT-04 | T-01-04-N1 | bare-literal `'codex'` final sweep | typecheck + grep + guard-shrink | `bun typecheck && bash scripts/check-no-cut-agents.sh` | ✅ existing | ⬜ pending |
| 1-04-2.5 | 01-04 | 4 | CUT-04 | T-01-04-N1 | W0.0-inventory CUT-04 rows processed | typecheck + guard + inventory-ledger | `bun typecheck && bash scripts/check-no-cut-agents.sh` | ✅ existing | ⬜ pending |
| 1-04-3 | 01-04 | 4 | CUT-04 | T-01-04-N1 | n/a — commit gate (D-15) | full suite + guard + commit | `bun typecheck && bun run test && bash scripts/check-no-cut-agents.sh && git log -1 --format='%s' \| grep -q 'CUT-04'` | ✅ existing | ⬜ pending |
| 1-05-1 | 01-05 | 5 | CUT-01..04 | T-01-05-N1 | SC#3 — default-cmd routing | grep + typecheck | `! rg 'claudeCommand\|codexCommand\|geminiCommand\|opencodeCommand' cli/src/commands/registry.ts; rg -q 'cursorCommand' cli/src/commands/registry.ts; bun typecheck` | ✅ existing | ⬜ pending |
| 1-05-2 | 01-05 | 5 | CUT-01..04 | T-01-05-N1 | rename slashCommands; A7 workflow audit; W0.0-deferred multi-flavor consumer rewrites (step 6.5) | file-absence + grep + typecheck + inventory-ledger | `! test -f web/src/lib/codexSlashCommands.ts; test -f web/src/lib/agentSlashCommands.ts; ! rg -n 'hapi gemini\|hapi claude\|hapi codex\|hapi opencode' cli/README.md; bun typecheck` | ✅ existing | ⬜ pending |
| 1-05-3 | 01-05 | 5 | CUT-01..04 | T-01-05-N1 | SC#2 — final tightened guard | guard | `bash scripts/check-no-cut-agents.sh` | ✅ existing | ⬜ pending |
| 1-05-4 | 01-05 | 5 | CUT-01..04 | T-01-05-N1 | SC#5 — lockfile frozen check | lockfile | `bun install --frozen-lockfile && ! rg '@anthropic-ai\|@openai\|@google/(gen\|gemini)\|opencode-ai\|@zed-industries' package.json '*/package.json'` | ✅ existing | ⬜ pending |
| 1-05-5 | 01-05 | 5 | CUT-01..04 | T-01-05-N1 | Phase 1 SC#1..#5 all green; D-15 commit gate | full phase gate + commit | `bun typecheck && bun run test && bash scripts/check-no-cut-agents.sh && bun install --frozen-lockfile && ! rg 'claudeCommand\|codexCommand\|geminiCommand\|opencodeCommand' cli/src/commands/registry.ts && rg -q 'cursorCommand' cli/src/commands/registry.ts && git log -1 --format='%s' \| grep -q 'final cleanup'` | ✅ existing | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `01-WAVE0-FINDINGS.md` — W0.0 HEAD inventory (every file matching the flavor regex at HEAD outside the four runtime dirs gets a row with `proposed owner-commit` from `{CUT-01..04, 01-05-cleanup, whitelist-permanent}`)
- [ ] `scripts/check-no-cut-agents.sh` — ripgrep guard script (pattern `\b(claude|codex|gemini|opencode)\b`, whitelist is a TRUE SUPERSET of HEAD built from W0.0 inventory + CONTEXT.md D-12 + RESEARCH.md §"ripgrep guard"; `bash scripts/check-no-cut-agents.sh` exits 0 against the pre-deletion working tree)
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

**Approval:** per-task map filled across all 5 plans (23 task rows after r3 revision — added 1-01-2.5, 1-02-2.5, 1-03-3.5, 1-04-2.5 W0.0-inventory consumer-rewrite tasks); `nyquist_compliant: true` retained — every new row uses the same `bun typecheck && bash scripts/check-no-cut-agents.sh` automated verify (existing infrastructure, no new test files). `wave_0_complete` flips to `true` after executor completes 01-01 Task 0 (including W0.0 HEAD inventory) and writes `01-WAVE0-FINDINGS.md`.
