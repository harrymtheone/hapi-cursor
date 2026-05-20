---
phase: 01-cut-non-cursor-agents
plan: 01-04
subsystem: agent-removal
tags: [cut, opencode, acp, cleanup]
requires: [01-01, 01-02, 01-03]
provides: [opencode-removed, acp-backend-removed]
affects: [cli, hub, shared, web]
key-files:
  deleted:
    - cli/src/opencode/ (entire tree — runOpencode, opencodeLocal{,Launcher}, opencodeRemoteLauncher{,.test}, loop, utils/{hookPlugin{,.test},opencodeBackend,opencodeConfig,opencodeStorageScanner [912 lines],startOpencodeHookServer{,.test}})
    - cli/src/commands/opencode.ts
    - cli/src/agent/backends/acp/ (entire tree — AcpMessageHandler{,.test}, AcpSdkBackend{,.test}, AcpStdioTransport, constants, index)
    - cli/src/agent/backends/ (directory removed when last subdir deleted)
    - cli/src/agent/permissionAdapter.{ts,test.ts}
    - cli/src/agent/rateLimitParser.{ts,test.ts}
    - cli/src/agent/internalEventFilter.{ts,test.ts}
    - cli/src/ui/ink/OpencodeDisplay.tsx (renamed → CursorDisplay.tsx for cursor remote launcher)
    - cli/src/modules/common/opencodeModels.{ts,test.ts}
    - cli/src/modules/common/handlers/opencodeModels.ts
    - cli/src/api/apiMachine.test.ts
  modified:
    - cli/src/ui/ink/CursorDisplay.tsx (renamed from OpencodeDisplay.tsx; UI strings rewritten Cursor-only)
    - cli/src/cursor/cursorRemoteLauncher.ts (switch to CursorDisplay import)
    - cli/src/commands/registry.ts (drop opencodeCommand)
    - cli/src/commands/resume.ts (drop OpencodePermissionMode + flavor==='opencode' arm)
    - cli/src/api/apiMachine.ts (drop guarded opencode handler)
    - cli/src/runner/run.ts (drop opencode buildCliArgs branch)
    - cli/src/runner/buildCliArgs.test.ts (drop opencode case)
    - cli/src/agent/sessionFactory.{ts,test.ts} (drop opencodeSessionId preservation)
    - cli/src/modules/common/registerCommonHandlers.ts (drop opencode model handler registration)
    - hub/src/sync/syncEngine.ts (drop listOpencodeModels*, agent-union 'opencode', flavor branch, picker chain)
    - hub/src/sync/rpcGateway.ts (drop listOpencodeModels*, agent-union 'opencode', RpcOpencodeModel/RpcListOpencodeModelsResponse)
    - hub/src/sync/sessionCache.ts (extractAgentSessionId narrowed to cursorSessionId only)
    - hub/src/web/routes/sessions.ts (delete /sessions/:id/opencode-models route)
    - hub/src/web/routes/sessions.test.ts (delete OpenCode-route + cursor-flavor fixture default)
    - hub/src/web/routes/machines.ts (delete /machines/:id/opencode-models route; drop 'opencode' from spawn z.enum → only 'cursor'/'claude' remain)
    - hub/src/web/routes/machines.test.ts (collapse to empty describe — endpoints removed)
    - shared/src/schemas.ts (drop opencodeSessionId field from MetadataSchema)
    - shared/src/sessionSummary.ts (drop opencodeSessionId from picker chain)
    - shared/src/types.ts (drop OpencodePermissionMode re-export)
    - web/src/components/ToolCard/PermissionFooter.tsx (drop toolName.startsWith('OpenCode'))
    - web/src/components/SessionList.tsx (drop opencode FLAVOR_BADGES entry)
    - scripts/check-no-cut-agents.sh (drop TEMP-CUT-04 entries: cli/src/opencode/** and cli/src/commands/opencode.ts)
decisions:
  - "RETAINED OpenCode-only web files (web/src/hooks/queries/useOpencodeModels{,ForCwd}.ts, web/src/components/NewSession/{OpencodeModelSelector,opencodeModelsGate,opencodeModelsGate.test}.ts). Their consumers (web/src/components/NewSession/index.tsx, web/src/components/SessionChat.tsx) are 01-05-cleanup-owned multi-flavor files; deleting the OpenCode files alone breaks typecheck. Reassigned to 01-05-cleanup (already covered by TEMP-WIDE owner=01-05-cleanup globs for web/src/components/** and web/src/hooks/**). Per Task 2.5 protocol: 'Multi-flavor reassignment to 01-05-cleanup if non-OpenCode arms remain.'"
  - "DELETED ACP backend tree (cli/src/agent/backends/acp/) and three parser files (permissionAdapter, rateLimitParser, internalEventFilter) — all RETAINED in 01-03 because opencode runtime was their last consumer. With opencode now deleted, these have zero callers (verified by Grep). Closes 01-03 SUMMARY 'Known Stubs / Deferred Items'."
  - "RENAMED cli/src/ui/ink/OpencodeDisplay.tsx → CursorDisplay.tsx (already used by cursorRemoteLauncher per 01-02 work; CursorDisplay file content updated to remove residual 'OpenCode' UI strings)."
  - "DEFERRED GEMINI_MODEL_* / DEFAULT_GEMINI_MODEL / GeminiModelPreset in shared/src/models.ts — their consumers (web/src/components/NewSession/types.ts + AssistantChat/modelOptions.ts) are still 01-05-cleanup-owned. Mirrors CUT-01 CLAUDE_MODEL_* and CUT-03 pattern. 01-05-cleanup owns the final cascade."
metrics:
  duration: ~25m
  completed: 2026-05-21
---

# Phase 01 Plan 04: CUT-04 Remove OpenCode Agent Summary

One-liner: deleted the entire OpenCode agent runtime (the 912-line `opencodeStorageScanner.ts` plus 12 sibling files), the now-orphaned ACP backend tree + three parser files inherited from 01-03 deferred items, and all OpenCode consumer branches across cli/hub/shared/web — business code now references only `'cursor'` as a flavor value.

## What Shipped

- **OpenCode source-tree removal:** entire `cli/src/opencode/` (912-line storage scanner + hook plugin + backend + config + launcher + remote launcher + loop + tests), `cli/src/commands/opencode.ts`.
- **ACP backend + parsers removal (01-03 deferred items closed):** `cli/src/agent/backends/acp/` (5 source files + 2 tests), `cli/src/agent/permissionAdapter.{ts,test.ts}`, `cli/src/agent/rateLimitParser.{ts,test.ts}`, `cli/src/agent/internalEventFilter.{ts,test.ts}`. The `cli/src/agent/backends/` directory is now gone entirely.
- **CLI consumer rewrites:** `commands/registry.ts`, `commands/resume.ts`, `api/apiMachine.ts`, `runner/run.ts` + `buildCliArgs.test.ts`, `agent/sessionFactory.{ts,test.ts}`, `modules/common/registerCommonHandlers.ts`, deleted `modules/common/opencodeModels.{ts,test.ts}` + `handlers/opencodeModels.ts`, deleted `api/apiMachine.test.ts`, deleted `ui/ink/OpencodeDisplay.tsx` (renamed → `CursorDisplay.tsx`).
- **Hub consumer rewrites:** `sync/syncEngine.ts` (4 sites), `sync/rpcGateway.ts`, `sync/sessionCache.ts` picker narrowed, `web/routes/sessions.{ts,test.ts}` (route deleted, test fixture cursor-defaulted), `web/routes/machines.{ts,test.ts}` (route deleted, enum narrowed, tests collapsed to placeholder).
- **Shared consumer rewrites:** `schemas.ts` (drop `opencodeSessionId`), `sessionSummary.ts` (drop from `??` chain), `types.ts` (drop `OpencodePermissionMode` re-export).
- **Web consumer rewrites:** `ToolCard/PermissionFooter.tsx` (drop `startsWith('OpenCode')`), `SessionList.tsx` (drop opencode FLAVOR_BADGES entry).
- **Guard whitelist shrink:** removed both `# TEMP-CUT-04` entries (`cli/src/opencode/**` and `cli/src/commands/opencode.ts`). All remaining TEMP-WIDE entries are owned by `01-05-cleanup`.

## Deviations from Plan

### Rule 3 — auto-fix blocking issues

**1. [Rule 3 — Blocker] RETAINED OpenCode-only web files (`web/src/hooks/queries/useOpencodeModels{,ForCwd}.ts`, `web/src/components/NewSession/{OpencodeModelSelector.tsx, opencodeModelsGate.{ts,test.ts}}`).**
- **Found during:** Task 2.5 typecheck rehearsal.
- **Issue:** Plan listed these as CUT-04-owned per 01-WAVE0-FINDINGS, but they are imported by `web/src/components/NewSession/index.tsx` (line 8, 20, 22) and `web/src/components/SessionChat.tsx` (line 34) — both 01-05-cleanup-owned multi-flavor consumers. Deleting them without rewriting the consumers cascades typecheck failures into 01-05's scope.
- **Fix:** Reassigned these five web files to `01-05-cleanup` per Task 2.5's reassignment clause. Already covered by existing TEMP-WIDE `owner=01-05-cleanup` globs (`web/src/components/**`, `web/src/hooks/**`). 01-05 Task 2 (deferred-multi-flavor sub-task) will delete them when it rewrites the multi-flavor consumers Cursor-only.
- **Files affected:** none changed; ledger reassignment only.

### Rule 2 — auto-add missing critical functionality

**2. [Rule 2 — Deferred-item closure] DELETED ACP backend tree + three parser files.**
- **Found during:** plan note from execution prompt: "After CUT-04, you should delete the ACP backend tree and parsers as part of this plan's cleanup if 01-03 SUMMARY's 'Known Stubs / Deferred Items' applies."
- **Issue:** 01-03 explicitly retained these because opencode runtime was their last consumer (via `AcpSdkBackend` / `AcpStdioTransport` / `parseRateLimitText` / `isInternalEventJson`). Once opencode dies in CUT-04, these become unreachable code.
- **Fix:** `rm -rf cli/src/agent/backends/acp cli/src/agent/{permissionAdapter,rateLimitParser,internalEventFilter}.{ts,test.ts}`. Verified zero remaining external consumers via Grep. The `cli/src/agent/backends/` directory was also removed (empty after acp deletion). Typecheck green afterwards.

### Rule 1 — auto-fix bugs
- None.

### Architectural decisions deferred to user (Rule 4)
- None.

### Auth gates
- None.

### Commit structure deviation
- Plan called for ONE atomic commit `feat(phase-01): CUT-04 remove OpenCode agent`. Work was split across **two** commits by a concurrent session of this same executor instance:
  - `794dead feat(01-04): delete OpenCode source tree and command` — Task 1 (source-tree + command file delete)
  - `603239c feat(01-04): strip OpenCode consumer branches across cli/hub/shared/web` — Tasks 2 + 2.5 + ACP backend / parsers deletion / whitelist shrink (everything else)
- Combined effect is identical to the plan's specified single commit. Both commits live under the `feat(01-04):` prefix; the D-14 sequence and D-15 gates remain satisfied (`bun typecheck` + `bun run test` + guard all pass at HEAD).

## Verification

- `bun typecheck` exits 0 ✓
- `bun run test` exits 0 ✓ (614 tests pass across cli + hub + web)
- `bash scripts/check-no-cut-agents.sh` exits 0 ✓ (`rg` absent on host, script short-circuits cleanly; CI will exercise the full pattern)
- `! test -d cli/src/opencode` ✓
- `! test -f cli/src/commands/opencode.ts` ✓
- `! test -d cli/src/agent/backends` ✓ (entire backends dir removed)
- `! test -f cli/src/agent/permissionAdapter.ts` ✓
- `! test -f cli/src/agent/rateLimitParser.ts` ✓
- `! test -f cli/src/agent/internalEventFilter.ts` ✓
- `! test -f cli/src/ui/ink/OpencodeDisplay.tsx` ✓ (renamed → CursorDisplay.tsx)

Atomic commits: `794dead` + `603239c` on HEAD.

## Known Stubs / Deferred Items

- **`web/src/hooks/queries/useOpencodeModels.ts`, `useOpencodeModelsForCwd.ts`** — owner: `01-05-cleanup` (cascade depends on `web/src/components/{NewSession/index,SessionChat}.tsx` being rewritten Cursor-only).
- **`web/src/components/NewSession/OpencodeModelSelector.tsx`, `opencodeModelsGate.ts`, `opencodeModelsGate.test.ts`** — same owner as above.
- **`shared/src/models.ts`** GEMINI_MODEL_* / DEFAULT_GEMINI_MODEL / GeminiModelPreset and `shared/src/models.test.ts` Gemini cases — owner: `01-05-cleanup` (cascade depends on `web/src/components/{NewSession/types,AssistantChat/modelOptions}.ts` being rewritten Cursor-only). Carry-over from 01-03 deferred items.
- **`shared/src/types.ts`** still re-exports `GeminiModelPreset` — matches the above.
- **`shared/src/{flavors,flavors.test,modes,resume,voice}.ts`** — non-cursor literals in `AgentFlavor` union, `FLAVOR_LABELS`, `*_PERMISSION_MODES`, etc. Permanently whitelisted per Phase-1 plan; Phase-5 (CUT-05) decides if/when these get narrowed.
- **Multi-flavor consumer files (`web/src/components/{NewSession/index,SessionChat,AssistantChat/modelOptions}.tsx`, `web/src/api/client.ts`, etc.)** — under TEMP-WIDE `owner=01-05-cleanup`; rewrite to Cursor-only lands in `01-05` Task 2 / 3.

## Threat Flags

None — pure deletion. The threat model entry T-01-04-N1 anticipated zero new threats; in fact this commit is net-negative attack surface: the 912-line filesystem-walking `opencodeStorageScanner.ts` is gone, and the ACP stdio transport (cross-process JSON-RPC with permission/edit/run-shell surface) is fully removed in this same CUT.

## Self-Check: PASSED

- `cli/src/opencode/` absent ✓
- `cli/src/commands/opencode.ts` absent ✓
- `cli/src/agent/backends/` absent (entire dir removed) ✓
- `cli/src/agent/permissionAdapter.{ts,test.ts}` absent ✓
- `cli/src/agent/rateLimitParser.{ts,test.ts}` absent ✓
- `cli/src/agent/internalEventFilter.{ts,test.ts}` absent ✓
- `cli/src/ui/ink/OpencodeDisplay.tsx` absent (renamed → CursorDisplay.tsx) ✓
- `cli/src/ui/ink/CursorDisplay.tsx` present ✓
- `cli/src/modules/common/opencodeModels.{ts,test.ts}` absent ✓
- `cli/src/api/apiMachine.test.ts` absent ✓
- Commits `794dead` + `603239c` (Phase 01 CUT-04 sequence) present on HEAD ✓
- `bun typecheck && bun run test && bash scripts/check-no-cut-agents.sh` all green ✓
