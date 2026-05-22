# Phase 6: Agent runtime shared kit + mode hardening — Research

**Researched:** 2026-05-22
**Domain:** cli-runtime / TypeScript / refactor — break circular deps, consolidate permission-mode args mapping, typed-error hardening
**Confidence:** HIGH (every claim grounded in file reads + executed madge run; no external library research needed — the phase is purely internal TS topology)

## Summary

Phase 6 is a pure cli-runtime refactor: extract permission-mode → CLI args mapping into a single source (`cli/src/agent/modeConfig.ts`), lift mode types out of `cli/src/cursor/loop.ts` into a leaf module (`cli/src/cursor/modes.ts`) to break the `loop ↔ session ↔ launcher` cycle, and elevate the existing generic `Error('Invalid permission mode')` to a typed `UnknownPermissionModeError` defined in `shared/src/modes.ts`. No external libraries are introduced; no schema/wire changes.

`CONTEXT.md` already supplies the decision skeleton (D-89 — D-110). This research grounds each decision in the actual codebase: confirmed line numbers, exact identifier names, the verified madge output, and the resolved minimum-churn answer for the `getPermissionMode()` narrowing ambiguity (the answer is "neither option — the alias chain already unifies the types").

**Primary recommendation:** Execute the 4-slice plan in D-107 as written. The only non-trivial design point is D-100 (sessionBase generic vs CursorSession override). Investigation shows **neither is necessary** — `SessionPermissionMode` is already a type alias for `PermissionMode` via `cli/src/api/types.ts:25` (`export type SessionPermissionMode = PermissionMode` from `@hapi/protocol/types`). Removing the `as string` casts in the two launcher files compiles as-is once `modeConfig.permissionModeToCursorArgs` accepts `PermissionMode | undefined`.

## User Constraints (from CONTEXT.md)

### Locked Decisions

Verbatim D-89 — D-110 from `06-CONTEXT.md`. Highlights:

- **D-89 / D-90 / D-93:** Do NOT rename `AgentSessionBase` / `BaseLocalLauncher` / `RemoteLauncherBase` / `localLaunchPolicy.ts`. Anchor SC#1 via JSDoc `@implements SessionContext|LocalAdapter|RemoteAdapter|LaunchPolicy (Phase 6)` tags.
- **D-91:** New file `cli/src/agent/modeConfig.ts` — NOT in `shared/`. Exports `CursorArgsFragment` type + `permissionModeToCursorArgs(mode: PermissionMode | undefined)` function; throws `UnknownPermissionModeError` for unknown non-undefined strings.
- **D-92:** Do NOT merge `buildAgentArgs` (remote) with `cursorLocal.ts` inline args (local). Only the permission-mode fragment is shared.
- **D-94 / D-95 / D-96 / D-97:** New file `cli/src/cursor/modes.ts` — must NOT import `loop / session / cursorLocalLauncher / cursorRemoteLauncher / cursorLocal`. Re-exports `PermissionMode` from `@hapi/protocol/types`; declares local `EnhancedMode = { permissionMode: PermissionMode; model?: string }`. Stays cli-domain (not promoted to `shared/`).
- **D-98:** `UnknownPermissionModeError extends Error` lives in `shared/src/modes.ts` (cross-tier reusable). Carries `offendingMode: string`. Message: `` `Unknown permission mode: ${offendingMode}` ``.
- **D-99 / D-100 / D-101 / D-102:** Throw point = `permissionModeToCursorArgs`. `undefined` is NOT unknown (returns `{}`). `runCursor.ts::resolvePermissionMode` upgrades its existing `throw new Error('Invalid permission mode')` to `throw new UnknownPermissionModeError(rawValue)`. The thrown error must NOT be silently caught — propagates to `lifecycle.markCrash`.
- **D-103 / D-104 / D-105:** 3 new tests — (1) mid-session yolo switch (remote), (2) mid-session plan↔default switch (local minimum; remote optional), (3) unknown-mode unit test + `resolvePermissionMode` integration test. Use mock spawn / args inspection — no real `agent` process.
- **D-107:** 4-slice execution. Each slice green on `bun typecheck` + `bun run test`.
- **D-108 / D-109 / D-110:** ripgrep zero-tolerance keywords + `madge --circular cli/src/cursor` exit code 0 = executable guard. Whitelist follows Phase 4–5 style. Do NOT run `build:single-exe`.

### Claude's Discretion

- ModeConfig export name & `CursorArgsFragment` shape (discriminated union vs optional shape) — researcher recommendation below in §Code Examples.
- D-90 JSDoc tag form — researcher recommendation below.
- D-104 plan-switch test on local only vs both — researcher recommendation below.
- Whether to rename `localLaunchPolicy.ts` → `launchPolicy.ts` — researcher recommends NOT renaming (consistent with D-89; defer to Phase 12).

### Deferred Ideas (OUT OF SCOPE)

- Physical rename of base files to SC#1 concept names.
- REFA-03 / REFA-04 wire contracts unification → Phase 7.
- `EnhancedMode` promotion to `shared/` → Phase 7.
- REFT-01 cross-flavor permission contract matrix → Phase 11.
- REFH-01 / REFH-02 hub split → Phase 8.
- CURS-01 model switching (`EnhancedMode.model` union) → Milestone 2.
- `localLaunchPolicy.ts` → `launchPolicy.ts` rename → Phase 12.
- `AGENT_MESSAGE_PAYLOAD_TYPE = 'codex'` rename → Phase 7.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| REFA-02 | agent runtime shared-kit landing — extract `SessionContext / LocalAdapter / RemoteAdapter / ModeConfig / LaunchPolicy`; eliminate duplicate permission-mode mapping between `cursorLocalLauncher` and `cursorRemoteLauncher` | §Standard Stack (Existing units already in place); §Code Examples (`permissionModeToCursorArgs` consolidation); D-89 — D-92 |
| REFA-05 | mid-session mode switch hardening — unknown mode throws; bypass+remote / bypass+plan switch coverage; mode types extracted from `loop ↔ session ↔ launcher` cycle | §Architecture Patterns (modes.ts as leaf); §Pitfalls (silent fallback); §Validation Architecture (3 new tests + madge guard); D-94 — D-106 |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Permission mode → CLI args fragment | cli-runtime (`cli/src/agent/modeConfig.ts`) | — | Produces `child_process.spawn` argv; never touches wire layer |
| Mode type definitions (`PermissionMode`, `EnhancedMode`) | cli-runtime (`cli/src/cursor/modes.ts`) | shared (re-export source: `@hapi/protocol/types`) | `PermissionMode` originates in `shared/`; `EnhancedMode` is cli-only (runtime arg-shape, model fragment) |
| `UnknownPermissionModeError` class | shared (`shared/src/modes.ts`) | cli + hub + web (consumers) | Future Phase 7 hub-side SSE patch validation will throw the same class — placing in shared avoids re-defining downstream |
| Local launcher orchestration | cli-runtime (`cli/src/cursor/cursorLocalLauncher.ts` + `BaseLocalLauncher`) | — | Spawns long-lived interactive `agent` process via `spawnWithTerminalGuard` |
| Remote launcher orchestration | cli-runtime (`cli/src/cursor/cursorRemoteLauncher.ts` + `RemoteLauncherBase`) | — | Single-turn `-p` streaming-JSON spawn via raw `node:child_process` |
| RPC mode-resolution (UI/RPC boundary) | cli-runtime (`cli/src/cursor/runCursor.ts::resolvePermissionMode`) | — | Already on the typed-throw path; only error class upgrades |

## Standard Stack

No new external libraries. Everything is internal TS + existing tooling.

### Existing (already in place, this phase only touches them surgically)

| Module | Path | Role |
|--------|------|------|
| `AgentSessionBase` | `cli/src/agent/sessionBase.ts` | `SessionContext` (D-90) |
| `BaseLocalLauncher` | `cli/src/modules/common/launcher/BaseLocalLauncher.ts` | `LocalAdapter` (D-90) |
| `RemoteLauncherBase` | `cli/src/modules/common/remote/RemoteLauncherBase.ts` | `RemoteAdapter` (D-90) |
| `localLaunchPolicy.ts` | `cli/src/agent/localLaunchPolicy.ts` | `LaunchPolicy` (D-90) |
| `loopBase.ts` | `cli/src/agent/loopBase.ts` | orchestration; not touched in this phase |
| `shared/src/modes.ts` | `shared/src/modes.ts` | `PermissionMode = CursorPermissionMode`, `CURSOR_PERMISSION_MODES = ['default','plan','ask','yolo']` |

### New files (this phase)

| File | Purpose |
|------|---------|
| `cli/src/cursor/modes.ts` | Re-export `PermissionMode` from `@hapi/protocol/types`; declare local `EnhancedMode` |
| `cli/src/agent/modeConfig.ts` | `CursorArgsFragment` type + `permissionModeToCursorArgs` function (the sole `ModeConfig`) |
| `cli/src/agent/modeConfig.test.ts` | Unit tests for unknown / undefined / valid mode dispatch |
| `cli/src/cursor/cursorLocalLauncher.test.ts` | Mid-session plan ↔ default switch (mock `spawnWithAbort`) |
| `cli/src/cursor/cursorRemoteLauncher.test.ts` | Mid-session yolo switch (mock `node:child_process.spawn`) |

### Tooling (already installed / available via `npx`)

| Tool | Version | Use | Notes |
|------|---------|-----|-------|
| madge | invoked via `npx madge` (no project dep) | `npx madge --circular --extensions ts,tsx cli/src/cursor` | **VERIFIED 2026-05-22:** ran successfully; exit code 1 (3 cycles found) without `--extensions` flag would silently return 0 — see Pitfall §"madge default ext blindness" |
| ripgrep | `rg 14.x` system or vendored `@vscode/ripgrep` | Source-guard via `scripts/check-no-cut-agents.sh` | Pattern: existing script discovers `rg` from PATH or vscode bundled path |
| vitest | per `cli/vitest.config.ts` | All `*.test.ts` under `cli/src/` | `globals: false`, alias `@ → ./src`, env `node` |

**No package.json changes required.** `madge` is invoked via `npx` ad-hoc; if we add it as a guard script (D-108 #4), recommend `npx --no-install madge` to fail loudly if not cached, or add `madge` to root `devDependencies`.

**Version verification — not applicable.** Phase introduces no new package recommendations; the existing toolchain (`bun`, `vitest`, `madge`, `ripgrep`) is unchanged. Slopcheck not run — no install commands.

## Package Legitimacy Audit

Phase introduces **zero new package installs**. All recommended modules are internal source files or already-resolved dependencies. Audit table intentionally empty.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| _(none)_ | — | — | — | — | — | — |

**Packages removed:** none. **Packages flagged:** none.

If a planner later decides to add `madge` as a project devDependency for the guard script (optional — `npx --no-install` works too), the package is well-established (>10 yrs, millions of weekly downloads, repo `https://github.com/pahen/madge`); flag `[ASSUMED]` until verified at install time via `npm view madge`.

## Architecture Patterns

### Current import topology (verified by reading source 2026-05-22)

```
runCursor.ts ──┬──> loop.ts ──┬──> session.ts ───────────────┐
               │              ├──> cursorLocalLauncher.ts ──┐│
               │              └──> cursorRemoteLauncher.ts ─││
               │                       │           │        ││
               │                       └───────────┴────────┘│
               │                       ▼ session.ts          │
               └────────────────────► (type EnhancedMode,   │
                                       PermissionMode)<─────┘
```

Concretely (file:line):

- `cli/src/cursor/loop.ts:8` — `import type { CursorPermissionMode } from '@hapi/protocol/types';`
- `cli/src/cursor/loop.ts:10` — `export type PermissionMode = CursorPermissionMode;`
- `cli/src/cursor/loop.ts:12-15` — `export interface EnhancedMode { permissionMode: PermissionMode; model?: string }`
- `cli/src/cursor/loop.ts:4-6` — runtime imports of `CursorSession`, `cursorLocalLauncher`, `cursorRemoteLauncher`
- `cli/src/cursor/session.ts:4` — `import type { EnhancedMode, PermissionMode } from './loop';`  ← **the cycle-creating reverse edge**
- `cli/src/cursor/cursorLocalLauncher.ts:3` — `import { CursorSession } from './session';`
- `cli/src/cursor/cursorRemoteLauncher.ts:13` — `import type { CursorSession } from './session';`
- `cli/src/cursor/runCursor.ts:2` — `import { loop, type EnhancedMode, type PermissionMode } from './loop';`

### Madge verification (executed 2026-05-22)

```bash
$ npx madge --circular --extensions ts,tsx cli/src/cursor
- Finding files
Processed 20 files (228ms) (23 warnings)

✖ Found 3 circular dependencies!

1) cursorLocalLauncher.ts > session.ts > loop.ts
2) session.ts > loop.ts > cursorRemoteLauncher.ts
3) session.ts > loop.ts
```

Exit code: `1`. Matches CONTEXT §`<specifics>` exactly. All three paths flow through the same root cause: `loop.ts` is both the type-source AND the launcher entry-point.

### Target topology (post-Phase 6, slice 1)

```
modes.ts (LEAF — no imports of loop/session/launcher/cursorLocal)
   │
   ▼
session.ts ──┐
   ▲         │
   │         ▼
loop.ts ─────┴─> launchers (runtime edge; no reverse type edge)
   │
   ▼
runCursor.ts
```

`modes.ts` re-exports `PermissionMode` from `@hapi/protocol/types` and declares `EnhancedMode` locally. `session.ts` and `runCursor.ts` import types from `modes.ts`, not `loop.ts`. The three cycles vanish because the reverse type-edge `session.ts → loop.ts` is replaced by `session.ts → modes.ts` (a leaf).

### D-100 resolution — narrowing `getPermissionMode()` (researcher decision)

`CONTEXT.md <specifics>` lists two options:
- (a) `AgentSessionBase<Mode extends SessionPermissionMode = SessionPermissionMode>` generic for permission-mode narrowing
- (b) `CursorSession` overrides `getPermissionMode()` return type

**Researcher recommendation: option (c) — do neither.** Investigation shows the types already align:

```
cli/src/api/types.ts:13  import type { PermissionMode } from '@hapi/protocol/types'
cli/src/api/types.ts:25  export type SessionPermissionMode = PermissionMode
shared/src/modes.ts:12   export type CursorPermissionMode = typeof CURSOR_PERMISSION_MODES[number]
shared/src/modes.ts:15   export type PermissionMode = CursorPermissionMode
```

Therefore: `AgentSessionBase.getPermissionMode()` already returns `PermissionMode | undefined` (transitively via the `SessionPermissionMode` alias). After we declare `cli/src/cursor/modes.ts::PermissionMode` as the same re-export of `CursorPermissionMode`, calling `permissionModeToCursorArgs(session.getPermissionMode())` will compile without any cast and without generic/override changes — the alias chain unifies. **Zero churn in `sessionBase.ts` beyond the D-90 JSDoc tag.**

This is the minimum-churn path. Reserve (a) and (b) for a future phase that genuinely needs per-flavor mode narrowing (none does today: Cursor is the only flavor — confirmed `shared/src/modes.ts:17 export type AgentFlavor = 'cursor'`).

### Recommended file additions

```
cli/src/
├── agent/
│   ├── sessionBase.ts          (+ JSDoc @implements SessionContext)
│   ├── localLaunchPolicy.ts    (+ JSDoc @implements LaunchPolicy)
│   ├── loopBase.ts             (unchanged)
│   ├── modeConfig.ts           (NEW — ModeConfig)
│   └── modeConfig.test.ts      (NEW — unit tests)
├── cursor/
│   ├── modes.ts                (NEW — leaf module)
│   ├── loop.ts                 (delete PermissionMode/EnhancedMode defs; import from ./modes)
│   ├── session.ts              (import types from ./modes instead of ./loop)
│   ├── runCursor.ts            (import PermissionMode from ./modes)
│   ├── cursorLocalLauncher.ts  (delete permissionModeToCursorArgs; remove `as string`; call modeConfig)
│   ├── cursorRemoteLauncher.ts (delete permissionModeToAgentArgs; remove `as string`; call modeConfig)
│   ├── cursorLocalLauncher.test.ts  (NEW — mid-session plan switch)
│   └── cursorRemoteLauncher.test.ts (NEW — mid-session yolo switch)
└── modules/common/
    ├── launcher/BaseLocalLauncher.ts  (+ JSDoc @implements LocalAdapter)
    └── remote/RemoteLauncherBase.ts   (+ JSDoc @implements RemoteAdapter)
```

### Anti-Patterns to Avoid

- **`permissionMode as string` casts** — currently used in `cursorLocalLauncher.ts:24` and `cursorRemoteLauncher.ts:97-98` to launder the type into the local helpers. Removing both helpers and unifying via `modeConfig` eliminates the cast.
- **Silent fallback for unknown mode** — current `permissionModeToCursorArgs` returns `{}` for unknown strings. New `modeConfig.permissionModeToCursorArgs` must throw `UnknownPermissionModeError` for non-undefined unknown strings (D-99/D-101).
- **`EnhancedMode` promotion to `shared/`** — deferred to Phase 7. Keep cli-domain (D-97).
- **Renaming base files to SC#1 concept names** — D-89 explicitly forbids. Use JSDoc tags instead.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Permission-mode → args mapping (two places) | A second local helper in either launcher | `cli/src/agent/modeConfig.permissionModeToCursorArgs` | 100% duplication of 6-line mapping (D-91); single source = SC#5 ripgrep guard's pass criterion |
| Detecting unknown mode at RPC boundary | A second hand-thrown `Error('Invalid mode')` | `throw new UnknownPermissionModeError(rawValue)` from `shared/src/modes.ts` | Single class lets hub/web/cli all `instanceof` test (Phase 7 will need this) |
| Cycle-breaking via re-export tricks | Inline `import type` swaps that still touch `loop.ts` | Add a true leaf module `cli/src/cursor/modes.ts` | madge follows file edges, not type-only semantics — only a real new file breaks the topology |

**Key insight:** every duplicate site here exists because `loop.ts` overloaded two roles (type-source + runtime composition root). The fix is structural, not stylistic — one new file collapses three cycles.

## Runtime State Inventory

> Not a rename/refactor of stored data — this is a TS topology + error-class refactor. No external runtime state is keyed off the affected symbols. Section included for completeness with explicit "none" answers.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — no database / cache / file persists `permissionModeToCursorArgs` / `permissionModeToAgentArgs` / `EnhancedMode` identifiers (these are TS-only). `PermissionMode` value strings (`'default'/'plan'/'ask'/'yolo'`) ARE stored in session metadata, but their literal values are NOT changing in this phase. | None |
| Live service config | None — no n8n / Datadog / external service references these symbols. | None |
| OS-registered state | None — Cursor agent CLI flags (`--mode`, `--yolo`) are unchanged; no task-scheduler / launchd / pm2 entries reference the helpers. | None |
| Secrets / env vars | None — no env-var name change. | None |
| Build artifacts | None — `bun run build:cli` and the single-exe pipeline are NOT run in this phase (D-110). Existing `dist/` output, if any, becomes stale and will be regenerated on next build. | None this phase; reinstall covered by Phase 12 milestone verification |

**The canonical question** (after every file in the repo is updated, what runtime systems still have the old strings cached / stored / registered?): **Nothing.** This phase is purely TS source rearrangement + one new error class.

## Common Pitfalls

### Pitfall 1: madge default-extension blindness
**What goes wrong:** `npx madge --circular cli/src/cursor` (no `--extensions` flag) silently returns exit code 0 with `Processed 0 files`, masking the cycles.
**Why it happens:** madge defaults to `js,jsx,ts` only when no config is present — but it depends on resolver heuristics that miss `.ts` files in some setups.
**How to avoid:** ALWAYS pass `--extensions ts,tsx`. Bake into the guard script.
**Verification:** Confirmed both behaviors 2026-05-22 — without flag: exit 0 / 0 files processed; with `--extensions ts,tsx`: exit 1 / 3 cycles reported.

### Pitfall 2: `as string` silent-cast residue in tests / other files
**What goes wrong:** Removing the cast from the two launchers but missing one in a test or a forgotten branch.
**How to avoid:** D-108 #3 ripgrep guard scoped to launcher files. Researcher additionally recommends one-off `rg 'permissionMode as string' cli/src/` to verify no other call site exists. **VERIFIED 2026-05-22:** only two hits — `cursorLocalLauncher.ts:24` and `cursorRemoteLauncher.ts:97/98` (the second hit is `mode.permissionMode as string` from inline destructuring; both removed in slice 3).

### Pitfall 3: Importing `loop.ts` from `modes.ts` later
**What goes wrong:** A future contributor adds a tiny type alias to `loop.ts` and re-imports it from `modes.ts`, recreating the cycle.
**How to avoid:** D-108 #4 — `madge --circular cli/src/cursor` exit 0 baked into `bun run test` flow via the source guard script or a new dedicated invocation. Annotate `modes.ts` with a header comment: `// LEAF MODULE — must not import from loop/session/launcher/cursorLocal. Adding such an import regenerates the Phase 6 cycle.`

### Pitfall 4: `UnknownPermissionModeError` swallowed by try/catch in launcher
**What goes wrong:** Launcher wraps the modeConfig call in a try/catch (consistent with current `cursorRemoteLauncher.ts:153-157` style) and silently returns.
**How to avoid:** D-99/D-102 — the error must propagate to `lifecycle.markCrash`. Cursor remote launcher's existing catch at line 153 catches errors from `runAgentProcess` (process I/O), NOT from arg-construction. Reading `cursorRemoteLauncher.ts:96-108` confirms `permissionModeToAgentArgs(...)` is called OUTSIDE the try block, so the typed error already propagates. Verify the local launcher: `cursorLocalLauncher.ts:24` is also outside any try — good.

### Pitfall 5: `runCursor.ts::resolvePermissionMode` payload value
**What goes wrong:** `throw new UnknownPermissionModeError(rawValue)` requires `rawValue` to be a `string`. Current `resolvePermissionMode(value: unknown)` accepts unknown.
**How to avoid:** Coerce safely: `throw new UnknownPermissionModeError(typeof value === 'string' ? value : JSON.stringify(value));`. Document on the error class JSDoc.

## Code Examples

### Recommended `cli/src/cursor/modes.ts`

```typescript
import type { CursorPermissionMode } from '@hapi/protocol/types';

export type PermissionMode = CursorPermissionMode;

export interface EnhancedMode {
    permissionMode: PermissionMode;
    model?: string;
}
```

That is the entire file. Imports: ONE — `@hapi/protocol/types`. No imports of `./loop`, `./session`, `./cursorLocalLauncher`, `./cursorRemoteLauncher`, `./cursorLocal`. The leaf property is the guard.

### Recommended `cli/src/agent/modeConfig.ts`

Researcher recommends the **optional-shape** type (not discriminated union) — minimal churn at call sites that destructure `{ mode, yolo }`:

```typescript
import type { PermissionMode } from '@/cursor/modes';
import { UnknownPermissionModeError, CURSOR_PERMISSION_MODES } from '@hapi/shared/modes';

export type CursorArgsFragment = {
    mode?: 'plan' | 'ask';
    yolo?: boolean;
};

export function permissionModeToCursorArgs(
    mode: PermissionMode | undefined
): CursorArgsFragment {
    if (mode === undefined || mode === 'default') {
        return {};
    }
    if (mode === 'plan') {
        return { mode: 'plan' };
    }
    if (mode === 'ask') {
        return { mode: 'ask' };
    }
    if (mode === 'yolo') {
        return { yolo: true };
    }
    throw new UnknownPermissionModeError(mode);
}
```

Note: `CURSOR_PERMISSION_MODES` import is not strictly used in the body because TS exhaustiveness via the union narrows `mode` — but keep the import as documentation OR drop and rely on `throw` as the never-arrow. **Researcher recommendation:** drop the unused import to keep the file minimal.

The export name `permissionModeToCursorArgs` is chosen (matches the original helper name from `cursorLocalLauncher.ts:6` and is the most call-site-friendly — the rename to `buildCursorArgsFragment` adds churn without value).

### Recommended `shared/src/modes.ts` addition

Append to existing file (do not modify the `AGENT_MESSAGE_PAYLOAD_TYPE` literal — Phase 5 D-81 anchor):

```typescript
export class UnknownPermissionModeError extends Error {
    readonly offendingMode: string;

    constructor(offendingMode: string) {
        super(`Unknown permission mode: ${offendingMode}`);
        this.name = 'UnknownPermissionModeError';
        this.offendingMode = offendingMode;
    }
}
```

Field shape matches CONTEXT D-98 exactly. The `this.name` assignment is critical — without it, `error.name` reports `'Error'` because Node's `Error` constructor sets `name` to the class via prototype lookup only if the subclass declares it explicitly.

### Recommended `cursorLocalLauncher.ts` change (slice 3)

Before (lines 6-17 + 24):
```typescript
function permissionModeToCursorArgs(mode?: string): { mode?: 'plan' | 'ask'; yolo?: boolean } { /* … */ }
// …
const { mode, yolo } = permissionModeToCursorArgs(session.getPermissionMode() as string);
```

After:
```typescript
import { permissionModeToCursorArgs } from '@/agent/modeConfig';
// …
const { mode, yolo } = permissionModeToCursorArgs(session.getPermissionMode());
```

### Recommended `cursorRemoteLauncher.ts` change (slice 3)

Lines 43-48 (`permissionModeToAgentArgs`) deleted; lines 96-98 become:
```typescript
const { message, mode } = batch;
const { mode: agentMode, yolo } = permissionModeToCursorArgs(mode.permissionMode);
this.applyDisplayMode(mode.permissionMode);
```

`applyDisplayMode` signature changes from `(permissionMode: string | undefined)` to `(permissionMode: PermissionMode | undefined)` — purely type narrowing, no runtime change.

### Recommended `runCursor.ts::resolvePermissionMode` change (slice 2)

```typescript
import { UnknownPermissionModeError } from '@hapi/shared/modes';
// …
const resolvePermissionMode = (value: unknown): PermissionMode => {
    const parsed = PermissionModeSchema.safeParse(value);
    if (!parsed.success || !isPermissionModeAllowedForFlavor(parsed.data, 'cursor')) {
        throw new UnknownPermissionModeError(
            typeof value === 'string' ? value : JSON.stringify(value)
        );
    }
    return parsed.data as PermissionMode;
};
```

Also update import on `runCursor.ts:2` to `import { loop } from './loop'; import type { EnhancedMode, PermissionMode } from './modes';` (D-96).

### Recommended JSDoc tag form (D-90 — researcher decision)

Use the explicit `@implements` JSDoc pseudo-tag plus a stable grep-anchor comment:

```typescript
/**
 * @implements SessionContext (Phase 6 SC#1)
 *
 * Provides the SessionContext role from the shared-kit concept set
 * defined in ROADMAP.md Phase 6 SC#1. Concept position only — file
 * name intentionally not renamed (CONTEXT D-89).
 */
export class AgentSessionBase<Mode> { /* … */ }
```

Grep anchor (one-line stable): `@implements SessionContext (Phase 6 SC#1)` — one hit each for `SessionContext`, `LocalAdapter`, `RemoteAdapter`, `LaunchPolicy`. Easy to verify in the source-guard script: `rg -c '@implements (SessionContext|LocalAdapter|RemoteAdapter|LaunchPolicy) \(Phase 6 SC#1\)' cli/src/` should be ≥ 4.

### Test patterns (D-104 / D-105)

#### Test 1: `cli/src/agent/modeConfig.test.ts` (slice 2)

```typescript
import { describe, it, expect } from 'vitest';
import { permissionModeToCursorArgs } from './modeConfig';
import { UnknownPermissionModeError } from '@hapi/shared/modes';

describe('permissionModeToCursorArgs', () => {
    it('returns empty fragment for undefined', () => {
        expect(permissionModeToCursorArgs(undefined)).toEqual({});
    });
    it('returns empty fragment for default', () => {
        expect(permissionModeToCursorArgs('default')).toEqual({});
    });
    it('returns mode=plan for plan', () => {
        expect(permissionModeToCursorArgs('plan')).toEqual({ mode: 'plan' });
    });
    it('returns mode=ask for ask', () => {
        expect(permissionModeToCursorArgs('ask')).toEqual({ mode: 'ask' });
    });
    it('returns yolo=true for yolo', () => {
        expect(permissionModeToCursorArgs('yolo')).toEqual({ yolo: true });
    });
    it('throws UnknownPermissionModeError for unknown string', () => {
        // @ts-expect-error testing runtime guard with invalid input
        expect(() => permissionModeToCursorArgs('weird')).toThrow(UnknownPermissionModeError);
        try {
            // @ts-expect-error
            permissionModeToCursorArgs('weird');
        } catch (e) {
            expect(e).toBeInstanceOf(UnknownPermissionModeError);
            expect((e as UnknownPermissionModeError).offendingMode).toBe('weird');
        }
    });
});
```

#### Test 2: `cli/src/cursor/cursorLocalLauncher.test.ts` (slice 4) — local plan switch

Local launcher feeds `cursorLocal.ts::spawnWithTerminalGuard(options)` which in turn calls `spawnWithAbort`. Strategy: `vi.mock('@/utils/spawnWithTerminalGuard')` and assert `options.args` shape across two invocations.

Reference pattern: `cli/src/runner/buildCliArgs.test.ts` shows args-array assertion style (`expect(args).toContain('--mode')`, `expect(args).not.toContain('--yolo')`).

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/utils/spawnWithTerminalGuard', () => ({
    spawnWithTerminalGuard: vi.fn(async () => {})
}));

import { cursorLocal } from './cursorLocal';
import { spawnWithTerminalGuard } from '@/utils/spawnWithTerminalGuard';

describe('cursorLocal mid-session permission-mode switch', () => {
    beforeEach(() => { vi.clearAllMocks(); });

    it('emits --mode plan then no --mode flag when switched back to default', async () => {
        const ctrl = new AbortController();
        await cursorLocal({ abort: ctrl.signal, chatId: null, path: '/tmp', mode: 'plan' });
        expect(vi.mocked(spawnWithTerminalGuard).mock.calls[0][0].args).toEqual(
            expect.arrayContaining(['--mode', 'plan'])
        );

        await cursorLocal({ abort: ctrl.signal, chatId: null, path: '/tmp' });
        expect(vi.mocked(spawnWithTerminalGuard).mock.calls[1][0].args).not.toContain('--mode');
    });
});
```

**Researcher note:** Testing at the `cursorLocal` layer (not `cursorLocalLauncher`) avoids the need to mock the entire `BaseLocalLauncher` machinery — and `cursorLocal.ts` is exactly where the args are built. The mid-session switch is exercised by two sequential calls with different `mode` inputs, which is the realistic semantic (the launcher rebuilds args per turn).

#### Test 3: `cli/src/cursor/cursorRemoteLauncher.test.ts` (slice 4) — remote yolo switch

The remote launcher's args come from the module-private `buildAgentArgs` (`cursorRemoteLauncher.ts:17-41`). Two practical approaches:
- **(A) Export `buildAgentArgs` for testing** — minimal surface change, direct assertion on output array.
- **(B) Mock `node:child_process.spawn`** — exercises the full path including `runAgentProcess` but requires careful stub of EventEmitter / readable streams.

**Researcher recommendation: (A).** Add `export` to `buildAgentArgs`. The test then:

```typescript
import { describe, it, expect } from 'vitest';
import { buildAgentArgs } from './cursorRemoteLauncher';
import { permissionModeToCursorArgs } from '@/agent/modeConfig';

describe('cursorRemoteLauncher mid-session yolo switch', () => {
    it('args contain --yolo and not --mode after switching from default to yolo', () => {
        const frag1 = permissionModeToCursorArgs('default');
        const args1 = buildAgentArgs({ message: 'hi', cwd: '/tmp', sessionId: 's1', ...frag1 });
        expect(args1).not.toContain('--yolo');
        expect(args1).not.toContain('--mode');

        const frag2 = permissionModeToCursorArgs('yolo');
        const args2 = buildAgentArgs({ message: 'continue', cwd: '/tmp', sessionId: 's1', ...frag2 });
        expect(args2).toContain('--yolo');
        expect(args2).not.toContain('--mode');
    });
});
```

This validates SC#4 "yolo + remote" exactly — same args shape that a real `spawn` would receive — without process I/O.

#### D-104 decision: local-only or both for plan switch?

**Researcher recommendation: test plan switch on BOTH local and remote** — minimal cost since both reduce to args-array inspection (per the strategy above). Add to test 3:

```typescript
it('args contain --mode plan and not --yolo for plan turn', () => {
    const frag = permissionModeToCursorArgs('plan');
    const args = buildAgentArgs({ message: 'q', cwd: '/tmp', sessionId: null, ...frag });
    expect(args).toEqual(expect.arrayContaining(['--mode', 'plan']));
    expect(args).not.toContain('--yolo');
});
```

That gives D-104 #2 cross-layer coverage. Total new tests: 1 (modeConfig unit, 6 cases) + 1 (local cursorLocal mid-session) + 1 (remote buildAgentArgs yolo + plan).

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `loop.ts` owns both types and runtime imports | Leaf `modes.ts` owns types; `loop.ts` only orchestrates | Phase 6 slice 1 | Breaks 3 madge cycles; future-proofs against new launcher files |
| `permissionModeToCursorArgs` duplicated 2 places | Single `cli/src/agent/modeConfig.ts` export | Phase 6 slice 3 | Removes 100% duplication; SC#5 ripgrep guard pass |
| `throw new Error('Invalid permission mode')` | `throw new UnknownPermissionModeError(rawValue)` | Phase 6 slice 2 | Hub/web can `instanceof` the typed class in Phase 7 |
| `permissionMode as string` cast in launchers | Direct `PermissionMode | undefined` pass-through | Phase 6 slice 3 | TS compiler enforces the union; no runtime widening |

**Deprecated/outdated:**
- Local `permissionModeToCursorArgs` / `permissionModeToAgentArgs` in launcher files — removed in slice 3.
- `import type { EnhancedMode, PermissionMode } from './loop'` in `session.ts` — replaced by `from './modes'` in slice 1.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Type aliases `SessionPermissionMode = PermissionMode = CursorPermissionMode` make D-100 a no-op | §D-100 resolution | Low — verified by file reads; if alias chain breaks in a future Phase 7 change, a generic / override becomes necessary then |
| A2 | `madge` available via `npx` without install (no project devDep) | §Standard Stack | Low — `npx madge` worked 2026-05-22 from a clean shell |
| A3 | Researcher recommendation to export `buildAgentArgs` for testability is acceptable | §Code Examples — Test 3 | Low — common testing pattern; alternative is the heavier `node:child_process` mock if planner prefers |
| A4 | `localLaunchPolicy.ts` not renamed in this phase | §Deferred | None — consistent with D-89 / D-93; Phase 12 may revisit |

If any of A1–A3 is contested by the planner, the alternative path is documented inline.

## Open Questions

1. **Should `madge` be added as a project devDependency or kept as `npx --no-install`?**
   - What we know: madge is widely-used, stable; `npx` already works ad-hoc.
   - What's unclear: whether the planner wants the guard to be CI-deterministic (project dep) vs ephemeral (`npx`).
   - Recommendation: Add `madge` to root `devDependencies` so `bun install` warms the cache and the guard script can rely on `./node_modules/.bin/madge`. Cost: one entry in root `package.json`.

2. **Should the guard script (`scripts/check-no-cut-agents.sh`) extend with Phase 6 keywords or should a new dedicated script be created?**
   - What we know: D-108 says "added to existing test:guard script style". Phase 4-5 inlined into the same script.
   - What's unclear: maintainability vs single-file growth.
   - Recommendation: extend the existing script with a `PHASE6_*` block (consistent with PHASE3/4/5 pattern). One file, contiguous history. Add `madge` invocation as a parallel exit-code check at the end.

3. **Should `applyDisplayMode` parameter type narrow from `string | undefined` to `PermissionMode | undefined`?**
   - What we know: it currently accepts `string | undefined` because of the `as string` cast upstream.
   - Recommendation: narrow to `PermissionMode | undefined` — consistent with D-100 narrowing. Trivial change, no runtime effect.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js / Bun | `bun typecheck` + `bun run test` + `npx` | ✓ | bun 1.x (per existing scripts) | — |
| madge | `madge --circular cli/src/cursor` guard | ✓ via `npx` | resolved on-demand | Could be vendored as devDep (recommended — see Open Questions #1) |
| ripgrep | `scripts/check-no-cut-agents.sh` | ✓ (system `rg` or vendored vscode `rg`) | varies | Script already implements dual resolution |
| vitest | Test execution | ✓ via `cli/vitest.config.ts` | per workspace `package.json` | — |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** none — the optional `madge` devDep upgrade is a polish, not a blocker.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest (config: `cli/vitest.config.ts`; includes `src/**/*.test.ts`) |
| Config file | `cli/vitest.config.ts`, `hub/vitest.config.ts`, `web/vitest.config.ts` (Phase 6 only writes cli tests) |
| Quick run command | `bun run --cwd cli test -- --run path/to/file.test.ts` |
| Full suite command | `bun run test` (runs cli + hub + web + `test:guard`) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| REFA-02 | Single `modeConfig.permissionModeToCursorArgs` is the only source of permission-mode → args mapping | unit | `bun run --cwd cli test -- --run src/agent/modeConfig.test.ts` | ❌ Slice 2 creates |
| REFA-02 | No duplicate identifier in launcher files | guard (ripgrep) | `bash scripts/check-no-cut-agents.sh` (Phase 6 block) | ❌ Slice 4 extends existing |
| REFA-02 | JSDoc concept tags present on 4 base files | guard (ripgrep) | `bash scripts/check-no-cut-agents.sh` (count ≥ 4) | ❌ Slice 4 extends |
| REFA-05 | `cli/src/cursor/` zero circular deps | guard (madge) | `npx madge --circular --extensions ts,tsx cli/src/cursor` → exit 0 | ❌ Slice 4 wires into script |
| REFA-05 | Mid-session yolo switch on remote (args contain `--yolo`, exclude `--mode`) | unit (args inspection) | `bun run --cwd cli test -- --run src/cursor/cursorRemoteLauncher.test.ts` | ❌ Slice 4 creates |
| REFA-05 | Mid-session plan switch on local (args contain `--mode plan` then absent after revert) | unit (mock spawnWithTerminalGuard) | `bun run --cwd cli test -- --run src/cursor/cursorLocalLauncher.test.ts` | ❌ Slice 4 creates |
| REFA-05 | Unknown mode at modeConfig throws `UnknownPermissionModeError` w/ `offendingMode` | unit | covered in `src/agent/modeConfig.test.ts` (slice 2) | ❌ Slice 2 creates |
| REFA-05 | Unknown mode at RPC boundary throws same class | integration (RPC payload simulation) | additional case in `src/cursor/runCursor` or in modeConfig test importing `resolvePermissionMode` | ❌ Slice 2 |
| REFA-05 | Existing `bun run test` suite stays green | regression | `bun run test` | ✓ |

### Sampling Rate

- **Per task commit:** `bun run --cwd cli typecheck && bun run --cwd cli test`
- **Per slice merge:** `bun typecheck && bun run test` (full suite incl. guard)
- **Phase gate:** Full `bun run test` green + `npx madge --circular --extensions ts,tsx cli/src/cursor` exits 0 + extended `scripts/check-no-cut-agents.sh` green

### Validation Dimensions (Nyquist coverage map)

| Dimension | What it validates | Where validated |
|-----------|-------------------|-----------------|
| Correctness of args shape | `{ mode, yolo }` fragment correctly maps each `PermissionMode` value | `modeConfig.test.ts` (6 cases) + launcher tests (cross-layer) |
| Error class identity | `UnknownPermissionModeError` instance + `offendingMode` field + name | `modeConfig.test.ts` + runCursor.test (if planner adds) |
| Import topology | `cli/src/cursor/` has 0 cycles | `npx madge --circular --extensions ts,tsx cli/src/cursor` (exit-code guard) |
| Duplication absence | `permissionModeToCursorArgs` exists only in `modeConfig.ts`; `permissionModeToAgentArgs` deleted; `permissionMode as string` absent in launcher files | ripgrep guard in `scripts/check-no-cut-agents.sh` (Phase 6 block) |
| Concept-position anchors | 4 base files carry `@implements ... (Phase 6 SC#1)` JSDoc | ripgrep `rg -c '@implements (Session|Local|Remote|Launch)' cli/src/` ≥ 4 |
| No-regression | Existing 100% green `bun run test` stays green | full suite at each slice |

### Wave 0 Gaps

- [ ] `cli/src/agent/modeConfig.test.ts` — modeConfig unit (slice 2 creates with the helper itself)
- [ ] `cli/src/cursor/cursorLocalLauncher.test.ts` — mid-session plan switch (slice 4)
- [ ] `cli/src/cursor/cursorRemoteLauncher.test.ts` — mid-session yolo + plan switch (slice 4); requires `export buildAgentArgs` (one-line surface change)
- [ ] `scripts/check-no-cut-agents.sh` — extend with Phase 6 ripgrep + madge guard block (slice 4); no new file
- [ ] (Optional) root `package.json` — add `madge` to `devDependencies` for deterministic CI (recommended per Open Question #1)

No framework install needed — vitest, bun, madge (via npx), and ripgrep are already in use.

## Project Constraints (from `AGENTS.md`)

- **No backward compatibility** — Phase 5 D-22/D-32 reinforced. Phase 6 is a refactor, not a deletion, but the rule applies to the unknown-mode error path: no silent fallback, no shim, no deprecated-helper export (the two launcher helpers are removed outright, not aliased).
- **TypeScript strict** — narrowing `getPermissionMode()` return to `PermissionMode | undefined` must compile under strict mode; no `any`, no `as unknown as`. Verified: alias chain unifies under strict (see D-100 resolution).
- **Bun workspaces** — Phase 6 touches `cli` and `shared` workspaces only. `@hapi/shared/modes` import path is the canonical reference.
- **4-space indentation** — all new files (`modes.ts`, `modeConfig.ts`, tests) follow.
- **Required tests** — 3 new tests + 1 unit test file. Match existing style in `cli/src/runner/buildCliArgs.test.ts`.

## Sources

### Primary (HIGH confidence — direct file reads + executed tools, 2026-05-22)

- `cli/src/cursor/loop.ts` (lines 1-60) — type definitions + runtime imports
- `cli/src/cursor/session.ts` (lines 1-78) — type import from `./loop` (cycle source)
- `cli/src/cursor/cursorLocalLauncher.ts` (lines 1-57) — `permissionModeToCursorArgs` definition + `as string` cast
- `cli/src/cursor/cursorRemoteLauncher.ts` (lines 1-253) — `permissionModeToAgentArgs` + `buildAgentArgs` + `as string` casts at 97-98
- `cli/src/cursor/cursorLocal.ts` (lines 1-76) — args construction for local spawn
- `cli/src/cursor/runCursor.ts` (lines 1-164) — `resolvePermissionMode` + lifecycle.markCrash path
- `cli/src/agent/sessionBase.ts` (lines 1-167) — `getPermissionMode()` return type `SessionPermissionMode | undefined`
- `cli/src/agent/localLaunchPolicy.ts` (full) — `LaunchPolicy` role
- `cli/src/agent/loopBase.ts` (full) — orchestration, untouched
- `cli/src/modules/common/launcher/BaseLocalLauncher.ts` (lines 1-40) — `LocalAdapter` role
- `cli/src/modules/common/remote/RemoteLauncherBase.ts` (lines 1-30) — `RemoteAdapter` role
- `cli/src/api/types.ts` (lines 1-40) — `SessionPermissionMode = PermissionMode` alias chain
- `shared/src/modes.ts` (lines 1-64) — `CURSOR_PERMISSION_MODES`, `PermissionMode = CursorPermissionMode`, `AgentFlavor = 'cursor'`
- `cli/src/runner/buildCliArgs.test.ts` (lines 1-60) — args-inspection test pattern
- `cli/src/cursor/utils/cursorEventConverter.test.ts` (lines 1-30) — vitest pattern reference
- `cli/vitest.config.ts` (full) — vitest config with `@ → ./src` alias
- `scripts/check-no-cut-agents.sh` (lines 1-161) — existing source-guard pattern, Phase 6 extension landing site
- `package.json` (full) — workspace + script topology; `test:guard` already wired
- `.planning/REQUIREMENTS.md` — REFA-02, REFA-05 traceability
- `.planning/ROADMAP.md` Phase 6 — SC#1-#5 verified
- `.planning/config.json` — `nyquist_validation: true`, `commit_docs: true`
- Executed: `npx madge --circular --extensions ts,tsx cli/src/cursor` → exit 1, 3 cycles (matches CONTEXT specifics)

### Secondary (MEDIUM confidence)

- Phase 5 `05-CONTEXT.md` — D-76 unknown-mode throw policy carry-through; D-86 ripgrep guard precedent

### Tertiary (LOW confidence)

- None — this phase is purely internal refactor; no external library research needed.

## Metadata

**Confidence breakdown:**
- Existing-code mapping: HIGH — every file read with exact line numbers.
- Madge output: HIGH — executed and matches CONTEXT claim verbatim.
- D-100 resolution (no generic / no override): HIGH — type alias chain verified.
- Test mock strategy: MEDIUM — proposed pattern (export `buildAgentArgs`) is a one-line surface change; planner may prefer full `node:child_process` mock instead (both viable).
- Pitfalls: HIGH — all five are evidence-based (verified casts, verified non-catch flow, executed madge edge-case).

**Research date:** 2026-05-22
**Valid until:** 2026-06-21 (30 days — stable refactor scope; only invalidated if Phase 7 begins and starts moving `PermissionMode` to `shared/`).

## RESEARCH COMPLETE
