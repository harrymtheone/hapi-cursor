# Requirements: HAPI Cursor Edition

**Defined:** 2026-05-20
**Core Value:** 让 Cursor Agent 在手机端达到与桌面 Cursor IDE 等同的可用性

**当前 Milestone：** Milestone 1 — 重构 & 瘦身（删除非 Cursor 功能、修复挡路技术债、为 Milestone 2 增量编码打地基）

## v1 Requirements

Milestone 1 范围。每个 requirement 映射到 ROADMAP.md 的某个 phase。

### 抽象与契约（REFACTOR / ABSTRACT）

- [ ] **REFA-01**: flavor capability 抽象完整化（`shared/src/flavors.ts`）。Cursor capability set 可扩展，所有「能力是否可用」的判定都从这张表读，不在调用点写硬编码 if-else
- [x] **REFA-02**: agent runtime 共享套件落地。抽出 `SessionContext / LocalAdapter / RemoteAdapter / ModeConfig / LaunchPolicy` 公共组件；`cursorLocalLauncher` 与 `cursorRemoteLauncher` 之间不再有重复的 permission mode 映射等逻辑
- [x] **REFA-03**: `shared/` 是唯一 wire contract 源。`Session / Machine / Message / RunnerState` 等 response DTO 与 Zod schema 全部上提到 `shared/src/schemas.ts`；cli / hub / web 三处的私有镜像全部删除
- [x] **REFA-04**: SSE patch 契约严格化。删除 `useSSE` 中的 `hasUnknownSessionPatchKeys()` 启发式整列表 refetch；改为「永远全量 `SessionSummary`/`MachineSummary`」或「严格 patch schema 在 `shared/` 定义」二选一
- [x] **REFA-05**: mid-session mode 切换路径加固。未知 mode 抛错（不再静默 fallback）；bypass + remote、bypass + plan 切换覆盖测试到位；mode 类型从 `loop ↔ session ↔ launcher` 循环依赖中独立

### Hub 内部解耦（REFACTOR / HUB）

- [x] **REFH-01**: `SessionCache`（796 行）拆分为 `sessionRepository / sessionLivenessService / sessionConfigService / sessionMergeService`
- [ ] **REFH-02**: `SyncEngine`（854 行）拆分；SSE 不再反向依赖 SyncEngine 具体类型，只依赖 `shared/` 的事件类型
- [ ] **REFH-03**: Hub 路由模板抽象。加 `parseJsonBody(schema) / withEngine / withSession / withActiveSession / withMachine` helper + 统一 `ApiRouteError`；按职责拆 `hub/src/web/routes/sessions.ts`（lifecycle / config / upload / read-only）
- [ ] **REFH-04**: 集中 keepalive 调度器。SSE / SyncEngine / terminalRegistry / notificationHub 的 `setInterval` 统一到一个调度器；`process.exit` 时全部 timer 都被清理（含 SIGINT 测试）

### Web 内部解耦（REFACTOR / WEB）

- [ ] **REFW-01**: 打破 ToolCard 11 文件循环依赖（`_all.tsx ↔ _results.tsx`）；加「所有已知 tool 能解析到 renderer」的集成测试
- [ ] **REFW-02**: 拆分超大文件：`SessionList.tsx`（990 行）、`message-window-store.ts`（1087 行）、`reducerTimeline.ts`（925 行）、`routes/settings/index.tsx`（847 行）、`AssistantChat/HappyComposer.tsx`（870 行）
- [ ] **REFW-03**: 提取重复工具函数到 `shared/`（Levenshtein 距离、base64 大小估算、Cursor permission mode 映射、API query hook 形状）

### 清理与配置（REFACTOR / CONFIG）

- [ ] **REFC-01**: 清理 backward-compat 残留。删除 `serverUrl → apiUrl` / `webapp* → publicUrl` 字段别名、`hapi server` 命令别名、所有 SQLite 运行时迁移；SQLite schema 版本不匹配 ⇒ 拒绝启动 + 提示离线迁移工具
- [ ] **REFC-02**: mutable config singleton 改造。CLI 与 Hub 改为 `loadConfig()` 返回冻结对象；移除 `_setApiUrl() / _setCliApiToken() / _setExtraHeaders()` 等 setter；通过 dependency injection 注入

### 测试缺口（REFACTOR / TEST）

- [ ] **REFT-01**: cross-flavor permission contract 测试矩阵（Milestone 1 删完后只剩 Cursor 单 flavor，矩阵简化为「Cursor permission mode → CLI flag」的完整覆盖；新增 mode 加入需补充矩阵行）
- [ ] **REFT-02**: SSE reconnect / patch-loss 不变量测试。覆盖断线重连后前端最终收敛到正确状态
- [ ] **REFT-03**: Auth 路由 negative cases 测试。bad token、过期 JWT、replayed JWT、空 body

### 功能删除（CUT）

- [ ] **CUT-01**: 删除 Claude Code agent 完整支持。`cli/src/claude/` 整目录、相关 commands、`hookForwarder`、Claude SDK 依赖
- [ ] **CUT-02**: 删除 Codex agent 完整支持。`cli/src/codex/` 整目录、相关 commands、`happyMcpStdioBridge`、`codex-pr-review.yml` / `codex-mention-response.yml` GitHub Actions
- [ ] **CUT-03**: 删除 Gemini agent + ACP 后端。`cli/src/gemini/`、`cli/src/agent/backends/`、ACP 协议相关代码
- [ ] **CUT-04**: 删除 OpenCode agent。`cli/src/opencode/`（含 912 行的 storage scanner）
- [ ] **CUT-05**: `shared/src/flavors.ts` 收敛为单 flavor（`cursor`）；`AgentFlavor` 类型与所有 capability 表去掉非 Cursor 项
- [x] **CUT-06**: 删除 Telegram bot 完整链路。`hub/src/telegram/` 整目录、`hub/src/web/telegramInitData.ts`、`hub/src/web/routes/bind.ts`、`grammy` 依赖、Telegram 通知 channel、Telegram-only 配置项
- [x] **CUT-07**: 删除语音路由 + ElevenLabs SDK 集成。`hub/src/web/routes/voice.ts`、`web/src/realtime/`、`shared/src/voice.ts`、`@elevenlabs/react` 依赖
- [x] **CUT-08**: 删除 ServerChan 推送渠道。`hub/src/serverchan/` 整目录、相关 env 变量
- [x] **CUT-09**: 删除 namespace 多用户隔离。`CLI_API_TOKEN:<namespace>` 后缀语法、user 表 platform 字段、所有 namespace-aware 缓存键、相关测试
- [x] **CUT-10**: 删除 Cloudflare 风格 tunnel binary + TLS gate。`hub/src/tunnel/`、`hub/tools/tunwg/`、`hub/scripts/download-tunwg.ts`、所有 `HAPI_RELAY_*` env 变量、`web/src/lib/relay-mode` 相关
- [x] **CUT-11**: 删除 `DANGEROUSLY_LOG_TO_SERVER_FOR_AI_AUTO_DEBUGGING` 远程日志流。`cli/src/ui/logger.ts` 中的 HAPI_API_URL 上传通道、`doctor` 中的开关
- [ ] **CUT-12**: 文档与营销内容收敛。更新 root `README.md` / `cli/README.md` / `hub/README.md` / `web/README.md` / `AGENTS.md` 到 Cursor-only 单 agent 描述；删除 `website/` 营销站；删除 `docs/` 中提及 claude/codex/gemini/opencode/telegram/voice/serverchan 的页面

### Milestone 1 验收（VERIFY）

- [ ] **VRFY-01**: `bun typecheck` 全绿；`bun run test` 全绿；lint 全绿
- [ ] **VRFY-02**: 0 循环依赖（`madge` 或同类工具验证 `cli/` / `hub/` / `web/` 三个包内 + 跨包）
- [ ] **VRFY-03**: 全仓库 ripgrep 不出现 `claude` / `codex` / `gemini` / `opencode` / `telegram` / `serverchan` / `elevenlabs` / `tunwg` / `namespace` 残留（白名单：`.planning/codebase/` 历史快照、`CHANGELOG.md` 历史条目、git 历史中的 commit message）
- [ ] **VRFY-04**: Cursor + Tailscale 场景手动验收。本机启动 `hapi runner` 与 hub；从 Tailscale 内网手机端（Web PWA）创建 Cursor session → 一轮交互 → 杀掉 hub 重启 → 状态恢复 → 继续交互——全流程通过

## v2 Requirements

Milestone 2 — Cursor 移动端增量编码（路线图暂不覆盖；当前 milestone 完成后通过 `/gsd-new-milestone` 启动）。

### Cursor 能力扩展

- **CURS-01**: Cursor 会话内模型切换（sonnet / opus / composer / auto 等）。模型列表通过本机 Cursor CLI 动态获取，硬编码 fallback 兜底
- **CURS-02**: Skills 集成。默认跟随 Cursor IDE 一致自动生效；会话级可覆盖（开关单个 skill）
- **CURS-03**: MCP servers 列表 + 会话级 toggle。展示本机已配置的 MCP servers 状态；会话级开关
- **CURS-04**: Cursor agent 状态 / effort / 模型名在 session 列表可见
- **CURS-05**: cursor-ide-browser MCP 截图在移动端可视（其它有图像中间产出的 MCP 同理）

## Out of Scope

明确不做的事项与理由。

| Feature | Reason |
|---------|--------|
| Claude Code / Codex / Gemini / OpenCode 其它 agent 支持 | Cursor-only 是项目定位；Milestone 1 CUT-01~04 一次性全删 |
| ACP（Agent Communication Protocol）多 agent 协议抽象 | 与 Cursor-only 定位冲突 |
| Cursor IDE 反向插件（IDE 内嵌 HAPI 等） | 项目方向是「手机控本机 Cursor」，不是「IDE 内嵌 HAPI」 |
| 付费 / SaaS 化 / 多租户 | 单人个人使用 |
| 营销官网 / 推广站 | 个人项目；`website/` 在 CUT-12 删除 |
| 多用户 / namespace 隔离 | Tailscale 内网单人；已在 CUT-09 删除 |
| Cloudflare 风格自带穿透 | 用 Tailscale；已在 CUT-10 删除 |
| Telegram Bot / Mini App | 用 Web PWA 即可；已在 CUT-06 删除 |
| 语音输入 / ElevenLabs 对话 | 移动端系统语音转录够用；已在 CUT-07 删除 |
| ServerChan / 微信公众号推送 | 用 Web Push；已在 CUT-08 删除 |
| 远程日志上报到上游作者 | 个人调试不需要；已在 CUT-11 删除 |
| Multi-instance hub 扩展（Postgres / Redis pub/sub） | 单机单实例 |
| Token rotation API / per-namespace revocation / hub rate limiting | Tailscale 内网，单 token 足够 |
| `better-sqlite3` → `bun:sqlite` 主动迁移 | 没坏不修 |
| 向上游 HAPI 仓库回 PR / 保持兼容 | 这是个 fork，不保持兼容 |
| 移动端查看 file diff / 批准修改 | Milestone 2 也不规划；先把 CURS-01~05 做好再说 |
| 移动端创建 / 编辑 skill 文件 | 通过 Cursor IDE 维护；移动端只读取 + 开关 |

## Traceability

Phase 映射在 ROADMAP.md 创建阶段填充。每个 v1 requirement 映射到唯一 phase。

| Requirement | Phase | Status |
|-------------|-------|--------|
| CUT-01 | Phase 1 (Cut non-Cursor agents) | Pending |
| CUT-02 | Phase 1 (Cut non-Cursor agents) | Pending |
| CUT-03 | Phase 1 (Cut non-Cursor agents) | Pending |
| CUT-04 | Phase 1 (Cut non-Cursor agents) | Pending |
| CUT-06 | Phase 2 (Cut external integration channels) | Complete |
| CUT-07 | Phase 2 (Cut external integration channels) | Complete |
| CUT-08 | Phase 2 (Cut external integration channels) | Completed (02-04) |
| CUT-09 | Phase 3 (Cut multi-user namespace isolation) | Complete |
| CUT-10 | Phase 4 (Cut deployment infrastructure) | Complete |
| CUT-11 | Phase 4 (Cut deployment infrastructure) | Complete |
| CUT-05 | Phase 5 (Flavor consolidation + capability abstraction) | Pending |
| REFA-01 | Phase 5 (Flavor consolidation + capability abstraction) | Pending |
| REFA-02 | Phase 6 (Agent runtime shared kit + mode hardening) | Complete |
| REFA-05 | Phase 6 (Agent runtime shared kit + mode hardening) | Complete |
| REFA-03 | Phase 7 (Wire contracts unification & SSE patch contract) | Complete |
| REFA-04 | Phase 7 (Wire contracts unification & SSE patch contract) | Complete |
| REFH-01 | Phase 8 (Hub internal decoupling) | Complete (08-01) |
| REFH-02 | Phase 8 (Hub internal decoupling) | Pending |
| REFH-03 | Phase 8 (Hub internal decoupling) | Pending |
| REFH-04 | Phase 8 (Hub internal decoupling) | Pending |
| REFW-01 | Phase 9 (Web internal decoupling) | Pending |
| REFW-02 | Phase 9 (Web internal decoupling) | Pending |
| REFW-03 | Phase 9 (Web internal decoupling) | Pending |
| REFC-01 | Phase 10 (Config cleanup) | Pending |
| REFC-02 | Phase 10 (Config cleanup) | Pending |
| REFT-01 | Phase 11 (Test gap fill) | Pending |
| REFT-02 | Phase 11 (Test gap fill) | Pending |
| REFT-03 | Phase 11 (Test gap fill) | Pending |
| CUT-12 | Phase 12 (Docs cleanup & milestone verification) | Pending |
| VRFY-01 | Phase 12 (Docs cleanup & milestone verification) | Pending |
| VRFY-02 | Phase 12 (Docs cleanup & milestone verification) | Pending |
| VRFY-03 | Phase 12 (Docs cleanup & milestone verification) | Pending |
| VRFY-04 | Phase 12 (Docs cleanup & milestone verification) | Pending |

**Coverage:**
- v1 requirements: 33 total
- Mapped to phases: 33 ✓
- Unmapped: 0

**Phase distribution:**
- Phase 1 (Cut non-Cursor agents): 4 reqs — CUT-01, 02, 03, 04
- Phase 2 (Cut external integration channels): 3 reqs — CUT-06, 07, 08
- Phase 3 (Cut multi-user namespace isolation): 1 req — CUT-09
- Phase 4 (Cut deployment infrastructure): 2 reqs — CUT-10, 11
- Phase 5 (Flavor consolidation + capability abstraction): 2 reqs — CUT-05, REFA-01
- Phase 6 (Agent runtime shared kit + mode hardening): 2 reqs — REFA-02, 05
- Phase 7 (Wire contracts unification & SSE patch contract): 2 reqs — REFA-03, 04
- Phase 8 (Hub internal decoupling): 4 reqs — REFH-01, 02, 03, 04
- Phase 9 (Web internal decoupling): 3 reqs — REFW-01, 02, 03
- Phase 10 (Config cleanup): 2 reqs — REFC-01, 02
- Phase 11 (Test gap fill): 3 reqs — REFT-01, 02, 03
- Phase 12 (Docs cleanup & milestone verification): 5 reqs — CUT-12, VRFY-01, 02, 03, 04

---
*Requirements defined: 2026-05-20*
*Last updated: 2026-05-20 after ROADMAP.md creation (traceability filled, 33/33 mapped)*
