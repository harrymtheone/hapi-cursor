# Phase 5: Flavor consolidation + capability abstraction - Context

**Gathered:** 2026-05-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 5 交付的是：把 `shared/src/flavors.ts` 收敛为「Cursor 是唯一 flavor」的 capability 表，并让所有「能力是否可用 / 该走哪条路径」的判断都从这张表读，调用点不再出现 `flavor === '...'` 硬编码分支。

**In scope:** CUT-05 + REFA-01。

- `shared/src/modes.ts` 中 `AgentFlavor` 类型 narrows 到字面量 `'cursor'`。
- `shared/src/flavors.ts` 中的 `FLAVOR_CAPS` / `FLAVOR_LABELS` 收敛为单行 cursor；`isCodexFamilyFlavor()` 删除；capability 表填充覆盖 Cursor 当前路径所需能力槽。
- `shared/src/modes.ts` 中 `CLAUDE_/CODEX_/GEMINI_/OPENCODE_PERMISSION_MODES` 常量、`CodexCollaborationMode*` / `getCodexCollaborationMode*` helper、`getPermissionModesForFlavor` / `getPermissionModeOptionsForFlavor` / `isPermissionModeAllowedForFlavor` 中的 `if (flavor === ...)` 分支删除并收敛到 capability 表。
- 所有调用点的 `flavor === 'codex' / 'claude' / 'gemini' / 'opencode'` 分支去掉：`web/src/chat/modelConfig.ts`（codex/claude context window 分支）、`hub/src/sync/syncEngine.ts`（残留的 `flavor === 'cursor' ? flavor : 'cursor'` 退化分支）、`cli/src/modules/common/slashCommands.ts`（claude/codex 目录 case）、`web/src/components/ToolCard/PermissionFooter.tsx`（`isCodexFamilyFlavor` 调用 + `codex` 分支文案）等。
- `shared/src/flavors.test.ts` 重写为 cursor + unknown 兜底覆盖。
- 沿用 Phase 1–4 的 ripgrep zero-tolerance guard，本阶段追加 `'claude'|'codex'|'gemini'|'opencode'` 字面量与 `if (flavor ===` / `switch (flavor)` 关键词扫描。

**Out of scope:**

- REFA-05 mode hardening（未知 mode 抛错、bypass 切换、`loop ↔ session ↔ launcher` 循环依赖独立）— Phase 6。
- REFA-03 / REFA-04 wire contracts unification（`Session/Machine/Message` schema 上提、SSE patch 契约严格化）— Phase 7。本 phase 不改 wire 字面量 `AGENT_MESSAGE_PAYLOAD_TYPE = 'codex'`（modes.ts），它属于 wire 协议遗留，迁移成本会跨包扩散。
- REFT-01 cross-flavor permission contract 测试矩阵 — Phase 11。本 phase 只补 capability lookup focused 单测。
- CURS-01 model 切换 / CURS-02 skills toggle 等 v2 能力 — Milestone 2。
- README / docs / website prose 中 claude/codex/gemini/opencode 的命名清理 — Phase 12（CUT-12）。
- 不增加 feature flag、`.passthrough()` 兼容层、旧 flavor 字符串迁移 shim。

</domain>

<decisions>
## Implementation Decisions

### 1. AgentFlavor 类型 / flavor 字段命运（灰区 A）

- **D-69：保留 `AgentFlavor` 类型 + 保留 wire/session 上的 `flavor` 字段。** 把类型 narrow 到字面量 `'cursor'`：`export type AgentFlavor = 'cursor'`。`Session/Machine/Message` 等 DTO 仍带 `flavor` 字段。
- **D-70：完全删除 `flavor` 字段视为 wire-level 重构，不在本 phase 做。** Session / Message / SocketEvent 等 wire DTO 中的 `flavor` 字段保留——彻底去字段会蔓延到 cli/hub/web 三处 schema、SQLite store 列、SSE patch 形状，属于 Phase 7 wire contracts unification 的范围。
- **D-71：单字面量类型保留扩展位。** 未来若要再加 flavor，扩 `AgentFlavor` 联合 + 扩 `FLAVOR_CAPS` / `FLAVOR_LABELS` 一行即可；调用点不需要回头改结构。

### 2. Capability 表的 shape 与覆盖槽位（灰区 B）

- **D-72：把 `FLAVOR_CAPS` 升级为 `Record<AgentFlavor, FlavorCapabilities>`，capability 单元从「布尔标志集合」升级为「带值能力对象」。** `Set<Capability>` 只能表达「能/不能」，permission-mode 列表、context window、slash-commands 目录这类「带值能力」必须走表，否则调用点仍要 `if (flavor === ...)` 取常量——违反 SC#3。
- **D-73：当前 Cursor 路径需要的最小 capability 槽位（必填）：**
  - `permissionModes: readonly PermissionMode[]`（替代 `getPermissionModesForFlavor` 分支；Cursor 取值 `CURSOR_PERMISSION_MODES = ['default','plan','ask','yolo']`）
  - `supportsModelChange: boolean`（Cursor v1 = `false`，v2 CURS-01 时改 `true`）
  - `supportsEffort: boolean`（Cursor v1 = `false`）
  - `contextBudgetTokens: number | null`（Cursor v1 = `null`，让 `web/src/chat/modelConfig.ts::getContextBudgetTokens` 直接读表，不再按 flavor 分支算 codex/claude window）
  - `userSlashCommandsDir: (homedir: string) => string | null`（替代 `cli/src/modules/common/slashCommands.ts::getUserCommandsDir` 的 case；Cursor v1 = `null`，因为本阶段 Cursor 没有用户级 slash commands 目录路径——若 researcher 发现确实有 Cursor 路径需要，进表填）
  - `projectSlashCommandsDir: (projectDir: string) => string | null`（同上，对应 `getProjectCommandsDir`）
  - `permissionToneCopy: 'cursor' | 'codex'`（替代 `PermissionFooter::isCodexSession` 分支选不同文案；Cursor v1 = `'cursor'`，专门取代 `isCodexFamilyFlavor` 的最后一个调用点）
- **D-74：capability 不要塞 Cursor 不需要的"未来字段"。** 不预留 `mcpToolsList`、`pluginsDir` 等当前无调用方的槽位——以后用得上再加，避免一次过度抽象。
- **D-75：lookup helper 形状统一。** 提供 `getCapabilities(flavor): FlavorCapabilities | null`、`getCapability(flavor, key): T | null`，以及现有 `hasCapability` / `supportsModelChange` / `supportsEffort` / `getFlavorLabel` / `isKnownFlavor` 兼容包装（保留以减少调用点 churn，但内部走 `Record` 而非 `Set`）。
- **D-76：未知 flavor 兜底返回 `null`，不抛错。** 与 Phase 6 REFA-05 「未知 mode 抛错」语义不同——flavor 来源是 wire/数据库，可能是旧客户端、旧 session 数据，调用点应能优雅降级；mode 来源是 UI 选择，未知必抛。

### 3. shared/src/modes.ts 清理范围（灰区 C）

- **D-77：本 phase 一并删除 modes.ts 中所有 non-cursor permission-mode 常量与 helper 分支。** 删除 `CLAUDE_PERMISSION_MODES` / `CODEX_PERMISSION_MODES` / `GEMINI_PERMISSION_MODES` / `OPENCODE_PERMISSION_MODES` 常量与对应 type alias；删除 `CODEX_COLLABORATION_MODES` / `CodexCollaborationMode*` / `CODEX_COLLABORATION_MODE_LABELS` / `getCodexCollaborationMode*` / `getCodexCollaborationModeOptions`；`getPermissionModesForFlavor` 内 `flavor === 'codex' / 'gemini' / 'opencode'` / `'cursor'` 分支整体改为「读 capability 表的 `permissionModes`」单一路径。
- **D-78：`PERMISSION_MODES` / `PERMISSION_MODE_LABELS` / `PERMISSION_MODE_TONES` 收敛为 Cursor 实际使用的子集 + 历史 Claude mode 中仍被 web 引用的子集。** Cursor 用 `['default','plan','ask','yolo']`；如果 web 还有把 `acceptEdits` / `bypassPermissions` 写在 UI 上的代码（Phase 1 没全清），researcher 需要标出，本 phase 一并清。如果只剩 cursor 的四种，`PermissionMode` 类型直接收敛为 `CursorPermissionMode`。
- **D-79：保留 `CURSOR_PERMISSION_MODES` / `CursorPermissionMode` 命名。** Cursor 是单 flavor，但常量命名带 `CURSOR_` 前缀让 capability 表查值与未来扩展时仍清晰可读；如果 researcher 发现重命名为 `PERMISSION_MODES` 更顺更省 alias，可在 PLAN 中说明并改名（不是硬约束）。
- **D-80：mode 相关循环依赖与未知 mode 抛错不在本 phase 做。** 与 D-77/D-78 是不同方向的整理——本 phase 删的是「按 flavor 选 mode 集合」的硬编码，REFA-05 处理的是「mode 类型独立 + 未知 mode 抛错」。

### 4. wire 字面量 'codex' 与残余 helper（灰区 D）

- **D-81：`AGENT_MESSAGE_PAYLOAD_TYPE = 'codex'`（modes.ts）保留不动，并在 D-67 风格的 JSDoc 中标注「wire-protocol legacy literal — owned by Phase 7」。** 改名会同时触动 cli ↔ hub ↔ web 三端的 wire schema 与 SSE 解码器，超出 Phase 5 范围。
- **D-82：`isCodexFamilyFlavor()` 在本 phase 删除。** 当前调用点：(a) `shared/src/flavors.ts`（自身定义）；(b) `web/src/components/ToolCard/PermissionFooter.tsx::isCodexSession` 内部使用。后者用「`isCodexFamilyFlavor(metadata?.flavor) || toolName.startsWith('Codex')`」选 codex 风格的权限文案；按 D-73 的 `permissionToneCopy` capability，Cursor 永远是 `'cursor'` tone，调用点改为读 capability + tool name 兜底（`startsWith('Codex')` 这种 toolName 兜底是否保留由 researcher 判断；若 Phase 1 已删干净非 cursor toolName，可一并去掉）。
- **D-83：`FLAVOR_LABELS` 单行收敛但保留 `getFlavorLabel`。** Cursor 的展示名（`'Cursor'`）仍被 `hub/src/notifications/sessionInfo.ts` 调用；`getFlavorLabel(unknown)` 返回 `'Unknown'` 的兜底语义保留。

### 5. 验证、切片与测试（灰区 E）

- **D-84：本 phase ripgrep zero-tolerance 关键词。** 在 `cli/src/`、`hub/src/`、`web/src/`、`shared/src/` 中：
  1. 字符串字面量 `'claude'` / `'codex'` / `'gemini'` / `'opencode'`（独立词，作为 flavor 比较或 capability 判定使用）零命中；
  2. `flavor === '...'` 与 `switch (flavor)` 中除 `'cursor'` 之外的字面量零命中；本 phase 完成后理论上 `flavor === 'cursor'` 这种"恒真分支"也应从调用点中收敛掉（如 `hub/src/sync/syncEngine.ts:393` 的 `flavor === 'cursor' ? flavor : 'cursor'`），但若研究发现某些节点仍需「flavor 字段为 cursor 才进入」的 narrow，允许保留；
  3. `isCodexFamilyFlavor` 标识符零命中（含 import 与定义）。
- **D-85：白名单沿用 Phase 1–4 风格。** 默认 `.planning/codebase/` + `CHANGELOG.md`。`shared/src/modes.ts::AGENT_MESSAGE_PAYLOAD_TYPE` 注释里的 `'codex'` 字面量需在 PLAN 中以「具名行号 + JSDoc anchor」白名单——而不是放整文件白名单。
- **D-86：执行切片建议 4 片，每片落 `bun typecheck` + `bun run test` 绿。**
  1. **shared/ 类型与表收敛**：`flavors.ts` 升级为 `Record<AgentFlavor, FlavorCapabilities>` + 填充 cursor capability + 删除 `isCodexFamilyFlavor`；`modes.ts` 删除 non-cursor permission-mode 常量与 helper 分支、`AgentFlavor` narrow 到 `'cursor'`；`flavors.test.ts` 重写。
  2. **web/ 调用点收敛**：`web/src/chat/modelConfig.ts`（capability 读 `contextBudgetTokens`）、`web/src/components/ToolCard/PermissionFooter.tsx`（`isCodexSession` → capability `permissionToneCopy`），其它 web 中的 flavor 比较一并清理。
  3. **cli/ 与 hub/ 调用点收敛**：`cli/src/modules/common/slashCommands.ts`（`getUserCommandsDir` / `getProjectCommandsDir` 的 case 改读 capability + 当 capability 返回 `null` 时调用方走 no-commands 路径）、`hub/src/sync/syncEngine.ts`（清掉退化 `flavor === 'cursor' ? flavor : 'cursor'` 的双层条件）。
  4. **验证 + ripgrep guard 追加**：把 D-84 三类关键词加入既有 source guard 测试；`bun typecheck` + `bun run test` + capability lookup focused 单测全绿。
- **D-87：测试范围。** `shared/src/flavors.test.ts` 重写为 (a) cursor capability 槽位逐项断言（包括 `permissionModes` 内容、`supportsModelChange === false` 等），(b) `getCapability(unknown, key)` 与 `getFlavorLabel(unknown)` 的 `null` / `'Unknown'` 兜底，(c) `isKnownFlavor` 的 type narrow 行为。**不**写 cross-flavor 矩阵——REFT-01 是 Phase 11 才做。
- **D-88：本 phase 不跑 `build:single-exe`。** Phase 5 是类型与调用点收敛，没有 runtime asset 变更，硬门槛是 `bun typecheck` + `bun run test` + ripgrep guard；`build:single-exe` 验证留 Phase 12 milestone verification。

### Claude's Discretion

- 具体 capability 字段命名（`permissionToneCopy` 是占位名，researcher/planner 可以挑更贴语义的名）、模块 helper 是 `getCapabilities(flavor)` 还是 `getCursorCapabilities()`、`FlavorCapabilities` 类型定义在 `flavors.ts` 还是新文件，由 planner 按依赖图与最小 churn 决定。
- 如果 researcher 发现 `web/src/chat/modelConfig.ts` 的 codex/claude window 常量之外还有「同形态硬编码 capability」（比如 model 列表 fallback、CLI 二进制路径选择），应一并并入 capability 表，并在 PLAN 中追加 capability 槽位 + D-73 的更新说明。
- 如果 `cli/src/modules/common/slashCommands.ts` 中 Cursor 实际有用户/项目级 slash commands 目录（`~/.cursor/...` 之类），把路径填进 `userSlashCommandsDir` / `projectSlashCommandsDir`，而不是设为 `null`。
- `PermissionFooter.tsx::isCodexSession` 内 `toolName.startsWith('Codex')` 的兜底是否保留，按 Phase 1 删除残留情况判断；若已无 codex toolName 路径，去掉以满足 D-84#3 的零命中要求。

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 项目宪法

- `.planning/PROJECT.md` — Cursor-only 单 agent 定位；与 v2 的 CURS-01~05（model 切换 / skills toggle / MCP servers）边界。
- `.planning/REQUIREMENTS.md` §「v1 Requirements」— CUT-05 / REFA-01 映射 Phase 5；REFA-02/05 留给 Phase 6、REFA-03/04 留给 Phase 7、REFT-01 留给 Phase 11。
- `.planning/ROADMAP.md` §「Phase 5: Flavor consolidation + capability abstraction」— SC#1–#4 是验收锚点（`AgentFlavor` narrow 到 `'cursor'`、capability 表非空、零硬编码 `flavor ===` 比较、capability lookup focused 单测）。
- `AGENTS.md` — No backward compatibility、TypeScript strict、Bun workspaces、4 空格缩进、必要测试。

### Prior Phase Decisions

- `.planning/phases/01-cut-non-cursor-agents/01-CONTEXT.md` — 最小切除原则、ripgrep zero-tolerance + 白名单节奏。
- `.planning/phases/01-cut-non-cursor-agents/01-RESEARCH.md` 与 `01-04-SUMMARY.md` — 显式记录 `shared/src/{flavors,modes,resume,voice}.ts` 中 non-cursor literals 是 **Phase-5-owned 白名单**；本 phase 的核心动作就是把这块白名单消掉。
- `.planning/phases/01-cut-non-cursor-agents/01-RESEARCH.md` §「PermissionFooter cross-CUT note」— `web/src/components/ToolCard/PermissionFooter.tsx::isCodexFamilyFlavor` 的 cross-CUT 清理预约本 phase 完成。
- `.planning/phases/02-cut-external-integration-channels/02-CONTEXT.md` — 删除型 phase 不加兼容 shim（D-22/D-32）。
- `.planning/phases/03-cut-multi-user-namespace-isolation/03-CONTEXT.md` — 显式失败 vs silent fallback（D-41）；可 bisect 切片节奏（D-46~D-48）。
- `.planning/phases/04-cut-deployment-infrastructure/04-CONTEXT.md` — 源码级 zero-tolerance + 白名单（D-65/D-66）；与 Phase 12 长篇 docs 清理边界（D-67）。

### Codebase Maps

- `.planning/codebase/STACK.md` — `shared/src/flavors.ts` / `modes.ts` / `protocol.ts` 在 wire / runtime 中的位置。
- `.planning/codebase/ARCHITECTURE.md` — cli/hub/web 三端如何各自消费 flavor 与 permission mode。
- `.planning/codebase/INTEGRATIONS.md` — Cursor 集成现状（CLI 命令、permission mode、tool naming）。

### 本 phase 直接相关源码 / 调用点

- `shared/src/flavors.ts` — 类型 / capability 表 / labels / helper 全部在这里收敛。
- `shared/src/flavors.test.ts` — 重写。
- `shared/src/modes.ts` — `AgentFlavor` narrow + 删除 non-cursor permission-mode 常量与 helper 分支；保留 `AGENT_MESSAGE_PAYLOAD_TYPE`（D-81 注释）。
- `web/src/chat/modelConfig.ts` — `getContextBudgetTokens` 的 codex/claude 分支改读 capability `contextBudgetTokens`。
- `web/src/components/ToolCard/PermissionFooter.tsx` — `isCodexFamilyFlavor` 调用 + `isCodexSession` 改读 capability `permissionToneCopy`。
- `cli/src/modules/common/slashCommands.ts` — `getUserCommandsDir` / `getProjectCommandsDir` 的 claude/codex case 改读 capability `userSlashCommandsDir` / `projectSlashCommandsDir`。
- `hub/src/sync/syncEngine.ts` — 清理 `flavor === 'cursor' ? flavor : 'cursor'` 退化分支。
- `hub/src/notifications/sessionInfo.ts` — `getFlavorLabel` 调用保留，验证收敛后语义。
- `shared/src/resume.ts` / `shared/src/types.ts` / `shared/src/schemas.ts` — researcher 检查是否还有 `AgentFlavor` 字段引用需要 narrow（不是删字段，是确认类型 narrow 后零编译错）。
- 既有 Phase 1–4 ripgrep source guard 测试 — 追加本 phase D-84 关键词，是本 phase 的 4# 切片落点。

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- 现有 `hasCapability` / `supportsModelChange` / `supportsEffort` / `getFlavorLabel` / `isKnownFlavor` 公共 API 形状保留——内部从 `Set<flag>` 切换到 `Record<key, value>`，调用点不需要全改。
- 现有 `CURSOR_PERMISSION_MODES` 常量直接喂入 `permissionModes` capability，零再造。
- Phase 1–4 的 ripgrep source guard 框架可直接追加本 phase 关键词，沿用既有白名单形状。
- `getFlavorLabel(unknown) -> 'Unknown'` 兜底保留，`hub/src/notifications/sessionInfo.ts` 调用无需改。

### Established Patterns

- 删除型 / 收敛型 phase：「最小切除 + 一次切干净 + ripgrep zero-tolerance」，没有 feature flag 与 shim。
- 切片每片绿色：`bun typecheck` + `bun run test`。
- 类型 narrow 让 TypeScript 编译器暴露所有调用点；按 narrow 后的编译报错驱动收敛清单（与 Phase 4 同款工作流）。
- `shared/` 是 cli/hub/web 的单一类型源；本 phase 的所有 capability 槽位都定义在 `shared/`，三端只读不写。

### Integration Points

- wire layer：`Session/Machine/Message` DTO 仍带 `flavor` 字段（值固定为 `'cursor'`），保持 Phase 7 wire contracts 触动空间。
- web UI：`PermissionFooter` 文案分支收敛到 capability `permissionToneCopy`；`getContextBudgetTokens` 收敛到 capability `contextBudgetTokens`；其余 web 路径若有 flavor 比较，本 phase 切片 2 一并清。
- cli runtime：slash commands 目录用 capability 函数读取；`runCursor.ts` / `cursorLauncher` 等不在本 phase 触动（Phase 6 范围）。
- hub runtime：`syncEngine.ts` / `sessionInfo.ts` / `routes/sessions.ts` 中 `AgentFlavor` 引用收敛后由编译器驱动出口。

</code_context>

<specifics>
## Specific Ideas

- Capability 表的「带值能力」是核心抽象。SC#3 「ripgrep finds zero hardcoded capability gates」隐含一条强约束：**调用点只允许从 capability 表读值，不允许内联条件**。即使 Cursor 是单 flavor，调用点也必须走表，否则未来加 flavor 又会蔓延。
- 不要为了「短期更短」把 capability 槽位塞进 `Session` / `Message` DTO 缓存——capability 是 type-level / module-level 静态查询，不是 wire 数据。
- `permissionToneCopy: 'cursor' | 'codex'` 这个 union 看起来奇怪（codex 已删），但它代表的是「权限文案分支」这件事：如果未来加 flavor 选不同文案，扩 union 即可。比 `isCodexLikeUI` 这种语义化布尔更扩展性。
- modes.ts 大改后，cli 与 web 中 import 的 `*_PERMISSION_MODES` / `CodexCollaborationMode*` 会编译失败——按编译失败清单驱动调用点收敛是最稳的工作流。
</specifics>

<deferred>
## Deferred Ideas

- **彻底删除 wire/session 上的 `flavor` 字段** — 触动 cli/hub/web 三端 schema、SQLite store 列、SSE patch 形状；与 REFA-03 wire contracts 上提合并到 **Phase 7**。
- **`AGENT_MESSAGE_PAYLOAD_TYPE = 'codex'` wire 字面量改名 / 收敛** — 同上，**Phase 7**。
- **Mode 类型从 `loop ↔ session ↔ launcher` 循环依赖中独立 + 未知 mode 抛错** — REFA-05 / **Phase 6**。
- **Cursor permission-mode → CLI flag 完整矩阵测试** — REFT-01 / **Phase 11**。
- **README / docs / website 中 claude/codex/gemini/opencode 命名清理** — CUT-12 / **Phase 12**。
- **CURS-01 model 切换：把 capability `supportsModelChange` 翻 true 并补 model 列表 capability 槽** — Milestone 2。

</deferred>

---

*Phase: 5-Flavor consolidation + capability abstraction*
*Context gathered: 2026-05-22*
