# HAPI Cursor Edition

## What This Is

HAPI Cursor Edition 是一个**本地优先、单用户**的远程控制平台，专为「在手机/平板通过 Tailscale 内网远程驾驭本机 Cursor Agent」这一场景而生。它由 CLI（包裹 Cursor agent，连接 hub）+ Hub（Hono 服务 + Socket.IO + SSE + SQLite）+ Web PWA（手机端主界面）三层组成。本仓库 fork 自上游通用 HAPI 平台，**移除多 agent 支持、外部穿透、多用户隔离、Telegram/语音/ServerChan 等渠道**，聚焦到 Cursor + Tailscale + 个人使用这一条核心链路。

## Core Value

**让 Cursor Agent 在手机端达到与桌面 Cursor IDE 等同的可用性**——能看到、能控制、能在会话中切换模型 / skills / MCP servers，且 session 创建与恢复无缝。如果只能保留一件事，那就是：在床上拿手机也能像在电脑前一样推动一个 Cursor agent 完成任务。

## Current State

**Shipped:** v1.0 — Refactor & Slim-Down (2026-05-23, tag `v1.0`)

12 phases / 60 plans / 33 v1 requirements / 318 commits / ≈ −12k LOC net delivered: 4 non-Cursor agent runtimes deleted, Telegram + voice + ServerChan + tunwg + namespace surfaces removed, hub + web internals decomposed to 0 circular deps, frozen-config + DI replacing mutable singletons, REFT test gaps closed, push-gated CI (`.github/workflows/verify.yml`) durable. Manual Tailscale + phone E2E PASS on commit `e492044`. See `MILESTONES.md` for full archive.

## Next Milestone Goals

**v1.1 — Cursor mobile incremental features** (start via `/gsd-new-milestone`):

- Cursor 会话内模型切换（CURS-01）
- Skills 集成 + 会话级开关（CURS-02）
- MCP servers 列表 + 会话级 toggle（CURS-03）
- session 列表显示 Cursor agent 状态 / effort / 模型名（CURS-04）
- cursor-ide-browser MCP 截图在移动端展示（CURS-05）

Plus carry-forward backlog M2-BL-01..10 (`.planning/milestones/v1.0-phases/12-docs-cleanup-milestone-verification/12-04-SUMMARY.md`).

## Requirements

### Validated

<!-- 已验证 = 来自当前代码库的真实能力（codebase map 推导） -->

- ✓ Cursor agent 本地包裹：spawn 子进程、管理生命周期、捕获输出 — existing (`cli/src/cursor/`)
- ✓ Cursor agent remote launcher（runner 模式启动） — existing (`cli/src/cursor/cursorRemoteLauncher.ts`)
- ✓ Cursor 权限模式支持 `default / plan / ask / yolo` — existing (`shared/src/modes.ts`)
- ✓ Runner daemon：常驻后台进程，接收远程「新建 session」请求并 spawn agent；管理 git worktree — existing (`cli/src/runner/`)
- ✓ CLI ↔ Hub Socket.IO 实时同步（sessions / messages / machines） — existing (`hub/src/socket/`, `cli/src/api/`)
- ✓ Hub ↔ Web SSE 推送（session / message / machine 变化） — existing (`hub/src/sse/sseManager.ts`)
- ✓ Web ↔ Hub 终端流（Socket.IO websocket） — existing (`hub/src/socket/terminalRegistry.ts`, `web/src/hooks/useTerminalSocket.ts`)
- ✓ SQLite 持久化（sessions / messages / machines / users / push_subscriptions） — existing (`hub/src/store/`)
- ✓ Web PWA（React 19 + Vite + TanStack Router/Query + Tailwind + assistant-ui） — existing (`web/`)
- ✓ Web Push (VAPID) 通知 — existing (`hub/src/push/`)
- ✓ 单 token（`CLI_API_TOKEN`）+ JWT (HS256) 鉴权 — existing (`hub/src/web/middleware/auth.ts`)
- ✓ Git status / diff 路由（基于 RPC shell out 到 `git`） — existing (`hub/src/web/routes/git.ts`)
- ✓ RPC gateway（hub 反向调 CLI） — existing (`hub/src/sync/rpcGateway.ts`)
- ✓ CUT-06：内置 tunnel binary / relay-web / `HAPI_RELAY_*` 删除完成；保留 `HAPI_PUBLIC_URL` 作为 Tailscale / user-managed network 输出路径 — validated in Phase 04
- ✓ CUT-07：远程日志上报通道删除完成；CLI logger 保持 local-only，doctor 不再展示危险开关 — validated in Phase 04
- ✓ REFACTOR-10：ToolCard 循环依赖打破 + `web/src/` 0 循环依赖，集成测试覆盖 unknown tool fallback — validated in Phase 09 (REFW-01)
- ✓ REFACTOR-13：超大 web 文件拆分完成（`message-window-store` 1088→28 facade、`SessionList` 953→229、`settings/index` 758→47、`HappyComposer` 669→178、`_results` 687→175 dispatcher） — validated in Phase 09 (REFW-02)
- ✓ REFACTOR-14：web 工具函数去重（`estimateBase64Bytes` 上提到 `shared/`、`levenshteinDistance` 单源、`createApiQuery` factory ≥ 3 用户） — validated in Phase 09 (REFW-03)
- ✓ REFACTOR-11：backward-compat 残留清理（`serverUrl → apiUrl` / `webapp* → publicUrl` / `hapi server` 命令别名 / SQLite 运行时迁移全部删除；schema 版本不匹配 ⇒ 拒绝启动 + 提示离线迁移） — validated in Phase 10 (REFC-01)
- ✓ REFACTOR-12：mutable config singleton 改造（CLI 与 Hub 改为 `loadConfig()` 返回深度冻结 `Config`；singleton + `_set*` setter 全部删除；DI 贯穿 30+ CLI 调用点 + 7 个 Hub 消费者） — validated in Phase 10 (REFC-02)
- ✓ REFACTOR-15：测试缺口补齐——Cursor permission contract 矩阵（type-exhaustive + 运行时 cross-check + 每行 deep-equal）、SSE reconnect/patch-loss 收敛测试（bounded backoff + TanStack cache convergence，无 MAX_RETRIES）、auth 路由 + middleware negative cases 16 个（bad token / 过期 / replayed / empty body / no-uid payload，`assertNoSecretLeak` 保证 4xx body + console 不泄露 secrets） — validated in Phase 11 (REFT-01, REFT-02, REFT-03)

- ✓ REFACTOR-01：flavor capability 抽象完整化 — validated in Phase 05 (REFA-01)
- ✓ REFACTOR-02：agent runtime 共享套件落地（`SessionContext / LocalAdapter / RemoteAdapter / ModeConfig / LaunchPolicy`） — validated in Phase 06 (REFA-02)
- ✓ REFACTOR-03：`shared/` 是唯一 wire contract 源（`Session` / `Machine` / `Message` / `RunnerState` 在 cli/hub/web 三处的镜像全部删除） — validated in Phase 07 (REFA-03)
- ✓ REFACTOR-04：SSE patch 契约严格化（`hasUnknownSessionPatchKeys()` 删除，严格 `SessionPatchSchema` / `MachinePatchSchema` 在 `shared/` 定义） — validated in Phase 07 (REFA-04)
- ✓ REFACTOR-05：mid-session mode 切换路径加固（未知 mode 抛 `UnknownPermissionModeError`，bypass+remote / bypass+plan 切换覆盖） — validated in Phase 06 (REFA-05)
- ✓ REFACTOR-06：`SessionCache` 4-way split — validated in Phase 08 (REFH-01)
- ✓ REFACTOR-07：`SyncEngine` 拆分 + SSE 反向依赖打破 — validated in Phase 08 (REFH-02)
- ✓ REFACTOR-08：Hub 路由模板抽象 + `ApiRouteError` + `sessions.ts` 按职责拆分 — validated in Phase 08 (REFH-03)
- ✓ REFACTOR-09：集中 keepalive 调度器 + SIGINT 测试 — validated in Phase 08 (REFH-04)
- ✓ CUT-01..04：Claude / Codex / Gemini+ACP / OpenCode 整目录 + GitHub Actions + 依赖 — validated in Phase 01
- ✓ CUT-05：`shared/src/flavors.ts` 收敛为 `cursor` 单 flavor — validated in Phase 05
- ✓ CUT-06：Telegram bot 完整链路 + `grammy` 依赖 — validated in Phase 02
- ✓ CUT-07：语音路由 + ElevenLabs SDK 集成 + `@elevenlabs/react` 依赖 — validated in Phase 02
- ✓ CUT-08：ServerChan 推送渠道 — validated in Phase 02
- ✓ CUT-09：namespace 多用户隔离（token 后缀语法 + JWT `ns` 字段 + `users.platform` 列） — validated in Phase 03
- ✓ CUT-10：tunnel binary + TLS gate + `HAPI_RELAY_*` env 变量 — validated in Phase 04
- ✓ CUT-11：`DANGEROUSLY_LOG_TO_SERVER_FOR_AI_AUTO_DEBUGGING` 远程日志流 — validated in Phase 04
- ✓ CUT-12：所有 README + AGENTS.md 重写为 Cursor-only；`website/` + `docs/` 删除 — validated in Phase 12
- ✓ VRFY-01：`bun typecheck` + `bun run test` 全绿；push-gated `.github/workflows/verify.yml` — validated in Phase 12
- ✓ VRFY-02：0 循环依赖（`madge:check` 跨 `cli/` + `hub/` + `web/`） — validated in Phase 12
- ✓ VRFY-03：全仓库 ripgrep 残留检查（`scripts/check-no-cut-agents.sh`） — validated in Phase 12
- ✓ VRFY-04：Cursor + Tailscale 手机端 E2E 场景 PASS（commit `e492044`） — validated in Phase 12

### Active

<!-- v1.0 milestone shipped 2026-05-23. v1.1 (Milestone 2 — Cursor mobile features) scope to be defined via /gsd-new-milestone. Candidate items: -->

- [ ] **CURS-01**：Cursor 会话内模型切换（sonnet / opus / composer / auto），模型列表通过本机 Cursor CLI 动态获取
- [ ] **CURS-02**：Skills 集成（默认跟随 Cursor IDE 自动生效；会话级开关单个 skill）
- [ ] **CURS-03**：MCP servers 列表 + 会话级 toggle
- [ ] **CURS-04**：Cursor agent 状态 / effort / 模型名在 session 列表可见
- [ ] **CURS-05**：cursor-ide-browser MCP 截图在移动端可视

**Milestone 1 → Milestone 2 carry-forward backlog (M2-BL-01..10):** 见 `.planning/milestones/v1.0-phases/12-docs-cleanup-milestone-verification/12-04-SUMMARY.md`

### Out of Scope

<!-- 明确不做。包含原因，防止以后回流。 -->

**Milestone 1 不做（留给 Milestone 2 及以后）：**

- Cursor 会话内模型切换 — 留给 Milestone 2，依赖 REFACTOR-01 的 capability 抽象先落地
- Skills 集成（默认跟随 IDE / 会话级覆盖） — 留给 Milestone 2
- MCP servers 列表 + 会话级 toggle — 留给 Milestone 2
- Cursor agent 状态 / effort / 模型名在 session 列表可见 — 留给 Milestone 2
- cursor-ide-browser MCP 截图在移动端展示 — 留给 Milestone 2
- 移动端查看 file diff / 批准修改 — 暂未规划（先把上面五项做好再说）
- 移动端创建 / 编辑 skill 文件 — 暂未规划

**永久不做：**

- 其他 AI agent 支持（Claude Code / Codex / Gemini / OpenCode） — 已在 CUT-01 删除；Cursor-only 是项目定位
- ACP（Agent Communication Protocol）多 agent 协议抽象 — 与 Cursor-only 定位冲突
- Cursor IDE 反向扩展插件 — 项目方向是「手机控本机 Cursor」，不是「IDE 内嵌 HAPI」
- 付费 / SaaS 化 / 多租户 — 单人个人使用
- 营销官网 / 推广 — 个人项目
- 多用户 / namespace 隔离 — 已在 CUT-05 删除；单人不需要
- Cloudflare 风格自带穿透 — 已在 CUT-06 删除；用 Tailscale
- Telegram Bot / Mini App — 已在 CUT-02 删除；用 Web PWA 即可
- 语音输入 / ElevenLabs 对话 — 已在 CUT-03 删除；移动端系统语音转录够用
- ServerChan / 微信公众号推送 — 已在 CUT-04 删除；用 Web Push
- 远程日志上报到上游作者 — 已在 CUT-07 删除；个人调试不需要
- Multi-instance hub 扩展（Postgres / Redis pub/sub） — 单机单实例
- Token rotation API / per-namespace revocation / hub rate limiting — Tailscale 内网，单 token 完全够用
- `better-sqlite3` → `bun:sqlite` 主动迁移 — 没坏不修
- 向上游 HAPI 仓库回 PR / 保持兼容 — 这是个 fork，不保持兼容

## Context

**仓库来源：** Fork 自上游 HAPI（通用 AI Coding Agent 远程平台，支持 5 种 agent）。本仓库 `hapi-cursor` 收敛到 Cursor 单 agent。

**代码库当前状态（v1.0 shipped 2026-05-23）：**

- Cursor-only：`AgentFlavor = 'cursor'`，capability 表通过 `FLAVOR_CAPS` 单行驱动
- 0 循环依赖（`bun run madge:check` 跨 cli/hub/web；push + PR gated by `.github/workflows/verify.yml`）
- `shared/` 是唯一 wire contract 源：`Session / Machine / Message / RunnerState` + 严格 `SessionPatchSchema / MachinePatchSchema`
- Hub: `SessionCache` + `SyncEngine` 已拆分；`KeepaliveScheduler` 中心化；`ApiRouteError` 统一错误形状
- Web: ToolCard 11-file 循环已破；超大文件全部 ≤ ~500 行（除 `reducerTimeline.ts` 925 行延后）
- Config: CLI + Hub 均为 `loadConfig()` → frozen `Config`；DI 取代 mutable singleton；SQLite schema 不匹配 ⇒ 拒绝启动 + 提示离线迁移
- Tests: Cursor permission matrix + SSE reconnect 收敛 + auth negative cases 全覆盖
- 删除：`cli/src/{claude,codex,gemini,opencode}/`、`hub/src/{telegram,serverchan,tunnel}/`、`hub/tools/tunwg/`、voice/bind routes、`website/`、`docs/`、`@anthropic-ai/*` + `grammy` + `@elevenlabs/react` 依赖
- 已知 carry-forward 技术债：`reducerTimeline.ts` (925 行) 拆分延后；Cursor permission-mode helper 未提升到 `shared/`；lint 未在 CI 强制（`bun run lint` 存在但未接入 `verify.yml`）

<details>
<summary>v1.0 shipping 之前的 codebase 快照（2026-05-20 扫描 — 已不准确，仅供历史参考）</summary>
**代码库当前状态（来自 `.planning/codebase/` 7 份文档，2026-05-20 扫描）：**

- 三层架构：CLI（agent 包裹 + runner daemon）+ Hub（Bun + Hono + Socket.IO + SSE + SQLite）+ Web（React 19 PWA）
- Bun workspaces：`cli / hub / web / shared / docs / website`
- TypeScript strict 全仓库；Zod schemas 在 `shared/src/schemas.ts`
- 测试框架：Vitest（`bun run test`）
- 已知技术债（详见 `.planning/codebase/CONCERNS.md`）：
  - 四套 agent runtime 高度重复（claude / codex / cursor / opencode），3 个循环依赖组
  - `cli/src/codex/codexRemoteLauncher.ts` 单文件 3139 行
  - `SessionCache`（796 行）+ `SyncEngine`（854 行）职责过载
  - Web SSE 用启发式 `hasUnknownSessionPatchKeys()` 决定是否整列表 refetch
  - Cross-package DTO 重复（`Machine` / `Session` / `RunnerState` 在 cli / hub / web 各定义一份）
  - Cursor flavor capability set 为空（`shared/src/flavors.ts:16` — `cursor: new Set([])`），任何 Cursor 能力扩展都要先解锁
  - mid-session mode 切换：未知 mode 静默 fallback；bypass + remote、bypass + plan 路径无覆盖测试
  - ToolCard 11 文件循环依赖（`_all.tsx ↔ _results.tsx`）
  - 一批超大文件（SessionList 990 行、message-window-store 1087 行、reducerTimeline 925 行 等）
  - Backward-compat 残留：`serverUrl → apiUrl`、SQLite 运行时迁移、`hapi server` 命令别名
- 已有完整测试：`messageService.test.ts`（1132 行）、`sessionModel.test.ts`（1392 行）、各 agent loop 测试、runner.integration.test.ts
- 测试缺口：cross-agent permission contract 矩阵、SSE reconnect 不变量、auth 路由 negative cases、runner uninstall / corruption（已有 TODO）

</details>

**用户画像：** 单人（作者本人）；通过 Tailscale 把本机 hub 暴露给同账号下的手机/平板；本机长期开机运行 hub + runner daemon。

**为什么 fork 而不是给上游加特性：** 上游目标是通用多 agent 平台；本项目目标是 Cursor 专用 + 个人体验最大化。两者方向不同。fork 后可以放开手脚删功能、收紧 API 表面、为 Cursor 单 flavor 重新设计抽象。

## Constraints

- **Tech stack**：Bun runtime + TypeScript strict + Bun workspaces — 已落地，不动
- **Tech stack**：React 19 + Vite + TanStack Router/Query + Tailwind + assistant-ui — 已落地，不动
- **Tech stack**：`better-sqlite3` 持久化 — 已落地，不主动换
- **Tech stack**：Hono + Socket.IO + SSE 服务端 — 已落地，不动
- **Deployment**：本机 + Tailscale 内网；hub 不暴露公网；不依赖任何外部相对方（无 Cloudflare / ngrok / ServerChan / Telegram / ElevenLabs / HAPI relay）
- **Compatibility**：**不保持向后兼容**——项目策略已经如此（见 AGENTS.md），且本 fork 强化这条原则。SQLite schema 迁移改为「版本不匹配 ⇒ 拒绝启动并提示离线迁移工具」，不再保留运行时迁移路径
- **Dependencies**：尽量减少外部依赖——`grammy`、`@elevenlabs/react`、`tunwg` 等会随 CUT-* 一起移除
- **Security**：Tailscale 内网信任模型——单 `CLI_API_TOKEN` 足够；不引入 token rotation、namespace 隔离、rate limiting 等多用户必需特性
- **Performance**：单人使用，无并发压力——不为多用户场景做缓存/分片优化
- **Code quality**：典型「不计较 token / 时间成本，只要清晰正确」——Milestone 1 完成时要求 0 循环依赖、typecheck/test/lint 全绿、超大文件拆分到位
- **Process**：通过 GSD 工作流推进；当前 milestone 1 = 重构 + 瘦身；后续 milestone 2 = Cursor 增量编码

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Fork 而非给上游加特性 | 上游通用多 agent，本项目 Cursor 专用 + 个人体验，方向不同 | — Pending |
| Milestone 1 全力重构 + 瘦身，再开 Milestone 2 增量编码 | 用户明确表态「不计较 token / 时间成本，只要清晰正确」；先把抽象和契约打扎实，Milestone 2 加特性时单文件改动量小、风险低 | — Pending |
| 修复 codebase map 的「第一档 + 第二档」技术债，确认「第三档」不影响使用 | 第一档（capability / runtime / schema / SSE / mode 切换）直接挡 Cursor 增量；第二档（hub 解耦 / 路由模板 / 超大文件 / 测试缺口）影响代码清晰度；第三档（多用户 / rate limiting / 内置穿透 / sqlite 迁移）单人 Tailscale 用不到 | — Pending |
| 大规模删功能：claude / codex / gemini / opencode / telegram / voice / serverchan / tunnel / namespace / 远程日志流 / codex GitHub Actions | 单人 + Tailscale + Cursor only 场景下都是死代码；删了后维护面 1/N，重构风险也小 | — Pending |
| 保留 runner daemon（不删） | 移动端「新建 session」核心能力；不保留就只能控制 IDE 里已开的会话 | — Pending |
| 保留 Web Push (VAPID)、SSE、Socket.IO 终端流 | PWA 推送是移动端体验关键；SSE / 终端流是核心实时通道 | — Pending |
| 保留 Tailscale 作为唯一远程访问方式 | 用户已经在用；E2E 加密、零配置、无第三方依赖 | — Pending |
| SSE patch 契约严格化（不再用启发式） | 移动端 Cursor 状态 / effort / 模型名字段会大量新增；启发式会触发整列表 refetch 拖慢手机端 | — Pending |
| flavor capability 抽象先于 Cursor 能力交付 | `shared/src/flavors.ts` 现在 `cursor: new Set([])`；不抽象就要在每个能力 PR 里改 cli / hub / web 三处 | — Pending |
| **M1-CLOSE (2026-05-23): Milestone 1 (Refactor & Slim-Down) signed off** | 12 phases / 60 plans delivered the Cursor-only codebase, removed 4 non-Cursor agent runtimes + Telegram/voice/ServerChan/tunnel/namespace surface, decomposed hub + web internals to 0 circular dependencies, capped wire contracts in `shared/`, frozen config + DI replacing setters, REFT test gaps closed, push-gated CI workflow (`.github/workflows/verify.yml`) + repo-wide ripgrep guard durable. Manual Tailscale + phone end-to-end scenario PASS on commit `e492044`. | Closed — see `.planning/milestones/v1.0-phases/12-docs-cleanup-milestone-verification/12-VERIFICATION.md` |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-05-23 after v1.0 milestone (Refactor & Slim-Down) shipped*
