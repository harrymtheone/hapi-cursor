---
phase: 05-flavor-consolidation-capability-abstraction
plan: 04
subsystem: web
tags: [web, chat, lib, hooks, api, router, codex-cut, capability, slice-2c]

requires:
  - phase: 05-flavor-consolidation-capability-abstraction
    plan: 03
    provides: NewSession/AssistantChat/SessionList collapsed to cursor; AgentType narrowed to 'cursor'
provides:
  - "`web/src/chat/modelConfig.ts::getContextBudgetTokens` reads `getCapability(flavor, 'contextBudgetTokens')`; zero `flavor === 'codex'`/`flavor === 'claude'` branches remain."
  - "Codex review/reasoning normalize helpers deleted (`normalizeCodexReviewJson`, `parseCodexReviewMessage`, `normalizeCodexReviewFinding`, `normalizeCodexTokenUsage`, `isCodexContent`, `areCodexReviewBlocksEqual`, `formatCodexReviewText`, `parseClaudeUsageLimit`); `isCodexContent` renamed to `isAgentMessagePayload`."
  - "`web/src/chat/types.ts` no longer exports `CodexReviewFinding`/`CodexReview`/`CodexReviewBlock`; `ChatBlock` and `NormalizedAgentContent` collapsed accordingly."
  - "`web/src/api/client.ts` narrowed: `agent` parameter on `spawnSession` is `'cursor'`; `approvePermission` mode union narrowed to `CursorPermissionMode`; `setCollaborationMode`, `getMachineCodexModels`, `getSessionCodexModels`, `getSessionOpencodeModels`, `getMachineOpencodeModelsForCwd` all deleted; `modelReasoningEffort` argument removed."
  - "`web/src/types/api.ts` re-exports cleaned of `CodexCollaborationMode`/`CodexModelSummary`/`CodexModelsResponse`/`OpencodeModelSummary`/`OpencodeModelsResponse`."
  - "`web/src/hooks/queries/useCodexModels.ts` deleted; `useSpawnSession` agent narrowed to `'cursor'` (no `modelReasoningEffort`); `useSessionActions` no longer exposes `setCollaborationMode`/`setModelReasoningEffort`."
  - "Bare `'codex'` payload-type literals in `web/src/chat/` and `web/src/lib/message-window-store.ts` rewritten as `AGENT_MESSAGE_PAYLOAD_TYPE` imports; `isCodexAgentRunMessage` renamed to `isAgentRunMessage`."
  - "`web/src/router.tsx` default agentType collapsed from `'claude'` to `'cursor'`."
  - "`web/src/lib/locales/{en,zh-CN}.ts` purged of dead Codex review / OpenCode model / Codex slash unsupported keys; `sessionModelLabel` no longer calls `getClaudeModelLabel`."
  - "Slice-wide `\\b(claude|codex|gemini|opencode)\\b` ripgrep gate over `web/src/` returns zero matches (case-insensitive)."
affects: [phase-05, cut-05, refa-01, slice-2c]

tech-stack:
  added: []
  patterns:
    - "Capability-driven cursor flavor: `getCapability(flavor, key)` replaces `flavor === 'codex'`/`flavor === 'claude'` branches; the helper returns `null` when the capability slot is unset, so callers degrade gracefully (e.g. context budget = `null` for cursor today, populated by `CURS-01`)."
    - "Constant-import normalization: replace bare `'codex'` discriminator literals with `AGENT_MESSAGE_PAYLOAD_TYPE` from `@hapi/protocol` so the slice-wide `\\b(claude|codex|gemini|opencode)\\b` regex gate stays zero-hit while the wire-level discriminator remains stable for plan 07."
    - "Dead test pruning: when reducer/normalizer branches go away, delete the corresponding test blocks outright rather than re-asserting `null`/no-op — saves 700+ LoC in `reducerTimeline.test.ts` + `normalize.test.ts` while keeping coverage focused."

key-files:
  created:
    - .planning/phases/05-flavor-consolidation-capability-abstraction/05-04-SUMMARY.md
  deleted:
    - web/src/hooks/queries/useCodexModels.ts
    - web/src/chat/reducerEvents.test.ts
  modified:
    - web/src/chat/modelConfig.ts
    - web/src/chat/modelConfig.test.ts
    - web/src/chat/types.ts
    - web/src/chat/normalizeAgent.ts
    - web/src/chat/normalize.ts
    - web/src/chat/normalize.test.ts
    - web/src/chat/reducer.test.ts
    - web/src/chat/reducerEvents.ts
    - web/src/chat/reducerTimeline.ts
    - web/src/chat/reducerTimeline.test.ts
    - web/src/chat/reducerCliOutput.test.ts
    - web/src/chat/reconcile.ts
    - web/src/chat/subagentTool.ts
    - web/src/chat/toolGroups.ts
    - web/src/chat/toolGroups.test.ts
    - web/src/chat/presentation.test.ts
    - web/src/lib/assistant-runtime.ts
    - web/src/lib/assistant-runtime.test.ts
    - web/src/lib/message-window-store.ts
    - web/src/lib/message-window-store.test.ts
    - web/src/lib/query-keys.ts
    - web/src/lib/sessionModelLabel.ts
    - web/src/lib/sessionModelLabel.test.ts
    - web/src/lib/locales/en.ts
    - web/src/lib/locales/zh-CN.ts
    - web/src/api/client.ts
    - web/src/types/api.ts
    - web/src/hooks/mutations/useSpawnSession.ts
    - web/src/hooks/mutations/useSessionActions.ts
    - web/src/hooks/useActiveSuggestions.ts
    - web/src/components/SessionChat.tsx
    - web/src/components/AssistantChat/messages/ToolMessage.tsx
    - web/src/router.tsx

key-decisions:
  - "`getContextBudgetTokens` returns `null` for cursor sessions (capability slot unset). Existing tests assert `null` for both cursor and unknown flavors — `CURS-01 / Milestone 2` will populate `contextBudgetTokens` for the cursor row in `shared/src/flavors.ts`. Choosing `null` (rather than a fallback default) lets the budget UI hide itself when no signal is available, matching D-73 intent."
  - "Renamed `isCodexContent` → `isAgentMessagePayload` and `isCodexAgentRunMessage` → `isAgentRunMessage`. The wire discriminator `AGENT_MESSAGE_PAYLOAD_TYPE` is still the literal `'codex'` (owned by `shared/src/modes.ts`); the slice-wide ripgrep gate excludes `AGENT_MESSAGE_PAYLOAD_TYPE`-bound usages, so callers import the constant rather than the bare string."
  - "Deleted `parseCodexReviewMessage` + the `if (codex-review)` block-merge branch in `reducerTimeline.ts` rather than keep an inert no-op — `CodexReviewBlock` was already unused after plan 05-03 removed the renderer, and keeping a typed-but-unrendered block kind invites resurrection."
  - "`parseClaudeUsageLimit` deleted entirely (and `reducerEvents.test.ts` deleted with it) — the only usage was a single `parseMessageAsEvent` call in `reducerTimeline.ts`. Cursor's usage-limit signaling will go through the existing `agent-event` channel; no Claude-specific bridge needed."
  - "`sessionModelLabel.ts` rewritten to return the raw model string verbatim. The previous `getClaudeModelLabel` lookup mapped sonnet/opus aliases to friendly labels; `Cursor` model labels will come pre-formatted from session metadata, so the alias map is unnecessary."
  - "Locale keys for Codex review / OpenCode models / Codex slash-unsupported toast deleted from both `en.ts` and `zh-CN.ts` — they had zero ripgrep callers in `web/src/`. Locales are plain `Record<string, string>` exports (no key-set type), so dropping rows is non-breaking."
  - "Removed `setCollaborationMode` and `setModelReasoningEffort` mutations from `useSessionActions` (and the `codexCollaborationModeSupported` parameter that gated them) — no remaining caller exists after plan 05-03 dropped the StatusBar/HappyComposer/SessionChat consumers."
  - "Narrowed `useSpawnSession`'s `SpawnInput.agent` to the literal `'cursor'` and dropped `modelReasoningEffort` from the spawn payload. The router/NewSession spawn path always passes `'cursor'` after plan 05-03's `AgentType` narrow."
  - "Touched `web/src/components/AssistantChat/messages/ToolMessage.tsx` and `web/src/components/SessionChat.tsx` under Rule 3 — both were typecheck-blocking after the `useSessionActions` signature change and the `block.tool.name === 'CodexAgent'` literal would have lit the slice gate. Plan only listed lib/chat/api/hooks/router files; component touches are minimal follow-ons."
  - "Deferred `web/src/lib/agentSlashCommands.ts` cleanup — the file already had no `claude|codex|gemini|opencode` literals (verified by ripgrep). Plan listed it preemptively; no edit needed."

patterns-established:
  - "Slice-wide ripgrep zero-hit gate (`rg -ni '\\b(claude|codex|gemini|opencode)\\b' web/src/`) excludes only the `AGENT_MESSAGE_PAYLOAD_TYPE` constant — every other identifier and string literal must rename or import the constant. Comments, JSDoc, and test fixture model IDs all count."
  - "When a `web/src/lib/` helper imports a per-flavor utility from `@hapi/protocol` (e.g. `getClaudeModelLabel`), the cleanest cursor-only collapse is to drop the import and return the raw input — the per-flavor helper survives in `shared/` until plan 05-07 deletes it, but the web layer no longer participates."

requirements-completed: []  # CUT-05 / REFA-01 close at slice 4 (plan 05-08)

duration: 25 min
completed: 2026-05-22
---

# Phase 05 Plan 04: Web Chat / Lib / Hooks / API / Router Cursor-Only Collapse (Slice 2c)

**Collapsed every remaining web non-component layer (chat reducers + normalizers + types, lib utilities + locales, hooks/api client, router default) to cursor-only. Rewrote `getContextBudgetTokens` against `getCapability`, deleted `useCodexModels`, narrowed `api/client.ts` agent and permission-mode unions, replaced bare `'codex'` payload-type literals with `AGENT_MESSAGE_PAYLOAD_TYPE` imports, and pruned ~1700 LoC of Codex review / Claude usage-limit / agent-run-event normalization plus their tests. Slice gate `rg -ni '\b(claude|codex|gemini|opencode)\b' web/src/` returns zero matches (after the `AGENT_MESSAGE_PAYLOAD_TYPE` post-filter is implicit — no remaining literals to filter); `bun typecheck` and `bun run test` from the web package both green (532 tests pass).**

## Performance

- **Duration:** ~25 min
- **Tasks:** 3
- **Files deleted:** 2
- **Files modified:** 33
- **Files created:** 1 (this SUMMARY)
- **LoC delta:** approximately −1700 (chat-layer dead code + redundant tests)

## Accomplishments

### Task 1 — chat/ normalizers + reducers + types collapse (commit `9dcdf8b`)

- `modelConfig.ts`: dropped `isClaudeModelPreset` import + Claude/Codex window constants; `getContextBudgetTokens` now reads `getCapability(flavor, 'contextBudgetTokens')` and applies `CONTEXT_HEADROOM_TOKENS`. Tests rewritten to assert `null` for both `cursor` and `unknown` flavors.
- `types.ts`: deleted `CodexReviewFinding` / `CodexReview` / `CodexReviewBlock`; collapsed `ChatBlock` and `NormalizedAgentContent` unions accordingly.
- `normalizeAgent.ts`: deleted `normalizeCodexTokenUsage`, `normalizeCodexReviewFinding`, `normalizeCodexReviewJson`, `parseCodexReviewMessage`. Renamed `isCodexContent` → `isAgentMessagePayload` (uses `AGENT_MESSAGE_PAYLOAD_TYPE`). `normalizeAgentRecord` no longer branches on `codex-review`/`token_count`/`plan_update`/`agent-run-*`.
- `normalize.ts`: import + call site renamed to `isAgentMessagePayload`.
- `reducerEvents.ts`: deleted `parseClaudeUsageLimit` + `parseMessageAsEvent`; file now exports only `dedupeAgentEvents` + `foldApiErrorEvents`.
- `reducerEvents.test.ts`: deleted (sole subject was `parseClaudeUsageLimit`).
- `reducerTimeline.ts`: deleted every `agent-run-*` aggregator helper, the `codex-review` block branch, and the call to `parseMessageAsEvent`. JSDoc neutralized ("Claude often writes" → "agent often writes").
- `reducerTimeline.test.ts`: deleted the 760-line "aggregates Codex agent-run events" test block; remaining model-id fixtures rewritten to `cursor-model-x`/`cursor-model-y`.
- `reducerCliOutput.test.ts` + `reducer.test.ts`: model-id strings updated; `reducer.test.ts` imports `AGENT_MESSAGE_PAYLOAD_TYPE` for the `thread_goal_updated` fixture.
- `normalize.test.ts`: deleted Codex review JSON / Codex plan updates / Codex `token_count` / Codex `agent-run-*` test blocks; renamed remaining test descriptions to flavor-neutral phrasing; updated `type: 'codex'` literals to `type: AGENT_MESSAGE_PAYLOAD_TYPE`.
- `reconcile.ts`: dropped `CodexReviewBlock` import, `areCodexReviewBlocksEqual` helper, and the `codex-review` reconcile branch.
- `toolGroups.ts`: removed `CodexReasoning` from `PLAN_TOOL_NAMES`, `CodexAgent` from `MILESTONE_TOOL_NAMES`; `INTERACTIVE_TOOL_NAMES` collapsed to empty set; `CodexBash`/`CodexPatch`/`CodexDiff` removed from `getToolGroupActionKind`.
- `toolGroups.test.ts`: deleted `CodexPermission` + `CodexAgent` test blocks.
- `subagentTool.ts`: JSDoc "The Claude Code SDK" → "The agent SDK".
- `presentation.test.ts`: renamed `formats Codex token-count …` test description.
- Rule 3 follow-on: `web/src/lib/assistant-runtime.ts` lost `formatCodexReviewText` + the `codex-review` branch (Task-3 territory) to keep the package-wide typecheck green within Task 1's commit.

### Task 2 — api/client.ts + types + hooks collapse (commit `876aed5`)

- `api/client.ts`: deleted `setCollaborationMode`, `getMachineCodexModels`, `getSessionCodexModels`, `getSessionOpencodeModels`, `getMachineOpencodeModelsForCwd`; narrowed `approvePermission` mode union to `CursorPermissionMode` (imported from `@hapi/protocol`); narrowed `spawnSession.agent` to `'cursor'`; dropped `modelReasoningEffort` argument.
- `types/api.ts`: dropped `CodexCollaborationMode` re-export + `CodexModelSummary` / `CodexModelsResponse` / `OpencodeModelSummary` / `OpencodeModelsResponse` types.
- `hooks/queries/useCodexModels.ts`: deleted (zero callers — confirmed by gitnexus impact + ripgrep).
- `hooks/mutations/useSpawnSession.ts`: `SpawnInput.agent` narrowed to `'cursor'`; `modelReasoningEffort` field removed.
- `hooks/mutations/useSessionActions.ts`: dropped `CodexCollaborationMode` import + `codexCollaborationModeSupported` parameter; deleted `setCollaborationMode` and `setModelReasoningEffort` mutations entirely.
- `components/SessionChat.tsx`: Rule 3 follow-on — removed the now-stale fourth argument (`false`) from `useSessionActions(...)` to keep typecheck green.

### Task 3 — lib + router collapse (commit `8bbcdde`)

- `lib/message-window-store.ts`: renamed `isCodexAgentRunMessage` → `isAgentRunMessage`; uses `AGENT_MESSAGE_PAYLOAD_TYPE` instead of bare `'codex'`. JSDoc Codex reference removed.
- `lib/message-window-store.test.ts`: imports `AGENT_MESSAGE_PAYLOAD_TYPE`; two test fixtures rewritten from `type: 'codex'` to the constant; two test descriptions de-Codexed.
- `lib/query-keys.ts`: deleted `machineCodexModels`, `sessionCodexModels`, `sessionOpencodeModels`, `machineOpencodeModelsForCwd` query keys (zero callers after `useCodexModels` deletion).
- `lib/sessionModelLabel.ts`: dropped `getClaudeModelLabel` import; returns the raw model string verbatim.
- `lib/sessionModelLabel.test.ts`: replaced the Claude alias test with a plain "returns the model string verbatim" assertion using `cursor-model-x`.
- `lib/assistant-runtime.ts`: JSDoc cleanup ("claude-SDK message" → "agent-SDK message"; "claude code spawn sessions" → "legacy spawn sessions"). The Codex review function/branch was already removed under Task 1 Rule 3.
- `lib/assistant-runtime.test.ts`: model-id fixtures rewritten to `cursor-model-x`/`cursor-model-y`; "Claude code spawn sessions" / "Claude SDK message" comments neutralized.
- `lib/locales/en.ts` + `lib/locales/zh-CN.ts`: dropped `newSession.model.loadFailed`, `newSession.opencodeModel.*`, `session.codexModelsLoadFailed`, `codexReview.*`, `composer.codexSlashUnsupported.*` keys (zero callers).
- `hooks/useActiveSuggestions.ts`: comment "Expanded content for Codex user prompts" → "Expanded content for user prompts".
- `router.tsx`: default `agentType` fallback `'claude'` → `'cursor'`.

## Verification Evidence

- `bun typecheck` (repo root, all 3 packages) → exit 0.
- `cd web && bun run test` → 532 tests pass across 62 files (down from 560 in plan 05-03 — pruned dead Codex review/agent-run/Claude-usage tests).
- Slice gate: `rg -ni '\b(claude|codex|gemini|opencode)\b' web/src/` → zero matches.
- Plan acceptance:
  - Task 1: `rg -n "flavor === 'codex'|flavor === 'claude'" web/src/chat/modelConfig.ts` → zero. `rg -n "normalizeCodexReview|parseCodexReviewMessage|isCodexContent|areCodexReviewBlocksEqual|parseClaudeUsageLimit" web/src/chat/` → zero.
  - Task 2: `rg -n 'setCollaborationMode|getMachineCodexModels|getSessionCodexModels|getSessionOpencodeModels|getMachineOpencodeModelsForCwd' web/src/api/client.ts` → zero. `useCodexModels.ts` absent (`test ! -f web/src/hooks/queries/useCodexModels.ts` exits 0).
  - Task 3: `rg -n "isCodexAgentRunMessage" web/src/lib/` → zero. `rg -n "machineCodexModels|sessionCodexModels|sessionOpencodeModels|machineOpencodeModelsForCwd" web/src/lib/query-keys.ts` → zero. `rg -n "agentType.*=.*'claude'" web/src/router.tsx` → zero.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Removed `formatCodexReviewText` + `codex-review` branch from `web/src/lib/assistant-runtime.ts` during Task 1**
- **Found during:** Task 1 typecheck (package-wide).
- **Issue:** After deleting `CodexReview` from `web/src/chat/types.ts`, `assistant-runtime.ts` (officially Task 3 territory) failed typecheck. Cross-task blocking — could not commit Task 1 without unblocking the package typecheck.
- **Fix:** Removed the `CodexReview` import, `formatCodexReviewText` function, and `codex-review` block branch in Task 1's commit; the rest of `assistant-runtime.ts` was cleaned in Task 3.
- **Commit:** `9dcdf8b` (partial); `8bbcdde` (rest).

**2. [Rule 3 - Blocking] Updated `web/src/components/SessionChat.tsx` `useSessionActions` call during Task 2**
- **Found during:** Task 2 typecheck.
- **Issue:** Removing the `codexCollaborationModeSupported` parameter from `useSessionActions` left `SessionChat.tsx` calling the hook with a stale fourth argument → `TS2554: Expected 2-3 arguments, but got 4`. SessionChat is officially in Phase 05-03's territory; the typecheck blocked Task 2's commit.
- **Fix:** Dropped the `false` argument at the single call site. No behavior change — the parameter was already always `false` after plan 05-03 collapsed the StatusBar collaboration UI.
- **Commit:** `876aed5`.

**3. [Rule 3 - Blocking] Touched `web/src/components/AssistantChat/messages/ToolMessage.tsx` `hideChildren` literal during Task 1**
- **Found during:** Task 1 slice gate.
- **Issue:** `block.tool.name === 'CodexAgent'` literal would light the slice-wide regex; `CodexAgent` is no longer in the tool registry after plan 05-02.
- **Fix:** Replaced with `false` (the predicate is statically false anyway).
- **Commit:** `9dcdf8b`.

**4. [Rule 3 - Blocking] Touched `web/src/hooks/useActiveSuggestions.ts` JSDoc and `web/src/router.tsx` default during Task 3**
- **Found during:** Task 3 final slice gate.
- **Issue:** JSDoc comment "Codex user prompts" + the default fallback `?? 'claude'` both lit the slice-wide regex.
- **Fix:** Dropped "Codex" qualifier from the comment; collapsed the fallback to `'cursor'`.
- **Commit:** `8bbcdde`.

No Rule 4 architectural deviations. No auth gates encountered.

## Threat Surface Notes

The plan's threat model does not list new threats for slice 2c — the surface is purely deletion + capability redirection. Notable observations:

- `getContextBudgetTokens(flavor)` returning `null` for cursor is deliberate (the capability slot is unset). Downstream UI (`StatusBar` context-budget label) already handles `null` by rendering nothing — no information leak, no false low-budget warning.
- `approvePermission` narrowing eliminates the union member that allowed Codex collaboration mode strings to reach the hub `/api/cli/permissions` endpoint. Plan 07 will close the hub-side schema; until then the narrower union is a defense-in-depth improvement.
- Locale keys deleted from `en.ts` / `zh-CN.ts` had no consumers — no UI surface depended on them — so no degradation of error messaging visible to users.

## Known Stubs

- `getCapability(flavor, 'contextBudgetTokens')` returns `null` for cursor. The cursor row in `shared/src/flavors.ts` does not currently populate `contextBudgetTokens`. `CURS-01 / Milestone 2` will populate this slot; until then `getContextBudgetTokens` returns `null` and the budget UI hides itself. Documented in `modelConfig.test.ts` ("returns null for cursor sessions (no capability budget defined)").
- `web/src/components/NewSession/types.ts` — `MODEL_OPTIONS.cursor = []` (carried forward from plan 05-03). Same `CURS-01` follow-up.

Both stubs are explicit hand-offs to milestone 2 CURS work; they do not block plan 05-04's collapse goal.

## Threat Flags

None — no new network endpoints, auth paths, file access, or schema changes at trust boundaries.

## Commits

| Hash      | Type     | Description                                                                  |
|-----------|----------|------------------------------------------------------------------------------|
| `9dcdf8b` | refactor | collapse chat normalizers/reducers/types to cursor-only                      |
| `876aed5` | refactor | collapse api/client + types + spawn/session hooks to cursor-only             |
| `8bbcdde` | refactor | collapse web/lib + router defaults to cursor-only                            |

## Self-Check: PASSED

- `web/src/hooks/queries/useCodexModels.ts` and `web/src/chat/reducerEvents.test.ts` confirmed deleted (`test ! -f`).
- All 33 modified files exist on disk with the expected mutations (verified via `git diff --stat HEAD~3..HEAD`).
- All 3 commits (`9dcdf8b`, `876aed5`, `8bbcdde`) present in `git log --oneline`.
- `bun typecheck` (repo root) → exit 0.
- `cd web && bun run test` → 532 tests pass, exit 0.
- Slice gate `rg -ni '\b(claude|codex|gemini|opencode)\b' web/src/` → zero matches.
