---
phase: 06-agent-runtime-shared-kit-mode-hardening
reviewed: 2026-05-22T17:31:00Z
depth: standard
files_reviewed: 18
files_reviewed_list:
  - cli/src/cursor/modes.ts
  - cli/src/cursor/loop.ts
  - cli/src/cursor/session.ts
  - cli/src/cursor/runCursor.ts
  - cli/src/cursor/cursorLocalLauncher.ts
  - cli/src/cursor/cursorRemoteLauncher.ts
  - cli/src/cursor/runCursor.test.ts
  - cli/src/cursor/cursorLocalLauncher.test.ts
  - cli/src/cursor/cursorRemoteLauncher.test.ts
  - cli/src/agent/modeConfig.ts
  - cli/src/agent/modeConfig.test.ts
  - cli/src/agent/sessionBase.ts
  - cli/src/agent/localLaunchPolicy.ts
  - cli/src/modules/common/launcher/BaseLocalLauncher.ts
  - cli/src/modules/common/remote/RemoteLauncherBase.ts
  - shared/src/modes.ts
  - scripts/check-no-cut-agents.sh
  - package.json
findings:
  critical: 0
  warning: 5
  info: 2
  total: 7
status: issues_found
---

# Phase 06: Code Review Report

**Reviewed:** 2026-05-22T17:31:00Z
**Depth:** standard
**Files Reviewed:** 18
**Status:** issues_found

## Summary

Phase 06 lands a small, surgical refactor: a new `cursor/modes.ts` leaf to
break the `session ↔ loop ↔ launcher` cycle, a single shared
`permissionModeToCursorArgs` in `cli/src/agent/modeConfig.ts` replacing two
duplicate helpers, a typed `UnknownPermissionModeError` in `shared/src/modes`,
and a hardened `resolvePermissionMode` at the RPC boundary in `runCursor.ts`.
JSDoc concept anchors and new ripgrep + madge guards lock the architecture in
`scripts/check-no-cut-agents.sh`.

**Net assessment:** No correctness or security regressions in the runtime
modules. The mode-resolution typing is tighter than before (PermissionMode
flows end-to-end, the `as string` casts are gone). The findings below are all
in the **guard script** (`check-no-cut-agents.sh`) — which is now load-bearing
infrastructure for D-94/D-108 — plus one edge-case typing gap in
`resolvePermissionMode`. No blockers.

## Structural Findings (fallow)

_No `<structural_findings>` block was provided by the orchestrator for this
phase; section intentionally empty._

## Narrative Findings (AI reviewer)

## Warnings

### WR-01: `check-no-cut-agents.sh` searches non-existent `web/src` directory

**File:** `scripts/check-no-cut-agents.sh:163`
**Issue:** `PHASE6_SOURCE_DIRS=(cli/src shared/src hub/src web/src)` lists
`web/src`, but that directory does not exist in this repo (verified — only
`cli/src`, `shared/src`, `hub/src` are present). All four new ripgrep sweeps
(#1, #2 indirectly via launcher list, #3, and the anchor-count #5) pass that
array to `"$RG_BIN" -n ...`. With ripgrep ≥13, a missing path produces an
error and a non-zero exit; because the script runs under `set -euo pipefail`
but inside `if` conditions, the failure is silently swallowed — guards #1 and
#3 degrade to "no match" semantics and may also miss real residue in other
roots. Worst case, a future engineer adding `web/src/` discovers the guards
were never actually scanning it.
**Fix:**

```bash
PHASE6_SOURCE_DIRS=()
for d in cli/src shared/src hub/src web/src; do
  [ -d "$d" ] && PHASE6_SOURCE_DIRS+=("$d")
done
```

Then guard against an empty array before each `"$RG_BIN" -n ... "${PHASE6_SOURCE_DIRS[@]}"` call.

### WR-02: Definition guard regex misses `export const` / arrow-function form

**File:** `scripts/check-no-cut-agents.sh:188-189`
**Issue:** Guard #3 enforces "canonical definition lives only in
`cli/src/agent/modeConfig.ts`" via:

```bash
"$RG_BIN" -n '^export function permissionModeToCursorArgs|^function permissionModeToCursorArgs' ...
```

This only matches function declarations. A future regression that adds
`export const permissionModeToCursorArgs = (mode) => …` or a class method
`permissionModeToCursorArgs(...)` in another module would slip past the
guard and reintroduce the duplication D-108 was designed to prevent.
**Fix:** Broaden the pattern to match either declaration style:

```bash
"$RG_BIN" -n \
  -e '^(export\s+)?function\s+permissionModeToCursorArgs\b' \
  -e '^(export\s+)?const\s+permissionModeToCursorArgs\b' \
  "${PHASE6_SOURCE_DIRS[@]}"
```

### WR-03: Anchor count check does not verify each of the four concepts is present

**File:** `scripts/check-no-cut-agents.sh:208-214`
**Issue:** Guard #5 sums total occurrences of
`@implements (SessionContext|LocalAdapter|RemoteAdapter|LaunchPolicy) (Phase 6 SC#1)`
and requires `≥ 4`. If a future refactor accidentally duplicates two
`SessionContext` anchors and removes `LaunchPolicy`, count still totals 4 and
the guard passes — defeating D-90's "one anchor per concept" intent.
**Fix:** Check each concept individually:

```bash
for concept in SessionContext LocalAdapter RemoteAdapter LaunchPolicy; do
  if ! "$RG_BIN" -q "@implements ${concept} \(Phase 6 SC#1\)" cli/src; then
    echo "❌ Phase-6 SC#1 anchor missing for ${concept}."
    exit 1
  fi
done
```

### WR-04: `madge` guard conflates "tool missing" with "circular dependency"

**File:** `scripts/check-no-cut-agents.sh:198-205`
**Issue:**

```bash
if ! npx --no-install madge --circular --extensions ts,tsx cli/src/cursor > /dev/null 2>&1; then
  echo "❌ Phase-6 madge circular dependency found in cli/src/cursor."
  ...
fi
```

`npx --no-install` exits non-zero **both** when madge isn't installed and when
a real cycle is detected; stderr is silenced. A developer running the script
on a fresh checkout without `npm install` will see the misleading "circular
dependency found" message and chase a non-existent cycle. The script also
implicitly depends on running from the repo root (where `package.json` lives);
the rest of the script does not enforce that.
**Fix:** Probe for the binary first and emit a distinct message:

```bash
if ! npx --no-install madge --version > /dev/null 2>&1; then
  echo "❌ madge not installed — run \`bun install\` (or \`npm install\`) at repo root."
  exit 1
fi
if ! npx --no-install madge --circular --extensions ts,tsx cli/src/cursor > /dev/null; then
  echo "❌ Phase-6 madge circular dependency in cli/src/cursor."
  exit 1
fi
```

(Note: dropping `2>&1` on the actual check lets the user see madge's cycle
report, which is the whole point of running the guard.)

### WR-05: `resolvePermissionMode` produces non-string `offendingMode` for `undefined`/function/symbol payloads

**File:** `cli/src/cursor/runCursor.ts:16-22`
**Issue:**

```ts
throw new UnknownPermissionModeError(typeof value === 'string' ? value : JSON.stringify(value));
```

`JSON.stringify(undefined)`, `JSON.stringify(() => {})`, and
`JSON.stringify(Symbol())` all return `undefined` (the JS value, not a
string) or throw (Symbol). The `UnknownPermissionModeError` constructor
typed-declares `readonly offendingMode: string`, but at runtime the field
will be assigned `undefined` for those inputs, violating the type contract.
The error message becomes `"Unknown permission mode: undefined"`, which is
indistinguishable from a literal `"undefined"` payload — and downstream
consumers reading `err.offendingMode` as a string get `undefined` instead.
The new RPC-boundary test (`runCursor.test.ts`) only covers string and
plain-object payloads, so this slip is not caught.
**Fix:** Coerce defensively:

```ts
const offending =
    typeof value === 'string' ? value
    : value === undefined ? 'undefined'
    : (() => { try { return JSON.stringify(value) ?? String(value); } catch { return String(value); } })();
throw new UnknownPermissionModeError(offending);
```

and add a regression test for `resolvePermissionMode(undefined)` and a
non-serializable value.

## Info

### IN-01: `cursorLocalLauncher.test.ts` does not exercise the launcher

**File:** `cli/src/cursor/cursorLocalLauncher.test.ts:1-26`
**Issue:** The file name implies coverage of `cursorLocalLauncher`, but the
test imports `cursorLocal` and never instantiates `BaseLocalLauncher` or
invokes `cursorLocalLauncher`. The session→`getPermissionMode`→
`permissionModeToCursorArgs` wiring inside the launcher is therefore not
asserted end-to-end; only the underlying `cursorLocal` arg-mapping is. This
is fine as a regression for D-94's mid-session switch, but the file name
oversells the coverage and a future reader may skip writing the launcher-level
test thinking it exists.
**Fix:** Either rename to `cursorLocal.test.ts`, or add a launcher-level case
that builds a fake `CursorSession` with `getPermissionMode()` and asserts
`permissionModeToCursorArgs` is called with the session's mode.

### IN-02: `permissionModeToCursorArgs` chain has no compile-time exhaustiveness check

**File:** `cli/src/agent/modeConfig.ts:9-17`
**Issue:** The body uses sequential `if` checks ending in
`throw new UnknownPermissionModeError(mode)`. If a fifth member is added to
`CursorPermissionMode` in `shared/src/modes.ts`, TypeScript will silently
let it fall through to the throw branch — the regression is only caught at
runtime. A `switch` with a `never`-typed default would surface the gap at
compile time and is a strictly better fit for "one branch per enum member".
**Fix:**

```ts
switch (mode) {
    case undefined:
    case 'default': return {};
    case 'plan':    return { mode: 'plan' };
    case 'ask':     return { mode: 'ask' };
    case 'yolo':    return { yolo: true };
    default: {
        const _exhaustive: never = mode;
        throw new UnknownPermissionModeError(_exhaustive as string);
    }
}
```

---

_Reviewed: 2026-05-22T17:31:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
