---
phase: 05-flavor-consolidation-capability-abstraction
plan: 03
subsystem: web
tags: [web, newsession, assistantchat, sessionchat, sessionlist, codex-cut, slice-2b]

requires:
  - phase: 05-flavor-consolidation-capability-abstraction
    plan: 02
    provides: ToolCard Codex* surface deleted; PermissionFooter on capability lookup
provides:
  - "NewSession tree contains no `claude` / `codex` / `gemini` / `opencode` literals; `AgentType` narrowed to `'cursor'`; `AgentSelector` deleted (single-agent UI has no choice)."
  - "AssistantChat StatusBar / HappyComposer / messages free of `CodexCollaborationMode*` imports and `agentFlavor === 'codex'` branches; settings overlay reduced to permission + model dimensions."
  - "SessionChat free of Codex collaboration plumbing (`CodexCollaborationMode`, `useCodexModels`, `CodexAgent` rendering, `setCollaborationMode` consumer)."
  - "SessionList `FLAVOR_BADGES` collapses to a single `cursor` row; `FlavorIcon` defaults to cursor."
affects: [phase-05, cut-05, refa-01, slice-2b]

tech-stack:
  added: []
  patterns:
    - "Cursor-only UI collapse pattern: drop selector files outright, narrow union types, replace per-flavor branches with the cursor path inline; downstream UI dead-eliminates without leaving stubs."
    - "Settings overlay simplified from 5-dimension (collaboration / permission / model / reasoning-effort / effort) to 2-dimension (permission / model) — composer surface area reduced ~200 LoC of JSX."

key-files:
  created:
    - .planning/phases/05-flavor-consolidation-capability-abstraction/05-03-SUMMARY.md
  deleted:
    - web/src/components/NewSession/AgentSelector.tsx
    - web/src/components/NewSession/preferences.ts
    - web/src/components/NewSession/preferences.test.ts
    - web/src/components/NewSession/ClaudeEffortSelector.tsx
    - web/src/components/NewSession/ReasoningEffortSelector.tsx
    - web/src/components/NewSession/types.test.ts
    - web/src/components/AssistantChat/codexReasoningEffortOptions.ts
    - web/src/components/AssistantChat/codexReasoningEffortOptions.test.ts
    - web/src/components/AssistantChat/claudeEffortOptions.ts
    - web/src/components/AssistantChat/claudeEffortOptions.test.ts
    - web/src/components/AssistantChat/claudeModelOptions.ts
    - web/src/components/AssistantChat/claudeModelOptions.test.ts
    - web/src/components/AssistantChat/messages/CodexReviewCard.tsx
    - web/src/components/AssistantChat/messages/CodexReviewCard.test.tsx
  modified:
    - web/src/components/NewSession/types.ts
    - web/src/components/NewSession/index.tsx
    - web/src/components/AssistantChat/StatusBar.tsx
    - web/src/components/AssistantChat/HappyComposer.tsx
    - web/src/components/AssistantChat/modelOptions.ts
    - web/src/components/AssistantChat/modelOptions.test.ts
    - web/src/components/AssistantChat/messages/AssistantMessage.tsx
    - web/src/components/AssistantChat/messages/MessageMetadata.test.ts
    - web/src/components/AssistantChat/QueuedMessagesBar.tsx
    - web/src/components/SessionChat.tsx
    - web/src/components/SessionList.tsx
    - web/src/components/SessionList.test.ts
    - web/src/components/SessionList.directory-action.test.tsx

key-decisions:
  - "Hardcoded `agent = 'cursor'` inline in `NewSession/index.tsx` instead of keeping `useState<AgentType>` since the union narrows to a single literal — removes the useEffect that reset model/effort on agent change."
  - "Deleted entire `preferences.{ts,test.ts}` module (4 helpers) rather than keep `loadPreferredYoloMode`/`savePreferredYoloMode` — yolo state now uses a plain `useState(false)`; localStorage persistence isn't worth a dedicated module for a single boolean."
  - "Kept the `ModelSelector` component in the NewSession tree even though `MODEL_OPTIONS.cursor = []` makes it render `null`; downstream `CURS-01 / Milestone 2` work will populate cursor model options, and removing the selector now would force re-wiring then."
  - "Rewrote `modelOptions.ts` to a custom-options-only contract (no per-flavor fallback) — when `availableModelOptions` is undefined the helper now returns `[]`. The previous claude-default fallback evaporated with `claudeModelOptions.ts`; future cursor models flow through `availableModelOptions` from the session metadata."
  - "Deleted `hasAbortableAgentRun` from SessionChat outright — it only matched `block.tool.name === 'CodexAgent'`. With the ToolCard registry purged (plan 05-02) and AgentType narrowed to cursor, no spawned-agent flow remains. `isRunning` now reduces to `props.session.thinking` only."
  - "Rewrote 4 `claude-sonnet-4-6` / `claude-haiku-4-5-20251001` literals in `MessageMetadata.test.ts` to flavor-neutral `cursor-model-x` / `cursor-model-y` so the slice-wide `\\b(claude|codex|gemini|opencode)\\b` zero-hit gate passes — model id strings inside test fixtures are not real consumer references but the gate is regex-only."
  - "Touched `QueuedMessagesBar.tsx` JSDoc comment (`Codex dialect` → unqualified) under Rule 3 — the comment matched the slice-wide zero-hit gate; no behavior change."
  - "`useCodexModels` hook left in place under `web/src/hooks/queries/` — plan 04 owns the chat/lib/hooks/api layer; this slice only deletes its callers (NewSession + SessionChat)."
  - "Removed `collaborationMode`, `modelReasoningEffort` prop wiring from `HappyComposer` JSX in SessionChat AND from the `HappyComposer` props interface itself; the `effort` / `onEffortChange` channel was kept (general per-message UI dimension)."

patterns-established:
  - "Slice-wide ripgrep gate (`\\b(claude|codex|gemini|opencode)\\b`) catches not just source references but JSDoc / test fixture strings — sweep comments + test data before declaring a flavor-collapse slice complete."
  - "When narrowing a union to a single literal, hardcode the value at the call site rather than keep a `useState<NarrowedUnion>` — eliminates dead `useEffect` / `useCallback` deps that were only there to react to a now-impossible flavor switch."

requirements-completed: []  # CUT-05 / REFA-01 span all of Phase 05; closed by Slice 1b (plan 05-07)

duration: 10 min
completed: 2026-05-22
---

# Phase 05 Plan 03: NewSession / AssistantChat / SessionList Cursor-Only Collapse (Slice 2b)

**Collapsed the NewSession + AssistantChat + SessionList web subtrees to cursor-only by deleting 14 dead files (~1100 LoC) and rewriting 8 consumer files; narrowed `AgentType` to `'cursor'`, dropped `getCodexCollaborationMode*` consumers from StatusBar + HappyComposer, removed Codex* collaboration / model-reasoning plumbing from SessionChat, and collapsed the SessionList `FLAVOR_BADGES` map to a single `cursor` row. Slice gate `bun typecheck && bun run test` is green from the repo root (560 tests pass) and the source-guard scripts (`check-no-cut-agents.sh`, namespace, deployment-infrastructure) remain green.**

## Performance

- **Duration:** ~10 min
- **Tasks:** 3
- **Files deleted:** 14
- **Files modified:** 13
- **Files created:** 1 (this SUMMARY)
- **LoC delta:** +37 / −339 (Task 2) + +8 / −110 (Task 3) + ~−1100 deletions (Task 1) ≈ **−1500 LoC**

## Accomplishments

### Task 1 — NewSession + AssistantChat dead-file purge + `AgentType` narrow (commit `7508829`)

- Deleted `web/src/components/NewSession/{AgentSelector,ClaudeEffortSelector,ReasoningEffortSelector,preferences,preferences.test,types.test}` (6 files, ~530 LoC).
- Deleted `web/src/components/AssistantChat/{claudeModelOptions,claudeModelOptions.test,claudeEffortOptions,claudeEffortOptions.test,codexReasoningEffortOptions,codexReasoningEffortOptions.test}` (6 files, ~570 LoC).
- Deleted `web/src/components/AssistantChat/messages/CodexReviewCard{,.test}` (2 files, ~800 LoC).
- `NewSession/types.ts`: narrowed `AgentType` from 5-literal union to `'cursor'`; deleted `CodexReasoningEffort` / `ClaudeEffort` type aliases and `CODEX_REASONING_EFFORT_OPTIONS` / `CLAUDE_EFFORT_OPTIONS` arrays; `MODEL_OPTIONS` collapsed to `{ cursor: [] }`.
- `NewSession/index.tsx`: hardcoded `agent: 'cursor'` at spawn call, dropped `useCodexModels` + `codexModelOptions` memo, dropped imports of all five deleted components + `preferences` helpers; YoloToggle state now uses plain `useState(false)` (preferences persistence deleted with the file).
- The `OpencodeModelSelector.tsx` / `opencodeModelsGate.{ts,test.ts}` files listed in the plan did not exist on disk (already gone in an earlier slice or never created); the plan's deletion list was a superset.

### Task 2 — AssistantChat StatusBar + HappyComposer + modelOptions cursor-only (commit `258be71`)

- `StatusBar.tsx`: dropped `getCodexCollaborationModeLabel` import + `CodexCollaborationMode` type import, deleted `formatCodexReasoningLabel` / `isCodexFastMode` helpers (lines 114-128), deleted `displayCollaborationMode` / `collaborationModeLabel` / `codexReasoningLabel` / `codexFastMode` / `goalLabel` branches (lines 189-205) and their JSX (lines 236-255). `agentFlavor` prop remains for context-budget lookup; `collaborationMode`, `threadGoal`, `modelReasoningEffort` props removed.
- `HappyComposer.tsx`: dropped `getCodexCollaborationModeOptions` import and `CodexCollaborationMode` type; deleted `collaborationMode` prop, `onCollaborationModeChange`, `handleCollaborationChange`, `collaborationModeOptions` memo, `codexReasoningEffortOptions` memo, `claudeEffortOptions` memo, `handleModelReasoningEffortChange`, `handleEffortChange`, `showCollaborationSettings`, `showModelReasoningEffortSettings`, `showEffortSettings`. Settings overlay reduced from 5 sections (collaboration / permission / model / reasoning-effort / effort) to 2 (permission / model).
- `modelOptions.ts`: removed `claudeModelOptions` import and the per-flavor fallback; `ModelOption` is the local cursor-friendly `{ value: string | null; label: string }` shape; `getModelOptionsForFlavor` returns `[]` when no `customOptions` are supplied. Rewrote tests to cover only the cursor / custom-options paths.
- `AssistantMessage.tsx`: dropped `CodexReviewCard` import + the entire `if (codexReview)` rendering branch (~40 lines of JSX). The `codex-review` block kind still flows through `chat/reducerTimeline.ts` → `lib/assistant-runtime.ts` (owned by plan 05-04); AssistantMessage now drops it on the floor and a future plan 05-04 will remove the chat-layer plumbing.
- `MessageMetadata.test.ts`: rewrote `claude-sonnet-4-6` / `claude-haiku-4-5-20251001` model fixtures to `cursor-model-x` / `cursor-model-y` for the slice-wide regex gate.
- `SessionChat.tsx`: minimal follow-on prop drop (`collaborationMode` / `onCollaborationModeChange`) to keep Task 2 typecheck green; full SessionChat overhaul lands in Task 3.

### Task 3 — SessionChat + SessionList cursor collapse (commit `429471e`)

- `SessionChat.tsx`: dropped `CodexCollaborationMode` import, `useCodexModels` import + its call site + `codexModelOptions` memo, `codexCollaborationModeSupported` flag, `setCollaborationMode` + `setModelReasoningEffort` pulls from `useSessionActions`, `handleCollaborationModeChange` + `handleModelReasoningEffortChange`, the `useTranslation` `t` (now unused), the `hasAbortableAgentRun` recursive helper (only matched `block.tool.name === 'CodexAgent'`), the `codexModelsState.error` toast container. `useHappyRuntime`'s `isRunning` simplified from `(thinking || hasRunningChildAgent)` to `thinking`. HappyComposer call simplified to cursor-only props (`modelReasoningEffort` and `availableModelOptions` removed; `onModelChange` no longer branches on flavor).
- `SessionList.tsx`: `FLAVOR_BADGES` collapsed from 4-entry (`claude` / `codex` / `cursor` / `gemini`) to single `cursor` row; `FlavorIcon` resolution chain simplified — `(flavor ?? 'cursor')` lookup with cursor fallback.
- `SessionList.test.ts` + `SessionList.directory-action.test.tsx`: rewrote `flavor: 'codex'` fixtures to `flavor: 'cursor'`.
- `QueuedMessagesBar.tsx`: dropped `Codex dialect` from the JSDoc comment under Rule 3 (the slice-wide ripgrep gate matched it).

## Verification Evidence

- `bun typecheck` (repo root, all 3 packages) → exit 0.
- `bun run test` (repo root) → 560 tests pass across 63 files.
- `cd web && bun typecheck` → exit 0.
- `cd web && bun run test --run src/components/AssistantChat` → 85 tests pass.
- `scripts/check-no-cut-agents.sh` → "✅ No non-Cursor agent literals outside whitelist." (also Phase-3 namespace + Phase-4 deployment-infrastructure scans green).
- Plan acceptance checks:
  - Task 1: each deletion-candidate file path returns `test ! -f <path>` exit 0; `rg "type AgentType = 'cursor'" web/src/components/NewSession/types.ts` → 1 match; `rg -ni '\b(claude|codex|gemini|opencode)\b' web/src/components/NewSession/` → zero matches.
  - Task 2: `rg -n 'getCodexCollaborationMode|CodexCollaborationMode' web/src/components/AssistantChat/` → zero matches; `rg -n "agentFlavor === 'codex'|agentFlavor !== 'codex'" web/src/components/AssistantChat/` → zero matches; `rg -n 'formatCodexReasoningLabel|isCodexFastMode' web/src/components/AssistantChat/` → zero matches.
  - Task 3: `rg -n 'CodexCollaborationMode|CodexAgent|handleCollaborationModeChange' web/src/components/SessionChat.tsx` → zero matches; `rg -n "agentFlavor [!=]== '(codex|claude|gemini|opencode)'" web/src/components/SessionChat.tsx` → zero matches; `rg -n 'FLAVOR_BADGES' web/src/components/SessionList.tsx` → single `cursor` row; `rg -n "flavor: '(codex|claude|gemini|opencode)'" web/src/components/SessionList.test.ts web/src/components/SessionList.directory-action.test.tsx` → zero matches.
  - Slice gate: `rg -ni '\b(claude|codex|gemini|opencode)\b' web/src/components/{NewSession,AssistantChat,SessionList.tsx,SessionChat.tsx}` → zero matches.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Removed `useCodexModels` call sites + `codexModelOptions` memo from NewSession/index.tsx**
- **Found during:** Task 1
- **Issue:** Plan listed only "drop codex branches" but `useCodexModels` was called unconditionally with an `enabled: agent === 'codex' && ...` gate. After `AgentType` narrowed to `'cursor'` the gate becomes statically false, but the hook call (and the `codexModelOptions` memo + ModelSelector codex props) remained as dead imports — `bun typecheck` flagged the unused `useCodexModels` import.
- **Fix:** Dropped the hook call, the memo, and the ModelSelector codex-only props (`options`, `isLoading`, `error`); kept ModelSelector wired to the cursor `MODEL_OPTIONS` slot which is currently `[]` (renders null) and which `CURS-01 / Milestone 2` will populate.
- **Commit:** `7508829`.

**2. [Rule 3 - Blocking] Followed-up `collaborationMode` / `onCollaborationModeChange` drop in SessionChat from Task 2**
- **Found during:** Task 2 final typecheck.
- **Issue:** After removing `collaborationMode` + `onCollaborationModeChange` from the HappyComposer props interface, `SessionChat.tsx` still passed both props → `TS2322: Property 'collaborationMode' does not exist`. Plan sequences SessionChat in Task 3 but the typecheck gate is per-task.
- **Fix:** Removed just the two offending JSX lines in Task 2's commit; Task 3 owns the full SessionChat rewrite (Codex hook, helper, handler, props all deleted).
- **Commit:** `258be71` (partial); `429471e` (rest).

**3. [Rule 3 - Blocking] Rewrote `MessageMetadata.test.ts` model fixture strings**
- **Found during:** Task 2 slice-gate ripgrep.
- **Issue:** Test file contained 6+ literal `claude-sonnet-4-6` / `claude-haiku-4-5-20251001` model-id strings used as fixture data. The slice-wide `\b(claude|codex|gemini|opencode)\b` zero-hit gate matched them even though they are not consumer references.
- **Fix:** Renamed to `cursor-model-x` / `cursor-model-y`; identical structural assertions preserved.
- **Commit:** `258be71`.

**4. [Rule 3 - Blocking] Dropped `Codex dialect` from QueuedMessagesBar.tsx JSDoc**
- **Found during:** Task 3 slice-gate ripgrep.
- **Issue:** A JSDoc comment on the file's main component contained the literal "Codex dialect" referring to historical message-edit semantics. Matched the slice-wide zero-hit gate.
- **Fix:** Removed the qualifier from the comment.
- **Commit:** `429471e`.

**5. [Rule 3 - Blocking] Deleted `hasAbortableAgentRun` from SessionChat.tsx**
- **Found during:** Task 3.
- **Issue:** The helper only matched `block.tool.name === 'CodexAgent'`. With the ToolCard CodexAgent registry purged in plan 05-02 and the AgentType narrowed to cursor, no in-flight spawned-agent state can match. Plan said to drop `block.tool.name === 'CodexAgent'`; the cleanest fix is to drop the entire helper.
- **Fix:** Deleted the function and the `hasRunningChildAgent` memo + dep; `useHappyRuntime`'s `isRunning` now reads only `props.session.thinking`.
- **Commit:** `429471e`.

No Rule 4 architectural deviations. No auth gates encountered.

## Threat Surface Notes

Both threats in the plan's threat model are mitigated as designed:
- **T-05-03-01** (URL/storage agent type tampering) — `AgentType` is now the single literal `'cursor'`; the deleted `preferences.ts` no longer reads `localStorage`; the spawn path passes a constant `'cursor'`. Zod schemas in plan 04 / 07 will close the wire-side surface.
- **T-05-03-02** (historical metadata.flavor rendering) — `FlavorIcon` falls back to the `cursor` badge for any unknown / null / undefined flavor (`(flavor ?? 'cursor') ?? FLAVOR_BADGES.cursor`); the single-row map ensures no PII surface.

No new threat surface introduced — the slice is purely deletion + literal-narrowing.

## Known Stubs

- `MODEL_OPTIONS.cursor = []` in `web/src/components/NewSession/types.ts` — `ModelSelector` renders `null` for the cursor row. Documented in plan acceptance: cursor model UI ships under `CURS-01 / Milestone 2`. Not a regression — the previous codex / claude rows populated only when the corresponding agent was selected, which is now impossible.
- `getModelOptionsForFlavor` in `web/src/components/AssistantChat/modelOptions.ts` returns `[]` when no `customOptions` are supplied — same `CURS-01` follow-up; the cursor flavor will surface session-metadata-driven model options.

Neither stub blocks plan 05-03's goal (collapse the UI surface to cursor); both are explicit hand-offs to a downstream phase.

## Threat Flags

None — no new network endpoints, auth paths, file access, or schema changes at trust boundaries.

## Commits

| Hash      | Type     | Description                                                                 |
|-----------|----------|-----------------------------------------------------------------------------|
| `7508829` | refactor | delete dead non-cursor NewSession + AssistantChat selectors and option files |
| `258be71` | refactor | collapse AssistantChat StatusBar/HappyComposer/modelOptions to cursor-only  |
| `429471e` | refactor | collapse SessionChat + SessionList flavor branches to cursor                |

## Self-Check: PASSED

- All 14 listed deletion targets verified absent (`test ! -f <path>` exits 0 for each).
- All 13 modified files exist on disk with the expected mutations.
- All 3 commits (`7508829`, `258be71`, `429471e`) present in `git log`.
- `bun typecheck && bun run test` from repo root → 560 tests pass, exit 0.
- Slice-wide `rg -ni '\b(claude|codex|gemini|opencode)\b' web/src/components/{NewSession,AssistantChat,SessionList.tsx,SessionChat.tsx}` → zero matches.
- Source guards (`check-no-cut-agents.sh`, namespace, deployment-infrastructure) all green.
