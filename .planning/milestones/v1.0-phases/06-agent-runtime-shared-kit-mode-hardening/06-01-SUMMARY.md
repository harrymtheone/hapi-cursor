---
phase: 06-agent-runtime-shared-kit-mode-hardening
plan: 01
subsystem: cli/cursor
tags: [refactor, cycle-break, leaf-module, mode-types, slice-1, REFA-05]
requires:
  - "Phase 5 complete (AgentFlavor narrowed to 'cursor'; CURSOR_PERMISSION_MODES = ['default','plan','ask','yolo'] in shared/src/modes.ts)"
provides:
  - "cli/src/cursor/modes.ts: leaf module re-exporting PermissionMode and EnhancedMode for the cursor runtime"
  - "cli/src/cursor has zero circular dependencies (madge --circular --extensions ts,tsx exits 0; was 3 cycles)"
  - "Single canonical type source for PermissionMode / EnhancedMode inside cli/src/cursor (consumed by loop, session, runCursor)"
affects:
  - "cli/src/cursor/loop.ts: dropped local PermissionMode/EnhancedMode defs; imports types from ./modes; orchestration loop() unchanged"
  - "cli/src/cursor/session.ts: type import path swapped from ./loop to ./modes (removes the session→loop reverse edge that created all 3 madge cycles)"
  - "cli/src/cursor/runCursor.ts: split combined `loop + types` import — runtime loop() from ./loop, types from ./modes"
tech-stack:
  added: []
  patterns:
    - "Pattern A — Leaf module with single import (D-95): cli/src/cursor/modes.ts imports only from @hapi/protocol/types; guard comment forbids re-importing ./loop, ./session, ./cursorLocalLauncher, ./cursorRemoteLauncher, ./cursorLocal"
    - "Pattern D — Type-only import-path swap to break a cycle without behavioral change: same exported names, same Zod schema source, new leaf-module path"
key-files:
  created:
    - cli/src/cursor/modes.ts
    - .planning/phases/06-agent-runtime-shared-kit-mode-hardening/06-01-SUMMARY.md
  deleted: []
  modified:
    - cli/src/cursor/loop.ts
    - cli/src/cursor/session.ts
    - cli/src/cursor/runCursor.ts
decisions:
  - "Did not modify cursorLocalLauncher.ts or cursorRemoteLauncher.ts in this slice. PLAN.md §<action> explicitly allows skipping the launcher edits when those files do not currently import PermissionMode/EnhancedMode from ./loop — verified true: launcher files only use a local string-typed `permissionModeToCursorArgs(mode?: string)` helper plus `session.getPermissionMode() as string`. Redirecting launcher mode-type imports belongs to Plan 06-03 when the launcher helpers are deleted in favor of the shared ModeConfig (D-91). Adding empty `from './modes'` imports here would be dead code."
  - "Split runCursor.ts's combined `import { loop, type EnhancedMode, type PermissionMode } from './loop'` into two statements (runtime loop from ./loop; types from ./modes) rather than re-exporting types from ./loop. Re-exporting from ./loop would keep ./loop as a type source-of-truth, which is exactly the topology Phase 6 SC#2 is breaking; the canonical type source is now ./modes alone."
  - "Kept loop()'s existing runtime imports of CursorSession + cursorLocalLauncher + cursorRemoteLauncher intact (these are runtime forward edges, not part of the cycle). The cycle was created solely by session.ts → loop.ts → launcher.ts → session.ts; removing the session→loop type import alone collapses all 3 madge cycles, confirmed by post-edit madge run."
metrics:
  duration: 4min
  completed: 2026-05-22
  task_count: 2
  file_count: 4
---

# Phase 6 Plan 1: Mode types leaf module + cycle break Summary

One-liner: New `cli/src/cursor/modes.ts` leaf module (single import from `@hapi/protocol/types`) owns `PermissionMode` + `EnhancedMode`; `session.ts`, `loop.ts`, and `runCursor.ts` import from it; the `session ↔ loop ↔ launcher` reverse edge is removed and `madge --circular cli/src/cursor` collapses from 3 cycles to 0.

## What Changed

**Task 1 — Create leaf `cli/src/cursor/modes.ts` (commit `419e61d`):**

- New file, 17 lines, single `import type { CursorPermissionMode } from '@hapi/protocol/types'`.
- Re-exports `export type PermissionMode = CursorPermissionMode` and declares `export interface EnhancedMode { permissionMode: PermissionMode; model?: string }`.
- Header comment marks it `LEAF MODULE` and explicitly forbids re-importing `./loop`, `./session`, `./cursorLocalLauncher`, `./cursorRemoteLauncher`, `./cursorLocal` (D-95 guard).
- 4-space indentation per project AGENTS.md convention.

**Task 2 — Redirect consumers, delete duplicate defs from `loop.ts` (commit `2bec53a`):**

- `cli/src/cursor/loop.ts`: deleted `import type { CursorPermissionMode } from '@hapi/protocol/types'`, the local `export type PermissionMode = CursorPermissionMode`, and `export interface EnhancedMode { ... }`. Replaced with `import type { PermissionMode, EnhancedMode } from './modes'`. Orchestration `loop()` body unchanged.
- `cli/src/cursor/session.ts`: single-line change `from './loop'` → `from './modes'` for the `EnhancedMode, PermissionMode` type-only import. This is the edit that breaks all 3 cycles.
- `cli/src/cursor/runCursor.ts`: split `import { loop, type EnhancedMode, type PermissionMode } from './loop'` into `import { loop } from './loop'` plus `import type { EnhancedMode, PermissionMode } from './modes'`.

Launcher files (`cursorLocalLauncher.ts`, `cursorRemoteLauncher.ts`) were intentionally not touched — they do not import `PermissionMode`/`EnhancedMode` from `./loop` today (they use a local string-typed helper plus `as string` cast). Migrating them is Plan 06-03 scope.

## Verification

### Madge (pre / post)

```
Pre-edit:
  Processed 20 files (228ms)
  ✖ Found 3 circular dependencies!
  1) cursorLocalLauncher.ts > session.ts > loop.ts
  2) session.ts > loop.ts > cursorRemoteLauncher.ts
  3) session.ts > loop.ts

Post-edit:
  Processed 21 files (225ms)
  ✔ No circular dependency found!
  Exit code: 0
```

### Typecheck + Tests

- `bun typecheck` (cli + web + hub): exit 0.
- `bun run test`: **532 / 532 passed** (62 test files, ~2s).
- `bash scripts/check-no-cut-agents.sh`: all 5 guard sweeps green (Phase 3/4/5 territory unchanged).

### Diff stats

```
 cli/src/cursor/loop.ts      |  9 +--------
 cli/src/cursor/modes.ts     | 17 +++++++++++++++++
 cli/src/cursor/runCursor.ts |  3 ++-
 cli/src/cursor/session.ts   |  2 +-
 4 files changed, 21 insertions(+), 10 deletions(-)
```

### Acceptance Criteria

- [x] `cli/src/cursor/modes.ts` exists with single `^import` line (verified via Grep count = 1).
- [x] `cli/src/cursor/modes.ts` contains no `from './(loop|session|cursorLocalLauncher|cursorRemoteLauncher|cursorLocal)'` imports.
- [x] `export type PermissionMode` and `export interface EnhancedMode` both present in `modes.ts`.
- [x] `export type PermissionMode = CursorPermissionMode` no longer present in `loop.ts`.
- [x] `export interface EnhancedMode` no longer present in `loop.ts`.
- [x] `session.ts` has no `from './loop'` type import; uses `from './modes'`.
- [x] `runCursor.ts` uses `from './modes'` for type imports.
- [x] `npx madge --circular --extensions ts,tsx cli/src/cursor` exits 0 (was 3 cycles).
- [x] `bun typecheck` exits 0; `bun run test` exits 0 (532 tests).

## Deviations from Plan

None — plan executed exactly as written. The launcher non-edit is explicitly sanctioned by the plan's `<action>` clause: *"if no such import exists today (because the launcher files use only the local string-typed helper), do NOT add new imports here — that work belongs to Plan 03 when the helpers are deleted."*

## Self-Check: PASSED

- File `cli/src/cursor/modes.ts`: FOUND
- Commit `419e61d` (Task 1): FOUND in git log
- Commit `2bec53a` (Task 2): FOUND in git log
- madge --circular cli/src/cursor exit 0: VERIFIED
- bun typecheck + bun run test green: VERIFIED (532 / 532 tests)
