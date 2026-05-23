---
phase: 06-agent-runtime-shared-kit-mode-hardening
plan: 02
subsystem: shared / cli/agent / cli/cursor
tags: [refactor, typed-error, mode-config, slice-2, REFA-02, REFA-05]
requires:
  - "06-01 complete (cli/src/cursor/modes.ts leaf module exports PermissionMode/EnhancedMode)"
  - "Phase 5 complete (CURSOR_PERMISSION_MODES = ['default','plan','ask','yolo'] in shared/src/modes.ts)"
provides:
  - "shared/src/modes.ts: UnknownPermissionModeError class (cross-tier reusable, D-98)"
  - "cli/src/agent/modeConfig.ts: single permissionModeToCursorArgs(mode) helper + CursorArgsFragment type (REFA-02)"
  - "cli/src/cursor/runCursor.ts: exported resolvePermissionMode + RPC-boundary throw upgraded to UnknownPermissionModeError (REFA-05 / SC#3)"
  - "cli/src/agent/modeConfig.test.ts: 6-case unit suite (all valid modes + undefined + unknown-throw)"
  - "cli/src/cursor/runCursor.test.ts: 3-case RPC-boundary regression sentry (D-104 #3b / VALIDATION dim 3)"
affects:
  - "cli/src/cursor/runCursor.ts: bare Error('Invalid permission mode') replaced with typed UnknownPermissionModeError carrying offendingMode; resolvePermissionMode lifted to module scope and exported for testability"
tech-stack:
  added: []
  patterns:
    - "Pattern (D-98) — shared/ owns the typed error class so both shared and cli (and future hub/web) tiers can throw/catch it without importing across cli internals"
    - "Pattern (D-99/D-101) — single mode-mapping helper with branch order: undefined OR 'default' → {} fallthrough; valid modes → fragment; final fallthrough → throw UnknownPermissionModeError(mode)"
    - "Pattern (Pitfall 5) — safe stringification of unknown RPC payloads: typeof v === 'string' ? v : JSON.stringify(v) before passing to the typed error constructor"
key-files:
  created:
    - cli/src/agent/modeConfig.ts
    - cli/src/agent/modeConfig.test.ts
    - cli/src/cursor/runCursor.test.ts
    - .planning/phases/06-agent-runtime-shared-kit-mode-hardening/06-02-SUMMARY.md
  deleted: []
  modified:
    - shared/src/modes.ts
    - cli/src/cursor/runCursor.ts
decisions:
  - "Used `@hapi/protocol/modes` as the import specifier for UnknownPermissionModeError, not the `@hapi/shared/modes` shown in PLAN/PATTERNS/RESEARCH text. The directory is `shared/src/` but the npm-style package name in shared/package.json is `@hapi/protocol` (with a `./modes` export). All existing call sites in cli use `@hapi/protocol/modes` (e.g. cli/src/runner/run.ts, cli/src/commands/cursor.ts). Treating `@hapi/shared/...` as documentation shorthand for the `shared/` package was the only consistent reading. (Rule 3 deviation — fix-blocking-issue: using the literal string from PLAN would not resolve.)"
  - "Lifted resolvePermissionMode out of the runCursor() async function body to module scope before exporting. PLAN.md Task 4 framed this as 'a minimal one-keyword surface change — change `const` to `export const`', presupposing module scope; the function was actually a closure (lines 108-114 inside runCursor()). Lifting was required to satisfy the export. The closure had no captured state — it referenced only PermissionModeSchema, isPermissionModeAllowedForFlavor, and (now) UnknownPermissionModeError, all module-level imports. Behavioral identity at the call site is preserved (set-session-config handler invokes the same identifier with the same signature). (Rule 3 — auto-fix blocking issue.)"
  - "Did not declare `bun run --cwd shared test` as part of verification — shared/package.json has no `test` script (only the protocol package, no per-package test runner). Substituted with the project-wide `bun run test` which exercises cli + hub + web suites; baseline 532 + 9 new = 541 tests, all green."
metrics:
  duration: 8min
  completed: 2026-05-22
  task_count: 4
  file_count: 5
---

# Phase 6 Plan 2: UnknownPermissionModeError + ModeConfig helper Summary

One-liner: New `UnknownPermissionModeError` class in `shared/src/modes.ts` carries the offending mode string, a single `permissionModeToCursorArgs` helper in `cli/src/agent/modeConfig.ts` becomes the canonical permission-mode → CLI args mapping (replacing the launcher duplicates that Plan 03 will delete), and `cli/src/cursor/runCursor.ts::resolvePermissionMode` is now exported and throws the typed error with safe-stringified payload — covered by 6 modeConfig unit cases + 3 RPC-boundary regression cases.

## What Changed

**Task 1 — Add `UnknownPermissionModeError` to `shared/src/modes.ts` (commit `550133e`):**

- Appended class `UnknownPermissionModeError extends Error` after `isPermissionModeAllowedForFlavor` (kept Phase 5 D-81 anchor `AGENT_MESSAGE_PAYLOAD_TYPE = 'codex' as const` at line 9 untouched).
- `readonly offendingMode: string` field, `name = 'UnknownPermissionModeError'`, `message = `Unknown permission mode: ${offendingMode}\``.
- 4-space indent, no semicolons on top-level statements (matches file convention); class body uses internal semicolons.

**Task 2 — Create `cli/src/agent/modeConfig.ts` + colocated unit test (commit `285fe15`):**

- New `cli/src/agent/modeConfig.ts` exporting `type CursorArgsFragment = { mode?: 'plan' | 'ask'; yolo?: boolean }` and `function permissionModeToCursorArgs(mode: PermissionMode | undefined): CursorArgsFragment`.
- Branch order: `undefined || 'default'` → `{}` ; `'plan'` → `{ mode: 'plan' }` ; `'ask'` → `{ mode: 'ask' }` ; `'yolo'` → `{ yolo: true }` ; final fallthrough → `throw new UnknownPermissionModeError(mode)`.
- Imports: `import type { PermissionMode } from '@/cursor/modes'` (vitest @-alias), `import { UnknownPermissionModeError } from '@hapi/protocol/modes'`.
- `cli/src/agent/modeConfig.test.ts` with 6 `it()` cases — five passthrough returns + one throw assertion using `instanceof UnknownPermissionModeError` and `error.offendingMode === 'weird'`. Used `// @ts-expect-error` on the unknown-string call to satisfy TS strict.

**Task 3 — Upgrade `runCursor.ts::resolvePermissionMode` to throw the typed error (commit `9d5139f`):**

- Added `import { UnknownPermissionModeError } from '@hapi/protocol/modes'`.
- Replaced `throw new Error('Invalid permission mode')` with `throw new UnknownPermissionModeError(typeof value === 'string' ? value : JSON.stringify(value))` (Pitfall 5 — safe stringification of `unknown` payload).
- Did NOT add a try/catch — the typed error propagates through `loop()` to the existing try/catch at lines 131-148 which routes to `lifecycle.markCrash` (D-99 / D-102 path preserved).

**Task 4 — Export `resolvePermissionMode` + add RPC-boundary regression test (commit `5e1ee58`):**

- Lifted `resolvePermissionMode` from a closure inside `runCursor()` to module scope and prepended `export`. No captured-state changes (function only used module-scope imports).
- New `cli/src/cursor/runCursor.test.ts` with 3 `it()` cases:
  (a) `resolvePermissionMode('weird')` throws — assert both `instanceof UnknownPermissionModeError` and `offendingMode === 'weird'`.
  (b) `resolvePermissionMode({ not: 'a string' })` throws — assert `offendingMode === JSON.stringify({ not: 'a string' })` (Pitfall 5 sentry).
  (c) `resolvePermissionMode('plan')` returns `'plan'` (happy path).

## Verification

### Acceptance Criteria

- [x] `rg "export class UnknownPermissionModeError extends Error" shared/src/modes.ts` matches exactly once.
- [x] `rg "readonly offendingMode: string" shared/src/modes.ts` matches.
- [x] `rg "this.name = 'UnknownPermissionModeError'" shared/src/modes.ts` matches.
- [x] `rg "AGENT_MESSAGE_PAYLOAD_TYPE = 'codex' as const" shared/src/modes.ts` still matches once (Phase 5 D-81 anchor preserved).
- [x] `cli/src/agent/modeConfig.ts` exists; exports `permissionModeToCursorArgs` and `CursorArgsFragment`; `throw new UnknownPermissionModeError(mode)` present.
- [x] `cli/src/agent/modeConfig.test.ts` exists; ≥6 `it(` invocations; 6/6 cases green.
- [x] `rg "throw new Error\\('Invalid permission mode'\\)" cli/src/cursor/runCursor.ts` returns NO match.
- [x] `rg "throw new UnknownPermissionModeError" cli/src/cursor/runCursor.ts` matches once.
- [x] `rg "import.*UnknownPermissionModeError.*from '@hapi/protocol/modes'" cli/src/cursor/runCursor.ts` matches (note: package name is `@hapi/protocol`, not `@hapi/shared`; see decisions).
- [x] `rg "^export const resolvePermissionMode" cli/src/cursor/runCursor.ts` matches once.
- [x] `cli/src/cursor/runCursor.test.ts` exists; 3 `it(` invocations; all green.
- [x] `rg "Invalid permission mode" cli/src` returns 0 matches.
- [x] `rg "throw new UnknownPermissionModeError" cli/src shared/src` returns 2 matches (modeConfig.ts + runCursor.ts).
- [x] `bun typecheck` exits 0.
- [x] `bun run --cwd cli test -- --run src/agent/modeConfig.test.ts` exits 0 (6/6 passing).
- [x] `bun run --cwd cli test -- --run src/cursor/runCursor.test.ts` exits 0 (3/3 passing).
- [x] `bun run test` exits 0 — full suite green at slice boundary (D-107 #2 gate).

### Test Counts

| Surface | Files | Tests | Δ |
|---|---|---|---|
| cli (post-slice-2) | 34 (passed) + 1 skipped | 234 passed + 12 skipped | +2 files / +9 tests vs. pre-Plan-2 baseline |
| Total project (cli + hub + web) | 532 → 541 | 532 → 541 | +9 (6 modeConfig + 3 runCursor) |
| Test guard (`scripts/check-no-cut-agents.sh`) | — | 5/5 sweeps green | unchanged |

### Diff stats

```
 cli/src/agent/modeConfig.test.ts | 37 +++++++++++++++++++++++++++++++++++++
 cli/src/agent/modeConfig.ts      | 17 +++++++++++++++++
 cli/src/cursor/runCursor.test.ts | 34 ++++++++++++++++++++++++++++++++++
 cli/src/cursor/runCursor.ts      | 17 +++++++++--------
 shared/src/modes.ts              | 10 ++++++++++
 5 files changed, 107 insertions(+), 8 deletions(-)
```

## Deviations from Plan

### [Rule 3 — Fix blocking issue] Import specifier `@hapi/shared/modes` → `@hapi/protocol/modes`

- **Found during:** Task 2 (modeConfig.ts authoring) and Task 3 (runCursor.ts edit).
- **Issue:** PLAN.md, PATTERNS.md, and RESEARCH.md all spell the import as `@hapi/shared/modes`. The actual package name in `shared/package.json` is `@hapi/protocol` (with a `./modes` subpath export). Using the literal PLAN string would fail module resolution.
- **Fix:** Used `@hapi/protocol/modes` everywhere — matches existing call sites (`cli/src/runner/run.ts`, `cli/src/commands/cursor.ts`, the post-Phase-5 cursor module imports). Confirmed by `bun typecheck` passing.
- **Files modified:** `cli/src/agent/modeConfig.ts`, `cli/src/agent/modeConfig.test.ts`, `cli/src/cursor/runCursor.ts`, `cli/src/cursor/runCursor.test.ts`.
- **Commits:** `285fe15`, `9d5139f`, `5e1ee58`.

### [Rule 3 — Fix blocking issue] Lift `resolvePermissionMode` to module scope before exporting

- **Found during:** Task 4 (planned export keyword change).
- **Issue:** PLAN.md Task 4 said "minimal one-keyword surface change — change `const resolvePermissionMode = ...` to `export const resolvePermissionMode = ...`", presupposing module scope. The function was actually defined at lines 108-114 *inside* the `runCursor()` async function body — exporting in place is impossible (TS error: export inside function body).
- **Fix:** Lifted the function definition above `runCursor()` to module scope and prepended `export`. The lifted body has no captured state — it referenced only module-level imports (`PermissionModeSchema`, `isPermissionModeAllowedForFlavor`, `UnknownPermissionModeError`). The single call site (the `set-session-config` handler) calls the same identifier with the same signature; behavioral identity preserved.
- **Files modified:** `cli/src/cursor/runCursor.ts`.
- **Commit:** `5e1ee58`.

### [Plan-text adjustment, not a code change] `bun run --cwd shared test` not run

- **Found during:** Task 1 verification.
- **Issue:** `shared/package.json` has no `scripts` block at all (only `name`, `exports`, `dependencies`). `bun run --cwd shared test` errors `script not found`.
- **Fix:** Substituted with project-level `bun run test` (which transitively covers cli + hub + web, the only packages that import shared/modes). `bun typecheck` confirms shared/ compiles cleanly with the new class.

## Threat Surface

No new threats. The `<threat_model>` in PLAN.md classifies all three components as either `accept` (additive class, pure helper) or `mitigate` (RPC boundary — class upgrade only, schema validation unchanged). Verified: `PermissionModeSchema.safeParse + isPermissionModeAllowedForFlavor` chain in `resolvePermissionMode` is byte-identical to the pre-edit version; only the raised error class changed. No new files have network endpoints, auth paths, file access, or schema additions.

## Self-Check: PASSED

- File `shared/src/modes.ts`: present, contains `UnknownPermissionModeError` class.
- File `cli/src/agent/modeConfig.ts`: FOUND.
- File `cli/src/agent/modeConfig.test.ts`: FOUND.
- File `cli/src/cursor/runCursor.test.ts`: FOUND.
- Commit `550133e` (Task 1): FOUND in git log.
- Commit `285fe15` (Task 2): FOUND in git log.
- Commit `9d5139f` (Task 3): FOUND in git log.
- Commit `5e1ee58` (Task 4): FOUND in git log.
- `bun typecheck` exit 0: VERIFIED.
- `bun run test` exit 0 (541 / 541, +9 new green): VERIFIED.
- `rg "Invalid permission mode" cli/src` → 0 matches: VERIFIED.
- `rg "throw new UnknownPermissionModeError" cli/src shared/src` → 2 matches: VERIFIED.
