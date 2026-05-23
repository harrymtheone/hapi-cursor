# Phase 6: Agent runtime shared kit + mode hardening — Pattern Map

**Mapped:** 2026-05-22
**Files analyzed:** 12 (4 NEW + 8 MODIFIED, + 1 guard script)
**Analogs found:** 12 / 12

This phase is a pure cli-runtime topology refactor. Every NEW file has a strong existing analog in the same workspace (often the file being decomposed). The "patterns" below are concrete copy-from instructions, anchored by file:line.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| **NEW** `cli/src/cursor/modes.ts` | type-leaf module | type-only | `cli/src/agent/localLaunchPolicy.ts` (leaf, type-export only) | exact (leaf + zero-import shape) |
| **NEW** `cli/src/agent/modeConfig.ts` | utility (pure fn) | transform (PermissionMode → CursorArgsFragment) | `cli/src/cursor/cursorLocalLauncher.ts:6-17` (`permissionModeToCursorArgs`) | exact (extracting the helper verbatim) |
| **NEW** `cli/src/agent/modeConfig.test.ts` | test (unit, pure fn) | request-response | `cli/src/runner/buildCliArgs.test.ts` (args-shape assertions) | exact |
| **NEW** `cli/src/cursor/cursorRemoteLauncher.test.ts` (mid-session yolo + plan) | test (args-shape) | request-response | `cli/src/runner/buildCliArgs.test.ts` | exact |
| **NEW** `cli/src/cursor/cursorLocalLauncher.test.ts` (mid-session plan switch) | test (mock spawn) | request-response | `cli/src/cursor/utils/cursorEventConverter.test.ts` (vitest config + `vi.mock`) + `buildCliArgs.test.ts` (args shape) | role-match |
| **MODIFIED** `shared/src/modes.ts` | wire-level type module (+ new typed error) | type-only + transform | self (existing pattern in same file) | exact (additive) |
| **MODIFIED** `cli/src/cursor/loop.ts` | orchestration | request-response | self (delete-only on type defs) | exact |
| **MODIFIED** `cli/src/cursor/session.ts` | model / state holder | type-only import swap | self | exact |
| **MODIFIED** `cli/src/cursor/cursorLocalLauncher.ts` | launcher (local) | request-response | self (delete helper, swap import) | exact |
| **MODIFIED** `cli/src/cursor/cursorRemoteLauncher.ts` | launcher (remote) | streaming (process I/O) | self (delete helper, narrow types) | exact |
| **MODIFIED** `cli/src/cursor/cursorLocal.ts` | spawn helper | streaming | self (no logic change) | exact |
| **MODIFIED** `cli/src/cursor/runCursor.ts` | entry / RPC boundary | request-response | self (swap import + upgrade throw) | exact |
| **MODIFIED** `cli/src/agent/sessionBase.ts` | shared base (`SessionContext`) | type-only annotation | self (+ JSDoc) | exact |
| **MODIFIED** `cli/src/modules/common/launcher/BaseLocalLauncher.ts` | shared base (`LocalAdapter`) | type-only annotation | self | exact |
| **MODIFIED** `cli/src/modules/common/remote/RemoteLauncherBase.ts` | shared base (`RemoteAdapter`) | type-only annotation | self | exact |
| **MODIFIED** `cli/src/agent/localLaunchPolicy.ts` | shared base (`LaunchPolicy`) | type-only annotation | self | exact |
| **MODIFIED** `scripts/check-no-cut-agents.sh` | guard script | batch (CI) | self (Phase 4/5 blocks) | exact |

## Pattern Assignments

### NEW `cli/src/cursor/modes.ts` (type-leaf module)

**Analog:** `cli/src/agent/localLaunchPolicy.ts` — same shape: tiny leaf with `export type` only, zero deep imports. Confirms the "leaf module" precedent already exists in this codebase.

**Source of truth:** copy the type definitions verbatim from `cli/src/cursor/loop.ts:8-15`.

Current location (to be removed from `loop.ts`):

```8:15:cli/src/cursor/loop.ts
import type { CursorPermissionMode } from '@hapi/protocol/types';

export type PermissionMode = CursorPermissionMode;

export interface EnhancedMode {
    permissionMode: PermissionMode;
    model?: string;
}
```

**Target shape (RESEARCH §Code Examples):**

```typescript
// LEAF MODULE — must not import from ./loop / ./session / ./cursorLocalLauncher /
// ./cursorRemoteLauncher / ./cursorLocal. Adding any such import regenerates the
// Phase 6 cycle (madge --circular cli/src/cursor exits != 0).
import type { CursorPermissionMode } from '@hapi/protocol/types';

export type PermissionMode = CursorPermissionMode;

export interface EnhancedMode {
    permissionMode: PermissionMode;
    model?: string;
}
```

Leaf-property guard: only ONE import (`@hapi/protocol/types`). D-95 / Pitfall 3.

---

### NEW `cli/src/agent/modeConfig.ts` (utility, pure transform)

**Analog:** `cli/src/cursor/cursorLocalLauncher.ts:6-17` (the helper being lifted) and `cli/src/cursor/cursorRemoteLauncher.ts:43-48` (the duplicate). Both reduce to identical 5-6 line bodies.

**Copy from** `cursorLocalLauncher.ts:6-17`:

```6:17:cli/src/cursor/cursorLocalLauncher.ts
function permissionModeToCursorArgs(mode?: string): { mode?: 'plan' | 'ask'; yolo?: boolean } {
    if (mode === 'plan') {
        return { mode: 'plan' };
    }
    if (mode === 'ask') {
        return { mode: 'ask' };
    }
    if (mode === 'yolo') {
        return { yolo: true };
    }
    return {};
}
```

**Diff to apply** when promoting into `modeConfig.ts`:
1. Narrow signature `mode?: string` → `mode: PermissionMode | undefined`.
2. Extract `CursorArgsFragment` as named exported type (was anonymous return shape).
3. Add explicit `default` branch (returns `{}` — D-101: `undefined` and `'default'` are equivalent; both fall through).
4. Replace `return {}` tail with `throw new UnknownPermissionModeError(mode)` — D-99 (the only behavioral change in the lift).

**Target shape (RESEARCH §Code Examples, recommended optional-shape form):**

```typescript
import type { PermissionMode } from '@/cursor/modes';
import { UnknownPermissionModeError } from '@hapi/shared/modes';

export type CursorArgsFragment = {
    mode?: 'plan' | 'ask';
    yolo?: boolean;
};

export function permissionModeToCursorArgs(
    mode: PermissionMode | undefined
): CursorArgsFragment {
    if (mode === undefined || mode === 'default') return {};
    if (mode === 'plan') return { mode: 'plan' };
    if (mode === 'ask') return { mode: 'ask' };
    if (mode === 'yolo') return { yolo: true };
    throw new UnknownPermissionModeError(mode);
}
```

**Export name:** `permissionModeToCursorArgs` (keep — matches original helper, minimizes call-site churn at the two launcher import sites; D-91 Claude's discretion resolved by researcher).

---

### MODIFIED `shared/src/modes.ts` (additive — `UnknownPermissionModeError`)

**Analog:** the file itself — already exports value classes/objects (`PERMISSION_MODE_LABELS`, `getPermissionModeLabel`). The new class slots in alongside existing exports.

**Existing style anchor** (`shared/src/modes.ts:41-47` — same indentation / `export function` form):

```41:47:shared/src/modes.ts
export function getPermissionModeLabel(mode: PermissionMode): string {
    return PERMISSION_MODE_LABELS[mode]
}

export function getPermissionModeTone(mode: PermissionMode): PermissionModeTone {
    return PERMISSION_MODE_TONES[mode]
}
```

**Append (D-98 + RESEARCH §Code Examples):**

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

Notes:
- File uses **4-space indent**, no semicolons on top-level statements (see lines 9, 11, 17). The class itself uses semicolons internally (this is fine — matches TS class convention elsewhere; consistent with `cli/` style).
- Pin location: append AFTER `isPermissionModeAllowedForFlavor` (line 63) so the wire-protocol literal at line 9 (the Phase 5 D-81 anchor) is not disturbed; the Phase 5 source-guard's post-filter on line 84 of `scripts/check-no-cut-agents.sh` is line-content-anchored, not line-number-anchored, so this is safe.
- `this.name` assignment is required — see RESEARCH §Code Examples note (without it, `instanceof` works but `error.name === 'Error'`).

---

### MODIFIED `cli/src/cursor/loop.ts` (delete type defs; keep orchestration)

**Diff (slice 1):**

Before (lines 8-15):
```8:15:cli/src/cursor/loop.ts
import type { CursorPermissionMode } from '@hapi/protocol/types';

export type PermissionMode = CursorPermissionMode;

export interface EnhancedMode {
    permissionMode: PermissionMode;
    model?: string;
}
```

After (re-export from leaf so existing `import … from './loop'` consumers can transition):
```typescript
export type { PermissionMode, EnhancedMode } from './modes';
```

Or — if all consumers are updated in the same slice (D-96 lists them) — delete the lines outright. Researcher's preference: delete + update all 4 consumers (`session.ts`, `runCursor.ts`, `cursorLocalLauncher.ts`, `cursorRemoteLauncher.ts`) atomically; this matches the "one slice, all imports re-aimed" pattern from Phase 5.

`loop.ts:17-30` (`LoopOptions`) keeps `permissionMode: PermissionMode` — but the type now resolves via the new `modes.ts` re-export chain at line 8 (replace import on line 8 with `import type { PermissionMode, EnhancedMode } from './modes';`).

---

### MODIFIED `cli/src/cursor/session.ts` (the cycle source — swap import path)

**The single line that creates all 3 madge cycles:**

```4:4:cli/src/cursor/session.ts
import type { EnhancedMode, PermissionMode } from './loop';
```

**After (D-95/D-96):**
```typescript
import type { EnhancedMode, PermissionMode } from './modes';
```

Body unchanged. The class definition at `session.ts:12` (`extends AgentSessionBase<EnhancedMode>`) keeps working because the alias chain unifies (RESEARCH §D-100 resolution: `SessionPermissionMode = PermissionMode = CursorPermissionMode`).

---

### MODIFIED `cli/src/cursor/cursorLocalLauncher.ts` (slice 3)

**Diff:**

Before (lines 6-17 + 24):
```6:17:cli/src/cursor/cursorLocalLauncher.ts
function permissionModeToCursorArgs(mode?: string): { mode?: 'plan' | 'ask'; yolo?: boolean } {
    if (mode === 'plan') {
        return { mode: 'plan' };
    }
    // ... (delete the whole function)
}
```
And line 24:
```24:24:cli/src/cursor/cursorLocalLauncher.ts
    const { mode, yolo } = permissionModeToCursorArgs(session.getPermissionMode() as string);
```

**After:**
```typescript
import { permissionModeToCursorArgs } from '@/agent/modeConfig';
// …
const { mode, yolo } = permissionModeToCursorArgs(session.getPermissionMode());
```

Key removals:
- Delete the inline `permissionModeToCursorArgs` function entirely (lines 6-17). The ripgrep guard (D-108 #1) requires the identifier appears ONLY in `cli/src/agent/modeConfig.ts`.
- Delete the `as string` cast on line 24 (D-108 #3, Pitfall 2).

---

### MODIFIED `cli/src/cursor/cursorRemoteLauncher.ts` (slice 3)

**Diff:**

Before (lines 43-48 — delete entirely):
```43:48:cli/src/cursor/cursorRemoteLauncher.ts
function permissionModeToAgentArgs(mode?: string): { mode?: string; yolo?: boolean } {
    if (mode === 'plan') return { mode: 'plan' };
    if (mode === 'ask') return { mode: 'ask' };
    if (mode === 'yolo') return { yolo: true };
    return {};
}
```

Before (lines 96-98 — two `as string` casts):
```96:98:cli/src/cursor/cursorRemoteLauncher.ts
            const { message, mode } = batch;
            const { mode: agentMode, yolo } = permissionModeToAgentArgs(mode.permissionMode as string);
            this.applyDisplayMode(mode.permissionMode as string);
```

**After:**
```typescript
import { permissionModeToCursorArgs } from '@/agent/modeConfig';
// …
const { message, mode } = batch;
const { mode: agentMode, yolo } = permissionModeToCursorArgs(mode.permissionMode);
this.applyDisplayMode(mode.permissionMode);
```

Also narrow `applyDisplayMode` signature at line 217:
```217:222:cli/src/cursor/cursorRemoteLauncher.ts
    private applyDisplayMode(permissionMode: string | undefined): void {
        if (permissionMode && permissionMode !== this.displayPermissionMode) {
```
→ `(permissionMode: PermissionMode | undefined)`. Purely type narrowing, no runtime change (RESEARCH Open Question 3).

Add at top of imports:
```typescript
import type { PermissionMode } from './modes';
import { permissionModeToCursorArgs } from '@/agent/modeConfig';
```

`displayPermissionMode: string | null = null;` field at line 53 stays `string | null` (it stores the last-rendered string; harmless).

`buildAgentArgs` at lines 17-41: keep as-is for runtime; **add `export`** to enable test 3 (RESEARCH §Code Examples Test 3, recommendation A). Signature stays — `mode?: string` is fine for the local builder since it only does literal-string comparison.

---

### MODIFIED `cli/src/cursor/cursorLocal.ts` (no logic change)

Args construction (lines 32-49) unchanged. `opts.mode` / `opts.yolo` typed as `'plan' | 'ask'` / `boolean` already — consumer (cursorLocalLauncher) now passes values from `permissionModeToCursorArgs` whose return type IS `CursorArgsFragment = { mode?: 'plan' | 'ask'; yolo?: boolean }`. Type compatible, zero changes here.

D-92 anchor: this file's args layout is the "local long-lived interactive" form — kept separate from `buildAgentArgs` (remote `-p` single-turn). No merge.

---

### MODIFIED `cli/src/cursor/runCursor.ts` (slice 2)

**Diff:**

Before (line 2):
```2:2:cli/src/cursor/runCursor.ts
import { loop, type EnhancedMode, type PermissionMode } from './loop';
```

After:
```typescript
import { loop } from './loop';
import type { EnhancedMode, PermissionMode } from './modes';
import { UnknownPermissionModeError } from '@hapi/shared/modes';
```

Before (lines 107-113):
```107:113:cli/src/cursor/runCursor.ts
    const resolvePermissionMode = (value: unknown): PermissionMode => {
        const parsed = PermissionModeSchema.safeParse(value);
        if (!parsed.success || !isPermissionModeAllowedForFlavor(parsed.data, 'cursor')) {
            throw new Error('Invalid permission mode');
        }
        return parsed.data as PermissionMode;
    };
```

After (D-99 + Pitfall 5 — safe stringification for non-string payloads):
```typescript
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

The throw must NOT be wrapped in try/catch downstream. Verified by inspection: `set-session-config` RPC handler at lines 115-127 propagates errors back to the RPC client; the surrounding `runCursor` `loop` call at lines 131-148 has its own try/catch that routes errors to `lifecycle.markCrash` — exactly the D-102 path.

---

### MODIFIED `cli/src/agent/sessionBase.ts` (JSDoc only — D-90)

**Analog:** none needed (annotation only). Pattern source = RESEARCH §Code Examples "Recommended JSDoc tag form".

Add directly above the class declaration (currently `cli/src/agent/sessionBase.ts:30`):

```typescript
/**
 * @implements SessionContext (Phase 6 SC#1)
 *
 * Provides the SessionContext role from the shared-kit concept set defined
 * in ROADMAP.md Phase 6 SC#1. Concept position only — file name intentionally
 * not renamed (CONTEXT D-89).
 */
export class AgentSessionBase<Mode> {
```

Grep anchor: `@implements SessionContext (Phase 6 SC#1)`.

No other change in this file. The `getPermissionMode()` return type `SessionPermissionMode | undefined` already unifies with cursor `PermissionMode | undefined` via the type alias chain (RESEARCH §D-100 resolution — verified at `cli/src/api/types.ts:25`).

---

### MODIFIED `cli/src/modules/common/launcher/BaseLocalLauncher.ts` (JSDoc only)

Same pattern, above the class:

```typescript
/**
 * @implements LocalAdapter (Phase 6 SC#1)
 *
 * Provides the LocalAdapter role from the shared-kit concept set defined
 * in ROADMAP.md Phase 6 SC#1. Concept position only — file name intentionally
 * not renamed (CONTEXT D-89).
 */
```

Grep anchor: `@implements LocalAdapter (Phase 6 SC#1)`.

---

### MODIFIED `cli/src/modules/common/remote/RemoteLauncherBase.ts` (JSDoc only)

Same pattern:

```typescript
/**
 * @implements RemoteAdapter (Phase 6 SC#1)
 * ...
 */
```

Grep anchor: `@implements RemoteAdapter (Phase 6 SC#1)`.

---

### MODIFIED `cli/src/agent/localLaunchPolicy.ts` (JSDoc only — file body unchanged, D-93)

File is a pure leaf (already matches the target topology). Add at top of file (above `export type StartedBy` at line 1):

```typescript
/**
 * @implements LaunchPolicy (Phase 6 SC#1)
 *
 * Provides the LaunchPolicy role from the shared-kit concept set defined
 * in ROADMAP.md Phase 6 SC#1. Concept position only — file name intentionally
 * not renamed (CONTEXT D-89 / D-93).
 */
```

Grep anchor: `@implements LaunchPolicy (Phase 6 SC#1)`.

`loopBase.ts` is mentioned in CONTEXT as JSDoc-touch-only for orchestration cross-reference, but D-90 explicitly lists only the 4 SC#1 concepts (SessionContext / LocalAdapter / RemoteAdapter / LaunchPolicy). `loopBase.ts` carries no SC#1 concept tag — leave it untouched (consistent with D-90 verbatim).

---

### NEW `cli/src/agent/modeConfig.test.ts` (unit test)

**Analog:** `cli/src/runner/buildCliArgs.test.ts:1-32` — same shape: a single `describe` block, multiple `it()` cases, each asserting on the return value of a pure function with various input modes (`'plan'`, `'yolo'`, undefined, invalid).

**Reference pattern (vitest config, no globals → explicit imports):**

```1:13:cli/src/runner/buildCliArgs.test.ts
import { describe, it, expect } from 'vitest'
import { buildCliArgs } from './run'

describe('buildCliArgs', () => {
    it('adds --permission-mode for valid cursor permission mode', () => {
        const args = buildCliArgs('cursor', {
            directory: '/tmp',
            permissionMode: 'plan',
        })
        expect(args).toContain('--permission-mode')
        expect(args).toContain('plan')
        expect(args).not.toContain('--yolo')
    })
```

**Target shape (RESEARCH §Code Examples Test 1):** 6 cases — undefined → `{}`, default → `{}`, plan → `{mode:'plan'}`, ask → `{mode:'ask'}`, yolo → `{yolo:true}`, unknown → throws `UnknownPermissionModeError` with `offendingMode === 'weird'`.

**Notes:**
- Use `// @ts-expect-error` on the invalid-string case to keep TS strict happy (RESEARCH §Code Examples Test 1).
- 4-space indent matches `buildCliArgs.test.ts` style.
- File location: `cli/src/agent/modeConfig.test.ts` (same dir as the helper).

---

### NEW `cli/src/cursor/cursorRemoteLauncher.test.ts` (mid-session yolo + plan switch)

**Analog:** `cli/src/runner/buildCliArgs.test.ts` — args-array assertions (`expect(args).toContain('--yolo')`, `expect(args).not.toContain('--mode')`). This is the EXACT idiom needed.

**Strategy (RESEARCH §Code Examples Test 3, recommendation A):** Add `export` to `buildAgentArgs` in `cursorRemoteLauncher.ts` (one-line surface change); test calls it directly with two consecutive args-build invocations to validate mid-session switch semantics. No `node:child_process.spawn` mock needed.

**Target shape (verbatim from RESEARCH §Code Examples Test 3 + D-104 #2 cross-layer plan case):**

```typescript
import { describe, it, expect } from 'vitest';
import { buildAgentArgs } from './cursorRemoteLauncher';
import { permissionModeToCursorArgs } from '@/agent/modeConfig';

describe('cursorRemoteLauncher mid-session permission-mode switch', () => {
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

    it('args contain --mode plan and not --yolo for plan turn', () => {
        const frag = permissionModeToCursorArgs('plan');
        const args = buildAgentArgs({ message: 'q', cwd: '/tmp', sessionId: null, ...frag });
        expect(args).toEqual(expect.arrayContaining(['--mode', 'plan']));
        expect(args).not.toContain('--yolo');
    });
});
```

---

### NEW `cli/src/cursor/cursorLocalLauncher.test.ts` (mid-session plan switch — local)

**Analog (mock-spawn idiom):** `cli/src/cursor/utils/cursorEventConverter.test.ts` (vitest baseline in same dir) + `buildCliArgs.test.ts` (args-shape style). The mock target is `@/utils/spawnWithTerminalGuard` (referenced at `cursorLocal.ts:2`).

**Strategy:** Mock `spawnWithTerminalGuard`, call `cursorLocal()` twice with different `mode` inputs, assert on `vi.mocked(...).mock.calls[i][0].args`. RESEARCH §Code Examples Test 2:

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

**Note (researcher in RESEARCH):** testing at `cursorLocal` layer (not `cursorLocalLauncher`) avoids mocking the entire `BaseLocalLauncher` machinery. File name keeps `cursorLocalLauncher.test.ts` as a deliberate signal that the test exercises the local-launcher *args-layer* contract.

---

### MODIFIED `scripts/check-no-cut-agents.sh` (slice 4 — extend with Phase 6 block + madge)

**Analog:** the existing Phase-5 identifier block at `scripts/check-no-cut-agents.sh:124-134`:

```124:134:scripts/check-no-cut-agents.sh
# === Phase-5 identifier sweep — legacy capability/permission-mode names must be gone
if "$RG_BIN" -n "$PHASE5_IDENTIFIER_PATTERN" "${PHASE5_SOURCE_DIRS[@]}"; then
  echo ""
  echo "❌ Phase-5 legacy flavor identifier residue found in runtime source scope."
  echo "   isCodexFamilyFlavor / CodexCollaborationMode / getCodexCollaboration* /"
  echo "   (CLAUDE|CODEX|GEMINI|OPENCODE)_PERMISSION_MODES are all deleted in Phase 5."
  echo "   Rewrite the hit at the source (delete the consumer or migrate to"
  echo "   getCapability / CURSOR_PERMISSION_MODES); do not add a whitelist entry."
  exit 1
fi
echo "✅ No Phase-5 legacy flavor identifiers in source scope."
```

**Pattern to follow when adding Phase-6 block (append after line 160, before final newline):**

```bash
# === Phase-6 ripgrep sweeps — D-108
# (#1) permissionModeToCursorArgs only in modeConfig.ts (count == 1 for definition,
#      remaining hits are import sites — total minus modeConfig.ts must equal call count)
PHASE6_DUPLICATE_HELPER='\bpermissionModeToAgentArgs\b'
PHASE6_LAUNCHER_CAST_PATTERN='permissionMode as string'
PHASE6_LAUNCHER_FILES=(cli/src/cursor/cursorLocalLauncher.ts cli/src/cursor/cursorRemoteLauncher.ts)

# (#2) permissionModeToAgentArgs — zero hits anywhere
if "$RG_BIN" -n "$PHASE6_DUPLICATE_HELPER" cli/src shared/src hub/src web/src; then
  echo ""
  echo "❌ Phase-6 duplicate helper permissionModeToAgentArgs still present."
  echo "   Use cli/src/agent/modeConfig.permissionModeToCursorArgs instead."
  exit 1
fi
echo "✅ No Phase-6 duplicate permissionModeToAgentArgs in source scope."

# (#3) `permissionMode as string` — zero hits in launcher files
if "$RG_BIN" -n "$PHASE6_LAUNCHER_CAST_PATTERN" "${PHASE6_LAUNCHER_FILES[@]}"; then
  echo ""
  echo "❌ Phase-6 'permissionMode as string' cast residue in launcher files."
  echo "   modeConfig.permissionModeToCursorArgs accepts PermissionMode | undefined directly."
  exit 1
fi
echo "✅ No Phase-6 'permissionMode as string' casts in launcher files."

# (#1 strict variant) permissionModeToCursorArgs definition lives only in modeConfig.ts
DEF_HITS=$("$RG_BIN" -n '^export function permissionModeToCursorArgs|^function permissionModeToCursorArgs' \
  cli/src shared/src hub/src web/src | grep -v 'cli/src/agent/modeConfig\.ts' || true)
if [ -n "$DEF_HITS" ]; then
  echo "$DEF_HITS"
  echo ""
  echo "❌ Phase-6 permissionModeToCursorArgs defined outside cli/src/agent/modeConfig.ts."
  exit 1
fi
echo "✅ permissionModeToCursorArgs defined only in cli/src/agent/modeConfig.ts."

# (#4) madge exit-code guard — D-108 #4 / Pitfall 1 (extensions required)
if ! npx --no-install madge --circular --extensions ts,tsx cli/src/cursor > /dev/null 2>&1; then
  echo ""
  echo "❌ Phase-6 madge circular dependency found in cli/src/cursor."
  echo "   Run: npx madge --circular --extensions ts,tsx cli/src/cursor"
  echo "   Most likely cause: a new import from cli/src/cursor/modes.ts to loop/session/launcher."
  exit 1
fi
echo "✅ No circular dependencies in cli/src/cursor (madge)."

# (#5) JSDoc concept-position anchor count — D-90
ANCHOR_COUNT=$("$RG_BIN" -c '@implements (SessionContext|LocalAdapter|RemoteAdapter|LaunchPolicy) \(Phase 6 SC#1\)' cli/src | awk -F: '{s+=$2} END {print s+0}')
if [ "$ANCHOR_COUNT" -lt 4 ]; then
  echo "❌ Phase-6 SC#1 JSDoc concept tags missing (found $ANCHOR_COUNT, need ≥ 4)."
  exit 1
fi
echo "✅ Phase-6 SC#1 concept tags present (count=$ANCHOR_COUNT)."
```

**Whitelist:** none required for Phase-6 ripgrep terms — definitions are scoped to a single file (`modeConfig.ts`) and naturally excluded from the duplicate-hit checks via specific patterns. Whitelist arrays (`WHITELIST` / `PHASE4_WHITELIST`) are NOT extended (D-109 — keeps with the file-granularity convention).

**Pitfall 1 reinforced:** `--extensions ts,tsx` is non-negotiable; without it madge silently returns 0.

**`madge` dependency:** RESEARCH Open Question 1 — recommend adding `madge` to root `devDependencies` so `npx --no-install` resolves deterministically. If planner declines, replace `npx --no-install madge` with `npx madge` (still works, just slower on cold install).

---

## Shared Patterns

### Pattern A — "Leaf module, single import" (`modes.ts`)

**Source:** `cli/src/agent/localLaunchPolicy.ts:1-16` (in-repo example of the same shape: zero deep imports, only `export type` + one tiny pure fn).
**Apply to:** `cli/src/cursor/modes.ts`.
**Guard:** `madge --circular --extensions ts,tsx cli/src/cursor` exit 0 (D-108 #4); plus inline comment header anchoring the leaf invariant (RESEARCH Pitfall 3).

### Pattern B — "Pure-fn transform, throw on unknown" (`modeConfig.ts`)

**Source:** the function body at `cli/src/cursor/cursorLocalLauncher.ts:6-17`, modified by replacing the trailing `return {}` (silent fallback) with `throw new UnknownPermissionModeError(mode)`.
**Apply to:** `cli/src/agent/modeConfig.ts`.
**Reference D-99 + D-101:** `undefined` and `'default'` BOTH fall through to `{}`. Only non-undefined unknown strings throw.

### Pattern C — "Typed Error subclass with discriminator field"

**Source:** new in this phase — no in-repo error subclass with `readonly` field anchor exists (verified). Closest pattern is Node's built-in `Error` subclass idiom. RESEARCH §Code Examples documents the exact shape including `this.name` assignment.
**Apply to:** `shared/src/modes.ts` (`UnknownPermissionModeError`).
**Guard:** `instanceof UnknownPermissionModeError` + `error.offendingMode === expected` in the unit test (RESEARCH §Code Examples Test 1).

### Pattern D — "Type-only import path swap"

**Source:** the four import lines being updated (`loop.ts:8`, `session.ts:4`, `runCursor.ts:2`, and the two launcher files' upcoming import additions).
**Apply to:** all five callers — `import type { … } from './modes'` (or `import type { … } from '@/cursor/modes'` from outside the dir).
**Guard:** `bun typecheck` green after the swap. Pitfall 3: future contributors must NEVER re-add `import … from './loop'` for types.

### Pattern E — "JSDoc concept-position anchor"

**Source:** RESEARCH §Code Examples "Recommended JSDoc tag form".
**Apply to:** `AgentSessionBase`, `BaseLocalLauncher`, `RemoteLauncherBase`, `localLaunchPolicy.ts`.
**Stable grep anchor:** `@implements (SessionContext|LocalAdapter|RemoteAdapter|LaunchPolicy) \(Phase 6 SC#1\)` — counted ≥ 4 by the source-guard script (Pattern shown in script extension above).

### Pattern F — "Args-array shape assertion test" (used in both new launcher tests)

**Source:** `cli/src/runner/buildCliArgs.test.ts:5-50` — every assertion is `expect(args).toContain(...)` / `expect(args).not.toContain(...)` / `expect(args).toEqual(expect.arrayContaining([...]))`.
**Apply to:** `cursorRemoteLauncher.test.ts`, `cursorLocalLauncher.test.ts`.
**Why this style:** D-105 — no real `agent` spawn; assertion focuses purely on the args fragment passed downstream.

### Pattern G — "Phase ripgrep guard block, no whitelist growth"

**Source:** `scripts/check-no-cut-agents.sh:124-134` (Phase-5 block) + lines 98-104 (Phase-3 block) — same `if rg pattern; then exit 1; fi; echo ✅` shape.
**Apply to:** the Phase 6 extension block (shown above).
**Convention (D-109):** no new whitelist entries; selectivity comes from scoping the search to `cli/src` and using exclusion patterns (e.g. `grep -v 'cli/src/agent/modeConfig\.ts'`).

---

## No Analog Found

None. Every NEW file has a direct in-repo analog (often the file being decomposed). The error-class pattern (Pattern C) is the only "fresh" shape, and its template is documented verbatim in RESEARCH §Code Examples.

---

## Metadata

**Analog search scope:** `cli/src/cursor/`, `cli/src/agent/`, `cli/src/runner/`, `cli/src/modules/common/`, `shared/src/`, `scripts/`.
**Files scanned (full reads):** 11 (`loop.ts`, `session.ts`, `cursorLocalLauncher.ts`, `cursorRemoteLauncher.ts`, `cursorLocal.ts`, `runCursor.ts`, `sessionBase.ts`, `BaseLocalLauncher.ts`, `RemoteLauncherBase.ts`, `localLaunchPolicy.ts`, `shared/src/modes.ts`) + partial reads of `buildCliArgs.test.ts`, `check-no-cut-agents.sh`.
**Pattern extraction date:** 2026-05-22

## PATTERN MAPPING COMPLETE

**Phase:** 6 - agent-runtime-shared-kit-mode-hardening
**Files classified:** 17 (4 NEW source/test + 12 MODIFIED source + 1 MODIFIED guard script)
**Analogs found:** 17 / 17

### Coverage
- Files with exact analog: 16
- Files with role-match analog: 1 (`cursorLocalLauncher.test.ts` — mock-spawn style is a composite of two existing test patterns)
- Files with no analog: 0

### Key Patterns Identified
1. **Leaf module + type re-export** breaks the 3 madge cycles by removing the only reverse edge (`session.ts → loop.ts`). The leaf-module precedent (`localLaunchPolicy.ts`) already exists; `modes.ts` is its sibling.
2. **Pure-fn transform lift** — the duplicated `permissionModeToCursorArgs` / `permissionModeToAgentArgs` collapses into a single 5-branch function in `modeConfig.ts`; only behavioral change is `return {}` → `throw UnknownPermissionModeError` on unknown non-undefined input.
3. **Typed-error subclass with `offendingMode` discriminator** in `shared/` enables future cross-tier `instanceof` checks (Phase 7 hub-side SSE validation will reuse it).
4. **Args-array shape assertion** (`buildCliArgs.test.ts` idiom) is the canonical test pattern for both new launcher tests — no process I/O mocking required.
5. **JSDoc concept-position anchors** (`@implements SessionContext|LocalAdapter|RemoteAdapter|LaunchPolicy (Phase 6 SC#1)`) provide ripgrep-verifiable SC#1 coverage without renaming files.
6. **Phase-block ripgrep guard extension** follows the established Phase-3/4/5 inline-block precedent in `scripts/check-no-cut-agents.sh`; the new madge invocation is wired into the same script for one-stop CI validation.

### File Created
`.planning/phases/06-agent-runtime-shared-kit-mode-hardening/06-PATTERNS.md`

### Ready for Planning
Pattern mapping complete. Planner can reference analog file:line excerpts directly in PLAN.md action sections. The 4-slice execution order from CONTEXT D-107 maps cleanly onto the pattern groupings (slice 1 = Patterns A + D; slice 2 = Patterns B + C; slice 3 = remove duplicates per Patterns B / D; slice 4 = Patterns E + F + G).
