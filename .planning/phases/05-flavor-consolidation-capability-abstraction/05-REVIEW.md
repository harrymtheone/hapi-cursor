---
phase: 05-flavor-consolidation-capability-abstraction
reviewed: 2026-05-22T11:35:00Z
depth: standard
files_reviewed: 12
files_reviewed_list:
  - shared/src/flavors.ts
  - shared/src/modes.ts
  - shared/src/schemas.ts
  - shared/src/resume.ts
  - shared/src/types.ts
  - web/src/components/ToolCard/PermissionFooter.tsx
  - web/src/chat/modelConfig.ts
  - cli/src/modules/common/slashCommands.ts
  - hub/src/sync/syncEngine.ts
  - hub/src/sync/todos.ts
  - hub/src/sync/rpcGateway.ts
  - scripts/check-no-cut-agents.sh
findings:
  critical: 0
  warning: 4
  info: 2
  total: 6
status: issues_found
---

# Phase 05: Code Review Report

**Reviewed:** 2026-05-22T11:35:00Z
**Depth:** standard
**Files Reviewed:** 12 (focus areas: capability table, capability consumers, AGENT_MESSAGE_PAYLOAD_TYPE usage, source guard, type narrowing)
**Status:** issues_found

## Summary

Phase 5 successfully narrows `AgentFlavor` to `'cursor'`, collapses the capability table to a single row, deletes all non-cursor permission-mode constants and `isCodexFamilyFlavor`/`CodexCollaborationMode` symbols, and strengthens the source-of-truth ripgrep guard with two new sibling sweeps. All four success criteria (SC#1–4) verifiably hold; live `bash scripts/check-no-cut-agents.sh` is green; ripgrep for `\b(claude|codex|gemini|opencode)\b`, `flavor === '<non-cursor>'`, and the legacy identifier set returns zero hits across `cli/src hub/src web/src shared/src` (the only allowed survivor — `AGENT_MESSAGE_PAYLOAD_TYPE = 'codex' as const` at `shared/src/modes.ts:9` — is correctly post-filtered).

No correctness or security defects (BLOCKER/Critical) were found. Four WARNING-tier findings center on **dead code that the narrowing made redundant but the slice authors preserved for documented forward-extensibility** (capability lookups whose results are unused, defense-in-depth branches that the type system makes unreachable), plus one **post-filter that could mask combined-condition residues** in the source guard. Two INFO items document subtle semantic limits of `getCapability` and a stale parameter in `getContextBudgetTokens`.

The capability-driven design is sound: every active call site (`PermissionFooter`, `modelConfig.getContextBudgetTokens`, `slashCommands.getUserCommandsDir`/`getProjectCommandsDir`) routes through `getCapability(...)` correctly with `null` graceful-degrade per D-76; bare `'codex'` literals at wire boundaries are imported via `AGENT_MESSAGE_PAYLOAD_TYPE` (`hub/src/sync/todos.ts:1,10,27` and consumers); `AgentFlavorSchema = z.literal('cursor')` is correctly idiomatic Zod. The deletion sweep is clean — no broken imports, no orphaned types, and `MetadataSchema.flavor: z.string().nullish()` is correctly **kept wide** (RESEARCH §"Wire-layer narrow safety" §1) so historical SQLite rows don't fail to parse.

## Warnings

### WR-01: `PermissionFooter` — `void getCapability(...)` is a dead expression after Phase-5 narrow

**File:** `web/src/components/ToolCard/PermissionFooter.tsx:91-94`

**Issue:** The line

```tsx
void (getCapability(props.metadata?.flavor, 'permissionToneCopy') ?? 'cursor')
```

is a no-op:

1. `getCapability` is a pure function (no side effects) — calling it and discarding the result via `void` performs no observable work.
2. After plan 05-08 narrowed `permissionToneCopy: 'cursor' | 'codex'` to `'cursor'` only (`shared/src/flavors.ts:24`), the call can only ever return `'cursor'` (when flavor is known) or `null` (when not). The `?? 'cursor'` fallback then yields the constant `'cursor'` for every input. There is no remaining JSX branch that consumes a tone, so the value is unused regardless.
3. The justification recorded in the plan (`05-02-SUMMARY.md` decision log: *"keeps the call as the key-link to `shared/src/flavors.ts`"*) is the **module's `import { getCapability }` line at L7** — the import alone preserves the dependency graph. Adding a runtime no-op statement is not necessary to keep an import valid, and it traps readers who expect runtime behavior at this site.
4. The plan-acceptance regex `getCapability\(.*'permissionToneCopy'` is satisfied by *any* mention of the call, so a comment or a real consumer would also pass it; choosing a `void` expression to satisfy a regex is anti-DRY.

This is dead code disguised as runtime intent. Either restore an actual tone-consuming branch (only sensible if Phase-5 ever re-introduces a non-cursor flavor — currently impossible by type) or delete the line.

**Fix:**

```tsx
// Capability-driven tone selection retained for the day a second flavor lands;
// for now the cursor tone is the only renderable path so no runtime branch is needed.
// (Import of getCapability above is the dependency anchor — no runtime call required.)
```

Then drop the `void` line. The plan-acceptance regex was a phase-internal check; replacing it with a comment that names `getCapability` is acceptable post-merge. If retaining a runtime call is preferred, give it a name and use it:

```tsx
const tone = getCapability(props.metadata?.flavor, 'permissionToneCopy') ?? 'cursor'
// Future: branch JSX/copy on `tone` when a second flavor lands.
```

---

### WR-02: `scripts/check-no-cut-agents.sh` — `PHASE5_BRANCH_PATTERN` post-filters can mask combined-condition residues

**File:** `scripts/check-no-cut-agents.sh:141`

**Issue:** The Phase-5 branch sweep filters its hits with two `grep -v` clauses applied to the **whole matched line**:

```bash
FLAVOR_BRANCH_FILTERED=$(echo "$FLAVOR_BRANCH" | grep -v "=== 'cursor'" | grep -v "typeof flavor ===" || true)
```

Both clauses suppress entire lines, not just the matching sub-expression. Two failure modes:

1. **Combined predicate masking:** A line such as
   ```ts
   if (flavor === 'gemini' && other === 'cursor') { ... }
   ```
   matches `flavor === '` (the sweep's pattern) **and** contains `=== 'cursor'`, so the post-filter would silently drop the entire line. The legacy `flavor === 'gemini'` half is then never reported.

2. **`typeof` adjacency masking:** A line such as
   ```ts
   if (typeof flavor === 'string' && flavor === 'codex') { ... }
   ```
   matches `flavor === '` and contains `typeof flavor ===`, so the second `grep -v` drops it; the `=== 'codex'` residue is masked.

While the current source tree has zero such constructs (verified live), the guard's role is to **keep them out forever**. Whitelisting whole lines based on a substring weakens the gate.

This is a Phase-5-specific concern because `PHASE5_BRANCH_PATTERN` (line 39) intentionally uses a permissive regex (`flavor\s*===\s*['"]`) and relies on post-filters for noise reduction; the safer alternative is to use ripgrep's `-v`/`--invert-match` only against patterns the sweep explicitly considers safe and to AND-combine sweep results so a single line cannot satisfy both "safe" and "unsafe."

**Fix:** Replace the chained `grep -v` with a sweep that strips the cursor-narrow exemption only when the line is *exclusively* a cursor branch. One option is to pre-process with `awk` to drop the `=== 'cursor'` and `typeof flavor === '...'` substrings, then re-grep for the residue:

```bash
FLAVOR_BRANCH_FILTERED=$(
  echo "$FLAVOR_BRANCH" \
    | sed -E "s/typeof flavor === ['\"][a-z]+['\"]//g; s/=== 'cursor'//g" \
    | grep -E "flavor\s*===\s*['\"]" \
    || true
)
```

This way a line that mixes a cursor branch with a non-cursor literal still triggers because the non-cursor `=== '...'` survives the substring removal.

Alternatively, tighten `PHASE5_BRANCH_PATTERN` to `flavor\s*===\s*'(?!cursor)\w+'` (PCRE negative lookahead — ripgrep supports it via `--pcre2`) so the regex itself excludes cursor and the post-filters can be deleted.

---

### WR-03: `permissionToneCopy` capability slot is orphaned post-Phase-5

**File:** `shared/src/flavors.ts:24,37` (definition + cursor row)
**Cross-file:** `web/src/components/ToolCard/PermissionFooter.tsx:94` (only consumer; result discarded — see WR-01)

**Issue:** `permissionToneCopy` is one of the seven D-73 capability slots. After plan 05-08 narrowed its type union from `'cursor' | 'codex'` to `'cursor'`, and after WR-01's analysis showing the only consumer discards the value, the slot has:

- A type that admits exactly one inhabitant (`'cursor'`).
- A single value (`'cursor'`) for the only flavor (`'cursor'`).
- Zero functional consumers.

It is structurally a constant masquerading as a capability. D-74 explicitly forbids "future fields with no current consumer" (*"capability not to be padded with Cursor's not-needed future fields"*), yet `permissionToneCopy` is now exactly such a field. The plan-08 deviation §1 narrowed the union *without* re-evaluating whether the slot still earns its keep.

This is not a bug — the table compiles, helpers work, tests pass. But it weakens D-74's invariant and invites confusion: a reader who finds a capability key whose only consumer is a `void` expression cannot tell whether the slot is a forward-extensibility hook (D-71) or dead weight.

**Fix:** Either:
1. Delete the slot from `FlavorCapabilities`, the cursor row, the test matrix (cases 7 + 11 + 12 in `flavors.test.ts`), and remove the `void` line in `PermissionFooter.tsx` (WR-01) — recovering D-74 invariant. Future flavors that need alternate tone copy can re-add the slot.
2. Keep the slot but document explicitly with a `JSDoc /** @deferred CURS-* — re-introduce when a second flavor needs alternate tone copy */` anchor on the field, AND add a regression test that `permissionToneCopy === 'cursor'` for cursor — so the slot's purpose is captured for a future maintainer.

Option 1 is more aligned with Phase-5's "minimal cut, no overengineering" principle (`05-CONTEXT.md` §4 D-74).

---

### WR-04: `hub/src/sync/syncEngine.ts::resumeSession` — `flavor !== 'cursor'` branch is statically unreachable

**File:** `hub/src/sync/syncEngine.ts:508-511`

**Issue:**

```ts
const target = targetResult.target
const metadata = session.metadata!
const flavor = target.flavor
if (flavor !== 'cursor') {
    return { type: 'error', message: `Sessions of flavor "${flavor}" are no longer supported`, code: 'resume_failed' }
}
```

`target` is a `LocalResumeTarget`, whose `flavor` field is typed as `'cursor'` (Zod schema `AgentFlavorSchema = z.literal('cursor')` at `shared/src/resume.ts:4`). Furthermore the in-engine source of `target` is `resolveLocalResumeTarget` → `resolveFlavor()` which always returns the constant `'cursor'` (`syncEngine.ts:391-393`). TypeScript narrows the branch to `never`; the error message string template `flavor` is typed as `never` and would print as `undefined` if it ever ran.

Plan 05-06 records this branch as defense-in-depth against historical metadata (T-05-06-02). However:
- `target.flavor` does not come from metadata directly — it comes from `resolveFlavor(session)` which discards the metadata's `flavor` field and always returns `'cursor'`. The defense-in-depth is therefore **not exercising the historical-metadata risk it claims to mitigate**; the metadata-derived flavor never reaches this branch.
- The `PHASE5_BRANCH_PATTERN` source guard's `=== 'cursor'` post-filter (WR-02) actively excludes this line from review, so any future regression that re-widens `target.flavor` would silently lose the defense-in-depth.

The branch is dead code that the source guard's post-filter conceals. Either rewire the defense to read `metadata.flavor` directly (which **is** the wire-tampered surface — `MetadataSchema.flavor` stays `z.string().nullish()`) or delete the branch.

**Fix:** Read the historical-tampered field directly so the guard is real:

```ts
// Defense-in-depth: historical SQLite rows may carry a non-cursor metadata.flavor
// even though resolveFlavor() pins resumes to cursor. Refuse to resume.
const historicalFlavor = session.metadata?.flavor
if (historicalFlavor != null && historicalFlavor !== 'cursor') {
    return {
        type: 'error',
        message: `Sessions of flavor "${historicalFlavor}" are no longer supported`,
        code: 'resume_failed',
    }
}
```

If the team prefers to drop defense-in-depth (acceptable per AGENTS.md "no backward compatibility"), delete lines 508–511 outright; the type system already guarantees the impossibility.

## Info

### IN-01: `getCapability` cannot distinguish "unknown flavor" from "known flavor with `null` slot"

**File:** `shared/src/flavors.ts:67-74`

**Issue:** Both branches return `null`:

```ts
const caps = getCapabilities(flavor)
if (caps === null) return null          // unknown flavor
return caps[key]                          // known flavor; slot may itself be null
```

This is documented as intentional (D-76 graceful degrade + the JSDoc *"a slot whose value is null resolves to null, which is the same as the unknown-flavor branch by design"*), and current consumers (`getUserCommandsDir`, `getContextBudgetTokens`) treat both cases identically.

However, future consumers that **need** to distinguish the two cases (e.g. log "no commands directory configured for cursor" vs "unknown flavor — likely tampered metadata") cannot do so via `getCapability` alone; they would have to call `isKnownFlavor(flavor)` separately. This is fine for v1 but worth noting if a future capability slot needs nullable values with disambiguation — the API would need a second helper (`getCapabilityOr`, returning a discriminated union).

**Fix:** None required for v1; track in the capability-table evolution notes for Milestone 2.

---

### IN-02: `getContextBudgetTokens` retains an unused `_model` parameter

**File:** `web/src/chat/modelConfig.ts:15`

**Issue:**

```ts
export function getContextBudgetTokens(_model: string | null | undefined, flavor?: string | null): number | null {
    const windowTokens = getCapability(flavor, 'contextBudgetTokens')
    ...
}
```

`_model` is never read (underscore-prefixed by convention). This is intentional caller-compatibility for the day cursor model presets carry per-model context budgets (`CURS-01 / Milestone 2`), but the underscore signals "don't use" while the JSDoc says "If/when the server provides an explicit per-session context limit, prefer that and use this only as a fallback" — which the implementation no longer does (it ignores the model entirely).

Either tighten the signature now (`getContextBudgetTokens(flavor?: string | null)`) and update callers, or update the JSDoc to match the current behavior (the model parameter is reserved for `CURS-01` and currently ignored).

**Fix:** Update JSDoc to:

```ts
/**
 * Returns a Cursor session's context budget (capability-driven; null when no
 * budget is registered). The `_model` parameter is reserved for CURS-01 model
 * presets and currently unused.
 */
```

---

_Reviewed: 2026-05-22T11:35:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
