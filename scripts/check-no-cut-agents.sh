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
#   * Phase-5 flavor cut       — zero hits for legacy Phase-5 identifiers and
#                                  `flavor === '<non-cursor-literal>'` branches.
#                                  Phase 7 (D-124) removed the old
#                                  AGENT_MESSAGE_PAYLOAD_TYPE='codex' whitelist.
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

# === Phase-1/2/5 main sweep
SURVIVORS=$("$RG_BIN" -n -i "${WHITELIST[@]}" "$PATTERN" . || true)
if [ -n "$SURVIVORS" ]; then
  echo "$SURVIVORS"
  echo ""
  echo "❌ Non-Cursor / external-channel literals found outside whitelist."
  echo "   Rewrite the hit at the source (delete or migrate the consumer)."
  echo "   Phase-12 docs/marketing surfaces are deferred to the polish pass and"
  echo "   already covered by the docs/website globs."
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

# === Phase-7 wire-contract sweeps — D-126
PHASE7_SOURCE_DIRS=(cli/src hub/src web/src shared/src)

# (#1) useSSE heuristic narrower must not return after REFA-04 strict patch schema.
if "$RG_BIN" -n '\bhasUnknownSessionPatchKeys\b' "${PHASE7_SOURCE_DIRS[@]}"; then
  echo ""
  echo "❌ Phase-7 hasUnknownSessionPatchKeys residue found (REFA-04)."
  echo "   useSSE must consume SyncEventSchema directly without heuristic refetch fallback."
  exit 1
fi
echo "✅ No Phase-7 hasUnknownSessionPatchKeys residue in source scope."

# (#2) getSessionPatch was the local ad-hoc patch extractor; web hooks must use shared schema.
if "$RG_BIN" -n '\bgetSessionPatch\b' web/src/hooks; then
  echo ""
  echo "❌ Phase-7 getSessionPatch residue found in web/src/hooks/ (REFA-04)."
  echo "   Use SyncEventSchema's discriminator and strict SessionPatchSchema instead."
  exit 1
fi
echo "✅ No Phase-7 getSessionPatch residue in web hooks."

# (#3) Machine type declarations must remain single-sourced in shared/.
DUP_MACHINE=$("$RG_BIN" -n '^\s*(export\s+)?interface\s+Machine\b|^\s*export\s+type\s+Machine\s*=' \
  cli/src hub/src web/src \
  | grep -v -E 'hub/src/sync/machineCache\.ts:.*export type \{ Machine \}' \
  || true)
if [ -n "$DUP_MACHINE" ]; then
  echo "$DUP_MACHINE"
  echo ""
  echo "❌ Phase-7 duplicate Machine declaration found (REFA-03)."
  echo "   Machine must be imported from @hapi/protocol/shared contracts."
  exit 1
fi
echo "✅ No duplicate Phase-7 Machine declarations outside shared/."

# (#4) RunnerState/MachineMetadata schema declarations must remain in shared/src/schemas.ts.
DUP_SCHEMA=$("$RG_BIN" -n '\b(RunnerStateSchema|MachineMetadataSchema)\s*=\s*z\.object\b|^\s*export\s+const\s+(RunnerStateSchema|MachineMetadataSchema)\b' \
  cli/src web/src \
  | grep -v "from '@hapi/protocol" \
  || true)
if [ -n "$DUP_SCHEMA" ]; then
  echo "$DUP_SCHEMA"
  echo ""
  echo "❌ Phase-7 duplicate RunnerStateSchema/MachineMetadataSchema declaration found (REFA-03)."
  echo "   Schema declarations must live only in shared/src/schemas.ts."
  exit 1
fi
echo "✅ No duplicate Phase-7 RunnerState/MachineMetadata schema declarations outside shared/."

# (#5) The legacy codex wire literal is fully retired after D-124.
if "$RG_BIN" -n "['\"]codex['\"]" "${PHASE7_SOURCE_DIRS[@]}"; then
  echo ""
  echo "❌ Phase-7 'codex' literal residue found (D-124 / REFA-03)."
  echo "   AGENT_MESSAGE_PAYLOAD_TYPE is cursor-only; delete the literal at source."
  exit 1
fi
echo "✅ No Phase-7 'codex' literals in source scope."

# (#6) metadata.flavor writes are deleted; top-level resume-target flavor is still legitimate.
FLAVOR_WRITES=$("$RG_BIN" -n "flavor:\s*['\"]|\.flavor\s*=" cli/src hub/src \
  | grep -v -E '(LocalResumeTarget|ResumableSession|resume\.ts|resume\.test\.ts|hub/src/web/routes/cli\.test\.ts)' \
  || true)
if [ -n "$FLAVOR_WRITES" ]; then
  echo "$FLAVOR_WRITES"
  echo ""
  echo "❌ Phase-7 metadata.flavor write residue found (REFA-03)."
  echo "   Delete metadata.flavor; only top-level resume-target flavor survives."
  exit 1
fi
echo "✅ Phase-7 wire-contract sweeps clean (D-126)."

# ===== Phase 8 — Hub internal decoupling (D-143) =====
# Zero-tolerance keywords closing REFH-01..REFH-04:
#   #1 SSE → SyncEngine reverse import          (SC#2)
#   #2 SessionCache construction whitelist      (D-129 / D-130)
#   #3 setInterval/setTimeout outside scheduler (SC#4)
#   #5 file-size budgets                        (SC#1)
# #4 (madge zero cycles) is enforced by the tail-invocation of
# scripts/check-no-circular-hub.sh so a single `bash scripts/check-no-cut-agents.sh`
# command is the Phase 8 gate.
PHASE8_SWEEP_DIRS=(hub/src/sse hub/src/sync hub/src/socket hub/src/notifications)

# (#1) D-143 #1 / SC#2 — SSE must not reverse-import SyncEngine.
PHASE8_SSE_REVIMPORT=$("$RG_BIN" --no-heading -n "from .*['\"]\.\./sync/syncEngine['\"]" hub/src/sse/ 2>/dev/null || true)
if [ -n "$PHASE8_SSE_REVIMPORT" ]; then
  echo "$PHASE8_SSE_REVIMPORT"
  echo ""
  echo "❌ Phase 8 D-143 #1: hub/src/sse/ imports from ../sync/syncEngine (SC#2 violated)."
  echo "   Use 'import type { SyncEvent } from \"@hapi/protocol/types\"' instead."
  exit 1
fi
echo "✅ Phase 8 D-143 #1: no SSE → SyncEngine reverse import."

# (#2) D-143 #2 — SessionCache must have exactly 2 source sites:
#      class declaration (sessionCache.ts) + construction (syncEngine.ts). Tests excluded.
PHASE8_SC_HITS=$("$RG_BIN" --no-heading -n 'new SessionCache\(|class SessionCache' hub/src/ --glob '!**/*.test.ts' 2>/dev/null || true)
PHASE8_SC_COUNT=$(echo -n "$PHASE8_SC_HITS" | grep -c '^' || true)
if [ "$PHASE8_SC_COUNT" -ne 2 ]; then
  echo "$PHASE8_SC_HITS"
  echo ""
  echo "❌ Phase 8 D-143 #2: expected exactly 2 SessionCache source sites (class + construction), found $PHASE8_SC_COUNT."
  echo "   Whitelist: class in hub/src/sync/sessionCache.ts + 'new SessionCache(' in hub/src/sync/syncEngine.ts."
  exit 1
fi
echo "✅ Phase 8 D-143 #2: SessionCache source sites = 2 (class + construction)."

# (#3) D-143 #3 / SC#4 — direct setInterval/setTimeout in {sse,sync,socket,notifications}
# is banned except for promise-sleep retries annotated with
# `// scheduler-exempt: promise-sleep retry` on the same line OR the immediately
# preceding line. Plan 08-02 placed the comment on the preceding line in
# hub/src/sync/syncEngineSessionResume.ts:240,253 — both forms accepted.
PHASE8_TIMER_HITS=$("$RG_BIN" --no-heading -n 'setInterval\(|setTimeout\(' "${PHASE8_SWEEP_DIRS[@]}" --glob '!**/*.test.ts' 2>/dev/null || true)
PHASE8_TIMER_VIOLATIONS=""
if [ -n "$PHASE8_TIMER_HITS" ]; then
  while IFS= read -r match; do
    [ -z "$match" ] && continue
    file="${match%%:*}"
    rest="${match#*:}"
    line="${rest%%:*}"
    content="${rest#*:}"
    if echo "$content" | grep -q 'scheduler-exempt: promise-sleep retry'; then
      continue
    fi
    prev=$((line - 1))
    if [ "$prev" -ge 1 ]; then
      prev_content=$(sed -n "${prev}p" "$file" 2>/dev/null || true)
      if echo "$prev_content" | grep -q 'scheduler-exempt: promise-sleep retry'; then
        continue
      fi
    fi
    PHASE8_TIMER_VIOLATIONS+="$match"$'\n'
  done <<< "$PHASE8_TIMER_HITS"
fi
if [ -n "$PHASE8_TIMER_VIOLATIONS" ]; then
  printf '%s' "$PHASE8_TIMER_VIOLATIONS"
  echo ""
  echo "❌ Phase 8 D-143 #3: direct setInterval/setTimeout in hub/src/{sse,sync,socket,notifications}/ outside scheduler (SC#4 violated)."
  echo "   Fix: route through hub/src/utils/scheduler.ts (everyMs / afterMs);"
  echo "   or, for promise-sleep retries, annotate the line (or preceding line)"
  echo "   with '// scheduler-exempt: promise-sleep retry'."
  exit 1
fi
echo "✅ Phase 8 D-143 #3: setInterval/setTimeout in {sse,sync,socket,notifications}/ either inside scheduler or whitelisted promise-sleep retries."

# (#5) D-143 #5 / SC#1 — file-size budgets for Phase-8-split files.
# Scope per SC#1 (ROADMAP) + D-144: only files actually split in this phase are
# constrained — sessionCache + 4 sessionXxxService + syncEngine + 6 sub-facades.
# Tests excluded. messageService.ts / rpcGateway.ts / teams.ts etc. are explicitly
# out of scope (D-144: "本 phase 不动 messageService.ts ...").
PHASE8_OVERSIZED_SYNC=$(find hub/src/sync -maxdepth 1 \( -name 'session*.ts' -o -name 'syncEngine*.ts' \) ! -name '*.test.ts' -exec wc -l {} \; 2>/dev/null | awk '$1 >= 400 { print }')
if [ -n "$PHASE8_OVERSIZED_SYNC" ]; then
  echo "$PHASE8_OVERSIZED_SYNC"
  echo ""
  echo "❌ Phase 8 D-143 #5: Phase-8-split file in hub/src/sync/ ≥ 400 lines (SC#1 violated)."
  echo "   Split further into a sub-facade or service file."
  exit 1
fi
PHASE8_OVERSIZED_ROUTES=$(find hub/src/web/routes/sessions -maxdepth 1 -name '*.ts' ! -name '*.test.ts' -exec wc -l {} \; 2>/dev/null | awk '$1 >= 250 { print }')
if [ -n "$PHASE8_OVERSIZED_ROUTES" ]; then
  echo "$PHASE8_OVERSIZED_ROUTES"
  echo ""
  echo "❌ Phase 8 D-143 #5: file in hub/src/web/routes/sessions/ ≥ 250 lines (SC#1 violated)."
  echo "   Split further along lifecycle / config / upload / read boundaries."
  exit 1
fi
echo "✅ Phase 8 D-143 #5: file-size budgets honored (sync < 400, routes/sessions < 250)."

# (#4) D-143 #4 / SC#5 — tail-invocation of the madge guard so this script is
# a single phase-gate command.
bash "$(dirname "$0")/check-no-circular-hub.sh"

echo "✅ Phase 8 guard PASS (D-143 #1–#5 + madge zero cycles)."

# ===== Phase 9 — Web internal decoupling (D-158) =====
# Zero-tolerance keywords closing REFW-01..REFW-03:
#   #1 levenshteinDistance dedup        (SC#3 / D-155)
#   #2 estimateBase64Bytes dedup        (SC#3)
#   #3 file-size red lines              (SC#2 / D-145 / D-157)
#   #4 messageWindow* sub-module budget (D-149)
#   #5 fallback testid anchor + reverse-assert (D-148)
#   #6 createApiQuery factory + ≥ 3 users (D-147)
#   #7 madge zero cycles (tail-invocation of check-no-circular-web.sh) (SC#1 / SC#4)
PHASE9_WEB_SCOPE=(web/src)
PHASE9_NON_WEB=(cli/src hub/src shared/src)

# (#1) D-158 #1 — levenshteinDistance: exactly 1 hit in web/src/lib/fuzzyMatch.ts, 0 elsewhere
PHASE9_LEV_HITS=$("$RG_BIN" -n '\bfunction levenshteinDistance\b|\bfunction levenshtein\b' "${PHASE9_WEB_SCOPE[@]}" 2>/dev/null || true)
PHASE9_LEV_COUNT=$(echo -n "$PHASE9_LEV_HITS" | grep -c '^' || true)
if [ "$PHASE9_LEV_COUNT" -ne 1 ] || ! echo "$PHASE9_LEV_HITS" | grep -q 'web/src/lib/fuzzyMatch\.ts'; then
  echo "$PHASE9_LEV_HITS"
  echo "❌ Phase 9 D-158 #1: levenshteinDistance must be defined exactly once in web/src/lib/fuzzyMatch.ts."
  exit 1
fi
if "$RG_BIN" -n '\bfunction levenshteinDistance\b|\bfunction levenshtein\b' "${PHASE9_NON_WEB[@]}" 2>/dev/null; then
  echo "❌ Phase 9 D-158 #1: levenshteinDistance leaked outside web/src/ (REFW-03 + D-155 boundary violated)."
  exit 1
fi
echo "✅ Phase 9 D-158 #1: levenshteinDistance lives only in web/src/lib/fuzzyMatch.ts."

# (#2) D-158 #2 — estimateBase64Bytes: exactly 1 hit in shared/src/uploads.ts, 0 elsewhere
PHASE9_B64_HITS=$("$RG_BIN" -n '\bfunction estimateBase64Bytes\b' shared/src 2>/dev/null || true)
PHASE9_B64_COUNT=$(echo -n "$PHASE9_B64_HITS" | grep -c '^' || true)
if [ "$PHASE9_B64_COUNT" -ne 1 ] || ! echo "$PHASE9_B64_HITS" | grep -q 'shared/src/uploads\.ts'; then
  echo "$PHASE9_B64_HITS"
  echo "❌ Phase 9 D-158 #2: estimateBase64Bytes must be defined exactly once in shared/src/uploads.ts."
  exit 1
fi
if "$RG_BIN" -n '\bfunction estimateBase64Bytes\b' cli/src hub/src web/src 2>/dev/null; then
  echo "❌ Phase 9 D-158 #2: estimateBase64Bytes leaked outside shared/src/ (REFW-03 violated)."
  exit 1
fi
echo "✅ Phase 9 D-158 #2: estimateBase64Bytes lives only in shared/src/uploads.ts."

# (#3) D-158 #3 — file-size red lines for Phase-9-split files + verify-only targets
PHASE9_OVERSIZED=$(
  wc -l \
    web/src/components/SessionList.tsx \
    web/src/lib/message-window-store.ts \
    web/src/routes/settings/index.tsx \
    web/src/components/AssistantChat/HappyComposer.tsx \
    web/src/components/ToolCard/views/_results.tsx \
    web/src/chat/reducerTimeline.ts \
    web/src/components/ToolCard/ToolCard.tsx \
    web/src/components/ToolCard/knownTools.tsx \
    web/src/components/ToolCard/views/_all.tsx \
    2>/dev/null | awk '
      /reducerTimeline\.ts/  { if ($1 >= 500) print }
      /SessionList\.tsx/      { if ($1 >= 500) print }
      /message-window-store\.ts/ { if ($1 >= 500) print }
      /settings\/index\.tsx/  { if ($1 >= 500) print }
      /HappyComposer\.tsx/    { if ($1 >= 500) print }
      /_results\.tsx/         { if ($1 >= 500) print }
      /ToolCard\.tsx/         { if ($1 >= 500) print }
      /knownTools\.tsx/       { if ($1 >= 500) print }
      /_all\.tsx/             { if ($1 >= 200) print }
    ')
if [ -n "$PHASE9_OVERSIZED" ]; then
  echo "$PHASE9_OVERSIZED"
  echo "❌ Phase 9 D-158 #3: file-size red-line breached. See ROADMAP SC#2 + D-145 + D-157."
  exit 1
fi
echo "✅ Phase 9 D-158 #3: file-size budgets honored."

# (#4) D-158 #4 — messageWindow* sub-module budgets (< 400 each, D-149)
PHASE9_STORE_OVERSIZED=$(find web/src/lib -maxdepth 1 -name 'messageWindow*.ts' ! -name '*.test.ts' -exec wc -l {} \; 2>/dev/null | awk '$1 >= 400 { print }')
if [ -n "$PHASE9_STORE_OVERSIZED" ]; then
  echo "$PHASE9_STORE_OVERSIZED"
  echo "❌ Phase 9 D-158 #4: message-window sub-module ≥ 400 lines (D-149 violated)."
  exit 1
fi
echo "✅ Phase 9 D-158 #4: message-window sub-modules each < 400."

# (#5) D-158 #5 — fallback testid present in knownTools.tsx (NOT _results.tsx — see RESEARCH Pitfall 3)
PHASE9_TESTID_HITS=$("$RG_BIN" -c 'data-testid="tool-card-unknown-fallback"' web/src/components/ToolCard/knownTools.tsx 2>/dev/null || echo 0)
if [ "$PHASE9_TESTID_HITS" -ne 1 ]; then
  echo "❌ Phase 9 D-158 #5: data-testid=\"tool-card-unknown-fallback\" must appear exactly once in knownTools.tsx (found $PHASE9_TESTID_HITS)."
  exit 1
fi
# Reverse-assert that integration test uses queryByTestId on the anchor
if ! "$RG_BIN" -q 'queryByTestId\([^)]*tool-card-unknown-fallback' web/src/components/ToolCard/ToolCard.integration.test.tsx 2>/dev/null; then
  echo "❌ Phase 9 D-158 #5: ToolCard.integration.test.tsx must reverse-assert queryByTestId('tool-card-unknown-fallback')."
  exit 1
fi
echo "✅ Phase 9 D-158 #5: fallback testid anchored in knownTools.tsx + reverse-asserted in integration test."

# (#6) D-158 #6 — createApiQuery factory + ≥ 3 importer files (D-147)
PHASE9_FACTORY_DEF=$("$RG_BIN" -c '^export function createApiQuery\b' web/src/hooks/queries/_factory.ts 2>/dev/null || echo 0)
if [ "$PHASE9_FACTORY_DEF" -ne 1 ]; then
  echo "❌ Phase 9 D-158 #6: createApiQuery must be defined exactly once in web/src/hooks/queries/_factory.ts."
  exit 1
fi
PHASE9_FACTORY_USERS=$("$RG_BIN" -l 'createApiQuery' web/src/hooks/queries/ --glob '!_factory.ts' --glob '!*.test.*' 2>/dev/null | wc -l)
if [ "$PHASE9_FACTORY_USERS" -lt 3 ]; then
  echo "❌ Phase 9 D-158 #6: createApiQuery must have ≥ 3 importer files in web/src/hooks/queries/ (found $PHASE9_FACTORY_USERS)."
  exit 1
fi
echo "✅ Phase 9 D-158 #6: createApiQuery defined once + ≥ 3 users."

# (#7) D-158 #7 — tail-invocation of madge cycle guard (single phase-gate command)
bash "$(dirname "$0")/check-no-circular-web.sh"

echo "✅ Phase 9 guard PASS (D-158 #1–#6 + madge zero cycles)."

# -----------------------------------------------------------------------------
# Phase-10 config-cleanup guard (Plan 01 — active checks only)
#
# Active sub-checks land in this slice:
#   (#3) `name: 'server'` alias removed from cli/src/commands/registry.ts
#   (#4) zero runtime `migration-v*.ts` files under hub/src
#
# Staged sub-checks (Plan 04 will flip these on after the CLI/Hub DI cutover
# in Plan 02 + Plan 03 lands; until then they would false-positive on the
# in-flight singleton/legacy-field code paths):
#   (#1) legacy field reads (`\bserverUrl\b|\bwebapp(Host|Port|Url|Origin)\b`)
#   (#2) mutable setters (`_setApiUrl|_setCliApiToken|_setExtraHeaders`)
#   (#5) singleton imports (`getConfiguration\(\)` / `import { configuration }`)
# -----------------------------------------------------------------------------

# (#1) Plan 04: enable after Plan 02 + Plan 03 land DI cutover
# PHASE10_LEGACY_FIELDS=$("$RG_BIN" -n '\bserverUrl\b|\bwebapp(Host|Port|Url|Origin)\b' \
#   cli/src hub/src --glob '!*.test.*' 2>/dev/null | wc -l)
# if [ "$PHASE10_LEGACY_FIELDS" -ne 0 ]; then
#   echo "❌ Phase 10 #1: legacy serverUrl / webapp* field reads must be zero."
#   exit 1
# fi

# (#2) Plan 04: enable after Plan 02 + Plan 03 land DI cutover
# PHASE10_MUTABLE_SETTERS=$("$RG_BIN" -n '_setApiUrl|_setCliApiToken|_setExtraHeaders' \
#   cli/src hub/src --glob '!*.test.*' 2>/dev/null | wc -l)
# if [ "$PHASE10_MUTABLE_SETTERS" -ne 0 ]; then
#   echo "❌ Phase 10 #2: mutable singleton setters must be removed."
#   exit 1
# fi

# (#3) D-160 — `hapi server` alias must be gone from the command registry.
PHASE10_SERVER_ALIAS=$("$RG_BIN" -c "name:\s*['\"]server['\"]" cli/src/commands/registry.ts 2>/dev/null || echo 0)
if [ "$PHASE10_SERVER_ALIAS" -ne 0 ]; then
  echo "❌ Phase 10 #3: \`name: 'server'\` alias must be removed from cli/src/commands/registry.ts (D-160)."
  exit 1
fi
echo "✅ Phase 10 #3: hapi server alias removed."

# (#4) D-175 — no runtime compatibility migration files under hub/src.
PHASE10_MIGRATION_FILES=$(find hub/src -name 'migration-v*.ts' 2>/dev/null | wc -l)
if [ "$PHASE10_MIGRATION_FILES" -ne 0 ]; then
  echo "❌ Phase 10 #4: runtime migration-v*.ts files must not exist under hub/src (D-175)."
  exit 1
fi
echo "✅ Phase 10 #4: no runtime migration-v*.ts files."

# (#5) Plan 04: enable after Plan 02 + Plan 03 land DI cutover
# PHASE10_SINGLETON_IMPORTS=$("$RG_BIN" -n 'getConfiguration\(\)|^\s*import\s+\{\s*configuration\s*\}' \
#   cli/src hub/src --glob '!*.test.*' --glob '!configuration.ts' 2>/dev/null | wc -l)
# if [ "$PHASE10_SINGLETON_IMPORTS" -ne 0 ]; then
#   echo "❌ Phase 10 #5: configuration singleton imports must be replaced by DI."
#   exit 1
# fi

echo "✅ Phase 10 guard PASS."
