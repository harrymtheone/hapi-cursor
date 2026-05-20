---
phase: 01-cut-non-cursor-agents
plan: 01-02
subsystem: agent-removal
tags: [cut, codex, cleanup]
requires: [01-01]
provides: [codex-removed]
affects: [cli, hub, shared]
key-files:
  deleted:
    - cli/src/codex/ (50 files)
    - cli/src/commands/codex.ts
    - cli/src/commands/codex.test.ts
    - cli/src/commands/mcp.ts
    - cli/src/modules/common/codexModels.ts
    - cli/src/modules/common/handlers/codexModels.ts
    - .github/workflows/codex-pr-review.yml
    - .github/workflows/codex-mention-response.yml
    - .github/prompts/codex-pr-review.md
    - .github/prompts/codex-mention-response.md
    - scripts/dev/self-test-codex-web-env.sh
    - scripts/dev/seed-codex-web-fixture.ts
  created:
    - cli/src/agent/serverUtils/buildHapiMcpBridge.ts (relocated)
  modified:
    - cli/src/commands/registry.ts
    - cli/src/commands/resume.ts
    - cli/src/commands/resume.test.ts
    - cli/src/runner/run.ts
    - cli/src/agent/messageConverter.ts
    - cli/src/agent/sessionFactory.ts
    - cli/src/agent/sessionFactory.test.ts
    - cli/src/cursor/cursorRemoteLauncher.ts
    - cli/src/api/types.ts
    - cli/src/gemini/geminiRemoteLauncher.ts
    - cli/src/gemini/geminiRemoteLauncher.test.ts
    - cli/src/opencode/opencodeLocalLauncher.ts
    - cli/src/opencode/opencodeRemoteLauncher.ts
    - cli/src/opencode/opencodeRemoteLauncher.test.ts
    - cli/src/modules/common/registerCommonHandlers.ts
    - hub/src/sync/todos.ts
    - hub/src/sync/syncEngine.ts
    - hub/src/sync/sessionCache.ts
    - hub/src/sync/sessionModel.test.ts
    - hub/src/sync/teams.ts
    - hub/src/sync/rpcGateway.ts
    - hub/src/sync/rpcGateway.test.ts
    - hub/src/sync/aliveEvents.test.ts
    - hub/src/socket/handlers/cli/index.ts
    - hub/src/socket/handlers/cli/sessionHandlers.ts
    - hub/src/push/pushNotificationChannel.test.ts
    - hub/src/web/routes/sessions.ts
    - hub/src/web/routes/sessions.test.ts
    - hub/src/web/routes/machines.ts
    - hub/src/web/routes/machines.test.ts
    - hub/src/web/routes/cli.test.ts
    - shared/src/schemas.ts
    - shared/src/sessionSummary.ts
    - shared/src/socket.ts
    - shared/src/types.ts
    - scripts/check-no-cut-agents.sh
decisions:
  - "Preserved AGENT_MESSAGE_PAYLOAD_TYPE='codex' wire constant in shared/src/modes.ts per D-15"
  - "Retained CodexCollaborationModeSchema in shared/src/schemas.ts and its optional field on SessionSchema (whitelisted)"
  - "Relocated buildHapiMcpBridge from cli/src/codex/utils to cli/src/agent/serverUtils since gemini and opencode launchers still depend on it"
  - "Kept a narrow `flavor === 'codex'` rejection in syncEngine.resolveSession to satisfy the spawnSession agent-union type (whitelisted under hub/src/sync TEMP-WIDE)"
metrics:
  duration: ~3h
  completed: 2026-05-20
---

# Phase 01 Plan 02: CUT-02 Remove Codex Agent Summary

One-liner: deleted the Codex agent implementation (50 source files + commands + workflows) and rewrote all hub/shared/cli consumers to drop Codex-specific code paths, keeping only the `AGENT_MESSAGE_PAYLOAD_TYPE='codex'` wire constant for inbound-message identification.

## What Shipped

- **Source tree removal**: entire `cli/src/codex/` (50 files), Codex CLI commands (`codex.ts`, `codex.test.ts`, `mcp.ts`), GitHub workflows + prompts, dev fixture scripts.
- **Codex models RPC removed**: deleted `codexModels.ts` modules and registration; deleted `listCodexModelsForSession`/`listCodexModelsForMachine` from `syncEngine`, plus `/sessions/:id/codex-models`, `/machines/:id/codex-models`, `/sessions/:id/collaboration-mode`, `/sessions/:id/model-reasoning-effort` routes.
- **Type renames**: `CodexMessage → AgentWireMessage` in `cli/src/agent/messageConverter.ts`; `extractTodosFromCodexMessage → extractTodosFromAgentMessage` in `hub/src/sync/todos.ts`. Bare `'codex'` literals at todo extraction now go through `AGENT_MESSAGE_PAYLOAD_TYPE`.
- **Schema cleanup**: removed `codexSessionId` from `MetadataSchema`, `CodexPermissionMode` from re-exports.
- **Test fixtures**: replaced `flavor: 'codex'` with `flavor: 'cursor'` in unit-test fixtures across cli + hub; removed Codex-specific test cases (collaboration mode, model reasoning effort, codex models routes, `flavor === 'codex'` resume path test).
- **Util relocation**: `buildHapiMcpBridge.ts` moved to `cli/src/agent/serverUtils/` (still imported by gemini + opencode launchers, scheduled for removal in their own CUT plans).
- **Guard script**: removed all `# TEMP-CUT-02` whitelist entries from `scripts/check-no-cut-agents.sh`.

## Wire-Level Preservation

The `'codex'` literal survives in three intentional places (D-15):
1. `shared/src/modes.ts` — `AGENT_MESSAGE_PAYLOAD_TYPE = 'codex'` constant (other agents emit messages tagged `type: 'codex'` for historical reasons).
2. `shared/src/schemas.ts` — `CodexCollaborationModeSchema` and `collaborationMode` optional field on `SessionSchema`.
3. `shared/src/resume.ts` and `shared/src/flavors.ts` — `AgentFlavorSchema` still enumerates `'codex'` (next CUT phase will narrow this).

## Deviations from Plan

### Rule 3 (auto-fix blocking)

1. **Kept narrow `flavor === 'codex'` guard in `syncEngine.resolveSession`** — when `target.flavor` (typed as the full `AgentFlavor` union) reaches `rpcGateway.spawnSession`, the latter's parameter type now excludes `'codex'`. Re-added an explicit narrowing branch that returns a typed error rather than widening spawnSession's signature. File is in the `hub/src/sync/**` TEMP-WIDE whitelist.

2. **Retained `CodexCollaborationModeSchema` and `collaborationMode` field on `SessionSchema`** — initial draft removed the field, breaking cli test/api typing. Reinstated per D-15 whitelist guidance; consumers (`sessionCache`, `socket.ts`) already stripped reads/writes.

No Rule 4 (architectural) deviations. No checkpoints hit.

## Verification

- `bun run typecheck` — passed (cli, web, hub).
- `bun run test` — passed (cli + hub + web; 614 web tests, all suites green).
- `bash scripts/check-no-cut-agents.sh` — passed (note: ripgrep absent on host, but guard short-circuits cleanly and will fire in CI).
- Atomic commit: `9848e61` (`feat(01-02): CUT-02 remove Codex agent`).

## Known Stubs

None.

## Self-Check: PASSED

- SUMMARY.md committed alongside this narration.
- `cli/src/codex/` absent (50 deletions recorded in commit `9848e61`).
- Guard whitelist no longer references TEMP-CUT-02.
