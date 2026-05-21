# Phase 2: Cut external integration channels - Context

**Gathered:** 2026-05-21
**Status:** Ready for planning

> **承接 Phase 1 决策（不再问）：** D-01「最小切除」、D-05~D-08 测试处理、D-11~D-13 ripgrep 零容忍 + 守卫脚本、D-14「按 requirement 拆 commit」、「No backward compatibility」原则。本文只记录 Phase 2 新增 / 调整的决策。

<domain>
## Phase Boundary

从 hub / web / shared 物理删除三条外部集成通道：

1. **Telegram bot 完整链路（CUT-06）**——`hub/src/telegram/` 整目录、`hub/src/web/telegramInitData.ts`、`hub/src/web/routes/bind.ts`、`auth.ts` 中 Telegram initData 分支、`grammy` 依赖、`hub/src/index.ts` channel 数组中的 Telegram 项、settings 中所有 `TELEGRAM_*` 字段、Web 端 Telegram WebApp 平台分支（`useTelegram`、`useAuthSource` 中 telegram source、router/main/sw 中 WebApp 入口、`usePlatform` 收敛去除 telegram 分支）
2. **ElevenLabs 语音（CUT-07）**——`hub/src/web/routes/voice.ts`、`web/src/realtime/` 整目录、`web/src/lib/voice-context.tsx`、`web/src/api/voice.ts`、`shared/src/voice.ts`、`@elevenlabs/react` 依赖、`AssistantChat/*` 与 `SessionChat.tsx` 中 voice 按钮 / 状态指示
3. **ServerChan 推送（CUT-08）**——`hub/src/serverchan/` 整目录、`hub/src/index.ts` channel 数组中的 ServerChan 项、settings 中所有 `SERVERCHAN_*` 字段、CLI `notify.ts` 中 ServerChan 转发逻辑

删完 `bun typecheck` + `bun run test` + ripgrep（按本 phase 白名单）+ 通知 channel 数组只剩 web push + `bun.lock` 重生成全绿。

**In scope（Phase 2 必须完成）：** CUT-06, CUT-07, CUT-08（对应 ROADMAP.md SC #1~#5）。
**Out of scope：**
- notification hub channel 抽象重构（Phase 8 REFH-04）
- auth 路由 negative case 覆盖测试（Phase 11 REFT-03）
- README / AGENTS / docs / `website/` 文案清理（Phase 12 CUT-12）
- settings.json runtime 迁移路径删除（Phase 10 REFC-01）
- namespace 多用户隔离（Phase 3 CUT-09）

</domain>

<decisions>
## Implementation Decisions

### 1. Web 端 Telegram WebApp 平台分支抜除深度

- **D-16：整条拔掉强耦合 + `usePlatform` 收敛**——`useTelegram.ts` / `hooks/useAuthSource.ts` 中 telegram source / `router.tsx` / `main.tsx` / `sw.ts` 中 WebApp 入口与 SDK 初始化全删；Telegram-specific CSS（`index.css` 中 telegram-webapp 类）一并清
- **D-17：`usePlatform` 抽象保留，union 收窄为 `'pwa' | 'browser'`**——消费方（`useTheme` / `useViewportHeight` / `InstallPrompt` / `SessionHeader`）中的 telegram 分支删除；只留 pwa / browser 两种行为
- **D-18：`useAuthSource.ts` 收敛为单 source = access-token**——与 D-21 联动；不再有 source 切换

### 2. `web/src/realtime/` 与 ElevenLabs 删除范围

- **D-19：整目录删 `web/src/realtime/`**——通过 grep 已确认所有消费方（`SessionChat.tsx` / `AssistantChat/{ComposerButtons,HappyComposer,StatusBar}.tsx` / `voice-context.tsx` / `voiceHooks.ts`）的引用都服务于语音功能；不存在非 voice 用法
- **D-20：消费侧拔语音按钮 + 状态指示**——`AssistantChat/ComposerButtons.tsx` 删 voice mic 按钮；`StatusBar.tsx` 删录音状态；`HappyComposer.tsx` 删与 voice 相关的 input mode；`SessionChat.tsx` 删 voice provider；保留 composer / chat 主体（这些是 Cursor session 核心 UI）
- **D-21：hub 端联动**——删 `hub/src/web/routes/voice.ts`、`hub/src/web/index.ts` 中 voice route 注册；shared 端删 `shared/src/voice.ts` 与 Zod schema

### 3. notification channel 抽象处理

- **D-22：保留 channel 抽象数组**（与 D-01「最小切除」一致）——只删 `pushTelegramChannel` + `pushServerChanChannel` 两个实现 + 注册项；`notificationHub` 抽象不动，长度变 1；channel interface 保留以待 Phase 8 (REFH-04) 正式重构
- **D-23：channel 抽象的合并 / 折叠归 Phase 8**——本 phase 不跨越 Phase 8 边界

### 4. auth 路由收敛

- **D-24：删 telegramInitData.ts + bind.ts + auth.ts 中 telegram source 分支**——`/api/auth` body schema 收敛为 `{ accessToken: string }` 单形态；返回值 JWT payload 不再含 telegram 字段
- **D-25：不引入新负向测试**——`bad token` / `expired JWT` / `replayed JWT` / `empty body` 覆盖留给 Phase 11 (REFT-03)；本 phase 仅保证 access-token 正向 case 在删除 telegram 分支后仍绿
- **D-26：`socket.io` 鉴权握手中如有 telegram 分支** ——一并按 D-24 删除（research 阶段确认）

### 5. ripgrep 白名单与零容忍范围

- **D-27：本 phase 新增关键词** = `telegram` / `serverchan` / `elevenlabs` / `grammy`；零容忍范围 = `cli/src/` / `hub/src/` / `web/src/` / `shared/src/` 业务代码（identifier / import / 字符串字面量 / 注释）
- **D-28：白名单 = `.planning/codebase/` + `CHANGELOG.md`（沿用 Phase 1 D-12） + `website/`（整目录 Phase 12 删，本 phase 不动） + `docs/public/schemas/settings.schema.json`（schema 是 docs 副产物，Phase 10 REFC-01 / Phase 12 CUT-12 处理）**
- **D-29：守卫脚本同步追加关键词与白名单**——在 PLAN 与 CI 守卫脚本中**同时显式列出**，避免人脑维护

### 6. 提交粒度

- **D-30：5 个 commits**（在 Phase 1 D-14 基础上把 CUT-06 拆为 hub-side / web-side 两个 commit）：
  1. `feat(phase-02): CUT-06 remove Telegram bot (hub-side)` — `hub/src/telegram/` 整目录、`telegramInitData.ts`、`bind.ts`、`auth.ts` 中 telegram 分支、`grammy` 依赖、`hub/src/index.ts` channel 中的 Telegram 项、settings.ts/serverSettings.ts 中 TELEGRAM 字段
  2. `feat(phase-02): CUT-06 remove Telegram WebApp platform (web-side)` — `useTelegram.ts`、`useAuthSource` telegram source、`usePlatform` union 收窄、`router.tsx` / `main.tsx` / `sw.ts` WebApp 入口、消费方分支清理、Telegram-specific i18n 字符串
  3. `feat(phase-02): CUT-07 remove ElevenLabs voice` — `hub/src/web/routes/voice.ts`、`web/src/realtime/`、`voice-context.tsx`、`api/voice.ts`、`shared/src/voice.ts`、`@elevenlabs/react`、AssistantChat / SessionChat 中 voice 按钮 / 状态、settings 中 ElevenLabs 字段
  4. `feat(phase-02): CUT-08 remove ServerChan channel` — `hub/src/serverchan/`、`hub/src/index.ts` channel 中 ServerChan 项、settings.ts/serverSettings.ts 中 SERVERCHAN 字段、CLI `notify.ts` 中 ServerChan 转发
  5. `chore(phase-02): final cleanup + ripgrep guard update` — 守卫脚本追加 4 关键词与白名单、`bun.lock` 重生成、scattered 残留扫尾（含 CLI `TerminalManager.ts` / `notify.ts` 中残留字符串）、跨集成测试 fixture 剥离（`messageService.test.ts` / `notificationHub.test.ts` / `routes/settings/index.test.tsx`）
- **D-31：每个 commit 单独通过 `bun typecheck` + `bun run test`**（沿用 D-15）

### 7. settings schema / serverSettings 字段 + CLI 残留

- **D-32：settings.ts + serverSettings.ts 中相关字段直接删 + 不加 Zod `.passthrough()` 兜底**——符合「No backward compatibility」原则；旧 settings.json 启动时 schema 校验报错 → 用户自行删字段；不在本 phase 加迁移工具（Phase 10 REFC-01 统一处理）
- **D-33：CLI 残留归入 commit #5**——`cli/src/terminal/TerminalManager.ts` 与 `cli/src/commands/notify.ts` 中 telegram / voice 命中的字符串 / 平台检测 / 通知转发分支按零容忍清理；如清理后导致 typecheck 失败，按 D-04 在 PLAN 中标注理由再处理

### Claude's Discretion

- 每个 commit 内部的文件删除顺序（按依赖图自底向上）
- `useAuthSource.ts` / `useTelegram.ts` 是删整文件还是保留空 shell 让 TS 渐进收敛——以 typecheck 是否通过为唯一硬约束（推荐整删）
- `usePlatform.ts` 内部实现细节（`matchMedia('(display-mode: standalone)')` vs 现有抽象）
- `notificationHub.ts` 中删除 telegram / serverchan channel 注册的具体实现形式（数组项删 vs feature flag）——倾向直接删
- composer voice 按钮拔除后是否补一个 placeholder 提示（推荐：不补，UI 自然收敛）
- 是否在 commit #5 顺手清理 hub `index.ts` 的 QR / startup banner 中关于 Telegram bind URL 的输出（zero-tolerance 下应清）

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 项目宪法

- `.planning/PROJECT.md` — 项目愿景与单人 Tailscale 单 agent 定位
- `.planning/REQUIREMENTS.md` — Milestone 1 全部 33 条 requirement；本 phase 映射到 CUT-06 / CUT-07 / CUT-08
- `.planning/ROADMAP.md` §「Phase 2: Cut external integration channels」与 §「Phase 8 / Phase 10 / Phase 11 / Phase 12」（理解 phase 边界与后续接手范围）
- `AGENTS.md` — 工作风格、Bun workspaces 约定、「No backward compatibility」、「Prioritize Pragmatism」

### Phase 1 沿用决策（避免重复讨论）

- `.planning/phases/01-cut-non-cursor-agents/01-CONTEXT.md` — D-01「最小切除」、D-05~D-08 测试处理、D-11~D-13 ripgrep 守卫 + 白名单机制、D-14/D-15 commit 拆分
- `.planning/phases/01-cut-non-cursor-agents/01-VERIFICATION.md` — Phase 1 守卫脚本落地形式（本 phase 在其基础上追加关键词）

### Codebase 地图

- `.planning/codebase/STRUCTURE.md` — 包/目录结构
- `.planning/codebase/ARCHITECTURE.md` — CLI ↔ Hub ↔ Web 三段架构
- `.planning/codebase/INTEGRATIONS.md` — 外部集成清单（**本 phase 主要参考**）
- `.planning/codebase/CONCERNS.md` — 已知技术债
- `.planning/codebase/TESTING.md` — Vitest 约定与现有覆盖

### 本 phase 直接相关源码（删除目标 + 影响面）

**CUT-06（Telegram）**
- `hub/src/telegram/` — bot / callbacks / renderer / sessionView 整目录
- `hub/src/web/telegramInitData.ts`、`hub/src/web/routes/bind.ts` — 鉴权与绑定路由
- `hub/src/web/routes/auth.ts` — 删 telegram source 分支（D-24）
- `hub/src/web/routes/messages.ts` — telegram 命中（research 阶段确认是否仅注释/字符串）
- `hub/src/sync/{rpcGateway,syncEngine,messageService}.ts` — telegram 命中（剥离 fixture / 字符串）
- `hub/src/sync/messageService.test.ts`、`hub/src/notifications/notificationHub.test.ts` — 剥离 telegram fixture
- `hub/src/index.ts` — channel 数组中 Telegram 项 + 启动 banner 中 bind URL
- `hub/src/notifications/notificationTypes.ts`、`hub/src/notifications/notificationHub.ts` — telegram channel 实现移除
- `hub/src/config/{settings,serverSettings}.ts`、`hub/src/configuration.ts` — TELEGRAM_* 字段删
- `hub/package.json` — `grammy` 依赖删
- `web/src/hooks/{useTelegram,useAuthSource,usePlatform,useTheme,useViewportHeight,useAuth}.ts` — telegram 分支与 source 删 / union 收窄
- `web/src/{router,main,sw,App}.tsx` + `web/src/index.css` — WebApp 入口 / SDK 引入 / CSS 删
- `web/src/components/{SessionHeader,InstallPrompt}.tsx`、`web/src/components/SessionChat.tsx` — telegram 分支删
- `web/src/lib/locales/{en,zh-CN}.ts`、`web/src/lib/languages.ts` — Telegram 相关 i18n 字符串删
- `web/src/routes/settings/{index,index.test}.tsx` — Telegram settings section 删 + 测试 fixture 剥离
- `web/vite.config.ts`、`web/package.json` — Telegram SDK 依赖与配置删

**CUT-07（ElevenLabs voice）**
- `hub/src/web/routes/voice.ts`、hub web router 中 voice 注册
- `web/src/realtime/` — 整目录（hooks / RealtimeSession / RealtimeVoiceSession / realtimeClientTools / types / voiceConfig）
- `web/src/lib/voice-context.tsx`、`web/src/api/voice.ts`
- `shared/src/voice.ts`
- `web/src/components/AssistantChat/{ComposerButtons,HappyComposer,StatusBar}.tsx`、`web/src/components/SessionChat.tsx` — voice 按钮 / 状态指示 / provider 删
- `web/package.json` — `@elevenlabs/react` 依赖删
- 相关 ElevenLabs settings 字段（如有）— `settings.ts` / `serverSettings.ts`

**CUT-08（ServerChan）**
- `hub/src/serverchan/` — channel + test 整目录
- `hub/src/notifications/notificationHub.ts` — serverchan channel 注册移除
- `hub/src/config/{settings,serverSettings}.ts`、`hub/src/configuration.ts` — SERVERCHAN_* 字段删
- `hub/src/index.ts` — channel 数组中 ServerChan 项
- `cli/src/commands/notify.ts` — ServerChan 转发分支删

**跨 CUT 扫尾（commit #5）**
- `cli/src/terminal/TerminalManager.ts`、`cli/src/commands/notify.ts` — telegram / voice 字符串与平台分支
- `bun.lock`（root）— 删依赖后重生成
- 守卫脚本（沿用 Phase 1 形式）— 追加 4 关键词与白名单

### 验收脚本范围（Phase 2 SC 编号对应）

- SC#1：`bun typecheck` + `bun run test` 全绿
- SC#2：ripgrep `telegram` / `serverchan` / `elevenlabs` / `grammy` 在 `cli/src/` / `hub/src/` / `web/src/` / `shared/src/` 业务代码零命中（白名单按 D-28）
- SC#3：`package.json` 无 `grammy` / `@elevenlabs/react`；`hub/src/index.ts` channel 数组只剩 web push
- SC#4：`TELEGRAM_BOT_TOKEN` / `TELEGRAM_NOTIFICATION` / `SERVERCHAN_SENDKEY` / `SERVERCHAN_NOTIFICATION` 在代码库无读取
- SC#5：`/api/auth` 仅 access-token 分支；测试覆盖 access-token 正向 case

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- `web/src/hooks/usePlatform.ts` — 平台抽象，**保留**（收窄 union；PWA vs 浏览器区分在后续仍有用，例如 install prompt / viewport 行为）
- `hub/src/notifications/notificationHub.ts` channel interface — **保留**（Phase 8 REFH-04 才决定是否折叠）
- `hub/src/web/routes/auth.ts` 主体 — **保留**（删 telegram 分支后即收敛为单 source；不重构，留给 Phase 8 REFH-03 路由模板抽象）
- Phase 1 ripgrep 守卫脚本 — **复用**（追加关键词与白名单即可，不重写）

### Established Patterns

- Vitest（`*.test.ts` 与源文件同目录）— 删源就删测试
- Zod schemas 集中在 `shared/src/schemas.ts` — 删 `shared/src/voice.ts` 后注意是否有从 `schemas.ts` 转发的 export
- Bun workspaces — root `bun install` 重生成 `bun.lock`
- `hub/src/web/index.ts` 路由注册 — 删 route 文件后同步删注册项
- channel 注册模式（`hub/src/index.ts` 启动时把 channel 推入数组）— 删项即可，不动模式

### Integration Points

- **`hub/src/index.ts`** — channel 数组装配中心；启动 banner（包括 bind URL 输出）；本 phase 多个 commit 都会触到此文件
- **`hub/src/web/index.ts`** — route 注册中心；CUT-06 / CUT-07 都需删项
- **`hub/src/notifications/notificationHub.ts`** — 多 channel fan-out 逻辑；channel 实例化在 `hub/src/index.ts`
- **`web/src/router.tsx` / `main.tsx`** — 应用启动入口；Telegram WebApp 平台检测 / SDK 初始化删
- **`web/src/hooks/useAuth*.ts`** — 鉴权 source 抽象；与 hub `auth.ts` 协议联动

### 影响面量化（scout 阶段 grep）

- web 端 telegram 命中文件：15 个；强耦合 4 个、平台抽象 5 个、i18n / CSS / 组件 6 个
- realtime 消费侧文件：10 个；全部服务于 voice 功能
- hub notification channel 文件：4 个；删 2 个实现后只剩 web push

</code_context>

<specifics>
## Specific Ideas

- 「最小切除」延续 Phase 1 风格：删 + 业务消费收敛，**不**借机重构 notification hub / auth 路由 / Composer UI 抽象
- ripgrep 守卫脚本要让 `bun run test` 能跑 + 白名单显式列出（沿用 Phase 1 D-13）
- 5 commits 拆分理由：CUT-06 在 hub-side（物理删目录 + 鉴权分支）与 web-side（平台分支重写 + UI 收敛）影响面差异大，分开 bisect 友好；其余 CUT 沿用 Phase 1 一条一 commit
- web composer 拔语音按钮后 UI 自然收敛，不补 placeholder 提示（与「No backward compatibility」精神一致：旧 UI 痕迹不留）
- settings 字段直接删 + 不加 Zod `.passthrough()`：旧 settings.json 启动失败由用户手动 migrate；与 Phase 10 REFC-01「schema 版本不匹配 ⇒ 拒绝启动」方向一致

</specifics>

<deferred>
## Deferred Ideas

- **notification channel 抽象折叠 / notificationHub 直接调 web push** —— Phase 8 (REFH-04) 集中调度器 + 解耦时一并审视
- **auth 路由 negative case 覆盖（bad token / expired JWT / replayed JWT / empty body）** —— Phase 11 (REFT-03)
- **settings.json 旧字段迁移工具 / schema 版本拒绝启动** —— Phase 10 (REFC-01)
- **`website/` 整目录删除 + `docs/` 中 telegram / voice / serverchan 页面清理** —— Phase 12 (CUT-12)；本 phase 仅源码内 JSDoc / 行注释清理（在 D-27 零容忍下）
- **`website/src/locales/*.json` 中 telegram / voice 字符串** —— Phase 12 (CUT-12) 整目录删时自然消除
- **`docs/public/schemas/settings.schema.json` 中 telegram / serverchan 字段定义** —— Phase 10 / Phase 12（schema 是 docs 副产物，与 settings.ts 联动重新生成）
- **hub `auth.ts` 内部 helper / 错误返回结构重构** —— Phase 8 (REFH-03) 路由模板抽象 + `ApiRouteError` 统一
- **composer voice 按钮拔除后是否补 system speech-to-text 替代入口** —— PROJECT.md 已明确「移动端系统语音转录够用」，本 milestone / Milestone 2 都不规划
- **`useTelegram.ts` / `useAuthSource.ts` 是否在 PWA Web Push 鉴权流中复用** —— 不复用；Phase 2 后 auth 收敛为 access-token 单 source

</deferred>

---

*Phase: 2-cut-external-integration-channels*
*Context gathered: 2026-05-21*
