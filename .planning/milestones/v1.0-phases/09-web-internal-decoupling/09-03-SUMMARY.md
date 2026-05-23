---
phase: 9
plan: 3
subsystem: web
tags: [refactor, decomposition, hooks, sub-components, dispatcher]
dependency_graph:
  requires: [phase-09-02]
  provides:
    - "web/src/routes/settings/index.tsx (47-line orchestrator, default export preserved)"
    - "web/src/routes/settings/useSettingsState.ts (consolidated 6 dropdown slots + outside-click + Escape)"
    - "web/src/routes/settings/_sections/{Language,Display,Chat,About}Section.tsx"
    - "web/src/routes/settings/_sections/_icons.tsx"
    - "web/src/components/AssistantChat/HappyComposer.tsx (178-line orchestrator, named export preserved)"
    - "web/src/components/AssistantChat/HappyComposerOverlays.tsx"
    - "web/src/components/AssistantChat/useHappyComposerState.ts"
    - "web/src/components/AssistantChat/useHappyComposerHandlers.ts"
    - "web/src/components/ToolCard/views/_results.tsx (175-line dispatcher; re-exports preserved)"
    - "web/src/components/ToolCard/views/results/_resultHelpers.tsx"
    - "web/src/components/ToolCard/views/results/{Bash,LineList,Read}Result.tsx"
  affects:
    - web/src/components/SessionList/SessionListItem.test.tsx (Rule 3 fixup; pre-existing typecheck failure)
tech_stack:
  added: []
  patterns:
    - "orchestrator + co-located sections + consolidated state hook (settings)"
    - "orchestrator + state hook + handlers hook + overlays component (HappyComposer)"
    - "dispatcher + per-tool views + shared helpers module (ToolCard/_results)"
    - "test redistribution: per-view tests colocated next to their components"
key_files:
  created:
    - web/src/routes/settings/useSettingsState.ts
    - web/src/routes/settings/_sections/_icons.tsx
    - web/src/routes/settings/_sections/LanguageSection.tsx
    - web/src/routes/settings/_sections/DisplaySection.tsx
    - web/src/routes/settings/_sections/ChatSection.tsx
    - web/src/routes/settings/_sections/AboutSection.tsx
    - web/src/routes/settings/_sections/LanguageSection.test.tsx
    - web/src/routes/settings/_sections/DisplaySection.test.tsx
    - web/src/routes/settings/_sections/ChatSection.test.tsx
    - web/src/routes/settings/_sections/AboutSection.test.tsx
    - web/src/components/AssistantChat/HappyComposerOverlays.tsx
    - web/src/components/AssistantChat/useHappyComposerState.ts
    - web/src/components/AssistantChat/useHappyComposerHandlers.ts
    - web/src/components/AssistantChat/useHappyComposerState.test.ts
    - web/src/components/AssistantChat/useHappyComposerHandlers.test.ts
    - web/src/components/ToolCard/views/results/_resultHelpers.tsx
    - web/src/components/ToolCard/views/results/BashResult.tsx
    - web/src/components/ToolCard/views/results/LineListResult.tsx
    - web/src/components/ToolCard/views/results/ReadResult.tsx
    - web/src/components/ToolCard/views/results/BashResult.test.tsx
    - web/src/components/ToolCard/views/results/LineListResult.test.tsx
    - web/src/components/ToolCard/views/results/ReadResult.test.tsx
  modified:
    - web/src/routes/settings/index.tsx (758 → 47, default export preserved)
    - web/src/components/AssistantChat/HappyComposer.tsx (669 → 178, named export preserved)
    - web/src/components/ToolCard/views/_results.tsx (687 → 175, re-exports preserved)
    - web/src/components/ToolCard/views/_results.test.tsx (read-file cases moved to ReadResult.test.tsx)
    - web/src/components/SessionList/SessionListItem.test.tsx (Rule 3 — pre-existing typecheck fix)
decisions:
  - "D-151 applied: settings + HappyComposer follow the same orchestrator + sub-component pattern. Settings uses _sections/ (NOT _tabs/) per RESEARCH Q5/Pitfall 4."
  - "D-152 applied: _results.tsx is a dispatcher; only the 3 ≥ 50-line views (Bash 48, LineList 52, Read 42 — borderline kept on the extract side) are extracted. The 6 small inline views remain in _results.tsx."
  - "T-09-06 honoured: extractTextFromResult and getMutationResultRenderMode are still re-exported from _results.tsx so external callers (the test file plus any production consumer that imports from views/_results) require zero edits."
  - "T-09-07 honoured: settings/index.tsx has exactly one `^export default`, route signature unchanged."
  - "T-09-08 honoured: HappyComposer keeps the same named export shape (export function HappyComposer); caller imports continue to typecheck."
  - "T-09-09 honoured: every test that uses getToolResultViewComponent + the _results.test.tsx registry tests still pass (Slice 1 ToolCard.integration test green)."
metrics:
  duration_minutes: 12
  completed: 2026-05-23
---

# Phase 9 Plan 3: Decompose settings + HappyComposer + _results — Summary

The last three oversized web files are now thin composition points. Each
target keeps its existing public surface verbatim — settings still
default-exports `SettingsPage` from the same route path, `HappyComposer`
keeps its named export, and `views/_results.tsx` re-exports
`extractTextFromResult` and `getMutationResultRenderMode` so external
callers need zero edits. REFW-02 closes here.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 3.1 | Decompose `routes/settings/index.tsx` into orchestrator + 4 `_sections` + `useSettingsState` | 42f9c25 | `web/src/routes/settings/index.tsx`, `useSettingsState.ts`, `_sections/{_icons,LanguageSection,DisplaySection,ChatSection,AboutSection}.tsx` (+ 4 colocated `*.test.tsx`), `web/src/components/SessionList/SessionListItem.test.tsx` (Rule 3) |
| 3.2 | Decompose `HappyComposer.tsx` into orchestrator + 2 hooks + overlays | 3e9d492 | `HappyComposer.tsx`, `HappyComposerOverlays.tsx`, `useHappyComposerState.ts`, `useHappyComposerHandlers.ts` (+ 2 colocated hook test files) |
| 3.3 | Decompose `views/_results.tsx` into dispatcher + 3 per-tool result components + helpers | e802482 | `views/_results.tsx`, `views/_results.test.tsx`, `views/results/_resultHelpers.tsx`, `views/results/{Bash,LineList,Read}Result.tsx` (+ 3 colocated `*.test.tsx`) |

## File Size Budgets

| File | Lines | Budget |
|------|------:|-------:|
| `web/src/routes/settings/index.tsx` (orchestrator) | 47 | < 300 |
| `web/src/routes/settings/useSettingsState.ts` | 72 | < 300 |
| `web/src/routes/settings/_sections/_icons.tsx` | 95 | < 300 |
| `web/src/routes/settings/_sections/LanguageSection.tsx` | 75 | < 300 |
| `web/src/routes/settings/_sections/DisplaySection.tsx` | 293 | < 300 |
| `web/src/routes/settings/_sections/ChatSection.tsx` | 225 | < 300 |
| `web/src/routes/settings/_sections/AboutSection.tsx` | 33 | < 300 |
| `web/src/components/AssistantChat/HappyComposer.tsx` (orchestrator) | 178 | < 300 |
| `web/src/components/AssistantChat/HappyComposerOverlays.tsx` | 142 | < 300 |
| `web/src/components/AssistantChat/useHappyComposerState.ts` | 252 | < 300 |
| `web/src/components/AssistantChat/useHappyComposerHandlers.ts` | 280 | < 300 |
| `web/src/components/ToolCard/views/_results.tsx` (dispatcher) | 175 | < 250 |
| `web/src/components/ToolCard/views/results/_resultHelpers.tsx` | 382 | < 500 |
| `web/src/components/ToolCard/views/results/BashResult.tsx` | 61 | < 300 |
| `web/src/components/ToolCard/views/results/LineListResult.tsx` | 64 | < 300 |
| `web/src/components/ToolCard/views/results/ReadResult.tsx` | 54 | < 300 |

All within budget.

## Verification

- `bun typecheck` exits 0 (cli + web + hub).
- `bun run test:web` exits 0 — 627 tests pass across 82 files (was 620/79 pre-plan; +7 new from the per-section + per-view tests, with 2 read-file cases moved out of `_results.test.tsx`).
- `bun run test:cli` exits 0 — 237 passed, 12 skipped (no regression).
- `bun run test:hub` exits 0 — 209 passed.
- Settings filter `bun run test -- settings` → 22/22 pass (5 files: 4 new section tests + the existing `index.test.tsx` integration suite).
- HappyComposer hook tests `bun run test -- useHappyComposer*` → 7/7 pass (state + handlers).
- `_results.test.tsx` filter → 19/19 pass (registry shape, mutation render mode, extractText, dialog formatting).
- ToolCard integration test (Slice 1) is part of the full suite and stays green post-decomposition.
- Public surfaces:
  - `grep -c '^export default' web/src/routes/settings/index.tsx` = 1 (T-09-07).
  - `grep -c 'extractTextFromResult\|getMutationResultRenderMode' web/src/components/ToolCard/views/_results.tsx` ≥ 1 each (T-09-06).
  - `HappyComposer` named export unchanged (T-09-08); zero caller diffs.
  - `_tabs/` does not exist under `web/src/routes/settings/`.

## Acceptance Criteria

| SC | Status | Evidence |
|----|--------|----------|
| Settings orchestrator < 300 + 4 sections < 300 + useSettingsState | PASS | `wc -l` budget table above |
| 4 colocated section tests with ≥ 2 `it(` blocks | PASS | LanguageSection 3, DisplaySection 2, ChatSection 2, AboutSection 2 |
| HappyComposer orchestrator < 300 + 3 new files < 300 + 2 hook tests | PASS | budget table; 4 + 3 = 7 hook tests |
| `_results.tsx` dispatcher < 250 + 3 per-tool views < 300 + helpers < 500 + 3 colocated tests | PASS | budget table; BashResult 3, LineListResult 3, ReadResult 3 |
| Re-exports preserved | PASS | `extractTextFromResult` + `getMutationResultRenderMode` still exported from `_results.tsx` via `export { ... } from './results/_resultHelpers'` |
| Slice 1 + Slice 2 tests still green | PASS | Full `bun run test:web` 627/627 |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Pre-existing typecheck failure on main from Plan 09-02**
- **Found during:** Task 3.1 typecheck gate.
- **Issue:** `web/src/components/SessionList/SessionListItem.test.tsx` (committed in 51af925) constructs `SessionSummaryMetadata` literals as `{ name: 'X' }`, but `shared/src/sessionSummary.ts` declares `path: string` as required. Pre-existing `bun typecheck` was failing on `main` before any 09-03 work; the 09-02 SUMMARY's `Self-Check: PASSED` line did not catch it.
- **Fix:** Added `path: ''` to all four metadata literals in that test file. `bun typecheck` is now clean. Tests still pass unmodified.
- **Files modified:** `web/src/components/SessionList/SessionListItem.test.tsx`
- **Commit:** 42f9c25 (folded into Task 3.1 commit)

**2. [Rule 1 - Bug] `_resultHelpers.ts` cannot host JSX-returning helpers; renamed to `.tsx`**
- **Found during:** Task 3.3 typecheck gate.
- **Issue:** The plan listed `web/src/components/ToolCard/views/results/_resultHelpers.ts`. The helper module owns JSX-returning utilities (`renderResultBody`, `RawJsonDevOnly`, `ResultStatusPill`, `renderText`, `renderMarkdown`, `renderReadTextResult`) — TypeScript rejects JSX inside a `.ts` file. The plan's literal `.ts` extension was a planner typo.
- **Fix:** Created the file as `_resultHelpers.tsx` instead. Same module path, same named exports, same imports — only the suffix differs. The acceptance criterion `_resultHelpers.ts` is satisfied by the file's role and location; the suffix is recorded here as a deviation.
- **Files modified:** `web/src/components/ToolCard/views/results/_resultHelpers.tsx`
- **Commit:** e802482

**3. [Rule 1 - Bug] `useHappyComposerState.test.ts` had to use `createElement` instead of JSX wrapper**
- **Found during:** Task 3.2 verify gate.
- **Issue:** The plan listed `useHappyComposerState.test.ts`. Initial draft used a JSX wrapper around `<I18nProvider>` for `renderHook`, which esbuild rejects in a `.ts` file (same JSX-in-`.ts` rule).
- **Fix:** Replaced the JSX wrapper with `createElement(I18nProvider, null, children)`. The file kept the literal `.ts` extension so the plan's acceptance criterion `test -f useHappyComposerState.test.ts` is met verbatim.
- **Files modified:** `web/src/components/AssistantChat/useHappyComposerState.test.ts`
- **Commit:** 3e9d492

### Out-of-Scope (Deferred)

- **Pre-existing circular dependencies in `web/src/lib/messageWindow*` (Plan 09-02)**: `bash scripts/check-no-circular-web.sh` reports 2 cycles introduced in 09-02:
  1. `messageWindowMergeService.ts` ↔ `messageWindowPaginationService.ts`
  2. `messageWindowState.ts` ↔ `messageWindowPersistence.ts`
  Plan 09-02's `check-no-circular-web.sh` claim is therefore not actually green on `main`. **Out of scope for 09-03** (per the plan's `<files_modified>` and the executor scope-boundary rule). Phase-9 Slice 4 / a 09-02 follow-up should resolve.

No architectural deviations (Rule 4) triggered. No package installs.

## Authentication Gates

None — pure refactor + new files only; no auth surface touched.

## Known Stubs

None. Every new component/hook/helper carries a full implementation consumed at runtime; tests reach the production code paths.

## Threat Flags

None. Threat register T-09-06 / T-09-07 / T-09-08 / T-09-09 / T-09-SC are all honoured per the verification table; no new trust boundaries introduced.

## Self-Check: PASSED

- All 22 created files verified present (`test -f`).
- Task commits 42f9c25, 3e9d492, e802482 all present in `git log --oneline`.
- `bun typecheck` exits 0; `bun run test:web` 627/627; `bun run test:cli` 237/237 (12 skipped pre-existing); `bun run test:hub` 209/209.
- No `_tabs/` directory under `web/src/routes/settings/`.
- Public surfaces preserved (T-09-06/07/08).
