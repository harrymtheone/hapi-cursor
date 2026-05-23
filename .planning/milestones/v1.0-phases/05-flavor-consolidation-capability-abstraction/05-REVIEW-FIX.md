---
phase: 05-flavor-consolidation-capability-abstraction
fixed_at: 2026-05-22T13:37:00Z
review_path: .planning/phases/05-flavor-consolidation-capability-abstraction/05-REVIEW.md
iteration: 1
findings_in_scope: 4
fixed: 4
skipped: 0
status: all_fixed
---

# Phase 05: Code Review Fix Report

**Fixed at:** 2026-05-22T13:37:00Z
**Source review:** `.planning/phases/05-flavor-consolidation-capability-abstraction/05-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope: 4 (WR-01, WR-02, WR-03, WR-04 — Critical+Warning tier)
- Fixed: 4
- Skipped: 0

## Fixed Issues

### WR-01: `PermissionFooter` — `void getCapability(...)` is a dead expression after Phase-5 narrow

**Files modified:** `web/src/components/ToolCard/PermissionFooter.tsx`
**Commit:** `c2b17dc`
**Applied fix:** Replaced the `void (getCapability(...) ?? 'cursor')` no-op statement with a comment block that explicitly names `getCapability` as the dependency anchor. The `import { getCapability } from '@hapi/protocol'` at line 7 is preserved (the import alone keeps the dependency graph intact). This aligns with WR-03 Option 2 (keep the slot, document it) per the user's instruction to prefer the conservative approach.

### WR-02: `scripts/check-no-cut-agents.sh` — `PHASE5_BRANCH_PATTERN` post-filters can mask combined-condition residues

**Files modified:** `scripts/check-no-cut-agents.sh`
**Commit:** `37501ad`
**Applied fix:** Replaced the chained whole-line `grep -v "=== 'cursor'" | grep -v "typeof flavor ==="` with a substring-removal pipeline (`sed -E "s/typeof flavor === ['\"][a-z]+['\"]//g; s/=== ['\"]cursor['\"]//g"`) followed by re-grep for the residual `flavor === '...'` pattern. This way a line that mixes a cursor branch with a non-cursor literal (e.g. `flavor === 'gemini' && other === 'cursor'`) still trips the gate because the non-cursor `=== '...'` survives the substring strip. Single-quote and double-quote cursor literals are both covered. Verified: `bash scripts/check-no-cut-agents.sh` still passes green against the current tree.

**Logic note:** Requires human verification of edge cases — e.g. behavior when `typeof flavor` appears with an unusual type name (regex `[a-z]+` covers `string`/`number`/`undefined` etc. but not e.g. uppercase variants). The current source tree is unaffected.

### WR-03: `permissionToneCopy` capability slot is orphaned post-Phase-5

**Files modified:** `shared/src/flavors.ts`, `shared/src/flavors.test.ts`
**Commits:** `51d96a4` (initial doc + test), `3a6a7b3` (JSDoc rephrase to satisfy source guard — initial draft contained the literal `'codex'` in an example, which tripped `check-no-cut-agents.sh`'s `PHASE5_LITERAL_PATTERN`; rephrased to avoid the literal)
**Applied fix:** Chose Option 2 per user instruction (keep the slot, document explicitly + add regression test). Added a JSDoc block above `permissionToneCopy: 'cursor'` in `FlavorCapabilities` calling out the `@deferred CURS-*` forward-extensibility intent, the link to `flavors.test.ts` regression, and the WR-01/WR-03 review context. Added test case 12b: `expect(getCapability('cursor', 'permissionToneCopy')).toBe('cursor')` so accidental deletion or re-typing of the slot is caught at the `getCapability` API surface (case 8 already covers the `getCapabilities` lookup; this complements at the per-slot API).

### WR-04: `hub/src/sync/syncEngine.ts::resumeSession` — `flavor !== 'cursor'` branch is statically unreachable

**Files modified:** `hub/src/sync/syncEngine.ts`
**Commits:** `ba0a21c` (rewire defense), `615b0a3` (followup: replace orphaned `flavor` reference at `spawnSession` call site with `target.flavor` — the `const flavor = target.flavor` line was removed by the rewire but `flavor` was still referenced later in the function; caught by `hub` test suite)
**Applied fix:** Replaced `const flavor = target.flavor; if (flavor !== 'cursor') ...` with `const historicalFlavor = metadata.flavor; if (historicalFlavor != null && historicalFlavor !== 'cursor') ...`. This exercises the actual historical-metadata risk (`MetadataSchema.flavor: z.string().nullish()` stays wide per RESEARCH §"Wire-layer narrow safety" §1) rather than checking a statically-`'cursor'` field. The downstream `spawnSession(..., target.flavor, ...)` call site was updated to read `target.flavor` directly since the local `flavor` binding was removed.

**Logic note:** Requires human verification — the defense semantics shifted from "reject if `target.flavor !== 'cursor'`" (impossible) to "reject if `metadata.flavor` is a non-null non-cursor string" (the documented historical-tampering scenario from T-05-06-02). All 149 hub tests pass including the 4 session-model resume tests; the new branch is dead under current test fixtures (none seed a non-cursor `metadata.flavor`), so the change is covered structurally but the defense remains unexercised by tests. Consider adding a regression test that seeds a historical row with `metadata.flavor === 'codex'` to confirm the branch fires.

## Skipped Issues

None.

## Verification Performed

- **Source guard:** `bash scripts/check-no-cut-agents.sh` — green after all fixes (all 5 checks pass).
- **Shared tests:** `bun test shared/src/flavors.test.ts` — 24/24 pass (includes new case 12b).
- **Hub tests:** `cd hub && bun run test` — 149/149 pass (includes 4 session-model resume tests that exercise the rewired `resumeSession` path).
- **Web tests:** `cd web && bun run test` — 532/532 pass (includes `PermissionFooter` consumers).
- **Per-file lints:** `ReadLints` on modified `.tsx`/`.ts` files — no errors.

---

_Fixed: 2026-05-22T13:37:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_

## Iteration 2 (Info-scope, --all)

**Fixed at:** 2026-05-22T15:51:00Z
**Scope:** Info-tier findings (IN-01, IN-02) per `--all` invocation
**Summary:**
- Findings in scope: 2
- Fixed: 1 (IN-02)
- Deferred / no-op: 1 (IN-01)
- Skipped: 0

### IN-01: `getCapability` cannot distinguish "unknown flavor" from "known flavor with `null` slot`

**File:** `shared/src/flavors.ts:67-74` (now `60-83` after iteration-1 edits)
**Status:** no-op (documentation-only / deferred)
**Commit:** none
**Rationale:** REVIEW.md explicitly states *"Fix: None required for v1; track in the capability-table evolution notes for Milestone 2."* The current behavior is documented as intentional per D-76 graceful-degrade, and the existing JSDoc on `getCapability` (lines 70-74 of `shared/src/flavors.ts`) already captures the design tradeoff. No code change is warranted; the disambiguation helper (e.g. `getCapabilityOr` returning a discriminated union) is deferred to Milestone 2 when a future capability slot requires distinguishing "unknown flavor" from "known flavor with `null` slot". This addendum serves as the tracking note REVIEW asked for.

### IN-02: `getContextBudgetTokens` retains an unused `_model` parameter

**Files modified:** `web/src/chat/modelConfig.ts`
**Commit:** `fcb103a`
**Applied fix:** Added a JSDoc block on `getContextBudgetTokens` per REVIEW recommendation: "Returns a Cursor session's context budget (capability-driven; `null` when no budget is registered for the flavor). The `_model` parameter is reserved for `CURS-01` model presets (per-model context budgets) and is currently unused — the budget is derived solely from the flavor capability table." The signature is unchanged (caller-compatibility preserved for CURS-01); only the docstring is added. The previous module-level JSDoc above `CONTEXT_HEADROOM_TOKENS` (which talked about a server-provided per-session limit that never materialized) is left in place — it documents the headroom-budget rationale, which still applies.

**Impact analysis (workspace rule):** `gitnexus_impact({target: "getContextBudgetTokens", direction: "upstream"})` → **LOW risk**, 3 direct upstream callers in `web/src/components/AssistantChat/StatusBar.tsx` (`contextWarning`, `contextUsageLabel`, `compactContextUsageLabel`), 0 affected processes. A JSDoc-only change cannot alter the call graph or runtime behavior.

### Verification Performed (Iteration 2)

- **Source guard:** `bash scripts/check-no-cut-agents.sh` — green (5/5 checks pass) after the JSDoc edit. The new docstring does not introduce any forbidden literals or branch patterns.
- **Tier 1 (re-read):** Modified `modelConfig.ts` re-read; JSDoc present, function signature/body unchanged, surrounding code intact.
- **Tier 2 (syntax check):** Not run from the isolated worktree because the worktree has no `node_modules` (deps were not bootstrapped for this 2-finding docs-only follow-up); the pre-fix file parsed under the main-repo iteration-1 workflow, and the diff is a pure JSDoc-comment insertion that TypeScript treats as ignored trivia. Tier 1 is sufficient per `verification_strategy` Tier 3 fallback for comment-only edits.
- **Targeted test (`web && npx vitest run modelConfig`):** Not executed for the same reason (no deps installed in the worktree); a JSDoc change cannot affect test outcomes. Iteration 1 already ran the full web suite (532/532 pass) against the surrounding code; the runtime surface is unchanged.

---

_Iteration 2 fixed: 2026-05-22T15:51:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 2_
