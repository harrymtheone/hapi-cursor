---
phase: 9
slug: web-internal-decoupling
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-23
---

# Phase 9 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (web), bun test (cli/hub) |
| **Config file** | `web/vitest.config.ts` (web), `bunfig.toml` / `package.json` (cli/hub) |
| **Quick run command** | `bun run test:web` |
| **Full suite command** | `bun typecheck && bun run test` |
| **Estimated runtime** | ~60–120 seconds full; ~30s web-only |

---

## Sampling Rate

- **After every task commit:** Run `bun run test:web` (or scope-appropriate package test)
- **After every plan wave:** Run `bun typecheck && bun run test`
- **Before `/gsd:verify-work`:** Full suite must be green + guard scripts exit 0
- **Max feedback latency:** ~120 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 9-01-01 | 01 | 1 | REFW-03 | — | N/A | unit | `bun run test:cli && bun run test:hub` | ✅ existing | ⬜ pending |
| 9-01-02 | 01 | 1 | REFW-03 | — | N/A | unit | `bun run test:web` | ✅ existing | ⬜ pending |
| 9-01-03 | 01 | 1 | REFW-03 | — | N/A | static | `rg "function levenshteinDistance\|function estimateBase64Bytes" web/src cli/src hub/src shared/src` (count = 1 in shared, 1 in web/lib, 0 elsewhere) | ✅ W0 | ⬜ pending |
| 9-01-04 | 01 | 1 | REFW-01 | — | N/A | integration | `bun run test:web -- ToolCard.integration` | ❌ W0 | ⬜ pending |
| 9-01-05 | 01 | 1 | REFW-01 | — | N/A | static | `bash scripts/check-no-circular-web.sh` (exit 0) | ❌ W0 | ⬜ pending |
| 9-02-01 | 02 | 2 | REFW-02 | — | N/A | unit | `bun run test:web -- message-window` | ✅ existing | ⬜ pending |
| 9-02-02 | 02 | 2 | REFW-02 | — | N/A | unit | `bun run test:web -- SessionList` | ✅ existing | ⬜ pending |
| 9-02-03 | 02 | 2 | REFW-02 | — | N/A | static | `wc -l web/src/lib/messageWindow*.ts web/src/lib/message-window-store.ts` (each < 400) | ✅ W0 | ⬜ pending |
| 9-02-04 | 02 | 2 | REFW-02 | — | N/A | static | `wc -l web/src/components/SessionList.tsx web/src/components/SessionList/*.tsx` (each < 500/300) | ✅ W0 | ⬜ pending |
| 9-03-01 | 03 | 3 | REFW-02 | — | N/A | unit | `bun run test:web -- settings` | ❌ W0 | ⬜ pending |
| 9-03-02 | 03 | 3 | REFW-02 | — | N/A | unit | `bun run test:web -- HappyComposer` | ❌ W0 | ⬜ pending |
| 9-03-03 | 03 | 3 | REFW-02 | — | N/A | unit | `bun run test:web -- _results` (existing, refactored case split) | ✅ existing | ⬜ pending |
| 9-03-04 | 03 | 3 | REFW-02 | — | N/A | static | `wc -l web/src/routes/settings/index.tsx web/src/components/AssistantChat/HappyComposer.tsx web/src/components/ToolCard/views/_results.tsx` (each < 500) | ✅ W0 | ⬜ pending |
| 9-04-01 | 04 | 4 | REFW-01, REFW-02, REFW-03 | — | N/A | static | `bash scripts/check-no-cut-agents.sh` (exit 0; includes D-158 sweep) | ✅ existing | ⬜ pending |
| 9-04-02 | 04 | 4 | REFW-01 | — | N/A | static | `bash scripts/check-no-circular-web.sh` (exit 0) | ❌ W0 (created Slice 1) | ⬜ pending |
| 9-04-03 | 04 | 4 | all | — | N/A | full | `bun typecheck && bun run test` | ✅ existing | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `scripts/check-no-circular-web.sh` — new guard script, `cd web && npx madge --circular --extensions ts,tsx src/` with `--exclude '(^\.\./|web/dist)'` and semantic exit code (created in Slice 1)
- [ ] `web/src/components/ToolCard/ToolCard.integration.test.tsx` — new table-driven test over `Object.keys(knownTools)` (Slice 1)
- [ ] `web/src/routes/settings/__tests__/` (or colocated) — first-time RTL coverage for settings sections (Slice 3, optional but recommended)
- [ ] `web/src/components/AssistantChat/__tests__/HappyComposer*.test.tsx` — first-time hook-level tests (Slice 3, optional but recommended)
- [ ] `scripts/check-no-cut-agents.sh` — append Phase 9 D-158 sweep block (Slice 4)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Settings UI navigation still works visually | REFW-02 | Visual regression not automated | Open web app → /settings → exercise each section (Language/Display/Chat/About), confirm no layout regression |
| HappyComposer input/send/attachments still work | REFW-02 | Visual + interactive regression | Open AssistantChat → type, attach a file, send — confirm no behavior change |
| ToolCard renders for every known tool | REFW-01 | Covered by integration test, but spot-check 2–3 in UI | Trigger Bash/Read/Edit tool in a session, confirm renders without fallback icon |

*Most phase behavior has automated verification via existing/new tests + guard scripts.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (`check-no-circular-web.sh`, `ToolCard.integration.test.tsx`, settings/HappyComposer test scaffolds, D-158 sweep block)
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
