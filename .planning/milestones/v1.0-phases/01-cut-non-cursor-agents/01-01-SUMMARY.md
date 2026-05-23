---
phase: 01-cut-non-cursor-agents
plan: 01
subsystem: cli+hub+shared+web
tags: [cut, claude, deletion, guard]
requires: []
provides: [scripts/check-no-cut-agents.sh, package.json#test:guard, 01-WAVE0-FINDINGS.md]
affects: [cli/src/agent/, cli/src/api/, cli/src/commands/, cli/src/cursor/, cli/src/codex/, cli/src/gemini/, cli/src/opencode/, cli/src/lib.ts, hub/src/sync/, shared/src/{schemas,sessionSummary,messages}.ts, hub/package.json, web/src/chat/normalizeAgent.ts]
tech-stack:
  added: []
  patterns: ["broad-then-narrow whitelist for staged consumer rewrites"]
key-files:
  created:
    - scripts/check-no-cut-agents.sh
    - cli/src/agent/registerKillSessionHandler.ts
    - cli/src/agent/agentLogSchema.ts
    - cli/src/agent/serverUtils/startHookServer.ts
    - cli/src/agent/serverUtils/startHappyServer.ts
    - .planning/phases/01-cut-non-cursar-agents/01-WAVE0-FINDINGS.md
  modified:
    - package.json (add test:guard, chain into root test)
    - cli/src/commands/registry.ts (drop claudeCommand/hookForwarderCommand; fallback → cursorCommand)
    - cli/src/commands/resume.ts (drop ClaudePermissionMode import + claude branch in dispatchLocalResume)
    - cli/src/commands/resume.test.ts (rewrite Claude fixtures to Cursor)
    - cli/src/agent/sessionFactory.ts (drop claudeSessionId preservation)
    - cli/src/agent/sessionFactory.test.ts (drop claudeSessionId test fixtures)
    - cli/src/api/apiSession.ts (import RawJSONLines from @/agent/agentLogSchema)
    - cli/src/api/types.ts (drop ClaudePermissionMode re-export; UsageSchema import path)
    - cli/src/lib.ts (RawJSONLines re-export path)
    - cli/src/cursor/runCursor.ts (registerKillSessionHandler import path)
    - cli/src/codex/{runCodex.ts, codexLocalLauncher.ts, codexLocalLauncher.test.ts, utils/buildHapiMcpBridge.ts} (import paths only — flavors deleted in CUT-02)
    - cli/src/gemini/runGemini.ts (import paths only — flavor deleted in CUT-03)
    - cli/src/opencode/runOpencode.ts (import paths only — flavor deleted in CUT-04)
    - hub/package.json (description: drop "Claude Code")
    - hub/src/sync/syncEngine.ts (delete recoverClaudeSessionIdFromMessages, extractClaudeSessionId, normalizeClaudeSessionId, persistRecoveredClaudeSessionId; `'claude'` default → `'cursor'`; hasSameAgentSessionIds drops claudeSessionId line)
    - hub/src/sync/sessionCache.ts (extractAgentSessionId drops claudeSessionId arm)
    - hub/src/sync/sessionModel.test.ts (skip Claude-recovery test cases; rewrite permissionMode test to use cursor)
    - shared/src/schemas.ts (drop claudeSessionId field from MetadataSchema)
    - shared/src/sessionSummary.ts (drop claudeSessionId from chain)
    - shared/src/messages.ts (rename VISIBLE_CLAUDE_SYSTEM_SUBTYPES → VISIBLE_AGENT_SYSTEM_SUBTYPES + isClaudeChatVisible* → isAgentChatVisible*)
    - web/src/chat/normalizeAgent.ts (import isAgentChatVisibleMessage)
  deleted:
    - cli/src/claude/ (entire tree — vendored SDK + utils + tests, ~80 files / ~7500 lines)
    - cli/src/commands/claude.ts
    - cli/src/commands/hookForwarder.ts
    - cli/src/agent/runners/runAgentSession.{ts,test.ts} (dead per RESEARCH §"5-commit precondition order" #1 / Pitfall 1; runners/ dir removed)
    - cli/src/ui/messageFormatterInk.ts (zero callers; was Claude-SDK message formatter)
decisions: [keep-empty-array]
metrics:
  duration_minutes: 25
  files_deleted: ~80
  lines_deleted: ~7700
  files_modified: ~22
  files_created: 6
---

# Phase 1 Plan 01: CUT-01 — Remove Claude Code Agent

CUT-01 lands the first of five Phase-1 atomic commits per D-14: physically delete the Claude Code agent runtime (`cli/src/claude/` including the vendored SDK), strip Claude consumer branches from every business-code dependent, and seed the project-wide `scripts/check-no-cut-agents.sh` ripgrep guard with a broad TRUE-superset whitelist that gets tightened progressively by 01-02..04 + 01-05.

## Wave 0 Findings (recorded in 01-WAVE0-FINDINGS.md)

- **A1 CONFIRMED.** `AgentRegistry` consumers = `runAgentSession.{ts,test.ts}` only. Both deleted in CUT-01.
- **A2 CONFIRMED.** `cli/src/agent/permissionAdapter.{ts,test.ts}` is NOT consumed by Cursor path or by `loopBase`/`sessionBase`. Safe to delete in CUT-03.
- **A4 CONFIRMED.** No `.strict()` / `.passthrough()` on `MetadataSchema`. Removing 4 `*SessionId` fields silently drops unknown keys on read — no migration needed.
- **Q2 RESOLVED.** `loopBase.ts` / `sessionBase.ts` are flavor-neutral. No CUT-01..04 edits needed there.
- **Q3 CONFIRMED.** `cli/scripts/build-executable.ts` + `cli/src/runtime/embeddedAssets.bun.ts` have zero references to the four deleted runtime dirs. Build pipeline safe.

## Files Deleted

| Path | Notes |
|------|-------|
| `cli/src/claude/` (entire tree, ~80 files) | claudeLocal, claudeRemote, runClaude, loop, session, effort, model, sdk/*, utils/*, registerKillSessionHandler.ts, types.ts — all tests |
| `cli/src/commands/claude.ts` | `claudeCommand` definition |
| `cli/src/commands/hookForwarder.ts` | SC#4 explicit — Claude-only hook protocol bridge |
| `cli/src/agent/runners/runAgentSession.{ts,test.ts}` | Moved up from CUT-03 (RESEARCH §Pitfall 1) — imported from `@/claude/`, would break typecheck if left |
| `cli/src/agent/runners/` (empty dir) | rmdir after the two files above |
| `cli/src/ui/messageFormatterInk.ts` | Claude-SDK-typed dead code (zero callers in repo) — Rule 1 cleanup |

## Files Relocated (Rule 3 — fix blocking imports without expanding scope)

The four utilities below were used by Codex/Gemini/OpenCode runtimes (each scheduled for deletion in 01-02..04). Deleting them with `cli/src/claude/` would have broken typecheck immediately. Moved to `cli/src/agent/` so the impending CUT-02..04 deletions cascade naturally; 01-05 cleanup can re-evaluate whether the now-Cursor-only consumers still need these utilities.

| Old path | New path |
|----------|----------|
| `cli/src/claude/registerKillSessionHandler.ts` | `cli/src/agent/registerKillSessionHandler.ts` |
| `cli/src/claude/utils/startHookServer.ts` | `cli/src/agent/serverUtils/startHookServer.ts` |
| `cli/src/claude/utils/startHappyServer.ts` | `cli/src/agent/serverUtils/startHappyServer.ts` |
| `cli/src/claude/types.ts` (RawJSONLines / UsageSchema) | `cli/src/agent/agentLogSchema.ts` |

## Files Rewritten (Claude consumer branches stripped)

Per RESEARCH §"Business-consumer Claude rewrites (D-03)" and Task 2 of 01-01-PLAN.md. Headline targets:

- **`cli/src/commands/registry.ts`** — Drop `claudeCommand` + `hookForwarderCommand` imports + map entries. Fallback `command ?? claudeCommand` → `command ?? cursorCommand`.
- **`cli/src/commands/resume.ts`** — Drop `ClaudePermissionMode` import + `flavor === 'claude'` branch in `dispatchLocalResume`. Cursor remains the default fallthrough.
- **`cli/src/agent/sessionFactory.ts:96`** — Drop the `metadata.claudeSessionId !== undefined` preservation line. Codex/Gemini/OpenCode lines stay (die in 01-02..04).
- **`hub/src/sync/syncEngine.ts`** — Delete the four Claude-named methods (`recoverClaudeSessionIdFromMessages`, `extractClaudeSessionId`, `normalizeClaudeSessionId`, `persistRecoveredClaudeSessionId`). `resolveFlavor` default `'claude'` → `'cursor'`. `resolveAgentResumeId` default branch returns `null`. `hasSameAgentSessionIds` drops the `claudeSessionId` comparison.
- **`hub/src/sync/sessionCache.ts:700-708`** — `extractAgentSessionId` drops the `claudeSessionId` arm and narrows its union type.
- **`hub/package.json`** — Description drops `Claude Code` ("Telegram Bot client for HAPI - control sessions").
- **`shared/src/schemas.ts:36`** — Drop `claudeSessionId: z.string().optional()` field from `MetadataSchema`.
- **`shared/src/sessionSummary.ts:37`** — Drop `?? session.metadata.claudeSessionId` from the `agentSessionId` ?? chain.
- **`shared/src/messages.ts`** — Rename `VISIBLE_CLAUDE_SYSTEM_SUBTYPES` → `VISIBLE_AGENT_SYSTEM_SUBTYPES`; `isClaudeChatVisibleSystemSubtype` / `isClaudeChatVisibleMessage` → `isAgentChatVisible*`. Lone caller (`web/src/chat/normalizeAgent.ts`) updated.
- **`cli/src/api/types.ts:23`** — Drop `ClaudePermissionMode` from the `export type { ... } from '@hapi/protocol/types'` block.

## Test Suite Adjustments (D-06)

- **`cli/src/commands/resume.test.ts`** — Rewrote `flavor: 'claude'` fixtures to `flavor: 'cursor'`; renamed `runClaudeMock` → `runCursorMock`; mock target `@/claude/runClaude` → `@/cursor/runCursor`.
- **`cli/src/agent/sessionFactory.test.ts`** — Removed `claudeSessionId: 'claude-thread-1'` lines from fixture metadata (two occurrences).
- **`cli/src/codex/codexLocalLauncher.test.ts`** — Updated `vi.mock('@/claude/utils/startHookServer', …)` → `'@/agent/serverUtils/startHookServer'` (relocation follow-up).
- **`hub/src/sync/sessionModel.test.ts`** — Skipped five Claude-only tests (`it.skip(…)`): the three `recoverClaude*` recovery tests, the non-UUID guard test, and the local-resume-from-messages test. The respawn-permissionMode test was rewritten to use `flavor: 'cursor'` + `cursorSessionId`.

## Guard Script (`scripts/check-no-cut-agents.sh`)

Created with PATTERN `\b(claude|codex|gemini|opencode)\b` and a **broad TRUE-superset whitelist**:

- Permanent (Phase-1 final): `.planning/**`, `CHANGELOG.md`, `shared/src/{flavors,flavors.test,modes,resume,voice}.ts`, `cli/NOTICE`, `cli/README.md`, `**/.gitignore`, `docs/**`, `website/**`, infra paths.
- `TEMP-CUT-02..04`: runtime-dir blanket globs for `cli/src/{codex,gemini,opencode}/**`, `cli/src/agent/backends/**`, and their `cli/src/commands/{codex,gemini,opencode}.ts` + `.github/workflows/codex-*.yml` + `scripts/dev/*codex*` siblings. These get removed by the respective CUT plan's shrink step.
- `TEMP-WIDE: owner=01-05-cleanup` (or `CUT-02`): broad consumer-dir globs (`cli/src/{commands,agent,api,runner,cursor,modules,parsers,ui,utils}/**`, `cli/src/lib.ts`, `hub/src/{sync,socket/handlers/cli,web/routes,push}/**`, `hub/README.md`, `shared/src/{schemas,sessionSummary,models,models.test,types,socket,resume.test}.ts`, `web/src/{lib,api,chat,components,hooks,realtime}/**`, `web/src/{router.tsx,types/**}`, `README.md`, `CONTRIBUTING.md`, `AGENTS.md`, `refactor.md`, `.cursor/rules/**`, `.github/workflows/issue-auto-response.yml`, `.github/prompts/**`).

**Shrink step (Task 2 step 29) applied for CUT-01:**
- Removed all `TEMP-CUT-01` runtime-dir entries (claude tree gone).
- Removed `TEMP-WIDE: owner=CUT-01` entries: `hub/package.json` (description cleaned) and `shared/src/messages.ts` (Claude exports renamed).

Wired into root `package.json`: `"test:guard": "bash scripts/check-no-cut-agents.sh"` and chained into the root `"test"` script.

## Deviations from Plan

### Auto-fixed (Rule 3 — blocking imports)

**1. [Rule 3] Relocated four utilities from `cli/src/claude/` → `cli/src/agent/` instead of deleting them outright.**
- **Found during:** Task 1 typecheck.
- **Issue:** `cli/src/codex/{runCodex,codexLocalLauncher,utils/buildHapiMcpBridge}.ts`, `cli/src/gemini/runGemini.ts`, `cli/src/opencode/runOpencode.ts`, and `cli/src/cursor/runCursor.ts` all import from `@/claude/registerKillSessionHandler` and/or `@/claude/utils/startHookServer` and/or `@/claude/utils/startHappyServer`. `cli/src/{api/apiSession.ts,api/types.ts,lib.ts}` import from `@/claude/types` (RawJSONLines + UsageSchema — pure wire schemas, not Claude-specific). Deleting the source files outright would have broken typecheck in dirs scheduled for deletion in CUT-02..04 — premature work.
- **Fix:** Moved the four files to flavor-neutral paths under `cli/src/agent/`. Updated all import paths in the seven consumer files. The Claude-named MCP method `client.sendClaudeSessionMessage` (called inside startHappyServer) and Claude-flavored comments inside the relocated files are deferred to 01-05 cleanup — they're under broad TEMP-WIDE coverage and don't trip the guard.
- **Files modified:** see "Files Relocated" + "Files Rewritten" above.

**2. [Rule 1] Deleted `cli/src/ui/messageFormatterInk.ts` (zero callers).**
- **Found during:** Task 1 typecheck (`Cannot find module '@/claude/sdk'`).
- **Issue:** File typed against the Claude SDK; `rg formatClaudeMessageForInk` showed zero call sites anywhere in the repo. Dead code.
- **Fix:** Deleted the file.

### Auth gates encountered
- None.

### Architectural decisions deferred to user (Rule 4)
- None.

## Validation

- `bun typecheck` exits 0 ✓
- `bun run test` exits 0 ✓ (614 tests pass across cli + hub + web + guard)
- `bash scripts/check-no-cut-agents.sh` exits 0 ✓
- `! test -d cli/src/claude` ✓
- `! test -f cli/src/commands/claude.ts` ✓
- `! test -f cli/src/commands/hookForwarder.ts` ✓
- `! test -f cli/src/agent/runners/runAgentSession.ts` ✓

## Known Stubs / Deferred Items

- The `client.sendClaudeSessionMessage(...)` invocation inside the relocated `cli/src/agent/serverUtils/startHappyServer.ts` retains its Claude-named method. The method is defined on `ApiSessionClient` (`cli/src/api/apiSession.ts`); rename to flavor-neutral name is **deferred to 01-05 cleanup** because the consumer (`cli/src/codex/utils/buildHapiMcpBridge.ts`) dies in CUT-02 and the call chain becomes Cursor-only afterward. The guard still passes via the `cli/src/agent/**` and `cli/src/api/**` TEMP-WIDE globs owned by 01-05.
- `shared/src/models.ts` Claude exports (`CLAUDE_MODEL_LABELS`, `CLAUDE_MODEL_PRESETS`, `ClaudeModelPreset`, `isClaudeModelPreset`, `getClaudeModelLabel`) and `shared/src/types.ts` re-exports of `ClaudePermissionMode` / `ClaudeModelPreset` were NOT deleted — the labels (Sonnet/Opus/etc.) still serve as the Cursor agent's fallback model picker via `web/src/components/AssistantChat/{claudeModelOptions,modelOptions}.ts`. Both files are whitelisted under TEMP-WIDE `owner=01-05-cleanup`. Plan task-2 acceptance criteria (`! rg 'CLAUDE_MODEL_*' shared/`) is **not satisfied for CUT-01**; 01-05 cleanup will rename `CLAUDE_*` → `CURSOR_*` (or `AGENT_*`) and migrate the consumers, then delete the TEMP-WIDE entries. Phase-level SC#1/#2/#4 remain green.
- `shared/src/modes.ts` retains `CLAUDE_PERMISSION_MODES` + `ClaudePermissionMode` per D-12 (Phase-5 territory). Whitelisted permanently.

## Threat Flags

None — pure deletion (RESEARCH §"Security Domain" net-negative attack surface from removing `cli/src/claude/sdk/` streaming pipeline over `cross-spawn`).

## Self-Check: PASSED

- `scripts/check-no-cut-agents.sh` exists and is executable ✓
- `.planning/phases/01-cut-non-cursor-agents/01-WAVE0-FINDINGS.md` exists, 102 HEAD-inventory rows with owner-commit assignments ✓
- `cli/src/claude/` absent ✓
- `cli/src/commands/{claude,hookForwarder}.ts` absent ✓
- `cli/src/agent/runners/runAgentSession.{ts,test.ts}` absent ✓
- `bun typecheck && bun run test` green ✓
