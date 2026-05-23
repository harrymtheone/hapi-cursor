---
phase: 9
plan: 4
subsystem: web
tags: [guard, sweep, ci, refactor, cycle-fix]
dependency_graph:
  requires: [phase-09-01, phase-09-02, phase-09-03]
  provides:
    - "scripts/check-no-cut-agents.sh Phase 9 sweep block (7 sub-checks + tail-invocation)"
    - "Single-command Phase 9 gate: bash scripts/check-no-cut-agents.sh && bun typecheck && bun run test"
  affects:
    - web/src/lib/messageWindowState.ts (cycle fix: persistence registered via hook)
    - web/src/lib/messageWindowPersistence.ts (registers itself with state at load)
    - web/src/lib/messageWindowTrim.ts (new: pure trim helpers extracted from pagination)
    - web/src/lib/messageWindowPaginationService.ts (re-exports trim helpers; cycle broken)
    - web/src/lib/messageWindowMergeService.ts (imports trim helpers from messageWindowTrim)
tech_stack:
  added: []
  patterns:
    - "Tail-invocation of per-package madge guard from sweep script (mirrors Phase 8 D-143 #4)"
    - "Dependency-inversion registrar (registerMessageWindowPersistence) to break a 2-file state/persistence cycle"
    - "Pure-helper extraction (messageWindowTrim.ts) to break a 2-file merge/pagination cycle"
key_files:
  created:
    - web/src/lib/messageWindowTrim.ts
    - .planning/phases/09-web-internal-decoupling/09-04-SUMMARY.md
  modified:
    - scripts/check-no-cut-agents.sh (+110 lines: Phase 9 sweep block + tail-invocation)
    - web/src/lib/messageWindowState.ts (persistence hooks + registrar replace direct import)
    - web/src/lib/messageWindowPersistence.ts (self-registers at module load)
    - web/src/lib/messageWindowPaginationService.ts (delegates trim helpers to messageWindowTrim)
    - web/src/lib/messageWindowMergeService.ts (imports trim helpers from messageWindowTrim)
decisions:
  - "D-158 honored verbatim: 7 numbered sub-checks appended after the Phase 8 PASS echo, ending with `bash $(dirname \"$0\")/check-no-circular-web.sh` so the phase gate is a single command."
  - "RESEARCH Q11 skeleton (lines 770–872) used as the source-of-truth body for the sweep block — no semantic divergence, only formatting."
  - "Phase 9 phase gate command: `bash scripts/check-no-cut-agents.sh && bun typecheck && bun run test` exits 0 across cli + hub + web + shared."
  - "Deviation Rule 1/3 — pre-existing madge cycles introduced by 09-02 (messageWindowState ↔ messageWindowPersistence, messageWindowMergeService ↔ messageWindowPaginationService) blocked sub-check #7. Fixed in-scope per the user's explicit instruction (`if scripts/check-no-circular-web.sh fails because of them, fix them as part of this plan's gate-green task`)."
metrics:
  duration_minutes: 10
  completed: 2026-05-23
---

# Phase 9 Plan 4: Append the D-158 sweep block + prove the phase gate green — Summary

Slice 4 closes Phase 9 by wiring the zero-tolerance structural invariants
established by Slices 1–3 into `scripts/check-no-cut-agents.sh`, and proving
the single-command phase gate (`bash scripts/check-no-cut-agents.sh &&
bun typecheck && bun run test`) exits 0 across the whole repo. The sweep
block adds 7 numbered sub-checks per D-158 (levenshtein dedup, base64 dedup,
file-size red lines, message-window sub-module budget, fallback testid +
reverse-assert, createApiQuery factory + ≥ 3 users) and tail-invokes
`scripts/check-no-circular-web.sh` so madge zero-cycles is enforced as part
of the same gate. The Phase 8 block is unmodified — Slice 4 only appends.

A pre-existing blocker surfaced during the gate run: the two
`messageWindow*` circular dependencies introduced by 09-02 made the madge
sub-check fail. Per the user's explicit instruction, these were fixed
in-scope by (a) extracting pure trim helpers into a new
`web/src/lib/messageWindowTrim.ts` and re-pointing `messageWindowMergeService`
at it, and (b) inverting the `messageWindowState ↔ messageWindowPersistence`
dependency through a one-shot registration hook so persistence registers
itself with state at module load. Existing test files keep working
unchanged because pagination still re-exports the trim helpers and
persistence still owns its public functions.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 4.0 | Fix pre-existing messageWindow* madge cycles (gate blocker) | b044a69 | web/src/lib/messageWindowState.ts, web/src/lib/messageWindowPersistence.ts, web/src/lib/messageWindowTrim.ts, web/src/lib/messageWindowPaginationService.ts, web/src/lib/messageWindowMergeService.ts |
| 4.1 | Append Phase 9 sweep block + tail-invoke web madge guard | f8d914a | scripts/check-no-cut-agents.sh |
| 4.2 | Full repo phase gate green (typecheck + tests + both guards) | — | (no source change; verification-only) |

## Phase 9 Sweep Block Layout

| # | Sub-check | Pass message |
|---|-----------|--------------|
| 1 | `function levenshteinDistance` / `function levenshtein` defined exactly 1× in `web/src/lib/fuzzyMatch.ts`, 0× in `cli/src`/`hub/src`/`shared/src`. | `Phase 9 D-158 #1: levenshteinDistance lives only in web/src/lib/fuzzyMatch.ts.` |
| 2 | `function estimateBase64Bytes` defined exactly 1× in `shared/src/uploads.ts`, 0× in `cli/src`/`hub/src`/`web/src`. | `Phase 9 D-158 #2: estimateBase64Bytes lives only in shared/src/uploads.ts.` |
| 3 | File-size red lines: 8 split/verify-only files < 500 lines, `views/_all.tsx` < 200 lines. | `Phase 9 D-158 #3: file-size budgets honored.` |
| 4 | `messageWindow*.ts` sub-modules under `web/src/lib/` (non-test) each < 400 lines. | `Phase 9 D-158 #4: message-window sub-modules each < 400.` |
| 5 | `data-testid="tool-card-unknown-fallback"` appears exactly 1× in `knownTools.tsx` AND `queryByTestId(...tool-card-unknown-fallback...)` reverse-asserted in `ToolCard.integration.test.tsx`. | `Phase 9 D-158 #5: fallback testid anchored in knownTools.tsx + reverse-asserted in integration test.` |
| 6 | `^export function createApiQuery` defined exactly 1× in `hooks/queries/_factory.ts` AND ≥ 3 other importer files under `hooks/queries/`. | `Phase 9 D-158 #6: createApiQuery defined once + ≥ 3 users.` |
| 7 | Tail-invokes `scripts/check-no-circular-web.sh`. | `No circular dependencies in web/src/ (madge).` + `Phase 9 guard PASS …` |

## Verification

- `bash scripts/check-no-cut-agents.sh` exits 0; final line is `✅ Phase 9 guard PASS (D-158 #1–#6 + madge zero cycles).`.
- `bash scripts/check-no-circular-web.sh` exits 0 standalone (2 prior cycles eliminated).
- `bun typecheck` exits 0 (cli + web + hub).
- `bun run test` exits 0 (cli + hub + web + guard chain).
- Phase 8 block sweeps still green (`Phase 8 guard PASS` still echoed); insertion was strictly append-only.
- Acceptance grep counts (all satisfied):
  - `grep -c "Phase 9 — Web internal decoupling (D-158)" scripts/check-no-cut-agents.sh` = 1
  - `grep -c "function levenshteinDistance" scripts/check-no-cut-agents.sh` = 2 (pattern + the `0×` reverse pattern)
  - `grep -c "function estimateBase64Bytes" scripts/check-no-cut-agents.sh` = 2
  - `grep -c "tool-card-unknown-fallback" scripts/check-no-cut-agents.sh` = 4 (positive + reverse-assert + error messages)
  - `grep -c "createApiQuery" scripts/check-no-cut-agents.sh` ≥ 2
  - `grep -c "check-no-circular-web.sh" scripts/check-no-cut-agents.sh` = 1 (tail-invocation)
  - `grep -c "Phase 9 guard PASS" scripts/check-no-cut-agents.sh` = 1

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1/3 - Pre-existing blocker] Fixed two `messageWindow*` madge cycles introduced by 09-02**
- **Found during:** Pre-Task 4.1 gate dry-run (`bash scripts/check-no-circular-web.sh` failed).
- **Issue:** 09-02 introduced two circular dependencies under `web/src/lib/`:
  1. `messageWindowMergeService.ts > messageWindowPaginationService.ts` (merge imported `cursorUpdatesAfterAppendTrim / trimPending / trimVisibleWithDropped` from pagination; pagination imported `mergeIntoPending` from merge).
  2. `messageWindowState.ts > messageWindowPersistence.ts` (state imported `schedulePersist / hydrateState` from persistence; persistence imported `buildState / createState / peekInternalState / InternalState` from state).
- **Fix:**
  1. Extracted the 7 pure trim helpers (`isAgentRunMessage`, `sliceForTrim`, `trimPreservingQueued`, `trimVisible`, `trimVisibleWithDropped`, `cursorUpdatesAfterAppendTrim`, `trimPending`) into a new `web/src/lib/messageWindowTrim.ts`. `messageWindowMergeService` now imports them from there; `messageWindowPaginationService` also imports them from there AND re-exports them so existing test imports (`from './messageWindowPaginationService'`) keep working unchanged.
  2. Inverted the state ↔ persistence dependency via a one-shot registrar: `messageWindowState.ts` exposes `registerMessageWindowPersistence({ schedulePersist, hydrateState })` and stores the hooks in a module-local `persistenceHooks` slot. `messageWindowPersistence.ts` self-registers at module load (function declarations are hoisted, so calling `registerMessageWindowPersistence({...})` at module top is safe). The facade transitively loads persistence through `messageWindowSubscriptions.ts` (which already imports `clearPersistedState`), so registration fires before any runtime `getState` call.
- **Files modified:** web/src/lib/messageWindowState.ts, web/src/lib/messageWindowPersistence.ts, web/src/lib/messageWindowTrim.ts (new), web/src/lib/messageWindowPaginationService.ts, web/src/lib/messageWindowMergeService.ts.
- **Commit:** b044a69
- **Justification for in-scope:** The user's prompt explicitly authorised: *"if scripts/check-no-circular-web.sh fails because of them, fix them as part of this plan's gate-green task (this is the final guard sweep). Treat any required cycle fix as in-scope per the plan's 'prove the full phase gate green' objective."* The fix is structural-only (zero behaviour change): facade public surface preserved, all 627 web tests pass unmodified, typecheck green.

No architectural deviations (Rule 4) triggered. No package installs.

## Self-Check: PASSED

- `scripts/check-no-cut-agents.sh` contains the Phase 9 block (verified line range begins at `# ===== Phase 9 — Web internal decoupling (D-158) =====` and ends at `echo "✅ Phase 9 guard PASS ..."`).
- New file `web/src/lib/messageWindowTrim.ts` exists (123 lines).
- Commits b044a69 and f8d914a present in `git log --oneline`.
- `bun typecheck` exit 0; `bun run test` exit 0; `bash scripts/check-no-circular-web.sh` exit 0; `bash scripts/check-no-cut-agents.sh` exit 0.
- Phase 9 SC#1–#4 from ROADMAP all met: madge zero cycles in `web/src/`, all targeted files under their size budgets, levenshtein/base64/createApiQuery deduped to single sources, full repo typecheck + tests green.
