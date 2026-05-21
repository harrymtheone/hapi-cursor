#!/usr/bin/env bash
# scripts/check-no-cut-agents.sh
#
# Phase-1 + Phase-2 + Phase-3 + Phase-4 ripgrep guard. Fails the build if any business-code
# reference to a forbidden keyword leaks outside the whitelist below.
#
# Categories:
#   * Phase-1 cut-agents     — claude / codex / gemini / opencode
#   * Phase-2 integration    — telegram / serverchan / elevenlabs / grammy
#   * Phase-3 owner-only cut  — namespace / :ns in runtime source trees
#   * Phase-4 deploy cut      — tunwg / HAPI_RELAY_ / dangerous remote-log
#                                flags plus relay hosted-web sweep terms
#
# Whitelist categories:
#   * Permanent (Phase-5 territory) — files whose hits are structurally tied to
#     the AgentFlavor union (literals as wire values, flavor-tagged sessionIds,
#     per-flavor UI matrix). Phase 5 (CUT-05) narrows the union and lands the
#     final rewrites; these entries stay until then.
#   * Permanent (Phase-12 deferred) — docs / marketing / NOTICE wording owned
#     by the Phase-12 polish pass.
#   * Infra — files that can never be agent code (lockfile, gitignore, node_modules…).
set -euo pipefail
if command -v rg >/dev/null 2>&1; then
  RG_BIN="rg"
elif [ -x "/usr/share/cursor/resources/app/node_modules/@vscode/ripgrep/bin/rg" ]; then
  RG_BIN="/usr/share/cursor/resources/app/node_modules/@vscode/ripgrep/bin/rg"
else
  echo "❌ ripgrep (rg) is required for source guards." >&2
  exit 1
fi

PATTERN='\b(claude|codex|gemini|opencode|telegram|serverchan|elevenlabs|grammy)\b'
PHASE3_PATTERN='namespace|:ns'
PHASE3_SOURCE_DIRS=(cli/src hub/src web/src shared/src)
PHASE4_HARD_PATTERN='tunwg|HAPI_RELAY_|DANGEROUSLY_LOG_TO_SERVER_FOR_AI_AUTO_DEBUGGING'
PHASE4_SWEEP_PATTERN='relay-mode|relayMode|officialWebUrl|app\.hapi\.run|download-tunwg|--relay|--no-relay'
WHITELIST=(
  # === Infra (never agent code)
  --glob '!.planning/**'
  --glob '!CHANGELOG.md'
  --glob '!**/.gitignore'
  --glob '!node_modules/**'
  --glob '!dist/**'
  --glob '!bun.lock'
  --glob '!.git/**'
  --glob '!scripts/check-no-cut-agents.sh'

  # === Phase-5 territory — shared union surface (owner: CUT-05)
  --glob '!shared/src/flavors.ts'                     # AgentFlavor union definition
  --glob '!shared/src/flavors.test.ts'
  --glob '!shared/src/modes.ts'                       # AGENT_MESSAGE_PAYLOAD_TYPE='codex' wire constant
  --glob '!shared/src/resume.ts'                      # session-resume types reference flavors
  --glob '!shared/src/resume.test.ts'                 # flavor fixtures
  --glob '!shared/src/schemas.ts'                     # *SessionId metadata fields (wire schema)
  --glob '!shared/src/sessionSummary.ts'              # *SessionId picker chain
  --glob '!shared/src/models.ts'                      # claude model presets (cursor inherits)
  --glob '!shared/src/models.test.ts'
  --glob '!shared/src/types.ts'                       # union/permission-mode re-exports

  # === Phase-5 territory — hub union consumers (owner: CUT-05)
  --glob '!hub/src/sync/syncEngine.ts'                # default agent 'claude' + flavor branches
  --glob '!hub/src/sync/rpcGateway.ts'                # agent union types
  --glob '!hub/src/sync/sessionModel.test.ts'         # multi-flavor fixture matrix
  --glob '!hub/src/web/routes/sessions.ts'            # *-models route surface
  --glob '!hub/src/web/routes/sessions.test.ts'
  --glob '!hub/src/web/routes/machines.ts'            # spawn enum
  --glob '!hub/src/web/routes/machines.test.ts'
  --glob '!hub/src/web/routes/cli.test.ts'            # CLI route fixtures
  --glob '!hub/src/web/routes/permissions.ts'         # per-flavor permission types

  # === Phase-5 territory — cli union consumers (owner: CUT-05)
  --glob '!cli/src/commands/runner.ts'                # multi-flavor spawn surface
  --glob '!cli/src/runner/run.ts'                     # buildCliArgs multi-flavor matrix
  --glob '!cli/src/runner/buildCliArgs.test.ts'
  --glob '!cli/src/runner/README.md'
  --glob '!cli/src/api/apiSession.ts'                 # *SessionId wire fields
  --glob '!cli/src/agent/serverUtils/buildHapiMcpBridge.ts'
  --glob '!cli/src/agent/serverUtils/startHookServer.ts'
  --glob '!cli/src/agent/serverUtils/startHappyServer.ts'
  --glob '!cli/src/ui/logger.ts'                      # flavor-tagged log scopes
  --glob '!cli/src/ui/ink/RemoteModeDisplay.tsx'
  --glob '!cli/src/ui/ink/CodexDisplay.tsx'
  --glob '!cli/src/utils/attachmentFormatter.ts'
  --glob '!cli/src/parsers/specialCommands.ts'
  --glob '!cli/src/modules/common/rpcTypes.ts'
  --glob '!cli/src/modules/common/permission/BasePermissionHandler.ts'
  --glob '!cli/src/modules/common/skills.ts'
  --glob '!cli/src/modules/common/skills.test.ts'
  --glob '!cli/src/modules/common/slashCommands.ts'
  --glob '!cli/src/modules/common/slashCommands.test.ts'

  # === Phase-5 territory — web union consumers (owner: CUT-05)
  --glob '!web/src/api/client.ts'                     # agent union argument
  --glob '!web/src/chat/**'                           # flavor reducer / normalize / types
  --glob '!web/src/realtime/**'                       # voice flavor names
  --glob '!web/src/router.tsx'                        # flavor-aware routing
  --glob '!web/src/types/api.ts'                      # union type mirror
  --glob '!web/src/lib/locales/en.ts'
  --glob '!web/src/lib/locales/zh-CN.ts'
  --glob '!web/src/lib/query-keys.ts'
  --glob '!web/src/lib/assistant-runtime.ts'
  --glob '!web/src/lib/assistant-runtime.test.ts'
  --glob '!web/src/lib/sessionModelLabel.test.ts'
  --glob '!web/src/lib/message-window-store.ts'
  --glob '!web/src/lib/message-window-store.test.ts'
  --glob '!web/src/hooks/useActiveSuggestions.ts'
  --glob '!web/src/hooks/queries/useSlashCommands.ts'
  --glob '!web/src/hooks/queries/useCodexModels.ts'
  --glob '!web/src/hooks/mutations/useSessionActions.ts'
  --glob '!web/src/hooks/mutations/useSpawnSession.ts'
  --glob '!web/src/components/SessionList.tsx'
  --glob '!web/src/components/SessionList.test.ts'
  --glob '!web/src/components/SessionList.directory-action.test.tsx'
  --glob '!web/src/components/SessionChat.tsx'
  --glob '!web/src/components/ToolCard/**'
  --glob '!web/src/components/NewSession/**'
  --glob '!web/src/components/AssistantChat/**'

  # === Phase-12 deferred (docs / marketing wording — owner: docs polish)
  --glob '!cli/NOTICE'
  --glob '!cli/README.md'
  --glob '!hub/README.md'
  --glob '!web/README.md'
  --glob '!docs/**'
  --glob '!website/**'
  --glob '!README.md'
  --glob '!CONTRIBUTING.md'
  --glob '!AGENTS.md'
  --glob '!CLAUDE.md'
  --glob '!refactor.md'
  --glob '!.cursor/rules/**'
)

PHASE4_WHITELIST=(
  # === Phase-04 default history whitelist
  --glob '!.planning/codebase/**'
  --glob '!CHANGELOG.md'

  # === Phase-04 source-of-truth planning artifacts
  --glob '!.planning/PROJECT.md'
  --glob '!.planning/ROADMAP.md'
  --glob '!.planning/REQUIREMENTS.md'
  --glob '!.planning/phases/04-cut-deployment-infrastructure/**'

  # === Phase-04 guard self-reference
  --glob '!scripts/check-no-cut-agents.sh'
)
if "$RG_BIN" -i "${WHITELIST[@]}" "$PATTERN" .; then
  echo ""
  echo "❌ Non-Cursor / external-channel literals found outside whitelist."
  echo "   Either rewrite the hit, or — if the hit is structurally tied to"
  echo "   the AgentFlavor union (Phase-5) — add an explicit whitelist entry"
  echo "   above (owner: CUT-05). Phase-12 docs/marketing surfaces are deferred"
  echo "   to the polish pass and already covered by the docs/website globs."
  exit 1
fi
echo "✅ No non-Cursor agent literals outside whitelist."

if "$RG_BIN" -n "$PHASE3_PATTERN" "${PHASE3_SOURCE_DIRS[@]}"; then
  echo ""
  echo "❌ Phase-3 namespace residue found in runtime source scope."
  echo "   Rewrite the hit; do not add broad source whitelists for CUT-09."
  exit 1
fi
echo "✅ No Phase-3 namespace residue in source scope."

if "$RG_BIN" -n "${PHASE4_WHITELIST[@]}" "$PHASE4_HARD_PATTERN" .; then
  echo ""
  echo "❌ Phase-4 deployment-infrastructure / remote-log residue found outside whitelist."
  echo "   Rewrite the hit; only planning source-of-truth artifacts, CHANGELOG.md,"
  echo "   .planning/codebase snapshots, and this guard may retain Phase-04 hard terms."
  exit 1
fi

if "$RG_BIN" -n "${PHASE4_WHITELIST[@]}" "$PHASE4_SWEEP_PATTERN" .; then
  echo ""
  echo "❌ Phase-4 relay hosted-web or CLI relay residue found outside whitelist."
  echo "   Rewrite the hit; do not whitelist docs, website, README, or runtime source"
  echo "   for deployment-infrastructure sweep terms."
  exit 1
fi

echo "✅ No Phase-4 deployment-infrastructure / remote-log residue outside whitelist."
