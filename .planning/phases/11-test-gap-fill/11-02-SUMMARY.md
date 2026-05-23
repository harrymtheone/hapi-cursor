---
phase: 11-test-gap-fill
plan: 02
subsystem: cli/agent
tags: [tests, REFT-01, permission-matrix, type-exhaustiveness]
requires: []
provides:
  - "Cursor PermissionMode -> CursorArgsFragment matrix (type-exhaustive + runtime key cross-check + per-row strict toEqual)"
  - "REFT-01 contract: adding a new PermissionMode literal without extending the matrix fails `bun typecheck`"
  - "@hapi/protocol/flavors subpath export (enables direct deep-import of FLAVOR_CAPS without going through the root barrel)"
affects:
  - cli/src/agent/permissionMatrix.test.ts
  - shared/package.json
tech_stack:
  added: []
  patterns:
    - "compile-time exhaustiveness via `as const satisfies Record<PermissionMode, ExpectedSpec>` (D-176)"
    - "runtime key-set cross-check against the source-of-truth array AND the capability table (D-176 second prong + RESEARCH § Pattern 1)"
    - "per-row strict `toEqual` (never partial match) (D-177)"
    - "dedicated matrix file complementary to behavior file (D-178)"
key_files:
  created:
    - cli/src/agent/permissionMatrix.test.ts
  modified:
    - shared/package.json
decisions:
  - "Plan-mandated `import { FLAVOR_CAPS } from '@hapi/protocol/flavors'` initially failed Vite ESM resolution because shared/package.json did not declare a `./flavors` subpath. Resolved via Rule 3 deviation: added the export entry (additive, alphabetised next to `./modes`) rather than rewriting the import to `@hapi/protocol` root — preserves the plan's key-link contract and brings flavors in line with the existing `./modes` / `./schemas` / `./types` per-file subpath pattern."
metrics:
  duration: ~5 min
  completed: 2026-05-23
  tasks: 1
  files: 2
---

# Phase 11 Plan 02: REFT-01 Cursor permission contract matrix Summary

## One-Liner

Added `cli/src/agent/permissionMatrix.test.ts` — a type-exhaustive `Record<PermissionMode, ExpectedSpec>` matrix that cross-checks against both `CURSOR_PERMISSION_MODES` and `FLAVOR_CAPS.cursor.permissionModes` and per-row asserts `permissionModeToCursorArgs` with strict `toEqual` (7 tests, green).

## What Was Built

- **`cli/src/agent/permissionMatrix.test.ts`** (new file, 65 lines)
  - Imports `permissionModeToCursorArgs` + `CursorArgsFragment` from `./modeConfig`, `PermissionMode` from `@/cursor/modes`, `CURSOR_PERMISSION_MODES` from `@hapi/protocol/modes`, `FLAVOR_CAPS` from `@hapi/protocol/flavors`.
  - Defines `const MATRIX = { default: { expectedArgs: {} }, plan: { expectedArgs: { mode: 'plan' } }, ask: { expectedArgs: { mode: 'ask' } }, yolo: { expectedArgs: { yolo: true } } } as const satisfies Record<PermissionMode, ExpectedSpec>` (D-176 compile-time exhaustiveness).
  - **7 tests** in one `describe('Cursor permission contract matrix (REFT-01)')`:
    1. `matrix keys equal CURSOR_PERMISSION_MODES` (D-176 runtime key-set guard)
    2. `matrix keys equal FLAVOR_CAPS.cursor.permissionModes` (capability-table alignment, RESEARCH § Pattern 1)
    3–6. Four dynamically-named per-row tests: `mode 'default' produces {}`, `mode 'plan' produces {"mode":"plan"}`, `mode 'ask' produces {"mode":"ask"}`, `mode 'yolo' produces {"yolo":true}` (D-177 strict `toEqual`)
    7. `returns {} for undefined (carve-out — not a PermissionMode member)` (RESEARCH § Anti-patterns — undefined is intentionally outside the `Record` to keep `satisfies` exhaustiveness sound).
  - Top-of-file JSDoc anchors REFT-01 and references D-176 / D-177 / D-178 so future readers understand why this file is intentionally separate from `modeConfig.test.ts`.
  - 4-space indent, single quotes, named imports only, no default export (CONVENTIONS.md).

## Mutation Check (acceptance criteria item)

Per the plan's last acceptance criterion, executed the manual mutation simulation:

1. Edited `MATRIX` and renamed the `yolo` key to `yolo2`.
2. Ran `cd cli && bun typecheck` → exited **2** with:
   ```
   src/agent/permissionMatrix.test.ts(37,5): error TS2561: Object literal may only specify known properties, but 'yolo2' does not exist in type 'Record<"default" | "plan" | "ask" | "yolo", ExpectedSpec>'. Did you mean to write 'yolo'?
   ```
3. Reverted the key back to `yolo` and re-ran typecheck → exit 0.

The `satisfies Record<PermissionMode, ExpectedSpec>` clause is verified to enforce exhaustiveness — REFT-01's Success Criterion #1 ("adding a new mode without a matrix row fails the test") is functionally demonstrated.

## Verification Results

| Check | Command | Result |
|------|---------|--------|
| New file tests pass | `cd cli && bun run vitest run src/agent/permissionMatrix.test.ts` | ✅ 7 / 7 passed |
| No regression in sibling tests | `cd cli && bun run vitest run src/agent/` | ✅ 26 / 26 passed across 6 files (incl. modeConfig.test.ts 6/6 unchanged) |
| Typecheck | `cd cli && bun typecheck` | ✅ exit 0 |
| No `bun:test` import (Phase 11 guard #2 prep) | `grep -E "from\s+'bun:test'" cli/src/agent/permissionMatrix.test.ts` | ✅ no matches |
| No hardcoded mode literal array | `grep -E "\['default'\s*,\s*'plan'\s*,\s*'ask'\s*,\s*'yolo'\]" cli/src/agent/permissionMatrix.test.ts` | ✅ no matches |
| D-178 isolation | `modeConfig.ts` + `modeConfig.test.ts` diff against HEAD~1 | ✅ unchanged |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] Added `./flavors` subpath export to `shared/package.json`**

- **Found during:** Task 1, first `bun run vitest run` invocation.
- **Issue:** The plan mandates `import { FLAVOR_CAPS } from '@hapi/protocol/flavors'`, but `shared/package.json` only declared subpath exports for `./messages`, `./modes`, `./schemas`, `./types`. Vite's import-analysis stage failed with `Missing "./flavors" specifier in "@hapi/protocol" package`.
- **Fix:** Added `"./flavors": "./src/flavors.ts"` next to the existing `"./modes"` entry — additive, alphabetised, matches the per-file subpath pattern already in use.
- **Files modified:** `shared/package.json`
- **Why Rule 3 (not Rule 4):** The plan explicitly specifies the import path as the key-link contract (`key_links` row 3) and the underlying module/value already exist; this was a packaging gap, not an architectural decision. Choosing to rewrite the import to `@hapi/protocol` root instead would have silently weakened the plan's stated cross-check contract and split this module from the existing `./modes` / `./schemas` / `./types` deep-import convention.
- **Commit:** `d088987` (combined with the test file in the single Task 1 commit per atomic-task protocol).

## Known Stubs

None — all assertions are wired to live SUT (`permissionModeToCursorArgs`) and live source-of-truth imports (`CURSOR_PERMISSION_MODES`, `FLAVOR_CAPS.cursor.permissionModes`).

## Threat Flags

None — tests-only plan, no new network/auth/file/schema surface introduced.

## Self-Check: PASSED

- `cli/src/agent/permissionMatrix.test.ts` → FOUND
- `shared/package.json` → FOUND (modified)
- Commit `d088987` → FOUND (`git log --oneline -1`: `d088987 test(11-02): add REFT-01 Cursor permission contract matrix`)
