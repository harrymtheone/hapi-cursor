---
phase: 05-flavor-consolidation-capability-abstraction
plan: 05
subsystem: cli
tags: [refactor, cut-non-cursor, capability-abstraction, cli-only]
requires:
  - "shared/src/flavors.ts: getCapability + FlavorCapabilities (Slice 1a, plan 05-01)"
  - "shared/src/flavors.ts: userSlashCommandsDir + projectSlashCommandsDir capability slots (Slice 1a, plan 05-01)"
provides:
  - "cli/src/modules/common/slashCommands.ts: capability-driven user/project dir resolution"
  - "cli/src/runner/run.ts: cursor-only default + cursor-binary spawn + no --effort flag"
  - "cli/src/api/types.ts: free of CodexCollaborationMode imports/exports"
  - "cli/src/utils/attachmentFormatter.ts: agent-neutral formatAttachmentsForAgent"
  - "cli/src/api/apiSession.ts: agent-neutral sendAgentSessionMessage"
  - "cli/src tree free of non-cursor flavor literals (Phase-1 whitelist exhausted)"
affects:
  - "cli/src/agent/serverUtils/startHappyServer.ts: updated caller of renamed sendAgentSessionMessage"
  - "cli/src/agent/sessionBase.ts: dropped collaborationMode state + keepAlive payload field"
  - "cli/src/api/api.ts: dropped collaborationMode from session shape"
  - "cli/src/api/api.extraHeaders.test.ts: dropped collaborationMode fixture key"
  - "cli/src/agent/sessionFactory.test.ts: dropped collaborationMode fixture key"
tech-stack:
  added: []
  patterns:
    - "capability-driven resolver pattern: `const resolver = getCapability(agent, key); return resolver ? resolver(arg) : null` — replaces per-flavor switch on path-resolution shape"
key-files:
  created: []
  deleted:
    - cli/src/ui/ink/CodexDisplay.tsx
  modified:
    - cli/src/modules/common/slashCommands.ts
    - cli/src/modules/common/slashCommands.test.ts
    - cli/src/modules/common/skills.ts
    - cli/src/modules/common/skills.test.ts
    - cli/src/modules/common/permission/BasePermissionHandler.ts
    - cli/src/modules/common/rpcTypes.ts
    - cli/src/runner/run.ts
    - cli/src/runner/buildCliArgs.test.ts
    - cli/src/runner/README.md
    - cli/src/api/types.ts
    - cli/src/api/api.ts
    - cli/src/api/apiSession.ts
    - cli/src/api/api.extraHeaders.test.ts
    - cli/src/agent/sessionBase.ts
    - cli/src/agent/sessionFactory.test.ts
    - cli/src/agent/serverUtils/buildHapiMcpBridge.ts
    - cli/src/agent/serverUtils/startHookServer.ts
    - cli/src/agent/serverUtils/startHappyServer.ts
    - cli/src/commands/runner.ts
    - cli/src/parsers/specialCommands.ts
    - cli/src/utils/attachmentFormatter.ts
    - cli/src/ui/logger.ts
    - cli/src/ui/ink/RemoteModeDisplay.tsx
decisions:
  - "Cursor v1 spawn-time token injection is a no-op: cursor takes its credentials from the user's local Cursor IDE login, so the legacy `if (options.token && options.agent === 'claude') { CLAUDE_CODE_OAUTH_TOKEN }` block was deleted outright rather than rewritten."
  - "Cursor's slash-command capability slots are `null` in v1 (CURS-02 / Milestone 2 wires real `~/.cursor/...` paths). The capability-driven `getUserCommandsDir` short-circuits to `null` → callers return an empty command list (graceful no-op), preserving v1 UX (no commands shown)."
  - "Renamed `sendClaudeSessionMessage` → `sendAgentSessionMessage` and `formatAttachmentsForClaude` → `formatAttachmentsForAgent` for agent-neutral naming; the prior Claude-only naming is a Phase-1-deferred cleanup item explicitly called out in `01-01-SUMMARY.md`."
  - "Dropped the `collaborationMode` field from CLI's local Session DTO mirror (`api/types.ts:CreateSessionResponseSchema`) and cascaded to `api.ts` / `apiSession.ts` / `sessionBase.ts` / test fixtures. The shared `SessionSchema.collaborationMode` field is retained until plan 05-07 (Slice 1b owns the shared wire delete)."
metrics:
  duration: 8 min
  completed: 2026-05-22
  task_count: 3
  file_count: 24
---

# Phase 5 Plan 5: Flavor consolidation slice 3a (CLI) Summary

One-liner: CLI tree narrowed to cursor-only (capability-driven slash-command resolution, cursor-binary runner spawn, CodexCollaborationMode imports + CodexDisplay.tsx deleted, all phase-1-whitelisted flavor literals scrubbed); slice gate `bun typecheck && bun run test && check-no-cut-agents.sh` green from repo root.

## What Changed

### Task 1 — capability-driven slash commands + cursor-only skills (commit `d92e7ab`)

- `slashCommands.ts`: rewrote `getUserCommandsDir` and `getProjectCommandsDir` as capability-table lookups (`getCapability(agent, 'userSlashCommandsDir')` / `getCapability(agent, 'projectSlashCommandsDir')`). Deleted the `BUILTIN_COMMANDS` per-flavor map (4-entry record, ~28 lines), the `scanPluginCommands` function (~50 lines including its `InstalledPluginsFile` interface), and the `plugin` source variant on `SlashCommand`. `listSlashCommands` collapsed to user + project only; cursor v1 returns `[]` until CURS-02 wires real paths.
- `slashCommands.test.ts`: rewrote the 8-case sandbox suite to 4 cases — cursor + projectDir, cursor without projectDir, unknown agent, and non-existent project directory; all assert empty result (capability lookup returns `null`).
- `skills.ts`: dropped `'/etc/codex/skills'` admin root (`getAdminSkillsRoot`), `isCodexSkillsRoot` helper, the `~/.claude/skills` and `~/.codex/skills` user roots, and the matching project roots. Skills now resolve from `~/.agents/skills` + project `.agents/skills` only. `listTopLevelSkillDirs` lost its `includeCodexSystem` option.
- `skills.test.ts`: dropped 5 cases that referenced `.claude` / `.codex` fixture directories (kept `.agents` cases + repo-root traversal + duplicate-preference + missing-frontmatter fallback).
- `BasePermissionHandler.ts`: scrubbed `'geminireasoning'` + `'codexreasoning'` auto-approve tool-name hints and the trailing `// OpenCode MCP tool pattern` comment.

### Task 2 — cursor-only runner / api / utils (commit `09cd99f`)

- `runner/run.ts` (3 line-anchored edits):
  - **line 235**: `const agent = options.agent ?? 'cursor'` (was `?? 'claude'`).
  - **lines 347–355**: deleted the entire `if (options.token) { if (options.agent === 'claude' || !options.agent) { CLAUDE_CODE_OAUTH_TOKEN: ... } }` block; replaced with an explanatory comment about cursor v1 not consuming spawn-time OAuth env.
  - **lines 889–905**: `buildCliArgs` now spawns the constant `'cursor'` binary (was `agent === 'cursor' ? 'cursor' : 'claude'`); deleted the `if (options.effort && agent === 'claude')` `--effort` branch. The `agent` parameter is now `_agent` (unused) to preserve the public signature for callers (`runner/run.ts:367`) until plan 05-08 tightens the cli signature.
- `runner/buildCliArgs.test.ts`: rewrote the 7-case suite — all fixtures now pass `'cursor'` as the first arg; permission-mode enumeration narrowed to the four `CursorPermissionMode` values (`default`, `plan`, `ask`, `yolo`) per plan acceptance criterion; added a leading-arg assertion that `args[0] === 'cursor'`.
- `api/types.ts`: dropped `CodexCollaborationModeSchema` import (line 4), `CodexCollaborationMode` type import (line 14), the `CodexCollaborationMode` re-export (line 23), `SessionCollaborationMode = CodexCollaborationMode` alias (line 28), and `collaborationMode: CodexCollaborationModeSchema.optional()` on `CreateSessionResponseSchema` (line 124).
- Cascade (Rule 3 — blocking issues from the `api/types.ts` cut):
  - `api/api.ts:101,149`: dropped `collaborationMode: raw.collaborationMode` from both session-DTO returns.
  - `api/apiSession.ts`: dropped `SessionCollaborationMode` import + `collaborationMode?: SessionCollaborationMode` from the `keepAlive` runtime signature.
  - `api/api.extraHeaders.test.ts:83,139`: dropped two `collaborationMode: undefined` fixture keys.
  - `agent/sessionBase.ts`: dropped every `collaborationMode` reference (option, protected field, constructor wiring, `onModeChange` log line, `getKeepAliveRuntime` payload, getter). 4 stamps removed.
  - `agent/sessionFactory.test.ts:77`: dropped the `collaborationMode: undefined` fixture key.
- `api/apiSession.ts`: renamed `sendClaudeSessionMessage(body: RawJSONLines)` → `sendAgentSessionMessage` (the agent-neutral rename deferred from `01-01-SUMMARY.md`); scrubbed the two surviving `Claude Code injects ...` comments. Updated the one caller (`agent/serverUtils/startHappyServer.ts:28`).
- `modules/common/rpcTypes.ts:7`: collapsed `agent?: 'claude' | 'codex' | 'cursor' | 'gemini' | 'opencode'` to `agent?: 'cursor'`.
- `utils/attachmentFormatter.ts`: renamed `formatAttachmentsForClaude` → `formatAttachmentsForAgent`; both consumers updated (single in-file caller `formatMessageWithAttachments`).
- `parsers/specialCommands.ts:82-86`: scrubbed Claude-named comments on the `parsePlan` parser.
- `commands/runner.ts:190`: help-text `Manages Claude sessions` → `manages Cursor agent sessions`.
- `ui/ink/CodexDisplay.tsx`: **deleted** (entire file, verified unreachable — no remaining importers anywhere in the repo; the Phase-1 `01-05-SUMMARY.md` flagged this as a Phase-5 territory file).

### Task 3 — phase-1-whitelisted CLI files scrubbed (commit `7fb5ae1`)

Per-file disposition table:

| File | Disposition | Notes |
|------|-------------|-------|
| `cli/src/agent/serverUtils/buildHapiMcpBridge.ts` | narrowed (comment) | Deleted the Phase-1-era "NOTE: legacy `hapi mcp` removed alongside Codex agent" preamble — no remaining flavor literals. |
| `cli/src/agent/serverUtils/startHookServer.ts` | narrowed (comments) | Three docstrings rewritten from "Claude session hooks" → "agent session hooks". |
| `cli/src/agent/serverUtils/startHappyServer.ts` | narrowed (comment + caller) | Rephrased claude-sdk comment as generic agent-SDK note. Updated `client.sendAgentSessionMessage` caller (from rename in Task 2). |
| `cli/src/ui/logger.ts` | narrowed (comments) | Three "claude session" → "agent session" replacements in design-decision + design-note comments. |
| `cli/src/ui/ink/RemoteModeDisplay.tsx` | narrowed (UI string) | Header title "Claude Messages" → "Agent Messages". File otherwise free of flavor literals. |
| `cli/src/runner/README.md` | narrowed (out-of-explicit-scope) | Bonus scrub — the "Multi-Agent Support" matrix + "Token Authentication" bullets collapsed to the single cursor row. Necessary to keep the plan's §verification ripgrep gate (line 222) at zero hits. |

After Task 3 the slice-wide ripgrep gate `rg -ni '\b(claude|codex|gemini|opencode)\b' cli/src/` returns **zero matches** (verified post-commit; see Acceptance Criteria below).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] Cascaded `collaborationMode` deletion through 5 additional CLI files**

- **Found during:** Task 2 (`api/types.ts` edits triggered ripple typecheck failures across `api/api.ts`, `api/apiSession.ts`, `agent/sessionBase.ts`, `api/api.extraHeaders.test.ts`, `agent/sessionFactory.test.ts`).
- **Issue:** Dropping `CodexCollaborationModeSchema.optional()` from `CreateSessionResponseSchema` and `SessionCollaborationMode = CodexCollaborationMode` from `api/types.ts` left `raw.collaborationMode` references in `api.ts`, the `keepAlive` runtime payload in `apiSession.ts`, the `AgentSessionBase` protected field + `getKeepAliveRuntime` shape, and two test fixtures referencing `collaborationMode: undefined`.
- **Fix:** Deleted every cascading reference (not stubbed — D-86 forbids shims). All CLI session DTOs and tests now have no `collaborationMode` field; only the shared `SessionSchema.collaborationMode` remains for plan 05-07 to delete.
- **Files modified:** `cli/src/api/api.ts`, `cli/src/api/apiSession.ts`, `cli/src/api/api.extraHeaders.test.ts`, `cli/src/agent/sessionBase.ts`, `cli/src/agent/sessionFactory.test.ts`.
- **Commit:** `09cd99f`

**2. [Rule 3 — Blocking] Renamed `sendClaudeSessionMessage` + scrubbed Claude-named comments in `apiSession.ts`**

- **Found during:** Task 2 (the plan §verification ripgrep gate at line 222 caught `\bClaude\b` hits in `apiSession.ts:41,55,435`).
- **Issue:** The plan §verification gate requires zero `\b(claude|codex|gemini|opencode)\b` hits in `cli/src/`. The `apiSession.ts` `sendClaudeSessionMessage` method (called by `startHappyServer.ts`) and two surviving Claude-Code-named XML-injection comments would have failed it.
- **Fix:** Renamed method to `sendAgentSessionMessage`; updated the one caller in `startHappyServer.ts`; rewrote both comments to agent-neutral wording.
- **Commit:** `09cd99f`

**3. [Rule 3 — Blocking] Scrubbed `cli/src/runner/README.md` Multi-Agent matrix**

- **Found during:** Task 3 verification scan.
- **Issue:** README contained the legacy `claude`/`codex`/`gemini`/`opencode` token-environment table (lines 79–95). Not in any task's explicit acceptance criteria but inside `cli/src/` and would fail the plan §verification gate on line 222.
- **Fix:** Collapsed the "Multi-Agent Support" matrix and "Token Authentication" bullets to a single cursor row; rewrote the section header to "Agent Support".
- **Commit:** `7fb5ae1`

**4. [Rule 1 — Bug] Removed dead auto-approve tool-name hints from `BasePermissionHandler.ts`**

- **Found during:** Task 1 (inspecting `BasePermissionHandler.ts` for flavor literals per `read_first` direction).
- **Issue:** The auto-approve hint list contained `'geminireasoning'` + `'codexreasoning'` tool names (never emitted by cursor) and a trailing `// OpenCode MCP tool pattern` comment for `'hapi_change_title'`. Dead code post-Phase 1.
- **Fix:** Deleted both literal hints and the comment.
- **Commit:** `d92e7ab`

### Auth gates

None.

### Authentication-related decisions

The plan's `runner/run.ts` Task 2 left ambiguity on how to handle the `options.token` plumbing after the `claude`-or-`!agent` branch collapsed. Resolution: the entire `if (options.token) {...}` block was deleted (Cursor v1 has no spawn-time OAuth env). The `token` field is retained on `SpawnSessionOptions` for forward-compat with future CURS-* work; an explanatory comment marks it as a no-op until then.

## Acceptance Criteria Status

### Task 1
- [x] `case '(claude|codex|gemini|opencode)'` in `slashCommands.ts` → **0 hits** (verified).
- [x] `getCapability\(.*'(user|project)SlashCommandsDir'` in `slashCommands.ts` → **2 hits** (verified at lines 50, 59).
- [x] `scanPluginCommands|isCodexSkillsRoot|/etc/codex/skills` in `cli/src/modules/common/` → **0 hits** (verified).
- [x] `cd cli && bun typecheck` exit 0 (verified).
- [x] `cd cli && bun run test --run src/modules/common` exit 0 (verified — 18 tests across 4 files green).

### Task 2
- [x] `test ! -f cli/src/ui/ink/CodexDisplay.tsx` exits 0 (verified — file deleted).
- [x] `\?\? 'claude'\|'claude' \| 'cursor'` in `runner/run.ts` + `rpcTypes.ts` → **0 hits** (verified).
- [x] `agent === 'claude'|agent === 'codex'` in `runner/run.ts` → **0 hits** (verified).
- [x] `CodexCollaborationMode` in `cli/src/api/` → **0 hits** (verified).
- [x] `formatAttachmentsForClaude` in `cli/src/` → **0 hits** (verified).
- [x] `acceptEdits|bypassPermissions|safe-yolo|read-only` in `runner/buildCliArgs.test.ts` → **0 hits** (verified — only cursor permission modes remain).
- [x] `cd cli && bun typecheck` exit 0 (verified).

### Task 3
- [x] `rg -ni '\b(claude|codex|gemini|opencode)\b'` over `cli/src/agent/serverUtils/`, `cli/src/ui/logger.ts`, `cli/src/ui/ink/RemoteModeDisplay.tsx` → **0 hits** (verified).
- [x] `cd cli && bun typecheck` exit 0 (verified).
- [x] **Slice gate:** `bun typecheck && bun run test` from repo root exit 0 (verified — 532 web tests + 225 cli tests + hub tests all green; `scripts/check-no-cut-agents.sh` also passes).

### Plan §verification
- [x] `rg -ni '\b(claude|codex|gemini|opencode)\b' cli/src/ | rg -v "AGENT_MESSAGE_PAYLOAD_TYPE|cli/src/cursor/runCursor\\.ts:.*'cursor'" | rg -v 'CHANGELOG'` → **0 hits** (verified by post-commit `Grep` over `cli/src` returning "No matches found").

## Threat Model Mitigations

- **T-05-05-01 (Tampering — runner spawn agent flag):** Mitigated. `agent` parameter to `buildCliArgs` is `_agent` (unused); the spawned binary is the literal `'cursor'`. The `--effort` branch is deleted; hostile `options.effort` is silently dropped because the cli wrapper never consumes it. `options.agent` only has TypeScript type `'cursor'` going forward (via `rpcTypes.ts` narrow), so future callers cannot pass non-cursor values without compiler error.
- **T-05-05-02 (Tampering — slash-commands directory resolution):** Mitigated. `getCapability(agent, 'userSlashCommandsDir')` returns `null` for unknown / hostile agent strings (see `shared/src/flavors.ts:getCapability` graceful-null per D-76); `scanUserCommands` short-circuits to `[]`. No path escape possible because the resolver function is a typed `(homedir: string) => string | null` taken from the in-source capability table — not user-supplied data.

## Known Stubs

None. The capability-driven slash-command path resolves to `null` in v1 (cursor row of `FlavorCapabilities`), which is the intended graceful no-op until CURS-02 wires `~/.cursor/commands/` — not a stub.

## Threat Flags

None. No new network endpoints, auth paths, file-access patterns, or trust-boundary schema changes were introduced.

## Self-Check: PASSED

- All 24 modified files present and committed (`d92e7ab`, `09cd99f`, `7fb5ae1`) — verified via `git log --oneline -3` and `git diff --stat`.
- `cli/src/ui/ink/CodexDisplay.tsx` confirmed deleted (`test ! -f` would exit 0).
- `bun typecheck && bun run test` green at repo root (532 web + 225 cli + hub tests, plus `check-no-cut-agents.sh`).
- `rg -ni '\b(claude|codex|gemini|opencode)\b' cli/src/` returns **0 hits**.
