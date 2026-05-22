---
phase: 05-flavor-consolidation-capability-abstraction
plan: 08
subsystem: scripts
tags: [refactor, cut-non-cursor, capability-abstraction, guard-script, slice-4, phase-gate]
requires:
  - "Plans 05-01 through 05-07 complete (all consumer slices migrated; AgentFlavor narrowed to 'cursor' in shared/)"
provides:
  - "scripts/check-no-cut-agents.sh: Phase-5 territory whitelist collapsed to zero entries"
  - "scripts/check-no-cut-agents.sh: line-anchored post-filter for AGENT_MESSAGE_PAYLOAD_TYPE wire literal (D-85)"
  - "scripts/check-no-cut-agents.sh: PHASE5_IDENTIFIER_PATTERN sweep over cli/src hub/src web/src shared/src"
  - "scripts/check-no-cut-agents.sh: PHASE5_BRANCH_PATTERN sweep for non-cursor `flavor === '<literal>'` branches"
  - "Phase 5 success criteria SC#1, SC#2, SC#3, SC#4 all met (final phase gate green)"
affects:
  - "shared/src/flavors.ts: permissionToneCopy slot type narrowed from `'cursor' | 'codex'` to `'cursor'` (cross-plan correction surfaced by Task-1 guard run)"
  - "shared/src/flavors.test.ts: cases 14 + 17 inputs swapped from `'claude'` to `'unknown-flavor'` (cross-plan correction; test intent preserved)"
  - ".planning/phases/05-flavor-consolidation-capability-abstraction/05-VALIDATION.md: nyquist_compliant flipped to true; sign-off approved"
tech-stack:
  added: []
  patterns:
    - "Sibling-block guard structure (mirrors Phase 3 / Phase 4): each new sweep gets its own pattern constant, its own rg invocation, and its own ✅/❌ message pair"
    - "Line-anchored post-filter (D-85): `grep -v 'shared/src/modes.ts:.*AGENT_MESSAGE_PAYLOAD_TYPE = ...'` survives line-position drift because it pins on JSDoc-anchored content, not a fixed line number"
    - "Cross-plan correction (Rule 1): residue surfaced when removing the whitelist gets fixed at the source rather than re-added to the whitelist"
key-files:
  created:
    - .planning/phases/05-flavor-consolidation-capability-abstraction/05-08-SUMMARY.md
  deleted: []
  modified:
    - scripts/check-no-cut-agents.sh
    - shared/src/flavors.ts
    - shared/src/flavors.test.ts
    - .planning/phases/05-flavor-consolidation-capability-abstraction/05-VALIDATION.md
    - .planning/ROADMAP.md
    - .planning/STATE.md
decisions:
  - "Cross-plan correction over whitelist extension. Plan §<action> explicitly says: 'If a residue is found that the post-filter doesn't catch, treat it as a regression in plans 02–07 (cross-plan correction): do NOT add a new whitelist entry for it.' Three residues remained after Task 1 (Phase-5 whitelist deletion): (a) `shared/src/flavors.ts:24` had `permissionToneCopy: 'cursor' | 'codex'` — narrowed the union to `'cursor'` only (consumer in `web/src/components/ToolCard/PermissionFooter.tsx:94` uses `?? 'cursor'`, so the narrower return type is type-safe and preserves D-76 graceful-degrade); (b) `shared/src/flavors.test.ts:89-90, 104-105` (cases 14 + 17) used the literal `'claude'` as a Nyquist witness for 'non-cursor strings rejected' — swapped to `'unknown-flavor'`, which preserves the same coverage (the test asserts that any unknown string is rejected, not specifically that the legacy flavor name 'claude' is rejected; the type system already enforces the latter)."
  - "Tightened the `flavor === '<literal>'` branch sweep with a typeof post-filter. The naïve `flavor\\s*===\\s*['\"]` pattern recommended by RESEARCH lines 437–444 also matches the legitimate JS runtime check `typeof flavor === 'string'` in `shared/src/flavors.ts::isKnownFlavor`. Added a second post-filter clause (`grep -v \"typeof flavor ===\"`) to exclude runtime-type checks; kept the simple pattern declaration so Plan §<acceptance_criteria> Task 2 regex `flavor\\\\s\\*===\\\\s\\*\\['\\\"\\]` still matches the script source. The post-filter intent matches the plan's spirit ('non-cursor literal branches'): typeof checks are JavaScript syntax, not flavor branching."
  - "Combined the Task-1 cross-plan corrections (`flavors.ts` slot narrow + `flavors.test.ts` case-14/17 input swap) into the Task-1 commit rather than splitting into a separate cross-plan commit. The corrections are causally tied to Task 1 (they only surfaced because Task 1 deleted the whitelist) and the commit message documents both as Rule-1 deviations for traceability."
metrics:
  duration: 6min
  completed: 2026-05-22
  task_count: 3
  file_count: 6
---

# Phase 5 Plan 8: Flavor consolidation slice 4 (guard collapse + phase gate) Summary

One-liner: `scripts/check-no-cut-agents.sh` Phase-5 territory whitelist collapsed to zero entries; line-anchored post-filter for the wire-protocol legacy literal `AGENT_MESSAGE_PAYLOAD_TYPE = 'codex' as const` at `shared/src/modes.ts:9` (D-85); two new sibling-block sweeps (`PHASE5_IDENTIFIER_PATTERN` + `PHASE5_BRANCH_PATTERN`) over `cli/src hub/src web/src shared/src` reject any future re-introduction of `isCodexFamilyFlavor` / `CodexCollaborationMode` / `getCodexCollaboration*` / `(CLAUDE|CODEX|GEMINI|OPENCODE)_PERMISSION_MODES` identifiers and any non-cursor `flavor === '<literal>'` branches; final phase gate `bun typecheck && bun run test && bash scripts/check-no-cut-agents.sh` exits 0 (532 tests).

## What Changed

### Whitelist diff — `scripts/check-no-cut-agents.sh`

- **Removed (Task 1):** the entire `# === Phase-5 territory` block — 70 `--glob '!<path>'` entries spanning 4 sub-categories (shared union surface, hub union consumers, cli union consumers, web union consumers). Net file delta: 188 deletions / 122 insertions.
- **Kept verbatim:** infra entries (`.planning/`, `CHANGELOG.md`, `**/.gitignore`, `node_modules/`, `dist/`, `bun.lock`, `.git/`, guard self-exclusion); Phase-12 deferred entries (`cli/NOTICE`, `cli/README.md`, `hub/README.md`, `web/README.md`, `docs/`, `website/`, `README.md`, `CONTRIBUTING.md`, `AGENTS.md`, `CLAUDE.md`, `refactor.md`, `.cursor/rules/`); the `RG_BIN` resolver; the top-level `PATTERN`; Phase-3 (`PHASE3_PATTERN`) and Phase-4 (`PHASE4_HARD_PATTERN` / `PHASE4_SWEEP_PATTERN`) sibling blocks plus their `PHASE4_WHITELIST`.

### New sibling-block excerpts (Task 1 + Task 2)

Main `PATTERN` sweep with line-anchored post-filter (Task 1):

```bash
SURVIVORS=$("$RG_BIN" -n -i "${WHITELIST[@]}" "$PATTERN" . || true)
SURVIVORS_FILTERED=$(echo "$SURVIVORS" | grep -v "shared/src/modes.ts:.*AGENT_MESSAGE_PAYLOAD_TYPE = 'codex' as const" || true)
if [ -n "$SURVIVORS_FILTERED" ]; then
  echo "$SURVIVORS_FILTERED"
  echo ""
  echo "❌ Non-Cursor / external-channel literals found outside whitelist."
  ...
  exit 1
fi
echo "✅ No non-Cursor agent literals outside whitelist (Phase-5 territory collapsed; only AGENT_MESSAGE_PAYLOAD_TYPE wire literal allowed)."
```

`PHASE5_IDENTIFIER_PATTERN` sweep (Task 2):

```bash
PHASE5_IDENTIFIER_PATTERN='\bisCodexFamilyFlavor\b|\bCodexCollaborationMode\b|\bgetCodexCollaboration\w*\b|\b(CLAUDE|CODEX|GEMINI|OPENCODE)_PERMISSION_MODES\b'
PHASE5_SOURCE_DIRS=(cli/src hub/src web/src shared/src)

if "$RG_BIN" -n "$PHASE5_IDENTIFIER_PATTERN" "${PHASE5_SOURCE_DIRS[@]}"; then
  echo ""
  echo "❌ Phase-5 legacy flavor identifier residue found in runtime source scope."
  ...
  exit 1
fi
echo "✅ No Phase-5 legacy flavor identifiers in source scope."
```

`PHASE5_BRANCH_PATTERN` sweep with cursor-narrow + typeof post-filter (Task 2):

```bash
PHASE5_BRANCH_PATTERN='flavor\s*===\s*['\''"]'

FLAVOR_BRANCH=$("$RG_BIN" -n "$PHASE5_BRANCH_PATTERN" "${PHASE5_SOURCE_DIRS[@]}" || true)
FLAVOR_BRANCH_FILTERED=$(echo "$FLAVOR_BRANCH" | grep -v "=== 'cursor'" | grep -v "typeof flavor ===" || true)
if [ -n "$FLAVOR_BRANCH_FILTERED" ]; then
  echo "$FLAVOR_BRANCH_FILTERED"
  echo ""
  echo "❌ Non-cursor flavor === '<literal>' branch residue found in runtime source scope."
  ...
  exit 1
fi
echo "✅ No non-cursor flavor === '<literal>' branches in source scope."
```

### Cross-plan corrections (Task 1 deviations — Rule 1)

Two regressions surfaced when the Phase-5 whitelist was deleted:

1. **`shared/src/flavors.ts:24`** — `permissionToneCopy: 'cursor' | 'codex'` narrowed to `'cursor'`. The `'codex'` tone label was a placeholder for a future second tone style; with `AgentFlavor` narrowed to `'cursor'` in plan 05-07, the union has only one inhabitant. Consumer at `web/src/components/ToolCard/PermissionFooter.tsx:94` uses `getCapability(...) ?? 'cursor'`, so the narrowed return type is safe.
2. **`shared/src/flavors.test.ts:89-90, 104-105` (cases 14 + 17)** — input literal `'claude'` swapped to `'unknown-flavor'`. The tests assert that `getFlavorLabel(non-cursor)` returns `'Unknown'` and `isKnownFlavor(non-cursor)` returns `false`; the test intent (graceful degrade for unknown strings) is preserved. The literal `'claude'` was only a Nyquist witness for legacy flavor names — the type system now enforces that constraint, so the runtime test only needs to cover "any unknown string."

## Phase Gate Result (Task 3)

| Command | Exit Code | Notes |
|---------|-----------|-------|
| `bun typecheck` | 0 | cli + web + hub typecheck all green |
| `bun run test` | 0 | 532 tests pass across 62 test files (shared + cli + hub + web) |
| `bash scripts/check-no-cut-agents.sh` | 0 | All 5 sweeps green: main + Phase-3 + Phase-4 hard + Phase-4 sweep + Phase-5 identifier + Phase-5 branch |

## Phase 5 Success Criteria (SC#1–#4 Verification)

- **SC#1 — `AgentFlavor` narrowed to `'cursor'`:** `rg -n "export type AgentFlavor\\s*=\\s*'cursor'" shared/src/modes.ts` → 1 hit (line 19, plan 05-07). ✅
- **SC#2 — `FLAVOR_CAPS` cursor-only with all 7 D-73 slots:** `rg -n "cursor:\\s*\\{" shared/src/flavors.ts` → 1 hit (line 30); `rg -n "claude:\\s*\\{|codex:\\s*\\{|gemini:\\s*\\{|opencode:\\s*\\{" shared/src/flavors.ts` → 0 hits. All 7 slots populated per CONTEXT.md (`permissionModes=CURSOR_PERMISSION_MODES`, `supportsModelChange=false`, `supportsEffort=false`, `contextBudgetTokens=null`, `userSlashCommandsDir=null`, `projectSlashCommandsDir=null`, `permissionToneCopy='cursor'`). ✅
- **SC#3 — Zero hardcoded `flavor === '<non-cursor>'` / capability gates:** all three guard sweeps (main + identifier + branch) green; zero hits in `cli/src hub/src web/src shared/src` for any of `\b(claude|codex|gemini|opencode)\b` (post-filter exempt: 1 wire-literal line) or `\bisCodexFamilyFlavor\b|\bCodexCollaborationMode\b|\bgetCodexCollaboration\w*\b|\b(CLAUDE|CODEX|GEMINI|OPENCODE)_PERMISSION_MODES\b` or `flavor === '<non-cursor>'`. ✅
- **SC#4 — `flavors.test.ts` covers the 23 D-87 cases:** 23 test cases present (cases 1–23 retained; cases 14 + 17 inputs swapped to `'unknown-flavor'`, test intent preserved); `cd shared && bun run test flavors.test.ts` passes. ✅

`build:single-exe` was NOT run per D-88 (deferred to Phase 12 milestone gate).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Cross-plan correction: narrow `permissionToneCopy` slot type**
- **Found during:** Task 1 (guard run after whitelist deletion)
- **Issue:** `shared/src/flavors.ts:24` declared `permissionToneCopy: 'cursor' | 'codex'`. The literal `'codex'` tripped the main `PATTERN` sweep with the Phase-5 whitelist gone. Plan §<action> directs cross-plan correction at the source.
- **Fix:** Narrowed the union to `'cursor'` only. Consumer at `PermissionFooter.tsx:94` uses `?? 'cursor'`, so the narrower return type is safe.
- **Files modified:** shared/src/flavors.ts
- **Commit:** see Task 1 commit (refactor(05-08): collapse Phase-5 guard whitelist + post-filter wire literal)

**2. [Rule 1 - Bug] Cross-plan correction: swap `'claude'` literals in test cases 14 + 17**
- **Found during:** Task 1 (guard run after whitelist deletion)
- **Issue:** `shared/src/flavors.test.ts` cases 14 (line 89-90) and 17 (line 104-105) used the literal `'claude'` as input to `getFlavorLabel` / `isKnownFlavor`. The literals tripped the main `PATTERN` sweep with the Phase-5 whitelist gone.
- **Fix:** Swapped the input literal from `'claude'` to `'unknown-flavor'`. Test intent (any non-cursor string returns `'Unknown'` / `false`) is preserved; the type system already enforces that legacy flavor names cannot be passed at compile time.
- **Files modified:** shared/src/flavors.test.ts
- **Commit:** see Task 1 commit

**3. [Rule 3 - Blocker] Tighten `PHASE5_BRANCH_PATTERN` post-filter to exclude `typeof` runtime-type checks**
- **Found during:** Task 2 (sibling-block addition; first guard run flagged `shared/src/flavors.ts:48` `typeof flavor === 'string'`)
- **Issue:** The naïve regex `flavor\s*===\s*['"]` recommended in RESEARCH lines 437–444 also matches the legitimate JS runtime check `typeof flavor === 'string'` in `isKnownFlavor`. The plan's spirit (catch non-cursor flavor branches) does not target JS runtime-type syntax.
- **Fix:** Added `| grep -v "typeof flavor ==="` to the post-filter chain (alongside the cursor-narrow `=== 'cursor'` exemption). Plan acceptance regex (`flavor\\\\s\\*===\\\\s\\*\\['\\\"\\]`) still matches the unmodified pattern declaration in the script.
- **Files modified:** scripts/check-no-cut-agents.sh
- **Commit:** see Task 2 commit (refactor(05-08): add Phase-5 identifier + flavor-branch sibling sweeps)

### Authentication Gates

None.

### Architectural Changes Required

None.

## Threat Flags

None — no new network endpoints, auth paths, file access patterns, or schema changes introduced. The two new guard sweeps strengthen the existing trust boundary (guard ↔ source tree) per the plan's threat model T-05-08-01 + T-05-08-02 mitigations.

## Known Stubs

None.

## Self-Check: PASSED

- ✅ `scripts/check-no-cut-agents.sh` exists; final state matches `/tmp/final-script.sh`.
- ✅ `shared/src/flavors.ts` exists; `permissionToneCopy: 'cursor'` (no `| 'codex'`).
- ✅ `shared/src/flavors.test.ts` exists; cases 14 + 17 use `'unknown-flavor'`.
- ✅ Task 1 commit `5fdcf94` exists in `git log`.
- ✅ Task 2 commit `74ec209` exists in `git log`.
- ✅ Phase-gate verification: `bun typecheck` + `bun run test` (532 tests) + `bash scripts/check-no-cut-agents.sh` all exit 0.
- ✅ `.planning/phases/05-flavor-consolidation-capability-abstraction/05-VALIDATION.md` `nyquist_compliant: true` flipped; sign-off approved.
