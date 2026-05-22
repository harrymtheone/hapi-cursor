---
phase: 06-agent-runtime-shared-kit-mode-hardening
plan: 03
subsystem: cli/cursor + cli/agent + cli/modules/common
tags: [refactor, dedup, jsdoc-anchor, slice-3, REFA-02, SC#1, SC#5]
requires:
  - "06-01 complete (cli/src/cursor/modes.ts exports PermissionMode)"
  - "06-02 complete (cli/src/agent/modeConfig.ts exports permissionModeToCursorArgs)"
provides:
  - "cli/src/cursor/cursorLocalLauncher.ts: consumes shared permissionModeToCursorArgs; no inline duplicate; no `as string` cast"
  - "cli/src/cursor/cursorRemoteLauncher.ts: consumes shared permissionModeToCursorArgs; no inline duplicate; no `as string` casts; applyDisplayMode narrowed to PermissionMode | undefined; buildAgentArgs exported"
  - "cli/src/agent/sessionBase.ts: @implements SessionContext (Phase 6 SC#1) JSDoc anchor"
  - "cli/src/modules/common/launcher/BaseLocalLauncher.ts: @implements LocalAdapter (Phase 6 SC#1) JSDoc anchor"
  - "cli/src/modules/common/remote/RemoteLauncherBase.ts: @implements RemoteAdapter (Phase 6 SC#1) JSDoc anchor"
  - "cli/src/agent/localLaunchPolicy.ts: @implements LaunchPolicy (Phase 6 SC#1) JSDoc anchor"
affects:
  - "Plan 04 can now `import { buildAgentArgs } from '@/cursor/cursorRemoteLauncher'` directly without surgery"
tech-stack:
  added: []
  patterns:
    - "Pattern E (PATTERNS.md) — concept-position JSDoc anchors land on existing base files so the four SC#1 concepts (SessionContext / LocalAdapter / RemoteAdapter / LaunchPolicy) become grep-discoverable without renaming files (CONTEXT D-89)"
    - "Pattern D (REFA-02) — single mode-mapping helper consumed by both launchers; inline duplicates deleted"
key-files:
  created:
    - .planning/phases/06-agent-runtime-shared-kit-mode-hardening/06-03-SUMMARY.md
  deleted: []
  modified:
    - cli/src/cursor/cursorLocalLauncher.ts
    - cli/src/cursor/cursorRemoteLauncher.ts
    - cli/src/agent/sessionBase.ts
    - cli/src/modules/common/launcher/BaseLocalLauncher.ts
    - cli/src/modules/common/remote/RemoteLauncherBase.ts
    - cli/src/agent/localLaunchPolicy.ts
decisions:
  - "Imported `permissionModeToCursorArgs` from `@/agent/modeConfig` in both launchers using the path-mapped specifier (matches Plan 02 acceptance criteria pattern). PermissionMode type imported from `./modes` in cursorRemoteLauncher.ts for the narrowed applyDisplayMode signature."
  - "`mode.permissionMode` (off the message queue batch) is already typed `PermissionMode` via `EnhancedMode` (cli/src/cursor/modes.ts:15) — no cast needed at the call site once the shared helper accepts `PermissionMode | undefined`."
  - "No changes to `loopBase.ts` — D-90 enumerates exactly 4 SC#1 concepts; loopBase is not one of them."
metrics:
  duration: 7min
  completed: 2026-05-22
  task_count: 3
  files_modified: 6
  files_created: 1
---

# Phase 6 Plan 03: Launcher dedup + SC#1 JSDoc anchors Summary

Collapsed both Cursor launchers onto the shared `permissionModeToCursorArgs` helper from Plan 02, dropped all three `permissionMode as string` casts, narrowed `applyDisplayMode` to `PermissionMode | undefined`, exported `buildAgentArgs` from `cursorRemoteLauncher.ts` (Plan 04 import target), and stamped the four SC#1 base files with grep-verifiable `@implements ... (Phase 6 SC#1)` JSDoc anchors.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Converge cursorLocalLauncher onto shared modeConfig | `df0f7c4` | cli/src/cursor/cursorLocalLauncher.ts |
| 2 | Converge cursorRemoteLauncher onto shared modeConfig; export buildAgentArgs; narrow applyDisplayMode | `c28fd5c` | cli/src/cursor/cursorRemoteLauncher.ts |
| 3 | Stamp four SC#1 base files with @implements JSDoc anchors | `2258ef6` | cli/src/agent/sessionBase.ts, cli/src/modules/common/launcher/BaseLocalLauncher.ts, cli/src/modules/common/remote/RemoteLauncherBase.ts, cli/src/agent/localLaunchPolicy.ts |

## Diff Stats

```
 6 files changed, 42 insertions(+), 25 deletions(-)
```

Per-file:

- `cli/src/cursor/cursorLocalLauncher.ts` — 2 insertions, 14 deletions (inline helper removed; import added; cast dropped)
- `cli/src/cursor/cursorRemoteLauncher.ts` — 6 insertions, 11 deletions (inline helper removed; imports added; two casts dropped; `export` keyword on `buildAgentArgs`; `applyDisplayMode` parameter narrowed)
- `cli/src/agent/sessionBase.ts` — 8 insertions, 0 deletions (JSDoc anchor)
- `cli/src/modules/common/launcher/BaseLocalLauncher.ts` — 8 insertions, 0 deletions (JSDoc anchor)
- `cli/src/modules/common/remote/RemoteLauncherBase.ts` — 8 insertions, 0 deletions (JSDoc anchor)
- `cli/src/agent/localLaunchPolicy.ts` — 9 insertions, 0 deletions (JSDoc anchor + blank line)

## D-108 Keyword ripgrep counts (before → after)

| Keyword | Scope | Before | After |
|---------|-------|--------|-------|
| `function permissionModeToCursorArgs` | cli/src/cursor/cursorLocalLauncher.ts | 1 | 0 |
| `function permissionModeToAgentArgs` | cli/src/cursor/cursorRemoteLauncher.ts | 1 | 0 |
| `permissionMode as string` | cli/src/cursor/cursorLocalLauncher.ts + cli/src/cursor/cursorRemoteLauncher.ts | 3 | 0 |
| `permissionModeToAgentArgs` | cli/src shared/src hub/src web/src | 1 | 0 |
| `from '@/agent/modeConfig'` | cli/src/cursor/cursorLocalLauncher.ts + cli/src/cursor/cursorRemoteLauncher.ts | 0 | 2 |
| `^export function buildAgentArgs` | cli/src/cursor/cursorRemoteLauncher.ts | 0 | 1 |
| `@implements (SessionContext\|LocalAdapter\|RemoteAdapter\|LaunchPolicy) \(Phase 6 SC#1\)` | cli/src | 0 | 4 |

## Verification

- `bun typecheck` — exit 0 (cli + web + hub all green).
- `bun run --cwd cli test` — 234 passed, 12 skipped (runner integration, requires CLI_API_TOKEN); 0 failed.
- `applyDisplayMode` signature narrowed; `bun typecheck` confirms no caller breaks.

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- `cli/src/cursor/cursorLocalLauncher.ts` — FOUND, contains `from '@/agent/modeConfig'`.
- `cli/src/cursor/cursorRemoteLauncher.ts` — FOUND, contains `from '@/agent/modeConfig'`, `from './modes'`, `export function buildAgentArgs`.
- All four SC#1 JSDoc anchors present (1 hit each in the four target files).
- Commits `df0f7c4`, `c28fd5c`, `2258ef6` all present in `git log`.
