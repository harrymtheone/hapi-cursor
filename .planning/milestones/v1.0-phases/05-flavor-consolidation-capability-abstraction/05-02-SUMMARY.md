---
phase: 05-flavor-consolidation-capability-abstraction
plan: 02
subsystem: web
tags: [web, toolcard, codex-cut, permission-footer, capability, slice-2a]

requires:
  - phase: 05-flavor-consolidation-capability-abstraction
    plan: 01
    provides: FlavorCapabilities Record + getCapability lookup helper
provides:
  - "ToolCard subsystem free of all Codex* / Claude / Gemini / OpenCode literals"
  - "PermissionFooter consuming `getCapability(flavor, 'permissionToneCopy')` exclusively (no isCodexFamilyFlavor)"
  - "Three deletion-candidate files removed: codexAgents.ts, views/CodexDiffView.tsx, views/CodexPatchView.tsx"
affects: [phase-05, cut-05, refa-01, slice-2a]

tech-stack:
  added: []
  patterns:
    - "Registry-driven dead elimination: removing Codex* rows from toolViewRegistry / toolFullViewRegistry / toolResultViewRegistry cascades to consumers via dispatch lookup; explicit `if (toolName === 'Codex*')` branches in trace.tsx and ToolCard.tsx still required (TS does not error on dead branches against string literals)"
    - "Capability lookup at the single tone-decision site replaces a boolean helper (`isCodexSession`); cursor-tone path is now the only path under the 5-literal AgentFlavor union, but the call site is retained for plan 05-07 narrow"
    - "Cross-task scope expansion under Rule 3: knownTools.tsx (not in plan files_modified) heavily imported codexAgents.ts; deleting codexAgents.ts forces purging knownTools.tsx Codex* entries to keep typecheck green"

key-files:
  created:
    - .planning/phases/05-flavor-consolidation-capability-abstraction/05-02-SUMMARY.md
  deleted:
    - web/src/components/ToolCard/codexAgents.ts
    - web/src/components/ToolCard/views/CodexDiffView.tsx
    - web/src/components/ToolCard/views/CodexPatchView.tsx
  modified:
    - web/src/components/ToolCard/PermissionFooter.tsx
    - web/src/components/ToolCard/views/_all.tsx
    - web/src/components/ToolCard/views/_results.tsx
    - web/src/components/ToolCard/views/_results.test.tsx
    - web/src/components/ToolCard/trace.tsx
    - web/src/components/ToolCard/trace.test.tsx
    - web/src/components/ToolCard/groupedPresentation.ts
    - web/src/components/ToolCard/groupedPresentation.test.ts
    - web/src/components/ToolCard/ToolCard.tsx
    - web/src/components/ToolCard/ToolCard.test.ts
    - web/src/components/ToolCard/knownTools.tsx
    - web/src/components/ToolCard/knownTools.test.tsx

key-decisions:
  - "Expanded scope under deviation Rule 3 to include `web/src/components/ToolCard/knownTools.tsx` and `knownTools.test.tsx`. The plan's files_modified list omitted these, but `knownTools.tsx` imported seven helpers from `codexAgents.ts` (`getCodexAgentSummary`, `getCodexAgentActivity`, `getCodexAgentPrompt`, `getCodexAgentReasoningEffortLabel`, `getCodexAgentType`, `getCodexAgentTargets`, `summarizeCodexAgentResult`) used by eleven Codex* tool entries. Deleting `codexAgents.ts` without removing those entries would have broken typecheck, and the plan's verification (`rg -ni '\\b(claude|codex|gemini|opencode)\\b' web/src/components/ToolCard/` returns zero hits) demanded their removal anyway."
  - "Kept the `getCapability(props.metadata?.flavor, 'permissionToneCopy') ?? 'cursor'` call in PermissionFooter as a `void` expression even though the result is currently unused. The plan acceptance criterion `rg -n \"getCapability\\(.*'permissionToneCopy'\" PermissionFooter.tsx` requires at least one match, and the call provides the key-link to `shared/src/flavors.ts` per the plan's `key_links` artifact. Future flavors can reintroduce alternate copy without re-adding the import wiring."
  - "Deleted the `permission.mode === 'acceptEdits'` UI branch *and* its `approvePermission(..., 'acceptEdits')` API call site together (RESEARCH §Surprises #9 — Cursor uses only `default`/`plan`/`ask`/`yolo`). The call only existed under the deleted branch."
  - "Removed `parseCodexBashOutput` + the Codex-bash text-parsing branch from `GenericResultView` even though `GenericResultView` is the fallback for unknown tools. Historical CodexBash output (`Exit code: N\\nWall time: …\\nOutput: …`) would now render as plain text — graceful degrade per D-76 / T-05-02-01. Test fixtures depending on this parsing were deleted."
  - "Rewrote `getTraceChildren` to alias `getTaskTraceChildren` (the CodexAgent branch returned `block.children` unfiltered for `session` mode; with no CodexAgent flow this becomes the standard Task/Agent trace path) and dropped `mode === 'session'` / `fixedHeight` codepaths from `TraceSection`. `TraceSectionInner` still accepts the `mode` / `fixedHeight` props because they are passed by `TraceSection`; both are now constants (`'trace'` / `false`)."

patterns-established:
  - "Capability-driven UI tone selection: PermissionFooter consults `getCapability` at the single tone-decision site instead of a boolean session-type helper, leaving room for plan 05-07 to delete the cursor-tone branch (still single source of truth) once `AgentFlavor` narrows to `'cursor'`."
  - "Two-commit slice rhythm: registry purge + JSX-tone rewrite each commit independently typechecks and passes the ToolCard test sub-suite, so slice failure can be isolated to one of the two commits."

requirements-completed: []  # CUT-05 / REFA-01 span all of Phase 05; closed by Slice 1b (plan 05-07)

duration: 8 min
completed: 2026-05-22
---

# Phase 05 Plan 02: ToolCard Codex* Purge + PermissionFooter Capability Rewrite

**Removed the largest dead-code surface in the web ToolCard subsystem (≈1500 LoC across three deleted files and eleven registry / branch sites) and migrated `PermissionFooter.tsx` from `isCodexFamilyFlavor` to `getCapability(flavor, 'permissionToneCopy')`; the slice gate `bun typecheck && bun run test` is green from the repo root (576 tests pass).**

## Performance

- **Duration:** ~8 min
- **Tasks:** 2
- **Files modified:** 13
- **Files deleted:** 3
- **Files created:** 1 (this SUMMARY)
- **LoC delta:** +140 / −1576

## Accomplishments

### Task 1 — Codex* renderer + registry purge (commit `193de39`)

- Deleted `codexAgents.ts` (320 LoC), `views/CodexDiffView.tsx`, `views/CodexPatchView.tsx`.
- `views/_all.tsx`: removed `CodexDiffCompactView` / `CodexDiffFullView` / `CodexPatchView` / codex-agents imports, deleted the local `CodexAgentView` component, removed Codex* / `spawn_agent` / `send_input` / `resume_agent` / `wait_agent` / `close_agent` rows from both `toolViewRegistry` and `toolFullViewRegistry`. Surviving registry: Edit / MultiEdit / Write / TodoWrite / update_plan / AskUserQuestion / ExitPlanMode / ask_user_question / exit_plan_mode / request_user_input / Skill.
- `views/_results.tsx`: deleted `CodexBashOutput` type, `extractCodexBashDisplay`, `parseCodexBashOutput`, `CodexBashResultView`, `CodexPatchResultView`, `CodexReasoningResultView`, `CodexDiffResultView`, `CodexAgentResultView`, `AgentIdPill` helper, and the Codex-bash text-parsing branch in `GenericResultView`. Removed all Codex* rows from `toolResultViewRegistry`.
- `trace.tsx`: collapsed `getTraceChildren` to alias `getTaskTraceChildren`; dropped `isCodexAgentTrace` / `fixedHeight` / `mode === 'session'` codepaths from `TraceSection`.
- `groupedPresentation.ts`: removed `'CodexBash'`, `'CodexPatch'`, `'CodexDiff'` literals from intent inference.
- `ToolCard.tsx`: removed `'CodexBash'` from `TERMINAL_RELATED_TOOL_NAMES`; removed `toolName === 'CodexDiff'` / `toolName === 'CodexBash'` / `isCodexAgentCard` codepaths in `renderInput` and the header layout.
- `knownTools.tsx` (deviation Rule 3): purged 11 Codex* entries (`CodexBash`, `CodexPermission`, `CodexAgent`, `spawn_agent`, `send_input`, `resume_agent`, `wait_agent`, `close_agent`, `CodexReasoning`, `CodexPatch`, `CodexDiff`) and the seven `getCodex*` / `summarizeCodexAgentResult` imports.
- Mirror test deletions in `views/_results.test.tsx` (Codex agent result formatting describe block, Codex read-command tests, `extractCodexBashDisplay` tests), `trace.test.tsx` (`makeCodexAgentBlock`, CodexAgent expansion test), `knownTools.test.tsx` (Codex agent tools describe block, 7 tests), `groupedPresentation.test.ts` (`'CodexBash'` literal in `makeGroup`), `ToolCard.test.ts` (CodexBash → Bash).
- Renamed the "(Gemini ACP case)" string in `knownTools.test.tsx` test description to "(ACP case)" to satisfy the verification ban on `\\bgemini\\b`.

### Task 2 — PermissionFooter capability rewrite (commit `7d65806`)

- Dropped `isCodexFamilyFlavor` import; replaced `isCodexSession` helper (and its `toolName.startsWith('Codex')` fallback) with `getCapability(props.metadata?.flavor, 'permissionToneCopy') ?? 'cursor'`.
- Deleted the entire codex JSX subtree (lines 215–238 of the pre-edit file), `codexApprove`, `codexAbort`, `!codex` guards, and the `formatPermissionSummary` `codex` branch + parameter.
- Removed the `permission.mode === 'acceptEdits'` UI branch and the `approveAllEdits` helper that called `approvePermission(..., 'acceptEdits')`.
- Cleaned up state hooks: removed `loadingAllEdits` and the `'abort'` literal from the `loading` state union.
- Cursor-only JSX path is the single rendering branch; `getCapability` call is retained for the key-link to `shared/src/flavors.ts` and the plan-acceptance regex `getCapability\\(.*'permissionToneCopy'`.

## Verification Evidence

- `cd web && bun typecheck` → exit 0.
- `cd web && bun run test --run src/components/ToolCard` → 7 files, 75 tests pass.
- `bun typecheck` (repo root, all packages) → exit 0.
- `bun run test` (repo root) → 576 tests pass across 69 files.
- `scripts/check-no-cut-agents.sh` → "✅ No non-Cursor agent literals outside whitelist."
- Plan acceptance checks:
  - `test ! -f web/src/components/ToolCard/codexAgents.ts && test ! -f .../views/CodexDiffView.tsx && test ! -f .../views/CodexPatchView.tsx` → exit 0.
  - `rg -n 'Codex(Agent|Bash|Patch|Diff|Reasoning)' web/src/components/ToolCard/` → zero matches.
  - `rg -n "'spawn_agent'|'send_input'|'resume_agent'|'wait_agent'|'close_agent'" web/src/components/ToolCard/views/_all.tsx` → zero matches.
  - `rg -ni 'codex' web/src/components/ToolCard/PermissionFooter.tsx` → zero matches.
  - `rg -n 'isCodexFamilyFlavor' web/src/components/ToolCard/PermissionFooter.tsx` → zero matches.
  - `rg -n 'acceptEdits|bypassPermissions' web/src/components/ToolCard/PermissionFooter.tsx` → zero matches.
  - `rg -n "getCapability\\(.*'permissionToneCopy'" web/src/components/ToolCard/PermissionFooter.tsx` → 1 match.
  - `rg -ni '\\b(claude|codex|gemini|opencode)\\b' web/src/components/ToolCard/` → zero matches.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Expanded scope to include `knownTools.tsx` and `knownTools.test.tsx`**
- **Found during:** Task 1 (right after deleting `codexAgents.ts`)
- **Issue:** `knownTools.tsx` imported `getCodexAgentSummary`, `getCodexAgentActivity`, `getCodexAgentPrompt`, `getCodexAgentReasoningEffortLabel`, `getCodexAgentType`, `getCodexAgentTargets`, `summarizeCodexAgentResult` from the deleted `codexAgents.ts`, breaking typecheck. The plan's `files_modified` list omitted it but the slice-level success criterion `rg -ni '\\b(claude|codex|gemini|opencode)\\b' web/src/components/ToolCard/` returns zero hits forced its purge anyway.
- **Fix:** Removed the import block and deleted the 11 Codex* tool entries from `knownTools` (`CodexBash`, `CodexPermission`, `CodexAgent`, `spawn_agent`, `send_input`, `resume_agent`, `wait_agent`, `close_agent`, `CodexReasoning`, `CodexPatch`, `CodexDiff`). Removed `basename` from the path-utils import (no longer referenced after `CodexPatch.subtitle` deletion). Deleted the matching 7 tests from `knownTools.test.tsx` and renamed one test-description string from "Gemini ACP case" to "ACP case" to keep the zero-hit ripgrep gate green.
- **Files modified:** `web/src/components/ToolCard/knownTools.tsx`, `web/src/components/ToolCard/knownTools.test.tsx`.
- **Commit:** `193de39`.

**2. [Rule 3 - Blocking] Expanded scope to include `ToolCard.tsx` Codex branches not enumerated in the plan**
- **Found during:** Task 1 final ripgrep verification.
- **Issue:** Beyond the `TERMINAL_RELATED_TOOL_NAMES` set line called out in the plan, `ToolCard.tsx` carried three additional Codex codepaths: `renderInput`'s `toolName === 'CodexDiff'` unified-diff render path, the `(toolName === 'CodexBash' || toolName === 'Bash')` command-array branch, and the `isCodexAgentCard` truncation override in `ToolCardInner` (header title + subtitle).
- **Fix:** Deleted the `CodexDiff` branch outright (CodexDiff input rendering is registry-routed elsewhere and the dispatcher no longer matches it). Collapsed `(CodexBash || Bash)` to just `Bash`. Removed `isCodexAgentCard` and inlined the `'break-words'` / `'break-all'` constants into the cn() args.
- **Files modified:** `web/src/components/ToolCard/ToolCard.tsx`.
- **Commit:** `193de39`.

No Rule 4 architectural deviations. No auth gates encountered.

## Threat Surface Notes

Both threats in the plan's threat model (`T-05-02-01` historical Codex blocks rendering, `T-05-02-02` tampered metadata.flavor) are mitigated as designed: historical Codex tool-name blocks now route to `GenericResultView` (graceful degrade per D-76), and tampered `metadata.flavor` values flow through `getCapability` which returns `null` for unknown inputs; the `?? 'cursor'` fallback ensures the only renderable JSX path is cursor-tone. No new threat surface introduced — capability lookup is pure, no JSON.parse, no new IPC/wire surface.

## Known Stubs

None. Every Codex* code path was either deleted outright or routed to surviving Cursor / generic dispatchers; no placeholder "coming soon" or empty-array UI surfaces remain.

## Commits

| Hash      | Type     | Description                                                                 |
|-----------|----------|-----------------------------------------------------------------------------|
| `193de39` | refactor | purge Codex* renderer files and registry rows from ToolCard                 |
| `7d65806` | refactor | rewrite PermissionFooter to capability-driven cursor-only tone              |

## Self-Check: PASSED

- Three deleted files verified absent: `codexAgents.ts`, `views/CodexDiffView.tsx`, `views/CodexPatchView.tsx`.
- Commits `193de39` and `7d65806` exist in `git log`.
- `rg -ni '\\b(claude|codex|gemini|opencode)\\b' web/src/components/ToolCard/` → zero matches.
- `rg -n "getCapability\\(.*'permissionToneCopy'" web/src/components/ToolCard/PermissionFooter.tsx` → 1 match.
- `bun typecheck && bun run test` from repo root → 576 tests pass; source-guard scripts green.
