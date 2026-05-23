---
phase: 05-flavor-consolidation-capability-abstraction
plan: 01
subsystem: shared
tags: [shared, flavors, capabilities, types, refactor, slice-1a]

requires:
  - phase: 04-cut-deployment-infrastructure
    provides: stable shared/ surface with prior phases' source-guard scaffolding
provides:
  - "`FlavorCapabilities` type (7 D-73 slots, all readonly) exported from `shared/src/flavors.ts`"
  - "`FLAVOR_CAPS: Record<AgentFlavor, FlavorCapabilities>` value-bearing table with populated cursor row + placeholder rows for claude/codex/gemini/opencode"
  - "`getCapabilities(flavor)` and `getCapability(flavor, key)` lookup helpers with `null` graceful-degrade per D-76"
  - "23-case capability-lookup focused unit test (`shared/src/flavors.test.ts`) per SC#4 + D-87"
affects: [phase-05, refa-01, slice-1a]

tech-stack:
  added: []
  patterns:
    - "Set→Record evolution: capability table promoted from boolean-flag `Set<Capability>` to value-bearing `Record<AgentFlavor, FlavorCapabilities>`"
    - "Single-source-of-truth lookup helpers (`getCapabilities` / `getCapability`) with `?? null` collapse safe because D-73 slots are either non-null values or already `null`"
    - "Additive evolution under a 5-literal `AgentFlavor` union: placeholder non-cursor rows preserve legacy `hasCapability` semantics so downstream consumers (plans 02–06) can migrate one-by-one before Slice 1b deletes them"

key-files:
  created:
    - .planning/phases/05-flavor-consolidation-capability-abstraction/05-01-SUMMARY.md
  modified:
    - shared/src/flavors.ts
    - shared/src/flavors.test.ts

key-decisions:
  - "Adopted the value-bearing `Record<AgentFlavor, FlavorCapabilities>` shape (D-72/D-73) instead of staying on `ReadonlySet<Capability>`; the Set form cannot carry permission-mode lists, context budgets, or slash-command directories."
  - "Cursor row populated with the seven D-73 literals exactly (`permissionModes=CURSOR_PERMISSION_MODES`, `supportsModelChange=false`, `supportsEffort=false`, `contextBudgetTokens=null`, `userSlashCommandsDir=null`, `projectSlashCommandsDir=null`, `permissionToneCopy='cursor'`)."
  - "Non-cursor rows kept as placeholders that mirror current `hasCapability` semantics (claude → model-change+effort; codex/gemini/opencode → model-change only); these evaporate in Slice 1b once `AgentFlavor` narrows to `'cursor'`."
  - "Unknown / null / undefined flavor returns `null` from the lookup helpers (D-76 — graceful-degrade because flavor strings come from SQLite + SSE wire data; mode-style throw-on-unknown belongs to Phase 6 REFA-05)."
  - "Compat helpers (`hasCapability`, `supportsModelChange`, `supportsEffort`, `getFlavorLabel`, `isKnownFlavor`) kept their public signatures and were rewired on top of the Record so downstream consumers do not churn until they migrate to `getCapability` directly."
  - "Test cases 14 (`getFlavorLabel('claude')`) and 17 (`isKnownFlavor('claude')`) assert the current pre-narrow behavior with `TODO(plan 05-07-PLAN.md)` markers so Slice 1b owns the tightening atomically when AgentFlavor narrows."
  - "`isCodexFamilyFlavor` intentionally NOT deleted in this slice; the live consumer in `web/src/components/ToolCard/PermissionFooter.tsx` is migrated in plan 05-02, and the symbol is removed in plan 05-07."

patterns-established:
  - "Capability table evolves additively: introduce the new shape under the old union; rewire compat helpers; let downstream consumers migrate; narrow the union and delete placeholders in a separate slice."
  - "23-case focused matrix tests one flavor (cursor) + null/unknown fallbacks for each public helper, deliberately avoiding cross-flavor permutation (which REFT-01 in Phase 11 owns)."

requirements-completed: []  # REFA-01 spans all of Phase 05; closed by Slice 1b (plan 05-07)

duration: 5 min
completed: 2026-05-22
---

# Phase 05 Plan 01: Capability Table Slice 1a Summary

**Introduced the value-bearing `FlavorCapabilities` Record + `getCapabilities`/`getCapability` lookup helpers in `shared/src/flavors.ts` as a purely additive Slice 1a; cursor row populated per D-73, placeholder non-cursor rows preserve legacy semantics until Slice 1b narrows `AgentFlavor`; `shared/src/flavors.test.ts` rewritten to the 23-case D-87 matrix and the full repo `bun typecheck && bun run test` gate is green.**

## Performance

- **Duration:** ~5 min
- **Tasks:** 2
- **Files modified:** 2
- **Files created:** 1 (this SUMMARY)

## Accomplishments

### Task 1 — Capability Record + lookup helpers (commit `4bd30cd`)

- Replaced `FLAVOR_CAPS: Record<AgentFlavor, ReadonlySet<Capability>>` with `Record<AgentFlavor, FlavorCapabilities>`.
- Added the `FlavorCapabilities` type with all 7 D-73 slots, every field `readonly`.
- Added `getCapabilities(flavor)` and `getCapability(flavor, key)` exports; both return `null` on unknown/null/undefined input.
- Rewired `hasCapability`, `supportsModelChange`, `supportsEffort` on top of the Record while preserving their public signatures (downstream consumers compile unchanged).
- Imported `CLAUDE_PERMISSION_MODES`, `CODEX_PERMISSION_MODES`, `GEMINI_PERMISSION_MODES`, `OPENCODE_PERMISSION_MODES`, `CURSOR_PERMISSION_MODES`, `PermissionMode` from `./modes` (zero re-implementation of permission mode literals).

### Task 2 — 23-case capability-lookup focused test matrix (commit `af334d9`)

- Rewrote `shared/src/flavors.test.ts` into a single `describe('flavor capability table', ...)` block with 23 `test()` cases mapped 1:1 to 05-RESEARCH lines 549–572.
- Imports surface: `Capabilities`, `getCapabilities`, `getCapability`, `getFlavorLabel`, `hasCapability`, `isKnownFlavor`, `supportsEffort`, `supportsModelChange`.
- Cases 14 + 17 carry `TODO(plan 05-07-PLAN.md)` markers and assert the current pre-narrow behavior (`getFlavorLabel('claude') === 'Claude'`, `isKnownFlavor('claude') === true`) so this slice stays green; plan 05-07 tightens both atomically when `AgentFlavor` narrows.

## Verification Evidence

- `cd shared && bun test flavors.test.ts` → 23 pass, 0 fail, 33 expect() calls.
- `bun typecheck` (repo root, all packages cli/web/hub) → exit 0.
- `bun run test` (repo root) → 596 tests pass across 69 files; existing source-guard scripts (`check-no-cut-agents.sh`, namespace-residue, deployment-infrastructure-residue) all green.

## Placeholder Rows for Slice 1b Deletion

The four non-cursor entries in `FLAVOR_CAPS` exist purely to satisfy
`Record<AgentFlavor, FlavorCapabilities>` while `AgentFlavor` is still the
5-literal union. Slice 1b (plan `05-07-PLAN.md`) narrows the union and
deletes them; the literal line ranges in `shared/src/flavors.ts` are:

| Flavor   | Line range (post-Task-1) | Notes                                                                 |
|----------|--------------------------|-----------------------------------------------------------------------|
| `claude` | 48–56                    | `permissionToneCopy: 'codex'` until consumer in `PermissionFooter` migrates (plan 05-02). |
| `codex`  | 57–65                    | Mirrors legacy `Set([ModelChange])` semantics. |
| `gemini` | 66–74                    | Mirrors legacy `Set([ModelChange])` semantics. |
| `opencode` | 75–83                  | Mirrors legacy `Set([ModelChange])` semantics. |

`FLAVOR_LABELS` (5-row map) and `isCodexFamilyFlavor()` also remain untouched
this slice; deletion is owned by plan 05-07 after plan 05-02 migrates the
`PermissionFooter` consumer.

## Slice-1b Tightening TODOs (2 sites)

`shared/src/flavors.test.ts` cases 14 and 17 each carry a `// TODO(plan 05-07-PLAN.md)`
comment plus the assertion of current behavior. Plan 05-07 must:

1. Flip case 14 to `expect(getFlavorLabel('claude')).toBe('Unknown')`.
2. Flip case 17 to `expect(isKnownFlavor('claude')).toBe(false)`.

Both flips happen in the same commit as the `AgentFlavor = 'cursor'` narrow
and the placeholder-row deletion above.

## Deviations from Plan

None — plan executed exactly as written. Slice gate `bun typecheck && bun run test`
is green from the repo root on the first attempt.

## Threat Surface Notes

The plan's `<threat_model>` registers two mitigations: (T-05-01-01) unknown
flavor returns `null` (verified by test cases 9, 10, 12, 15, 21); (T-05-01-02)
no JSON.parse, no recursion, no new external attack surface introduced — the
slice is type-level only. Both mitigations are present in `flavors.ts` and
exercised by the new test matrix. No new threat flags discovered.

## Commits

| Hash      | Type | Description                                                         |
|-----------|------|---------------------------------------------------------------------|
| `4bd30cd` | feat | introduce FlavorCapabilities Record + lookup helpers                |
| `af334d9` | test | rewrite flavors.test.ts to 23-case capability-lookup matrix         |

## Self-Check: PASSED

- `shared/src/flavors.ts` exists with `FlavorCapabilities` type, Record-shaped `FLAVOR_CAPS`, `getCapabilities`, `getCapability` exports.
- `shared/src/flavors.test.ts` exists with 23 `test()` cases (verified by file rewrite).
- Commits `4bd30cd` and `af334d9` exist in `git log`.
- `bun typecheck` exit 0; `bun run test` exit 0 (596 passing).
