# Phase 1: Cut non-Cursor agents — Research

**Researched:** 2026-05-20
**Domain:** Brownfield deletion + business-consumer rewrite (no new code, no new deps)
**Confidence:** HIGH (everything verified against the live tree)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01** 删四个目录 + 相关 commands + workflow + 非 Cursor SDK 依赖为主线；不主动重构 `cli/src/agent/` 共享抽象
- **D-02** `AgentFlavor` union 字面量保留在 `shared/src/flavors.ts`（及其他 union 关联文件）；Phase 5 (CUT-05) 收敛
- **D-03** 业务消费侧（`cli/src/agent/*`、`cli/src/api/*`、`hub/src/sync/*`、`web/src/chat/*` 等）按 Cursor 单分支重写；删除非 Cursor 分支 / imports / handlers / registry 项
- **D-04** 编译/测试通过门槛硬约束。允许必要时局部偷跑 Phase 5/6 工作，但必须在 PLAN 显式标注
- **D-05** 被删源目录下的 `*.test.ts` 一并删除
- **D-06** 跨 flavor 共享测试按"剥离非 Cursor 用例"改造；**不**为已删 flavor 保留 mocked fixture
- **D-07** 不引入新测试（Phase 11 接手）
- **D-08** 通用断言价值的测试保留 Cursor 单分支版本
- **D-09** `cli/src/commands/registry.ts` 默认子命令解析结构不变，仅把 fallback 切到 cursor
- **D-10** `hapi` 无参数 = fallback → cursor；其他子命令按现有结构保留
- **D-11** 业务代码层 `claude` / `codex` / `gemini` / `opencode` 严格零容忍
- **D-12** 白名单 = `.planning/codebase/`、`CHANGELOG.md`、`shared/src/flavors.ts`，PLAN 可显式追加 `shared/src/modes.ts` / `models.ts` 等结构性绑定文件
- **D-13** CI 加 ripgrep 守卫脚本
- **D-14** 5 commits：CUT-01 / CUT-02 / CUT-03 / CUT-04 + 最终 cleanup
- **D-15** 每个 commit 单独通过 `bun typecheck` + `bun run test`

### Claude's Discretion
- 每个 CUT commit 内部的文件删除顺序（按依赖图自底向上即可）
- ripgrep 守卫脚本的具体实现形式（独立 shell script vs. embed 进 `bun run test` vs. 加到 GitHub Actions）
- `cli/src/agent/` 中具体哪些文件需要内部清理 vs. 等 Phase 6 —— 以 `bun typecheck` 是否通过为唯一硬约束
- 是否在 registry.ts 加 deprecation warning（默认不加）

### Deferred Ideas (OUT OF SCOPE)
- `AgentFlavor` union 收敛到 `'cursor'`（Phase 5）
- `cli/src/agent/` 共享 runtime 套件抽象（Phase 6）
- 未知 mode 抛错 + mid-session mode 切换覆盖测试（Phase 6）
- README / AGENTS / docs / website 文案清理（Phase 12）
- `hapi claude` 等 deprecation hint（不做）
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CUT-01 | 删除 Claude Code agent 完整支持。`cli/src/claude/` 整目录、相关 commands、`hookForwarder`、Claude SDK 依赖 | §"CUT-01 deletion map" |
| CUT-02 | 删除 Codex agent 完整支持。`cli/src/codex/` 整目录、相关 commands、`happyMcpStdioBridge`、`codex-pr-review.yml` / `codex-mention-response.yml` GitHub Actions | §"CUT-02 deletion map" |
| CUT-03 | 删除 Gemini agent + ACP 后端。`cli/src/gemini/`、`cli/src/agent/backends/`、ACP 协议相关代码 | §"CUT-03 deletion map" |
| CUT-04 | 删除 OpenCode agent。`cli/src/opencode/`（含 912 行的 storage scanner） | §"CUT-04 deletion map" |
</phase_requirements>

## Summary

This phase is a pure-deletion + consumer-rewrite pass. No new code, no new dependencies, no test additions. The "minimum cut" boundary is honored: every shared abstraction under `cli/src/agent/` (excluding `backends/`) is **left structurally intact** — only consumer branches and dead imports are stripped. The `AgentFlavor` union literal in `shared/src/{flavors,modes,resume,schemas}.ts` is preserved (Phase 5 owns the narrowing).

**Key surprises uncovered during research:**

1. **No `@anthropic-ai/*` or other vendor SDK packages exist in any `package.json`.** The Claude SDK is vendored under `cli/src/claude/sdk/` (raw streaming over `cross-spawn` to the local `claude` CLI binary). SC#5's "package.json no longer declares `@anthropic-ai/*` or any non-Cursor agent SDK" is **vacuously satisfied at start** — but `bun.lock` still needs regenerating because removed transitive imports may shake. The cleanup commit must still run `bun install` and verify the lockfile delta.
2. **`AgentFlavor` union lives in `shared/src/modes.ts:38`, not `shared/src/flavors.ts`.** `flavors.ts` only imports it. D-12's whitelist *must* expand to include `shared/src/modes.ts` (also contains `AGENT_MESSAGE_PAYLOAD_TYPE = 'codex'`, `CODEX_PERMISSION_MODES`, `GEMINI_PERMISSION_MODES`, `OPENCODE_PERMISSION_MODES`, `CLAUDE_PERMISSION_MODES`, `CodexCollaborationMode*` — all structurally tied to the union).
3. **`cli/src/agent/runners/runAgentSession.ts` is dead after CUT-03.** Its only production caller is `cli/src/gemini/runGemini.ts` (via `cli/src/commands/gemini.ts`) through the ACP `AgentRegistry`. Once CUT-03 deletes `cli/src/agent/backends/` + `cli/src/gemini/`, no `AgentRegistry.register()` calls remain and `runAgentSession` becomes unreachable. **Recommendation: delete it (and `runAgentSession.test.ts`) as part of CUT-03**, even though CONTEXT.md line 118 lists it among "preserved shared abstractions" — that classification was a scout-stage heuristic and the dependency analysis above contradicts it. This stays within D-04 ("allow local Phase-5/6 borrowing if needed to keep typecheck green") and the dead-code argument is stronger than the heuristic.
4. **`AGENT_MESSAGE_PAYLOAD_TYPE = 'codex' as const` is wire-level**, not flavor-level — the value `'codex'` is the legacy payload tag carried by *all* flavors (including Cursor) and survives this phase. It must either be (a) renamed to `'agent'` in the cleanup commit (breaks wire compat with old CLI/Hub builds, which is fine per AGENTS.md "No backward compatibility") or (b) whitelisted via `shared/src/modes.ts`. **Recommendation: (b) — keep the literal as-is and whitelist `shared/src/modes.ts`.** Renaming is a wire-format change that belongs in Phase 7 (REFA-03/04), not Phase 1.
5. **Per-flavor `*SessionId` schema fields are wire-level too.** `claudeSessionId / codexSessionId / geminiSessionId / opencodeSessionId` appear in `shared/src/schemas.ts:36-39`, `sessionFactory.ts:96-99`, `syncEngine.ts:451-456,663-720,739-742`, `sessionCache.ts:702-706`, `sessionSummary.ts:36-39`. These are *not* tied to the AgentFlavor union (no Zod enum); they are independent optional string fields. **Recommendation: delete the four non-cursor `*SessionId` fields and all consumer branches in this phase**, keeping only `cursorSessionId`. The `recoverClaudeSessionIdFromMessages` / `extractClaudeSessionId` mechanism in `syncEngine.ts` is Claude-SDK–specific (recovers session id from streaming SDK output) — delete entirely with CUT-01.
6. **`web/src/lib/codexSlashCommands.ts` is mis-named**. Read it — the implementation is wire-payload-aware (the wire tag is `'codex'`, see point 4) but the *behavior* is the canonical slash-command parser used by *Cursor* too. Two options: rename the file (`agentSlashCommands.ts`) and rename the function exports; or accept a single-file whitelist. **Recommendation: rename in the cleanup commit (commit #5)** — it's local to web/, no wire impact, and removes a Phase-1 ripgrep hit.
7. **`shared/src/voice.ts` is deleted whole-file in Phase 2 (CUT-07).** Its ~7 hits for `claude/codex/gemini` are inside the prompt-config TypeScript module that Phase 2 will remove. **Recommendation: whitelist `shared/src/voice.ts` for Phase 1.** Cleaner than touching prose Phase 2 will discard.

**Primary recommendation:** Land 5 commits in the order CUT-01 → CUT-02 → CUT-03 → CUT-04 → cleanup. Each CUT commit deletes its source dir + commands file + tests + business-consumer branches scoped to that flavor. The cleanup commit performs: registry.ts fallback rewrite, ripgrep guard script, `bun install` → `bun.lock` regenerate, sweep any residual hits, the codexSlashCommands → agentSlashCommands rename, and the `extractTodosFromCodexMessage` rename.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Agent runtime spawn (local + remote launchers) | CLI | — | Wraps local agent CLI binary; Cursor-only after phase |
| Wire schema for sessions / messages | Shared | — | `@hapi/protocol` package is single source for CLI ↔ Hub ↔ Web wire types |
| Session resume / session-id persistence | CLI (write) + Hub (read) | Shared (schema) | `cursorSessionId` is the only surviving flavor-id field |
| Per-flavor permission mode tables | Shared | CLI (consume) | Stays inside `shared/src/modes.ts` until Phase 5 narrows |
| Slash-command parsing of wire payloads | Web | Shared (constant) | `AGENT_MESSAGE_PAYLOAD_TYPE` is wire-level, not Cursor-only |
| GitHub Actions agent automation | CI/GitHub | — | `codex-*.yml` workflows deleted whole-file |
| Vendored SDK code (Claude streaming) | CLI | — | Lives at `cli/src/claude/sdk/`; deleted with CUT-01 |

## Standard Stack

No new packages. This is deletion-only. Verified during research:

```bash
# No external vendor SDK packages exist:
rg '@anthropic-ai|@openai|@google/(gen|gemini)|opencode-ai|@zed-industries' package.json '*/package.json'
# → no matches anywhere in the repo
```

**Existing tooling used by the phase:**

| Tool | Version | Purpose | Source |
|------|---------|---------|--------|
| Bun | 1.3.14 (root `packageManager`) | Workspaces + lockfile + scripts | `package.json` |
| ripgrep (`rg`) | system-installed | Guard script regex matching | `bun run test` hook or CI step |
| Vitest | ^4.0.16 | Test runner across cli/hub/web | per-workspace `package.json` |
| TypeScript | ^5 | `bun typecheck` | per-workspace |

`[VERIFIED: repo scan]` — no new dependencies introduced by this phase.

## Package Legitimacy Audit

**Skipped — this is a deletion-only phase; no packages are added.** The only `package.json` mutation expected is potential *removal* of dependencies, but research confirms zero non-Cursor agent SDK packages exist today. The cleanup commit's `bun install` is a no-op for direct deps and only refreshes the transitive graph.

## CUT-01 deletion map (Claude Code agent)

### Source dirs / files to delete outright

| Path | Type | Notes |
|------|------|-------|
| `cli/src/claude/` | dir | entire tree (claudeLocal, claudeRemote, claudeRemoteLauncher, loop, session, runClaude, effort, model, sdk/, utils/, registerKillSessionHandler.ts, types.ts) |
| `cli/src/commands/claude.ts` | file | `claudeCommand` definition |
| `cli/src/commands/hookForwarder.ts` | file | only consumed by Claude hook protocol |

### Tests deleted with parents (D-05)

All `*.test.ts` under `cli/src/claude/` (claudeLocalLauncher.test.ts, claudeRemote.test.ts, claudeRemote.seam.test.ts, effort.test.ts, loop.test.ts, model.test.ts, types.test.ts, sdk/query.test.ts, sdk/stream.test.ts, utils/path.test.ts, utils/permissionHandler.test.ts, utils/OutgoingMessageQueue.test.ts, utils/sessionScanner.test.ts, utils/startHookServer.test.ts, utils/chatVisibility.test.ts).

### Tests OUTSIDE deleted dirs that need Claude rewrites (D-06)

| Path | Action | Why |
|------|--------|-----|
| `cli/src/agent/runners/runAgentSession.test.ts` | **delete (dead with CUT-03)** | sole consumer of `runAgentSession`; ACP path goes |
| `cli/src/agent/sessionFactory.test.ts` | strip non-Cursor flavor cases | rewrite to Cursor-only per D-06 |
| `cli/src/agent/rateLimitParser.test.ts` | rewrite fixture text or delete | `"Claude AI usage limit..."` strings are Claude-SDK output format |
| `cli/src/agent/internalEventFilter.test.ts` | keep | doc string only — adjust comment in cleanup |
| `cli/src/agent/messageConverter.test.ts` | keep | flavor-neutral assertions (D-08) |
| `cli/src/agent/utils.test.ts` | rewrite comments + Gemini-named test cases | flavor-neutral logic remains |
| `cli/src/api/apiMachine.test.ts` | strip non-Cursor fixtures | cross-flavor matrix → Cursor-only |
| `cli/src/runner/buildCliArgs.test.ts` | strip non-Cursor cases | cross-flavor matrix |
| `cli/src/commands/resume.test.ts` | strip non-Cursor cases | cross-flavor matrix |
| `web/src/lib/assistant-runtime.test.ts` | rewrite `'claude-sonnet-4-6'` etc. model fixtures | Use Cursor-named model fixtures (e.g. `'sonnet'`, `'composer'`) |
| `shared/src/resume.test.ts` | strip non-Cursor cases | flavor matrix test |

### Business-consumer Claude rewrites (D-03)

| Path | Action |
|------|--------|
| `cli/src/agent/runners/runAgentSession.ts` | delete (dead after CUT-03; imports `@/claude/utils/startHappyServer` + `@/claude/registerKillSessionHandler` which are being deleted) |
| `cli/src/agent/rateLimitParser.ts` | delete file (Claude-SDK-format parser; only ACP backend consumes it via `AcpMessageHandler`) — moves to cleanup commit since it's referenced by ACP code deleted in CUT-03; or delete with CUT-03 |
| `cli/src/agent/internalEventFilter.ts` | keep file; remove "Claude's SDK" comment |
| `cli/src/agent/sessionFactory.ts` | delete lines 96-99 (`claudeSessionId / codexSessionId / geminiSessionId / opencodeSessionId` preservation) — leave line 100 `cursorSessionId` |
| `cli/src/claude/session.ts` (21 hits) | deleted with parent dir |
| `hub/src/web/routes/sessions.ts` | rewrite `flavor ?? 'claude'` defaults → `'cursor'`; delete `effort`-route (Claude-only); delete `recoverClaude*` calls |
| `hub/src/sync/syncEngine.ts` | delete `recoverClaudeSessionIdFromMessages`, `extractClaudeSessionId`, `normalizeClaudeSessionId`, `persistRecoveredClaudeSessionId`, the Claude branch in `getCanonicalAgentSessionId`, and `flavor === 'claude'` defaults |
| `hub/src/sync/sessionCache.ts` | strip `claudeSessionId` from the per-flavor session-id picker (line 702-706) — leave `cursorSessionId` |
| `hub/src/sync/teams.ts` | line 11 comment cleanup |
| `hub/src/sync/sessionModel.test.ts` (97 hits) | strip Claude-flavored fixtures per D-06 |
| `hub/src/web/routes/sessions.test.ts` | delete Claude-effort test cases |
| `hub/src/web/routes/permissions.ts` | rewrite `flavor ?? 'claude'` → `'cursor'` |
| `hub/src/web/routes/machines.ts` | line 9: drop `'claude'` from `z.enum` (but keep `'cursor'`) — note this enum has cursor + ALL flavors; reduce to only cursor (and any others that survive each CUT commit) |
| `shared/src/schemas.ts` | delete `claudeSessionId` field (line 36) |
| `shared/src/sessionSummary.ts` | line 36-39 — drop the `claudeSessionId ?? geminiSessionId ?? ...` chain; collapse to `cursorSessionId ?? codexSessionId` (codex still alive until CUT-02; intermediate states are OK per D-15 since each commit is green) |
| `shared/src/messages.ts` | delete `VISIBLE_CLAUDE_SYSTEM_SUBTYPES`, `isClaudeChatVisibleSystemSubtype`, `isClaudeChatVisibleMessage` — verify no Cursor caller |
| `shared/src/models.ts` | delete `CLAUDE_MODEL_LABELS / CLAUDE_MODEL_PRESETS / ClaudeModelPreset / isClaudeModelPreset / getClaudeModelLabel`; verify no Cursor consumer (web/src/lib/sessionModelLabel.ts uses it — rewrite) |
| `shared/src/models.test.ts` | rewrite to test only what survives |
| `web/src/lib/sessionModelLabel.ts` + `.test.ts` | drop Claude-model branch |

### CUT-01 misc

| Path | Action |
|------|--------|
| `hub/package.json` description | `"Telegram Bot client for HAPI - control Claude Code sessions"` → `"HAPI Hub — Cursor session control + sync"` (touches both `Claude` + `Telegram`; the `Telegram` mention is Phase 2's responsibility — for Phase 1 just remove `Claude Code`) |
| `cli/NOTICE` | mentions Claude derivation history — **whitelist** (license / attribution text) |
| `.gitignore` (root) and `cli/.gitignore` | check for `*.claude*` patterns (none observed but verify in plan) |

## CUT-02 deletion map (Codex agent)

### Source dirs / files to delete outright

| Path | Type | Notes |
|------|------|-------|
| `cli/src/codex/` | dir | entire tree (codexLocal, codexLocalLauncher, codexRemoteLauncher, codexAppServerClient, codexSpecialCommands, loop, session, runCodex, appServerTypes, happyMcpStdioBridge, __tests__/, utils/) |
| `cli/src/codex/happyMcpStdioBridge.ts` | file (subset of above) | called out by CONTEXT D-14 |
| `cli/src/commands/codex.ts` | file | `codexCommand` |
| `cli/src/commands/codex.test.ts` | file | (D-05 + sole consumer is codex.ts) |
| `.github/workflows/codex-pr-review.yml` | file | per D-14 + SC#4 |
| `.github/workflows/codex-mention-response.yml` | file | per D-14 + SC#4 |
| `scripts/dev/self-test-codex-web-env.sh` | file | dev script for Codex web env |
| `scripts/dev/seed-codex-web-fixture.ts` | file | dev fixture seeder for Codex |
| `cli/README.md` Codex section | rewrite (Phase 12 owns full README; Phase 1 only strips bullet lines that hit ripgrep) |

### Business-consumer Codex rewrites (D-03)

| Path | Action |
|------|--------|
| `cli/src/agent/messageConverter.ts` | rename type `CodexMessage` → `AgentWireMessage`; update comment at line 29-30 (wire-level `message` field rationale) |
| `cli/src/cursor/cursorRemoteLauncher.ts` | line 126 local var `codexMsg` → `agentMsg` |
| `hub/src/sync/todos.ts` | rename `extractTodosFromCodexMessage` → `extractTodosFromAgentMessage`; `content.type !== 'codex'` check stays as-is (wire literal, see point 4 above) — but the bare string `'codex'` will hit ripgrep, so import + use `AGENT_MESSAGE_PAYLOAD_TYPE` constant |
| `hub/src/web/routes/sessions.ts` | **delete** routes `/sessions/:id/codex-models`, `collaboration-mode`, `model-reasoning-effort`; delete all `flavor === 'codex'` guards (lines 305-410) |
| `hub/src/web/routes/sessions.test.ts` | delete codex-route tests |
| `hub/src/web/routes/machines.ts` | **delete** route `/machines/:id/codex-models`; drop `'codex'` from `z.enum` |
| `hub/src/web/routes/machines.test.ts` | delete codex-route tests |
| `hub/src/sync/syncEngine.ts` | delete `listCodexModelsForSession`, `listCodexModelsForMachine`, `RpcCodexModel`, `RpcListCodexModelsResponse`; delete `flavor === 'codex'` branches |
| `hub/src/sync/rpcGateway.ts` | delete `listCodexModels*` methods + `RpcCodexModel` / `RpcListCodexModelsResponse` types |
| `hub/src/sync/rpcGateway.test.ts` | delete codex-model timeout test |
| `hub/src/sync/sessionCache.ts` | drop `CodexCollaborationMode` import + `collaborationMode` field references (lines 173, 382); drop `codexSessionId` from picker — leave Cursor-only |
| `hub/src/socket/handlers/cli/sessionHandlers.ts` + `index.ts` | drop `CodexCollaborationMode` import + `collaborationMode` field from event types |
| `hub/src/sync/teams.ts` | line 32 comment cleanup ("Agent payload format: { type: 'codex' }") |
| `hub/src/sync/aliveEvents.test.ts` | rewrite `flavor: 'codex'` → `flavor: 'cursor'` |
| `hub/src/web/routes/cli.test.ts` | strip codex fixtures |
| `hub/src/push/pushNotificationChannel.test.ts` | line 12 `flavor: 'codex'` → `'cursor'` |
| `shared/src/schemas.ts` | delete `codexSessionId` field; **whitelist** `CodexCollaborationMode*` (structurally tied to union via `z.enum(CODEX_COLLABORATION_MODES)`) |
| `shared/src/sessionSummary.ts` | drop `codexSessionId` from chain |
| `shared/src/socket.ts` | line 161 `collaborationMode?: CodexCollaborationMode` field → drop or whitelist (recommend drop since hub also drops the wire field) |
| `web/src/lib/codexSlashCommands.ts` + `.test.ts` | rename file → `agentSlashCommands.ts`; rename internal symbols; update import in `web/src/hooks/queries/useSlashCommands.ts` |
| `web/src/components/AssistantChat/StatusBar.tsx` | delete `getCodexCollaborationModeLabel` import, `formatCodexReasoningLabel`, `isCodexFastMode`, all `agentFlavor === 'codex'` branches and JSX (lines 2,9,126-214,249-254) |
| `web/src/components/ToolCard/PermissionFooter.tsx` | rewrite `isCodexFamilyFlavor` usage (also touched by CUT-03/04 — handle all three together; cleanup commit if cross-CUT) |
| `web/src/lib/message-window-store.ts` + `.test.ts` | rewrite `flavor: 'codex'` fixtures |
| `web/src/chat/*` | strip `'codex'` flavor branches (see Business-consumer rewrite map below for per-file counts) |
| `cli/src/commands/resume.ts` | drop `CodexPermissionMode` import (line 6-10); drop `ReasoningEffort` import from `@/codex/appServerTypes` (will be broken); drop `assertCodexLocalSupported` import |

## CUT-03 deletion map (Gemini + ACP backend)

### Source dirs / files to delete outright

| Path | Type | Notes |
|------|------|-------|
| `cli/src/gemini/` | dir | entire tree |
| `cli/src/agent/backends/` | dir | entire tree (acp/AcpSdkBackend, AcpMessageHandler, AcpStdioTransport, constants, index, __fixtures__/) |
| `cli/src/commands/gemini.ts` | file | `geminiCommand` |
| `cli/src/agent/runners/runAgentSession.ts` | file | **dead code after this commit** (see Summary point 3) |
| `cli/src/agent/runners/runAgentSession.test.ts` | file | (sole consumer of runAgentSession) |
| `cli/src/agent/runners/` | dir | empty after the two files above → remove dir |
| `cli/src/agent/AgentRegistry.ts` | file | **dead code after this commit** (no registrants remain; only `runAgentSession` consumed it) — verify with typecheck before deleting |
| `cli/src/agent/types.ts` | file | re-exports `AgentBackend`, `AgentBackendFactory` consumed only by `AgentRegistry` and ACP — verify with typecheck |
| `cli/src/agent/permissionAdapter.ts` + `.test.ts` | keep if Cursor uses; ACP-only otherwise delete | grep already shows `permissionAdapter` is imported by `runAgentSession.ts` (deleted) — **verify whether `cli/src/cursor/*` imports it** before deciding |
| `cli/src/agent/messageConverter.ts` + `.test.ts` | KEEP — Cursor uses (`cursorRemoteLauncher.ts:6`) |
| `cli/src/agent/rateLimitParser.ts` + `.test.ts` | **delete** (only `AcpMessageHandler.ts:4` imports it) |
| `cli/src/agent/internalEventFilter.ts` + `.test.ts` | **delete** (only `AcpMessageHandler.ts:5` imports it) |

### Business-consumer Gemini rewrites (D-03)

| Path | Action |
|------|--------|
| `cli/src/commands/registry.ts` | covered by cleanup commit; drop `geminiCommand` import + entry |
| `cli/src/commands/resume.ts` | drop `GeminiPermissionMode` import |
| `hub/src/web/routes/sessions.ts` | drop `'gemini'` from machines z.enum + `flavor === 'gemini'` branches if any |
| `hub/src/web/routes/sessions.test.ts` | strip the "Gemini regression test" (line 285-303) |
| `hub/src/sync/syncEngine.ts` | drop `'gemini'` from agent union (line 412, 439) + flavor-id branch (line 452) |
| `hub/src/sync/rpcGateway.ts` | drop `'gemini'` from agent union (line 153) |
| `shared/src/schemas.ts` | delete `geminiSessionId` field |
| `shared/src/sessionSummary.ts` | drop `geminiSessionId` from chain |
| `shared/src/models.ts` | delete `GEMINI_MODEL_LABELS / GEMINI_MODEL_PRESETS / GeminiModelPreset / DEFAULT_GEMINI_MODEL`; rewrite `models.test.ts` |
| `shared/src/types.ts` | drop `GeminiPermissionMode`, `GeminiModelPreset` re-exports |
| `web/src/components/ToolCard/PermissionFooter.tsx` | drop `toolName.startsWith('Gemini')` branch |
| `web/src/chat/*` | strip gemini fixtures (see Business-consumer rewrite map) |

### CUT-03 ordering risk

Because `runAgentSession.ts` imports from `@/claude/...` (deleted in CUT-01) AND `cli/src/agent/backends/` (deleted in CUT-03 itself), CUT-01's commit will break typecheck **unless** `runAgentSession.ts` and its test are also deleted in CUT-01 OR the broken imports are replaced earlier. **Recommendation:** delete `runAgentSession.ts` + `.test.ts` in **CUT-01** (move from CUT-03), so each commit individually stays green. This is the only structural cross-commit ordering constraint identified.

## CUT-04 deletion map (OpenCode agent)

### Source dirs / files to delete outright

| Path | Type | Notes |
|------|------|-------|
| `cli/src/opencode/` | dir | entire tree (includes the 912-line `utils/opencodeStorageScanner.ts`, `utils/hookPlugin.ts`, `utils/opencodeConfig.ts`, `utils/startOpencodeHookServer.ts`, etc.) |
| `cli/src/commands/opencode.ts` | file | `opencodeCommand` |

### Business-consumer OpenCode rewrites (D-03)

| Path | Action |
|------|--------|
| `cli/src/commands/registry.ts` | covered by cleanup commit; drop `opencodeCommand` import + entry |
| `cli/src/commands/resume.ts` | drop `OpencodePermissionMode` import |
| `hub/src/web/routes/sessions.ts` | delete `/sessions/:id/opencode-models` route + `flavor === 'opencode'` checks |
| `hub/src/web/routes/sessions.test.ts` | delete OpenCode-specific tests |
| `hub/src/web/routes/machines.ts` | delete `/machines/:id/opencode-models` route; drop `'opencode'` from z.enum |
| `hub/src/web/routes/machines.test.ts` | delete OpenCode-route tests |
| `hub/src/sync/syncEngine.ts` | delete `listOpencodeModelsForSession`, `listOpencodeModelsForCwd`, `RpcOpencodeModel`, `RpcListOpencodeModelsResponse`; drop `'opencode'` from agent union (412) + flavor-id branch (453) |
| `hub/src/sync/rpcGateway.ts` | delete `listOpencodeModels*` methods + opencode RPC types; drop `'opencode'` from union (153) |
| `shared/src/schemas.ts` | delete `opencodeSessionId` field |
| `shared/src/sessionSummary.ts` | drop `opencodeSessionId` from chain |
| `shared/src/types.ts` | drop `OpencodePermissionMode` re-export |
| `web/src/components/ToolCard/PermissionFooter.tsx` | drop `toolName.startsWith('OpenCode')` branch |
| `web/src/chat/*` | strip opencode fixtures |

## `cli/src/agent/` shared-abstraction map (post-CUT-01..04)

| File | Flavor coupling | Action |
|------|-----------------|--------|
| `AgentRegistry.ts` | structurally generic (no flavor literals); only consumer is `runAgentSession` | **delete with CUT-03** (dead) |
| `types.ts` | generic `AgentBackend` / `AgentBackendFactory` interfaces; only consumed by AgentRegistry + ACP backend | **delete with CUT-03** (dead) — verify with `bun typecheck` |
| `sessionFactory.ts` | references the 4 non-cursor `*SessionId` fields (line 96-99) | **edit**: drop those 4 lines per CUT-01 |
| `sessionFactory.test.ts` | flavor matrix fixtures | **edit**: D-06 strip non-Cursor cases |
| `sessionBase.ts` | (not yet inspected at file level — flag for planner) | likely keep; verify no flavor literals |
| `loopBase.ts` | (not yet inspected) | likely keep; verify |
| `messageConverter.ts` | exports `CodexMessage` type (wire-level name only) | **edit**: rename type → `AgentWireMessage` in CUT-02 |
| `messageConverter.test.ts` | flavor-neutral assertions | keep + minor symbol rename |
| `permissionAdapter.ts` + `.test.ts` | consumed by `runAgentSession` (deleted) AND by Cursor path | **verify Cursor coupling before delete**. If only `runAgentSession` consumes it, delete with CUT-03. |
| `rateLimitParser.ts` + `.test.ts` | only ACP backend consumes | **delete with CUT-03** |
| `internalEventFilter.ts` + `.test.ts` | only ACP backend consumes | **delete with CUT-03** |
| `localHandoff.ts` + `.test.ts` | (not yet inspected) | likely keep; verify |
| `localLaunchPolicy.ts` | (not yet inspected) | likely keep |
| `runnerLifecycle.ts` | (not yet inspected) | likely keep |
| `utils.ts` + `.test.ts` | Claude/Gemini-named comments + helper that maps Gemini tool kinds to Claude tool names | **edit**: rewrite the comments (line 27-29, 41-42) and the helper logic still applies but rename the rationale — the function maps to wire-level "Write/Edit" tool names which are wire-stable, so just clean up comments |

**Plan task suggestion:** insert a Wave 1 task that runs `rg -l 'claude|codex|gemini|opencode' cli/src/agent/` after CUT-01..04 land; any remaining hits must be either deleted (dead code) or cleaned up in the final commit.

## Business-consumer rewrite map (per-file, non-deleted, with non-Cursor reference)

**NOTE (added during planning revision r3):** The per-file rows below are the RESEARCH-time best estimate. The CANONICAL ownership ledger is `01-WAVE0-FINDINGS.md` §"HEAD inventory" — produced by 01-01 Task 0 sub-step W0.0 as the first action of Phase 1 execution. Final owner-commit assignments (CUT-01..04, 01-05-cleanup, or whitelist-permanent) are determined there from live `rg` output, not from this table. The W0.0 ledger may surface files not enumerated below; those rows still get an owner-commit and are processed by the corresponding plan's "Rewrite W0.0-inventory consumers assigned to CUT-XX" / "Rewrite W0.0-deferred multi-flavor consumers" tasks.

Categories:
- **(a) Delete-the-branch:** Strip `if (flavor === 'X')` arms / switch arms / registry entries for non-Cursor flavors
- **(b) Delete-the-import:** Remove imports of deleted modules + their now-dead references
- **(c) Whitelist:** Structurally tied to AgentFlavor union — Phase 5 territory
- **(d) Test fixture cleanup (D-06):** Strip non-Cursor cases from cross-flavor matrix tests

| Path | Hits | Category | Belongs to commit | Rationale |
|------|------|----------|-------------------|-----------|
| `cli/src/commands/registry.ts` | 12 | (a)+(b) | **#5 cleanup** | Imports + entries for all 4 deleted commands + hookForwarder; fallback `claudeCommand` → `cursorCommand` (D-09) |
| `cli/src/commands/resume.ts` | 33 | (b) | distributed across #1-#4 | Drops per-flavor permission-mode imports + per-flavor branches |
| `cli/src/commands/resume.test.ts` | 35 | (d) | distributed | strip per-flavor cases |
| `cli/src/commands/mcp.ts` | 1 | (a)/(b) | open | inspect during plan |
| `cli/src/commands/runner.ts` | 1 | (a)/(b) | open | inspect during plan |
| `cli/src/agent/sessionFactory.ts` | 12 | (a) | #1 (claudeSessionId etc.) | drop 4 lines |
| `cli/src/agent/sessionFactory.test.ts` | 27 | (d) | distributed | strip per-flavor cases |
| `cli/src/agent/runners/runAgentSession.ts` | 2 | (b) | **#1** (moved up for ordering) | dead code; delete entirely |
| `cli/src/agent/runners/runAgentSession.test.ts` | 2 | (b) | **#1** | delete |
| `cli/src/agent/internalEventFilter.ts` | 1 | (b) | #3 | delete file |
| `cli/src/agent/messageConverter.ts` | 4 | (b) | #2 | rename type |
| `cli/src/agent/rateLimitParser.ts` | 5 | (b) | #3 | delete file |
| `cli/src/agent/rateLimitParser.test.ts` | 5 | (b) | #3 | delete file |
| `cli/src/agent/utils.ts` | 2 | (a) | #5 | comment cleanup |
| `cli/src/agent/utils.test.ts` | 3 | (d) | #5 | comment cleanup + test description rewrite |
| `cli/src/api/apiMachine.ts` | 10 | (a) | distributed | per-flavor branches |
| `cli/src/api/apiMachine.test.ts` | 20 | (d) | distributed | strip cases |
| `cli/src/api/apiSession.ts` | 4 | wire literal | KEEP (uses `AGENT_MESSAGE_PAYLOAD_TYPE`) | inspect — likely safe |
| `cli/src/api/types.ts` | 8 | (a)/(b) | distributed | per-flavor types |
| `cli/src/lib.ts` | 1 | (b) | open | likely re-export cleanup |
| `cli/src/utils/attachmentFormatter.ts` | 4 | (a) | distributed | inspect |
| `cli/src/terminal/TerminalManager.ts` | 1 | (a)/(b) | open | inspect |
| `cli/src/runner/run.ts` | 23 | (a)+(b) | distributed | per-flavor spawn paths |
| `cli/src/runner/buildCliArgs.test.ts` | 8 | (d) | distributed | strip per-flavor cases |
| `cli/src/cursor/runCursor.ts` | 1 | inspect | — | likely comment / log string |
| `cli/src/cursor/cursorRemoteLauncher.ts` | 6 | (a) | distributed | local var rename `codexMsg` |
| `cli/src/parsers/specialCommands.ts` | 2 | (a)/(b) | open | inspect |
| `cli/src/ui/logger.ts` | 3 | inspect | open | likely log string |
| `cli/src/ui/messageFormatterInk.ts` | 4 | (a) | distributed | inspect |
| `cli/NOTICE` | 2 | (c) whitelist | — | license / attribution text |
| `cli/.gitignore`, `.gitignore` | 2+2 | inspect | open | check for `*.claude*` ignore patterns |
| `shared/src/messages.ts` | 5 | (a) | #1 | delete Claude visibility helpers |
| `shared/src/modes.ts` | 38 | (c) whitelist | — | `AgentFlavor` union + `*_PERMISSION_MODES` + `AGENT_MESSAGE_PAYLOAD_TYPE = 'codex'` |
| `shared/src/models.ts` | 31 | (b)+(c) | distributed (#1 Claude, #3 Gemini) | delete per-flavor model tables |
| `shared/src/models.test.ts` | 30 | (d) | distributed | rewrite |
| `shared/src/schemas.ts` | 8 | (a)+(c) | distributed | delete 4 `*SessionId` fields (#1,#2,#3,#4); whitelist `CodexCollaborationModeSchema` |
| `shared/src/sessionSummary.ts` | 4 | (a) | distributed | collapse chain (#1 drop claude, #2 drop codex, #3 drop gemini, #4 drop opencode) |
| `shared/src/socket.ts` | 2 | (a) | #2 | drop `CodexCollaborationMode` import + field |
| `shared/src/types.ts` | 8 | (a)+(c) | distributed | drop per-flavor type re-exports as each CUT lands |
| `shared/src/resume.ts` | 6 | (c) whitelist | — | `AgentFlavorSchema = z.enum([...])` |
| `shared/src/resume.test.ts` | 3 | (d) | distributed | strip per-flavor cases |
| `shared/src/flavors.ts` | 16 | (c) whitelist | — | D-12 explicit |
| `shared/src/flavors.test.ts` | 32 | (c) whitelist | — | tests of whitelist file |
| `shared/src/voice.ts` | 7 | (c) whitelist | — | deleted whole in Phase 2 (CUT-07) |
| `hub/package.json` | 1 | (a) | #1 | description string — drop "Claude Code" |
| `hub/src/sync/sessionCache.ts` | 19 | (a) | distributed | per-flavor session-id picker + CodexCollaborationMode |
| `hub/src/sync/sessionModel.test.ts` | 97 | (d) | distributed | strip per-flavor fixtures |
| `hub/src/sync/syncEngine.ts` | 62 | (a) | distributed | per-flavor branches; Claude session-id recovery (#1); RPC delegations (#2,#3,#4); union narrowing (#5) |
| `hub/src/sync/rpcGateway.ts` | 29 | (a) | distributed | per-flavor RPC methods |
| `hub/src/sync/rpcGateway.test.ts` | 2 | (d) | #2 | codex RPC timeout test |
| `hub/src/sync/teams.ts` | 2 | (a) | #1/#2 | comments referencing per-flavor wire shapes |
| `hub/src/sync/todos.ts` | 6 | (a) | #2 | rename `extractTodosFromCodexMessage` → `extractTodosFromAgentMessage`; replace literal `'codex'` checks with `AGENT_MESSAGE_PAYLOAD_TYPE` constant |
| `hub/src/sync/aliveEvents.test.ts` | 5 | (d) | #2 | flavor fixture rewrite |
| `hub/src/web/routes/sessions.ts` (not in initial grep snapshot but discovered) | ~20 | (a) | distributed | per-flavor routes + flavor defaults |
| `hub/src/web/routes/sessions.test.ts` (not in initial grep snapshot but discovered) | ~30 | (d) | distributed | per-flavor route tests |
| `hub/src/web/routes/machines.ts` | (discovered) | (a) | distributed | per-flavor model routes |
| `hub/src/web/routes/machines.test.ts` | (discovered) | (d) | distributed | per-flavor route tests |
| `hub/src/web/routes/permissions.ts` | (discovered) | (a) | #1 | `flavor ?? 'claude'` → `'cursor'` |
| `hub/src/web/routes/cli.test.ts` | (discovered) | (d) | distributed | strip per-flavor fixtures |
| `hub/src/socket/handlers/cli/sessionHandlers.ts` + `index.ts` | (discovered) | (a) | #2 | drop CodexCollaborationMode |
| `hub/src/push/pushNotificationChannel.test.ts` | 1 | (d) | #2 | flavor fixture rewrite |
| `web/src/lib/assistant-runtime.ts` | 13 | (a) | distributed | inspect during plan |
| `web/src/lib/assistant-runtime.test.ts` | 56 | (d) | distributed | rewrite Claude model name fixtures |
| `web/src/lib/sessionModelLabel.ts` + `.test.ts` | 2+1 | (a) | #1/#3 | drop Claude/Gemini model branches |
| `web/src/lib/codexSlashCommands.ts` + `.test.ts` | 20+16 | rename | #5 cleanup | rename file + symbols |
| `web/src/lib/message-window-store.ts` + `.test.ts` | 6+4 | (a)+(d) | distributed | per-flavor branches + fixtures |
| `web/src/lib/query-keys.ts` | 8 | (a) | distributed | per-flavor cache keys |
| `web/src/components/SessionList.tsx` + tests | 6+1+1 | (a)+(d) | distributed | flavor badges + tests |
| `web/src/components/SessionChat.tsx` | 45 | (a) | distributed | per-flavor UI |
| `web/src/components/AssistantChat/StatusBar.tsx` | (discovered) | (a) | #2 | Codex-specific status bits |
| `web/src/components/ToolCard/PermissionFooter.tsx` | (discovered) | (a) | distributed | `isCodexFamilyFlavor` + per-flavor tool name prefixes |
| `web/src/chat/types.ts` | 9 | (a) | distributed | flavor union usage |
| `web/src/chat/normalize.ts` + `.test.ts` | 2+26 | (a)+(d) | distributed | per-flavor normalize |
| `web/src/chat/normalizeAgent.ts` | 26 | (a) | distributed | per-flavor normalize |
| `web/src/chat/reconcile.ts` | 7 | (a) | distributed | per-flavor reconcile |
| `web/src/chat/modelConfig.ts` + `.test.ts` | 15+11 | (a)+(d) | distributed | per-flavor model lists |
| `web/src/chat/reducer.test.ts` | 1 | (d) | distributed | strip case |
| `web/src/chat/reducerEvents.ts` + `.test.ts` | 4+6 | (a)+(d) | distributed | per-flavor events |
| `web/src/chat/reducerCliOutput.test.ts` | 2 | (d) | distributed | strip cases |
| `web/src/chat/reducerTimeline.ts` + `.test.ts` | 11+42 | (a)+(d) | distributed | per-flavor timeline |
| `web/src/chat/toolGroups.ts` + `.test.ts` | 6+11 | (a)+(d) | distributed | per-flavor tool groups |
| `web/src/chat/subagentTool.ts` | 1 | (a) | distributed | inspect |
| `web/src/chat/presentation.test.ts` | 1 | (d) | distributed | strip case |
| `web/src/hooks/useActiveSuggestions.ts` | 1 | (a)/(b) | open | inspect |
| `web/src/hooks/queries/useSlashCommands.ts` | (discovered) | (b) | #5 | import rename after `codexSlashCommands.ts` rename |
| `web/src/router.tsx` | 1 | (a)/(b) | open | inspect |
| `web/src/types/api.ts` | 8 | (a)+(b) | distributed | per-flavor types |
| `web/src/api/client.ts` | 24 | (a) | distributed | per-flavor API helpers |
| `web/src/realtime/realtimeClientTools.ts` | 2 | (c) whitelist or trivial fix | — | Phase 2 (CUT-07) deletes whole `web/src/realtime/` |
| `.github/workflows/issue-auto-response.yml` | 2 | (a) | #5 | strip `claude/codex/gemini/opencode` mentions or whitelist (workflow file — Phase 12 owns docs) |
| `.gitignore`, `cli/.gitignore` | each 2 | inspect | open | likely ignore patterns |

## ripgrep guard script (concrete recommendation per D-13)

### Pattern
```
\b(claude|codex|gemini|opencode)\b
```
- Case-insensitive (`-i`) — catches `Claude`, `CLAUDE`, etc.
- `\b` word-boundary — won't false-positive on substrings inside unrelated identifiers (none expected, but safer).

### Whitelist (final form for Phase 1)
```
.planning/codebase/
CHANGELOG.md
shared/src/flavors.ts
shared/src/flavors.test.ts
shared/src/modes.ts
shared/src/resume.ts
shared/src/voice.ts
cli/NOTICE
.gitignore
cli/.gitignore
docs/
website/
node_modules/
dist/
bun.lock
.git/
```

> **Justification per file:**
> - `shared/src/flavors.ts` + `flavors.test.ts` — D-12 (Phase-5 union owner)
> - `shared/src/modes.ts` — `AgentFlavor` union + per-flavor `*_PERMISSION_MODES` + `AGENT_MESSAGE_PAYLOAD_TYPE = 'codex'` + `CodexCollaborationMode*` (all structurally tied to union — Phase 5 narrows them)
> - `shared/src/resume.ts` — `AgentFlavorSchema = z.enum([...])` (Zod runtime image of union)
> - `shared/src/voice.ts` — deleted whole-file in Phase 2 (CUT-07)
> - `cli/NOTICE` — license attribution text
> - `.gitignore` / `cli/.gitignore` — if any `*.claude*` patterns survive, they document historical artifacts on disk
> - `docs/`, `website/` — Phase 12 (CUT-12) owns these
> - `node_modules/`, `dist/`, `bun.lock`, `.git/` — generated / vendor / history

### Implementation (Plan owns final form — recommendation: shell script run from `bun run test`)
```bash
#!/usr/bin/env bash
# scripts/check-no-cut-agents.sh
set -euo pipefail
PATTERN='\b(claude|codex|gemini|opencode)\b'
WHITELIST=(
  --glob '!.planning/codebase/**'
  --glob '!CHANGELOG.md'
  --glob '!shared/src/flavors.ts'
  --glob '!shared/src/flavors.test.ts'
  --glob '!shared/src/modes.ts'
  --glob '!shared/src/resume.ts'
  --glob '!shared/src/voice.ts'
  --glob '!cli/NOTICE'
  --glob '!**/.gitignore'
  --glob '!docs/**'
  --glob '!website/**'
  --glob '!node_modules/**'
  --glob '!dist/**'
  --glob '!bun.lock'
  --glob '!.git/**'
  --glob '!scripts/check-no-cut-agents.sh'
)
if rg -i "${WHITELIST[@]}" "$PATTERN" .; then
  echo "❌ Non-Cursor agent literals found outside whitelist."
  exit 1
fi
echo "✅ No non-Cursor agent literals."
```

**Integration point recommendation:** add a root `test:guard` script in `package.json` and call it from `bun run test` (root script chains `test:cli && test:hub && test:web` — append `&& bun run test:guard`). Simplest, no GitHub Actions changes needed; CI runs `bun run test` already.

Exit semantics: `rg` returns 1 when no matches found → invert via `if rg ...; then exit 1`. (Standard pattern.)

## Runtime State Inventory (rename / refactor concerns)

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | Per-flavor `*SessionId` fields in SQLite session metadata blobs ("claudeSessionId", "codexSessionId", "geminiSessionId", "opencodeSessionId"). After schema field removal, **existing rows on disk will still carry these JSON keys** but reads will ignore them (TypeScript will reject unknown fields only if `strict` — Hub's SessionCache uses `Session` type from `@hapi/protocol/types`). No migration needed; old keys become dead data. Per AGENTS.md "No backward compatibility": accept stale rows; they'll be overwritten on next session write. | None — silent drop |
| Live service config | None. CLI/Hub configuration files (`~/.happy/`) carry session-id fields but those will be re-written by new code. | None |
| OS-registered state | None (no Task Scheduler / systemd / launchd entries reference flavor names). | None |
| Secrets/env vars | None (`HAPI_*` env vars are flavor-agnostic; `CLAUDE_*` / `CODEX_*` env vars are read only by deleted code paths — they become inert). | None |
| Build artifacts / installed packages | `node_modules/` will be stale after `package.json` deps unchange (no deps changed); `bun install` regenerates `bun.lock` cleanly. No per-flavor compiled artifacts (CLI uses `bun build --target node` per `cli/scripts/build-executable.ts`; no agent-specific binaries embedded except via `cli/src/runtime/embeddedAssets.bun.ts` — verify in plan whether embedded assets reference deleted dirs). | Run `bun install` in cleanup commit; verify `bun.lock` diff is small (no direct dep removals) |

## Common Pitfalls

### Pitfall 1: Breaking imports in `cli/src/agent/runners/runAgentSession.ts` before deleting it
**What goes wrong:** CUT-01 deletes `@/claude/utils/startHappyServer` and `@/claude/registerKillSessionHandler`. `runAgentSession.ts` still imports them. typecheck fails on CUT-01 commit.
**Prevention:** Delete `runAgentSession.ts` + `.test.ts` **in CUT-01** (moved up from CUT-03 per dependency analysis).

### Pitfall 2: `AGENT_MESSAGE_PAYLOAD_TYPE = 'codex'` looks like a flavor literal but is wire-level
**What goes wrong:** Naive ripgrep cleanup removes the constant's value `'codex'` thinking it's a Codex reference; breaks wire compat with web normalizer + hub teams + cli apiSession.
**Prevention:** Whitelist `shared/src/modes.ts`; teach contributors that this constant is the wire payload tag, not a flavor selector. Replace all bare string literals `'codex'` in business code (e.g. `hub/src/sync/todos.ts`) with imports of `AGENT_MESSAGE_PAYLOAD_TYPE` so the constant is the single source.

### Pitfall 3: `web/src/lib/assistant-runtime.test.ts` model fixtures
**What goes wrong:** Fixtures use real Anthropic model names (`'claude-sonnet-4-6'`, `'claude-haiku-4-5-20251001'`) — these strings ARE flavor literals from ripgrep's POV. Tests are model-dedup tests, not flavor tests.
**Prevention:** Rewrite fixtures to flavor-neutral model names (e.g. `'sonnet'`, `'haiku'`, `'composer'`). Per D-06.

### Pitfall 4: Schema field deletion strands old SQLite rows
**What goes wrong:** Removing `claudeSessionId` from the Zod schema would reject any session metadata blob that still has the key.
**Prevention:** Zod schemas use `.optional()` already (verified in schemas.ts:36). Adding unknown keys to an object schema is allowed by default in Zod 4 (`passthrough` not needed). Per AGENTS.md "no backward compat" — but technically nothing breaks here either.

### Pitfall 5: `cli/src/agent/AgentRegistry.ts` deletion may strand `types.ts`
**What goes wrong:** AgentRegistry imports `AgentBackend, AgentBackendFactory` from `cli/src/agent/types.ts`. After ACP backend + AgentRegistry deletion, `types.ts` becomes dead but might be re-exported by `lib.ts` or imported by surprise.
**Prevention:** Run `rg "from '@/agent/types'" cli/src/` before deletion; expect zero hits after CUT-03 cleanup.

### Pitfall 6: Vitest tests inside deleted dirs may have shared snapshot files
**What goes wrong:** `vitest` `__snapshots__/` folders elsewhere in the tree may snapshot output that references deleted modules.
**Prevention:** Run `bun run test -u` (update) once after each CUT commit, OR `find . -name '__snapshots__' -type d | xargs grep -l 'claude\|codex\|gemini\|opencode'` to surface stragglers.

## Code Examples

No new code introduced. The only "code template" is the ripgrep guard script shown above.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ^4.0.16 (per-workspace) |
| Config | `cli/vitest.config.ts`, `hub/vitest.config.ts`, `web/vitest.config.ts` (existing) |
| Quick run command | `bun run test` (root — chains cli/hub/web sequentially) |
| Full suite command | `bun run typecheck && bun run test` |
| Phase guard command | `bun run test:guard` (new — runs ripgrep script) |

### Phase Requirements → Test Map (matches Phase 1 SC#1..#5)

| SC | Behavior | Test Type | Automated Command | File Exists? |
|----|----------|-----------|-------------------|--------------|
| SC#1 | `bun typecheck` + `bun run test` green after each commit | smoke | `bun typecheck && bun run test` | ✅ existing |
| SC#2 | ripgrep zero hits outside whitelist | guard | `bun run test:guard` (= `bash scripts/check-no-cut-agents.sh`) | ❌ **Wave 0** — create script |
| SC#3 | `registry.ts` has no `{claude,codex,gemini,opencode}Command` references; default → cursor | unit-or-grep | `! rg 'claudeCommand\|codexCommand\|geminiCommand\|opencodeCommand' cli/src/commands/registry.ts` AND `rg 'cursorCommand' cli/src/commands/registry.ts` | covered by SC#2 guard |
| SC#4 | `codex-pr-review.yml` + `codex-mention-response.yml` + `cli/src/commands/hookForwarder.ts` + `cli/src/codex/happyMcpStdioBridge.ts` all absent | file-existence | `[[ ! -f .github/workflows/codex-pr-review.yml ]] && [[ ! -f .github/workflows/codex-mention-response.yml ]] && [[ ! -f cli/src/commands/hookForwarder.ts ]] && [[ ! -f cli/src/codex/happyMcpStdioBridge.ts ]]` | optional — covered by `bun typecheck` |
| SC#5 | No `@anthropic-ai/*` or vendor SDK in any `package.json`; `bun.lock` regenerated cleanly | grep + bun install | `! rg '@anthropic-ai\|@openai\|@google/(gen\|gemini)\|opencode-ai\|@zed-industries' **/package.json && bun install --frozen-lockfile` | ✅ vacuously true at start; add to guard |

### Sampling Rate
- **Per task commit (within a CUT):** `cd <workspace> && bun run typecheck && bun run test` (fast iteration)
- **Per CUT commit (D-15):** root `bun typecheck && bun run test && bun run test:guard`
- **Phase gate:** all 5 commits green + `bun install --frozen-lockfile` succeeds

### Wave 0 Gaps
- [ ] `scripts/check-no-cut-agents.sh` — ripgrep guard (created in cleanup commit #5; or earlier with allow-whitelist that shrinks per CUT)
- [ ] Root `package.json` — add `"test:guard"` script and chain into `"test"`
- [ ] No new test files (D-07: no new tests this phase)

## Security Domain

This phase is **pure deletion** with no new code paths and no new attack surface. ASVS verification deferred to Phase 12 (VRFY-02 / VRFY-03). For Phase 1 specifically:

- **V5 Input Validation:** Zod schemas in `shared/src/schemas.ts` lose 4 optional fields. No validation surface changes.
- **V6 Cryptography / V7 Errors:** No changes (vendored Claude SDK had no crypto).
- **V12 Files & Resources:** `cli/src/opencode/utils/opencodeStorageScanner.ts` (912 lines) is deleted whole — removes a filesystem-walking attack surface.

No new threats introduced. No mitigations need adding.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `AgentRegistry` has no callers outside `runAgentSession.ts` after CUT-03 | §"shared-abstraction map" | If a non-grepped consumer exists, deletion breaks typecheck — caught by per-commit `bun typecheck` |
| A2 | `cli/src/agent/permissionAdapter.ts` is consumed only by `runAgentSession.ts` (not by Cursor path) | §"CUT-03 deletion map" | Need to verify in Wave 0 — if Cursor uses it, keep |
| A3 | Renaming `extractTodosFromCodexMessage` → `extractTodosFromAgentMessage` does not break wire compat | §"CUT-02 deletion map" | Wire payload `type: 'codex'` is unchanged; only internal symbol renamed — safe |
| A4 | Old SQLite rows with stale `*SessionId` keys are accepted by Zod (passthrough) | §"Runtime State Inventory" | If Zod schemas are `.strict()`, old rows error — verify in Wave 0 |
| A5 | `bun install` regenerates `bun.lock` cleanly with no direct dep deltas (none exist to remove) | §"Standard Stack" | If transitive deps shake meaningfully, the lockfile diff balloons — cosmetic only |
| A6 | `web/src/realtime/realtimeClientTools.ts` hits (2) are inside the directory Phase 2 deletes | §"Business-consumer rewrite map" | Verify file path in plan; if outside `web/src/realtime/`, handle in Phase 1 |
| A7 | `.github/workflows/issue-auto-response.yml`'s 2 hits are descriptive text (not active agent automation) | §"Business-consumer rewrite map" | If active automation, may need workflow logic edit — inspect in plan |

## Open Questions (RESOLVED in Wave 0)

> **Resolution:** Q1, Q2, and Q3 are all resolved by Wave 0 tasks inside `01-01-PLAN.md` Task 0. Findings are recorded in `.planning/phases/01-cut-non-cursor-agents/01-WAVE0-FINDINGS.md` with one row per inspected file (`path | category | hit count | action | belongs to commit`). The findings drive subsequent task decisions in 01-02..04 (notably: permissionAdapter keep-vs-delete in 01-03 Task 2; loopBase/sessionBase categorization across the appropriate CUT commits; per-flavor binary references in build-executable.ts handled in 01-01 if any). The questions below are kept for traceability — operative answers live in the findings file.

1. **Does `cli/src/cursor/*` import from `cli/src/agent/permissionAdapter.ts`?**
   - What we know: only `runAgentSession.ts` (ACP-path) imports it via grep
   - What's unclear: indirect imports via shared `loopBase.ts` / `sessionBase.ts`
   - Recommendation: planner runs `rg "permissionAdapter\|PermissionAdapter" cli/src/cursor/ cli/src/agent/loopBase.ts cli/src/agent/sessionBase.ts` as Wave 0 step; outcome decides keep-vs-delete

2. **`cli/src/agent/loopBase.ts` + `sessionBase.ts` flavor coupling?**
   - What we know: CONTEXT.md lists them as "shared abstractions to preserve"
   - What's unclear: their actual flavor literal content (not yet fully read)
   - Recommendation: planner reads both files in Wave 0; classifies any flavor literals into (a)/(b)/(c)/(d)

3. **`cli/src/runtime/embeddedAssets.bun.ts` — does it bundle per-flavor binaries or configs?**
   - What we know: imports referenced from `cli/scripts/build-executable.ts`; build script step `tools:unpack` runs before tests
   - What's unclear: whether unpacked tools reference deleted dirs
   - Recommendation: planner inspects `cli/scripts/build-executable.ts` + the asset bundling pipeline in Wave 0

## Hidden Landmines

1. **`runAgentSession.ts` imports from `cli/src/claude/`** — typecheck breaks CUT-01 unless moved/deleted with CUT-01 (covered above).
2. **`AGENT_MESSAGE_PAYLOAD_TYPE = 'codex'` is wire-level, not flavor-level** — must be imported as constant everywhere, not duplicated as bare string `'codex'` (covered above).
3. **`web/src/lib/assistant-runtime.test.ts`** has 56 hits all from real Anthropic model name strings (`'claude-sonnet-4-6'`) — not flavor literals but will trip ripgrep. Rewrite fixtures (covered above).
4. **`hub/package.json` description string** mentions "Claude Code" — single-line touch in CUT-01; Phase 2 also touches it for "Telegram Bot client" wording.
5. **`cli/README.md` line 33** mentions `hapi gemini` + `runAgentSession.ts` path — Phase 12 owns README cleanup, but the ripgrep guard will hit it. **Add `cli/README.md` to whitelist? No — Phase 12 will clean. Recommendation: add `*/README.md` to Phase-1-only whitelist with explicit "Phase 12 owns".** *(Or aggressively touch the file in cleanup commit #5 to strip the bullet — 2 lines, low risk.)* The plan should choose; recommendation: **touch in #5**.
6. **`scripts/dev/seed-codex-web-fixture.ts` imports from `hub/src/store`** — verify CUT-02 deletion doesn't break any other dev script.
7. **`cli/src/codex/utils/codexEventConverter.ts:13`** defines its own local `CodexMessage` type (unrelated to `cli/src/agent/messageConverter.ts`'s same-named type) — deleted with parent dir, no rename collision.
8. **Telegram-related code in `hub/`** is Phase 2 territory but appears alongside Claude in `hub/package.json` description and `hub/src/telegram/` — leave alone in Phase 1.
9. **Resume / session persistence formats** — `shared/src/resume.ts` `AgentFlavorSchema` accepts all 5 literals; whitelisted. Per-flavor session-id fields in stored sessions become stale data; per AGENTS.md "no backward compat" → accept silent drop on read.
10. **Vendored binaries in `cli/scripts/unpack-tools.ts`** — `bun run tools:unpack` runs before `vitest`. Verify the unpack manifest doesn't reference deleted dirs.
11. **SOPS / secrets** — no flavor-named secret keys exist in the repo (grep'd `.env*` and `secrets/` — none flavor-tagged).

## 5-commit precondition order (D-14 / D-15)

| # | Commit | Files Touched (high-level) | Post-commit invariant | Cross-commit constraint |
|---|--------|---------------------------|----------------------|------------------------|
| 1 | `feat(phase-01): CUT-01 remove Claude Code agent` | Delete `cli/src/claude/`, `cli/src/commands/{claude,hookForwarder}.ts`, **`cli/src/agent/runners/runAgentSession.ts` + `.test.ts`** (moved up — see Pitfall 1); strip Claude branches from sessionFactory.ts, syncEngine.ts (recover* methods), sessionCache.ts (picker), schemas.ts (claudeSessionId), models.ts (Claude tables), messages.ts (visibility), web sessionModelLabel.ts; rewrite assistant-runtime.test.ts model fixtures; strip Claude fixtures from cross-flavor tests; `hub/package.json` description | `bun typecheck` + `bun run test` green; ripgrep `claude` hits only in cleanup-leftover whitelisted files + still-pending CUT-02/03/04 references | No predecessor |
| 2 | `feat(phase-01): CUT-02 remove Codex agent` | Delete `cli/src/codex/`, `cli/src/commands/codex.{ts,test.ts}`, `.github/workflows/codex-*.yml`, `scripts/dev/{self-test-codex-web-env.sh,seed-codex-web-fixture.ts}`, delete codex routes in hub (sessions.ts, machines.ts), delete RPC methods (rpcGateway.ts, syncEngine.ts), drop CodexCollaborationMode from socket handlers + sessionCache + socket.ts; rename `CodexMessage` type → `AgentWireMessage` in messageConverter.ts; update cursorRemoteLauncher.ts local var; rename `extractTodosFromCodexMessage` in todos.ts; delete codexSessionId schema field; strip Codex StatusBar bits; strip codex fixtures from sessionModel.test.ts + aliveEvents.test.ts + cli.test.ts + pushNotificationChannel.test.ts | `bun typecheck` + `bun run test` green | Depends on #1 only via the optional runAgentSession deletion location; otherwise independent |
| 3 | `feat(phase-01): CUT-03 remove Gemini agent + ACP backend` | Delete `cli/src/gemini/`, `cli/src/agent/backends/`, `cli/src/commands/gemini.ts`, **`cli/src/agent/{AgentRegistry.ts,types.ts,rateLimitParser.{ts,test.ts},internalEventFilter.{ts,test.ts}}`** (dead after backends gone); drop `permissionAdapter.{ts,test.ts}` if not used by Cursor (verify in Wave 0); strip Gemini branches in hub routes + syncEngine + rpcGateway; delete geminiSessionId schema field + Gemini model tables in shared/models.ts; strip Gemini fixtures; ToolCard PermissionFooter `startsWith('Gemini')` arm | `bun typecheck` + `bun run test` green | Depends on #1 (runAgentSession already gone) |
| 4 | `feat(phase-01): CUT-04 remove OpenCode agent` | Delete `cli/src/opencode/`, `cli/src/commands/opencode.ts`, strip OpenCode hub routes + RPC + syncEngine branches + opencodeSessionId schema field; strip OpenCode StatusBar / SessionList / PermissionFooter arms; strip opencode test fixtures | `bun typecheck` + `bun run test` green | Independent of #2, #3 |
| 5 | `chore(phase-01): final cleanup + ripgrep guard` | Rewrite `cli/src/commands/registry.ts` per D-09/D-10 (remove deleted command imports + entries; fallback → `cursorCommand`); add `scripts/check-no-cut-agents.sh` + root `test:guard` script; chain into `bun run test`; rename `web/src/lib/codexSlashCommands.ts` → `agentSlashCommands.ts` + update imports; strip Claude/Codex/Gemini/OpenCode bullet from `cli/README.md` line 33 (Phase-12 will polish further); clean comments in `cli/src/agent/{utils.ts,internalEventFilter.ts}` (if still present), `hub/src/sync/teams.ts`; sweep any residual hits surfaced by guard; `bun install` to refresh `bun.lock`; one final `bun typecheck && bun run test && bun run test:guard` | All 5 phase SCs green; ripgrep guard finds zero hits outside whitelist | Must be last — depends on #1..#4 |

**Ordering verdict:**
- CUT-01..04 are **mostly independent** in their *deletion* scope.
- The one hard ordering constraint is: **`cli/src/agent/runners/runAgentSession.ts` must be deleted in CUT-01** (because it imports from `cli/src/claude/` which CUT-01 deletes). If left for CUT-03, CUT-01's commit fails typecheck. This contradicts CONTEXT.md line 118's "preserved shared abstractions" listing — but D-04 explicitly allows this borrowing.
- The `cli/src/agent/{AgentRegistry,types,rateLimitParser,internalEventFilter,permissionAdapter}` files are deletable **only after** ACP backend is gone (CUT-03). Hence they group into CUT-03.
- The cleanup commit (#5) is gated on all four CUTs landing so the guard script's whitelist is final.

## State of the Art

Not applicable — this is a deletion phase. No tooling churn expected.

## Sources

### Primary (HIGH confidence)
- Repo grep + file reads (2026-05-20): `cli/src/`, `hub/src/`, `web/src/`, `shared/src/`, `.github/workflows/`, all `package.json` files, `bun.lock` presence verified
- `.planning/phases/01-cut-non-cursor-agents/01-CONTEXT.md` (D-01..D-15)
- `.planning/REQUIREMENTS.md` (CUT-01..CUT-04 wording)
- `.planning/ROADMAP.md` (Phase 1 SC#1..SC#5, Phase 5/6/12 boundaries)
- `.planning/codebase/CONCERNS.md` (line 35 confirms `runAgentSession.ts` is in the technical-debt orbit)
- `AGENTS.md` ("No backward compatibility", Bun workspaces, 4-space, Vitest conventions)

### Secondary (MEDIUM confidence)
- None — all findings verified against live tree.

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- Deletion map (CUT-01..04 source dirs/files): **HIGH** — directly enumerated from `ls` + cross-referenced with CONTEXT.md
- Consumer rewrite map: **HIGH** for the headline files (registry.ts, schemas.ts, syncEngine.ts, sessionFactory.ts, modes.ts); **MEDIUM** for the long tail of web/src/chat/ files (per-file grep counts confirmed; per-file fix categorization will be sharpened by planner)
- ripgrep guard script: **HIGH** — pattern + whitelist verified against actual hits
- `runAgentSession` dead-code argument: **HIGH** — sole consumer is its own test + ACP-only invocation path
- 5-commit ordering: **HIGH** — only one cross-commit constraint identified (runAgentSession in CUT-01)
- Assumptions A1..A7: flagged for Wave 0 verification

**Research date:** 2026-05-20
**Valid until:** 30 days (stable deletion target; no library churn risk)

## RESEARCH COMPLETE

**Phase:** 1 - Cut non-Cursor agents
**Confidence:** HIGH

### Key Findings
- No `@anthropic-ai/*` or vendor SDK packages exist; SC#5 vacuously satisfied at start (cleanup still runs `bun install` to refresh `bun.lock`).
- `AgentFlavor` union lives in `shared/src/modes.ts:38` (not `flavors.ts`). Whitelist MUST expand to `shared/src/{modes.ts, resume.ts, voice.ts}` in addition to D-12's `flavors.ts`.
- `cli/src/agent/{runners/runAgentSession,AgentRegistry,types,rateLimitParser,internalEventFilter}` become dead after CUT-01..03; `permissionAdapter.{ts,test.ts}` is conditionally dead (Wave 0 verifies Cursor coupling).
- `AGENT_MESSAGE_PAYLOAD_TYPE = 'codex'` is wire-level, not flavor-level — whitelist `shared/src/modes.ts` (do NOT rename the value in Phase 1).
- `runAgentSession.ts` must be deleted in **CUT-01** (not CUT-03) because it imports from `cli/src/claude/`. This is the only cross-commit ordering constraint.
- 5 commits land in order CUT-01 → CUT-02 → CUT-03 → CUT-04 → cleanup; each green on `bun typecheck && bun run test`; cleanup adds the ripgrep guard chained into `bun run test`.

### File Created
`.planning/phases/01-cut-non-cursor-agents/01-RESEARCH.md`

### Confidence Assessment
| Area | Level | Reason |
|------|-------|--------|
| Deletion source map | HIGH | Direct file-system enumeration + CONTEXT cross-reference |
| Consumer rewrite map | HIGH (headline) / MEDIUM (long tail) | Grep counts verified; per-file category will be sharpened during planning |
| ripgrep guard | HIGH | Pattern + whitelist tested against actual hits |
| Commit ordering | HIGH | Only one cross-commit constraint identified |
| Hidden landmines | MEDIUM | Surfaced 11 — long-tail items remain (A1..A7) for Wave 0 |

### Open Questions
- `cli/src/agent/permissionAdapter.ts` Cursor coupling — Wave 0
- `cli/src/agent/{loopBase,sessionBase}.ts` flavor-literal content — Wave 0
- `cli/src/runtime/embeddedAssets.bun.ts` + `cli/scripts/build-executable.ts` references to deleted dirs — Wave 0

### Ready for Planning
Research complete. Planner can now create PLAN.md with 5 atomic commits per D-14.
