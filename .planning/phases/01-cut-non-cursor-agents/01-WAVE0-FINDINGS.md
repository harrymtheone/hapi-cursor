# Phase 1 / CUT-01 / Wave 0 Findings

**Generated:** 2026-05-20
**Source-of-truth ownership ledger for Phase 1 deletion + consumer-rewrite work.**

## HEAD inventory

Output of `rg -l -e '\b(claude|codex|gemini|opencode)\b'` excluding the four runtime dirs, permanent whitelist roots, and infra noise. **102 files.**

| path | hit count | dominant flavor(s) | category | proposed owner-commit |
|------|-----------|--------------------|----------|------------------------|
| AGENTS.md | 3 | claude,codex,gemini | a/b | 01-05-cleanup |
| cli/README.md | 11 | codex,claude,opencode,gemini | a/b | 01-05-cleanup |
| cli/src/agent/runners/runAgentSession.test.ts | 2 | claude | deleted | CUT-01 |
| cli/src/agent/runners/runAgentSession.ts | 2 | claude | deleted | CUT-01 |
| cli/src/agent/sessionFactory.test.ts | 16 | codex,claude,gemini,opencode | a/b | 01-05-cleanup |
| cli/src/api/apiMachine.ts | 1 | opencode | a/b | CUT-04 |
| cli/src/api/apiSession.ts | 1 | claude | a/b | CUT-01 |
| cli/src/api/types.ts | 1 | claude | a/b | CUT-01 |
| cli/src/commands/claude.ts | 10 | claude,codex,gemini,opencode | deleted | CUT-01 |
| cli/src/commands/codex.test.ts | 4 | codex | deleted | CUT-02 |
| cli/src/commands/codex.ts | 4 | codex | deleted | CUT-02 |
| cli/src/commands/gemini.ts | 2 | gemini | deleted | CUT-03 |
| cli/src/commands/hookForwarder.ts | 1 | claude | deleted | CUT-01 |
| cli/src/commands/mcp.ts | 1 | codex | a/b | CUT-02 |
| cli/src/commands/opencode.ts | 2 | opencode | deleted | CUT-04 |
| cli/src/commands/registry.ts | 4 | claude,codex,gemini,opencode | a/b | 01-05-cleanup |
| cli/src/commands/resume.test.ts | 10 | codex,claude | a/b | 01-05-cleanup |
| cli/src/commands/resume.ts | 10 | codex,claude,gemini,opencode | a/b | 01-05-cleanup |
| cli/src/cursor/runCursor.ts | 1 | claude | a/b | CUT-01 |
| cli/src/lib.ts | 1 | claude | a/b | CUT-01 |
| cli/src/modules/common/codexModels.ts | 2 | codex | a/b | CUT-02 |
| cli/src/modules/common/opencodeModels.test.ts | 7 | opencode | a/b | CUT-04 |
| cli/src/modules/common/opencodeModels.ts | 4 | opencode | a/b | CUT-04 |
| cli/src/modules/common/rpcTypes.ts | 1 | claude,codex,gemini,opencode | a/b | 01-05-cleanup |
| cli/src/modules/common/skills.test.ts | 20 | claude,codex | a/b | 01-05-cleanup |
| cli/src/modules/common/skills.ts | 6 | codex,claude | a/b | 01-05-cleanup |
| cli/src/modules/common/slashCommands.test.ts | 24 | codex,claude | a/b | 01-05-cleanup |
| cli/src/modules/common/slashCommands.ts | 17 | claude,codex,gemini,opencode | a/b | 01-05-cleanup |
| cli/src/runner/buildCliArgs.test.ts | 8 | claude,opencode,gemini | a/b | 01-05-cleanup |
| cli/src/runner/README.md | 5 | codex,claude,gemini,opencode | a/b | 01-05-cleanup |
| cli/src/runner/run.ts | 15 | codex,claude,gemini,opencode | a/b | 01-05-cleanup |
| cli/src/ui/logger.ts | 2 | claude | a/b | CUT-01 |
| cli/src/ui/messageFormatterInk.ts | 1 | claude | a/b | CUT-01 |
| hub/src/push/pushNotificationChannel.test.ts | 1 | codex | a/b | CUT-02 |
| hub/src/sync/aliveEvents.test.ts | 5 | codex | a/b | CUT-02 |
| hub/src/sync/rpcGateway.ts | 1 | claude,codex,gemini,opencode | a/b | 01-05-cleanup |
| hub/src/sync/sessionModel.test.ts | 68 | codex,claude | a/b | 01-05-cleanup |
| hub/src/sync/syncEngine.ts | 6 | codex,gemini,opencode,claude | a/b | 01-05-cleanup |
| hub/src/sync/teams.ts | 1 | codex | a/b | CUT-02 |
| hub/src/sync/todos.ts | 2 | codex | a/b | CUT-02 |
| hub/src/web/routes/cli.test.ts | 6 | codex,claude | a/b | 01-05-cleanup |
| hub/src/web/routes/machines.test.ts | 4 | opencode,codex | a/b | CUT-04 |
| hub/src/web/routes/machines.ts | 3 | codex,opencode,claude,gemini | a/b | 01-05-cleanup |
| hub/src/web/routes/permissions.ts | 1 | claude | a/b | CUT-01 |
| hub/src/web/routes/sessions.test.ts | 19 | claude,opencode,codex,gemini | a/b | 01-05-cleanup |
| hub/src/web/routes/sessions.ts | 18 | claude,codex,opencode | a/b | 01-05-cleanup |
| README.md | 1 | claude | a/b | CUT-01 |
| refactor.md | 5 | claude,codex,opencode,gemini | a/b | 01-05-cleanup |
| scripts/dev/seed-codex-web-fixture.ts | 10 | codex | deleted | CUT-02 |
| scripts/dev/self-test-codex-web-env.sh | 3 | codex | deleted | CUT-02 |
| shared/src/models.ts | 6 | gemini | a/b | CUT-03 |
| shared/src/resume.test.ts | 3 | codex,claude | a/b | 01-05-cleanup |
| web/README.md | 1 | claude,codex,gemini | a/b | 01-05-cleanup |
| web/src/api/client.ts | 5 | codex,opencode,claude,gemini | a/b | 01-05-cleanup |
| web/src/chat/modelConfig.test.ts | 4 | claude,codex,gemini | a/b | 01-05-cleanup |
| web/src/chat/modelConfig.ts | 3 | claude,codex | a/b | 01-05-cleanup |
| web/src/chat/normalizeAgent.ts | 5 | codex | a/b | CUT-02 |
| web/src/chat/normalize.test.ts | 14 | codex | a/b | CUT-02 |
| web/src/chat/reconcile.ts | 1 | codex | a/b | CUT-02 |
| web/src/chat/reducerCliOutput.test.ts | 2 | claude | a/b | CUT-01 |
| web/src/chat/reducer.test.ts | 1 | codex | a/b | CUT-02 |
| web/src/chat/reducerTimeline.test.ts | 19 | codex,claude,gemini | a/b | 01-05-cleanup |
| web/src/chat/reducerTimeline.ts | 6 | codex | a/b | CUT-02 |
| web/src/chat/toolGroups.test.ts | 3 | codex | a/b | CUT-02 |
| web/src/chat/types.ts | 2 | codex | a/b | CUT-02 |
| web/src/components/AssistantChat/claudeModelOptions.test.ts | 3 | claude | a/b | CUT-01 |
| web/src/components/AssistantChat/HappyComposer.tsx | 2 | codex | a/b | CUT-02 |
| web/src/components/AssistantChat/messages/AssistantMessage.tsx | 1 | codex | a/b | CUT-02 |
| web/src/components/AssistantChat/messages/MessageMetadata.test.ts | 12 | claude | a/b | CUT-01 |
| web/src/components/AssistantChat/modelOptions.test.ts | 27 | opencode,gemini,claude,codex | a/b | 01-05-cleanup |
| web/src/components/AssistantChat/modelOptions.ts | 5 | gemini,opencode | a/b | 01-05-cleanup |
| web/src/components/AssistantChat/StatusBar.tsx | 4 | codex | a/b | CUT-02 |
| web/src/components/NewSession/AgentSelector.tsx | 1 | claude,codex,gemini,opencode | a/b | 01-05-cleanup |
| web/src/components/NewSession/ClaudeEffortSelector.tsx | 1 | claude | a/b | CUT-01 |
| web/src/components/NewSession/index.tsx | 11 | codex,opencode,claude | a/b | 01-05-cleanup |
| web/src/components/NewSession/OpencodeModelSelector.tsx | 4 | opencode | a/b | CUT-04 |
| web/src/components/NewSession/opencodeModelsGate.test.ts | 4 | opencode,claude | a/b | CUT-04 |
| web/src/components/NewSession/opencodeModelsGate.ts | 2 | opencode | a/b | CUT-04 |
| web/src/components/NewSession/preferences.test.ts | 6 | claude,codex,gemini | a/b | 01-05-cleanup |
| web/src/components/NewSession/preferences.ts | 2 | claude,codex,gemini,opencode | a/b | 01-05-cleanup |
| web/src/components/NewSession/ReasoningEffortSelector.tsx | 1 | codex | a/b | CUT-02 |
| web/src/components/NewSession/types.test.ts | 1 | claude | a/b | CUT-01 |
| web/src/components/NewSession/types.ts | 5 | claude,codex,gemini,opencode | a/b | 01-05-cleanup |
| web/src/components/SessionChat.tsx | 10 | codex,opencode | a/b | 01-05-cleanup |
| web/src/components/SessionList.directory-action.test.tsx | 1 | codex | a/b | CUT-02 |
| web/src/components/SessionList.test.ts | 1 | codex | a/b | CUT-02 |
| web/src/components/SessionList.tsx | 5 | claude,codex,gemini,opencode | a/b | 01-05-cleanup |
| web/src/components/ToolCard/PermissionFooter.tsx | 7 | codex | a/b | CUT-02 |
| web/src/components/ToolCard/views/_results.tsx | 1 | codex | a/b | CUT-02 |
| web/src/hooks/mutations/useSessionActions.ts | 2 | codex | a/b | CUT-02 |
| web/src/hooks/mutations/useSpawnSession.ts | 1 | claude,codex,gemini,opencode | a/b | 01-05-cleanup |
| web/src/hooks/queries/useOpencodeModelsForCwd.ts | 1 | opencode | a/b | CUT-04 |
| web/src/hooks/queries/useOpencodeModels.ts | 1 | opencode | a/b | CUT-04 |
| web/src/hooks/queries/useSlashCommands.ts | 1 | claude | a/b | CUT-01 |
| web/src/lib/assistant-runtime.test.ts | 48 | claude | a/b | CUT-01 |
| web/src/lib/assistant-runtime.ts | 7 | claude,codex | a/b | 01-05-cleanup |
| web/src/lib/codexSlashCommands.test.ts | 4 | codex | a/b | CUT-02 |
| web/src/lib/codexSlashCommands.ts | 5 | claude,codex,gemini,opencode | a/b | 01-05-cleanup |
| web/src/lib/message-window-store.test.ts | 2 | codex | a/b | CUT-02 |
| web/src/lib/message-window-store.ts | 1 | codex | a/b | CUT-02 |
| web/src/lib/query-keys.ts | 4 | codex,opencode | a/b | 01-05-cleanup |
| web/src/router.tsx | 1 | claude | a/b | CUT-01 |

## Runtime-dir inventory

Files inside `cli/src/{claude,codex,gemini,opencode}/` and `cli/src/agent/backends/` — blanket TEMP-CUT-XX coverage applies, no per-file TEMP-WIDE entries needed.

```
cli/src/agent/backends/acp/AcpMessageHandler.test.ts
cli/src/agent/backends/acp/AcpMessageHandler.ts
cli/src/agent/backends/acp/AcpSdkBackend.test.ts
cli/src/agent/backends/acp/AcpSdkBackend.ts
cli/src/agent/backends/acp/AcpStdioTransport.ts
cli/src/agent/backends/acp/__fixtures__/gemini-3.1-pro-preview-edit-file.json
cli/src/agent/backends/acp/__fixtures__/gemini-3.1-pro-preview-read-file.json
cli/src/agent/backends/acp/__fixtures__/gemini-3.1-pro-preview-run-shell.json
cli/src/agent/backends/acp/__fixtures__/gemini-3.1-pro-preview-write-file.json
cli/src/agent/backends/acp/__fixtures__/gemini-3-flash-preview-edit-file.json
cli/src/agent/backends/acp/__fixtures__/gemini-3-flash-preview-read-file.json
cli/src/agent/backends/acp/__fixtures__/gemini-3-flash-preview-run-shell.json
cli/src/agent/backends/acp/__fixtures__/gemini-3-flash-preview-write-file.json
cli/src/claude/claudeLocal.ts
cli/src/claude/claudeRemote.seam.test.ts
cli/src/claude/claudeRemote.test.ts
cli/src/claude/claudeRemote.ts
cli/src/claude/loop.test.ts
cli/src/claude/model.test.ts
cli/src/claude/runClaude.ts
cli/src/claude/sdk/query.test.ts
cli/src/claude/sdk/query.ts
cli/src/claude/sdk/utils.ts
cli/src/claude/types.test.ts
cli/src/claude/utils/chatVisibility.ts
cli/src/claude/utils/claudeSettings.test.ts
cli/src/claude/utils/claudeSettings.ts
cli/src/claude/utils/__fixtures__/0-say-lol-session.jsonl
cli/src/claude/utils/__fixtures__/1-continue-run-ls-tool.jsonl
cli/src/claude/utils/path.test.ts
cli/src/claude/utils/path.ts
cli/src/claude/utils/permissionHandler.ts
cli/src/claude/utils/sdkToLogConverter.test.ts
cli/src/claude/utils/sdkToLogConverter.ts
cli/src/claude/utils/startHappyServer.ts
cli/src/codex/codexAppServerClient.ts
cli/src/codex/codexLocalLauncher.test.ts
cli/src/codex/codexLocalLauncher.ts
cli/src/codex/codexLocal.test.ts
cli/src/codex/codexLocal.ts
cli/src/codex/codexRemoteLauncher.test.ts
cli/src/codex/codexRemoteLauncher.ts
cli/src/codex/loop.ts
cli/src/codex/runCodex.test.ts
cli/src/codex/runCodex.ts
cli/src/codex/utils/appServerConfig.test.ts
cli/src/codex/utils/appServerConfig.ts
cli/src/codex/utils/appServerEventConverter.test.ts
cli/src/codex/utils/appServerEventConverter.ts
cli/src/codex/utils/buildHapiMcpBridge.ts
cli/src/codex/utils/codexMcpConfig.ts
cli/src/codex/utils/codexSessionScanner.test.ts
cli/src/codex/utils/codexSessionScanner.ts
cli/src/codex/utils/codexVersion.test.ts
cli/src/codex/utils/codexVersion.ts
cli/src/codex/utils/slashCommands.ts
cli/src/gemini/geminiLocalLauncher.ts
cli/src/gemini/geminiLocal.ts
cli/src/gemini/geminiRemoteLauncher.test.ts
cli/src/gemini/geminiRemoteLauncher.ts
cli/src/gemini/loop.ts
cli/src/gemini/runGemini.test.ts
cli/src/gemini/runGemini.ts
cli/src/gemini/utils/config.ts
cli/src/gemini/utils/geminiBackend.ts
cli/src/gemini/utils/sessionScanner.ts
cli/src/opencode/loop.ts
cli/src/opencode/opencodeLocalLauncher.ts
cli/src/opencode/opencodeLocal.ts
cli/src/opencode/opencodeRemoteLauncher.test.ts
cli/src/opencode/opencodeRemoteLauncher.ts
cli/src/opencode/runOpencode.test.ts
cli/src/opencode/runOpencode.ts
cli/src/opencode/utils/hookPlugin.test.ts
cli/src/opencode/utils/hookPlugin.ts
cli/src/opencode/utils/opencodeBackend.ts
cli/src/opencode/utils/opencodeConfig.ts
cli/src/opencode/utils/opencodeStorageScanner.ts
cli/src/opencode/utils/startOpencodeHookServer.test.ts
cli/src/opencode/utils/startOpencodeHookServer.ts
```

Total runtime files: 80.

## Assumption verifications

### A1 — AgentRegistry callers
```
$ rg -n 'AgentRegistry' cli/src/
cli/src/agent/AgentRegistry.ts:3:export class AgentRegistry {
cli/src/agent/runners/runAgentSession.test.ts:37: vi.mock('@/agent/AgentRegistry', ...
cli/src/agent/runners/runAgentSession.ts:5:import { AgentRegistry } from '@/agent/AgentRegistry';
cli/src/agent/runners/runAgentSession.ts:67: AgentRegistry.create(...)
```
**Verdict: A1 CONFIRMED.** Only the definition + `runAgentSession` (consumer, deleted in CUT-01). `AgentRegistry` becomes orphan after CUT-01; full deletion happens in CUT-03 per D-01.

### A2 — permissionAdapter coupling
```
$ rg -n 'permissionAdapter|PermissionAdapter' cli/src/cursor/ cli/src/agent/loopBase.ts cli/src/agent/sessionBase.ts
(no output)
```
**Verdict: A2 CONFIRMED.** Zero hits in Cursor path or in `loopBase`/`sessionBase`. `cli/src/agent/permissionAdapter.{ts,test.ts}` is safe to delete in CUT-03 (consumed only by `runAgentSession` which dies in CUT-01).

### A4 — Zod schema strictness
```
$ rg -n '\.strict\(\)|\.passthrough\(\)' shared/src/resume.ts shared/src/schemas.ts
(no output)
```
**Verdict: A4 CONFIRMED.** No `.strict()` or `.passthrough()` — Zod default object behavior strips unknown keys silently. Removing the 4 `*SessionId` fields is safe; old SQLite rows carrying stale keys will be silently ignored on read.

### Q2 — loopBase.ts / sessionBase.ts flavor coupling
```
$ rg -n "claude|codex|gemini|opencode|flavor" cli/src/agent/loopBase.ts cli/src/agent/sessionBase.ts
(no flavor-literal hits; `flavor` field only appears as a typed string for telemetry)
```
**Verdict: Q2 RESOLVED.** Both files are flavor-neutral. No edits needed in CUT-01..04 for these files.

### Q3 — Build pipeline references to deleted dirs
```
$ rg -n 'claude|codex|gemini|opencode' cli/scripts/build-executable.ts cli/src/runtime/embeddedAssets.bun.ts
(no output)
```
**Verdict: Q3 CONFIRMED.** Neither file references any of the four runtime dirs. The `tools:unpack` pipeline + embedded asset bundling are flavor-agnostic. Safe to delete the runtime dirs without touching build scripts.

## Decisions recorded
- CUT-01-owned files (CUT-01 column in inventory above) handled in Task 2 / Task 2.5 of this plan.
- CUT-02/03/04-owned consumer files are covered by TEMP-WIDE entries in the broad whitelist; their actual rewrites land in 01-02 / 01-03 / 01-04 plans.
- 01-05-cleanup-owned files have broad TEMP-WIDE directory globs in the whitelist; final tightening is the 01-05 cleanup commit.
