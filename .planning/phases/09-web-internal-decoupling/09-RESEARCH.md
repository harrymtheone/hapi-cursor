# Phase 9: Web internal decoupling — Research

**Researched:** 2026-05-23
**Domain:** React/TypeScript web client (Vite + TanStack Query + custom pub/sub store + React Testing Library); pure refactor (file splitting + util dedup + guard scripts). No new external dependencies.
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions (verbatim from `<decisions>` D-145 through D-159)

- **D-145 — SC#1 前半 / SC#2 转 verify-only + guard:** `madge --circular web/src/components/ToolCard/` 与 `madge --circular web/src/` 实测均 0 环；`reducerTimeline.ts` 已 359 行。P9 不重做这两件事，只 (a) 新建 `scripts/check-no-circular-web.sh` 跑 `madge` 退出码 0；(b) `scripts/check-no-cut-agents.sh` 追加文件大小红线 sweep（6 个目标文件 + `_all.tsx` < 200 + `ToolCard.tsx` < 500 + `knownTools.tsx` < 500）。
- **D-146 — `CursorPermissionMode` 视作 done.** P5/P7 D-119 已经把它落在 `shared/src/modes.ts` 唯一来源。Phase 9 不动；只在 CONTEXT 记 done。
- **D-147 — `createApiQuery` 走「先调查后决定」（≥ 3 用户共享同一壳才抽）.** 由 researcher 在 Slice 1 列 `web/src/hooks/queries/*.ts` hook 形状决定。本研究已完成调查 → **建议 ABSTRACT，见下文 D-147 段落。**
- **D-148 — `SessionList.tsx` 先抽 4 hooks 再拆 4 sub-component**（`useSessionListData / useSessionListSearch / useSessionListSelection / useSessionListKeyboard` + `SessionListHeader / SessionListSearch / SessionListItem / SessionListEmpty`）。`SessionList.tsx` 退化为 orchestrator < 250 行；default export 不变。
- **D-149 — `message-window-store.ts` 保守职责拆 4 sub-module + 薄 facade**（`messageWindowState.ts` / `messageWindowPaginationService.ts` / `messageWindowMergeService.ts` / `messageWindowSubscriptions.ts`）。`message-window-store.ts` 仍是外部唯一入口，公开 API 签名零变化；每个 sub-module < 400 行。
- **D-150 — 本 phase 不背架构方向变更.** 「迁移到 TanStack Query / 与 `useSSE` 合并 / 删除 store」全部进 `<deferred>`。
- **D-151 — settings/index.tsx + HappyComposer.tsx 同模板**（hooks 抽 + sub-component 拆，入口 < 300 行）。Section / tab 边界由 researcher 列实际 JSX 后定 → **见下文 D-151 段落。**
- **D-152 — `_results.tsx` 走 dispatcher + per-tool result 子组件**（mirror `views/*View.tsx` 命名）。dispatcher < 250 行。新拆子组件各自落 colocated 单测。Per-tool result line counts 由 researcher 测 → **见下文 D-152 段落。**
- **D-153 — `_results.tsx` 内部拆，不动 `_all.tsx` / `ToolCard.tsx` / `knownTools.tsx` 三者间 import 拓扑.**
- **D-154 — 跨包真重复 → `shared/`；纯 web-only 重复 → `web/src/lib/`.** `estimateBase64Bytes` 上提 `shared/src/uploads.ts`；`levenshteinDistance` 上提 `web/src/lib/fuzzyMatch.ts`。
- **D-155 — REFW-03 措辞与实施有偏差，已 CONTEXT 显式记录**（`levenshtein` 仅在 web 内出现 → 不进 `shared/`，符合 P7 D-119 "shared = wire / 跨端共享语义唯一来源" 边界）。
- **D-156 — table-driven 集成测试 + 反向断言 fallback 锚** (`web/src/components/ToolCard/ToolCard.integration.test.tsx`)。锚字符串 / DOM 位置 / minimalProps / 注册表导出形态由 researcher 定 → **见下文 D-156 段落。**
- **D-157 — 4 切片**（util dedup + cycles guard + renderer 集成测试 / message-window-store + SessionList / settings + HappyComposer + _results.tsx / guard 收口），每片 `bun typecheck` + `bun run test` 全包绿。
- **D-158 — ripgrep + madge zero-tolerance 关键词 sweep（Phase 9）：**
  1. `function levenshteinDistance\(` / `function levenshtein\(` 在 `web/src/` = 1（仅 `fuzzyMatch.ts`），在 `cli/src/` / `hub/src/` / `shared/src/` = 0。
  2. `function estimateBase64Bytes\(` 在 `shared/src/` = 1（仅 `uploads.ts`），其它三处 = 0。
  3. `madge --circular --extensions ts,tsx web/src/` 0 环。
  4. 文件大小红线（D-157 各 slice 门槛）。
  5. `data-testid="tool-card-unknown-fallback"` 命中 = 1 + 测试反向断言锚。
  6. `createApiQuery` 条件性（D-147 决定后启用）。
- **D-159 — 不动 `web/src/` 之外**（除 `shared/src/uploads.ts` 新文件 + cli/hub 各一处 import 改写）；`useSSE.ts` / `SessionChat.tsx` / `useSkills.ts` / `useSlashCommands.ts` 等仅改 import 路径。

### Claude's Discretion (verbatim from CONTEXT)

- settings 按 tab 还是按 concern 拆 sub-component；推荐按 tab（视觉边界天然对齐）。
- HappyComposer section 边界（toolbar / input / attachments / send-controls 是否合并 / 拆 5 段）。
- `_results.tsx` 拆出 `results/` 子目录的颗粒度：推荐 ≥ 50 行才拆，避免 tiny 文件膨胀。
- `createApiQuery` 阈值可由 researcher 提高到 4（如发现 3 个壳偏歧义化），但不能降到 2。
- `web/src/lib/fuzzyMatch.ts` 是否一并暴露其它 fuzzy 工具：推荐**只**搬 `levenshteinDistance`。
- `shared/src/uploads.ts` 是否同时上提 `MAX_UPLOAD_BYTES` 常量（cli/hub 实测都定义）；推荐一并上提。
- `_results.tsx` fallback 锚字符串具体值；约定 kebab-case + `data-testid` 形态。
- `scripts/check-no-circular-web.sh` 独立脚本 vs 并入 `check-no-cut-agents.sh`；推荐独立脚本（与 P8 `check-no-circular-hub.sh` 风格对齐）。
- `message-window-store` 4 sub-module 是否各自暴露给外部 vs 仅 facade；默认仅 facade。
- `madge --circular web/src/` 是否需要 `--exclude` 过滤 → researcher 实测决定。

### Deferred Ideas (verbatim, OUT OF SCOPE)

- `message-window-store` 迁移到 TanStack Query / 与 `useSSE` 合并 / 删除 store 让 TanStack 直接管 — v2 milestone 或独立 phase。
- `createApiQuery` 抽象（若 < 3 用户共享同一壳）— 条件性 deferred；本研究判定**不 defer**。
- `fuzzyMatch.ts` 进一步抽 `fuzzyScore` / `fuzzyRank` / 等 — 不本 phase。
- `shared/src/uploads.ts` 进一步抽 upload size 验证 / 文件类型识别 / 等 — 不本 phase。
- `settings/index.tsx` 各 tab 进一步抽 sub-route / 独立 lazy load — 不本 phase。
- `HappyComposer.tsx` 各 section 进一步抽独立 hook 库 — 不本 phase。
- REFC-01 / REFC-02 config 清理 — Phase 10。
- REFT-01 / REFT-02 / REFT-03 测试空白 — Phase 11。
- `reducerTimeline.ts` 进一步精简 / 与 `message-window-store` 整合 — 不本 phase。
- `ToolCard.tsx` (488) / `knownTools.tsx` (423) 拆分 — < 500 视作合理大小；仅 guard 监控。
- `_results.tsx` fallback 路径运行时可观测性增强（telemetry / console.warn） — 不本 phase。
- `web/src/hooks/queries/*.ts` 命名 / 文件组织统一化 — 不本 phase。
- `web/src/components/SessionList/` 子目录是否独立 `index.ts` re-export — researcher 在 Slice 2 决定，不强制本 phase 收敛。
- 文档 / README / website prose 清理 — Phase 12 (CUT-12)。

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| REFW-01 | 打破 ToolCard 11 文件循环依赖 + 加「所有已知 tool 能解析到 renderer」的集成测试 | 已 0 环（D-145 verify-only）；集成测试设计见 D-156 段落 |
| REFW-02 | 拆分超大文件：`SessionList.tsx` (953) / `message-window-store.ts` (1088) / `reducerTimeline.ts` (359, 已达成) / `routes/settings/index.tsx` (758) / `AssistantChat/HappyComposer.tsx` (669) | 拆分边界见 D-149 / D-151 / D-152 段落 |
| REFW-03 | 提取重复工具函数到 `shared/`（Levenshtein / base64 / Cursor permission mode / API query hook 形状） | 4 项中 `CursorPermissionMode` 已 done (P5/P7)；`levenshtein` 落 `web/lib/` (D-155)；`base64` 上 shared (D-154)；`createApiQuery` 抽（D-147，见下文） |

</phase_requirements>

## Summary

Phase 9 is a **pure structural refactor** — no new external dependencies, no architectural shifts, no wire-contract changes. Five oversized web files get decomposed (`SessionList.tsx` 953 → orchestrator + 4 hooks + 4 sub-components; `message-window-store.ts` 1088 → facade + 4 sub-modules; `routes/settings/index.tsx` 758 → orchestrator + 4 section components; `AssistantChat/HappyComposer.tsx` 669 → orchestrator + 2 hooks + 1 overlay component; `ToolCard/views/_results.tsx` 687 → dispatcher + 3 per-tool result files + shared helpers module). Two utilities get deduped (`estimateBase64Bytes` → `shared/src/uploads.ts`, `levenshteinDistance` → `web/src/lib/fuzzyMatch.ts`). One integration test gets added (`ToolCard.integration.test.tsx` table-drives `Object.keys(knownTools)` through `<ToolCard>`). Two guard scripts get added/extended (`check-no-circular-web.sh` + Phase 9 sweep block in `check-no-cut-agents.sh`).

CONTEXT.md (D-145 through D-159) already specifies almost every implementation decision. This research **answers the 13 open questions CONTEXT.md flagged** and surfaces three corrections to CONTEXT assumptions (none blocking; all noted inline below for the planner).

**Primary recommendation:** Apply CONTEXT.md verbatim. Adopt the per-question recommendations in this document for D-147 / D-151 / D-152 / D-156. Two CONTEXT assumptions need correction by the planner: (1) `message-window-store` is a **custom pub/sub Map-backed store, NOT zustand** — affects D-149 sub-module wording but not the split itself; (2) `settings/index.tsx` has **sections, not tabs** — affects D-151 file-naming convention.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Session list rendering (`SessionList.tsx`) | Browser / Client (React component tree) | — | Pure UI; data already in client store via TanStack Query / `useSessions` |
| Message window state (`message-window-store.ts`) | Browser / Client (in-memory store + sessionStorage persistence) | — | Per-session pagination state machine; not shared across tabs/clients |
| Settings page (`routes/settings/index.tsx`) | Browser / Client (route component) | — | All settings stored client-side (sessionStorage / localStorage via hooks) |
| Composer (`HappyComposer.tsx`) | Browser / Client (input UI) | — | Wires up `assistant-ui` ComposerPrimitive; server interaction via callbacks |
| Tool result rendering (`ToolCard/views/_results.tsx`) | Browser / Client (presentation registry) | — | Pure display dispatcher over `ToolCallBlock` props |
| Util: `estimateBase64Bytes` | Shared (`shared/src/`) | API/Backend (consumer) + CLI (consumer) | Wire-contract-adjacent (file upload size estimation); cross-package reuse |
| Util: `levenshteinDistance` | Browser / Client (`web/src/lib/`) | — | UI-only fuzzy matching for autocomplete; not a wire contract |
| Util: `createApiQuery` factory | Browser / Client (`web/src/hooks/queries/`) | — | TanStack Query shell adapter; React-only |
| Guard scripts (`check-no-circular-web.sh`, sweep block) | Build / CI | — | Static analysis at commit gate |

**All Phase 9 work is in the Browser / Client tier** except `shared/src/uploads.ts` (Shared) and the guard scripts (Build / CI). The CONTEXT phase boundary is correct — no cross-tier mismatches.

## Standard Stack

### Existing (no new installs)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `react` | 19.x (`package.json` workspaces) | UI rendering [CITED: `web/package.json`] | Already in use |
| `@tanstack/react-query` | 5.x | Server-state queries for `useSessions` / `useSkills` / etc. [CITED: `web/src/hooks/queries/useSessions.ts:1`] | Already in use |
| `vitest` | latest | Test runner (`bun run test:web`) | Already in use |
| `@testing-library/react` | latest | DOM-rendering tests for D-156 integration test [CITED: project skills + existing `_results.test.tsx` uses it] | Already in use |
| `madge` | latest (via `npx --no-install`) | Circular dependency detection [CITED: `scripts/check-no-circular-hub.sh:11`] | Established in P6 + P8 guards |
| `ripgrep` (`rg`) | bundled in Cursor | Source-code grep for guard sweeps [CITED: `scripts/check-no-cut-agents.sh:23-29`] | Established in P1–P8 guards |
| `bun` | workspace runtime | Workspaces + script runner | Already in use |

**Installation:** No new packages. All tooling already in `web/package.json` / repo `package.json`. **No `npm install` step required in any slice.**

**Version verification:** Skipped — no new packages this phase.

## Package Legitimacy Audit

Phase 9 installs **no external packages**. The CONTEXT explicitly scopes this phase as a structural refactor reusing existing tooling (`vitest`, `@testing-library/react`, `madge`, `ripgrep`). Therefore the Package Legitimacy Gate is **not triggered**.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| (none) | — | — | — | — | — | — |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram (post-split, web/ only)

```
                            ┌─────────────────────────────────┐
   Routes (entry points)    │  routes/index.tsx (chat)        │
   - chat                   │  routes/settings/index.tsx ───┐ │
   - settings               └───────────────│───────────────│─┘
                                            │               │
        ┌───────────────────────────────────┼───────────────┴─────────┐
        ▼                                   ▼                         ▼
  ┌─────────────────────┐   ┌──────────────────────────┐   ┌────────────────────────┐
  │ SessionList.tsx     │   │ AssistantChat/           │   │ settings sub-sections   │
  │ (orchestrator)      │   │   HappyComposer.tsx      │   │ - Language              │
  │  ├ useSessionListData│   │   (orchestrator)         │   │ - Display               │
  │  ├ useSessionListSearch│ │    ├ useHappyComposerState│  │ - Chat                 │
  │  ├ useSessionListSelection│ │ ├ useHappyComposerHandlers│ │ - About             │
  │  ├ useSessionListKeyboard │ │ └ HappyComposerOverlays.tsx│ └────────────────────┘
  │  └ SessionList{Header,Search,Item,Empty}.tsx        │
  └─────────────────────┘   └──────────────────────────┘
        │
        ▼
  ┌────────────────────────────────────────────────────────────────────────────┐
  │   web/src/hooks/queries/  (TanStack Query)                                 │
  │   - useSessions / useSession / useMachines   ──► createApiQuery factory    │
  │   - useSkills / useSlashCommands             ──► import levenshteinDistance│
  │                                                  from @/lib/fuzzyMatch    │
  │   - useGitStatusFiles / useSessionDirectory / useSessionFileSearch (custom)│
  │   - useMessages (NOT TanStack; uses useSyncExternalStore)                  │
  └─────────────────┬───────────────────────────────────────────┬──────────────┘
                    │                                           │
                    ▼                                           ▼
  ┌──────────────────────────────────────┐    ┌──────────────────────────────────┐
  │ web/src/lib/message-window-store.ts  │    │ web/src/lib/fuzzyMatch.ts (NEW)  │
  │  (facade, < 80 lines)                │    │  exports levenshteinDistance     │
  │   re-exports public API from:        │    └──────────────────────────────────┘
  │   ├ messageWindowState.ts            │
  │   ├ messageWindowPaginationService.ts│
  │   ├ messageWindowMergeService.ts     │
  │   └ messageWindowSubscriptions.ts    │
  └──────────────────────────────────────┘

  ┌────────────────────────────────────────────────────────────────────────────┐
  │   ToolCard rendering pipeline (unchanged import topology — D-153)          │
  │                                                                              │
  │   ToolCard.tsx  ──► getToolPresentation (knownTools.tsx)                   │
  │           │                  │                                              │
  │           │                  └──► (fallback path, no match)                │
  │           │                       gets data-testid="tool-card-unknown-     │
  │           │                       fallback" — see D-156                    │
  │           │                                                                 │
  │           ├──► getToolViewComponent      (views/_all.tsx)                  │
  │           └──► getToolResultViewComponent (views/_results.tsx)             │
  │                       │                                                     │
  │                       └──► dispatcher (post-split):                        │
  │                              ├ inline: small views (TodoWrite, AskUserQ,  │
  │                              │   Markdown, Mutation, Generic, Skill)      │
  │                              └ extracted: views/results/                  │
  │                                    ├ BashResult.tsx                       │
  │                                    ├ LineListResult.tsx                   │
  │                                    └ ReadResult.tsx                       │
  │                              shared helpers extracted to:                  │
  │                              views/results/_resultHelpers.ts              │
  └────────────────────────────────────────────────────────────────────────────┘

   shared/src/ (NEW)        shared/src/uploads.ts ──► estimateBase64Bytes
                                                       MAX_UPLOAD_BYTES (recommended)
   consumed by:
       cli/src/modules/common/handlers/uploads.ts  (import, delete local impl)
       hub/src/web/routes/sessions/upload.ts       (import, delete local impl)
```

### Recommended Project Structure

```
web/src/
├── components/
│   ├── SessionList.tsx                      # orchestrator < 250 lines
│   ├── SessionList/                         # NEW dir (D-148)
│   │   ├── SessionListHeader.tsx
│   │   ├── SessionListSearch.tsx
│   │   ├── SessionListItem.tsx
│   │   └── SessionListEmpty.tsx
│   ├── SessionList.test.ts                  # existing; case redistribution per sub-component
│   ├── SessionList.directory-action.test.tsx  # existing; unchanged
│   ├── AssistantChat/
│   │   ├── HappyComposer.tsx                # orchestrator < 250 lines
│   │   ├── HappyComposerOverlays.tsx        # NEW (settings + autocomplete float)
│   │   ├── useHappyComposerState.ts         # NEW (lifted state)
│   │   └── useHappyComposerHandlers.ts      # NEW (callbacks)
│   └── ToolCard/
│       ├── ToolCard.tsx                     # unchanged (488 lines)
│       ├── ToolCard.integration.test.tsx    # NEW (D-156)
│       ├── knownTools.tsx                   # unchanged (423 lines) — receives data-testid
│       └── views/
│           ├── _results.tsx                 # dispatcher < 250 lines
│           ├── _results.test.tsx            # existing; case redistribution
│           └── results/                     # NEW dir (D-152)
│               ├── _resultHelpers.ts        # shared parse/render helpers
│               ├── BashResult.tsx
│               ├── LineListResult.tsx
│               └── ReadResult.tsx
├── lib/
│   ├── message-window-store.ts              # facade < 80 lines
│   ├── messageWindowState.ts                # NEW (D-149)
│   ├── messageWindowPaginationService.ts    # NEW (D-149)
│   ├── messageWindowMergeService.ts         # NEW (D-149)
│   ├── messageWindowSubscriptions.ts        # NEW (D-149)
│   ├── message-window-store.test.ts         # existing; unchanged (tests public API only)
│   └── fuzzyMatch.ts                        # NEW (D-154)
├── hooks/queries/
│   ├── _factory.ts                          # NEW (D-147 — createApiQuery)
│   ├── useSessions.ts                       # consumes _factory
│   ├── useSession.ts                        # consumes _factory
│   ├── useMachines.ts                       # consumes _factory
│   ├── useSkills.ts                         # import { levenshteinDistance } from '@/lib/fuzzyMatch'
│   ├── useSlashCommands.ts                  # ditto
│   ├── useGitStatusFiles.ts                 # left alone (custom queryFn — not a factory user)
│   ├── useSessionDirectory.ts               # left alone (deferred — shape B, see D-147)
│   ├── useSessionFileSearch.ts              # left alone (deferred — shape B)
│   └── useMessages.ts                       # left alone (not TanStack)
└── routes/settings/
    ├── index.tsx                            # orchestrator < 300 lines (route entry preserved)
    ├── _sections/                           # NEW dir (D-151; renamed from "tabs" since these are sections, not tabs)
    │   ├── LanguageSection.tsx
    │   ├── DisplaySection.tsx
    │   ├── ChatSection.tsx
    │   └── AboutSection.tsx
    └── useSettingsState.ts                  # NEW (lifted state hook)

shared/src/
└── uploads.ts                               # NEW: estimateBase64Bytes + MAX_UPLOAD_BYTES

scripts/
├── check-no-circular-web.sh                 # NEW (mirrors check-no-circular-hub.sh)
└── check-no-cut-agents.sh                   # MODIFIED: append Phase 9 sweep block
```

### Pattern 1: Facade re-export (P8 D-129 SessionCache analog → P9 D-149 message-window-store)

**What:** Original file becomes a thin re-export shell; consumers' import paths don't change.
**When to use:** Public API stable, internals decomposed into composition-only sub-modules.
**Example (from `hub/src/sync/sessionCache.ts`, P8 D-129 — confirmed present):**

The P8 SessionCache facade pattern uses **composition** (the facade class holds instances of sub-services and delegates methods) rather than **re-export** because `SessionCache` is a class. `message-window-store.ts` is **module-level functions** with module-private `Map` state, so the P9 analog will be **re-export-only facade** — much simpler:

```typescript
// web/src/lib/message-window-store.ts (post-split, ~30 lines)
export type { MessageWindowState } from './messageWindowState'
export {
    getMessageWindowState,
    subscribeMessageWindow,
    clearMessageWindow,
    seedMessageWindowFromSession,
} from './messageWindowSubscriptions'
export { setAtBottom } from './messageWindowState'
export {
    fetchLatestMessages,
    fetchOlderMessages,
} from './messageWindowPaginationService'
export {
    ingestIncomingMessages,
    appendOptimisticMessage,
    updateMessageStatus,
    removeOptimisticMessage,
    markMessagesConsumed,
    flushPendingMessages,
} from './messageWindowMergeService'
export {
    VISIBLE_WINDOW_SIZE,
    PENDING_WINDOW_SIZE,
} from './messageWindowState'
```

**Critical constraint (called out in CONTEXT specifics):** the 4 sub-modules **share the same module-private `Map<sessionId, InternalState>` and `Map<sessionId, Set<listener>>`**. The state Map MUST live in `messageWindowState.ts` and be exported as internal getters/setters (`getInternalState`, `setInternalState`, `updateInternalState`) consumed by the other three sub-modules. Sub-modules **must not** instantiate their own state Maps — that would create 4 disjoint stores.

### Pattern 2: Hook extraction (P9 D-148 / D-151)

**What:** Move `useState` / `useEffect` / `useCallback` chains out of the component body into named hooks.
**When to use:** Component file ≥ 500 lines and JSX is a small fraction of the file.
**Example (skeleton):**

```typescript
// web/src/components/AssistantChat/useHappyComposerState.ts
export function useHappyComposerState(props: HappyComposerProps) {
    const composerText = useAssistantState(({ composer }) => composer.text)
    const attachments = useAssistantState(({ composer }) => composer.attachments)
    // ... lift all useMemo / useState / useRef from current lines 74–300
    return { composerText, attachments, /* ... */ }
}
```

### Anti-Patterns to Avoid

- **Don't split into a 5th `message-window-store.ts` file by domain area only.** The 4 sub-modules in D-149 are correct; resist further fragmenting (`messageWindowPersistence.ts`, `messageWindowVisibilityCache.ts`) — those concerns are < 100 lines each and belong inside `messageWindowState.ts` to keep storage and notification scheduling co-located with the state Map they protect.
- **Don't extract every tiny `*ResultView` from `_results.tsx`.** Per Claude's discretion, extract only views ≥ 50 lines (see D-152 below) — small views shouldn't pay the import-overhead cost.
- **Don't introduce path aliases or index.ts barrel files for `SessionList/`.** Default-export from each file directly; orchestrator imports `from './SessionList/SessionListHeader'` etc. (consistent with rest of `web/src/components/`).
- **Don't refactor `useGitStatusFiles.ts` / `useSessionDirectory.ts` / `useSessionFileSearch.ts` into `createApiQuery`.** Their queryFn returns `{ items, error }` shape — different from shape A; defer as a separate refactor (see D-147).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cycle detection | Custom AST walker | `madge --circular --extensions ts,tsx` [CITED: P6 / P8 guards] | Established, fast, handles TS/TSX correctly |
| File size guard | Custom Node script | `find ... -exec wc -l {} \; \| awk '$1 >= N { print }'` [CITED: `scripts/check-no-cut-agents.sh:364`] | Direct copy from P8 D-143 #5 pattern |
| String pattern guard | Custom parser | `rg --no-heading -n PATTERN dirs [--glob '!...']` [CITED: `scripts/check-no-cut-agents.sh:80`] | Established in P1–P8 sweeps |
| React component test rendering | Manual `ReactDOM.render` | `@testing-library/react` `render(<Component />)` [CITED: `web/src/components/ToolCard/views/_results.test.tsx`] | Already in `web/package.json`; community standard |
| Levenshtein distance | Write your own | The existing 13-line implementation (D-154 — move, don't rewrite) | Already correct; mechanical move only |
| base64 byte estimation | Write your own | The existing 5-line implementation (D-154 — move, don't rewrite) | Algorithm identical in cli + hub; mechanical move only |
| Generic TanStack Query wrapper | Custom retry logic | The `useQuery` shell + a thin `createApiQuery` factory (D-147) | TanStack already handles retry, cache, stale time — factory only deduplicates the `api-null guard + return-shape unwrap` boilerplate |

**Key insight:** This phase deletes ~700 lines of duplication (two Levenshtein, two base64, ~150 lines of `useQuery` shell boilerplate, ~300 lines of inline state-management in `SessionList.tsx`). It does **not** introduce a single new external dependency, library, or abstraction beyond the `createApiQuery` factory (conditional on D-147).

## Common Pitfalls

### Pitfall 1: Splitting `message-window-store.ts` Into Separate Stores
**What goes wrong:** Each sub-module instantiates its own `Map<sessionId, InternalState>`, breaking state sharing.
**Why it happens:** The module-level `Map` is currently `const states = new Map<string, InternalState>()` at line 64 — easy to accidentally duplicate when copying functions across files.
**How to avoid:** Place `const states = new Map(...)` and `const listeners = new Map(...)` **only** in `messageWindowState.ts`. Export internal accessors (`getInternalState(sessionId)`, `updateInternalState(sessionId, updater, immediate?)`) — NOT the raw Map. Other sub-modules must consume those accessors.
**Warning signs:** Tests fail because state set in one operation isn't visible in another; or two listeners fire when only one should.

### Pitfall 2: `madge` Picks Up `web/dist/`
**What goes wrong:** Running `madge --circular --extensions ts,tsx web/src/` from repo root in P8 was reported to pick up `web/dist/` mermaid bundle (60+ false-positive cycles).
**Investigation result:** **Not reproducing in this repo at this time.** Both invocation forms (`cd web && npx madge --circular --extensions ts,tsx src/` and `npx madge --circular --extensions ts,tsx web/src/` from root) return **0 cycles** cleanly. `madge` with `--extensions ts,tsx` ignores `.js` / `.html` static assets, so `web/dist/` (currently containing only `404.html`, `apple-touch-icon-*.png`, `assets/`, etc.) doesn't pollute output. **However**, follow the P8 precedent for safety: use `cd web && npx madge ...` form + `--exclude '(^\.\./|web/dist)'` flag — see D-159 recommendation below.
**How to avoid:** Mirror `scripts/check-no-circular-hub.sh` exactly. Both forms work today, but `cd web && ...` form is robust to future `web/dist/` ts/tsx artifacts.
**Warning signs:** `madge` output includes paths starting with `dist/` or `../`.

### Pitfall 3: `data-testid` Anchor Placed in the Wrong Component
**What goes wrong:** `tool-card-unknown-fallback` testid added to `GenericResultView` in `_results.tsx` — but `GenericResultView` is INTENTIONALLY routed-to for `mcp__*` tools and any unrecognized result tool. The integration test would then fire for legitimate known tools (e.g. any MCP tool registered in `knownTools`).
**Why it happens:** The reasonable reading of CONTEXT D-156 is "fallback path in `_results.tsx`" — but `_results.tsx` doesn't have an "unknown tool" branch. `getToolResultViewComponent` (line 682) returns `GenericResultView` for both `mcp__*` (line 683-685) AND fallthrough (line 686). Both are intentional, not "unknown".
**How to avoid:** **Place the anchor in `knownTools.tsx` instead, on the WrenchIcon fallback path** (lines 392-422 — the branch that fires when `knownTools[opts.toolName]` is undefined). Wrap the `WrenchIcon` element with `data-testid="tool-card-unknown-fallback"`, or render a `<span data-testid="tool-card-unknown-fallback">` adjacent to the icon. The integration test asserts `queryByTestId('tool-card-unknown-fallback')` returns `null` for every `Object.keys(knownTools)` entry — which guarantees each known toolName successfully resolves via `getToolPresentation` (not fallback) and renders without crashing.
**Note for planner:** This is a **correction to CONTEXT D-156 / D-158 #5 location** — anchor in `knownTools.tsx`, not `_results.tsx`. The D-158 #5 guard should ripgrep `data-testid="tool-card-unknown-fallback"` with count = 1 in `web/src/components/ToolCard/knownTools.tsx` (not `_results.tsx`), and reverse-asserted in `ToolCard.integration.test.tsx`.
**Warning signs:** Integration test passes for `Bash` / `Edit` but fails for an MCP tool that's in `knownTools` — that's the misplaced anchor firing inside `GenericResultView`.

### Pitfall 4: Splitting `settings/index.tsx` By "Tab"
**What goes wrong:** CONTEXT D-151 and Claude's Discretion say "按 tab 拆" — but `routes/settings/index.tsx` has **no tab UI at all** (no `TabsTrigger`, `TabsContent`, or `tab` state). It has flat sections: Language, Display, Chat, About.
**How to avoid:** Use **section** as the split unit (`_sections/LanguageSection.tsx`, etc.). Naming follows existing convention. The orchestrator vertically stacks `<LanguageSection />`, `<DisplaySection />`, `<ChatSection />`, `<AboutSection />` inside the existing scroll container.
**Note for planner:** Rename CONTEXT's `_tabs/` proposal to `_sections/`. No functional difference; correct vocabulary only.

### Pitfall 5: Mis-claiming `message-window-store` Is Zustand
**What goes wrong:** CONTEXT specifics says "`message-window-store` 是 zustand store（确认前提）" and CONTEXT `.planning/codebase/STACK.md` reference implies the same. **It is not.**
**Reality:** The store is a hand-rolled pub/sub: `Map<sessionId, InternalState>` for state, `Map<sessionId, Set<listener>>` for subscriptions, `useSyncExternalStore` consumed in `useMessages.ts` (line 43). No `import { create } from 'zustand'` anywhere in the file. zustand is used elsewhere in the codebase (e.g., assistant-ui state), just not here.
**How to avoid:** Plan/execute D-149 wording with "module-level state Map + `useSyncExternalStore` subscription" framing, not "zustand store" framing. The split structure (4 sub-modules + facade) is still correct; only the description changes.
**Warning signs:** Planner writes "use zustand's `subscribe()`" in a task — that wouldn't compile.

## Runtime State Inventory

Phase 9 is a **pure source refactor with no rename/migration semantics**. No external strings change, no database keys change, no env vars / SOPS keys / task scheduler entries change. The only "state" changes are:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — `sessionStorage` keys (`hapi:message-window:v1:<sessionId>`) unchanged after store split | None |
| Live service config | None | None |
| OS-registered state | None | None |
| Secrets/env vars | None | None |
| Build artifacts | `web/dist/` will rebuild on next `bun run build`. No stale artifact concern because we don't change package names or entry points. | None |

**Nothing found in any category** — verified by grep over `web/src/lib/message-window-store.ts` (the `STORAGE_KEY_PREFIX = 'hapi:message-window:v1:'` at line 73 stays in `messageWindowState.ts` after split) and absence of rename/migration semantics in D-145 through D-159.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `bun` | All slices (`bun typecheck`, `bun run test`) | ✓ | (workspace) | — |
| `npx --no-install madge` | Slice 1 / Slice 4 cycles guard | ✓ | resolved via existing `package.json` (used by `check-no-circular-hub.sh`) | — |
| `rg` (ripgrep) | Slice 4 sweep block | ✓ | bundled with Cursor / available | — |
| `@testing-library/react` | Slice 1 integration test | ✓ | `web/package.json` (already used by existing `_results.test.tsx`) | — |
| `vitest` | All slices testing | ✓ | (project test runner) | — |

**Missing dependencies with no fallback:** none
**Missing dependencies with fallback:** none

## Resolved Open Questions (Answers to CONTEXT's 13 Researcher Prompts)

### Q1 — D-147 `createApiQuery` 3-user threshold check

**Files inventoried** (`web/src/hooks/queries/`):

| File | Pattern | Custom logic | Match shape? |
|------|---------|--------------|--------------|
| `useSessions.ts` | `useQuery({ queryKey, queryFn(api-null throw, api.getSessions), enabled: Boolean(api) })` returning `{ items, isLoading, error, refetch }` | none | **shape A (trivial shell)** ✓ |
| `useSession.ts` | same + sessionId arg + `enabled: Boolean(api && sessionId)` | none | **shape A** ✓ |
| `useMachines.ts` | same + extra `enabled` flag arg | none | **shape A** ✓ |
| `useSkills.ts` | shape A + `staleTime: Infinity, gcTime: 30*60*1000, retry: false` | heavy `getSuggestions` callback using `levenshteinDistance` | shape A' (extra cache options) |
| `useSlashCommands.ts` | same as `useSkills` | heavy `getSuggestions` + `mergeSlashCommands` | shape A' |
| `useGitStatusFiles.ts` | shape with `queryFn` returning `{ status, error }` + nested `Promise.all` | heavy queryFn (`buildGitStatusFiles` post-processing) | **shape B (data+error)** |
| `useSessionDirectory.ts` | shape with `queryFn` returning `{ entries, error }` | minimal | shape B |
| `useSessionFileSearch.ts` | shape with `queryFn` returning `{ files, error }` + extra `limit` arg | minimal | shape B |
| `useMessages.ts` | **NOT TanStack** — uses `useSyncExternalStore` over `message-window-store` | n/a | does not fit |

**Recommendation:** **ABSTRACT — threshold met for shape A.** 3 hooks (`useSessions`, `useSession`, `useMachines`) share the trivial-shell triple exactly. Build `web/src/hooks/queries/_factory.ts::createApiQuery` with signature:

```typescript
// Sketch (planner finalizes types):
export function createApiQuery<TData, TResult>(spec: {
    queryKey: (api: ApiClient | null, ...args: unknown[]) => readonly unknown[]
    queryFn: (api: ApiClient, ...args: unknown[]) => Promise<TData>
    select: (data: TData | undefined) => TResult
    enabled?: (api: ApiClient | null, ...args: unknown[]) => boolean
    errorMessage?: string
    queryOptions?: Partial<UseQueryOptions>  // for staleTime/gcTime/retry overrides (covers shape A')
}): (api: ApiClient | null, ...args: unknown[]) => {
    data: TResult
    isLoading: boolean
    error: string | null
    refetch: () => Promise<unknown>
}
```

**Scope of refactor in Slice 1:** Refactor only the 3 shape-A hooks. Optionally refactor the 2 shape-A' hooks (`useSkills` / `useSlashCommands`) to use `createApiQuery` for the `useQuery` shell while keeping `getSuggestions` callbacks inline — this is a stretch goal; planner's call. **Do NOT** refactor the 3 shape-B hooks in Phase 9 — their `{ data, error }` queryFn shape is different enough to warrant a separate factory (defer to a future phase).

**Verification post-abstraction:** D-158 #6 guard becomes active — ripgrep `createApiQuery` definition = 1 in `_factory.ts`, ≥ 3 imports across `useSessions.ts` + `useSession.ts` + `useMachines.ts` (and optionally `useSkills.ts` + `useSlashCommands.ts`).

### Q2 — D-156 fallback DOM anchor in `web/src/components/ToolCard/views/_results.tsx`

**Investigation result: `_results.tsx` HAS NO "unknown tool" fallback branch.** The dispatcher at line 682–687 routes every tool to *some* renderer:
- `toolName.startsWith('mcp__')` → `GenericResultView` (intentional, not fallback)
- else `toolResultViewRegistry[toolName] ?? GenericResultView` (registry lookup → fallthrough to `GenericResultView`)

`GenericResultView` is the catch-all that renders text/markdown/JSON for any unrecognized result. **There is no existing `data-testid` anywhere in `_results.tsx`** (verified by ripgrep — 0 hits).

**Recommendation:** **Place the anchor in `knownTools.tsx`, NOT `_results.tsx`.** See Pitfall 3 above for full rationale. Specifically:

```tsx
// web/src/components/ToolCard/knownTools.tsx (line 417-422 area)
return {
    icon: <WrenchIcon className={DEFAULT_ICON_CLASS} data-testid="tool-card-unknown-fallback" />,
    title,
    subtitle: subtitle && subtitle !== title ? truncate(subtitle, 80) : null,
    minimal: true
}
```

(`data-testid` on the icon's SVG, or on a wrapping `<span>` if the icon doesn't accept the prop.)

**Anchor string:** `tool-card-unknown-fallback` (recommended kebab-case value; matches CONTEXT default).

**Discrepancy note for planner:** This RELOCATES CONTEXT D-156 / D-158 #5 from `_results.tsx` to `knownTools.tsx`. The guard sweep ripgrep target also moves. Update D-158 #5 to read: `rg -c 'data-testid="tool-card-unknown-fallback"' web/src/components/ToolCard/knownTools.tsx` = 1 (instead of `_results.tsx`).

### Q3 — D-156 `knownTools` export shape

**Verified by reading `web/src/components/ToolCard/knownTools.tsx:57-62`:**

```typescript
export const knownTools: Record<string, {
    icon: (opts: ToolOpts) => ReactNode
    title: (opts: ToolOpts) => string
    subtitle?: (opts: ToolOpts) => string | null
    minimal?: boolean | ((opts: ToolOpts) => boolean)
}> = {
    Task: { ... },
    TeamCreate: { ... },
    // ... many more entries
}
```

**Recommendation:** Use `Object.keys(knownTools)` in the integration test (NOT `[...knownTools.keys()]`). Loop:

```typescript
Object.keys(knownTools).forEach((toolName) => {
    it(`renders ${toolName} without falling through to unknown fallback`, () => { ... })
})
```

### Q4 — D-156 ToolCard minimal-render props

**Verified TypeScript signature from `web/src/components/ToolCard/ToolCard.tsx:273-281`:**

```typescript
type ToolCardProps = {
    api: ApiClient
    sessionId: string
    metadata: SessionSummaryMetadata | null
    terminalToolDisplayMode: TerminalToolDisplayMode
    disabled: boolean
    onDone: () => void
    block: ToolCallBlock
}
```

**All 7 props required.** No optional props.

**Minimal mock factory recommendation (for `ToolCard.integration.test.tsx`):**

```typescript
function makeMinimalProps(toolName: string): ToolCardProps {
    const tool = {
        name: toolName,
        input: {},
        result: null,
        state: 'completed' as const,
        permission: null,
        description: null,
        startedAt: 0,
        createdAt: 0,
    }
    const block: ToolCallBlock = {
        kind: 'tool-call',
        id: `test-${toolName}`,
        tool,
        children: [],
    }
    return {
        api: {} as ApiClient,                  // not invoked in render-only test
        sessionId: 'test-session',
        metadata: null,
        terminalToolDisplayMode: 'compact',   // any value; tested branch is renderer routing
        disabled: false,
        onDone: () => {},
        block,
    }
}
```

**Note:** `api` is cast (`{} as ApiClient`) because the integration test asserts `render() doesn't throw` + `queryByTestId('tool-card-unknown-fallback') === null` — it doesn't trigger API calls. If a known tool's rendering path *does* touch `api` (e.g., permission action), the test will fail with a clear error, and the planner adds a stub method.

**Required mocks:** The test should wrap `<ToolCard>` in any required providers used by hooks inside it. Quick survey: `useTranslation` (from `web/src/lib/use-translation`) is used at line 287/323 — minimal `t={(k) => k}` mock may be needed if the hook reads from a context provider. Planner verifies in Slice 1.

### Q5 — D-151 settings tab/section list

**Reality check:** `routes/settings/index.tsx` has **no tabs** — no `TabsTrigger`, `TabsContent`, or tab-state machine. It has 4 flat vertical **sections** (visually divided by `border-b border-[var(--app-divider)]`), each rendered with a `<div className="border-b ...">` containing a section title + controls.

**Sections enumerated** (verified from JSX line ranges):

| # | Section | Section title key | Line range (in `index.tsx`) | Controls |
|---|---------|-------------------|-----------------------------|----------|
| 1 | **Language** | `t('settings.language.title')` | ~400–452 | Locale dropdown (en / zh-CN) |
| 2 | **Display** | `t('settings.display.title')` | ~454–610 | Appearance dropdown / Font size / Terminal font size / Session preview limit / Chat surface colors (×2 wrap up at top of next) |
| 3 | **Chat** | `t('settings.chat.title')` | ~612–727 | Composer enter behavior / Terminal tool display / Grouped tool background / User message background |
| 4 | **About** | `t('settings.about.title')` | ~729–753 | Website link / App version / Protocol version |

**Recommendation:** Split into 4 sub-components under `web/src/routes/settings/_sections/` (rename CONTEXT's `_tabs/` proposal):

```
web/src/routes/settings/
├── index.tsx                          # orchestrator: header + back nav + map sections
├── _sections/
│   ├── LanguageSection.tsx
│   ├── DisplaySection.tsx
│   ├── ChatSection.tsx
│   └── AboutSection.tsx
└── useSettingsState.ts                # consolidates: all the `useState(false)` open-dropdown flags + `useRef` outside-click handlers + the `useEffect` global click listener
```

**Lifted hook** (`useSettingsState.ts`): the 8 `useState`/`useRef` dropdown-open flags (`isOpen` / `isAppearanceOpen` / `isFontOpen` / `isTerminalFontOpen` / `isChatOpen` / `isTerminalToolDisplayOpen` / etc.) + the outside-click handler. Sub-section components consume `useSettingsState()` selectively OR pass open/setOpen tuples as props (planner's call).

**Other extracted helpers:** `SessionPreviewLimitControl`, `ChatSurfaceColorControl`, and the 4 inline SVG icons (`BackIcon`, `CheckIcon`, `ChevronDownIcon`, `MinusIcon`) currently live inline in `index.tsx`. Move icons to `_sections/_icons.tsx`. `*Control` helpers stay where they're consumed.

### Q6 — D-151 HappyComposer section boundaries

**Reality check:** `HappyComposer.tsx` (669 lines) **already extracts** most "visual sections" into separate sibling components (`StatusBar`, `ComposerButtons`, `AttachmentItem`, `Autocomplete`, `FloatingOverlay`). The JSX in `HappyComposer.tsx` (lines 598–668, ~70 lines) is already small. The bulk of the file is **hooks + handlers + overlay-composing `useMemo`** (lines 74–596, ~500 lines).

**Visual section confirmation** (from JSX lines 598–668):

| Section | Component | Already extracted? |
|---------|-----------|-------------------|
| StatusBar (above input) | `<StatusBar>` (`AssistantChat/StatusBar`) | ✅ |
| Attachments row | `<ComposerPrimitive.Attachments>` with `AttachmentItem` slot | ✅ |
| Input row (textarea) | `<ComposerPrimitive.Input>` (`@assistant-ui/react`) | ✅ |
| Send / abort / terminal button row | `<ComposerButtons>` (`AssistantChat/ComposerButtons`) | ✅ |
| Floating overlays (permission picker + model picker + autocomplete) | `useMemo` block lines 479–596, **inline** | ❌ → extract |

**Recommendation:** Split is **hook-heavy**, not "visual-section-heavy". 3-piece split:

```
web/src/components/AssistantChat/
├── HappyComposer.tsx              # orchestrator < 250 lines (JSX + minimal glue)
├── HappyComposerOverlays.tsx      # NEW: the overlays useMemo block (permission + model picker float + autocomplete float)
├── useHappyComposerState.ts       # NEW: state setup (lines ~75–250, useAssistantState selectors, derived flags, useMemo'd derived values, schedule lift, draft persistence wiring)
└── useHappyComposerHandlers.ts    # NEW: callbacks (lines ~250–477, handleChange / handleSelect / handleKeyDown / handlePaste / handleSubmit / handleAbort / handleSwitch / handleSend / handleSuggestionSelect / handlePermissionChange / handleModelChange / handleSettingsToggle)
```

This puts `HappyComposer.tsx` at ~150–200 lines (JSX returns + composing the 2 hooks + rendering `<HappyComposerOverlays>` + the existing inner components). No "send-controls split" needed — already done via `ComposerButtons`. **Therefore: 3 NEW files, not 4 or 5.**

### Q7 — D-152 per-tool result child count

**Per-view line counts** in `_results.tsx` (verified):

| Result View | Lines | Count | Threshold action (≥ 50 = extract) |
|-------------|-------|-------|------------------------------------|
| `AskUserQuestionResultView` | 385–396 | 12 | inline |
| `BashResultView` | 398–445 | **48** | borderline; **EXTRACT** (close to 50, distinct concern: stdout/stderr handling) |
| `MarkdownResultView` | 447–470 | 24 | inline |
| `LineListResultView` | 472–523 | **52** | **EXTRACT** |
| `ReadResultView` | 525–566 | **42** | borderline; **EXTRACT** (distinct concern: file content + path resolution) |
| `MutationResultView` | 568–598 | 31 | inline |
| `TodoWriteResultView` | 600–607 | 8 | inline |
| `SkillResultView` | 609–632 | 24 | inline |
| `GenericResultView` | 634–658 | 25 | inline |
| Registry + dispatcher | 660–687 | 28 | stays in `_results.tsx` |
| **Shared helpers** | 1–383 | **~380** | **EXTRACT to `_resultHelpers.ts`** — too large to leave with dispatcher |

**Recommendation (D-152 + Claude's discretion ≥ 50 threshold, with one borderline tightening):**

Create `web/src/components/ToolCard/views/results/`:
- `_resultHelpers.ts` — all parsing/rendering helpers (`extractTextFromResult`, `renderText`, `renderMarkdown`, `renderResultBody`, `renderPlainTextQuote`, `looksLikeJson` / `looksLikeHtml` / `parseStandaloneMarkdownCodeBlock`, `codeLanguageByExtension`, `inferCodeLanguage*`, `resultCodeBlockProps`, `placeholderForState`, `RawJsonDevOnly`, `extractStdoutStderr`, `extractReadFileContent`, `isReadFileToolCall`, `extractReadPathFromInput`, `renderReadTextResult`, `ResultMetaPill`, `ResultStatusPill`, `extractLineList`, `isProbablyMarkdownList`, `getMutationResultRenderMode`)
- `BashResult.tsx` — `BashResultView` (48 lines + helpers imports)
- `LineListResult.tsx` — `LineListResultView` (52 lines + helpers imports)
- `ReadResult.tsx` — `ReadResultView` (42 lines + helpers imports)

`_results.tsx` (post-split, dispatcher only):
- Import helpers from `./results/_resultHelpers`
- Import 3 extracted views from `./results/`
- Keep 6 inline views (AskUserQuestion 12, Markdown 24, Mutation 31, TodoWrite 8, Skill 24, Generic 25 = ~125 lines)
- Registry + `getToolResultViewComponent` (28 lines)
- Re-export `extractTextFromResult`, `getMutationResultRenderMode` (currently exported at lines 32/90 — preserved for outside callers)
- **Total post-split: ~180–200 lines** (under the < 250 budget)

**Note on test redistribution (`_results.test.tsx`):** Cases for `BashResultView` / `LineListResultView` / `ReadResultView` move to colocated test files (`BashResult.test.tsx` etc.). Cases for inline views stay in `_results.test.tsx`. Existing test infrastructure (RTL setup) is reusable as-is.

### Q8 — D-149 message-window-store sub-module boundaries

**File structure analysis** (`web/src/lib/message-window-store.ts`, 1088 lines):

| Concern | Functions / blocks | Line range | Approx size |
|---------|--------------------|------------|-------------|
| **State shape + Maps + buildState** | Types (`MessageWindowState`, `InternalState`, `PersistedMessageWindowState`, `PendingVisibilityCacheEntry`, `AsyncGenerationKind`); `const states = new Map`; `const listeners = new Map`; `const pendingVisibilityCacheBySession = new Map`; `getState` / `createState` / `notify` / `notifyImmediate` / `setState` / `updateState`; generation helpers (`beginAsyncGeneration`, `getGeneration`, `setGeneration`, `isCurrentGeneration`, `updateStateForGeneration`); `deriveSeqBounds`, `deriveOldestPosition`; `buildState` | ~7–62 + 248–402 + 531–583 | **~270 lines** |
| **Persistence + notify scheduling + pending visibility cache** | `scheduleNotify` / `flushNotifications`; `getStorageKey` / `isSessionStorageAvailable` / `toNullableNumber` / `shouldPersistState` / `persistState` / `clearPersistedState` / `flushPersistedStates` / `schedulePersist`; `getPendingVisibilityCache` / `clearPendingVisibilityCache` / `isVisiblePendingMessage` / `countVisiblePendingMessages` / `syncPendingVisibilityCache`; `hydrateState` | ~64–246 + 272–302 | **~210 lines** |
| **Pagination + cold-load backfill + trim** | `VISIBLE_WINDOW_SIZE` / `PENDING_WINDOW_SIZE` / `AGENT_RUN_WINDOW_SIZE` / `PAGE_SIZE` / `COLD_LOAD_*` consts; `isAgentRunMessage` / `countRegularMessages` / `sameCursor` / `backfillColdLoadMessages` / `sliceForTrim` / `trimPreservingQueued` / `trimVisible` / `trimVisibleWithDropped` / `cursorUpdatesAfterAppendTrim` / `trimPending`; **`fetchLatestMessages` + `fetchOlderMessages`** (public API) | ~22–28, 427–658, 760–860 | **~340 lines** |
| **Merge (SSE / patch) + status mutation** | `filterPendingAgainstVisible` / `isOptimisticMessage` / `mergeIntoPending`; **public mutators**: `ingestIncomingMessages` / `flushPendingMessages` / `setAtBottom` / `appendOptimisticMessage` / `updateMessageStatus` / `removeOptimisticMessage` / `markMessagesConsumed` | ~660–699, 862–950, 952–1088 | **~330 lines** |
| **Subscribe / dispose / seed** | `subscribeMessageWindow` / `clearMessageWindow` / `seedMessageWindowFromSession`; `getMessageWindowState` (public selector) | ~701–758 | **~60 lines** |

**Recommendation (4 sub-modules + facade, per D-149):**

| File | Owns | Lines (est) |
|------|------|-------------|
| `messageWindowState.ts` | Types + `states` / `listeners` / `pendingVisibilityCacheBySession` Maps + `getState` / `createState` / `notify*` / `setState` / `updateState` / generation helpers + `buildState` + window-size constants + persistence helpers (`persistState` / `hydrateState` / `schedulePersist` / `flushPersistedStates` / `clearPersistedState` / storage-key helpers) + visibility cache helpers + `scheduleNotify` / `flushNotifications` + `setAtBottom` (small public mutator that's really state-shape level) + `getMessageWindowState` (selector) | **~430** ⚠️ |
| `messageWindowPaginationService.ts` | `isAgentRunMessage` / `countRegularMessages` / `sameCursor` / `backfillColdLoadMessages` / `sliceForTrim` / `trimPreservingQueued` / `trimVisible` / `trimVisibleWithDropped` / `cursorUpdatesAfterAppendTrim` / `trimPending` + `fetchLatestMessages` + `fetchOlderMessages` | **~340** |
| `messageWindowMergeService.ts` | `filterPendingAgainstVisible` / `isOptimisticMessage` / `mergeIntoPending` + `ingestIncomingMessages` / `flushPendingMessages` / `appendOptimisticMessage` / `updateMessageStatus` / `removeOptimisticMessage` / `markMessagesConsumed` | **~330** |
| `messageWindowSubscriptions.ts` | `subscribeMessageWindow` / `clearMessageWindow` / `seedMessageWindowFromSession` | **~60** |
| `message-window-store.ts` (facade) | re-exports public API only | **~40** |

**⚠️ Sizing concern:** `messageWindowState.ts` lands at ~430 lines — slightly OVER the < 400 budget set in D-149. Two planner options:

- **Option A (preferred):** Extract `messageWindowPersistence.ts` as a 5th sub-module (~150 lines: `persistState`, `hydrateState`, `schedulePersist`, `flushPersistedStates`, `clearPersistedState`, `shouldPersistState`, `getStorageKey`, `isSessionStorageAvailable`, `toNullableNumber`). Then `messageWindowState.ts` lands at ~280 lines, comfortably under budget. This deviates from CONTEXT D-149's "4 sub-module" count but improves separation. **Recommend Option A; document deviation in plan.**
- **Option B:** Keep 4 sub-modules; accept `messageWindowState.ts` at ~430 lines and adjust the D-157 Slice 2 file-size threshold for store sub-modules to `< 450` (vs `< 400`).

**Critical implementation constraint:** Sub-modules access shared Maps via accessor functions exported from `messageWindowState.ts` (e.g., `getInternalState(sessionId): InternalState`, `updateInternalState(sessionId, updater, immediate?)`). The Maps themselves stay module-private in `messageWindowState.ts`. **Do not duplicate the Maps across sub-modules.**

### Q9 — Claude's Discretion: `MAX_UPLOAD_BYTES` constant

**Verified via Read:**

- `cli/src/modules/common/handlers/uploads.ts:38` — `const MAX_UPLOAD_BYTES = 50 * 1024 * 1024`
- `hub/src/web/routes/sessions/upload.ts:18` — `const MAX_UPLOAD_BYTES = 50 * 1024 * 1024`
- `web/src/` — no hit (ripgrep returned no matches; web uses server-enforced 413 response)

**Both** cli + hub define the **same value** (50 MiB). web does not define it.

**Recommendation:** **Co-locate `MAX_UPLOAD_BYTES` in `shared/src/uploads.ts`** alongside `estimateBase64Bytes`. Mechanical refactor: 2 callsite deletions, 2 import line changes.

```typescript
// shared/src/uploads.ts (NEW)
export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024

export function estimateBase64Bytes(base64: string): number {
    const len = base64.length
    if (len === 0) return 0
    const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0
    return Math.floor((len * 3) / 4) - padding
}
```

This avoids the constant + function getting separated in the future. Aligns with CONTEXT Claude's Discretion default recommendation.

**Note for planner:** The shared/ package's existing entry (`@hapi/protocol`) re-exports from `shared/src/index.ts`. Decide whether `uploads` becomes a sub-entry (`@hapi/protocol/uploads`) or part of the main entry. Inspect `shared/package.json` `exports` field in Slice 1. CONTEXT canonical_refs mentions `'@hapi/protocol/uploads'` and `'@hapi/protocol/types'` — implying sub-path exports are already supported.

### Q10 — Claude's Discretion: `madge --exclude` for `web/dist` pollution

**Investigation result (tested both forms with `madge` versions available in the workspace):**

```bash
# Form 1: cd into web/ (mirror of P8)
cd /home/harry/projects/hapi-cursor/web && npx --no-install madge --circular --extensions ts,tsx src/
# Output: ✔ No circular dependency found! (processed 280 files, 221 warnings, 800ms)

# Form 2: from repo root
cd /home/harry/projects/hapi-cursor && npx --no-install madge --circular --extensions ts,tsx web/src/
# Output: ✔ No circular dependency found! (processed 280 files, 221 warnings, 783ms)
```

**Both forms return 0 cycles cleanly.** No `web/dist/` pollution observed (madge with `--extensions ts,tsx` skips `.js`/`.html`/`.png` assets; `web/dist/` currently contains only static build artifacts).

**Recommendation:** **Use the `cd web && ... src/` form** (matches `scripts/check-no-circular-hub.sh` exactly), with `--exclude '(^\.\./|web/dist)'` for defense-in-depth against future `web/dist/` ts/tsx artifacts. Final `scripts/check-no-circular-web.sh`:

```bash
#!/usr/bin/env bash
# scripts/check-no-circular-web.sh
# Phase-9 madge guard — asserts web/src/ has zero internal circular deps.
# The --exclude pattern filters out (a) any ../shared sibling sourcemap-derived
# walks and (b) any accidental import that resolved up out of web/src/. Running
# from web/ keeps madge's resolver scoped to the web workspace.
set -euo pipefail

cd "$(dirname "$0")/.."
cd web

output=$(npx --no-install madge --circular --extensions ts,tsx --exclude '(^\.\./|web/dist)' src/ 2>&1) || exit_code=$?
exit_code=${exit_code:-0}

if [ "$exit_code" -ne 0 ] || echo "$output" | grep -q '^[0-9]\+)'; then
    echo "❌ Phase-9 madge: circular dependency in web/src/:" >&2
    echo "$output" >&2
    echo "Run: cd web && npx madge --circular --extensions ts,tsx --exclude '(^\\.\\./|web/dist)' src/" >&2
    exit 1
fi

echo "✅ No circular dependencies in web/src/ (madge)."
```

### Q11 — `scripts/check-no-cut-agents.sh` current structure (insertion point for Phase 9 sweep)

**Verified structure:**

```
Lines 1–22:    Shebang + header comment (categories Phase-1 through Phase-5)
Lines 23–30:   ripgrep binary detection (rg)
Lines 31–69:   Pattern constants (PHASE1/2/3/4/5)
Lines 70–85:   PHASE4_WHITELIST array
Lines 86–214:  Sweep blocks in order:
                  - Phase 1/2/5 main (PATTERN — agent literals)
                  - Phase 3 namespace
                  - Phase 4 hard + sweep
                  - Phase 5 identifier + branch
                  - Phase 6 (duplicate helper / cast / canonical def / madge / JSDoc anchor) — 5 sub-checks
                  - Phase 7 (heuristic / Machine dup / Schema dup / codex literal / metadata.flavor) — 6 sub-checks
Lines 286–386: Phase 8 sweep block (5 numbered sub-checks D-143 #1–#5) then `bash check-no-circular-hub.sh` tail
Line 387:      Final echo: "✅ Phase 8 guard PASS ..."
```

**Helper patterns reused across phases:**
- `"$RG_BIN" --no-heading -n PATTERN dirs --glob '!**/*.test.ts'` for source-only sweeps
- `find ... -maxdepth 1 -name '*.ts' ! -name '*.test.ts' -exec wc -l {} \; | awk '$1 >= N { print }'` for file-size budgets (P8 D-143 #5 — copy this exactly)
- Tail-invocation of per-package `check-no-circular-X.sh` keeps the gate to a single command

**Insertion point for Phase 9:** **Immediately after line 386 (Phase 8's "PASS" echo)**, before EOF. Add a `# ===== Phase 9 — Web internal decoupling (D-158) =====` heading and 5–6 numbered sub-checks. End with `bash "$(dirname "$0")/check-no-circular-web.sh"` and a final `echo "✅ Phase 9 guard PASS ..."`.

**Recommended Phase 9 sweep block (skeleton for planner to copy):**

```bash
# ===== Phase 9 — Web internal decoupling (D-158) =====
PHASE9_WEB_SCOPE=(web/src)
PHASE9_NON_WEB=(cli/src hub/src shared/src)

# (#1) D-158 #1 — levenshteinDistance: exactly 1 hit in web/src/lib/fuzzyMatch.ts, 0 elsewhere
PHASE9_LEV_HITS=$("$RG_BIN" -n '\bfunction levenshteinDistance\b|\bfunction levenshtein\b' "${PHASE9_WEB_SCOPE[@]}" 2>/dev/null || true)
PHASE9_LEV_COUNT=$(echo -n "$PHASE9_LEV_HITS" | grep -c '^' || true)
if [ "$PHASE9_LEV_COUNT" -ne 1 ] || ! echo "$PHASE9_LEV_HITS" | grep -q 'web/src/lib/fuzzyMatch\.ts'; then
  echo "$PHASE9_LEV_HITS"
  echo "❌ Phase 9 D-158 #1: levenshteinDistance must be defined exactly once in web/src/lib/fuzzyMatch.ts."
  exit 1
fi
if "$RG_BIN" -n '\bfunction levenshteinDistance\b|\bfunction levenshtein\b' "${PHASE9_NON_WEB[@]}" 2>/dev/null; then
  echo "❌ Phase 9 D-158 #1: levenshteinDistance leaked outside web/src/ (REFW-03 + D-155 boundary violated)."
  exit 1
fi
echo "✅ Phase 9 D-158 #1: levenshteinDistance lives only in web/src/lib/fuzzyMatch.ts."

# (#2) D-158 #2 — estimateBase64Bytes: exactly 1 hit in shared/src/uploads.ts, 0 elsewhere
PHASE9_B64_HITS=$("$RG_BIN" -n '\bfunction estimateBase64Bytes\b' shared/src 2>/dev/null || true)
PHASE9_B64_COUNT=$(echo -n "$PHASE9_B64_HITS" | grep -c '^' || true)
if [ "$PHASE9_B64_COUNT" -ne 1 ] || ! echo "$PHASE9_B64_HITS" | grep -q 'shared/src/uploads\.ts'; then
  echo "$PHASE9_B64_HITS"
  echo "❌ Phase 9 D-158 #2: estimateBase64Bytes must be defined exactly once in shared/src/uploads.ts."
  exit 1
fi
if "$RG_BIN" -n '\bfunction estimateBase64Bytes\b' cli/src hub/src web/src 2>/dev/null; then
  echo "❌ Phase 9 D-158 #2: estimateBase64Bytes leaked outside shared/src/ (REFW-03 violated)."
  exit 1
fi
echo "✅ Phase 9 D-158 #2: estimateBase64Bytes lives only in shared/src/uploads.ts."

# (#3) D-158 #4 — file-size budgets for Phase-9-split files + verify-only targets
PHASE9_OVERSIZED=$(
  wc -l \
    web/src/components/SessionList.tsx \
    web/src/lib/message-window-store.ts \
    web/src/routes/settings/index.tsx \
    web/src/components/AssistantChat/HappyComposer.tsx \
    web/src/components/ToolCard/views/_results.tsx \
    web/src/chat/reducerTimeline.ts \
    web/src/components/ToolCard/ToolCard.tsx \
    web/src/components/ToolCard/knownTools.tsx \
    web/src/components/ToolCard/views/_all.tsx \
    2>/dev/null | awk '
      /reducerTimeline\.ts/  { if ($1 >= 500) print }
      /SessionList\.tsx/      { if ($1 >= 500) print }
      /message-window-store\.ts/ { if ($1 >= 500) print }
      /settings\/index\.tsx/  { if ($1 >= 500) print }
      /HappyComposer\.tsx/    { if ($1 >= 500) print }
      /_results\.tsx/         { if ($1 >= 500) print }
      /ToolCard\.tsx/         { if ($1 >= 500) print }
      /knownTools\.tsx/       { if ($1 >= 500) print }
      /_all\.tsx/             { if ($1 >= 200) print }
    ')
if [ -n "$PHASE9_OVERSIZED" ]; then
  echo "$PHASE9_OVERSIZED"
  echo "❌ Phase 9 D-158 #4: file-size red-line breached. See ROADMAP SC#2 + D-145 + D-157."
  exit 1
fi
echo "✅ Phase 9 D-158 #4: file-size budgets honored."

# (#4) D-158 #4 — store sub-module budgets (< 400 each, or < 450 if Option B chosen)
PHASE9_STORE_OVERSIZED=$(find web/src/lib -maxdepth 1 -name 'messageWindow*.ts' ! -name '*.test.ts' -exec wc -l {} \; 2>/dev/null | awk '$1 >= 400 { print }')
if [ -n "$PHASE9_STORE_OVERSIZED" ]; then
  echo "$PHASE9_STORE_OVERSIZED"
  echo "❌ Phase 9 D-158 #4: message-window sub-module ≥ 400 lines (D-149 violated)."
  exit 1
fi
echo "✅ Phase 9 D-158 #4: message-window sub-modules each < 400."

# (#5) D-158 #5 — fallback testid present in knownTools.tsx (NOT _results.tsx — see Pitfall 3)
PHASE9_TESTID_HITS=$("$RG_BIN" -c 'data-testid="tool-card-unknown-fallback"' web/src/components/ToolCard/knownTools.tsx 2>/dev/null || echo 0)
if [ "$PHASE9_TESTID_HITS" -ne 1 ]; then
  echo "❌ Phase 9 D-158 #5: data-testid=\"tool-card-unknown-fallback\" must appear exactly once in knownTools.tsx (found $PHASE9_TESTID_HITS)."
  exit 1
fi
# Reverse-assert that integration test uses queryByTestId on the anchor
if ! "$RG_BIN" -q 'queryByTestId\([^)]*tool-card-unknown-fallback' web/src/components/ToolCard/ToolCard.integration.test.tsx 2>/dev/null; then
  echo "❌ Phase 9 D-158 #5: ToolCard.integration.test.tsx must reverse-assert queryByTestId('tool-card-unknown-fallback')."
  exit 1
fi
echo "✅ Phase 9 D-158 #5: fallback testid anchored in knownTools.tsx + reverse-asserted in integration test."

# (#6) D-158 #6 — createApiQuery (D-147 ABSTRACTED per research)
PHASE9_FACTORY_DEF=$("$RG_BIN" -c '^export function createApiQuery\b' web/src/hooks/queries/_factory.ts 2>/dev/null || echo 0)
if [ "$PHASE9_FACTORY_DEF" -ne 1 ]; then
  echo "❌ Phase 9 D-158 #6: createApiQuery must be defined exactly once in web/src/hooks/queries/_factory.ts."
  exit 1
fi
PHASE9_FACTORY_USERS=$("$RG_BIN" -l 'createApiQuery' web/src/hooks/queries/ --glob '!_factory.ts' --glob '!*.test.*' 2>/dev/null | wc -l)
if [ "$PHASE9_FACTORY_USERS" -lt 3 ]; then
  echo "❌ Phase 9 D-158 #6: createApiQuery must have ≥ 3 importer files in web/src/hooks/queries/ (found $PHASE9_FACTORY_USERS)."
  exit 1
fi
echo "✅ Phase 9 D-158 #6: createApiQuery defined once + ≥ 3 users."

# (#7) D-158 #3 — tail-invocation of madge cycle guard
bash "$(dirname "$0")/check-no-circular-web.sh"

echo "✅ Phase 9 guard PASS (D-158 #1–#6 + madge zero cycles)."
```

### Q12 — Pattern map: P8 message-window-store analog (P8 D-129 SessionCache facade)

**Verified `hub/src/sync/sessionCache.ts` exists** (referenced in Phase 8 guard line 309 as `class SessionCache` source-of-truth). P8 D-129 uses class-based composition: `SessionCache` is a class whose methods delegate to `sessionRepository / sessionLivenessService / sessionConfigService / sessionMergeService` instances.

**Analog for P9 message-window-store:** The two are STRUCTURALLY DIFFERENT (P8 is class, P9 is module functions), so the facade form differs:

| | P8 SessionCache | P9 message-window-store |
|--|----------------|-------------------------|
| Surface | Single class | Module-exported functions |
| Facade form | Class with private sub-service instances + delegating methods | Module that re-exports public API from sub-modules |
| Shared state | Class instance fields | Module-private Maps in `messageWindowState.ts` |
| Outside caller change | `new SessionCache(...)` unchanged | `import { ... } from '@/lib/message-window-store'` unchanged |
| Sub-module exposure | Sub-services constructed inside class, not exported | Sub-modules export internal accessors; outside callers only see facade re-exports |

**Cite as analog (planner):** Reference `hub/src/sync/sessionCache.ts` for the *intent* (thin public surface, internals decomposed, callers unchanged) but **do not literal-copy the class composition pattern** — module-level functions don't have a `this` to compose around. Use re-export pattern instead.

### Q13 — Existing tests baseline

**Test files inventory** (verified via shell `find web/src -name '*.test.*'`):

| Component | Test file exists? | Path | Action in Phase 9 |
|-----------|-------------------|------|-------------------|
| `SessionList.tsx` | ✅ YES | `web/src/components/SessionList.test.ts` | Slice 2: split cases by sub-component into `SessionList/*.test.tsx` |
| `SessionList.tsx` (directory action) | ✅ YES | `web/src/components/SessionList.directory-action.test.tsx` | Slice 2: unchanged (already focused) |
| `message-window-store.ts` | ✅ YES | `web/src/lib/message-window-store.test.ts` | Slice 2: unchanged (tests public API via facade — should keep passing without modification) |
| `settings/index.tsx` | ❌ NO | — | Slice 3: create `_sections/*.test.tsx` colocated with each section (RTL render + interact); orchestrator stays untested (route entry only) |
| `HappyComposer.tsx` | ❌ NO | — | Slice 3: optional — create `useHappyComposerState.test.ts` if state hook has nontrivial logic; component-level RTL test optional (would be high-effort given `@assistant-ui/react` setup) |
| `_results.tsx` | ✅ YES | `web/src/components/ToolCard/views/_results.test.tsx` | Slice 3: redistribute cases for extracted views to `results/*.test.tsx`; inline-view cases stay |
| `ToolCard.tsx` | ✅ YES | `web/src/components/ToolCard/ToolCard.test.ts` | Slice 1: unchanged. New integration test (`ToolCard.integration.test.tsx`) is a sibling. |
| `knownTools.tsx` | ✅ YES | `web/src/components/ToolCard/knownTools.test.tsx` | Slice 1: extend to verify `data-testid="tool-card-unknown-fallback"` renders on unknown-tool fallback (sister coverage) |

**Implications for plan:**
- 4 of 5 split-target files have existing tests → **reuse existing RTL setup**; no new test infrastructure
- 1 file (`settings/index.tsx`) has no test → **Slice 3 adds first-time RTL coverage** for the new sections
- `message-window-store.test.ts` tests the public API via current export names; if facade re-export preserves names exactly (D-149), test passes without modification — strong invariant for Slice 2

## Code Examples

### Example 1: `createApiQuery` factory (D-147)

```typescript
// web/src/hooks/queries/_factory.ts (NEW)
import { useQuery, type UseQueryOptions } from '@tanstack/react-query'
import type { ApiClient } from '@/api/client'

export function createApiQuery<TRaw, TResult>(spec: {
    queryKey: (sessionId: string | null) => readonly unknown[]
    queryFn: (api: ApiClient, sessionId: string | null) => Promise<TRaw>
    select: (data: TRaw | undefined) => TResult
    enabled?: (api: ApiClient | null, sessionId: string | null) => boolean
    errorMessage: string
    queryOptions?: Partial<UseQueryOptions<TRaw, Error>>
}) {
    return function useApiQuery(api: ApiClient | null, sessionId: string | null): {
        data: TResult
        isLoading: boolean
        error: string | null
        refetch: () => Promise<unknown>
    } {
        const isEnabled = spec.enabled
            ? spec.enabled(api, sessionId)
            : Boolean(api)

        const query = useQuery({
            queryKey: spec.queryKey(sessionId),
            queryFn: async () => {
                if (!api) throw new Error(spec.errorMessage)
                return spec.queryFn(api, sessionId)
            },
            enabled: isEnabled,
            ...spec.queryOptions,
        })

        return {
            data: spec.select(query.data),
            isLoading: query.isLoading,
            error: query.error instanceof Error
                ? query.error.message
                : query.error ? spec.errorMessage : null,
            refetch: query.refetch,
        }
    }
}
```

**Usage (post-refactor):**

```typescript
// web/src/hooks/queries/useSessions.ts (REFACTORED)
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

### Example 2: `ToolCard.integration.test.tsx` (D-156)

```typescript
// web/src/components/ToolCard/ToolCard.integration.test.tsx (NEW)
import { render, cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { knownTools } from './knownTools'
import { ToolCard } from './ToolCard'
import type { ToolCallBlock } from '@/chat/types'
import type { ApiClient } from '@/api/client'

afterEach(cleanup)

function makeMinimalProps(toolName: string) {
    const block: ToolCallBlock = {
        kind: 'tool-call',
        id: `test-${toolName}`,
        tool: {
            name: toolName,
            input: {},
            result: null,
            state: 'completed',
            permission: null,
            description: null,
            startedAt: 0,
            createdAt: 0,
        },
        children: [],
    }
    return {
        api: {} as ApiClient,
        sessionId: 'test-session',
        metadata: null,
        terminalToolDisplayMode: 'compact' as const,
        disabled: false,
        onDone: () => {},
        block,
    }
}

describe('ToolCard integration: every knownTool resolves to a renderer', () => {
    for (const toolName of Object.keys(knownTools)) {
        it(`renders ${toolName} without falling through to unknown fallback`, () => {
            const { container, queryByTestId } = render(<ToolCard {...makeMinimalProps(toolName)} />)
            // (a) render must not throw
            expect(container).toBeTruthy()
            // (b) must not hit the unknown-tool fallback anchor (in knownTools.tsx WrenchIcon path)
            expect(queryByTestId('tool-card-unknown-fallback')).toBeNull()
        })
    }

    it('DOES hit unknown-tool fallback for an unregistered toolName (negative control)', () => {
        const { queryByTestId } = render(<ToolCard {...makeMinimalProps('definitely_not_a_known_tool_xyz')} />)
        expect(queryByTestId('tool-card-unknown-fallback')).not.toBeNull()
    })
})
```

### Example 3: `messageWindowState.ts` accessor exports (D-149 implementation pattern)

```typescript
// web/src/lib/messageWindowState.ts (NEW)
// ... types + Maps + buildState (kept module-private) ...

// Internal accessors consumed by sibling sub-modules:
export function getInternalState(sessionId: string): InternalState {
    return getState(sessionId)
}

export function updateInternalState(
    sessionId: string,
    updater: (prev: InternalState) => InternalState,
    immediate?: boolean,
): void {
    updateState(sessionId, updater, immediate)
}

export function getInternalListeners(sessionId: string): Set<() => void> | undefined {
    return listeners.get(sessionId)
}

// Public APIs that genuinely belong here (state-shape level):
export function getMessageWindowState(sessionId: string): MessageWindowState {
    return getState(sessionId)
}
export function setAtBottom(sessionId: string, atBottom: boolean): void { /* ... */ }
```

```typescript
// web/src/lib/messageWindowMergeService.ts (NEW)
import { getInternalState, updateInternalState } from './messageWindowState'
// ... use getInternalState/updateInternalState everywhere previously using local getState/updateState
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Per-package duplicated `levenshteinDistance` | Single source in `web/src/lib/fuzzyMatch.ts` | Phase 9 | -23 lines of duplication; one place to fix bugs |
| Per-package duplicated `estimateBase64Bytes` + `MAX_UPLOAD_BYTES` | Single source in `shared/src/uploads.ts` | Phase 9 | -12 lines of duplication; survives future cli/hub/web upload feature additions |
| 9 hand-rolled `useQuery` shells in `web/src/hooks/queries/` | 3 of 9 use `createApiQuery` factory (others differ enough to leave alone) | Phase 9 | -45 lines (~15 per hook); future hooks of shape A get factory for free |
| 953-line `SessionList.tsx` god-component | Orchestrator + 4 hooks + 4 sub-components | Phase 9 | Each piece individually testable; cognitive load per file < 250 lines |
| 1088-line `message-window-store.ts` | Facade + 4–5 sub-modules | Phase 9 | Pagination, merge, persistence concerns separately auditable |
| `madge --circular` reported only at human review time | Enforced via `check-no-circular-web.sh` in phase gate | Phase 9 | Cycle regressions blocked at CI / commit time |

**Deprecated/outdated:**
- The CONTEXT specifics' claim that `message-window-store` is zustand: **not deprecated, never was true.** Researcher correction; not blocking.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `createApiQuery` factory shape proposed in Q1 will accommodate `useSkills`/`useSlashCommands` cache-options variant (shape A') via the `queryOptions` spread | Q1 D-147 | Low — planner discovers TS-friction in Slice 1; can scope factory to shape A only without breaking the 3-user threshold |
| A2 | Wrapping `WrenchIcon` with `data-testid` works as expected (the SVG icon component accepts arbitrary DOM props) | Q2 D-156 | Low — fallback is to wrap icon in a `<span data-testid="...">`; trivial |
| A3 | All `knownTools[X]` entries can render via minimal `block` mock with `input: {}` and `result: null` | Q4 D-156 | Medium — some entries' `title` function may throw if a specific input field is missing; planner gracefully fails the failing case + adds richer mock per-tool in Slice 1 |
| A4 | `messageWindowState.ts` lands at ~430 lines (over budget); Option A (5-file split) is recommended | Q8 D-149 | Low — Option B (keep 4 files, raise threshold to < 450) is a stated fallback |
| A5 | `shared/package.json` `exports` field supports sub-path `@hapi/protocol/uploads` (CONTEXT canonical_refs implies it) | Q9 (Claude's discretion) | Low — verify in Slice 1; if not, use root entry `@hapi/protocol` and re-export from `shared/src/index.ts` |
| A6 | `web/dist/` will not regress into emitting `.ts/.tsx` artifacts in the future | Q10 D-159 | Low — `--exclude '(^\.\./|web/dist)'` defends against it |
| A7 | The 6 small `*ResultView` components (≤ 31 lines each) staying inline in `_results.tsx` won't push the dispatcher over the < 250 budget | Q7 D-152 | Low — math: ~125 lines of inline views + 28 lines dispatcher + ~20 lines imports = ~175 lines. Safe margin. |
| A8 | Renaming CONTEXT's `_tabs/` → `_sections/` is acceptable to user (no functional difference) | Q5 D-151 | Very low — naming-only |

## Open Questions

1. **`useGitStatusFiles` / `useSessionDirectory` / `useSessionFileSearch` — shape B factory in a future phase?**
   - What we know: 3 hooks share the "queryFn returns `{ data, error }` + queryError-fallthrough" pattern.
   - What's unclear: Whether this shape B is stable enough to factor out, OR whether each genuinely needs its custom post-processing (`useGitStatusFiles` does Promise.all + `buildGitStatusFiles`).
   - Recommendation: **Defer to a future micro-refactor.** Not Phase 9 scope. CONTEXT D-147 stays narrowly on the trivial shell.

2. **`@assistant-ui/react` ComposerPrimitive interaction with RTL tests for HappyComposer.**
   - What we know: `HappyComposer.tsx` heavily uses `ComposerPrimitive.Root` / `Input` / `Attachments` from `@assistant-ui/react`. Tests using RTL `render(<HappyComposer />)` would need to wrap with the assistant-ui providers.
   - What's unclear: Whether the providers initialize without a backing thread/runtime; whether Slice 3 should attempt RTL coverage or just hook-level tests.
   - Recommendation: Slice 3 starts with `useHappyComposerState.test.ts` + `useHappyComposerHandlers.test.ts` (hook-level, no rendering). If time permits, attempt RTL with a minimal `AssistantRuntimeProvider` wrapper. **Not blocking the phase.**

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | `vitest` (existing; via `bun run test:web`) |
| Config file | `web/vitest.config.*` (existing — confirmed by `_results.test.tsx` being a Vitest file) |
| Quick run command | `bun run test:web` |
| Full suite command | `bun run test` (runs cli + hub + web + shared) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| REFW-01 | Every `knownTools` entry resolves to a renderer (no fallback) | integration | `bun run test:web web/src/components/ToolCard/ToolCard.integration.test.tsx` | ❌ Wave 0 (Slice 1 creates) |
| REFW-01 | `madge` reports 0 cycles in `web/src/` | guard | `bash scripts/check-no-circular-web.sh` | ❌ Wave 0 (Slice 1 creates script; Slice 4 wires in) |
| REFW-02 | `SessionList.tsx` < 500 + sub-components < 250 | guard (`wc -l` + awk) | `bash scripts/check-no-cut-agents.sh` (Phase 9 sweep #4) | ❌ Wave 0 (Slice 4 adds sweep block) |
| REFW-02 | `message-window-store.ts` < 500 + sub-modules < 400 (or < 450 per Option B) + public API tests pass | guard + unit | `bash scripts/check-no-cut-agents.sh` + `bun run test:web web/src/lib/message-window-store.test.ts` | ✅ existing test file (unchanged) + ❌ guard Wave 0 |
| REFW-02 | `settings/index.tsx` < 500 + sub-sections covered | guard + RTL | `bash scripts/check-no-cut-agents.sh` + `bun run test:web web/src/routes/settings/_sections/*.test.tsx` | ❌ Wave 0 (Slice 3 creates section tests) |
| REFW-02 | `HappyComposer.tsx` < 500 + state hook unit-tested | guard + unit | `bash scripts/check-no-cut-agents.sh` + `bun run test:web web/src/components/AssistantChat/useHappyComposerState.test.ts` | ❌ Wave 0 (Slice 3) |
| REFW-02 | `_results.tsx` < 500 + extracted views tested | guard + unit | `bash scripts/check-no-cut-agents.sh` + `bun run test:web web/src/components/ToolCard/views/results/*.test.tsx` | ❌ Wave 0 (Slice 3) |
| REFW-02 | `reducerTimeline.ts` < 500 (verify-only) | guard | `bash scripts/check-no-cut-agents.sh` (Phase 9 sweep #4) | ❌ Wave 0 (Slice 4) |
| REFW-03 | `levenshteinDistance` defined exactly once in `web/src/lib/fuzzyMatch.ts`, 0 elsewhere | guard (ripgrep count) | `bash scripts/check-no-cut-agents.sh` (Phase 9 sweep #1) | ❌ Wave 0 (Slice 4) |
| REFW-03 | `estimateBase64Bytes` defined exactly once in `shared/src/uploads.ts`, 0 elsewhere | guard (ripgrep count) | `bash scripts/check-no-cut-agents.sh` (Phase 9 sweep #2) | ❌ Wave 0 (Slice 4) |
| REFW-03 (D-147) | `createApiQuery` defined once in `_factory.ts` + ≥ 3 importer files | guard (ripgrep) | `bash scripts/check-no-cut-agents.sh` (Phase 9 sweep #6) | ❌ Wave 0 (Slice 4; conditional on Slice 1 abstraction) |
| REFW-01 (D-156) | `tool-card-unknown-fallback` testid present in `knownTools.tsx` + reverse-asserted in integration test | guard (ripgrep) | `bash scripts/check-no-cut-agents.sh` (Phase 9 sweep #5) | ❌ Wave 0 (Slice 4) |

### Sampling Rate

- **Per task commit:** `bun typecheck` + `bun run test:web` (quick — < 30s typical)
- **Per wave merge:** `bun run test` (full suite — cli + hub + web + shared)
- **Phase gate:** `bash scripts/check-no-cut-agents.sh` (which tails `check-no-circular-web.sh`) + `bun typecheck` + `bun run test` all green

### Wave 0 Gaps

- [ ] `web/src/components/ToolCard/ToolCard.integration.test.tsx` — REFW-01 SC#1 integration test (Slice 1)
- [ ] `web/src/components/AssistantChat/useHappyComposerState.test.ts` — Slice 3 (optional but recommended)
- [ ] `web/src/components/AssistantChat/useHappyComposerHandlers.test.ts` — Slice 3 (optional)
- [ ] `web/src/components/ToolCard/views/results/_resultHelpers.test.ts` — Slice 3 (helpers extracted, were previously implicitly covered by `_results.test.tsx`)
- [ ] `web/src/components/ToolCard/views/results/BashResult.test.tsx` — Slice 3 (case redistribution from `_results.test.tsx`)
- [ ] `web/src/components/ToolCard/views/results/LineListResult.test.tsx` — Slice 3
- [ ] `web/src/components/ToolCard/views/results/ReadResult.test.tsx` — Slice 3
- [ ] `web/src/routes/settings/_sections/LanguageSection.test.tsx` — Slice 3
- [ ] `web/src/routes/settings/_sections/DisplaySection.test.tsx` — Slice 3
- [ ] `web/src/routes/settings/_sections/ChatSection.test.tsx` — Slice 3
- [ ] `web/src/routes/settings/_sections/AboutSection.test.tsx` — Slice 3
- [ ] `web/src/components/SessionList/SessionListHeader.test.tsx` — Slice 2 (case redistribution from `SessionList.test.ts`)
- [ ] `web/src/components/SessionList/SessionListSearch.test.tsx` — Slice 2
- [ ] `web/src/components/SessionList/SessionListItem.test.tsx` — Slice 2
- [ ] `web/src/components/SessionList/SessionListEmpty.test.tsx` — Slice 2
- [ ] `scripts/check-no-circular-web.sh` — Slice 1 creates
- [ ] Phase 9 sweep block in `scripts/check-no-cut-agents.sh` — Slice 4 appends
- [ ] Framework install: none needed (vitest, @testing-library/react, madge, rg all present)

## Security Domain

`security_enforcement` not explicitly configured. This phase is pure structural refactor with no user input handling, no auth, no crypto, no new wire surface, no new packages. ASVS gates do not apply.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|------------------|
| V2 Authentication | no | — (no auth code touched) |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | no | — (zod schema usage in `hub/src/web/routes/sessions/upload.ts` preserved unchanged; only the local `estimateBase64Bytes` function moves) |
| V6 Cryptography | no | — |
| V12 File / Resources | partial | `MAX_UPLOAD_BYTES` enforcement (existing pattern in cli + hub) is preserved by the move to `shared/src/uploads.ts`; no policy weakening |

### Known Threat Patterns for {pure-refactor stack}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| File-size enforcement weakened during move | Tampering | Guard sweep #2 asserts only one definition of `estimateBase64Bytes` exists; callers continue to enforce `> MAX_UPLOAD_BYTES → 413` (verified at hub `upload.ts:60`) |
| Integration test fixture stubs `api` with empty object | Repudiation (low — test scope only) | Render-only test; if a tool path requires real API, test crashes loudly and planner adds stub. No production code change. |

## Sources

### Primary (HIGH confidence)

- `web/src/components/ToolCard/views/_results.tsx` — Read in full (687 lines)
- `web/src/components/ToolCard/knownTools.tsx` — Read lines 1–80 + 380–423 (export shape + fallback path verified)
- `web/src/components/ToolCard/ToolCard.tsx` — Read lines 1–120 + 270–360 (ToolCardProps verified)
- `web/src/lib/message-window-store.ts` — Read in full (1088 lines; confirmed NOT zustand)
- `web/src/routes/settings/index.tsx` — Read lines 1–100 + 400–759 (section enumeration verified)
- `web/src/components/AssistantChat/HappyComposer.tsx` — Read lines 1–80 + 470–668 (JSX structure verified)
- `web/src/hooks/queries/{useSessions,useSession,useMachines,useSkills,useSlashCommands,useMessages,useGitStatusFiles,useSessionDirectory,useSessionFileSearch}.ts` — Read in full (9 hooks inventoried)
- `cli/src/modules/common/handlers/uploads.ts` — Read lines 1–80 (MAX_UPLOAD_BYTES + estimateBase64Bytes verified at lines 38 + 55)
- `hub/src/web/routes/sessions/upload.ts` — Read lines 1–60 (MAX_UPLOAD_BYTES + estimateBase64Bytes verified at lines 18 + 20)
- `scripts/check-no-cut-agents.sh` — Read in full (387 lines; insertion point + helper patterns verified)
- `scripts/check-no-circular-hub.sh` — Read in full (23 lines; mirror template for `check-no-circular-web.sh`)
- `madge --circular --extensions ts,tsx web/src/` — Live tool execution (both forms returned 0 cycles in 800ms)
- `web/src/lib/message-window-store.test.ts` — Read lines 1–5 (test file exists, imports public API via current export names)
- `.planning/REQUIREMENTS.md` — REFW-01/02/03 verified at lines 29–31

### Secondary (MEDIUM confidence)

- `.planning/phases/08-hub-internal-decoupling/08-CONTEXT.md` — Cited via CONTEXT D-149's reference to P8 D-129 SessionCache facade pattern. Confirmed file existence indirectly via `scripts/check-no-cut-agents.sh:309` which references `class SessionCache` in `hub/src/sync/sessionCache.ts`.

### Tertiary (LOW confidence)

- None — all critical claims verified by direct file reads or tool execution.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies; all tooling verified present
- Architecture patterns: HIGH — facade and hook-extraction patterns reused from P6/P8 with verified analogs
- Pitfalls: HIGH — 5 pitfalls documented from direct code reading (especially Pitfall 3 — wrong fallback location — and Pitfall 5 — not zustand)
- Open questions resolution (Q1–Q13): HIGH — all 13 answered from primary source reads
- `madge` invocation form (Q10): HIGH — both forms tested in this session, both return 0 cycles
- Slice 4 guard skeleton: MEDIUM — written based on P8 patterns; planner should bash-syntax-verify before commit
- `_factory.ts` TypeScript signature: MEDIUM — sketch only; planner finalizes after consulting actual TanStack Query 5.x types in Slice 1

**Research date:** 2026-05-23
**Valid until:** 2026-06-23 (web/src/ structure is stable; expected drift low)

---

*Phase: 9-Web internal decoupling*
*Research completed: 2026-05-23*
