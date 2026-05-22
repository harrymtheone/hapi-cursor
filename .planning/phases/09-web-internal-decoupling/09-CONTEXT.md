# Phase 9: Web internal decoupling - Context

**Gathered:** 2026-05-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 9 交付的是：把 `web/src/` 里几个超大文件按职责拆 < 500 行（`SessionList.tsx` 953、`message-window-store.ts` 1088、`routes/settings/index.tsx` 758、`AssistantChat/HappyComposer.tsx` 669、`ToolCard/views/_results.tsx` 687）；把跨包真重复的 util 上提到 `shared/`（`estimateBase64Bytes`），把仅 web 内重复的 util 收敛到 `web/src/lib/`（`levenshteinDistance`）；为 `knownTools.tsx` 注册表加一条「every known tool resolves to a renderer」集成测试；把已自然消解的两条 SC（ToolCard 循环 = 0、`reducerTimeline.ts` < 500）转成 verify-only + guard 防回归。映射 **REFW-01 + REFW-02 + REFW-03**。

**In scope:**

- **REFW-02 拆分（超大文件 → < 500 行）：**
  - `web/src/components/SessionList.tsx`（953 行）— 先抽 hooks（`useSessionListData` / `useSessionListSearch` / `useSessionListSelection` / `useSessionListKeyboard`），再按视觉边界拆 sub-component（`SessionListHeader.tsx` / `SessionListSearch.tsx` / `SessionListItem.tsx` / `SessionListEmpty.tsx`）；`SessionList.tsx` 退化为 orchestrator（< 250 行），default export 与外部 import 路径零变化。
  - `web/src/lib/message-window-store.ts`（1088 行）— 拆 4 个 sub-module + 原文件退化为薄 facade（同 P8 SessionCache 套路）：`messageWindowState.ts`（state shape + selectors）/ `messageWindowPaginationService.ts`（滚动 / load-more / 边界判定）/ `messageWindowMergeService.ts`（SSE / patch 合并到 window）/ `messageWindowSubscriptions.ts`（subscribe / dispose）。`message-window-store.ts` 仍是外部唯一入口（`useMessageWindow` hook + 公开 API 签名零变化），callers（`useSSE.ts` / `SessionChat.tsx` 等）零改动。每个 sub-module < 400 行。
  - `web/src/routes/settings/index.tsx`（758 行）— 抽 hooks（state / handler）+ 按 section 拆 sub-component；保留 `index.tsx` 为 route entry（< 300 行）；不改路由签名。
  - `web/src/components/AssistantChat/HappyComposer.tsx`（669 行）— 同 settings 套路：hooks 抽 + 按 section（toolbar / input / attachments / send-controls）拆 sub-component；`HappyComposer.tsx` 退化 orchestrator（< 300 行）。
  - `web/src/components/ToolCard/views/_results.tsx`（687 行）— 走 dispatcher + per-tool result 子组件：`_results.tsx` 退化为 result dispatcher（按 tool 类型 fan-out），各 tool 的 result 渲染拆到 `web/src/components/ToolCard/views/results/{Edit,Write,MultiEdit,...}Result.tsx`（mirror 现有 `*View.tsx` 文件结构）。dispatcher 文件 < 250 行。
- **REFW-03 util 去重：**
  - `estimateBase64Bytes` 上提到 `shared/src/uploads.ts`（cli + hub + 潜在 web 都消费）；`hub/src/web/routes/sessions/upload.ts:20` 与 `cli/src/modules/common/handlers/uploads.ts:55` 删本地实现，改 `import { estimateBase64Bytes } from '@hapi/protocol/uploads'`（或现有 protocol 包 entry）。
  - `levenshteinDistance` 收敛到 `web/src/lib/fuzzyMatch.ts`（**不**进 shared/，理由见 D-149）；`web/src/hooks/queries/useSlashCommands.ts:9` 与 `useSkills.ts:9` 删本地实现，改 `import { levenshteinDistance } from '@/lib/fuzzyMatch'`。
  - `createApiQuery` —— researcher 先列 `web/src/hooks/queries/*.ts` 现有 hook 形状；如果 ≥ 3 个 hook 共享同一壳（fetcher + key + invalidation 模式），抽 `web/src/hooks/queries/_factory.ts`；不到 3 个就**不抽**，进 `<deferred>`。
  - `CursorPermissionMode` —— P5/P7 已落 `shared/src/modes.ts` 唯一来源，本 phase **标 done，不再动**。
- **REFW-01 ToolCard 验收（已无循环，转 verify-only + 加 guard）：**
  - 当前 `madge --circular web/src/components/ToolCard/` 与 `madge --circular web/src/` 均 0 环；P9 不再「打破循环」，只新建 `scripts/check-no-circular-web.sh`（或并入主 guard）跑 `npx madge --circular --extensions ts,tsx web/src/` 退出码语义化，确保未来回归被 CI 拦下。
  - 新增 `web/src/components/ToolCard/ToolCard.integration.test.tsx`：`Object.keys(knownTools)` 遍历每个 toolName，用 React Testing Library `render(<ToolCard toolName={x} ... />)`，断言：(a) 不抛、(b) 渲染 DOM 不命中 fallback 锚（`data-testid="tool-card-unknown-fallback"` 或等价文案 —— researcher 定锚字符串）。`_results.tsx` 在 fallback 路径加 `data-testid` 锚（如果当前没有）。
- **SC#2 `reducerTimeline.ts` 已 359 行 → verify-only：** 不动文件，guard 加文件大小红线 `< 500`（与 SessionList / message-window-store / settings / HappyComposer / _results.tsx 同款红线）防回潮。
- **Guard 收口（Slice 4）：** `scripts/check-no-cut-agents.sh` 追加 Phase 9 D-150 关键词 sweep block；`scripts/check-no-circular-web.sh` 新文件（或并入）；phase gate = `bash scripts/check-no-cut-agents.sh` 退出 0 + `bash scripts/check-no-circular-web.sh` 退出 0 + `bun typecheck` + `bun run test` 全绿。

**Out of scope:**

- REFC-01 / REFC-02 config 清理（`serverUrl` 别名、`hapi server` 命令、SQLite 运行时迁移、`_setApiUrl()` setter、`loadConfig()` Readonly、全面 DI 化）—— **Phase 10**。
- REFT-01 / REFT-02 / REFT-03 测试空白填补（cursor permission 矩阵 / SSE reconnect / auth route negative）—— **Phase 11**。本 phase 新增的测试只覆盖被本 phase 拆动的 web 代码 + knownTools 集成测试。
- CUT-12 / VRFY-* 文档清理与 milestone 收尾 —— **Phase 12**。
- `cli/` / `hub/` / `shared/` 内容：本 phase 只在 `shared/src/uploads.ts` **新增**一个文件 + `cli/src/modules/common/handlers/uploads.ts` 与 `hub/src/web/routes/sessions/upload.ts` 各改一处 import；其它一概不动。
- `message-window-store` 迁移到 TanStack Query / 与 `useSSE` 合并这类**架构方向**变更 —— 进 `<deferred>`，本 phase 仅做职责拆分，外部 API 零变化。
- ToolCard 循环「重新设计」—— 已 0 环，不重构 `_all.tsx` / `_results.tsx` / `ToolCard.tsx` 三者间的 import 拓扑；只在 `_results.tsx` 内部按 tool 类型拆 result 子组件。
- 不加 feature flag、不加双版本 API 共存期、不加 path alias —— 一次切干净（与 P2/P4/P5/P6/P7/P8 同款，no backward compat）。
- 不动 `reducerTimeline.ts`（已 < 500）、不动 `_all.tsx`（已 62 行）、不动 `ToolCard.tsx`（488 < 500）、不动 `knownTools.tsx`（423 < 500）；这些只进 guard 红线监控，不进拆分清单。
- `web/src/hooks/queries/` 其它 hook 的形状统一化（`createApiQuery` 抽象，如果 researcher 判定 < 3 个共享壳）—— **deferred**。
- 不动 `levenshteinDistance` / `estimateBase64Bytes` 之外的「疑似可抽」util —— 本 phase 只动 CONCERNS.md 明确点名的两条。

</domain>

<decisions>
## Implementation Decisions

### 1. 范围对齐（灰区 A）

- **D-145：SC#1 前半「ToolCard cycles = 0」与 SC#2「reducerTimeline.ts < 500」转 verify-only + guard 防回归。** 实测 `madge --circular web/src/components/ToolCard/` 与 `madge --circular web/src/` 均 0 环；`reducerTimeline.ts` 已 359 行（< 500）。P9 不重做这两件已完成的工作，只通过 guard 锁现状：(a) 新建 `scripts/check-no-circular-web.sh` 或并入主 guard 跑 `madge --circular web/src/` 退出码 = 0；(b) `scripts/check-no-cut-agents.sh` 追加文件大小红线 sweep（5 个目标文件 < 500 行 + `reducerTimeline.ts` < 500 + `_all.tsx` < 200 + `ToolCard.tsx` < 500 + `knownTools.tsx` < 500）。
- **D-146：SC#3 `CursorPermissionMode` 视作 done。** P5/P7（D-119）已经把 `CursorPermissionMode` 落在 `shared/src/modes.ts` 唯一来源，cli 与 web 都 `import type { CursorPermissionMode } from '@hapi/protocol/types'`。Phase 9 不重复劳动；CONTEXT 写明 done 状态供 Phase 12 验收引用。
- **D-147：SC#3 `createApiQuery` 走「先调查后决定」。** researcher 在 Slice 1 读 `web/src/hooks/queries/*.ts`（含 `useSkills.ts` / `useSlashCommands.ts` / `useSessionList.ts` / etc.）现有 hook 形状；如果发现 ≥ 3 个 hook 共享同一壳（fetcher + queryKey 推导 + invalidation 模式），抽 `web/src/hooks/queries/_factory.ts::createApiQuery`；不到 3 个就**不抽**，明确进 `<deferred>` 并在 CONTEXT 注记理由（避免「为了 SC 字面而硬抽 < 3 用户的抽象」）。

### 2. SessionList.tsx 拆分（灰区 B）

- **D-148：先抽 hooks 再拆 sub-component，混合派但顺序固定。** Step 1 抽 4 个 hooks（`useSessionListData` / `useSessionListSearch` / `useSessionListSelection` / `useSessionListKeyboard`），把 state + effect + handler 从 JSX 抽离，single-file 即落到 ~600 行；Step 2 按视觉边界拆 4 个 sub-component（`SessionListHeader.tsx` / `SessionListSearch.tsx` / `SessionListItem.tsx` / `SessionListEmpty.tsx`），`SessionList.tsx` 退化为 orchestrator（< 250 行）。`SessionList` 仍是 default export，外部 import 路径零变化。每个 sub-component / hook 落 colocated 单测（`*.test.tsx`），原 `SessionList.test.tsx`（如有）按 sub-component 拆 case。

### 3. message-window-store 拆分（灰区 C）

- **D-149：保守职责拆 + 不做激进瘦身。** 拆 4 个 sub-module，原文件退化为薄 facade（同 P8 D-129 SessionCache 套路）：
  - `web/src/lib/messageWindowState.ts` — store state shape（zustand store 定义）+ selectors。
  - `web/src/lib/messageWindowPaginationService.ts` — pagination 滚动 / load-more / window 边界判定。
  - `web/src/lib/messageWindowMergeService.ts` — SSE / patch 合并到 window 的逻辑。
  - `web/src/lib/messageWindowSubscriptions.ts` — store subscribe / dispose / cleanup。
  - `web/src/lib/message-window-store.ts` 仍是**外部唯一入口**（`useMessageWindow` hook + 公开 API 签名零变化），callers（`useSSE.ts` / `SessionChat.tsx` / 等）零改动。每个 sub-module < 400 行。
- **D-150：不在本 phase 做架构方向变更。** 「迁移到 TanStack Query」/「与 `useSSE` 合并」/「删除 `message-window-store` 让 TanStack 直接管 message window」—— 这是**独立架构决策**，本 phase 不背。进 `<deferred>`，留 v2 milestone 或单独 phase。本 phase 「`message-window-store` 拆分」就是字面拆分，不改语义。

### 4. settings + HappyComposer + _results.tsx 拆分（灰区 D + E）

- **D-151：settings/index.tsx 与 HappyComposer.tsx 用同一拆法（hooks 抽 + sub-component 拆）。** 与 D-148 SessionList 同模板：先抽 hooks，再按 section / tab 拆 sub-component；保留入口文件为 orchestrator / route entry（< 300 行）。settings 按 tab 拆（researcher 列 tab 清单）；HappyComposer 按 section 拆（toolbar / input / attachments / send-controls，researcher 列实际 section）。
- **D-152：_results.tsx 走 dispatcher + per-tool result 子组件。** `_results.tsx` 退化为 result dispatcher（按 tool 类型 fan-out 到对应 result 组件），各 tool 的 result 渲染拆到 `web/src/components/ToolCard/views/results/{Edit,Write,MultiEdit,...}Result.tsx`，**mirror 现有 `web/src/components/ToolCard/views/*View.tsx` 的命名**（如果 `EditView.tsx` 存在，则对应 `results/EditResult.tsx`）。dispatcher 文件 < 250 行。新拆 result 子组件各自落 colocated 单测；原 `_results.test.tsx` 按 result 子组件拆 case。
- **D-153：`_results.tsx` 内部按 tool 类型拆，不动 `_all.tsx` / `ToolCard.tsx` / `knownTools.tsx` 三者间的 import 拓扑。** 实测 ToolCard 循环已 0；本 phase 不重做拓扑，只在 `_results.tsx` 内部做拆分（dispatcher 是文件内 switch / map，不是新建跨文件循环来源）。

### 5. util 上提的边界（灰区 F）

- **D-154：跨包真重复 → `shared/`；纯 web-only 重复 → `web/src/lib/`。**
  - `estimateBase64Bytes`：cli (`cli/src/modules/common/handlers/uploads.ts:55`) + hub (`hub/src/web/routes/sessions/upload.ts:20`) 真重复 → 上提 `shared/src/uploads.ts`，导出 `estimateBase64Bytes(base64: string): number`。两处 callsite 改 `import` 路径，删本地实现。
  - `levenshteinDistance`：仅 `web/src/hooks/queries/useSlashCommands.ts:9` + `useSkills.ts:9` 重复（**两处都在 web 内**）→ 上提 `web/src/lib/fuzzyMatch.ts`，导出 `levenshteinDistance(a: string, b: string): number`。两处 callsite 改 `import` 路径。
- **D-155：明确标 REFW-03 措辞与实施有偏差并解释理由。** REFW-03 措辞「Levenshtein 距离... 提到 `shared/`」是 2026-05-20 快照下的笼统建议；实测 `levenshtein` 仅在 web 内出现 → 进 shared 会让 `shared/` 沾上 web-only 算法（违反 P7 D-119「shared = wire / 跨端共享语义唯一来源」精神 + P5「shared 不放 UI-only / 算法-only」）。CONTEXT 这条**显式偏差记录**让 verification 阶段可直接引用，不必再问。

### 6. SC#1 集成测试形态（灰区 G）

- **D-156：table-driven 测试 + 反向断言 fallback 锚。** 新文件 `web/src/components/ToolCard/ToolCard.integration.test.tsx`：
  - 用 `Object.keys(knownTools)`（或 `Object.entries`）遍历每个 toolName。
  - 对每个 toolName，用 React Testing Library `render(<ToolCard toolName={x} {...minimalProps} />)`（minimalProps 由 researcher 定，覆盖 ToolCard 最小可渲染前置条件）。
  - 断言：(a) `render` 不抛；(b) `queryByTestId('tool-card-unknown-fallback')`（或等价文案锚 —— researcher 在 `_results.tsx` 看现有 fallback 路径用什么字符串 / 元素结构定锚）返回 `null`。
  - `_results.tsx` 在 fallback 路径加 `data-testid="tool-card-unknown-fallback"` 锚（如果当前没有）。
  - guard 上 ripgrep 锚：`data-testid="tool-card-unknown-fallback"` 在测试中被 `queryByTestId` 反向断言（确保未来不会被改名导致测试失锚）。

### 7. 切片节奏与 guard（灰区 H + 默认）

- **D-157：4 切片，沿用 P6/P7/P8 模板，每片落 `bun typecheck` + `bun run test` 全包绿。**
  1. **Slice 1 — Util dedup + cycles guard + renderer 集成测试（REFW-03 + REFW-01 verify-only）**：
     - 新建 `shared/src/uploads.ts` + 把 `estimateBase64Bytes` 移入；cli + hub 两处 callsite 改 import。
     - 新建 `web/src/lib/fuzzyMatch.ts` + 把 `levenshteinDistance` 移入；两个 web hook callsite 改 import。
     - researcher 列 `web/src/hooks/queries/*.ts` hook 形状，决定 `createApiQuery` 抽不抽（≥ 3 用户才抽）。
     - 新建 `scripts/check-no-circular-web.sh`（或合并到主 guard）。
     - 新增 `web/src/components/ToolCard/ToolCard.integration.test.tsx`（SC#1 后半）+ `_results.tsx` 加 fallback `data-testid` 锚。
     - **门槛**：`bun typecheck` + `bun run test:web` + `bun run test:cli` + `bun run test:hub` 全绿；`bash scripts/check-no-circular-web.sh` 退出 0。
  2. **Slice 2 — message-window-store + SessionList 拆分（REFW-02 主战场）**：
     - 按 D-149 拆 `message-window-store.ts` 4 sub-module + facade。
     - 按 D-148 拆 `SessionList.tsx` 4 hooks + 4 sub-component。
     - 新拆文件各自落 colocated 单测；callers 零改动。
     - **门槛**：`wc -l web/src/lib/messageWindow*.ts web/src/lib/message-window-store.ts web/src/components/SessionList*.tsx web/src/components/SessionList/*.tsx` 每文件 < 400（store sub-module）/ < 500（SessionList 入口）/ < 250（orchestrator + sub-component）；`bun run test:web` 全绿。
  3. **Slice 3 — settings + HappyComposer + _results.tsx 拆分（REFW-02 收尾）**：
     - 按 D-151 拆 `routes/settings/index.tsx` + `AssistantChat/HappyComposer.tsx`。
     - 按 D-152 拆 `ToolCard/views/_results.tsx` → dispatcher + per-tool result 子组件。
     - 新拆文件各自落 colocated 单测；`_results.test.tsx` 按 result 子组件拆 case；Slice 1 加的 integration test 仍绿。
     - **门槛**：`wc -l web/src/routes/settings/index.tsx web/src/components/AssistantChat/HappyComposer.tsx web/src/components/ToolCard/views/_results.tsx` 每文件 < 500；新拆子组件每文件 < 300；`bun run test:web` 全绿。
  4. **Slice 4 — guard 收口**：
     - `scripts/check-no-cut-agents.sh` 追加 Phase 9 D-150 关键词 sweep block（见下条 D-158）。
     - `scripts/check-no-circular-web.sh` 内容稳定化（如 Slice 1 已建则在此 phase gate 内 wire 入 CI 入口）。
     - **门槛**：`bash scripts/check-no-cut-agents.sh` 退出 0 + `bash scripts/check-no-circular-web.sh` 退出 0 + `bun typecheck` + `bun run test` 全绿。
- **D-158：ripgrep + madge zero-tolerance 关键词（Phase 9 sweep）。** 范围 `web/src/` / `cli/src/` / `hub/src/`：
  1. `function levenshteinDistance\(` / `function levenshtein\(` 在 `web/src/` 命中数 = 1（仅 `web/src/lib/fuzzyMatch.ts` 自身），在 `cli/src/` / `hub/src/` / `shared/src/` 命中 = 0。
  2. `function estimateBase64Bytes\(` 在 `shared/src/` 命中 = 1（`shared/src/uploads.ts` 自身），在 `cli/src/` / `hub/src/` / `web/src/` 命中 = 0。
  3. `madge --circular --extensions ts,tsx web/src/` 0 环（SC#1 + SC#4 硬验）。
  4. 文件大小红线（SC#2 硬验）：`wc -l` for 6 个目标文件 + reducerTimeline + ToolCard 子文件 —— 每条 < 500（specific thresholds 见 D-157 各 slice 门槛）。
  5. `data-testid="tool-card-unknown-fallback"` 在 `_results.tsx` 命中 = 1，在 `ToolCard.integration.test.tsx` 被 `queryByTestId` 反向断言（SC#1 后半硬验）。
  6. `createApiQuery` —— **条件性**：若 D-147 调查决定抽，则 `web/src/hooks/queries/_factory.ts` 命中 = 1 + 至少 3 个 queries 文件 import 之；若不抽，guard 不加这条，CONTEXT `<deferred>` 显式记录。
- **D-159：本 phase 不动 `web/src/` 之外（除 `shared/src/uploads.ts` 新文件 + cli/hub 各一处 import 改写）。** 与 P8 D-144 同精神：「不动合理大小 / 单一职责的既有文件，即使它们与拆分目标有调用关系」。`useSSE.ts` / `SessionChat.tsx` / `useSkills.ts` / `useSlashCommands.ts` 等只改 import 路径（如有），不改业务逻辑。

### Claude's Discretion

- `web/src/routes/settings/index.tsx` 按 tab 还是按 concern 拆 sub-component，由 researcher 列 tab 清单后 planner 决定 —— 推荐按 tab（视觉边界天然对齐）。
- `web/src/components/AssistantChat/HappyComposer.tsx` 的 section 边界（toolbar / input / attachments / send-controls 是否合并 / 拆 5 段），由 researcher 看实际 JSX 结构定。
- `web/src/components/ToolCard/views/_results.tsx` 拆出来的 `results/` 子目录是否进一步 mirror `views/` 完整结构（每个 tool 都拆，还是只拆 ≥ 50 行的 tool result），由 planner 看每个 result 实际大小决定 —— 推荐 ≥ 50 行才拆，避免 tiny 文件膨胀。
- `createApiQuery` 抽象与否的「3 用户阈值」可由 researcher 提高到 4（如果发现 3 个壳已经偏向歧义化），但**不能**降到 2 —— 2 用户不构成 factory pattern 的正当性。
- `web/src/lib/fuzzyMatch.ts` 是否一并暴露其它 fuzzy 工具（如 `fuzzyScore` / `fuzzyRank`），由 researcher 看现有重复度决定 —— 推荐**只**搬 `levenshteinDistance`，不预先抽其它。
- `shared/src/uploads.ts` 是否同时上提 `MAX_UPLOAD_BYTES` 常量（实测 hub upload.ts 也定义）—— 由 researcher 看 cli / hub / web 三处是否真共享同一常量值后决定；推荐一并上提（避免常量与函数分家）。
- `_results.tsx` fallback 锚字符串具体值（`tool-card-unknown-fallback` vs 别的）由 researcher 看现有 DOM 决定；约定 kebab-case + `data-testid` 形态。
- `scripts/check-no-circular-web.sh` 写独立脚本还是并入 `check-no-cut-agents.sh`，由 planner 选 —— 推荐独立脚本（与 P8 D-143 推荐的 `check-no-circular-hub.sh` 风格对齐 + madge 输出多行不污染主 guard）。
- `message-window-store` 4 sub-module 是否各自暴露给外部（callers 直接 import sub-module）还是只通过 `message-window-store.ts` facade —— 默认**只通过 facade**，零 caller 改动；planner 如发现某 sub-module 在外部测试 / Storybook 等场景独立需要，可单独 export。
- guard 脚本 `madge --circular web/src/` 是否需要 `--exclude` 过滤（P8 D-143 在 hub 范围发现 `web/dist/` 污染），由 researcher 在 Slice 1 实测决定；推荐 `cd web && npx madge --circular --extensions ts,tsx src/` 形态规避 monorepo 外溢。

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 项目宪法

- `.planning/PROJECT.md` — Cursor-only 单 agent 定位；移动端 + Tailscale 带宽敏感场景（影响 `message-window-store` 拆分时 pagination 边界判定的语义保持，不改 window size / overscan 等用户可感参数）。
- `.planning/REQUIREMENTS.md` §「v1 Requirements」— **REFW-01 / REFW-02 / REFW-03 映射 Phase 9**；REFC-* 留 Phase 10、REFT-* 留 Phase 11、CUT-12 / VRFY-* 留 Phase 12。
- `.planning/ROADMAP.md` §「Phase 9: Web internal decoupling」— **SC#1–#4 是验收锚点**：(SC#1) ToolCard 循环 = 0（已达成，转 verify-only）+ knownTools resolves to renderer 集成测试；(SC#2) `SessionList.tsx` / `message-window-store.ts` / `reducerTimeline.ts` / `settings/index.tsx` / `HappyComposer.tsx` 每文件 < 500（reducerTimeline 已达成）；(SC#3) Levenshtein / base64 / CursorPermissionMode / createApiQuery 上提（CursorPermissionMode 已 done by P5/P7；Levenshtein 落 `web/src/lib/` 偏差见 D-155；createApiQuery 条件抽 D-147）；(SC#4) `madge --circular web/src/` 0 环 + `bun typecheck` + `bun run test` 全绿。
- `AGENTS.md` — No backward compatibility、TypeScript strict、Bun workspaces、4 空格缩进、必要测试。

### Prior Phase Decisions（关键继承点）

- `.planning/phases/01-cut-non-cursor-agents/01-CONTEXT.md` — D-11~D-13 源码关键词零容忍 + 白名单（本 phase D-158 同款模板）。
- `.planning/phases/05-flavor-consolidation-capability-abstraction/05-CONTEXT.md` — D-84/D-86 ripgrep guard + 4 切片模板（本 phase D-157~D-158 直接复用）；`CursorPermissionMode` 上提 shared 已由本 phase 落地（D-146 视作 done）。
- `.planning/phases/06-agent-runtime-shared-kit-mode-hardening/06-CONTEXT.md` — **D-107~D-110 4 切片 + ripgrep + madge guard 模板**（本 phase D-157~D-158 直接复用此模板）。
- `.planning/phases/07-wire-contracts-unification-sse-patch-contract/07-CONTEXT.md` — **D-119 `shared/` = wire / 跨端共享语义唯一来源**（本 phase D-154 / D-155 直接消费这条「shared 收纳边界」原则 —— `levenshtein` 不进 shared 的依据）；D-125 4 切片每片 typecheck + test 绿模板。
- `.planning/phases/08-hub-internal-decoupling/08-CONTEXT.md` — **D-129 SessionCache 退化薄 facade、4 service composition 模板**（本 phase D-149 `message-window-store` 拆 4 sub-module + facade 直接复用）；D-142~D-143 4 切片 + guard sweep 模板；D-144「不动合理大小文件」精神（本 phase D-159 同源）。

### Codebase Maps

- `.planning/codebase/ARCHITECTURE.md` — web 端 chat / session / ToolCard 三大区域的边界 —— Phase 9 拆分要保持这三块对外的 import 入口不变（`SessionList`、`useMessageWindow` hook、`ToolCard` 组件）。
- `.planning/codebase/STRUCTURE.md` §「web/src/components/」§「web/src/lib/」§「web/src/hooks/」§「web/src/routes/」§「web/src/chat/」— 拆分前的目录拓扑。
- `.planning/codebase/STACK.md` — React + Vite + zustand + TanStack Query + React Testing Library 版本；`message-window-store` 是 zustand store（D-149 拆分形态前提）。
- `.planning/codebase/CONCERNS.md` §「Heuristic web SSE patching」+「Oversized hot files」+「Duplicate utility implementations」+「ToolCard registry / result renderer cycle」— 本 phase 清单的直接来源（注：循环已自然消解 D-145）。

### 本 phase 直接相关源码 / 调用点

**web/src/components/（SessionList 拆分 + ToolCard）：**

- `web/src/components/SessionList.tsx`（953 行）— 拆 4 hooks + 4 sub-component（D-148）；default export 不变。
- `web/src/components/ToolCard/ToolCard.tsx`（488 行）— 不动；本 phase 仅作 integration test 入口。
- `web/src/components/ToolCard/knownTools.tsx`（423 行）— 不动；integration test 遍历其导出的 tool 注册表（D-156）。
- `web/src/components/ToolCard/views/_results.tsx`（687 行）— 拆 dispatcher + `results/{*}Result.tsx`（D-152）。
- `web/src/components/ToolCard/views/_all.tsx`（62 行）— 不动（已瘦身）。
- `web/src/components/ToolCard/views/*View.tsx`（既有 7 个 View 子组件）— 不动；新拆 `results/*Result.tsx` mirror 其命名（D-152）。
- `web/src/components/ToolCard/views/_results.test.tsx` — 按 result 子组件拆 case（Slice 3）。
- `web/src/components/ToolCard/ToolCard.integration.test.tsx`（新文件）— table-driven knownTools → renderer 集成测试（D-156）。
- `web/src/components/AssistantChat/HappyComposer.tsx`（669 行）— 拆 hooks + section sub-component（D-151）。

**web/src/lib/（message-window-store 拆分 + fuzzyMatch 新文件）：**

- `web/src/lib/message-window-store.ts`（1088 行）— 拆 4 sub-module + 退化薄 facade（D-149）；`useMessageWindow` hook + 公开 API 签名零变化。
- `web/src/lib/messageWindowState.ts`（新文件）— state shape + selectors。
- `web/src/lib/messageWindowPaginationService.ts`（新文件）— pagination 逻辑。
- `web/src/lib/messageWindowMergeService.ts`（新文件）— SSE / patch merge 逻辑。
- `web/src/lib/messageWindowSubscriptions.ts`（新文件）— subscribe / dispose。
- `web/src/lib/fuzzyMatch.ts`（新文件）— `levenshteinDistance` 收纳点（D-154）。

**web/src/hooks/queries/（dedup + 条件性 createApiQuery）：**

- `web/src/hooks/queries/useSlashCommands.ts:9` — 删本地 `levenshteinDistance`，改 `import` from `@/lib/fuzzyMatch`。
- `web/src/hooks/queries/useSkills.ts:9` — 同上。
- `web/src/hooks/queries/_factory.ts`（条件性新文件，D-147）— 若 ≥ 3 个 hook 共享同一壳，抽 `createApiQuery`；否则不建文件，CONTEXT `<deferred>` 显式记录。

**web/src/routes/（settings 拆分）：**

- `web/src/routes/settings/index.tsx`（758 行）— 拆 hooks + tab sub-component（D-151）；route entry 签名不变。
- `web/src/routes/settings/_tabs/` 或类似（新目录，researcher 选命名）— 拆出来的 tab sub-component 落地点。

**web/src/chat/（reducerTimeline verify-only）：**

- `web/src/chat/reducerTimeline.ts`（359 行）— 不动；guard 加文件大小红线 < 500 防回潮（D-145）。

**shared/src/（uploads util 新文件）：**

- `shared/src/uploads.ts`（新文件）— 导出 `estimateBase64Bytes` + 可能的 `MAX_UPLOAD_BYTES`（D-154 + Claude's discretion）。

**cli/src/、hub/src/（uploads util import 切换）：**

- `cli/src/modules/common/handlers/uploads.ts:55` — 删本地 `estimateBase64Bytes`，改 `import` from `@hapi/protocol/uploads`（或现有 protocol 包 entry，researcher 看 monorepo 既有 import 习惯）。
- `hub/src/web/routes/sessions/upload.ts:20` — 同上。

**guard / scripts：**

- `scripts/check-no-cut-agents.sh` — 追加 Phase 9 D-158 关键词 sweep block（levenshtein / estimateBase64Bytes 重复 0 命中 + 文件大小红线 + fallback `data-testid` 锚）。
- `scripts/check-no-circular-web.sh`（新文件，可选；planner 选独立脚本还是并入主 guard） — `npx madge --circular --extensions ts,tsx web/src/` + 输出过滤 + 退出码语义化。

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- `web/src/components/ToolCard/views/_all.tsx` 已 62 行（曾 997 行）—— 历史拆分轨迹已经把骨架 / 类型 / 注册三件事分开；P9 不重做这块。
- `web/src/chat/reducerTimeline.ts` 已 359 行（曾 925 行）—— 同上，历史拆分已落实；P9 仅 verify。
- `web/src/components/ToolCard/views/*View.tsx`（既有 `EditView`/`WriteView`/`MultiEditView`/`TodoWriteView`/`UpdatePlanView`/`ExitPlanModeView`/`AskUserQuestionView`/`RequestUserInputView`）—— `results/*Result.tsx` 拆分直接 mirror 这套命名 / 文件粒度（D-152）。
- `web/src/components/ToolCard/views/_results.test.tsx` 已存在 —— Slice 3 拆 case 时不重建测试基础设施，只重排 case。
- Hono / zustand / React Testing Library 现成可用；`@testing-library/react` 已在 web `package.json` —— integration test（D-156）零新增依赖。
- P8 D-129 SessionCache facade 套路：薄 facade + composition + callers 零改动 —— 本 phase D-149 message-window-store 直接复用同款思路。
- P6/P7/P8 D-107/D-125/D-142 4 切片节奏 + ripgrep / madge guard sweep —— 本 phase D-157~D-158 直接复用模板。

### Established Patterns

- 拆分型 phase：「单一职责 + facade 锁定 surface area + ripgrep 验收文件大小 / 命名 / import 拓扑」（P6/P7/P8 同款）；no shim / no feature flag / no double API period。
- 类型 narrow / 接口 narrow 让 TS 编译器暴露所有调用点 —— `message-window-store` facade 公开方法签名不变 = 调用点零改动；`SessionList` default export 不变 = 外部 import 零改动；新 hooks 在 `SessionList.tsx` 内部 inline 调用 = 不外溢。
- shared/ 收纳边界：wire / 跨端共享语义 / 跨端常量。**不收**：web-only 算法、UI-only 工具、单端使用的常量（P5 + P7 D-119 同源 → 本 phase D-154/D-155 应用）。
- 切片每片绿色：`bun typecheck` + `bun run test` 全包；最后切片追加 ripgrep + madge guard（P6 D-107 / P7 D-125 / P8 D-142 节奏一致）。
- Integration test 形态：table-driven 遍历注册表 + 反向断言 fallback 锚（D-156；同 P5 SC#3 capability 表 + ripgrep `if (flavor ===) 0 命中`「反向断言无回潮」精神）。
- 「条件性抽象」：只有 ≥ 3 用户才抽 factory / shared util（D-147 / Claude's Discretion 阈值规则）—— 避免 < 3 用户的过度抽象。

### Integration Points

- **`SessionList` default export → 外部 callers（routes / Sidebar / etc.）**：默认不动；hooks 与 sub-component 全部内部消费。
- **`useMessageWindow` hook → `useSSE.ts` / `SessionChat.tsx` / etc.**：facade 公开 API 不变；4 sub-module 是内部 composition 细节。
- **`<ToolCard>` 组件 → 各 caller（`ChatMessage` / etc.）**：组件签名不变；`_results.tsx` 退化 dispatcher 是内部细节；`data-testid` fallback 锚是新增测试 surface，不影响生产 UI。
- **`@hapi/protocol/uploads`（或既有 protocol 包 entry）← cli/hub callers**：新增 export；cli + hub 各一处 callsite 改 import。
- **`@/lib/fuzzyMatch` ← web/hooks/queries**：新增 web-local lib export；两个 hook callsite 改 import。
- **`web/src/routes/settings/index.tsx` route entry**：route 路径 / lazy import 签名不变；tab sub-component 是 entry 内部 composition。
- **`scripts/check-no-cut-agents.sh` + 可选独立 `scripts/check-no-circular-web.sh`**：phase gate 入口；CI workflow 文件如已引用 guard 脚本则零改动（researcher 在 Slice 4 确认）。

</code_context>

<specifics>
## Specific Ideas

- `web/src/components/ToolCard/views/_results.tsx` 当前 687 行 —— 拆出 `results/{Edit,Write,MultiEdit,TodoWrite,UpdatePlan,ExitPlanMode,AskUserQuestion,RequestUserInput}Result.tsx` 之后 dispatcher 留下 `switch (toolName)` + 默认 fallback 路径（命中即 `data-testid="tool-card-unknown-fallback"`），dispatcher 文件应稳定在 < 250 行。
- `web/src/lib/message-window-store.ts` 是 **zustand store**（确认前提），4 sub-module 拆分要保持单 store instance —— state 定义在 `messageWindowState.ts`、其它 sub-module **不持有独立 store**，而是消费 / 改写同一 store（通过 selector / setter 注入）。
- `web/src/hooks/queries/*.ts` —— researcher 在 Slice 1 ripgrep 列清单时，参考样本有 `useSkills.ts`、`useSlashCommands.ts`、`useSessionList.ts`（若存在）、`useMessages.ts`（若存在）等；目标是找到「fetcher fn + queryKey 数组 + invalidateOnEvent 模式」三件事一致的 ≥ 3 个 hook。
- `data-testid="tool-card-unknown-fallback"` 锚字符串是推荐值；researcher 在 `_results.tsx` 当前的 fallback 路径（推测在文件末尾 `default:` 分支或 `if (!viewComponent)` 兜底）确认是否已有 `data-testid`，有则复用、没有则新增。
- `madge --circular --extensions ts,tsx web/src/` 在仓库根跑会吃 `web/dist/` 的 60+ 环（mermaid bundle）—— 同 P8 实测；本 phase guard 必须 `cd web` 跑或 `--exclude '^\.\./'` 过滤（D-159 + Claude's Discretion）。
- 实测 `Object.keys(knownTools)` 时 `knownTools.tsx` 423 行的导出形态是 const map / Record / Map —— researcher 在 Slice 1 测试设计时确认导出形态以决定 `Object.keys` / `[...knownTools.keys()]` 哪种遍历方式。
- `hub/src/web/routes/sessions/upload.ts:20` 与 `cli/src/modules/common/handlers/uploads.ts:55` 的 `estimateBase64Bytes` 实现实测**算法相同**（`Math.floor` 后的 base64 字节数估算 = `base64.length * 3 / 4` 减去 padding）；上提到 shared 是 mechanical move，零行为变化。
- `levenshteinDistance` 两处实现实测**算法相同**（标准动态规划 O(n·m) 实现）；上提到 `web/src/lib/fuzzyMatch.ts` 是 mechanical move，零行为变化。

</specifics>

<deferred>
## Deferred Ideas

- **`message-window-store` 迁移到 TanStack Query / 与 `useSSE` 合并 / 删除 store 让 TanStack 直接管 message window** —— 独立架构决策，进 v2 milestone 或单独 phase；本 phase D-150 显式不背。
- **`web/src/hooks/queries/_factory.ts::createApiQuery` 抽象（如果 < 3 用户共享同一壳）** —— 条件性 deferred（D-147 + D-158）；CONTEXT 本 phase 决定后再确定是否真 defer。
- **`web/src/lib/fuzzyMatch.ts` 进一步抽 `fuzzyScore` / `fuzzyRank` / 等更多 fuzzy 工具** —— 不本 phase；本 phase 只搬 `levenshteinDistance`（Claude's discretion）。
- **`shared/src/uploads.ts` 进一步抽 upload size 验证 / 文件类型识别 / 等更多 upload 工具** —— 不本 phase；本 phase 只搬 `estimateBase64Bytes`（+ 可能的 `MAX_UPLOAD_BYTES` 常量）。
- **`web/src/routes/settings/index.tsx` 各 tab 进一步抽 sub-route / 独立 lazy load** —— 不本 phase；本 phase 只拆 sub-component，不改 route topology。
- **`web/src/components/AssistantChat/HappyComposer.tsx` 各 section 进一步抽独立 hook 库（如 `useAttachments` / `useDraftPersistence`）** —— 不本 phase；本 phase 只拆 sub-component，hook 抽到「足够让入口文件 < 300 行」即停。
- **REFC-01 / REFC-02 config 清理（serverUrl alias / `hapi server` 命令 / SQLite 运行时迁移 / `_setApiUrl` setter / `loadConfig()` Readonly / 全面 DI 化）** —— **Phase 10**。本 phase `shared/src/uploads.ts` 新增不依赖 config 注入。
- **REFT-01 cursor permission-mode → CLI flag 完整矩阵测试** —— **Phase 11**。
- **REFT-02 SSE reconnect / patch-loss 不变量测试** —— **Phase 11**。本 phase `message-window-store` 拆分不替代 SSE reconnect 不变量测试（不同领域）。
- **REFT-03 auth 路由 negative cases** —— **Phase 11**。
- **`reducerTimeline.ts` 进一步精简 / 与 `message-window-store` 整合 / 等架构整合方向** —— 不本 phase；P9 仅 verify 现状（已 359 行）。
- **`ToolCard.tsx`（488 行）/ `knownTools.tsx`（423 行）拆分** —— 不本 phase；< 500 行视作合理大小（D-159 精神）；guard 加红线监控。
- **`_results.tsx` fallback 路径的「未知 tool」可观测性增强（telemetry / console.warn / 等）** —— 不本 phase；本 phase 只加 `data-testid` 测试锚，不改运行时行为。
- **既有 `web/src/hooks/queries/*.ts` 命名 / 文件组织统一化（kebab-case vs camelCase / 目录扁平 vs 分层）** —— 不本 phase；不重排目录。
- **`web/src/components/SessionList/` 子目录是否独立 `index.ts` re-export 还是直接 import from sub-component 文件** —— researcher 在 Slice 2 决定，不强制本 phase 收敛。
- **README / AGENTS / docs / website prose 中提到「`SessionList` 是大组件」/「`message-window-store` 是核心 store」之类的描述清理** —— **Phase 12 (CUT-12)**。本 phase 只动源码 + 测试 + guard 脚本。

</deferred>

---

*Phase: 9-Web internal decoupling*
*Context gathered: 2026-05-23*
