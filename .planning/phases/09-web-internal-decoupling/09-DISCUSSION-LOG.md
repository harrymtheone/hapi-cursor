# Phase 9: Web internal decoupling - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-23
**Phase:** 9-Web internal decoupling
**Areas discussed:** A (scope alignment), B (SessionList split), C (message-window-store split), D (settings + HappyComposer + _results split), E (_results.tsx split shape — folded into D), F (util promotion boundary), G (renderer integration test shape), H (slicing rhythm)

**Discussion mode:** Claude-recommended batch — Claude presented 6 gray areas with recommended answers; user replied "按照你推荐的来" twice (initial selection + final batch confirmation). All recommendations adopted as-is.

---

## A. Scope Alignment (ROADMAP 快照偏移)

Claude 实测发现两条 SC 已自然达成：`madge --circular web/src/` 与 `web/src/components/ToolCard/` 均 0 环；`reducerTimeline.ts` 已 359 行（< 500）。同时 `CursorPermissionMode` 已由 P5/P7 D-119 落地。

| Option | Description | Selected |
|--------|-------------|----------|
| 改成 verify-only + guard 防回归 | ToolCard 循环 + reducerTimeline 不再「做」，只 guard 现状；`CursorPermissionMode` 标 done；`createApiQuery` 走「先调查后决定」（≥ 3 用户才抽） | ✓ |
| 按原始 SC 措辞保留拆分清单 | 即便已达成也走流程重做 | |

**User's choice:** Verify-only + guard。
**Notes:** D-145 / D-146 / D-147。

---

## B. SessionList.tsx (953 行) 拆分策略

| Option | Description | Selected |
|--------|-------------|----------|
| 按 section 拆 sub-component | Header / Search / List / Item / Empty 各自文件 | |
| 按 concern 拆 | data-hooks / rendering / interactions 分层 | |
| 混合（hooks 先，sub-component 后） | Step 1 抽 4 hooks（data/search/selection/keyboard），Step 2 按视觉边界拆 4 sub-component；`SessionList.tsx` 退化 orchestrator < 250 行 | ✓ |

**User's choice:** 混合派 + 顺序固定。
**Notes:** D-148。default export 不变，外部 import 路径零变化。

---

## C. message-window-store.ts (1088 行) 拆分

| Option | Description | Selected |
|--------|-------------|----------|
| 激进瘦身：迁移到 TanStack Query / 与 useSSE 合并 | CONCERNS.md 提的「restrict to chat-window pagination only」按字面执行 | |
| 保守职责拆 + facade（不改语义） | 拆 4 sub-module（state / pagination / merge / subscriptions）+ 原文件退化薄 facade；`useMessageWindow` 公开 API 签名零变化 | ✓ |

**User's choice:** 保守职责拆。
**Notes:** D-149 / D-150。「迁移到 TanStack Query」「与 useSSE 合并」明确进 `<deferred>` 作为独立架构决策；本 phase 仅做拆分，不改语义。同 P8 D-129 SessionCache facade 套路。

---

## D. settings/index.tsx (758) + HappyComposer.tsx (669) 拆分

| Option | Description | Selected |
|--------|-------------|----------|
| 按 tab/section 拆 sub-route | 各 tab 独立 lazy load 路由 | |
| 抽 hooks + 单文件保持骨架 | 只抽 state hook，不拆 sub-component | |
| hooks 抽 + sub-component 拆（同 SessionList 套路） | Step 1 抽 hooks，Step 2 按 tab/section 拆 sub-component；入口文件 < 300 行 | ✓ |

**User's choice:** 同 SessionList 套路。
**Notes:** D-151。settings 按 tab、HappyComposer 按 section（toolbar / input / attachments / send-controls）；具体 section 边界 researcher 看实际 JSX 决定。

---

## E. _results.tsx (687 行) 拆分

> Folded into D as a parallel sub-case — same recommendation batch.

| Option | Description | Selected |
|--------|-------------|----------|
| 单文件按 tool 类型拆 sub-view（不拆出新文件） | 内部 switch / map，不新增文件 | |
| dispatcher + per-tool result 子组件（mirror 现有 *View.tsx 结构） | `_results.tsx` 退化 dispatcher（< 250 行）；各 tool result 拆到 `views/results/*Result.tsx` mirror `views/*View.tsx` 命名 | ✓ |

**User's choice:** dispatcher + per-tool result。
**Notes:** D-152 / D-153。不动 `_all.tsx` / `ToolCard.tsx` / `knownTools.tsx` 三者间的 import 拓扑（已 0 环）。

---

## F. util 上提到 shared/ 的边界

| Option | Description | Selected |
|--------|-------------|----------|
| 严格按 REFW-03 字面：levenshtein 与 estimateBase64Bytes 都进 shared/ | 字面对齐 SC#3 | |
| 跨包真重复 → shared/；纯 web-only 重复 → web/src/lib/ | `estimateBase64Bytes`（cli + hub）进 `shared/src/uploads.ts`；`levenshteinDistance`（仅 web 内）进 `web/src/lib/fuzzyMatch.ts` | ✓ |

**User's choice:** 跨包真重复才进 shared。
**Notes:** D-154 / D-155。与 REFW-03 措辞有显式偏差，CONTEXT 已记录理由（P7 D-119「shared = wire / 跨端共享语义唯一来源」精神 + 避免 shared 沾染 web-only 算法）；verification 阶段可直接引用此偏差记录，不必再问。

---

## G. SC#1「every known tool resolves to a renderer」集成测试形态

| Option | Description | Selected |
|--------|-------------|----------|
| Snapshot test | 对每个 toolName 渲染快照，PR 中视觉 diff | |
| Runtime registry inspection | 仅断言 `Object.keys(knownTools)` 在 `_results.tsx` switch 中都被覆盖（不真渲染） | |
| table-driven + RTL render + 反向断言 fallback 锚 | `Object.keys(knownTools)` 遍历，每个 RTL render 后断言 (a) 不抛 (b) 无 `data-testid="tool-card-unknown-fallback"` | ✓ |

**User's choice:** table-driven + RTL render + 反向断言。
**Notes:** D-156。`_results.tsx` fallback 路径加 `data-testid` 锚（若现无）；guard ripgrep 锚字符串确保未来不被改名失锚。

---

## H. 切片节奏

| Option | Description | Selected |
|--------|-------------|----------|
| 4 切片，沿用 P6/P7/P8 模板 | Slice 1: util dedup + cycles guard + renderer 集成测试；Slice 2: message-window-store + SessionList 拆分；Slice 3: settings + HappyComposer + _results 拆分；Slice 4: guard 收口 | ✓ |
| 按风险重排 / 按文件维度切 | 每文件一切，或先做最大文件 | |

**User's choice:** 4 切片，沿用模板。
**Notes:** D-157 / D-158。每片 `bun typecheck` + `bun run test` 全包绿；ripgrep + madge guard sweep 在 Slice 4 收口。

---

## Claude's Discretion

- settings 按 tab 还是按 concern 拆 sub-component（推荐按 tab）。
- HappyComposer section 边界（toolbar / input / attachments / send-controls 是否合并）。
- `_results.tsx` 拆出来的 `results/` 子目录是否每个 tool 都拆，还是只拆 ≥ 50 行的 result（推荐 ≥ 50 行才拆）。
- `createApiQuery` 抽象的「3 用户阈值」是否升至 4（不能降至 2）。
- `web/src/lib/fuzzyMatch.ts` 是否一并暴露其它 fuzzy 工具（推荐只搬 `levenshteinDistance`）。
- `shared/src/uploads.ts` 是否一并上提 `MAX_UPLOAD_BYTES` 常量（推荐一并上提）。
- `_results.tsx` fallback `data-testid` 锚字符串具体值（kebab-case + `data-testid` 形态）。
- `scripts/check-no-circular-web.sh` 写独立脚本还是并入主 guard（推荐独立脚本）。
- `message-window-store` 4 sub-module 是否各自暴露（默认只通过 facade）。
- `madge --circular web/src/` 是否需要 `--exclude` 过滤 / `cd web` 跑（researcher 在 Slice 1 实测决定）。

## Deferred Ideas

- `message-window-store` 迁移到 TanStack Query / 与 `useSSE` 合并 —— 独立架构决策。
- `createApiQuery` 抽象（若 < 3 用户共享同一壳） —— 条件性 deferred。
- `fuzzyMatch.ts` 进一步抽 `fuzzyScore` / `fuzzyRank`。
- `shared/src/uploads.ts` 进一步抽 upload 验证 / 文件类型识别。
- settings 各 tab 抽独立 sub-route / lazy load。
- HappyComposer section 抽独立 hook 库。
- REFC-01 / REFC-02 → Phase 10。
- REFT-01 / REFT-02 / REFT-03 → Phase 11。
- `reducerTimeline.ts` 进一步精简 / 与 `message-window-store` 整合。
- `ToolCard.tsx` / `knownTools.tsx` 拆分（< 500 行视作合理大小）。
- `_results.tsx` fallback「未知 tool」可观测性增强（telemetry / console.warn）。
- `web/src/hooks/queries/*.ts` 命名 / 目录组织统一化。
- README / AGENTS / docs prose 中过时描述清理 → Phase 12 (CUT-12)。
