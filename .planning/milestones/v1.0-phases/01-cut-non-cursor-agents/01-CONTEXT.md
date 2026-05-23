# Phase 1: Cut non-Cursor agents - Context

**Gathered:** 2026-05-20
**Status:** Ready for planning

> **ROADMAP cross-reference:** Phase 1 SC#2 ripgrep whitelist was clarified on 2026-05-20 to include `shared/src/flavors.ts` (Phase-5-owned territory). See `.planning/ROADMAP.md` §"Phase 1: Cut non-Cursor agents" → success criterion 2 for the authoritative wording. CONTEXT.md decisions D-11/D-12 are consistent with the updated SC.

<domain>
## Phase Boundary

物理删除 Claude / Codex / Gemini(+ACP) / OpenCode 四个 agent runtime —— 包含 `cli/src/{claude,codex,gemini,opencode}/` 整目录、`cli/src/agent/backends/`、相关 `cli/src/commands/*.ts`、`hookForwarder`、`happyMcpStdioBridge`、`codex-pr-review.yml` / `codex-mention-response.yml` GitHub Actions、`@anthropic-ai/*` 等非 Cursor SDK 依赖。

删除后 `bun typecheck` + `bun run test` + ripgrep（按本 phase 白名单）+ `bun.lock` 重新生成全绿。`AgentFlavor` union 类型本身的收敛由 Phase 5 接手（CUT-05 + REFA-01）；共享 runtime 套件抽象由 Phase 6 接手（REFA-02）。

**In scope（Phase 1 必须完成）：** 4 个 CUT requirement（CUT-01 ~ CUT-04）
**Out of scope：** flavor union 类型收敛（Phase 5）、agent runtime 共享套件重构（Phase 6）、外部集成 channel 删除（Phase 2 起）

</domain>

<decisions>
## Implementation Decisions

### 1. 删除边界 vs. 后续 Phase 分工 — 「最小切除」

- **D-01：删四个目录 + 相关 commands + workflow + 非 Cursor SDK 依赖**为主线，不主动重构 `cli/src/agent/` 共享抽象（那是 Phase 6 的工作）
- **D-02：`AgentFlavor` union 字面量保留在 `shared/src/flavors.ts`**（连同其他声明 union 的 `shared/src/{modes,models,schemas,types,messages,resume,socket}.ts` 中残留的 flavor 字面量）；Phase 5 (CUT-05) 收敛 union 类型
- **D-03：所有 *消费* flavor union 的业务代码（`cli/src/agent/*`、`cli/src/api/*`、`hub/src/sync/*`、`web/src/chat/*` 等）按 Cursor 单分支重写**——删除 `if (flavor === 'claude' | 'codex' | 'gemini' | 'opencode')` 分支、删除非 Cursor 的 imports/handlers/registry 项；保留 cursor 分支与 default/throw 兜底
- **D-04：编译/测试通过门槛硬约束。** 如果"最小切除"导致 typecheck 失败且无法仅靠业务代码重写解决（例如某共享抽象强依赖于多 flavor 存在），允许提前完成该处的局部收敛 —— 但必须在 PLAN 中显式标注「borrowed from Phase 5/6」并附 issue 说明，避免悄悄偷跑 ROADMAP

### 2. 测试文件处理策略 — 「纯删 + 必要时改 Cursor-only」

- **D-05：被删源目录下的 `*.test.ts` 一并删除**（`claudeLocal.test.ts`、`codexLocalLauncher.test.ts`、`runGemini.test.ts`、`runOpencode.test.ts` 等所有 flavor-specific 测试）
- **D-06：跨 flavor 的共享测试**（如 `cli/src/agent/sessionFactory.test.ts`、`cli/src/agent/runners/runAgentSession.test.ts`、`cli/src/api/apiMachine.test.ts`、`shared/src/{flavors,modes,models,resume}.test.ts`、`web/src/chat/*.test.ts` 中 flavor 矩阵化 case）按"剥离非 Cursor 用例"改造，**不**为已删 flavor 保留 mocked fixture
- **D-07：不引入新测试。** Phase 1 是删除型 phase，测试缺口填充由 Phase 11 (REFT-01 ~ 03) 接手；本 phase 仅维持现有 Cursor 测试可运行
- **D-08：跨 flavor 测试如有「通用断言价值」（例如 `permissionAdapter.test.ts` / `messageConverter.test.ts` 中与 flavor 无关的通用契约），保留 Cursor 单分支版本**，不主动迁移到新位置（迁移留给 Phase 6/11）

### 3. 默认子命令解析 — 「行为不变，fallback 变 Cursor」

- **D-09：`cli/src/commands/registry.ts` 中的默认子命令解析逻辑结构不变**——保留现有 default routing 路径（不切到打印 help、不改入口语义）；仅把 fallback target 从原 multi-flavor 选择改为直接 cursor
- **D-10：`hapi` 无参数行为 = 现有「fallback → cursor」**；其他子命令（`hapi cursor`、`hapi runner`、`hapi auth`、`hapi doctor`、`hapi hub`、`hapi mcp`、`hapi notify`、`hapi connect`、`hapi resume`）按现有结构保留

### 4. ripgrep 白名单与零容忍范围 — 「字面零容忍 + flavors.ts 例外」

- **D-11：业务代码（identifier / import / 字符串字面量 / 注释）层面对 `claude` / `codex` / `gemini` / `opencode` 严格零容忍**——ripgrep 命中即 fail
- **D-12：白名单 = `.planning/codebase/`、`CHANGELOG.md`、`shared/src/flavors.ts`**（最后一项为 Phase 5 领地的 union 字面量例外）。如 research 阶段发现 `shared/src/modes.ts` / `shared/src/models.ts` 等也含 union 字面量字段需要保留到 Phase 5，可在 PLAN 中追加这些文件到白名单——但必须 *显式追加并记入 PLAN*，不允许 silent skip
- **D-13：CI 加 ripgrep 守卫脚本**（在 `bun run test` 或单独 step 中）拒绝白名单外的命中——避免回归

### 5. 删除提交粒度 — 「按 requirement 拆分」

- **D-14：按 4 个 CUT requirement 各一个 commit + 1 个清理 commit**，共约 5 个 commits：
  1. `feat(phase-01): CUT-01 remove Claude Code agent`（删除 `cli/src/claude/`、`cli/src/commands/{claude,hookForwarder}.ts`、`@anthropic-ai/*` 依赖、相关测试、Cursor 路径中对 Claude 的消费）
  2. `feat(phase-01): CUT-02 remove Codex agent`（删除 `cli/src/codex/`、`cli/src/commands/codex.ts`、`happyMcpStdioBridge`、`codex-pr-review.yml`、`codex-mention-response.yml`、相关测试、Cursor 路径中对 Codex 的消费）
  3. `feat(phase-01): CUT-03 remove Gemini agent + ACP backend`（删除 `cli/src/gemini/`、`cli/src/agent/backends/`、`cli/src/commands/gemini.ts`、ACP 协议相关、相关测试）
  4. `feat(phase-01): CUT-04 remove OpenCode agent`（删除 `cli/src/opencode/`、`cli/src/commands/opencode.ts`、含 912 行 storage scanner、相关测试）
  5. `chore(phase-01): final cleanup + ripgrep guard`（默认子命令 fallback、`bun.lock` 重生成、`shared/` 中扫尾业务代码、CI ripgrep 守卫）
- **D-15：每个 commit 单独通过 `bun typecheck` + `bun run test`**——任何一个 commit 不绿就回炉

### Claude's Discretion

- 每个 CUT commit 内部的文件删除顺序（按依赖图自底向上即可）
- ripgrep 守卫脚本的具体实现形式（独立 shell script vs. embed 进 `bun run test` vs. 加到 GitHub Actions）—— 选简单可读的
- `cli/src/agent/` 中具体哪些文件需要内部清理 vs. 等 Phase 6 —— 以 `bun typecheck` 是否通过为唯一硬约束
- 是否在 `cli/src/commands/registry.ts` 中加 deprecation warning 提示用户从 `hapi claude` 等已删命令迁移（默认不加——「No backward compatibility」是项目原则）

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 项目宪法

- `.planning/PROJECT.md` — 项目愿景与单人 Tailscale 单 agent 定位
- `.planning/REQUIREMENTS.md` — Milestone 1 全部 33 条 requirement，本 phase 映射到 CUT-01 ~ CUT-04
- `.planning/ROADMAP.md` §「Phase 1: Cut non-Cursor agents」与 §「Phase 5 / 6」(理解 phase 边界与后续接手范围)
- `AGENTS.md` — 工作风格、Bun workspaces 约定、"No backward compatibility"、"Prioritize Pragmatism"

### Codebase 地图（scout 阶段用过）

- `.planning/codebase/STRUCTURE.md` — 包/目录结构总览
- `.planning/codebase/ARCHITECTURE.md` — CLI ↔ Hub ↔ Web 三段架构
- `.planning/codebase/CONCERNS.md` — 已知技术债清单（含本 milestone 要修的项）
- `.planning/codebase/INTEGRATIONS.md` — 外部集成清单（Phase 2 用得更多）
- `.planning/codebase/TESTING.md` — Vitest 测试约定与现有覆盖

### 本 phase 直接相关源码（删除目标 + 影响面）

- `cli/src/{claude,codex,gemini,opencode}/` — 四个被删 runtime 整目录
- `cli/src/agent/backends/` — ACP 后端目录（Gemini 用）
- `cli/src/commands/{claude,codex,gemini,opencode,hookForwarder}.ts` + `cli/src/codex/happyMcpStdioBridge.ts` — 被删 command/桥接
- `cli/src/commands/registry.ts` — 默认子命令解析（按 D-09/D-10 修改）
- `.github/workflows/{codex-pr-review,codex-mention-response}.yml` — 删除目标
- `cli/src/agent/`（除 `backends/`）— 共享 runtime 抽象，按 D-03 重写消费侧
- `shared/src/{flavors,modes,models,schemas,types,messages,resume,socket}.ts` — 含 flavor union 类型；按 D-02 保留 union 字面量、按 D-03 清理业务消费
- `hub/src/sync/{sessionCache,syncEngine,sessionModel,todos,teams,rpcGateway,aliveEvents}.ts` — 含 flavor 分支的 hub 路径
- `web/src/chat/`、`web/src/lib/`、`web/src/components/` — web 端 flavor 消费面
- `package.json`（root + 各 workspace）+ `bun.lock` — 依赖清理（`@anthropic-ai/*` 等）

### 验收脚本范围（Phase 1 SC 编号对应）

- SC#1：`bun typecheck` + `bun run test`
- SC#2：ripgrep 白名单（按 D-12）
- SC#3：`cli/src/commands/registry.ts` 检查
- SC#4：GitHub workflow 删除验证 + `cli/src/codex/happyMcpStdioBridge.ts` / Claude `hookForwarder` 删除验证
- SC#5：`package.json` SDK 依赖清理 + `bun.lock` 重生成

</canonical_refs>

<code_context>
## Existing Code Insights

### 必须保留 / 维持可工作

- `cli/src/cursor/` —— Cursor agent 实现整目录（local + remote launcher + runCursor）。本 phase 不动其内部逻辑，但需要 D-03 重写其消费的共享抽象时确保 Cursor 路径仍可通
- `cli/src/commands/cursor.ts` — 默认 fallback target（D-09/D-10）
- `cli/src/runner/` + `cli/src/api/` — 与 Cursor 路径解耦的运行时
- `cli/src/agent/AgentRegistry.ts`、`sessionFactory.ts`、`runners/runAgentSession.ts`、`loopBase.ts`、`sessionBase.ts`、`messageConverter.ts`、`permissionAdapter.ts`、`rateLimitParser.ts`、`localHandoff.ts`、`localLaunchPolicy.ts`、`runnerLifecycle.ts`、`internalEventFilter.ts`、`utils.ts` —— 共享抽象，需要按 D-03 收敛业务分支但**保留模块结构**（重构等 Phase 6）

### 重要的散落消费点（grep 已确认存在的高匹配数文件）

- `shared/src/modes.ts`（38 条命中）—— 多 flavor permission mode 表
- `shared/src/models.ts`（31 条命中）—— 多 flavor 模型清单
- `cli/src/codex/codexRemoteLauncher.ts`（110 条命中）—— 整文件删
- `cli/src/opencode/runOpencode.ts` 等 —— 整文件删
- `hub/src/sync/sessionModel.test.ts`（97 条命中）—— 跨 flavor 测试 fixture，按 D-06 剥离

### 已建立的约定

- Vitest（`*.test.ts` 与源文件同目录）— 删源就删测试
- `@/*` path alias 映射 `./src/*`（按 package）
- 4 空格缩进、Zod schemas 集中在 `shared/src/schemas.ts`
- Bun workspaces — `bun.lock` 在 root；删依赖后 root `bun install` 重生成

### 集成点

- `cli/src/commands/registry.ts` — CLI 子命令注册中心
- `cli/src/agent/AgentRegistry.ts` — runtime registry（按 D-03 收敛到 Cursor 单项）
- `shared/src/socket.ts` — Socket.IO 事件类型（含 flavor 字段；按 D-02 保留 union、按 D-03 清理业务）

</code_context>

<specifics>
## Specific Ideas

- 「最小切除」 = 删除 + 业务消费收敛，**不**借机重构共享抽象（Phase 6 的活留给 Phase 6）
- ripgrep 守卫脚本要让 `bun run test`（或独立 CI step）能跑——避免人脑维护白名单
- 5 commits 的拆分目的是：每个 CUT requirement 独立可回滚 + bisect 友好；如果在执行中发现某 CUT 内部还需要再拆，由 planner 决定
- `shared/src/flavors.ts` 进白名单要在 PLAN 与 CI 守卫脚本中**同时**显式列出，避免未来读代码的人困惑

</specifics>

<deferred>
## Deferred Ideas

- **AgentFlavor union 收敛到 `'cursor'`** —— Phase 5 (CUT-05 + REFA-01) 的核心任务，本 phase 仅保留 union 字面量在 `shared/src/flavors.ts`
- **`cli/src/agent/` 共享 runtime 套件抽象（SessionContext / LocalAdapter / RemoteAdapter / ModeConfig / LaunchPolicy）** —— Phase 6 (REFA-02)
- **未知 permission mode 抛错（而非静默 fallback）+ mid-session mode 切换覆盖测试** —— Phase 6 (REFA-05)
- **新的 Cursor 单 flavor permission contract 测试矩阵** —— Phase 11 (REFT-01)
- **README / AGENTS / docs / website 中对已删 agent 的文案清理** —— Phase 12 (CUT-12)；本 phase 仅清理源码内 JSDoc / 行注释（这些落在 D-11 的零容忍下）
- **`cli/src/commands/registry.ts` 加 deprecation hint 提示从 `hapi claude` 等迁移** —— 项目原则「No backward compatibility」，不做；用户已在本 phase 选择「行为不变 + fallback 变 Cursor」

</deferred>

---

*Phase: 1-cut-non-cursor-agents*
*Context gathered: 2026-05-20*
