# HAPI Cursor Edition

## What This Is

HAPI Cursor Edition 是一个**本地优先、单用户**的远程控制平台，专为「在手机/平板通过 Tailscale 内网远程驾驭本机 Cursor Agent」这一场景而生。它由 CLI（包裹 Cursor agent，连接 hub）+ Hub（Hono 服务 + Socket.IO + SSE + SQLite）+ Web PWA（手机端主界面）三层组成。本仓库 fork 自上游通用 HAPI 平台，**移除多 agent 支持、外部穿透、多用户隔离、Telegram/语音/ServerChan 等渠道**，聚焦到 Cursor + Tailscale + 个人使用这一条核心链路。

## Core Value

**让 Cursor Agent 在手机端达到与桌面 Cursor IDE 等同的可用性**——能看到、能控制、能在会话中切换模型 / skills / MCP servers，且 session 创建与恢复无缝。如果只能保留一件事，那就是：在床上拿手机也能像在电脑前一样推动一个 Cursor agent 完成任务。

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

### Active

<!-- v1 Milestone 1 范围 — 全部是「重构与瘦身」目标。Milestone 2 才会出现 Cursor 增量特性。 -->

**抽象与契约**

- [ ] **REFACTOR-01**：flavor capability 抽象完整化（`shared/src/flavors.ts`），为 Cursor capability 扩展打地基（模型切换、effort、skills、MCP 之类的能力开关都从这个表读）
- [ ] **REFACTOR-02**：agent runtime 共享套件（抽出 `SessionContext / LocalAdapter / RemoteAdapter / ModeConfig / LaunchPolicy`），消除 `cursorLocalLauncher` / `cursorRemoteLauncher` 之间重复的 permission mode 映射等代码
- [ ] **REFACTOR-03**：shared/ 是唯一 wire contract 源——把 cli / hub / web 中重复定义的 `Session` / `Machine` / `Message` 等 response DTO 与 Zod schema 全部上提到 `shared/src/schemas.ts`，三处不再各自定义
- [ ] **REFACTOR-04**：SSE patch 契约严格化——废除 `useSSE` 的 `hasUnknownSessionPatchKeys()` 启发式整列表 refetch；改为发布严格的 patch schema 或永远全量 `SessionSummary` / `MachineSummary`
- [ ] **REFACTOR-05**：mid-session mode 切换路径加固——未知 mode 抛错（不再静默 fallback），补 bypass + remote、bypass + plan 切换的覆盖测试，把 mode 类型从 `loop ↔ session ↔ launcher` 循环依赖中独立出来

**Hub 内部解耦**

- [ ] **REFACTOR-06**：拆分 `SessionCache`（796 行）为 `sessionRepository / sessionLivenessService / sessionConfigService / sessionMergeService`
- [ ] **REFACTOR-07**：拆分 `SyncEngine`（854 行），打破 `SSE ↔ SyncEngine` 反向依赖（SSE 只依赖 `shared/` 的事件类型）
- [ ] **REFACTOR-08**：Hub 路由模板抽象——加 `parseJsonBody(schema) / withEngine / withSession / withActiveSession / withMachine` helper + 统一 `ApiRouteError`；按职责拆 `hub/src/web/routes/sessions.ts`（lifecycle / config / upload / read-only）
- [ ] **REFACTOR-09**：集中 keepalive 调度器——SSE / SyncEngine / terminalRegistry / notificationHub 的 `setInterval` 统一到一个调度器，保证 `process.exit` 全部清理
- [ ] **REFACTOR-10**：打破 ToolCard 11 文件循环依赖（`_all.tsx ↔ _results.tsx`），加「所有已知 tool 能解析到 renderer」的集成测试

**清理与质量**

- [ ] **REFACTOR-11**：清理 backward-compat 残留（`serverUrl → apiUrl`、`webapp* → publicUrl`、`hapi server` 命令别名、SQLite 运行时迁移）——按项目策略「不做后兼」，drop 全部历史路径
- [ ] **REFACTOR-12**：mutable config singleton 改造——CLI 与 Hub 改为 `loadConfig()` 返回冻结对象，dependency injection 取代 `_setApiUrl()` 等 setter
- [ ] **REFACTOR-13**：拆分超大文件——`web/src/components/SessionList.tsx`（990 行）、`web/src/lib/message-window-store.ts`（1087 行）、`web/src/chat/reducerTimeline.ts`（925 行）、`web/src/routes/settings/index.tsx`（847 行）、`web/src/components/AssistantChat/HappyComposer.tsx`（870 行）
- [ ] **REFACTOR-14**：提取重复工具函数（Levenshtein 距离、base64 大小估算、Cursor permission mode 映射、API query hook 形状）到 `shared/`
- [ ] **REFACTOR-15**：测试缺口补齐——cross-flavor permission contract 矩阵、SSE reconnect / patch-loss 不变量、auth 路由 negative cases（Telegram 已删后只剩 access token 路径）

**功能删除（大规模瘦身）**

- [ ] **CUT-01**：删除非 Cursor agent 完整支持——`cli/src/{claude,codex,gemini,opencode}/`、`cli/src/agent/backends/`、相关 commands、相关 hooks（claude hookForwarder）、相关 GitHub Actions（`codex-pr-review.yml` / `codex-mention-response.yml`）；更新 `shared/src/flavors.ts` 收敛为单 flavor
- [ ] **CUT-02**：删除 Telegram bot 完整链路——`hub/src/telegram/`、`hub/src/web/telegramInitData.ts`、`hub/src/web/routes/bind.ts`、`grammy` 依赖、Telegram 通知 channel、Telegram-only 配置项
- [ ] **CUT-03**：删除语音路由 + ElevenLabs SDK 集成——`hub/src/web/routes/voice.ts`、`web/src/realtime/`、`shared/src/voice.ts`、`@elevenlabs/react` 依赖
- [ ] **CUT-04**：删除 ServerChan 推送渠道——`hub/src/serverchan/`、相关 env 变量
- [ ] **CUT-05**：删除 namespace 多用户隔离——`CLI_API_TOKEN:<namespace>` 后缀语法、user 表 platform 字段、所有 namespace-aware 缓存键
- [ ] **CUT-06**：删除 Cloudflare 风格 tunnel binary + TLS gate——`hub/src/tunnel/`、`hub/tools/tunwg/`、`hub/scripts/download-tunwg.ts`、所有 `HAPI_RELAY_*` env、`web/src/lib/relay-mode` 相关
- [ ] **CUT-07**：删除 `DANGEROUSLY_LOG_TO_SERVER_FOR_AI_AUTO_DEBUGGING` 远程日志流——`cli/src/ui/logger.ts` 中的 HAPI_API_URL 上传通道、`doctor` 中的开关
- [ ] **CUT-08**：删除 `cli/src/codex/happyMcpStdioBridge.ts`（仅 codex 使用的 MCP STDIO bridge）；文档中的 codex 提及全部移除

**Milestone 1 验收**

- [ ] **VERIFY-01**：`bun typecheck` / `bun run test` 全绿；ripgrep 全仓库无 `claude` / `codex` / `gemini` / `opencode` / `telegram` / `serverchan` / `elevenlabs` / `tunwg` / `namespace` 残留（白名单：docs/history、必要的 git 历史引用）
- [ ] **VERIFY-02**：0 循环依赖（用 `madge` 或同类工具验证 `cli/` / `hub/` / `web/`）
- [ ] **VERIFY-03**：手动验证场景——本机起 hub + runner，从 Tailscale 内网手机端「新建 Cursor session → 一轮交互 → 杀掉 hub 重启 → 状态恢复 → 继续交互」全流程通过

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
*Last updated: 2026-05-20 after initialization*
