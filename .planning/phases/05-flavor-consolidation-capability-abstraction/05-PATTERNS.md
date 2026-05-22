# Phase 5: Flavor consolidation + capability abstraction — Pattern Map

**Mapped:** 2026-05-22
**Files analyzed:** ~80 (driven by call-site inventory in 05-RESEARCH.md §"Call-site inventory")
**Analogs found:** in-repo analogs for every role; full coverage

This phase is dominated by **in-place evolution of existing files** (`shared/src/flavors.ts`, `shared/src/modes.ts`, `scripts/check-no-cut-agents.sh`) plus mechanical call-site rewrites driven by the TypeScript compiler. The closest analogs are therefore the **current versions of the files themselves** (showing the shape that must be preserved at the public-API boundary) plus prior-phase patterns for guard scripts and deletion discipline.

## File Classification

| Role | Representative File(s) | Data Flow | Closest Analog | Match Quality |
|------|------------------------|-----------|----------------|---------------|
| capability-table-source | `shared/src/flavors.ts` | type-level table lookup | current `shared/src/flavors.ts` (Set→Record shape evolution in place) | exact (self) |
| capability-table-source | `shared/src/modes.ts` | type-level constants + helpers | current `shared/src/modes.ts` (delete non-cursor blocks; rewire helpers) | exact (self) |
| capability-table-source | `shared/src/schemas.ts`, `shared/src/resume.ts`, `shared/src/types.ts` | Zod schema narrow + re-export trim | current files (line-targeted delete) | exact (self) |
| test (capability) | `shared/src/flavors.test.ts` | unit (bun:test) | current `shared/src/flavors.test.ts` + Phase 04 unit test pattern | exact (self, rewrite) |
| capability-consumer (web context window) | `web/src/chat/modelConfig.ts` (+`.test.ts`) | type-level lookup at render | current modelConfig.ts branch chain → `getCapability(flavor, 'contextBudgetTokens')` | exact (self) |
| capability-consumer (web permission tone) | `web/src/components/ToolCard/PermissionFooter.tsx` | type-level lookup at render | current `isCodexSession` helper → `getCapability(flavor, 'permissionToneCopy')` | exact (self) |
| capability-consumer (cli slash commands) | `cli/src/modules/common/slashCommands.ts` (+`.test.ts`) | switch → table lookup | current `getUserCommandsDir` / `getProjectCommandsDir` switches | exact (self) |
| capability-consumer (hub flavor resolve) | `hub/src/sync/syncEngine.ts` | constant collapse | current `resolveFlavor` / `resolveAgentResumeId` (degenerate ternary) | exact (self) |
| capability-consumer (web AssistantChat) | `web/src/components/AssistantChat/{StatusBar,HappyComposer}.tsx`, `web/src/components/SessionChat.tsx`, `web/src/hooks/mutations/useSessionActions.ts`, `web/src/api/client.ts`, `web/src/types/api.ts` | DCE + import-narrow | each file's own existing capability-lookup site (e.g. `isPermissionModeAllowedForFlavor`) | exact (self) |
| capability-consumer (defaults `?? 'claude'`) | `hub/src/web/routes/{sessions,permissions,machines}.ts`, `hub/src/sync/rpcGateway.ts`, `web/src/router.tsx`, `web/src/components/SessionList.tsx`, `web/src/hooks/mutations/useSpawnSession.ts`, `cli/src/runner/run.ts`, `cli/src/modules/common/rpcTypes.ts` | literal collapse | grep-driven `?? 'claude'` → `?? 'cursor'` replacements | role-match |
| deletion-candidate (dead renderers) | `web/src/components/ToolCard/codexAgents.ts`, `web/src/components/ToolCard/views/CodexDiffView.tsx`, `views/CodexPatchView.tsx`, codex result views in `views/_results.tsx`, `web/src/components/AssistantChat/{codexReasoningEffortOptions,claudeEffortOptions,claudeModelOptions}.ts`, `web/src/components/AssistantChat/messages/CodexReviewCard.tsx`, `web/src/components/NewSession/{AgentSelector,ClaudeEffortSelector,ReasoningEffortSelector,OpencodeModelSelector,opencodeModelsGate,preferences}.ts(x)`, `web/src/hooks/queries/useCodexModels.ts`, `cli/src/ui/ink/CodexDisplay.tsx` | file-delete | Phase 04 tunnel/relay deletion (`hub/src/tunnel/`, `hub/tools/tunwg/`, `hub/scripts/download-tunwg.ts`) | role-match |
| capability-consumer (wire constant import) | `web/src/lib/message-window-store.ts` (+test), `web/src/chat/normalizeAgent.ts`, `web/src/chat/normalize.test.ts`, `hub/src/sync/sessionModel.test.ts`, `web/src/chat/reducer.test.ts`, `web/src/chat/reducerCliOutput.test.ts` | literal → constant import | existing `import { AGENT_MESSAGE_PAYLOAD_TYPE } from '@hapi/protocol'` sites (already used in cli `apiSession.ts:12`) | role-match |
| source-guard | `scripts/check-no-cut-agents.sh` | batch source scan | current Phase 1–4 guard (extend, do not rewrite shape) | exact (self) |

## Pattern Assignments

### `shared/src/flavors.ts` (capability-table-source, type-level table lookup)

**Analog:** current `shared/src/flavors.ts` — preserve every public export signature so call-site churn stays at zero outside the targeted consumers (D-75).

**Imports / type wiring pattern** (lines 1–9): keep one-line type import from `./modes`; replace the `Capabilities` const + `Capability` union with the new `FlavorCapabilities` type. `Capability` (flag-set) goes away once `hasCapability` is rewritten on the Record.

```1:9:shared/src/flavors.ts
import type { AgentFlavor } from './modes'

// --- Capability constants (prevent literal scattering) ---
export const Capabilities = {
    ModelChange: 'model-change',
    Effort: 'effort',
} as const

export type Capability = typeof Capabilities[keyof typeof Capabilities]
```

**Table shape pattern to evolve** (lines 11–18): the existing `Record<AgentFlavor, ReadonlySet<Capability>>` is the exact analog for the target `Record<AgentFlavor, FlavorCapabilities>`. Keep the `Record<AgentFlavor, _>` outer shape; replace `Set<Capability>` with `FlavorCapabilities` object literal; collapse five rows to one `cursor` row.

```11:18:shared/src/flavors.ts
// --- Per-flavor capability sets ---
const FLAVOR_CAPS: Record<AgentFlavor, ReadonlySet<Capability>> = {
    claude: new Set([Capabilities.ModelChange, Capabilities.Effort]),
    gemini: new Set([Capabilities.ModelChange]),
    codex: new Set([Capabilities.ModelChange]),
    cursor: new Set([]),
    opencode: new Set([Capabilities.ModelChange]),
}
```

**Target table shape (per D-72 / D-73, illustrative):**

```typescript
import { CURSOR_PERMISSION_MODES, type PermissionMode } from './modes'

export type FlavorCapabilities = {
    readonly permissionModes: readonly PermissionMode[]
    readonly supportsModelChange: boolean
    readonly supportsEffort: boolean
    readonly contextBudgetTokens: number | null
    readonly userSlashCommandsDir: ((homedir: string) => string | null) | null
    readonly projectSlashCommandsDir: ((projectDir: string) => string | null) | null
    readonly permissionToneCopy: 'cursor' | 'codex'
}

const FLAVOR_CAPS: Record<AgentFlavor, FlavorCapabilities> = {
    cursor: {
        permissionModes: CURSOR_PERMISSION_MODES,
        supportsModelChange: false,
        supportsEffort: false,
        contextBudgetTokens: null,
        userSlashCommandsDir: null,
        projectSlashCommandsDir: null,
        permissionToneCopy: 'cursor',
    },
}
```

**Labels pattern** (lines 20–27): same `Record<AgentFlavor, string>` shape; collapse to single `cursor: 'Cursor'` row. `'Unknown'` fallback in `getFlavorLabel` is preserved verbatim per D-83.

```20:27:shared/src/flavors.ts
// --- Flavor display names ---
const FLAVOR_LABELS: Record<AgentFlavor, string> = {
    claude: 'Claude',
    gemini: 'Gemini',
    codex: 'Codex',
    cursor: 'Cursor',
    opencode: 'OpenCode',
}
```

**Type-guard pattern to preserve** (lines 30–32): `isKnownFlavor` keeps `Object.hasOwn(FLAVOR_CAPS, flavor)` test — works identically whether `FLAVOR_CAPS` is a `Set` map or a `FlavorCapabilities` map.

```30:32:shared/src/flavors.ts
export function isKnownFlavor(flavor: string | null | undefined): flavor is AgentFlavor {
    return typeof flavor === 'string' && Object.hasOwn(FLAVOR_CAPS, flavor)
}
```

**Compat helper rewrite pattern** (lines 34–51): keep signatures verbatim; internals switch from `Set.has(cap)` to direct slot reads. Example target:

```typescript
export function supportsModelChange(flavor: string | null | undefined): boolean {
    const caps = getCapabilities(flavor)
    return caps?.supportsModelChange ?? false
}
```

**Lookup helpers to ADD (D-75):**

```typescript
export function getCapabilities(flavor: string | null | undefined): FlavorCapabilities | null {
    return isKnownFlavor(flavor) ? FLAVOR_CAPS[flavor] : null
}

export function getCapability<K extends keyof FlavorCapabilities>(
    flavor: string | null | undefined,
    key: K,
): FlavorCapabilities[K] | null {
    const caps = getCapabilities(flavor)
    return caps ? caps[key] : null
}
```

**Deletion target** (lines 53–55): `isCodexFamilyFlavor` deleted entirely (D-82) — no replacement helper; consumers read `getCapability(flavor, 'permissionToneCopy') === 'codex'`.

```53:55:shared/src/flavors.ts
export function isCodexFamilyFlavor(flavor: string | null | undefined): boolean {
    return flavor === 'codex' || flavor === 'gemini' || flavor === 'opencode'
}
```

---

### `shared/src/modes.ts` (capability-table-source, type-level constants + helpers)

**Analog:** current `shared/src/modes.ts` — narrow the `AgentFlavor` union, delete non-cursor permission-mode blocks, collapse helper branches.

**Wire-literal preservation pattern** (lines 1–6): `AGENT_MESSAGE_PAYLOAD_TYPE = 'codex' as const` stays (D-81). Extend the JSDoc with an anchor tag the guard's post-filter pins on.

```1:6:shared/src/modes.ts
/**
 * @description The legacy payload type identifier used for all generic agent messages.
 * Changing this value will affect the communication schema between CLI, Hub, and Web.
 * A migration plan is required if this literal is ever modified.
 */
export const AGENT_MESSAGE_PAYLOAD_TYPE = 'codex' as const
```

**Constants to DELETE in lockstep** (lines 8–21): five sibling `*_PERMISSION_MODES` blocks; only `CURSOR_PERMISSION_MODES` survives. Same shape pattern means deletion is mechanical.

```8:21:shared/src/modes.ts
export const CLAUDE_PERMISSION_MODES = ['default', 'acceptEdits', 'bypassPermissions', 'plan'] as const
export type ClaudePermissionMode = typeof CLAUDE_PERMISSION_MODES[number]

export const CODEX_PERMISSION_MODES = ['default', 'read-only', 'safe-yolo', 'yolo'] as const
export type CodexPermissionMode = typeof CODEX_PERMISSION_MODES[number]

export const CODEX_COLLABORATION_MODES = ['default', 'plan'] as const
export type CodexCollaborationMode = typeof CODEX_COLLABORATION_MODES[number]

export const GEMINI_PERMISSION_MODES = ['default', 'read-only', 'safe-yolo', 'yolo'] as const
export type GeminiPermissionMode = typeof GEMINI_PERMISSION_MODES[number]

export const OPENCODE_PERMISSION_MODES = ['default', 'yolo'] as const
export type OpencodePermissionMode = typeof OPENCODE_PERMISSION_MODES[number]
```

**Cursor constant to KEEP verbatim** (lines 23–24) — feeds `FlavorCapabilities.permissionModes`:

```23:24:shared/src/modes.ts
export const CURSOR_PERMISSION_MODES = ['default', 'plan', 'ask', 'yolo'] as const
export type CursorPermissionMode = typeof CURSOR_PERMISSION_MODES[number]
```

**Superset narrow pattern** (lines 26–36): `PERMISSION_MODES` collapses to the four Cursor modes; `PermissionMode` becomes an alias of `CursorPermissionMode` (D-78 condition met per RESEARCH §"Surprises" #9). `PERMISSION_MODE_LABELS` / `PERMISSION_MODE_TONES` similarly collapse from 8 entries to 4 — keep the `Record<PermissionMode, _>` shape.

```26:36:shared/src/modes.ts
export const PERMISSION_MODES = [
    'default',
    'acceptEdits',
    'bypassPermissions',
    'plan',
    'ask',
    'read-only',
    'safe-yolo',
    'yolo'
] as const
export type PermissionMode = typeof PERMISSION_MODES[number]
```

**Union narrow pattern** (line 38): single-line edit — 5-literal union → single literal. This is the leverage point; the TS compiler maps slice 2/3 from here.

```38:38:shared/src/modes.ts
export type AgentFlavor = 'claude' | 'codex' | 'gemini' | 'opencode' | 'cursor'
```

**Helper branch-to-table pattern** (lines 92–106): the per-flavor `if` chain in `getPermissionModesForFlavor` is the exact shape every other consumer reproduces. Replace the chain with a single capability lookup. Public signature preserved (D-77).

```92:106:shared/src/modes.ts
export function getPermissionModesForFlavor(flavor?: string | null): readonly PermissionMode[] {
    if (flavor === 'codex') {
        return CODEX_PERMISSION_MODES
    }
    if (flavor === 'gemini') {
        return GEMINI_PERMISSION_MODES
    }
    if (flavor === 'opencode') {
        return OPENCODE_PERMISSION_MODES
    }
    if (flavor === 'cursor') {
        return CURSOR_PERMISSION_MODES
    }
    return CLAUDE_PERMISSION_MODES
}
```

**Target rewrite (illustrative):**

```typescript
import { getCapability } from './flavors'

export function getPermissionModesForFlavor(flavor?: string | null): readonly PermissionMode[] {
    return getCapability(flavor, 'permissionModes') ?? CURSOR_PERMISSION_MODES
}
```

Note: `flavors.ts` imports `CURSOR_PERMISSION_MODES` from `modes.ts`, and `modes.ts` would now import `getCapability` from `flavors.ts`. Resolve the circular by inlining the cursor default literal in the fallback OR by hoisting `CURSOR_PERMISSION_MODES` into `flavors.ts`. Planner picks — see D-79 ("planner may rename if cleaner").

**Codex collaboration deletion targets** (lines 14–15, 70–78, 88–90, 120–125): entire `CodexCollaborationMode*` surface deleted in Slice 1b (after web consumers stop importing it in Slice 2c). See Risk 5 in RESEARCH.

---

### `shared/src/flavors.test.ts` (test, unit)

**Analog:** current `shared/src/flavors.test.ts` — keep the bun:test idiom and `describe`/`test` grouping; rewrite assertions to the cursor + unknown matrix per D-87.

**Test framework + import pattern** (lines 1–9): identical shape, just narrow the import list (drop `Capabilities` if `hasCapability` keys collapse) and add `getCapabilities` / `getCapability`.

```1:9:shared/src/flavors.test.ts
import { describe, expect, test } from 'bun:test'
import {
    Capabilities,
    getFlavorLabel,
    hasCapability,
    isKnownFlavor,
    supportsEffort,
    supportsModelChange,
} from './flavors'
```

**Per-flavor matrix pattern to REPLACE** (lines 11–48): the current 5-flavor matrix collapses to cursor-only + unknown fallback. Mirror the same `describe('hasCapability', () => { test(...) })` grouping; just delete claude/codex/gemini/opencode test cases.

```11:23:shared/src/flavors.test.ts
describe('hasCapability', () => {
    test('claude supports model-change', () => {
        expect(hasCapability('claude', Capabilities.ModelChange)).toBe(true)
    })

    test('claude supports effort', () => {
        expect(hasCapability('claude', Capabilities.Effort)).toBe(true)
    })

    test('gemini supports model-change but not effort', () => {
        expect(hasCapability('gemini', Capabilities.ModelChange)).toBe(true)
        expect(hasCapability('gemini', Capabilities.Effort)).toBe(false)
    })
```

**Unknown / null fallback pattern to PRESERVE** (lines 40–47, 59–66, 78–82): exact shape kept — these assertions become the bulk of the new file.

```40:47:shared/src/flavors.test.ts
    test('unknown flavor returns false', () => {
        expect(hasCapability('unknown-flavor', Capabilities.ModelChange)).toBe(false)
    })

    test('null/undefined flavor returns false', () => {
        expect(hasCapability(null, Capabilities.ModelChange)).toBe(false)
        expect(hasCapability(undefined, Capabilities.ModelChange)).toBe(false)
    })
```

**Target case list:** RESEARCH §"Capability-lookup focused unit test" enumerates 23 cases — planner ports each directly into the same `describe`/`test` shape.

---

### `web/src/chat/modelConfig.ts` (capability-consumer, type-level lookup at render)

**Analog:** itself — the file's existing branch chain shows the exact shape that must collapse into one capability lookup.

**Branch pattern to COLLAPSE** (lines 20–47): four-branch decision tree (`flavor === 'codex'` → codex window; `flavor !== 'claude'` → null; model-aware claude window; default claude window) → one `getCapability` read.

```20:47:web/src/chat/modelConfig.ts
export function getContextBudgetTokens(model: string | null | undefined, flavor?: string | null): number | null {
    if (flavor === 'codex') {
        return Math.max(1, DEFAULT_CODEX_CONTEXT_WINDOW_TOKENS - CONTEXT_HEADROOM_TOKENS)
    }

    if (flavor !== 'claude') {
        return null
    }

    const trimmedModel = model?.trim()
    const windowTokens = (() => {
        if (!trimmedModel) {
            return DEFAULT_CLAUDE_CONTEXT_WINDOW_TOKENS
        }
        if (isClaudeModelPreset(trimmedModel)) {
            return trimmedModel.endsWith('[1m]')
                ? LARGE_CLAUDE_CONTEXT_WINDOW_TOKENS
                : DEFAULT_CLAUDE_CONTEXT_WINDOW_TOKENS
        }
        if (trimmedModel.startsWith('claude-')) {
            return DEFAULT_CLAUDE_CONTEXT_WINDOW_TOKENS
        }
        return null
    })()

    if (!windowTokens) return null
    return Math.max(1, windowTokens - CONTEXT_HEADROOM_TOKENS)
}
```

**Target shape** (per RESEARCH §"Code Examples"):

```typescript
import { getCapability } from '@hapi/protocol'

const CONTEXT_HEADROOM_TOKENS = 10_000

export function getContextBudgetTokens(_model: string | null | undefined, flavor?: string | null): number | null {
    const windowTokens = getCapability(flavor, 'contextBudgetTokens')
    if (windowTokens === null) return null
    return Math.max(1, windowTokens - CONTEXT_HEADROOM_TOKENS)
}
```

Constants `DEFAULT_CLAUDE_CONTEXT_WINDOW_TOKENS` / `LARGE_CLAUDE_CONTEXT_WINDOW_TOKENS` / `DEFAULT_CODEX_CONTEXT_WINDOW_TOKENS` deleted; `isClaudeModelPreset` import dropped (verify no other web consumer — `web/src/lib/sessionModelLabel.test.ts` may also reference; see RESEARCH A6).

**Test rewrite pattern** (`web/src/chat/modelConfig.test.ts`): rewrite to two cases — `getContextBudgetTokens(*, 'cursor') === null` and `getContextBudgetTokens(*, 'unknown') === null`. Drop the per-claude-model matrix entirely.

---

### `web/src/components/ToolCard/PermissionFooter.tsx` (capability-consumer, type-level lookup at render)

**Analog:** itself — `isCodexSession` is the exact shape that collapses to a capability read.

**Helper pattern to DELETE** (lines 25–28): the codex-family + toolName-prefix double-OR is what `permissionToneCopy` replaces.

```25:28:web/src/components/ToolCard/PermissionFooter.tsx
function isCodexSession(metadata: SessionMetadataSummary | null, toolName: string): boolean {
    return isCodexFamilyFlavor(metadata?.flavor)
        || toolName.startsWith('Codex')
}
```

**Branch consumer pattern to DELETE** (lines 34–40, plus codex JSX block lines 215–238, `codexApprove` / `codexAbort` lines 171–189, `!codex` guards lines 138–139): the entire codex tone-copy branch dead-eliminates once `permissionToneCopy === 'codex'` is always false. Per RESEARCH §"Surprises" #9, also drop the `permission.mode === 'acceptEdits'` branch (line 43) + the `'acceptEdits'` argument in any `approvePermission` call (line 151).

**Target shape:**

```typescript
import { getCapability } from '@hapi/protocol'

const tone = getCapability(metadata?.flavor, 'permissionToneCopy') ?? 'cursor'
// `tone === 'codex'` is always false for cursor — planner DCEs the codex JSX subtree.
```

Per CONTEXT.md "Claude's Discretion" + RESEARCH §"Surprises" #10: `toolName.startsWith('Codex')` fallback is unreachable post-Phase-1 — drop the OR-branch entirely to meet D-84#3.

---

### `cli/src/modules/common/slashCommands.ts` (capability-consumer, switch → table lookup)

**Analog:** itself — both `getUserCommandsDir` and `getProjectCommandsDir` are textbook switch-on-flavor patterns.

**Switch-on-flavor pattern to COLLAPSE** (lines 100–114, 120–130): identical shape — switch on `agent` literal, return path string from per-flavor env or join.

```100:114:cli/src/modules/common/slashCommands.ts
function getUserCommandsDir(agent: string): string | null {
    switch (agent) {
        case 'claude': {
            const configDir = process.env.CLAUDE_CONFIG_DIR ?? join(homedir(), '.claude');
            return join(configDir, 'commands');
        }
        case 'codex': {
            const codexHome = process.env.CODEX_HOME ?? join(homedir(), '.codex');
            return join(codexHome, 'prompts');
        }
        default:
            // Gemini and other agents don't have user commands
            return null;
    }
}
```

**Target shape** (per RESEARCH §"Code Examples"):

```typescript
import { getCapability } from '@hapi/protocol';

function getUserCommandsDir(agent: string): string | null {
    const resolver = getCapability(agent, 'userSlashCommandsDir');
    return resolver ? resolver(homedir()) : null;
}

function getProjectCommandsDir(agent: string, projectDir: string): string | null {
    const resolver = getCapability(agent, 'projectSlashCommandsDir');
    return resolver ? resolver(projectDir) : null;
}
```

**Builtins map pattern to DELETE** (lines 27–56): the 4-entry `BUILTIN_COMMANDS` table is dead under cursor-only. Replace with `{ cursor: [] }` (D-73 explicitly leaves Cursor builtins empty) or drop the map entirely if `listSlashCommands` no longer consumes it.

**Plugin scan deletion** (line 263 `scanPluginCommands` per RESEARCH §"D. cli/"): the `if (agent !== 'claude') return []` early-return guard means the whole function is Claude-specific; delete the function + its caller per D-74 (no `pluginsDir` capability slot).

**Test rewrite pattern** (`slashCommands.test.ts`): replace 8 `'claude'`/`'codex'` literal cases with cursor-returns-null + unknown-returns-null. Same `describe`/`test` shape preserved.

---

### `hub/src/sync/syncEngine.ts` (capability-consumer, constant collapse)

**Analog:** itself — the degenerate `flavor === 'cursor' ? flavor : 'cursor'` ternary on line 393 is the canonical D-84#2 target.

**Degenerate-ternary pattern to COLLAPSE** (lines 391–406):

```391:406:hub/src/sync/syncEngine.ts
    private resolveFlavor(session: Session): AgentFlavor {
        const flavor = session.metadata?.flavor
        return flavor === 'cursor' ? flavor : 'cursor'
    }

    private resolveAgentResumeId(session: Session): string | null {
        const metadata = session.metadata
        if (!metadata) {
            return null
        }

        const flavor = this.resolveFlavor(session)
        if (flavor === 'cursor') return metadata.cursorSessionId ?? null

        return null
    }
```

**Target shape:** `resolveFlavor` returns `'cursor'` constant or is deleted (single caller, two lines net change). `resolveAgentResumeId` collapses to `return session.metadata?.cursorSessionId ?? null`.

**Default-param collapse pattern** (line 366): `agent: 'claude' | 'cursor' = 'claude'` → `agent: 'cursor' = 'cursor'` (or drop the param). Same shape appears in `hub/src/sync/rpcGateway.ts:125`, `hub/src/web/routes/sessions.ts:{149,297,335,365,449}`, `hub/src/web/routes/permissions.ts:59`, `web/src/router.tsx:340`, `web/src/components/SessionList.tsx:511`, `web/src/api/client.ts:445`, `web/src/hooks/mutations/useSpawnSession.ts:9`, `cli/src/runner/run.ts:{235,349,894,903}`, `cli/src/modules/common/rpcTypes.ts:7`. All collapse mechanically.

---

### Codex* renderer files (deletion-candidate, file-delete)

**Analog:** Phase 04 deletion discipline — `hub/src/tunnel/`, `hub/tools/tunwg/`, `hub/scripts/download-tunwg.ts` were deleted as whole subtrees with TS compiler driving consumer cleanup. Same playbook here.

**Registry-driven discovery pattern** (`web/src/components/ToolCard/views/_all.tsx:1–19, 38–123`): the `toolViewRegistry` / `toolFullViewRegistry` `Record<string, ToolViewComponent>` is the single registration point. Delete import + `CodexAgentView` definition + each `CodexDiff`/`CodexAgent`/`CodexPatch`/`spawn_agent`/`send_input`/`resume_agent`/`wait_agent`/`close_agent` row.

```1:19:web/src/components/ToolCard/views/_all.tsx
import type { ComponentType } from 'react'
import type { ToolCallBlock } from '@/chat/types'
import type { SessionMetadataSummary } from '@/types/api'
import { CodexDiffCompactView, CodexDiffFullView } from '@/components/ToolCard/views/CodexDiffView'
import { CodexPatchView } from '@/components/ToolCard/views/CodexPatchView'
import { EditView } from '@/components/ToolCard/views/EditView'
import { AskUserQuestionView } from '@/components/ToolCard/views/AskUserQuestionView'
import { RequestUserInputView } from '@/components/ToolCard/views/RequestUserInputView'
import { ExitPlanModeView } from '@/components/ToolCard/views/ExitPlanModeView'
import { MultiEditFullView, MultiEditView } from '@/components/ToolCard/views/MultiEditView'
import { TodoWriteView } from '@/components/ToolCard/views/TodoWriteView'
import { UpdatePlanView } from '@/components/ToolCard/views/UpdatePlanView'
import { WriteView } from '@/components/ToolCard/views/WriteView'
import { getInputStringAny } from '@/lib/toolInputUtils'
import {
    getCodexAgentFieldRows,
    getCodexAgentPrompt,
    summarizeCodexAgentResult
} from '@/components/ToolCard/codexAgents'
```

```76:114:web/src/components/ToolCard/views/_all.tsx
export const toolViewRegistry: Record<string, ToolViewComponent> = {
    Edit: EditView,
    MultiEdit: MultiEditView,
    Write: WriteView,
    TodoWrite: TodoWriteView,
    update_plan: UpdatePlanView,
    CodexDiff: CodexDiffCompactView,
    CodexAgent: CodexAgentView,
    spawn_agent: CodexAgentView,
    send_input: CodexAgentView,
    resume_agent: CodexAgentView,
    wait_agent: CodexAgentView,
    close_agent: CodexAgentView,
    AskUserQuestion: AskUserQuestionView,
    ExitPlanMode: ExitPlanModeView,
    ask_user_question: AskUserQuestionView,
    exit_plan_mode: ExitPlanModeView,
    request_user_input: RequestUserInputView
}
```

**Files to delete outright** (file paths only — body is the deletion target):

- `web/src/components/ToolCard/codexAgents.ts`
- `web/src/components/ToolCard/views/CodexDiffView.tsx`
- `web/src/components/ToolCard/views/CodexPatchView.tsx`
- `web/src/components/AssistantChat/codexReasoningEffortOptions.ts`
- `web/src/components/AssistantChat/claudeEffortOptions.ts` (+`.test.ts`)
- `web/src/components/AssistantChat/claudeModelOptions.ts` (+`.test.ts`)
- `web/src/components/AssistantChat/messages/CodexReviewCard.tsx` (+`.test.tsx`)
- `web/src/components/NewSession/AgentSelector.tsx`
- `web/src/components/NewSession/ClaudeEffortSelector.tsx`
- `web/src/components/NewSession/ReasoningEffortSelector.tsx`
- `web/src/components/NewSession/OpencodeModelSelector.tsx`
- `web/src/components/NewSession/opencodeModelsGate.ts` (+`.test.ts`)
- `web/src/components/NewSession/preferences.ts` (+`.test.ts`)
- `web/src/hooks/queries/useCodexModels.ts`
- `cli/src/ui/ink/CodexDisplay.tsx`

**Rationale anchor** (paste into PLAN per Risk 2 prevention): "verified unreachable — Cursor CLI runtime emits no `Codex*` tool names; `rg 'CodexAgent|CodexBash|CodexPatch|CodexDiff|CodexReasoning' cli/src/cursor/ shared/src/` returns zero hits post-Phase-1."

---

### `scripts/check-no-cut-agents.sh` (source-guard, batch source scan)

**Analog:** itself + the Phase 04 extension pattern (lines 134–183 of current script — Phase 4 added a sibling `PHASE4_HARD_PATTERN` + `PHASE4_WHITELIST` + dedicated `rg` invocation rather than mutating the original Phase 1 pattern).

**`rg` fallback pattern to PRESERVE** (lines 23–30) — verbatim:

```23:30:scripts/check-no-cut-agents.sh
if command -v rg >/dev/null 2>&1; then
  RG_BIN="rg"
elif [ -x "/usr/share/cursor/resources/app/node_modules/@vscode/ripgrep/bin/rg" ]; then
  RG_BIN="/usr/share/cursor/resources/app/node_modules/@vscode/ripgrep/bin/rg"
else
  echo "❌ ripgrep (rg) is required for source guards." >&2
  exit 1
fi
```

**Pattern + whitelist + invocation triplet pattern** (lines 32–46 + 148–157): one `PATTERN` constant, one `WHITELIST` array, one `rg` invocation with fail/success messages. Phase 5 reuses the existing `PATTERN='\b(claude|codex|gemini|opencode|...)\b'` — the work is **shrinking the whitelist**, not adding a new pattern (RESEARCH §"Ripgrep guard additions" #3).

```32:46:scripts/check-no-cut-agents.sh
PATTERN='\b(claude|codex|gemini|opencode|telegram|serverchan|elevenlabs|grammy)\b'
PHASE3_PATTERN='namespace|:ns'
PHASE3_SOURCE_DIRS=(cli/src hub/src web/src shared/src)
PHASE4_HARD_PATTERN='tunwg|HAPI_RELAY_|DANGEROUSLY_LOG_TO_SERVER_FOR_AI_AUTO_DEBUGGING'
PHASE4_SWEEP_PATTERN='relay-mode|relayMode|officialWebUrl|app\.hapi\.run|download-tunwg|--relay|--no-relay'
WHITELIST=(
  # === Infra (never agent code)
  --glob '!.planning/**'
  --glob '!CHANGELOG.md'
  --glob '!**/.gitignore'
  --glob '!node_modules/**'
  --glob '!dist/**'
  --glob '!bun.lock'
  --glob '!.git/**'
  --glob '!scripts/check-no-cut-agents.sh'
```

**Phase-5-territory whitelist entries to REMOVE** (lines 48–117): every `# === Phase-5 territory` glob — these are the files Phase 5 rewrites. The entire block collapses to zero entries.

```48:90:scripts/check-no-cut-agents.sh
  # === Phase-5 territory — shared union surface (owner: CUT-05)
  --glob '!shared/src/flavors.ts'                     # AgentFlavor union definition
  --glob '!shared/src/flavors.test.ts'
  --glob '!shared/src/modes.ts'                       # AGENT_MESSAGE_PAYLOAD_TYPE='codex' wire constant
  --glob '!shared/src/resume.ts'                      # session-resume types reference flavors
  --glob '!shared/src/resume.test.ts'                 # flavor fixtures
  --glob '!shared/src/schemas.ts'                     # *SessionId metadata fields (wire schema)
  --glob '!shared/src/sessionSummary.ts'              # *SessionId picker chain
  --glob '!shared/src/models.ts'                      # claude model presets (cursor inherits)
  --glob '!shared/src/models.test.ts'
  --glob '!shared/src/types.ts'                       # union/permission-mode re-exports
```

**Post-filter pattern for line-anchored exception** (per RESEARCH §"Ripgrep guard additions" `AGENT_MESSAGE_PAYLOAD_TYPE`, D-85): allow exactly one residue line.

```bash
SURVIVORS=$("$RG_BIN" -n -i "${WHITELIST[@]}" "$PATTERN" . || true)
SURVIVORS_FILTERED=$(echo "$SURVIVORS" \
  | grep -v "shared/src/modes.ts:.*AGENT_MESSAGE_PAYLOAD_TYPE = 'codex' as const" \
  || true)
if [ -n "$SURVIVORS_FILTERED" ]; then
  echo "$SURVIVORS_FILTERED"
  echo "❌ Non-Cursor literals leaked outside whitelist."
  exit 1
fi
```

**Phase-5 identifier sweep pattern** (NEW invocation, sibling to Phase 4 hard-pattern block at lines 167–183):

```bash
PHASE5_IDENTIFIER_PATTERN='\bisCodexFamilyFlavor\b|\bCodexCollaborationMode\b|\bgetCodexCollaboration\w*\b|\b(CLAUDE|CODEX|GEMINI|OPENCODE)_PERMISSION_MODES\b'
if "$RG_BIN" -n "$PHASE5_IDENTIFIER_PATTERN" cli/src hub/src web/src shared/src; then
  echo "❌ Phase-5 forbidden symbol survived collapse."
  exit 1
fi
echo "✅ No Phase-5 forbidden symbols in source scope."
```

**Phase-5 `flavor === '...'` non-cursor branch sweep** (NEW invocation):

```bash
# Disallow any 'flavor === literal'; post-filter to allow cursor narrow if needed.
FLAVOR_BRANCH=$("$RG_BIN" -n "flavor\s*===\s*['\"]" cli/src hub/src web/src shared/src || true)
FLAVOR_BRANCH_FILTERED=$(echo "$FLAVOR_BRANCH" | grep -v "=== 'cursor'" || true)
if [ -n "$FLAVOR_BRANCH_FILTERED" ]; then
  echo "$FLAVOR_BRANCH_FILTERED"
  echo "❌ flavor === '<non-cursor>' literal branch survived collapse."
  exit 1
fi
```

**Fail-message pattern to MIMIC** (lines 148–157):

```148:157:scripts/check-no-cut-agents.sh
if "$RG_BIN" -i "${WHITELIST[@]}" "$PATTERN" .; then
  echo ""
  echo "❌ Non-Cursor / external-channel literals found outside whitelist."
  echo "   Either rewrite the hit, or — if the hit is structurally tied to"
  echo "   the AgentFlavor union (Phase-5) — add an explicit whitelist entry"
  echo "   above (owner: CUT-05). Phase-12 docs/marketing surfaces are deferred"
  echo "   to the polish pass and already covered by the docs/website globs."
  exit 1
fi
echo "✅ No non-Cursor agent literals outside whitelist."
```

After Phase 5, the second `echo` ("structurally tied to the AgentFlavor union") is obsolete — rewrite the failure message to drop the "Phase-5" carve-out language and point only at Phase-12 docs deferral.

---

## Shared Patterns

### Capability Lookup at Call Site

**Source:** `shared/src/flavors.ts` (target `getCapability` / `getCapabilities`)
**Apply to:** every capability-consumer file — `web/src/chat/modelConfig.ts`, `web/src/components/ToolCard/PermissionFooter.tsx`, `cli/src/modules/common/slashCommands.ts`, `web/src/components/AssistantChat/{StatusBar,HappyComposer}.tsx`, `web/src/hooks/mutations/useSessionActions.ts`.

```typescript
import { getCapability } from '@hapi/protocol'

const value = getCapability(metadata?.flavor, 'permissionToneCopy') ?? 'cursor'
// Compare against capability value, never against flavor literal.
```

**Anti-pattern to remove** — every site that does `if (flavor === '<literal>')` or `switch (flavor) { case '<literal>': ... }` outside `'cursor'`. D-84#2 ripgrep guard enforces this.

### Wire Literal via Named Constant

**Source:** `shared/src/modes.ts::AGENT_MESSAGE_PAYLOAD_TYPE` (existing); already used in `cli/src/api/apiSession.ts:12`.
**Apply to:** every test / normalize / window-store file that currently uses bare `'codex'` string literal as a payload-type discriminator: `web/src/lib/message-window-store.ts:{426–434}`, `web/src/chat/normalizeAgent.ts:{735,746}`, `web/src/chat/normalize.test.ts:{532,543}`, `hub/src/sync/sessionModel.test.ts` (8 hits), `web/src/chat/reducer.test.ts:262`, `web/src/chat/reducerCliOutput.test.ts:2`, `web/src/lib/message-window-store.test.ts:{73,99}`.

```typescript
import { AGENT_MESSAGE_PAYLOAD_TYPE } from '@hapi/protocol'

// Before: payload.type === 'codex'
// After:  payload.type === AGENT_MESSAGE_PAYLOAD_TYPE
```

This drains every `'codex'` literal outside `shared/src/modes.ts:6` so the guard's post-filter has exactly one survivor.

### Default-Literal Collapse (`?? 'claude'` → `?? 'cursor'`)

**Source:** grep-driven, no formal helper.
**Apply to:** `hub/src/web/routes/{sessions,permissions}.ts`, `web/src/router.tsx:340`, `web/src/components/SessionList.tsx:{491–520}`, `cli/src/runner/run.ts:235`, every `(flavor ?? 'claude')` / `(agent ?? 'claude')` site enumerated in RESEARCH §"Call-site inventory".

```typescript
// Before
const flavor = sessionResult.session.metadata?.flavor ?? 'claude'
// After
const flavor = sessionResult.session.metadata?.flavor ?? 'cursor'
```

When the surrounding context is `flavor === 'cursor' ? flavor : 'cursor'` (RESEARCH Risk re D-84#2), collapse the entire ternary to the constant `'cursor'` literal.

### Deletion-First Cleanup (Whole-File / Whole-Subtree)

**Source:** Phase 04 — `hub/src/tunnel/`, `hub/tools/tunwg/`, `hub/scripts/download-tunwg.ts` deleted as whole units; TypeScript compiler drove consumer cleanup. Documented in `.planning/phases/04-cut-deployment-infrastructure/04-PATTERNS.md` §"Deletion-First TypeScript Cleanup".
**Apply to:** all files in the "deletion-candidate" classification row above (Codex* renderers, NewSession non-cursor selectors, `useCodexModels`, `CodexDisplay.tsx`).

Process: delete the file → run `bun typecheck` → for each compile error, either delete the importer or null out the use site. Do NOT leave no-op stubs (D-22/D-32 precedent from Phase 02; Phase 04 §"Deletion-First").

### Compiler-Driven Call-Site Discovery

**Source:** RESEARCH §"Pattern: TypeScript-compiler-driven call-site discovery" + Phase 04 §"Deletion-First TypeScript Cleanup"
**Apply to:** every slice. After narrowing `AgentFlavor = 'cursor'` in `shared/src/modes.ts:38`, run `bun typecheck` and let the error list dimension Slices 2/3 (RESEARCH §"Compile-blast radius" + Risk 1 prevention).

Recommended: capture the error list to a transient artifact (e.g. `.planning/phases/05-.../05-COMPILE-ERRORS.md`) between Slice 1 and Slice 2 to make the inventory auditable.

### Guard-Script Extension (New Sibling Block, Not In-Place Mutation)

**Source:** Phase 04 added `PHASE4_HARD_PATTERN` / `PHASE4_SWEEP_PATTERN` / `PHASE4_WHITELIST` as sibling blocks (current script lines 134–183) rather than mutating the original Phase 1 pattern.
**Apply to:** `scripts/check-no-cut-agents.sh` Phase 5 additions — new `PHASE5_IDENTIFIER_PATTERN` block + new `flavor === '...'` post-filter, each with its own `rg` invocation and ✅/❌ message pair. The shared `PATTERN` line stays untouched; the change is whitelist removal + post-filter wrap.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| (none) | — | — | Every file in scope has either itself or a Phase 1–4 sibling as a direct in-repo analog. The phase has no greenfield files. |

---

## Metadata

**Analog search scope:** `shared/src/`, `cli/src/modules/common/`, `cli/src/runner/`, `cli/src/api/`, `cli/src/ui/ink/`, `hub/src/sync/`, `hub/src/web/routes/`, `hub/src/notifications/`, `web/src/chat/`, `web/src/components/ToolCard/`, `web/src/components/AssistantChat/`, `web/src/components/NewSession/`, `web/src/hooks/`, `web/src/api/`, `web/src/lib/`, `web/src/types/`, `scripts/`, `.planning/phases/04-cut-deployment-infrastructure/04-PATTERNS.md` (Phase 04 deletion + guard precedent), `.planning/phases/01-cut-non-cursar-agents/01-04-SUMMARY.md` (carry-over scope).
**Files scanned (read):** 9 representative analogs + Phase 04 PATTERNS.md for the guard-extension pattern. Remaining ~70 files in the call-site inventory share the same in-place rewrite shape catalogued under the four pattern categories above (Capability Lookup, Wire Constant, Default Collapse, File Deletion).
**Pattern extraction date:** 2026-05-22

## PATTERN MAPPING COMPLETE

**Phase:** 5 — Flavor consolidation + capability abstraction
**Files classified:** ~80 (full call-site inventory inherited from 05-RESEARCH.md)
**Analogs found:** ~80 / ~80 (every file's analog is itself or a Phase 04 sibling)

### Coverage
- Files with exact analog (in-place evolution / file-self): ~70 (capability-table sources, all single-line-edit call sites, the guard script)
- Files with role-match analog (Phase 04 deletion precedent): ~15 (Codex* renderers, NewSession non-cursor selectors)
- Files with no analog: 0

### Key Patterns Identified
- **Capability Lookup at Call Site** — every consumer reads `getCapability(flavor, key)` instead of `if (flavor === '<literal>')`. Replaces D-84#2 hardcoded branches across `web/`, `cli/`, and `hub/`.
- **Wire Literal via Named Constant** — every `'codex'` payload-type literal outside `shared/src/modes.ts:6` is rewritten as `AGENT_MESSAGE_PAYLOAD_TYPE` import (precedent: `cli/src/api/apiSession.ts:12`), so the guard post-filter has exactly one survivor.
- **Deletion-First Cleanup** — Codex* renderer files and NewSession non-cursor selectors are deleted whole; TypeScript compiler drives consumer cleanup (Phase 04 §"Deletion-First TypeScript Cleanup" precedent).
- **Guard-Script Extension as Sibling Block** — `scripts/check-no-cut-agents.sh` Phase 5 additions follow Phase 04's `PHASE4_*` triplet shape (separate pattern constant, separate post-filter, separate rg invocation with its own ✅/❌ message).
- **Default-Literal Collapse** — every `?? 'claude'` / `'claude' | 'cursor'` union site collapses to the `'cursor'` constant; same shape across ~15 hub/web/cli call sites.

### File Created
`.planning/phases/05-flavor-consolidation-capability-abstraction/05-PATTERNS.md`

### Ready for Planning
Pattern mapping complete. Planner can reference: (1) `shared/src/flavors.ts` line-anchored excerpts for the Set→Record evolution that preserves all public helper signatures; (2) `shared/src/modes.ts` excerpts for the constant-block deletion + helper rewrite shape; (3) `web/src/chat/modelConfig.ts`, `web/src/components/ToolCard/PermissionFooter.tsx`, `cli/src/modules/common/slashCommands.ts`, `hub/src/sync/syncEngine.ts` as the canonical capability-consumer rewrites (one per slice); (4) Phase 04 `04-PATTERNS.md` §"Deletion-First TypeScript Cleanup" + `scripts/check-no-cut-agents.sh` lines 134–183 for the deletion-first and guard-extension precedents; (5) `web/src/components/ToolCard/views/_all.tsx:76–114` registry rows showing the exact deletion targets for the Codex* renderer purge.
