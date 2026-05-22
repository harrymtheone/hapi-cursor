#!/usr/bin/env bash
# scripts/check-no-cut-agents.sh
#
# Phase-1 + Phase-2 + Phase-3 + Phase-4 + Phase-5 ripgrep guard. Fails the build if any
# business-code reference to a forbidden keyword leaks outside the whitelist below.
#
# Categories:
#   * Phase-1 cut-agents       — claude / codex / gemini / opencode
#   * Phase-2 integration      — telegram / serverchan / elevenlabs / grammy
#   * Phase-3 owner-only cut   — namespace / :ns in runtime source trees
#   * Phase-4 deploy cut       — tunwg / HAPI_RELAY_ / dangerous remote-log
#                                  flags plus relay hosted-web sweep terms
#   * Phase-5 flavor cut       — single residue (`AGENT_MESSAGE_PAYLOAD_TYPE = 'codex'`
#                                  in shared/src/modes.ts) is the only allowed survivor;
#                                  pinned via line-anchored post-filter (D-85).
#                                  Also enforces zero hits for legacy Phase-5 identifiers
#                                  and `flavor === '<non-cursor-literal>'` branches.
#
# Whitelist categories:
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
PHASE5_IDENTIFIER_PATTERN='\bisCodexFamilyFlavor\b|\bCodexCollaborationMode\b|\bgetCodexCollaboration\w*\b|\b(CLAUDE|CODEX|GEMINI|OPENCODE)_PERMISSION_MODES\b'
PHASE5_BRANCH_PATTERN='flavor\s*===\s*['\''"]'
PHASE5_SOURCE_DIRS=(cli/src hub/src web/src shared/src)
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

# === Phase-1/2/5 main sweep with line-anchored post-filter (D-85)
SURVIVORS=$("$RG_BIN" -n -i "${WHITELIST[@]}" "$PATTERN" . || true)
SURVIVORS_FILTERED=$(echo "$SURVIVORS" | grep -v "shared/src/modes.ts:.*AGENT_MESSAGE_PAYLOAD_TYPE = 'codex' as const" || true)
if [ -n "$SURVIVORS_FILTERED" ]; then
  echo "$SURVIVORS_FILTERED"
  echo ""
  echo "❌ Non-Cursor / external-channel literals found outside whitelist."
  echo "   Rewrite the hit at the source (delete or migrate the consumer)."
  echo "   The only allowed survivor is the wire-protocol literal at"
  echo "   shared/src/modes.ts (AGENT_MESSAGE_PAYLOAD_TYPE = 'codex' as const)."
  echo "   Phase-12 docs/marketing surfaces are deferred to the polish pass and"
  echo "   already covered by the docs/website globs."
  exit 1
fi
echo "✅ No non-Cursor agent literals outside whitelist (Phase-5 territory collapsed; only AGENT_MESSAGE_PAYLOAD_TYPE wire literal allowed)."

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

# === Phase-5 identifier sweep — legacy capability/permission-mode names must be gone
if "$RG_BIN" -n "$PHASE5_IDENTIFIER_PATTERN" "${PHASE5_SOURCE_DIRS[@]}"; then
  echo ""
  echo "❌ Phase-5 legacy flavor identifier residue found in runtime source scope."
  echo "   isCodexFamilyFlavor / CodexCollaborationMode / getCodexCollaboration* /"
  echo "   (CLAUDE|CODEX|GEMINI|OPENCODE)_PERMISSION_MODES are all deleted in Phase 5."
  echo "   Rewrite the hit at the source (delete the consumer or migrate to"
  echo "   getCapability / CURSOR_PERMISSION_MODES); do not add a whitelist entry."
  exit 1
fi
echo "✅ No Phase-5 legacy flavor identifiers in source scope."

# === Phase-5 branch sweep — non-cursor `flavor === '<literal>'` branches must be gone
FLAVOR_BRANCH=$("$RG_BIN" -n "$PHASE5_BRANCH_PATTERN" "${PHASE5_SOURCE_DIRS[@]}" || true)
# Post-filter (substring removal, not whole-line drop — guards against combined-
# condition masking where e.g. `flavor === 'gemini' && other === 'cursor'` would
# otherwise be suppressed by a whole-line `grep -v "=== 'cursor'"`):
#   1. Strip `=== 'cursor'` / `=== "cursor"` substrings (D-84 #2 narrow exception).
#   2. Strip `typeof flavor === '<jsruntime-type>'` substrings (JS runtime-type
#      checks, not flavor branches).
# Then re-match the sweep pattern against the residue so any surviving
# `flavor === '<non-cursor>'` still trips the gate.
FLAVOR_BRANCH_FILTERED=$(
  echo "$FLAVOR_BRANCH" \
    | sed -E "s/typeof flavor === ['\"][a-z]+['\"]//g; s/=== ['\"]cursor['\"]//g" \
    | grep -E "flavor[[:space:]]*===[[:space:]]*['\"]" \
    || true
)
if [ -n "$FLAVOR_BRANCH_FILTERED" ]; then
  echo "$FLAVOR_BRANCH_FILTERED"
  echo ""
  echo "❌ Non-cursor flavor === '<literal>' branch residue found in runtime source scope."
  echo "   AgentFlavor narrows to 'cursor' in Phase 5 — non-cursor literal branches"
  echo "   are dead code. Delete the branch or rewrite via getCapability."
  exit 1
fi
echo "✅ No non-cursor flavor === '<literal>' branches in source scope."

# === Phase-6 ripgrep sweeps + madge guard — D-108
# (#1) permissionModeToAgentArgs — duplicate-helper zero-tolerance across runtime trees.
PHASE6_DUPLICATE_HELPER='\bpermissionModeToAgentArgs\b'
PHASE6_LAUNCHER_CAST_PATTERN='permissionMode as string'
PHASE6_LAUNCHER_FILES=(cli/src/cursor/cursorLocalLauncher.ts cli/src/cursor/cursorRemoteLauncher.ts)
PHASE6_SOURCE_DIRS=(cli/src shared/src hub/src web/src)

if "$RG_BIN" -n "$PHASE6_DUPLICATE_HELPER" "${PHASE6_SOURCE_DIRS[@]}"; then
  echo ""
  echo "❌ Phase-6 duplicate helper permissionModeToAgentArgs still present."
  echo "   Use cli/src/agent/modeConfig.permissionModeToCursorArgs instead."
  exit 1
fi
echo "✅ No Phase-6 duplicate permissionModeToAgentArgs in source scope."

# (#2) `permissionMode as string` — zero hits in launcher files
if "$RG_BIN" -n "$PHASE6_LAUNCHER_CAST_PATTERN" "${PHASE6_LAUNCHER_FILES[@]}"; then
  echo ""
  echo "❌ Phase-6 'permissionMode as string' cast residue in launcher files."
  echo "   modeConfig.permissionModeToCursorArgs accepts PermissionMode | undefined directly."
  exit 1
fi
echo "✅ No Phase-6 'permissionMode as string' casts in launcher files."

# (#3) permissionModeToCursorArgs definition lives only in cli/src/agent/modeConfig.ts
PHASE6_DEF_HITS=$("$RG_BIN" -n '^export function permissionModeToCursorArgs|^function permissionModeToCursorArgs' \
  "${PHASE6_SOURCE_DIRS[@]}" | grep -v 'cli/src/agent/modeConfig\.ts' || true)
if [ -n "$PHASE6_DEF_HITS" ]; then
  echo "$PHASE6_DEF_HITS"
  echo ""
  echo "❌ Phase-6 permissionModeToCursorArgs defined outside cli/src/agent/modeConfig.ts."
  echo "   The canonical definition must live in cli/src/agent/modeConfig.ts only;"
  echo "   all other call sites must import from there."
  exit 1
fi
echo "✅ permissionModeToCursorArgs defined only in cli/src/agent/modeConfig.ts."

# (#4) madge --circular exit-code guard — Pitfall 1: --extensions ts,tsx is mandatory.
if ! npx --no-install madge --circular --extensions ts,tsx cli/src/cursor > /dev/null 2>&1; then
  echo ""
  echo "❌ Phase-6 madge circular dependency found in cli/src/cursor."
  echo "   Run: npx madge --circular --extensions ts,tsx cli/src/cursor"
  echo "   Most likely cause: a new import from cli/src/cursor/modes.ts to loop/session/launcher."
  exit 1
fi
echo "✅ No circular dependencies in cli/src/cursor (madge)."

# (#5) JSDoc concept-position anchor count — D-90 (SessionContext / LocalAdapter / RemoteAdapter / LaunchPolicy)
PHASE6_ANCHOR_COUNT=$("$RG_BIN" -c '@implements (SessionContext|LocalAdapter|RemoteAdapter|LaunchPolicy) \(Phase 6 SC#1\)' cli/src \
  | awk -F: '{s+=$2} END {print s+0}')
if [ "$PHASE6_ANCHOR_COUNT" -lt 4 ]; then
  echo "❌ Phase-6 SC#1 JSDoc concept tags missing (found $PHASE6_ANCHOR_COUNT, need ≥ 4)."
  echo "   Required anchors on sessionBase / BaseLocalLauncher / RemoteLauncherBase / localLaunchPolicy."
  exit 1
fi
echo "✅ Phase-6 SC#1 concept tags present (count=$PHASE6_ANCHOR_COUNT)."
