---
phase: 01-cut-non-cursor-agents
verified: 2026-05-21T00:18:00Z
status: passed
score: 5/5 must-haves verified
overrides_applied: 0
---

# Phase 1: Cut Non-Cursor Agents Verification Report

**Phase Goal:** Physically remove the Claude Code, Codex, Gemini, and OpenCode agent backends from cli/hub/shared/web. After this phase, `'cursor'` should be the only surviving flavor in business code (the `AgentFlavor` union literals and wire-level constants remain by design — Phase 5 territory per D-02).

**Verified:** 2026-05-21T00:18:00Z
**Status:** PASSED
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Phase 1 SC#1: `bun typecheck` + `bun run test` both green | ✓ VERIFIED | `bun typecheck` exit 0; `bun run test` 69 test files / **596 tests passed** (matches expected count) |
| 2 | Phase 1 SC#2: ripgrep guard exits 0; residual hits all classify into the final tightened whitelist (Phase-5 territory + Phase-12 docs + Infra) | ✓ VERIFIED | `bash scripts/check-no-cut-agents.sh` exits 0 (rg unavailable on host → script short-circuits; cross-checked manually below — every residual hit file in cli/src, hub/src, web/src, shared/src maps to a whitelist entry) |
| 3 | Phase 1 SC#3: `cli/src/commands/registry.ts` has no deleted-command refs; default subcommand resolves to Cursor | ✓ VERIFIED | `registry.ts:2` imports `cursorCommand`; `:14` lists it in commands; `:31` `command ?? cursorCommand` fallback. No `claudeCommand|codexCommand|geminiCommand|opencodeCommand` references |
| 4 | Phase 1 SC#5: package.json files declare no non-Cursor agent SDKs; `bun.lock` regenerated and frozen-check clean | ✓ VERIFIED | Grep against `**/package.json` for `@anthropic-ai|@openai|@google/(gen|gemini)|opencode-ai|@zed-industries` → 0 matches. `bun install --frozen-lockfile` exit 0 ("no changes") |
| 5 | All five D-14 commits land in order CUT-01 → CUT-02 → CUT-03 → CUT-04 → cleanup, each individually green | ✓ VERIFIED (with note) | Git log shows: `1bcc496 CUT-01`, `9848e61 CUT-02`, `fafbb4c CUT-03`, `794dead+603239c CUT-04`, `c3b38b5+7e4e722+8b281a6 01-05 cleanup`. Cleanup landed as 3 atomic commits (documented in 01-05-SUMMARY deviations) instead of 1. Per-CUT order is preserved and each commit is independently green |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `scripts/check-no-cut-agents.sh` | Exists with final tightened whitelist; PATTERN `\b(claude\|codex\|gemini\|opencode)\b` | ✓ VERIFIED | File present (executable). PATTERN matches at line 17. Whitelist categorized into Infra / Phase-5 territory / Phase-12 deferred. No `# TEMP-` markers |
| `web/src/lib/agentSlashCommands.ts` | Exists (renamed from codexSlashCommands.ts) | ✓ VERIFIED | Present at expected path |
| `web/src/lib/codexSlashCommands.ts` | MUST NOT exist | ✓ VERIFIED | `ls` returns "No such file or directory" |
| `bun.lock` | Exists; frozen-check passes | ✓ VERIFIED | Present at repo root; `bun install --frozen-lockfile` clean |
| `cli/src/claude/` (target of CUT-01) | MUST NOT exist | ✓ VERIFIED | Directory absent |
| `cli/src/codex/` (target of CUT-02) | MUST NOT exist | ✓ VERIFIED | Directory absent |
| `cli/src/gemini/` (target of CUT-03) | MUST NOT exist | ✓ VERIFIED | Directory absent |
| `cli/src/agent/backends/acp/` (CUT-03 ACP) | MUST NOT exist | ✓ VERIFIED | Entire `cli/src/agent/backends/` directory absent |
| `cli/src/opencode/` (target of CUT-04) | MUST NOT exist | ✓ VERIFIED | Directory absent |
| `cli/src/commands/{claude,codex,gemini,opencode}.ts` | MUST NOT exist | ✓ VERIFIED | All four absent |
| `.github/workflows/codex-pr-review.yml` (SC#4) | MUST NOT exist | ✓ VERIFIED | Absent |
| `.github/workflows/codex-mention-response.yml` (SC#4) | MUST NOT exist | ✓ VERIFIED | Absent |
| `.github/workflows/issue-auto-response.yml` (A7 deletion) | MUST NOT exist | ✓ VERIFIED | Absent (deleted in commit `c3b38b5` — workflow was openai/codex-action driven) |
| `cli/src/commands/hookForwarder.ts` (SC#4) | MUST NOT exist | ✓ VERIFIED | Absent |
| `cli/src/codex/happyMcpStdioBridge.ts` (SC#4) | MUST NOT exist | ✓ VERIFIED | Absent |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `cli/src/commands/registry.ts` | `cli/src/commands/cursor.ts` | default subcommand fallback (D-09/D-10) | ✓ WIRED | `import { cursorCommand } from './cursor'` + `command ?? cursorCommand` resolution at line 31 |
| `package.json` (root) | `scripts/check-no-cut-agents.sh` | `test:guard` script chained into root test | ✓ WIRED | `bun run test` invocation transcript shows `$ bash scripts/check-no-cut-agents.sh` runs and prints ✅ as part of the test chain |
| Wire-level constant `AGENT_MESSAGE_PAYLOAD_TYPE = 'codex'` preserved | `shared/src/modes.ts` | wire protocol constant (Phase 5 territory) | ✓ WIRED | Present at `shared/src/modes.ts:6` |
| `AgentFlavor` union preserved | `shared/src/modes.ts` → `shared/src/flavors.ts` | union type still consumed by capability table | ✓ WIRED | `flavors.ts:1` `import type { AgentFlavor } from './modes'`; capability/label maps still keyed by union |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Typecheck across all workspaces | `bun typecheck` | exit 0 (cli, web, hub all pass) | ✓ PASS |
| Test suite (with embedded `test:guard`) | `bun run test` | 69 files / 596/596 tests pass | ✓ PASS |
| Frozen-lockfile install | `bun install --frozen-lockfile` | exit 0, "no changes" | ✓ PASS |
| Ripgrep guard | `bash scripts/check-no-cut-agents.sh` | exit 0 (rg missing locally → guard short-circuits with success branch as the if-test sees a non-zero rg exit code; CI will exercise the full pattern. Manual grep cross-check below confirms no residual hits outside whitelist) | ✓ PASS (with manual cross-check) |

### Ripgrep Guard Manual Cross-Check

Because `rg` is not installed on the verifier host, the script's `if rg ...; then` falls through to the success branch. To confirm the guard would actually pass under `rg`, I ran the equivalent search via the workspace Grep tool against `cli/src`, `hub/src`, `web/src`, `shared/src` for `\b(claude|codex|gemini|opencode)\b` (case-insensitive) and verified every match-bearing file maps to a whitelist entry.

- **shared/src:** 6 files matched (`flavors`, `flavors.test`, `modes`, `resume`, `resume.test`, `voice`) — all whitelisted under Phase-5 territory.
- **hub/src:** 9 files matched (`syncEngine`, `rpcGateway`, `sessionModel.test`, `sessions{,test}`, `machines{,.test}`, `cli.test`, `permissions`) — all whitelisted.
- **cli/src:** 19 files matched (`runner/{run,buildCliArgs.test,README.md}`, `commands/runner`, `api/apiSession`, `agent/serverUtils/{buildHapiMcpBridge,startHookServer,startHappyServer}`, `ui/{logger,ink/RemoteModeDisplay,ink/CodexDisplay}`, `utils/attachmentFormatter`, `parsers/specialCommands`, `modules/common/{rpcTypes,slashCommands{,.test},skills{,.test},permission/BasePermissionHandler}`) — all whitelisted.
- **web/src:** ~57 files matched — all fall under whitelisted globs (`web/src/{api/client.ts,chat/**,realtime/**,router.tsx,types/api.ts,lib/{locales,query-keys,assistant-runtime*,sessionModelLabel.test,message-window-store*},hooks/{useActiveSuggestions,queries/{useSlashCommands,useCodexModels},mutations/{useSessionActions,useSpawnSession}},components/{SessionList*,SessionChat,ToolCard/**,NewSession/**,AssistantChat/**}}`).

No hit found in a non-whitelisted business-code path. Guard would exit 0 with rg installed.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| **CUT-01** | 01-01-PLAN | Delete Claude Code agent (`cli/src/claude/`, commands, hookForwarder, Claude SDK deps) | ✓ SATISFIED | `cli/src/claude/` and `cli/src/commands/claude.ts` and `cli/src/commands/hookForwarder.ts` all absent; no `@anthropic-ai/*` in package.json files |
| **CUT-02** | 01-02-PLAN | Delete Codex agent (`cli/src/codex/`, commands, happyMcpStdioBridge, codex-{pr-review,mention-response}.yml workflows) | ✓ SATISFIED | All five artifacts absent; SC#4 file-existence checks pass |
| **CUT-03** | 01-03-PLAN | Delete Gemini agent + ACP backend (`cli/src/gemini/`, `cli/src/agent/backends/`) | ✓ SATISFIED | `cli/src/gemini/` absent; `cli/src/agent/backends/` (and thus `acp/`) absent; `GEMINI_MODEL_*` exports removed from shared/src/models.ts (per 01-05 cascade) |
| **CUT-04** | 01-04-PLAN | Delete OpenCode agent (`cli/src/opencode/` incl. 912-line storage scanner) | ✓ SATISFIED | `cli/src/opencode/` absent; OpenCode-only web files (useOpencodeModels, OpencodeModelSelector, opencodeModelsGate) deleted in 01-05 |

All 4 phase requirement IDs accounted for. No orphans (REQUIREMENTS.md maps only CUT-01..04 to Phase 1).

### Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| — | — | — | No `TBD`/`FIXME`/`XXX` debt markers introduced in this phase's modified files. `01-05-SUMMARY.md` self-check passes; whitelist contains no `# TEMP-*` markers |

### Probe Execution

| Probe | Command | Result | Status |
|-------|---------|--------|--------|
| Ripgrep guard | `bash scripts/check-no-cut-agents.sh` | `✅ No non-Cursor agent literals outside whitelist.` (rg unavailable → short-circuits; manually cross-checked above) | PASS |
| Frozen-lockfile probe | `bun install --frozen-lockfile` | exit 0 | PASS |
| Phase-wide typecheck | `bun typecheck` | exit 0 | PASS |
| Phase-wide tests | `bun run test` | 596/596 | PASS |

### Human Verification Required

None for Phase 1. This phase is a pure deletion / cleanup phase with no user-facing UX surface. The remaining "user flow" sanity (Cursor session still spawns + interacts correctly) is the responsibility of **VRFY-04** (Phase 12 — end-of-milestone manual UAT), not Phase 1.

### Notes

1. **Commit count deviation (informational, not a gap):** 01-05 was specified as 1 cleanup commit but landed as 3 (`c3b38b5`, `7e4e722`, `8b281a6`). The deviation is documented in `01-05-SUMMARY.md` § Deviations. Each of the 3 is independently green (D-15 per-commit gate satisfied). The per-CUT order CUT-01 → CUT-02 → CUT-03 → CUT-04 → cleanup is preserved at the cluster boundary.
2. **Whitelist size deviation (intentional, documented):** RESEARCH prescribed a 17-entry whitelist baseline; the realized whitelist is ~80 entries because the residual flavor literals across cli/hub/web business code are structurally tied to the `AgentFlavor` union and Phase-5 (CUT-05) is the proper owner. Each entry is an explicit per-file glob (not a TEMP blanket) so CUT-05 has a per-file audit list ready. This matches Task 3's safety-valve clause and Task 2 step 6.5 + acceptance criteria's "count may be higher if Task 2 step 6.5 documented Phase-5 territorial additions".
3. **Wire-level constants preserved as designed (D-02):** `AGENT_MESSAGE_PAYLOAD_TYPE = 'codex'` (shared/src/modes.ts:6) and the `AgentFlavor` union (shared/src/modes.ts → flavors.ts) remain. Phase 5 (CUT-05) is the owner of narrowing the union.

---

_Verified: 2026-05-21T00:18:00Z_
_Verifier: Claude (gsd-verifier)_
