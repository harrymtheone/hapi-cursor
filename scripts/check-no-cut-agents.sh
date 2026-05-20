#!/usr/bin/env bash
# scripts/check-no-cut-agents.sh
#
# Phase-1 ripgrep guard. Fails the build if any business-code reference to a
# non-Cursor agent flavor (claude / codex / gemini / opencode) leaks outside
# the whitelist below.
#
# Each WHITELIST entry is one of:
#   * Permanent (Phase-1 final form) — union literal owners, license, vendor, history
#   * # TEMP-CUT-XX — runtime-dir blanket; the corresponding CUT plan removes both
#     the directory and the whitelist entry in the same commit.
#   * # TEMP-WIDE: owner=CUT-XX — consumer-file or consumer-dir hit; the corresponding
#     CUT plan's shrink-whitelist task removes / narrows the entry after the rewrite lands.
#   * # TEMP-WIDE: owner=01-05-cleanup — multi-flavor consumer deferred to 01-05.
set -euo pipefail
PATTERN='\b(claude|codex|gemini|opencode)\b'
WHITELIST=(
  # Permanent (Phase-1 final form)
  --glob '!.planning/**'
  --glob '!CHANGELOG.md'
  --glob '!shared/src/flavors.ts'
  --glob '!shared/src/flavors.test.ts'
  --glob '!shared/src/modes.ts'
  --glob '!shared/src/resume.ts'
  --glob '!shared/src/voice.ts'
  --glob '!cli/NOTICE'                       # Phase 12 owns
  --glob '!cli/README.md'                    # Phase 12 owns
  --glob '!**/.gitignore'
  --glob '!docs/**'                          # Phase 12 owns
  --glob '!website/**'                       # Phase 12 owns
  --glob '!node_modules/**'
  --glob '!dist/**'
  --glob '!bun.lock'
  --glob '!.git/**'
  --glob '!scripts/check-no-cut-agents.sh'
  # TEMP-CUT-04: drop after 01-04 commit
  --glob '!cli/src/opencode/**'
  --glob '!cli/src/commands/opencode.ts'
  # TEMP-WIDE: broad consumer-dir globs; owners per 01-WAVE0-FINDINGS.md §"HEAD inventory"
  --glob '!cli/src/commands/**'                       # TEMP-WIDE: owner=01-05-cleanup
  --glob '!cli/src/agent/**'                          # TEMP-WIDE: owner=01-05-cleanup
  --glob '!cli/src/api/**'                            # TEMP-WIDE: owner=01-05-cleanup
  --glob '!cli/src/runner/**'                         # TEMP-WIDE: owner=01-05-cleanup
  --glob '!cli/src/cursor/**'                         # TEMP-WIDE: owner=01-05-cleanup
  --glob '!cli/src/modules/**'                        # TEMP-WIDE: owner=01-05-cleanup
  --glob '!cli/src/parsers/**'                        # TEMP-WIDE: owner=01-05-cleanup
  --glob '!cli/src/ui/**'                             # TEMP-WIDE: owner=01-05-cleanup
  --glob '!cli/src/utils/**'                          # TEMP-WIDE: owner=01-05-cleanup
  --glob '!cli/src/lib.ts'                            # TEMP-WIDE: owner=01-05-cleanup
  --glob '!hub/src/sync/**'                           # TEMP-WIDE: owner=01-05-cleanup
  --glob '!hub/src/web/routes/**'                     # TEMP-WIDE: owner=01-05-cleanup
  --glob '!hub/README.md'                             # TEMP-WIDE: owner=01-05-cleanup
  --glob '!shared/src/schemas.ts'                     # TEMP-WIDE: owner=01-05-cleanup
  --glob '!shared/src/sessionSummary.ts'              # TEMP-WIDE: owner=01-05-cleanup
  --glob '!shared/src/models.ts'                      # TEMP-WIDE: owner=01-05-cleanup
  --glob '!shared/src/models.test.ts'                 # TEMP-WIDE: owner=01-05-cleanup
  --glob '!shared/src/types.ts'                       # TEMP-WIDE: owner=01-05-cleanup
  --glob '!shared/src/resume.test.ts'                 # TEMP-WIDE: owner=01-05-cleanup
  --glob '!web/src/lib/**'                            # TEMP-WIDE: owner=01-05-cleanup
  --glob '!web/src/api/**'                            # TEMP-WIDE: owner=01-05-cleanup
  --glob '!web/src/chat/**'                           # TEMP-WIDE: owner=01-05-cleanup
  --glob '!web/src/components/**'                     # TEMP-WIDE: owner=01-05-cleanup
  --glob '!web/src/hooks/**'                          # TEMP-WIDE: owner=01-05-cleanup
  --glob '!web/src/realtime/**'                       # TEMP-WIDE: owner=01-05-cleanup
  --glob '!web/src/router.tsx'                        # TEMP-WIDE: owner=01-05-cleanup
  --glob '!web/src/types/**'                          # TEMP-WIDE: owner=01-05-cleanup
  --glob '!web/README.md'                             # TEMP-WIDE: owner=01-05-cleanup
  --glob '!.github/workflows/issue-auto-response.yml' # TEMP-WIDE: owner=01-05-cleanup
  --glob '!README.md'                                 # TEMP-WIDE: owner=01-05-cleanup
  --glob '!CONTRIBUTING.md'                           # TEMP-WIDE: owner=01-05-cleanup
  --glob '!AGENTS.md'                                 # TEMP-WIDE: owner=01-05-cleanup
  --glob '!refactor.md'                               # TEMP-WIDE: owner=01-05-cleanup
  --glob '!.cursor/rules/**'                          # TEMP-WIDE: owner=01-05-cleanup
)
if rg -i "${WHITELIST[@]}" "$PATTERN" .; then
  echo ""
  echo "❌ Non-Cursor agent literals found outside whitelist."
  echo "   Either rewrite the hit Cursor-only, or add an explicit whitelist entry"
  echo "   tagged with its owner-commit (TEMP-CUT-XX / TEMP-WIDE: owner=CUT-XX / 01-05-cleanup)."
  exit 1
fi
echo "✅ No non-Cursor agent literals outside whitelist."
