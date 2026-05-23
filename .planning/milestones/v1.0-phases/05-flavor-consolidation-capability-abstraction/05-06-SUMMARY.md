---
phase: 05-flavor-consolidation-capability-abstraction
plan: 06
subsystem: hub
tags: [refactor, cut-non-cursor, capability-abstraction, hub-only, slice-3b]
requires:
  - "shared/src/flavors.ts: AgentFlavor + getFlavorLabel/isKnownFlavor (Slice 1a, plan 05-01)"
  - "shared/src/modes.ts: AGENT_MESSAGE_PAYLOAD_TYPE constant"
  - "cli/src tree cursor-only (Slice 3a, plan 05-05)"
provides:
  - "hub/src/sync/syncEngine.ts: cursor-only resolveFlavor + resolveAgentResumeId"
  - "hub/src/sync/rpcGateway.ts: cursor-only spawnSession agent param"
  - "hub/src/web/routes/{sessions,permissions,machines}.ts: cursor-only defaults + Zod narrow"
  - "hub/src tree free of \\b(claude|codex|gemini|opencode)\\b literals"
affects:
  - "hub/src/sync/todos.ts: extractTodosFromClaudeOutput deleted; caller chain updated"
  - "hub/src/sync/sessionModel.test.ts: fixtures cursor-only; AGENT_MESSAGE_PAYLOAD_TYPE adoption; 4 dead .skip Claude tests removed"
  - "hub/src/web/routes/sessions.test.ts: deleted 2 effort-endpoint tests; flavor + mode fixtures cursor-only"
  - "hub/src/web/routes/cli.test.ts: resume-target fixture flavor 'claude' → 'cursor'"
tech-stack:
  added: []
  patterns:
    - "Degenerate-ternary collapse: `flavor === 'cursor' ? flavor : 'cursor'` → `'cursor'` constant"
    - "Single-literal Zod narrow: `z.enum(['claude', 'cursor']).optional()` → `z.literal('cursor').optional()`"
    - "Dead-helper deletion (vs. rename): when no remaining call site emits the legacy shape, delete the parser entirely rather than rename it"
key-files:
  created: []
  deleted: []
  modified:
    - hub/src/sync/syncEngine.ts
    - hub/src/sync/rpcGateway.ts
    - hub/src/sync/todos.ts
    - hub/src/sync/sessionModel.test.ts
    - hub/src/web/routes/sessions.ts
    - hub/src/web/routes/sessions.test.ts
    - hub/src/web/routes/permissions.ts
    - hub/src/web/routes/machines.ts
    - hub/src/web/routes/machines.test.ts
    - hub/src/web/routes/cli.test.ts
decisions:
  - "Deleted `extractTodosFromClaudeOutput` (not renamed). The function parsed the Claude-specific `type: 'output'` / `data.type: 'assistant'` / `block.type: 'tool_use'` shape, which Cursor never emits — Cursor messages use `type: AGENT_MESSAGE_PAYLOAD_TYPE` ('codex' wire-tag) consumed by `extractTodosFromAgentMessage`. The only caller (`extractTodoWriteTodosFromMessageContent` in the same file) lost the first `??` branch and now starts with the cursor parser. gitnexus_impact CRITICAL label reflects the call-graph depth rather than a behavior change for cursor."
  - "Deleted `POST /sessions/:id/effort` endpoint outright (not narrowed). Cursor flavor has no `effort` capability (FLAVOR_CAPS.cursor.supportsEffort=false), so the route's `if (flavor !== 'claude') return 400` guard always rejected — narrowing to `'cursor'` would invert into an always-accept that has no downstream consumer. The unused `effortSchema` Zod object was dropped alongside it. Two `sessions.test.ts` tests (`rejects effort changes for non-Claude sessions`, `applies effort changes for Claude sessions`) deleted."
  - "Narrowed `machines.ts` spawn Zod to `z.literal('cursor').optional()` rather than keeping `z.enum(['cursor'])`. Single-literal `z.literal()` is the idiomatic Zod for one-of-one constraints and produces a cleaner inferred type `'cursor' | undefined` that matches the downstream `rpcGateway.spawnSession` narrow without an extra `as const`."
  - "Removed four `.skip`'d Claude resume-from-stored-messages tests in `sessionModel.test.ts` (rows 495, 550, 618, 695 in pre-edit file). They tested a message-recovery code path that was deleted in Phase 1; keeping them would have leaked `\\bclaude\\b` literals into the hub slice ripgrep gate. Replaced the first one with an active cursor equivalent that exercises `cursorSessionId` resume via `rpcGateway.spawnSession`. The .skip local-resume-target Claude recovery test (former line 850) was also deleted."
  - "Test permission-mode literal `'bypassPermissions'` rewritten to `'yolo'` only inside `sessions.test.ts` route-level assertions. The active `sessionModel.test.ts::passes the cached permissionMode when respawning a resumed session` keeps `'bypassPermissions'` as an opaque pass-through value because the test asserts hub forwards whatever permission-mode string it received — the value is not interpreted by hub at that boundary. (No flavor literal involved; `bypassPermissions` does not match the slice ripgrep pattern.)"
metrics:
  duration: 12 min
  completed: 2026-05-22
  task_count: 2
  file_count: 11
---

# Phase 5 Plan 6: Flavor consolidation slice 3b (hub) Summary

One-liner: Hub tree narrowed to cursor-only (degenerate `resolveFlavor` ternary collapsed to a `'cursor'` constant; `cursorSessionId`-only `resolveAgentResumeId`; all `?? 'claude'` route defaults flipped to `?? 'cursor'`; `machines.ts` Zod spawn-agent narrowed to `z.literal('cursor')`; `/sessions/:id/effort` endpoint deleted; `extractTodosFromClaudeOutput` dead-parser deleted; test fixtures + 5 `.skip`'d Claude tests scrubbed); slice gate `bun typecheck && bun run test` green from repo root, `rg -ni '\b(claude|codex|gemini|opencode)\b' hub/src/` returns zero hits.

## What Changed

### Task 1 — sync layer + dead-parser deletion (commit `174fde2`)

- `syncEngine.ts`:
  - **line 366** (`spawnSession`): default param `agent: 'claude' | 'cursor' = 'claude'` → `agent: 'cursor' = 'cursor'`.
  - **lines 391–406** (`resolveFlavor` + `resolveAgentResumeId`): collapsed the degenerate ternary `flavor === 'cursor' ? flavor : 'cursor'` to a constant `return 'cursor'`. `resolveAgentResumeId` collapses to a single `return session.metadata?.cursorSessionId ?? null` (no more flavor branch). The `_session` param of `resolveFlavor` is kept (intentionally unused) to preserve callers in `resolveLocalResumeTarget` / `target.flavor`.
  - **lines 518–520** (`resumeSession` guard): `if (flavor !== 'claude' && flavor !== 'cursor')` → `if (flavor !== 'cursor')`. The error message is preserved (still useful for historical-row defense-in-depth per T-05-06-02).
- `rpcGateway.ts:125`: `agent: 'claude' | 'cursor' = 'cursor'` → `agent: 'cursor' = 'cursor'`.
- `todos.ts`: deleted the entire `extractTodosFromClaudeOutput` function (lines 9–36 in pre-edit file, ~28 lines including the Claude-specific `type: 'output'` / `assistant` / `tool_use` traversal). Updated `extractTodoWriteTodosFromMessageContent` chain: `extractTodosFromClaudeOutput(record.content) ?? extractTodosFromAgentMessage(...) ?? ...` → `extractTodosFromAgentMessage(record.content) ?? extractTodosFromAcpMessage(record.content)`. Cursor never emits the Claude shape (verified by gitnexus_impact: only depth-1 caller is the same file).
- `sessionModel.test.ts`:
  - Added `AGENT_MESSAGE_PAYLOAD_TYPE` import (replacing two bare `type: 'codex'` literals at lines 354, 369 in fixture JSON envelopes).
  - Rewrote 5 `flavor: 'claude'` fixtures (lines 44, 99, 120, 143, 185) to `flavor: 'cursor'`; updated companion `{ model: 'sonnet' }` references to `'gpt-5.4'` so the test fixture model matches its flavor.
  - Renamed test descriptions `Codex sessions` → `Cursor sessions` (line 53) and `resumed Codex session` → `resumed Cursor session` (line 444) and `local resume target for a Codex session` → `... Cursor session`; renamed `local-resume-codex` session id → `local-resume-cursor`.
  - Rewrote `.skip` test `passes resume session ID to rpc gateway when resuming claude session` as an active cursor equivalent (`flavor: 'cursor'` + `cursorSessionId: 'cursor-session-1'`).
  - Deleted four dead `.skip` Claude tests (`recovers claude resume session ID from stored messages`, `recovers the newest claude session ID`, `does not recover a non-UUID sessionId`, and `recovers a Claude local resume target from stored messages`). Replaced with a single explanatory comment block per deletion site.
- `web/routes/machines.ts:9` (Rule-3 cascade from `rpcGateway` narrow): `agent: z.enum(['claude', 'cursor']).optional()` → `agent: z.literal('cursor').optional()`. The downstream call `engine.spawnSession(machineId, ..., parsed.data.agent, ...)` now type-checks against the narrowed `agent: 'cursor' = 'cursor'` signature.

Files: 5 — `hub/src/sync/{syncEngine,rpcGateway,todos,sessionModel.test}.ts`, `hub/src/web/routes/machines.ts`. Verification: `cd hub && bun typecheck` (exit 0); `bun test src/sync` (74 pass, 0 fail).

### Task 2 — web routes default collapse + test cleanup (commit `01f86b4`)

- `web/routes/sessions.ts`: every `?? 'claude'` flavor default collapsed to `?? 'cursor'` at lines 149 (resume permission-mode check), 297 (permission-mode change), 335 (model change), 449 (slash-commands listing). Deleted comment `// Get agent type from session metadata, default to 'claude'` (now redundant).
- `web/routes/sessions.ts`: **deleted** `app.post('/sessions/:id/effort', ...)` endpoint (former lines 348–377). The endpoint's `if (flavor !== 'claude') return 400` guard always rejected for cursor flavor (the only remaining flavor); the route had no Cursor analog because cursor `FLAVOR_CAPS.supportsEffort = false`. Also deleted the now-unused `effortSchema` Zod definition.
- `web/routes/permissions.ts:59`: `?? 'claude'` → `?? 'cursor'`.
- `web/routes/sessions.test.ts`:
  - Deleted the two effort-endpoint tests (`rejects effort changes for non-Claude sessions`, `applies effort changes for Claude sessions`).
  - Rewrote permission-mode test: `flavor: 'claude'` → `'cursor'`; `mode: 'bypassPermissions'` → `mode: 'yolo'` (Cursor's bypass equivalent — `yolo` is a member of `CURSOR_PERMISSION_MODES`).
  - Rewrote resume body permission-mode test: `permissionMode: 'bypassPermissions'` → `'yolo'`.
  - Rewrote 2 slash-command fixture metadatas: `flavor: 'claude'` → `'cursor'`.
- `web/routes/cli.test.ts:105,124`: resume-target fixture `flavor: 'claude'` → `'cursor'` (both occurrences: the mock return and the asserted response payload).
- `web/routes/machines.test.ts:4`: scrubbed comment token `OpenCode model listing endpoints removed in CUT-04` → `Legacy model listing endpoints removed in CUT-04` (was the last `\bOpenCode\b` hit in `hub/src/`).
- `sync/sessionModel.test.ts`: scrubbed three stray comment tokens introduced by Task 1's deletion-comments (`Claude resume-from-stored-messages` → `Legacy resume-from-stored-messages`; `local-resume-codex` session-id string already changed to `-cursor`; `OpenCode/Codex` references already gone).

Files: 6 — `hub/src/web/routes/{sessions,sessions.test,permissions,cli.test,machines.test}.ts`, `hub/src/sync/sessionModel.test.ts`. Verification: `cd hub && bun typecheck` (exit 0); `bun test src/web src/notifications src/sync` (105 pass, 0 fail). Slice gate: `bun typecheck && bun run test` from repo root → 532 web + 105 hub + CLI tests all green; `scripts/check-no-cut-agents.sh` passes.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] Narrowed `machines.ts` Zod enum in Task 1 commit (plan grouped it in Task 2)**

- **Found during:** Task 1 typecheck after narrowing `rpcGateway.spawnSession` agent param.
- **Issue:** Once `rpcGateway.spawnSession` was narrowed to `agent: 'cursor' = 'cursor'`, `machines.ts:56` passing `parsed.data.agent: 'claude' | 'cursor' | undefined` failed typecheck (`TS2345: Argument of type '"claude" | "cursor" | undefined' is not assignable to parameter of type '"cursor" | undefined'`). The Task 1 acceptance criterion `cd hub && bun typecheck` required green typecheck.
- **Fix:** Pulled the planned Task 2 narrow (`z.enum(['claude', 'cursor']).optional()` → `z.literal('cursor').optional()`) into the Task 1 commit. Documented here so Task 2 is not credited with the file change.
- **Files modified:** `hub/src/web/routes/machines.ts`.
- **Commit:** `174fde2`

**2. [Rule 1 — Bug] Deleted four `.skip`'d Claude resume-recovery tests in `sessionModel.test.ts`**

- **Found during:** Task 1 slice-gate ripgrep scan.
- **Issue:** Four pre-existing `.skip`'d tests (rows 495, 550, 618, 695 in the pre-edit file) carried `flavor: 'claude'` + `claudeSessionId` + `Claude` literals. The plan §verification gate at line 183 requires zero `\b(claude|codex|gemini|opencode)\b` hits in `hub/src/`. Even though the tests are skipped, their literals would fail the slice gate. They tested a Claude-specific message-recovery path (`extractClaudeSessionIdFromMessages`) that was deleted in Phase 1, so they were already dead.
- **Fix:** Deleted three of the four outright (replaced with explanatory comment blocks); rewrote the first (`passes resume session ID to rpc gateway when resuming claude session`) as an active cursor equivalent that exercises the new `resolveAgentResumeId` cursor path via `rpcGateway.spawnSession`. Also deleted the fifth dead `.skip` `recovers a Claude local resume target from stored messages` (former line 850).
- **Commit:** `174fde2`

**3. [Rule 3 — Blocking] Scrubbed three residual comment tokens to close the slice ripgrep gate**

- **Found during:** Post-Task-2 final ripgrep scan.
- **Issue:** Three comment-only tokens remained:
  - `sessionModel.test.ts:550` — explanatory comment said `Three .skip'd Claude resume-from-stored-messages recovery tests` (matched `\bClaude\b`).
  - `sessionModel.test.ts:630` — session-id string `'local-resume-codex'` (pre-existing from Task 1 fixture; not flavor-bearing but matched `\bcodex\b`).
  - `web/routes/machines.test.ts:4` — comment `OpenCode model listing endpoints removed in CUT-04` (matched `\bOpenCode\b`).
- **Fix:** Replaced with neutral wording (`Legacy resume-from-stored-messages...`, `local-resume-cursor`, `Legacy model listing endpoints...`).
- **Commit:** `01f86b4`

### Auth gates

None.

### Authentication-related decisions

None — hub routes do not handle agent OAuth or similar credentials at this slice.

## Acceptance Criteria Status

### Task 1

- [x] `rg -n "flavor === 'cursor' \? flavor : 'cursor'" hub/src/sync/syncEngine.ts` → **0 hits** (verified).
- [x] `rg -n "'claude' \| 'cursor'" hub/src/sync/` → **0 hits** (verified — both `syncEngine.ts:366` and `rpcGateway.ts:125` narrowed).
- [x] `rg -n "extractTodosFromClaudeOutput" hub/src/` → **0 hits** (verified — function + caller-chain reference deleted).
- [x] `rg -n "flavor:\s*'(claude|codex|gemini|opencode)'" hub/src/sync/sessionModel.test.ts` → **0 hits** (verified — 5 active + 5 `.skip` literals scrubbed).
- [x] `rg -n "type:\s*'codex'" hub/src/sync/sessionModel.test.ts | rg -v "AGENT_MESSAGE_PAYLOAD_TYPE"` → **0 hits** (verified — both fixtures use the constant import).
- [x] `cd hub && bun typecheck` exit 0 (verified after Rule-3 `machines.ts` cascade).

### Task 2

- [x] `rg -n "\?\? 'claude'" hub/src/web/routes/ hub/src/notifications/` → **0 hits** (verified — all 5 sessions.ts hits + permissions.ts hit collapsed to `'cursor'`).
- [x] `rg -n "flavor:\s*'claude'|mode:\s*'(bypassPermissions|acceptEdits|read-only|safe-yolo)'" hub/src/web/routes/` → **0 hits** (verified — fixtures cursor-only; bypassPermissions rewritten to yolo at route boundary).
- [x] `rg -n "z\.enum\(\['claude'" hub/src/web/routes/` → **0 hits** (verified — `machines.ts:9` narrowed to `z.literal('cursor').optional()`).
- [x] `rg -n "getFlavorLabel\b|isKnownFlavor\b" hub/src/notifications/sessionInfo.ts` → **2 hits** (verified at lines 1, 16, 17 — KEEP per D-83, no edit applied to `notifications/sessionInfo.ts`).
- [x] `cd hub && bun typecheck` exit 0 (verified).
- [x] **Slice gate:** `bun typecheck && bun run test` from repo root exit 0 (verified — 532 web tests + 105 hub tests + 225 cli tests all green; `scripts/check-no-cut-agents.sh` passes).

### Plan §verification

- [x] `rg -ni '\b(claude|codex|gemini|opencode)\b' hub/src/ | rg -v 'AGENT_MESSAGE_PAYLOAD_TYPE' | rg -v 'CHANGELOG'` → **0 hits** (verified by post-commit Grep over `hub/src` returning "No matches found").

## Threat Model Mitigations

- **T-05-06-01 (Tampering — hub session route `agent` param):** Mitigated. `machines.ts:9` Zod input schema narrowed to `z.literal('cursor').optional()`; the spawn endpoint rejects any other string at the Zod parse boundary with HTTP 400. Downstream `rpcGateway.spawnSession` signature is `agent: 'cursor' = 'cursor'` — compiler-enforced. Route handlers no longer branch by flavor (the deleted `/sessions/:id/effort` endpoint was the last flavor branch in `hub/src/web/routes/`).
- **T-05-06-02 (Tampering — historical metadata.flavor in SQLite):** Mitigated. `MetadataSchema.flavor` remains `z.string().nullish()` (untouched, per RESEARCH §"Wire-layer narrow safety"). The `resumeSession` guard `if (flavor !== 'cursor')` (formerly `flavor !== 'claude' && flavor !== 'cursor'`) compares strictly against the cursor literal and returns `resume_failed` with a descriptive error for any other historical string. Defense-in-depth preserved: a row with `flavor: 'gemini'` from a pre-Phase-1 install would fail to resume cleanly rather than silently re-launch as cursor.

## Known Stubs

None. `notifications/sessionInfo.ts` still consumes `getFlavorLabel` + `isKnownFlavor` (returns `'Unknown'` for non-cursor strings per D-83) — that is a graceful fallback for historical SQLite rows, not a stub.

## Threat Flags

None. No new network endpoints, auth paths, file-access patterns, or trust-boundary schema changes were introduced. The deleted `/sessions/:id/effort` route removed (not added) a route surface; the narrowed Zod enum reduced (not expanded) the accepted input set.

## Self-Check: PASSED

- All 11 modified files committed across two atomic commits (`174fde2`, `01f86b4`) — verified via `git log --oneline -2` and `git diff --stat`.
- `hub/src/web/routes/sessions.ts` `/sessions/:id/effort` endpoint confirmed deleted (no `app.post('/sessions/:id/effort'` match).
- `hub/src/sync/todos.ts::extractTodosFromClaudeOutput` confirmed deleted (zero hits across `hub/src/`).
- `cd hub && bun typecheck` exit 0; `cd hub && bun test` 105 pass / 0 fail (5 test files in `src/sync` + `src/web/routes` + `src/notifications`).
- Root `bun typecheck && bun run test` green; `scripts/check-no-cut-agents.sh` passes (zero non-Cursor agent literals outside whitelist).
- `rg -ni '\b(claude|codex|gemini|opencode)\b' hub/src/` returns **0 hits**.
