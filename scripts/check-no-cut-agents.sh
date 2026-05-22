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
