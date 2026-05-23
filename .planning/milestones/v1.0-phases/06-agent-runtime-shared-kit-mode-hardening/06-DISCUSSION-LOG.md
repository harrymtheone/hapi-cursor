# Phase 6: Agent runtime shared kit + mode hardening - Discussion Log

**Discussion date:** 2026-05-22
**Phase:** 6 — Agent runtime shared kit + mode hardening
**Mode:** discuss (default)
**Reference:** `06-CONTEXT.md`

## Pre-flight: Scout & Prior-decision Carry-forward

**Project / requirements snapshot:** Cursor-only, Milestone 1 (refactor & 瘦身); 本 phase 映射 REFA-02 + REFA-05。

**Codebase scout findings (`cli/src/cursor/` + `cli/src/agent/`):**

- 5 个准 shared-kit 单元已存在：`AgentSessionBase` / `BaseLocalLauncher` / `RemoteLauncherBase` / `localLaunchPolicy` / `loopBase`；唯一缺位是 ModeConfig。
- `permissionModeToCursorArgs`（cursorLocalLauncher，6 行）与 `permissionModeToAgentArgs`（cursorRemoteLauncher，5 行）—— permission-mode → `{mode, yolo}` 映射 100% 重复。
- `madge --circular cli/src/cursor` 报 3 个循环依赖（已通过 `npx madge` 验证）：`cursorLocalLauncher > session > loop`、`session > loop > cursorRemoteLauncher`、`session > loop`。根因：`loop.ts` 同时定义 mode 类型 + import 两个 launcher。
- `runCursor.ts::resolvePermissionMode` 已经在 RPC 边界 throw（generic `Error('Invalid permission mode')`）；launcher 内部仍 `permissionMode as string` + 静默 `return {}` 兜底。

**Carried forward from prior phases (not re-asked):**

- D-22 / D-32 / D-49：no backward-compat shim、no feature flag。
- D-86：每片绿色（`bun typecheck` + `bun run test`），按编译失败清单驱动收敛。
- D-84 / D-65：ripgrep zero-tolerance + 白名单（默认 `.planning/codebase/` + `CHANGELOG.md`）。
- D-76（Phase 5）：wire/DB 来源未知 → null 兜底；UI/Mode 来源未知 → throw。本 phase 直接落地 mode 侧。
- Phase 5 `<deferred>`：「Mode 类型从 `loop ↔ session ↔ launcher` 循环依赖中独立 + 未知 mode 抛错」明确划归 Phase 6。

## Areas Discussed

Discussion mode：用户选择「直接按推荐方案 lock」，灰区 A–G 全部以 Claude 推荐方案落锁，仅一个 precondition（SC#4 解读）单独确认。

---

### Precondition: SC#4 「bypass + remote / bypass + plan」措辞解读

- **Options presented:**
  - yolo：解读为 yolo + remote / 含 plan 的切换（推荐，把 yolo 当 'bypass-equivalent'）
  - general：覆盖全 mid-session mode 切换矩阵
  - fix_roadmap：本 phase 顺手改 ROADMAP SC#4 措辞再实现
  - other（freeform）
- **User selection:** yolo
- **Decision captured:** D-103（CONTEXT.md `<decisions>` §4）
- **Reason:** Phase 5 narrow 后 Cursor permission set 是 `default|plan|ask|yolo`，没有 `bypass`；ROADMAP 该措辞来自 narrow 之前。yolo 是权限最宽 mode（与 `bypassPermissions` 同语义位），plan 切换是 launcher 在两次 turn 之间改 args 的最常见路径。不改 ROADMAP 文本，用 CONTEXT 锚定解读。

---

### Gray Area A — Shared kit shape

- **Options presented (in question E body):** rename in place / minimal 仅补 ModeConfig / 新建 cli/src/agent/runtime/ 强约束目录
- **User selection:** "按推荐方案"（minimal）
- **Decision captured:** D-89, D-90, D-93
- **Rationale:** rename 触动所有调用点 churn 高、零功能收益；新目录会迫使再搬 4 个既有文件。最小方案 = 既有 4 个单元保持原位 + JSDoc cross-reference 锚定 SC#1 概念位 + 新增唯一缺位 ModeConfig。

### Gray Area B — ModeConfig location & shape

- **Options presented:** capability table（shared/src/flavors.ts 加槽）/ cli-only 模块（cli/src/agent/modeConfig.ts）/ shared/src/cursorArgs.ts
- **User selection:** "按推荐方案"（cli-only）
- **Decision captured:** D-91, D-92
- **Rationale:** ModeConfig 产 CLI args fragment 给 launcher spawn 用，是 cli-runtime 行为；塞 capability 表会把进程 spawn 语义耦合进 wire 层。两个 launcher 共享同一 fragment 映射就够，不合并 `buildAgentArgs` 与 `cursorLocal.ts` 内联 args（local / remote 是两种 process 形态）。

### Gray Area C — 循环依赖打断

- **Options presented:** modes.ts 抽到 cli/src/cursor/ / 抽到 shared/src/ / 反转 import 方向不抽文件
- **User selection:** "按推荐方案"（cli/src/cursor/modes.ts）
- **Decision captured:** D-94, D-95, D-96, D-97
- **Rationale:** `PermissionMode` 类型已在 `@hapi/protocol/types::CursorPermissionMode`，cli 本地 re-export 即可；`EnhancedMode` 携带 cli-runtime 字段（`model` string），不进 shared。新文件硬约束：modes.ts 不 import loop / session / launcher / cursorLocal，是 SC#2 验收锚点。

### Gray Area D — 未知 mode 抛错语义

- **Options presented:** UnknownPermissionModeError typed class（推荐）/ 复用 generic Error + 文案约定；抛点 ModeConfig vs launcher vs RPC 边界
- **User selection:** "按推荐方案"（typed class，抛点 ModeConfig + RPC 边界双层）
- **Decision captured:** D-98, D-99, D-100, D-101, D-102
- **Rationale:** typed class 带 `offendingMode` 字段方便上层 log / display；放 shared/src/modes.ts 让未来 hub/web 在 wire 校验时能复用。`undefined` 不算未知（保留 default fall-through），仅非法字符串抛错。Launcher 不 try/catch 吞抛，走 `lifecycle.markCrash` 走 error 终止。

### Gray Area E — CLI args 构造收敛

- **Options presented (问题 E):** 合一 buildCursorAgentArgs 共享 / 保持差异
- **User selection:** "按推荐方案"（保持差异，仅 dedup permission-mode fragment）
- **Decision captured:** D-92
- **Rationale:** local 与 remote 表达两种 process spawn 形态（长驻交互 vs 单 turn 流式 `-p`），合并会引入大分支。permission-mode 5–6 行 fragment 才是真正的复制项，收敛它就够。

### Gray Area F — 执行切片

- **User selection:** "按推荐方案"（4 切片）
- **Decision captured:** D-107
- **Slicing:**
  1. modes.ts 抽出 + 破循环 → madge=0 + typecheck + test 绿
  2. ModeConfig + UnknownPermissionModeError → typecheck + test 绿（含 modeConfig 单测）
  3. Launcher 收敛 → ripgrep guard（dedup 标识符 + `as string`）+ typecheck + test 绿
  4. 测试 D-104（mid-session yolo / plan / unknown mode）+ guard 测试加入 source guard

### Gray Area G — ripgrep / madge guard 关键词

- **User selection:** "按推荐方案"
- **Decision captured:** D-108, D-109
- **Keywords:**
  - `permissionModeToCursorArgs` — 仅 modeConfig.ts 命中
  - `permissionModeToAgentArgs` — 全仓 0 命中
  - `permissionMode as string` — launcher 文件 0 命中
  - `madge --circular cli/src/cursor` 退出码 = 0（可执行 guard）
- **Whitelist:** `.planning/codebase/` + `CHANGELOG.md`（沿用 Phase 4–5）

---

## Claude's Discretion Items

捕获在 CONTEXT.md `<decisions>` 末「Claude's Discretion」段：

- ModeConfig export 名 / `CursorArgsFragment` 是否 discriminated union（由 planner 决定）
- D-90 JSDoc tag 选择（`@implements` vs `@phase6-role` vs 自由文本）
- D-104 plan 切换测试单侧 vs 双侧（researcher 评估测试基础设施成本）
- `localLaunchPolicy.ts` 是否顺手改名 `launchPolicy.ts`（默认不改）

## Deferred Ideas (Out of Scope)

捕获在 CONTEXT.md `<deferred>` 段：

- 物理 rename 4 个单元为 `SessionContext / LocalAdapter / RemoteAdapter / LaunchPolicy` 文件名 — 留未来
- REFA-03/04 wire contracts unification — Phase 7
- REFT-01 cross-flavor permission contract 矩阵 — Phase 11
- REFH-01/02 hub `SessionCache` / `SyncEngine` 拆分 — Phase 8
- CURS-01 model 切换 ModeConfig 扩 model fragment — Milestone 2
- `localLaunchPolicy.ts` → `launchPolicy.ts` 改名 — Phase 12 milestone verification 顺手
- `AGENT_MESSAGE_PAYLOAD_TYPE = 'codex'` wire 字面量改名 — Phase 7

## Scope Creep Redirections

本次讨论无 scope creep 需重定向 —— 用户选择 fast-track 推荐方案，所有问题严格在 REFA-02 + REFA-05 边界内。

---

*Discussion log generated: 2026-05-22*
