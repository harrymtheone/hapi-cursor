# Phase 9: Web internal decoupling - Pattern Map

**Mapped:** 2026-05-23
**Files analyzed:** 28 (new + modified)
**Analogs found:** 27 / 28 (1 file — `_factory.ts` — has no perfect analog; nearest hook copied verbatim)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `web/src/lib/message-window-store.ts` (retained as facade) | facade / module | re-export | `hub/src/sync/sessionCache.ts` (P8 D-129) | exact (intent); shape differs (re-export vs class composition) |
| `web/src/lib/messageWindowState.ts` (NEW) | state-shape module | in-memory store | `hub/src/sync/sessionRepository.ts` (P8 D-129 — owns Maps siblings share) | exact (role: shared-state owner) |
| `web/src/lib/messageWindowPaginationService.ts` (NEW) | service | request-response + transform | `hub/src/sync/sessionLivenessService.ts` (P8) | role-match |
| `web/src/lib/messageWindowMergeService.ts` (NEW) | service | event-driven (SSE merge) | `hub/src/sync/sessionMergeService.ts` (P8) | role-match |
| `web/src/lib/messageWindowSubscriptions.ts` (NEW) | service | pub-sub | `hub/src/sync/sessionLivenessService.ts` (P8) | role-match |
| `web/src/lib/messageWindowPersistence.ts` (NEW, Q8 Option A) | service | file-I/O (sessionStorage) | `hub/src/sync/sessionConfigService.ts` (P8) | role-match |
| `web/src/lib/fuzzyMatch.ts` (NEW) | utility | pure | `web/src/lib/randomId.ts` | exact |
| `shared/src/uploads.ts` (NEW) | utility | pure | `shared/src/utils.ts` + `shared/src/modes.ts` | exact |
| `web/src/components/SessionList.tsx` (refactored orchestrator) | component (orchestrator) | request-response | `web/src/components/NewSession/index.tsx` | exact |
| `web/src/components/SessionList/SessionListHeader.tsx` (NEW) | component (sub) | request-response | `web/src/components/NewSession/ActionButtons.tsx` | exact |
| `web/src/components/SessionList/SessionListSearch.tsx` (NEW) | component (sub) | request-response | `web/src/components/NewSession/MachineSelector.tsx` | exact |
| `web/src/components/SessionList/SessionListItem.tsx` (NEW) | component (sub) | request-response | `web/src/components/NewSession/SessionTypeSelector.tsx` | exact |
| `web/src/components/SessionList/SessionListEmpty.tsx` (NEW) | component (sub) | request-response | `web/src/components/NewSession/YoloToggle.tsx` (tiny presentational sibling) | role-match |
| `web/src/components/SessionList/useSessionList{Data,Search,Selection,Keyboard}.ts` (NEW) | hooks | request-response | `web/src/hooks/useDirectorySuggestions.ts` (NewSession-consumed hook pattern) | role-match |
| `web/src/routes/settings/index.tsx` (refactored orchestrator) | route entry | request-response | `web/src/components/NewSession/index.tsx` | role-match (orchestrator pattern; route entry vs component) |
| `web/src/routes/settings/_sections/{Language,Display,Chat,About}Section.tsx` (NEW) | component (sub) | request-response | `web/src/components/NewSession/{ActionButtons,MachineSelector,…}.tsx` | exact |
| `web/src/routes/settings/useSettingsState.ts` (NEW) | hook | request-response | `web/src/hooks/useDirectorySuggestions.ts` | role-match |
| `web/src/components/AssistantChat/HappyComposer.tsx` (refactored orchestrator) | component (orchestrator) | request-response | `web/src/components/NewSession/index.tsx` (orchestrator) + existing `HappyComposer.tsx` siblings (`StatusBar`, `ComposerButtons`, `AttachmentItem`) | exact (siblings already extracted; same template) |
| `web/src/components/AssistantChat/HappyComposerOverlays.tsx` (NEW) | component (sub) | request-response | `web/src/components/AssistantChat/StatusBar.tsx` (sibling co-located helper) | exact |
| `web/src/components/AssistantChat/useHappyComposer{State,Handlers}.ts` (NEW) | hooks | request-response | `web/src/hooks/useDirectorySuggestions.ts` (lifted-state hook pattern) | role-match |
| `web/src/components/ToolCard/views/_results.tsx` (refactored dispatcher) | dispatcher | request-response | `web/src/components/ToolCard/views/_all.tsx` (existing 62-line dispatcher) | exact |
| `web/src/components/ToolCard/views/results/_resultHelpers.ts` (NEW) | utility | pure | `web/src/lib/toolInputUtils.ts` (existing helper-collection sibling) | role-match |
| `web/src/components/ToolCard/views/results/{Bash,LineList,Read}Result.tsx` (NEW) | component (per-tool view) | request-response | `web/src/components/ToolCard/views/EditView.tsx` (and `WriteView`, `MultiEditView`, …) | exact |
| `web/src/components/ToolCard/ToolCard.integration.test.tsx` (NEW) | integration test | n/a | `web/src/components/ToolCard/views/_results.test.tsx` + `web/src/components/ToolCard/knownTools.test.tsx` (existing RTL tests in same dir) | exact (RTL setup; no `integration.test` precedent exists — first of its kind) |
| `web/src/hooks/queries/_factory.ts` (NEW — `createApiQuery`) | factory | request-response | `web/src/hooks/queries/useSessions.ts` (shape-A canonical caller; factory body is the shared shell) | role-match (no factory exists yet; nearest is the shape being abstracted) |
| `web/src/hooks/queries/useSessions.ts` (refactored to consume factory) | hook | request-response | self (post-refactor; current implementation IS the to-be-extracted shell) | exact |
| `web/src/hooks/queries/useSession.ts` (refactored) | hook | request-response | `web/src/hooks/queries/useSessions.ts` | exact |
| `web/src/hooks/queries/useMachines.ts` (refactored) | hook | request-response | `web/src/hooks/queries/useSessions.ts` | exact |
| `web/src/hooks/queries/use{Slash,Skills}Commands.ts` (modified — `levenshtein` import only) | hook | request-response | self (mechanical import swap) | exact |
| `cli/src/modules/common/handlers/uploads.ts` (modified — `estimateBase64Bytes` import only) | service | file-I/O | self (mechanical import swap) | exact |
| `hub/src/web/routes/sessions/upload.ts` (modified — `estimateBase64Bytes` import only) | route | file-I/O | self (mechanical import swap) | exact |
| `scripts/check-no-circular-web.sh` (NEW) | build/CI script | static-analysis | `scripts/check-no-circular-hub.sh` | exact (direct mirror per CONTEXT Claude's Discretion + RESEARCH Q10) |
| `scripts/check-no-cut-agents.sh` (modified — append Phase 9 sweep block) | build/CI script | static-analysis | self (Phase 8 block at lines 286–386 is the template) | exact |

---

## Pattern Assignments

### `web/src/lib/message-window-store.ts` (facade — refactor in place)

**Analog:** `hub/src/sync/sessionCache.ts` (P8 D-129).

**Intent excerpt** (`hub/src/sync/sessionCache.ts:9-25`):

```typescript
/**
 * Facade: see sessionRepository / sessionLivenessService / sessionConfigService /
 * sessionMergeService for implementation. Class name preserved per D-130 — callers
 * (SyncEngine, socket handlers, routes) do not change their imports.
 */
export class SessionCache {
    private readonly repository: SessionRepository
    private readonly liveness: SessionLivenessService
    private readonly config: SessionConfigService
    private readonly merge: SessionMergeService

    constructor(store: Store, publisher: EventPublisher) {
        this.repository = new SessionRepository(store, publisher)
        this.liveness = new SessionLivenessService(this.repository, publisher)
        this.config = new SessionConfigService(this.repository, publisher)
        this.merge = new SessionMergeService(this.repository, publisher)
    }
    // ...
```

**Pattern to copy:** thin public surface + sub-services hold the implementation + callers' imports unchanged.

**Critical structural deviation (RESEARCH Q12 — confirmed by reading `web/src/lib/message-window-store.ts` in full):** P8 SessionCache is a **class** (constructor-composed sub-services). `message-window-store.ts` is **module-level functions over module-private `Map`s** — there is no `this` to compose around. Use **re-export form** instead. See RESEARCH §"Pattern 1: Facade re-export" lines 277–303 for the literal facade body to write (≈30 lines of `export { … } from './messageWindowXxx'`). Map state stays module-private in `messageWindowState.ts`; siblings consume **exported accessors** (`getInternalState` / `updateInternalState` / `getInternalListeners`), never their own Map.

---

### `web/src/lib/messageWindowState.ts` (NEW)

**Analog:** `hub/src/sync/sessionRepository.ts` (P8 — owns the Maps siblings share).

**Map-owner pattern excerpt** (`hub/src/sync/sessionRepository.ts:7-23`):

```typescript
/**
 * SessionRepository — owns the only `Store` reference among the session services (D-129).
 *
 * Sibling services (liveness/config/merge) read/mutate the in-memory caches via the
 * `public readonly` maps exposed below and route Store writes through this class.
 */
export class SessionRepository {
    public readonly sessions: Map<string, Session> = new Map()
    public readonly lastBroadcastAtBySessionId: Map<string, number> = new Map()
    public readonly todoBackfillAttemptedSessionIds: Set<string> = new Set()
    public readonly pendingThinkingUntilBySessionId: Map<string, number> = new Map()
    // ...
```

**Pattern to copy:** **one** module owns the shared Maps; siblings reach them only via accessors exported from this file. RESEARCH Example 3 (lines 1040–1066) gives the module-function adaptation (export `getInternalState` / `updateInternalState` / `getInternalListeners` accessors; keep `const states = new Map(...)` and `const listeners = new Map(...)` module-private).

---

### `web/src/lib/messageWindow{Pagination,Merge,Subscriptions,Persistence}Service.ts` (NEW)

**Analogs (one P8 sub-service per P9 sub-module):**

| P9 file | P8 analog | Shared shape |
|---------|-----------|--------------|
| `messageWindowPaginationService.ts` | `hub/src/sync/sessionLivenessService.ts` (229 lines) | reads + writes via repository accessors, no own state |
| `messageWindowMergeService.ts` | `hub/src/sync/sessionMergeService.ts` (308 lines) | merge/dedupe logic over shared state |
| `messageWindowSubscriptions.ts` | `hub/src/sync/sessionLivenessService.ts` (notify/listener pieces) | pub/sub + dispose |
| `messageWindowPersistence.ts` (Q8 Option A; only if Planner adopts 5-file split) | `hub/src/sync/sessionConfigService.ts` (132 lines) | side-effect persistence (rename/delete vs sessionStorage write) |

**Pattern shared by all four:** import-only consumption of state owner's accessors; no Map/Set creation; public API mirrors the original `message-window-store.ts` exports for the facade to re-export.

---

### `web/src/lib/fuzzyMatch.ts` (NEW)

**Analog:** `web/src/lib/randomId.ts` (existing pure-util module in same dir).

**Pure-util module shape** (`web/src/lib/randomId.ts:1-16`):

```typescript
/**
 * Generates a random ID string that works in both secure and non-secure contexts.
 * ... (JSDoc explaining intent + fallback chain) ...
 */
export function randomId(): string {
    // ...
}
```

**Body to move** (verbatim from `web/src/hooks/queries/useSlashCommands.ts:9-23` — algorithm identical to `useSkills.ts:9-23`):

```typescript
function levenshteinDistance(a: string, b: string): number {
    if (a.length === 0) return b.length
    if (b.length === 0) return a.length
    const matrix: number[][] = []
    for (let i = 0; i <= b.length; i++) matrix[i] = [i]
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j
    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            matrix[i][j] = b[i - 1] === a[j - 1]
                ? matrix[i - 1][j - 1]
                : Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1)
        }
    }
    return matrix[b.length][a.length]
}
```

**Pattern to copy:** single named `export function` + brief JSDoc; no default export; lives next to `randomId.ts` / `clipboard.ts` / `sessionModelLabel.ts` as a peer pure-util.

---

### `shared/src/uploads.ts` (NEW)

**Analogs:** `shared/src/utils.ts` (multi-export pure utils) + `shared/src/modes.ts` (constants + functions co-located).

**Multi-export utils shape** (`shared/src/utils.ts:1-21`):

```typescript
export function isObject(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object'
}

export function asString(value: unknown): string | null {
    return typeof value === 'string' ? value : null
}

export function safeStringify(value: unknown): string {
    if (typeof value === 'string') return value
    try {
        const stringified = JSON.stringify(value, null, 2)
        return typeof stringified === 'string' ? stringified : String(value)
    } catch {
        return String(value)
    }
}
```

**Constants + functions co-location** (`shared/src/modes.ts:1-8`):

```typescript
export const CURSOR_PERMISSION_MODES = ['default', 'plan', 'ask', 'yolo'] as const
export type CursorPermissionMode = typeof CURSOR_PERMISSION_MODES[number]

export const PERMISSION_MODES = CURSOR_PERMISSION_MODES
export type PermissionMode = CursorPermissionMode
```

**Barrel re-export** (`shared/src/index.ts:1-11`): planner adds `export * from './uploads'` after existing lines (1 line added).

**Body to move** (verbatim from `hub/src/web/routes/sessions/upload.ts:18-25` — identical to `cli/src/modules/common/handlers/uploads.ts:36+55`):

```typescript
export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024

export function estimateBase64Bytes(base64: string): number {
    const len = base64.length
    if (len === 0) return 0
    const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0
    return Math.floor((len * 3) / 4) - padding
}
```

**Pattern to copy:** named exports only, no default; co-locate the constant with the function (Claude's Discretion + RESEARCH Q9). Add to barrel via `shared/src/index.ts`.

---

### `web/src/components/SessionList.tsx` (orchestrator refactor) + `SessionList/{Header,Search,Item,Empty}.tsx` (NEW sub-components)

**Analog:** `web/src/components/NewSession/index.tsx` (orchestrator) + `web/src/components/NewSession/{ActionButtons,MachineSelector,SessionTypeSelector,YoloToggle,DirectorySection,ModelSelector}.tsx` (already-decomposed siblings).

**Orchestrator imports + composition** (`web/src/components/NewSession/index.tsx:1-19`):

```typescript
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import type { ApiClient } from '@/api/client'
import type { Machine } from '@/types/api'
import { usePlatform } from '@/hooks/usePlatform'
import { useMachinePathsExists } from '@/hooks/useMachinePathsExists'
import { useSpawnSession } from '@/hooks/mutations/useSpawnSession'
import { useSessions } from '@/hooks/queries/useSessions'
import { useActiveSuggestions, type Suggestion } from '@/hooks/useActiveSuggestions'
import { useDirectorySuggestions } from '@/hooks/useDirectorySuggestions'
import { useRecentPaths } from '@/hooks/useRecentPaths'
import { useTranslation } from '@/lib/use-translation'
import type { SessionType } from './types'
import { ActionButtons } from './ActionButtons'
import { DirectorySection } from './DirectorySection'
import { MachineSelector } from './MachineSelector'
import { ModelSelector } from './ModelSelector'
import { SessionTypeSelector } from './SessionTypeSelector'
import { YoloToggle } from './YoloToggle'
```

**Pattern to copy:**

- Sub-components live in a sibling **directory matching the orchestrator name** (`SessionList/`), each as a **named export** in its own file, **no `index.ts` barrel** (RESEARCH §Anti-Patterns: "Don't introduce path aliases or index.ts barrel files for `SessionList/`").
- Orchestrator imports sub-components via **relative paths** (`./SessionList/SessionListHeader`).
- Hooks live as **sibling files** consumed by the orchestrator (NewSession composes `usePlatform` / `useSpawnSession` / `useSessions` / `useActiveSuggestions` / etc. directly in its body). For SessionList, the 4 new `useSessionListXxx` hooks colocate with the orchestrator (per RESEARCH §Recommended Project Structure lines 205–215 — note: structure puts hooks under `SessionList/` dir, planner confirms exact location).
- `SessionList` **default export** stays (per D-148); sub-components are **named exports**.

---

### `web/src/routes/settings/index.tsx` (orchestrator refactor) + `_sections/{Language,Display,Chat,About}Section.tsx` (NEW) + `useSettingsState.ts` (NEW hook)

**Analog (orchestrator + sub-components):** same `web/src/components/NewSession/index.tsx` pattern as above.

**Naming correction (RESEARCH Q5 + Pitfall 4):** CONTEXT D-151 says "_tabs/" — settings has **no tab UI**. Use `_sections/` dir name. 4 sub-components named `LanguageSection.tsx` / `DisplaySection.tsx` / `ChatSection.tsx` / `AboutSection.tsx`. Orchestrator vertically stacks them inside the existing scroll container.

**Hook extraction pattern (lifted state):** `useSettingsState.ts` consolidates the 8 `useState`/`useRef` open-dropdown flags + outside-click `useEffect` (RESEARCH Q5 enumerated list). Sub-section components consume `useSettingsState()` selectively OR receive open/setOpen tuples as props (planner's call).

---

### `web/src/components/AssistantChat/HappyComposer.tsx` (orchestrator refactor) + `HappyComposerOverlays.tsx` + `useHappyComposer{State,Handlers}.ts` (NEW)

**Analog (already-decomposed sibling siblings):** `web/src/components/AssistantChat/{StatusBar,ComposerButtons,AttachmentItem,ScheduleTimePicker,QueuedMessagesBar}.tsx` — RESEARCH Q6 confirmed most visual sections are already extracted; the bulk of remaining 669 lines is **hooks + handlers + `useMemo` overlay-composition** (lines 74–596).

**Sibling-component shape** (`web/src/components/AssistantChat/ComposerButtons.tsx:1-6`):

```typescript
import { ComposerPrimitive } from '@assistant-ui/react'
import { useTranslation } from '@/lib/use-translation'
import { ScheduleTimePicker } from './ScheduleTimePicker'
import type { PendingSchedule } from './ScheduleTimePicker'
import { useRef, useState } from 'react'
```

**Pattern to copy:**

- New `HappyComposerOverlays.tsx` is a **named-export component** in the same dir as `HappyComposer.tsx` (no sub-dir — follows existing `StatusBar.tsx` / `ComposerButtons.tsx` flat layout, NOT `NewSession/` nested layout).
- New `useHappyComposerState.ts` + `useHappyComposerHandlers.ts` are **named-export hooks** in the same flat dir (analog: `modelOptions.ts` exists as a flat util sibling).
- 3-file split is sufficient per RESEARCH Q6 — do not invent a 4th "send-controls" file (already lives in `ComposerButtons.tsx`).

---

### `web/src/components/ToolCard/views/_results.tsx` (dispatcher refactor) + `results/{Bash,LineList,Read}Result.tsx` + `results/_resultHelpers.ts` (NEW)

**Dispatcher analog:** `web/src/components/ToolCard/views/_all.tsx` (62-line existing dispatcher in same dir — confirmed by Q12 file listing; D-153 explicitly says do NOT touch `_all.tsx` but DO use it as the dispatcher-shape reference).

**Per-tool view analog** (`web/src/components/ToolCard/views/EditView.tsx:1-22`):

```typescript
import type { ToolViewProps } from '@/components/ToolCard/views/_all'
import { isObject } from '@hapi/protocol'
import { DiffView } from '@/components/DiffView'

export function EditView(props: ToolViewProps) {
    const input = props.block.tool.input
    if (!isObject(input)) return null

    const oldString = typeof input.old_string === 'string' ? input.old_string : null
    const newString = typeof input.new_string === 'string' ? input.new_string : null
    if (oldString === null || newString === null) return null

    return (
        <DiffView
            oldString={oldString}
            newString={newString}
            variant="inline"
            size={props.surface === 'dialog' ? 'comfortable' : undefined}
            scrollY={props.surface === 'dialog'}
        />
    )
}
```

**Pattern to copy for each `results/{Bash,LineList,Read}Result.tsx`:**

- Single **named-export function component** taking a single `props: ToolResultViewProps`-shape arg (planner confirms exact prop type by reading `_results.tsx` registry signature at line 660–687).
- **No default export**; **no JSDoc** beyond what's necessary; **early-return** for non-matching inputs.
- Imports from `@/` aliases (per repo convention).

**Pattern to copy for `_resultHelpers.ts`:** multi-export helper module — analog `web/src/lib/toolInputUtils.ts` or `shared/src/utils.ts` shape (multiple `export function`s, no default).

**Test-case redistribution analog:** existing `_results.test.tsx` (`vitest` + RTL + per-extracted-view cases) — see Q13 + lines 1–60 of `_results.test.tsx` for mock-and-render conventions to reuse in `BashResult.test.tsx` / `LineListResult.test.tsx` / `ReadResult.test.tsx`.

---

### `web/src/components/ToolCard/ToolCard.integration.test.tsx` (NEW)

**Analogs (no existing `*.integration.test.tsx` precedent — first of its kind; copy RTL setup from existing siblings):**

- `web/src/components/ToolCard/views/_results.test.tsx` (RTL setup + `vi.mock` for `MarkdownRenderer` / `CodeBlock`)
- `web/src/components/ToolCard/knownTools.test.tsx` (uses `knownTools` registry directly — confirms `Object.keys(knownTools)` is the correct iteration)

**RTL setup excerpt** (`web/src/components/ToolCard/views/_results.test.tsx:1-22`):

```typescript
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { ToolCallBlock } from '@/chat/types'
import { extractTextFromResult, getMutationResultRenderMode, getToolResultViewComponent } from '@/components/ToolCard/views/_results'
import { I18nProvider } from '@/lib/i18n-context'

vi.mock('@/components/MarkdownRenderer', () => ({
    MarkdownRenderer: (props: { content: string; className?: string }) => (
        <div className={props.className}>{props.content}</div>
    )
}))

vi.mock('@/components/CodeBlock', () => ({
    CodeBlock: (props: { code: string; language?: string; title?: string; className?: string }) => (
        <div className={props.className}>
            {props.title ? <div>{props.title}</div> : null}
            <pre data-language={props.language ?? 'text'}>
                <code>{props.code}</code>
            </pre>
        </div>
    )
}))
```

**Pattern to copy:**

- `vitest` describe/it/expect + `@testing-library/react` render
- `vi.mock` for heavy children (`MarkdownRenderer`, `CodeBlock`) — copy verbatim
- Wrap test renders in `I18nProvider` if `useTranslation` is hit anywhere in the component tree (RESEARCH Q4 flagged this for `ToolCard.tsx` line 287/323)
- For `ToolCard.integration.test.tsx` body, use the **table-driven loop + negative-control case** from RESEARCH §Code Examples Example 2 (lines 982–1036) verbatim — already includes the `makeMinimalProps(toolName)` factory honoring the 7 required `ToolCardProps` fields (Q4).

**Anchor location correction (Pitfall 3 / Q2):** `data-testid="tool-card-unknown-fallback"` lives in `knownTools.tsx` WrenchIcon path (lines ~417–422 area), NOT in `_results.tsx`. Reverse-assert in this test with `queryByTestId('tool-card-unknown-fallback')` returning null for every `Object.keys(knownTools)` entry.

---

### `web/src/hooks/queries/_factory.ts` (NEW — `createApiQuery`)

**Analog:** `web/src/hooks/queries/useSessions.ts` — the canonical shape-A hook whose body IS the to-be-extracted shell (RESEARCH Q1 — 3 hooks confirmed share this exact shape).

**Shape-A excerpt** (`web/src/hooks/queries/useSessions.ts:1-29`):

```typescript
import { useQuery } from '@tanstack/react-query'
import type { ApiClient } from '@/api/client'
import type { SessionSummary } from '@/types/api'
import { queryKeys } from '@/lib/query-keys'

export function useSessions(api: ApiClient | null): {
    sessions: SessionSummary[]
    isLoading: boolean
    error: string | null
    refetch: () => Promise<unknown>
} {
    const query = useQuery({
        queryKey: queryKeys.sessions,
        queryFn: async () => {
            if (!api) {
                throw new Error('API unavailable')
            }
            return await api.getSessions()
        },
        enabled: Boolean(api),
    })

    return {
        sessions: query.data?.sessions ?? [],
        isLoading: query.isLoading,
        error: query.error instanceof Error ? query.error.message : query.error ? 'Failed to load sessions' : null,
        refetch: query.refetch,
    }
}
```

**Pattern to copy:** the shape repeats verbatim in `useSession.ts` (sessionId arg + enabled gate) and `useMachines.ts` (boolean `enabled` arg). Factory body = exactly this shell parameterized over `{ queryKey, queryFn, select, enabled?, errorMessage, queryOptions? }`. RESEARCH §Code Examples Example 1 (lines 914–957) provides the literal factory signature to write.

**Refactored hook body (per `useSessions.ts` post-refactor)** — RESEARCH §Example 1 usage (lines 962–978):

```typescript
import type { SessionSummary } from '@/types/api'
import { queryKeys } from '@/lib/query-keys'
import { createApiQuery } from './_factory'

const useSessionsQuery = createApiQuery({
    queryKey: () => queryKeys.sessions,
    queryFn: (api) => api.getSessions(),
    select: (data) => data?.sessions ?? [],
    errorMessage: 'Failed to load sessions',
})

export function useSessions(api: ApiClient | null) {
    const { data, isLoading, error, refetch } = useSessionsQuery(api, null)
    return { sessions: data, isLoading, error, refetch }
}
```

---

### `cli/src/modules/common/handlers/uploads.ts` + `hub/src/web/routes/sessions/upload.ts` (modified — import swap)

**Mechanical refactor only.** Delete lines 36 + 55–60 in cli (`MAX_UPLOAD_BYTES` const + `estimateBase64Bytes` function) and lines 18 + 20–25 in hub. Add at top:

```typescript
import { estimateBase64Bytes, MAX_UPLOAD_BYTES } from '@hapi/protocol'
```

(Or `from '@hapi/protocol/uploads'` if sub-path exports work — A5 in Assumptions Log; planner verifies `shared/package.json` exports field in Slice 1.) No other code changes; algorithm identical.

---

### `web/src/hooks/queries/useSkills.ts` + `useSlashCommands.ts` (modified — import swap)

**Mechanical refactor only.** Delete the 13-line `function levenshteinDistance(...)` block (verified at `useSlashCommands.ts:9-23`; identical in `useSkills.ts:9-23` per RESEARCH Q1 + D-154). Replace with:

```typescript
import { levenshteinDistance } from '@/lib/fuzzyMatch'
```

(adjusts existing imports). `getSuggestions` callbacks stay inline.

---

### `scripts/check-no-circular-web.sh` (NEW)

**Analog:** `scripts/check-no-circular-hub.sh` (direct mirror per CONTEXT Claude's Discretion + RESEARCH Q10).

**Full file** (`scripts/check-no-circular-hub.sh:1-23`):

```bash
#!/usr/bin/env bash
# scripts/check-no-circular-hub.sh
# Phase-8 madge guard — asserts hub/src/ has zero internal circular deps.
# The --exclude pattern filters out (a) any ../web/dist sibling sourcemap-derived
# walks and (b) any accidental import that resolved up out of hub/src/. Running
# from hub/ keeps madge's resolver scoped to the hub workspace.
set -euo pipefail

cd "$(dirname "$0")/.."
cd hub

output=$(npx --no-install madge --circular --extensions ts,tsx --exclude '(^\.\./|web/dist)' src/ 2>&1) || exit_code=$?
exit_code=${exit_code:-0}

if [ "$exit_code" -ne 0 ] || echo "$output" | grep -q '^[0-9]\+)'; then
    echo "❌ Phase-8 madge: circular dependency in hub/src/:" >&2
    echo "$output" >&2
    echo "Run: cd hub && npx madge --circular --extensions ts,tsx --exclude '(^\\.\\./|web/dist)' src/" >&2
    exit 1
fi

echo "✅ No circular dependencies in hub/src/ (madge)."
```

**Pattern to copy:** s/Phase-8/Phase-9/, s/hub/web/g — RESEARCH Q10 provides the finished file body verbatim (lines 717–739).

---

### `scripts/check-no-cut-agents.sh` (modified — append Phase 9 sweep block)

**Analog:** the Phase 8 sweep block at lines 286–386 (self-template).

**Tail-invocation pattern excerpt** (`scripts/check-no-cut-agents.sh:359-386`):

```bash
# (#5) D-143 #5 / SC#1 — file-size budgets for Phase-8-split files.
PHASE8_OVERSIZED_SYNC=$(find hub/src/sync -maxdepth 1 \( -name 'session*.ts' -o -name 'syncEngine*.ts' \) ! -name '*.test.ts' -exec wc -l {} \; 2>/dev/null | awk '$1 >= 400 { print }')
if [ -n "$PHASE8_OVERSIZED_SYNC" ]; then
  echo "$PHASE8_OVERSIZED_SYNC"
  echo ""
  echo "❌ Phase 8 D-143 #5: Phase-8-split file in hub/src/sync/ ≥ 400 lines (SC#1 violated)."
  echo "   Split further into a sub-facade or service file."
  exit 1
fi
# ...
echo "✅ Phase 8 D-143 #5: file-size budgets honored (sync < 400, routes/sessions < 250)."

# (#4) D-143 #4 / SC#5 — tail-invocation of the madge guard so this script is
# a single phase-gate command.
bash "$(dirname "$0")/check-no-circular-hub.sh"

echo "✅ Phase 8 guard PASS (D-143 #1–#5 + madge zero cycles)."
```

**Pattern to copy:**

- Numbered sub-checks (`(#1)` … `(#7)`) per D-158 item
- `RG_BIN` ripgrep wrapper (defined upstream in same script lines 23–30)
- `find … -maxdepth 1 -name '*.ts' ! -name '*.test.ts' -exec wc -l {} \; | awk '$1 >= N { print }'` for size budgets
- Tail-invoke `bash "$(dirname "$0")/check-no-circular-web.sh"` at end
- Final `echo "✅ Phase 9 guard PASS …"` line

**Insertion point:** immediately after line 386 (Phase 8's success echo), before EOF. RESEARCH Q11 (lines 770–872) provides the **literal Phase 9 sweep block body** ready to paste — planner copies that.

---

## Shared Patterns

### Shared Pattern A: Facade re-export vs class composition (P8 D-129 → P9 D-149)

**Source:** `hub/src/sync/sessionCache.ts` (intent) + `hub/src/sync/sessionRepository.ts` (state owner)
**Apply to:** All 5 `messageWindow*.ts` files (state + 4 services + facade)
**Pivot:** P8 is class-based (composition via `new Sub()` in constructor); P9 is module-based (re-export from `messageWindowState` accessors). Sub-modules MUST consume `getInternalState` / `updateInternalState` from `messageWindowState.ts` — NEVER create their own `Map`. See RESEARCH §Pitfall 1.

### Shared Pattern B: Orchestrator + colocated sub-components + flat hooks

**Source:** `web/src/components/NewSession/index.tsx`
**Apply to:** `SessionList` (decompose into `SessionList/`), `settings/index.tsx` (decompose into `_sections/`), `HappyComposer.tsx` (keep flat — siblings already extracted).
**Rule:** Sub-components are named exports, no `index.ts` barrel; orchestrator imports via relative paths; hooks live as flat sibling files.

### Shared Pattern C: Per-tool view component shape

**Source:** `web/src/components/ToolCard/views/EditView.tsx`
**Apply to:** All `results/{Bash,LineList,Read}Result.tsx` files.
**Rule:** Single named export, single `props` arg (existing `ToolViewProps`-style shape), early-return for non-matching inputs, no default export.

### Shared Pattern D: Pure-util module

**Source:** `web/src/lib/randomId.ts` (web-local) + `shared/src/utils.ts` (shared)
**Apply to:** `web/src/lib/fuzzyMatch.ts` + `shared/src/uploads.ts`.
**Rule:** Named function exports only; no default; co-locate related constants; add to barrel (`shared/src/index.ts`) only if in shared/.

### Shared Pattern E: TanStack Query shape-A shell

**Source:** `web/src/hooks/queries/useSessions.ts`
**Apply to:** `_factory.ts::createApiQuery` body + refactored `useSession.ts` / `useMachines.ts` callsites.
**Rule:** `api-null throw → useQuery → unwrap` is the entire shell. Factory parameterizes `{ queryKey, queryFn, select, enabled?, errorMessage, queryOptions? }`. Do NOT extend to shape-B hooks (`useGitStatusFiles` / `useSessionDirectory` / `useSessionFileSearch`) — defer per RESEARCH Open Question 1.

### Shared Pattern F: RTL test setup with vi.mock for heavy children

**Source:** `web/src/components/ToolCard/views/_results.test.tsx:1-22`
**Apply to:** `ToolCard.integration.test.tsx` + all new `BashResult.test.tsx` / `LineListResult.test.tsx` / `ReadResult.test.tsx` + `_sections/*Section.test.tsx`.
**Rule:** Mock `MarkdownRenderer` + `CodeBlock` to keep tests fast; wrap renders in `I18nProvider` when `useTranslation` is in the tree.

### Shared Pattern G: Phase-gate guard script (mirror per-package madge + sweep block append)

**Source:** `scripts/check-no-circular-hub.sh` + Phase 8 block in `scripts/check-no-cut-agents.sh:286-386`
**Apply to:** `scripts/check-no-circular-web.sh` + Phase 9 sweep block append.
**Rule:** Per-package script `cd <pkg> && npx --no-install madge --circular --extensions ts,tsx --exclude '(^\.\./|<other-pkg>/dist)' src/`; sweep block uses `RG_BIN` wrapper + `find … wc -l … awk` size budgets + tail-invoke the per-package madge script.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| (none) | — | — | All 28 new/modified files mapped. `_factory.ts` has no factory precedent in `web/src/hooks/queries/` but the shape-A hooks themselves (`useSessions.ts`) are the analog — they ARE the body to extract. |

---

## Metadata

**Analog search scope:** `hub/src/sync/`, `shared/src/`, `web/src/components/`, `web/src/lib/`, `web/src/hooks/queries/`, `web/src/routes/`, `scripts/`, `cli/src/modules/common/handlers/`, `hub/src/web/routes/sessions/`
**Files scanned:** ~50 (focused targeted reads only — no re-reads)
**Pattern extraction date:** 2026-05-23

---

*Phase: 9-Web internal decoupling*
*Pattern map completed: 2026-05-23*
