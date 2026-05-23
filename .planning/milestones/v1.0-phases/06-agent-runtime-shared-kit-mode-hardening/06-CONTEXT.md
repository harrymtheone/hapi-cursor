# Phase 6: Agent runtime shared kit + mode hardening - Context

**Gathered:** 2026-05-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 6 交付的是：让 Cursor local 与 remote launcher **共享一份 runtime kit**（消除 permission-mode mapping 重复）、让 `cli/src/cursor/` 内 madge **零循环依赖**、让未知 permission mode **抛 typed error**（不再静默兜底）。映射 **REFA-02 + REFA-05**。

**In scope:**

- 在 `cli/src/agent/` 既有 5 个准 shared kit 单元（`AgentSessionBase` / `BaseLocalLauncher` / `RemoteLauncherBase` / `localLaunchPolicy` / `loopBase`）之上补齐唯一缺位：`ModeConfig`（permission-mode → CLI args fragment 映射），让 `cursorLocalLauncher.ts::permissionModeToCursorArgs` 与 `cursorRemoteLauncher.ts::permissionModeToAgentArgs` 收敛到单一来源。
- 新建 `cli/src/cursor/modes.ts` 作为 mode 类型与 cli-runtime mode 形状（`EnhancedMode`）的独立模块；`loop.ts / session.ts / cursorLocalLauncher.ts / cursorRemoteLauncher.ts` 均从 `modes.ts` 读类型，不再产生 `session ↔ loop ↔ launcher` 反向依赖。
- 定义 typed `UnknownPermissionModeError`（带 `offendingMode`），由 ModeConfig 入口在未知 mode 时抛出；`runCursor.ts::resolvePermissionMode` 沿用同一 error class。
- 新增测试覆盖 mid-session `yolo + remote` 与 `plan` 切换两条路径，以及未知 mode 抛错路径；既有 `bun run test` 套件保持绿。
- 追加 ripgrep + madge guard：`permissionModeToCursorArgs` / `permissionModeToAgentArgs` 重复 mapping 标识符零命中、launcher 内 `permissionMode as string` 零命中、`madge --circular cli/src/cursor` 退出码 = 0。

**Out of scope:**

- REFA-03 / REFA-04 wire contracts 上提（`Session / Machine / Message / RunnerState` DTO + SSE patch schema）— Phase 7。本 phase 不动 wire layer，`EnhancedMode` / `PermissionMode` 是 cli-runtime 概念，不进 `shared/src/schemas.ts`。
- REFH-01 / REFH-02 hub 内部解耦（`SessionCache` / `SyncEngine` 拆分）— Phase 8。
- REFT-01 cross-flavor permission contract 矩阵 — Phase 11。本 phase 只补 Phase 6 scope 内的两条 mid-session 路径 + unknown mode 路径，三测；不写跨 flavor 矩阵。
- CURS-01 model 切换 / CURS-02 skills toggle 等 v2 能力 — Milestone 2。
- `AGENT_MESSAGE_PAYLOAD_TYPE = 'codex'` 字面量 — Phase 7（Phase 5 D-81 已锚定）。
- README / docs / website prose 清理 — Phase 12（CUT-12）。
- 不增加 feature flag、`.passthrough()` 兼容层、permission mode 字符串迁移 shim、launcher 重写。

</domain>

<decisions>
## Implementation Decisions

### 1. Shared kit shape：补 ModeConfig，沿用既有 4 名（灰区 A）

- **D-89：不 rename，仅补 ModeConfig。** SC#1 列出 `SessionContext / LocalAdapter / RemoteAdapter / ModeConfig / LaunchPolicy` 是「概念位」，不是「文件名硬约束」。`cli/src/agent/sessionBase.ts::AgentSessionBase`、`cli/src/modules/common/launcher/BaseLocalLauncher.ts`、`cli/src/modules/common/remote/RemoteLauncherBase.ts`、`cli/src/agent/localLaunchPolicy.ts` 已经分别承担 `SessionContext / LocalAdapter / RemoteAdapter / LaunchPolicy` 的角色，rename 会触动每个文件的所有 import 调用点（cli/runner、cli/cursor、test），churn 高、零功能收益。
- **D-90：每个既有单元加 JSDoc cross-reference 锚定 SC#1 概念位。** 在 `AgentSessionBase` 类注释顶部加 `@implements SessionContext (Phase 6)`，其它三个同理；这是 SC#1 「exist as a shared module」的可验证锚点（grep `@implements SessionContext` 一次命中），也方便未来 multi-flavor reopen 时直接 rename。
- **D-91：新增 `cli/src/agent/modeConfig.ts`。** 不在 `shared/src/flavors.ts` 加 capability 槽 —— ModeConfig 是 cli-runtime concept（产 CLI args fragment 给 launcher 用），与 web/hub 无关。塞 capability 表会把「输出 process spawn args」这种 runtime 行为耦合进 wire 层。`modeConfig.ts` 暴露：
  - `type CursorArgsFragment = { mode?: 'plan' | 'ask'; yolo?: boolean }`
  - `permissionModeToCursorArgs(mode: PermissionMode): CursorArgsFragment` —— 未知 mode 抛 `UnknownPermissionModeError`
  - 该 helper 是 local / remote 两个 launcher 的唯一来源。
- **D-92：不合并 `buildAgentArgs`（remote 用）与 `cursorLocal.ts` 内联 args（local 用）。** 两者表达的是**两种 process spawn 形态**（local 长驻交互、remote 单 turn `-p` 流式 JSON），合并会迫使引入 `mode: 'local' | 'remote'` 大分支，得不偿失。仅 permission-mode → `{mode, yolo}` fragment 是真正的复制项，收敛它就够。
- **D-93：`localLaunchPolicy.ts` 不动。** 它已是单文件、零依赖、纯函数，属于 SC#1 的 `LaunchPolicy`，命名贴语义；本 phase 不改文件名，不挪位置。

### 2. Mode 类型独立 + 循环依赖打断（灰区 C）

- **D-94：新建 `cli/src/cursor/modes.ts`，承载 `PermissionMode` re-export 与 `EnhancedMode` 类型。** 当前 madge 报 3 个循环：`session ↔ loop`、`session ↔ loop ↔ remoteLauncher`、`session ↔ loop ↔ localLauncher`；根因是 `loop.ts` 既定义 `PermissionMode / EnhancedMode` 类型，又 import 两个 launcher（运行时拓扑），导致 `session.ts` 反向 import `loop.ts` 拿类型 → 形成环。
- **D-95：`cli/src/cursor/modes.ts` 不 import 任何 `loop.ts / session.ts / cursorLocalLauncher.ts / cursorRemoteLauncher.ts / cursorLocal.ts`。** 只从 `@hapi/protocol/types` 取 `CursorPermissionMode` re-export 为 `PermissionMode`，本地再声明 `EnhancedMode = { permissionMode: PermissionMode; model?: string }`。SC#2 关键锚点 = `modes.ts` 自身的 import 集合。
- **D-96：调用点收敛后的 import 拓扑（planner 验证用）：**
  - `loop.ts`：从 `modes.ts` 拿类型；import 两个 launcher + session 是 OK 的（运行时桥）。
  - `session.ts`：从 `modes.ts` 拿类型；**不再 import `loop.ts`**（当前 `import type { EnhancedMode, PermissionMode } from './loop'` 删掉）。
  - `cursorLocalLauncher.ts` / `cursorRemoteLauncher.ts`：从 `modes.ts` 拿类型；session import 保留（运行时合理）。
  - `runCursor.ts`：从 `modes.ts` 拿 `PermissionMode` 类型；不再走 `from './loop'` 拿类型。
- **D-97：`EnhancedMode` 保持在 `cli/src/cursor/` 域内，不上提到 `shared/`。** 它携带 `model: string`（runtime cli arg），未来 CURS-01 加 model 切换时会扩字段，但仍是 cli-runtime concept；`shared/` 的 wire schema 是另一条线（Phase 7）。

### 3. 未知 mode 抛错语义（灰区 D）

- **D-98：定义 `UnknownPermissionModeError extends Error`，放在 `shared/src/modes.ts`。** 字段：`offendingMode: string`、`message: \`Unknown permission mode: ${offendingMode}\``。放 `shared/` 是因为 cli + hub + web 三端都可能在 UI / RPC 边界抛它（Phase 5 D-76 已写明「mode 来源是 UI 选择，未知必抛」）；放 cli-local 会迫使 hub/web 再造一个。
- **D-99：抛点 = ModeConfig 入口（`permissionModeToCursorArgs`）。** Launcher 调用 ModeConfig 时，未知 mode 直接 propagate 出来 —— launcher 不 try/catch、不静默吞。`runCursor.ts::resolvePermissionMode` 已经在 RPC 边界 throw，本 phase 把它的 `throw new Error('Invalid permission mode')` 升级为 `throw new UnknownPermissionModeError(rawValue)`，统一 error class。
- **D-100：Launcher 内部消除 `permissionMode as string` 强转。** `session.getPermissionMode()` 返回类型从 `SessionPermissionMode | undefined` narrow 到 `PermissionMode | undefined`（依赖 D-94 类型流），launcher 直接传入 `permissionModeToCursorArgs`，由 ModeConfig 决定是 `undefined` 走 default 还是非法字符串抛错。launcher 文件内 `as string` 命中数本 phase 验收 = 0。
- **D-101：`undefined` permission mode 不算未知。** 兼容当前 `session.permissionMode?: PermissionMode` 可选语义：`permissionModeToCursorArgs(undefined)` 返回 `{}`（等价 default）；只有传入字符串但不在 `CURSOR_PERMISSION_MODES` 集合内才抛错。Default mode 走 fall-through，仍是 cursor agent 的 zero-flag 默认行为。
- **D-102：`UnknownPermissionModeError` 不被 `runCursor.ts::loop` 吞。** 走当前 `crashed = true` → `lifecycle.markCrash(error)` 路径，session 以 error 状态结束 + log。这与 D-76「mode 输入未知必抛」一致：错误冒到顶层让 runner / terminal 看见，不要硬塞 fallback。

### 4. 测试范围（灰区 SC#4 解读 + 测试设计）

- **D-103：SC#4 「bypass + remote / bypass + plan」解读为 yolo + remote / 含 plan 的切换。** ROADMAP 该措辞来自 Phase 5 narrow 之前（Claude `bypassPermissions` 残留），Cursor 集合是 `['default','plan','ask','yolo']`，yolo 是权限最宽的 mode（与 `bypassPermissions` 同语义位）；plan 切换是 launcher 在两次 turn 之间改 args 的最常见路径。本 phase 不改 ROADMAP 文本（避免与 phase 边界外的措辞争议绑定），用 CONTEXT 锚定解读。
- **D-104：本 phase 新增 3 个测试覆盖：**
  1. **mid-session yolo 切换（remote launcher）** —— 起 default、turn 1 完成、切到 yolo、turn 2 spawn 时 args 包含 `--yolo` 不含 `--mode`。
  2. **mid-session plan ↔ default 切换** —— 至少覆盖 local launcher 的 `mode = 'plan'` 注入 + 切回 default 时不带 `--mode` flag。优先 local launcher（local 是 `cursorLocal.ts::spawnWithTerminalGuard` 的 args 注入，比较直接）；如果 remote launcher 用一个相同测试基础设施就能复用，researcher 决定是否双侧都测。
  3. **未知 mode 抛错路径** —— 直接对 `permissionModeToCursorArgs` 单测 `'weird' as PermissionMode` 抛 `UnknownPermissionModeError` 且 `error.offendingMode === 'weird'`；以及 `runCursor.ts::resolvePermissionMode` 对非法 RPC payload 抛同一 error class。
- **D-105：测试基础设施优先 mock spawn / inspect args，不走真实 `agent` 子进程。** Mid-session 切换的核心是「launcher 第二轮 turn 用了新 mode 的 args」，断言点是 args 数组形状；真实 spawn 会引入 cursor agent 安装假设，破 CI。可以参考既有 `cli/src/cursor/utils/cursorEventConverter.test.ts` 与 `cli/src/runner/buildCliArgs.test.ts` 的 testing pattern。
- **D-106：现有 `bun run test` 套件保持绿。** D-95 改 import 方向 + D-100 改类型 narrow 会让 TS 编译器暴露调用点错误，按编译失败清单驱动收敛 —— 与 Phase 4–5 同款工作流。

### 5. 切片与 guard（灰区 F + G）

- **D-107：执行切片 4 片，每片落 `bun typecheck` + `bun run test` 绿。**
  1. **modes.ts 抽出 + 破循环**：建 `cli/src/cursor/modes.ts`；把 `loop.ts` 中 `PermissionMode / EnhancedMode` 类型搬过去；改 `loop.ts / session.ts / cursorLocalLauncher.ts / cursorRemoteLauncher.ts / runCursor.ts` 的 import 来源。**门槛**：`madge --circular cli/src/cursor` 退出码 = 0；`bun typecheck` + `bun run test` 全绿。
  2. **ModeConfig + UnknownPermissionModeError**：建 `cli/src/agent/modeConfig.ts`；在 `shared/src/modes.ts` 加 `UnknownPermissionModeError`；`runCursor.ts::resolvePermissionMode` 改 throw class；`permissionModeToCursorArgs` 单测就绪。**门槛**：`bun typecheck` + `bun run test`（含新单测）全绿。
  3. **Launcher 收敛**：`cursorLocalLauncher.ts::permissionModeToCursorArgs` 与 `cursorRemoteLauncher.ts::permissionModeToAgentArgs` 改读 D-91 的 `modeConfig`；`session.getPermissionMode()` 返回 narrow 到 `PermissionMode | undefined`；launcher 内 `as string` 强转删除。**门槛**：ripgrep `permissionModeToAgentArgs|permissionModeToCursorArgs` 在 launcher 文件内 0 命中（保留 modeConfig.ts 自身定义）；`permissionMode as string` launcher 文件内 0 命中；`bun typecheck` + `bun run test` 全绿。
  4. **测试 + guard**：D-104 三测落地；ripgrep / madge guard 测试加入既有 source guard 套件。**门槛**：所有 D-108 关键词 0 命中（白名单内除外）；`madge --circular cli/src/cursor` 退出码 = 0；`bun typecheck` + `bun run test` 全绿。
- **D-108：ripgrep zero-tolerance 关键词。** 在 `cli/src/`、`shared/src/`、`hub/src/`、`web/src/`：
  1. `permissionModeToCursorArgs` —— 仅允许在 `cli/src/agent/modeConfig.ts` 命中（定义 + export）；调用点 0 命中重复定义。
  2. `permissionModeToAgentArgs` —— 0 命中（彻底删除）。
  3. `permissionMode as string` —— launcher 文件（`cursorLocalLauncher.ts`、`cursorRemoteLauncher.ts`）内 0 命中。
  4. **`madge --circular cli/src/cursor` 退出码 = 0**（作为可执行 guard，加进 `bun run test` 流水或 phase verify 脚本）。
- **D-109：白名单沿用 Phase 4–5 风格 —— 默认 `.planning/codebase/` + `CHANGELOG.md`。** D-108#1 的 modeConfig.ts 定义行不进白名单（白名单是文件粒度，但这个标识符仅一个文件命中，靠 ripgrep 计数即可）。
- **D-110：本 phase 不跑 `build:single-exe`。** Phase 6 是 cli-runtime 类型 + 抽象收敛，没有 runtime asset 变更；硬门槛是 `bun typecheck` + `bun run test` + ripgrep + madge guard。`build:single-exe` 留 Phase 12 milestone verification。

### Claude's Discretion

- ModeConfig 的具体 export 名（`permissionModeToCursorArgs` vs `buildCursorArgsFragment` vs `cursorArgsFromMode`），以及 `CursorArgsFragment` 类型是否进一步细分（`{ mode: 'plan' } | { mode: 'ask' } | { yolo: true } | {}` discriminated union vs 当前的 optional shape），由 planner / researcher 按调用点最小 churn 决定。
- D-90 JSDoc cross-reference 的具体 tag 选择（`@implements SessionContext` vs `@phase6-role SessionContext` vs 自由文本注释）由 researcher 决定，只要 grep 锚点稳定即可。
- D-104 的「local 还是双侧测 plan 切换」由 researcher 评估测试基础设施成本决定；如果 remote launcher 用既有 mock spawn 就能复用，双侧都测更好。
- 是否把 `localLaunchPolicy.ts` 重命名为 `launchPolicy.ts` 顺手收敛（cursor-only 后 "local" 前缀冗余），由 planner 决定 —— 不强约束，但与 D-89「不 rename」一致更稳。

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 项目宪法

- `.planning/PROJECT.md` — Cursor-only 单 agent 定位；mode 类型未来 v2 CURS-01 扩字段空间。
- `.planning/REQUIREMENTS.md` §「v1 Requirements」— REFA-02 / REFA-05 映射 Phase 6；REFA-03/04 留给 Phase 7、REFH-01/02 留给 Phase 8、REFT-01 留给 Phase 11。
- `.planning/ROADMAP.md` §「Phase 6: Agent runtime shared kit + mode hardening」— SC#1–#5 是验收锚点（5 个共享单元、`madge` = 0、unknown mode 抛 typed error、bypass-related 测试、ripgrep 检不到 mapping 重复）。SC#4 「bypass + remote / bypass + plan」按 D-103 解读为 `yolo + remote` / 含 `plan` 的切换。
- `AGENTS.md` — No backward compatibility、TypeScript strict、Bun workspaces、4 空格缩进、必要测试。

### Prior Phase Decisions

- `.planning/phases/01-cut-non-cursor-agents/01-CONTEXT.md` — D-11~D-13 源码关键词零容忍 + 白名单、D-14/D-15 小提交 + 每提交测试。
- `.planning/phases/02-cut-external-integration-channels/02-CONTEXT.md` — D-22/D-32 删除型 phase 不加兼容 shim。
- `.planning/phases/03-cut-multi-user-namespace-isolation/03-CONTEXT.md` — D-41 显式失败 vs silent fallback、D-46~D-48 可 bisect 切片节奏。
- `.planning/phases/04-cut-deployment-infrastructure/04-CONTEXT.md` — D-65~D-67 源码级 zero-tolerance + 白名单、长篇 docs 留 Phase 12。
- `.planning/phases/05-flavor-consolidation-capability-abstraction/05-CONTEXT.md` — D-72/D-73 capability 表与槽位填充原则、D-76 unknown flavor null vs unknown mode throw 语义对照（**Phase 6 直接落地**）、D-81 wire 字面量边界、D-84/D-86 ripgrep guard + 4 切片节奏。Phase 5 `<deferred>` 明确点名：「Mode 类型从 `loop ↔ session ↔ launcher` 循环依赖中独立 + 未知 mode 抛错」属 Phase 6。

### Codebase Maps

- `.planning/codebase/ARCHITECTURE.md` — cli agent runtime 拓扑、`loop / session / launcher` 三层关系。
- `.planning/codebase/STACK.md` — `cli/src/cursor/` 与 `cli/src/agent/` 在 cli runtime 内的位置。
- `.planning/codebase/INTEGRATIONS.md` — Cursor agent CLI 调用界面（`agent -p / --mode / --yolo / --resume / --model` 等）。

### 本 phase 直接相关源码 / 调用点

- `cli/src/cursor/cursorLocalLauncher.ts` — `permissionModeToCursorArgs`（删除，改读 ModeConfig）；`session.getPermissionMode() as string` 强转移除。
- `cli/src/cursor/cursorRemoteLauncher.ts` — `permissionModeToAgentArgs`（删除，改读 ModeConfig）；`mode.permissionMode as string` 强转移除；`buildAgentArgs` 内 permission-mode 部分改读 ModeConfig fragment。
- `cli/src/cursor/cursorLocal.ts` — `opts.mode / opts.yolo` 调用方改由 ModeConfig 注入；本文件 args 拼接逻辑不变（保持 local 形态独立，D-92）。
- `cli/src/cursor/loop.ts` — 删除 `PermissionMode / EnhancedMode` 类型定义，从 `cli/src/cursor/modes.ts` re-import；保留 orchestration `loop()` 函数。
- `cli/src/cursor/session.ts` — `import type { EnhancedMode, PermissionMode } from './loop'` 改为 `from './modes'`；`getPermissionMode()` 返回类型 narrow（依赖 `AgentSessionBase` 类型流，可能需要 sessionBase 协调）。
- `cli/src/cursor/runCursor.ts` — `PermissionMode` import 来源切换；`resolvePermissionMode` 内 `throw new Error('Invalid permission mode')` 升级为 `throw new UnknownPermissionModeError(rawValue)`。
- `cli/src/agent/sessionBase.ts` — `AgentSessionBase` 顶部加 `@implements SessionContext`（D-90）；`SessionPermissionMode | undefined` 与 cursor `PermissionMode` 类型流协调（researcher 判断是否需要在 base 加 generic）。
- `cli/src/modules/common/launcher/BaseLocalLauncher.ts` / `cli/src/modules/common/remote/RemoteLauncherBase.ts` — 加 `@implements LocalAdapter` / `@implements RemoteAdapter`（D-90）。
- `cli/src/agent/localLaunchPolicy.ts` — 加 `@implements LaunchPolicy`（D-90）；文件本体不动。
- `cli/src/agent/loopBase.ts` — orchestration 入口，本 phase 不动逻辑；如果 import 受 D-95 类型变动影响，调整 import 来源。
- **新文件 `cli/src/cursor/modes.ts`** — `PermissionMode` re-export + `EnhancedMode` 类型；不 import `loop/session/launcher/cursorLocal`。
- **新文件 `cli/src/agent/modeConfig.ts`** — `CursorArgsFragment` 类型 + `permissionModeToCursorArgs(mode)` 函数 + 抛 `UnknownPermissionModeError`。
- `shared/src/modes.ts` — 新增 `UnknownPermissionModeError` class（带 `offendingMode` 字段）；其它常量与类型不动。
- 既有 Phase 4–5 ripgrep source guard 测试 — 追加本 phase D-108 关键词 + madge guard，是 4# 切片落点。

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- `AgentSessionBase` / `BaseLocalLauncher` / `RemoteLauncherBase` / `localLaunchPolicy` / `loopBase` 全部就位 —— 本 phase 不写新 base class，只补 `ModeConfig` + 文件级 mode 类型独立。
- `runCursor.ts::resolvePermissionMode` 已经在 RPC 边界做 Zod schema + flavor 校验抛错，本 phase 只升级抛的 error class 为 typed。
- `shared/src/modes.ts` 在 Phase 5 已经收敛为 `CURSOR_PERMISSION_MODES = ['default','plan','ask','yolo']` + `PermissionMode = CursorPermissionMode`，类型源头清晰。
- `cli/src/cursor/utils/cursorEventConverter.test.ts` 与 `cli/src/runner/buildCliArgs.test.ts` 是 args / event 形状测试的 reference pattern。

### Established Patterns

- 类型 narrow 让 TypeScript 编译器暴露所有调用点 —— 按 narrow 后编译报错驱动收敛清单（Phase 4–5 同款）。
- 切片每片绿色：`bun typecheck` + `bun run test`；最终切片追加 ripgrep + madge guard 测试（Phase 5 D-86）。
- 删除型 / 收敛型 phase：「最小切除 + 一次切干净 + ripgrep zero-tolerance」，无 feature flag、无 shim、无字段 alias（Phase 2/4 一脉）。
- `shared/` 只放 wire / type / 跨端共享语义；cli-runtime 行为留在 cli/（本 phase ModeConfig 入 cli/agent/，不是 shared/）。

### Integration Points

- `runCursor.ts::loop` 是 cursor 入口 —— 任何 mode 类型 / launcher 类型变化都从这里冒到 lifecycle / SSE / hub 层；本 phase 改动严格控制在 `cli/src/cursor/` + `cli/src/agent/modeConfig.ts` + `shared/src/modes.ts` 增量。
- madge guard 是 SC#2 的硬验收锚点 —— 4# 切片必须把 `madge --circular cli/src/cursor` 加入可执行 guard（脚本或测试），否则后续 phase 加文件可能悄悄再生循环。
- Unknown mode 抛错链路：UI/RPC → `runCursor.ts::resolvePermissionMode` → throw `UnknownPermissionModeError` → 走 `lifecycle.markCrash`；不被 launcher 静默吞。Test 用真实 RPC payload + mock launcher 验证。

</code_context>

<specifics>
## Specific Ideas

- madge 当前报 3 个循环（已验证：`cursorLocalLauncher.ts > session.ts > loop.ts`、`session.ts > loop.ts > cursorRemoteLauncher.ts`、`session.ts > loop.ts`），全部由 `loop.ts` 同时兼任「类型定义 + launcher 入口」造成。D-94 抽 modes.ts 后这三条路径同时消失。
- `permissionModeToCursorArgs`（local，6 行）与 `permissionModeToAgentArgs`（remote，5 行）的返回 shape 完全一致 `{mode?: 'plan'|'ask', yolo?: boolean}`，重复率 100%，是 SC#5 ripgrep 命中检测的唯一目标。
- `runCursor.ts::resolvePermissionMode` 已经是「PermissionModeSchema.safeParse + isPermissionModeAllowedForFlavor + throw」三连，符合 D-76 unknown mode 抛错语义；本 phase 改它的 error class 即可，不动结构。
- `UnknownPermissionModeError` 放 shared 而非 cli-local 是为了 hub/web 未来在 SSE patch 校验 mode 字段时能复用同一 error class —— Phase 7 wire contracts 上提时 hub 侧 schema 校验失败可以抛同一 class（researcher 不需要现在做，留 Phase 7）。
- `session.getPermissionMode(): SessionPermissionMode | undefined` 的返回类型 narrow 到 cursor `PermissionMode | undefined` 会触动 `AgentSessionBase` 的 generic 设计（当前 base 用宽 `SessionPermissionMode`）。两条路径：(a) `AgentSessionBase` 加 `<Mode extends SessionPermissionMode = SessionPermissionMode>` generic；(b) `CursorSession` 内 override `getPermissionMode` 返回类型。researcher 选最小 churn 的。

</specifics>

<deferred>
## Deferred Ideas

- **`SessionContext / LocalAdapter / RemoteAdapter / LaunchPolicy` 物理 rename 文件名** —— 当前 D-89 用 JSDoc cross-reference 锚定 SC#1 概念位；若 multi-flavor 复活或重构需要，留给未来 milestone。
- **REFA-03 / REFA-04 wire contracts unification（`Session / Machine / Message / RunnerState` DTO + SSE patch schema 上提）** —— **Phase 7**。`EnhancedMode` 是否上提 shared、hub/web mode 字段 narrow 一并在那里做。
- **REFT-01 cross-flavor permission contract 矩阵（Cursor permission mode × CLI flag 完整覆盖 + 新增 mode 矩阵行）** —— **Phase 11**。本 phase 只补 3 测，不写矩阵。
- **REFH-01 / REFH-02 hub `SessionCache` / `SyncEngine` 拆分** —— **Phase 8**。
- **CURS-01 model 切换：`EnhancedMode` 加 model variant 字段 + ModeConfig 加 model fragment** —— **Milestone 2**。当前 `EnhancedMode.model` 是单字段 string，未来扩 union 时再处理。
- **`localLaunchPolicy.ts` 文件改名为 `launchPolicy.ts`** —— D-89 维持不 rename；如果 Phase 12 milestone verification 时一并扫，留 Phase 12 顺手做。
- **`AGENT_MESSAGE_PAYLOAD_TYPE = 'codex'` wire 字面量改名** —— **Phase 7**（Phase 5 D-81 已锚定）。

</deferred>

---

*Phase: 6-Agent runtime shared kit + mode hardening*
*Context gathered: 2026-05-22*
