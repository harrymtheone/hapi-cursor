# Phase 8: Hub internal decoupling - Context

**Gathered:** 2026-05-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 8 交付的是：把 `hub/src/sync/` 的两块超大胖类（`sessionCache.ts` 774 行、`syncEngine.ts` 722 行）按职责拆成单一责任的 service / sub-facade；切断 `hub/src/sse/` 反向依赖 `SyncEngine` 具体类型（改为只依赖 `@hapi/protocol/types` 的 `SyncEvent`）；把 hub 内散落的 4 个 recurring timer（inactivity / heartbeat / terminal idle / notification timer）统一到一个 `KeepaliveScheduler`，shutdown 钩子覆盖 SIGINT；把 `web/routes/sessions.ts`（467 行 / 17 handler）按职责切成 4 子文件，并引入 `parseJsonBody / withEngine / withSession / withActiveSession / withMachine` middleware 与统一 `ApiRouteError`。映射 **REFH-01 + REFH-02 + REFH-03 + REFH-04**。

**In scope:**

- `hub/src/sync/sessionCache.ts`（774 行）拆为 4 个 service 文件 + `SessionCache` 退化为薄 facade（保留类名 / 公开方法签名零变化，callers 不改 import）：
  - `sessionRepository.ts` — `getSessions / getSession / getActiveSessions / getOrCreateSession / refreshSession / reloadAll / resolveSessionAccess`；**唯一**持有 Store session 句柄。
  - `sessionLivenessService.ts` — `handleSessionAlive / markMessageQueued / applyBackgroundTaskDelta / recordSessionActivity / handleSessionEnd / expireInactive`；inactivity timer 走新 scheduler。
  - `sessionConfigService.ts` — `applySessionConfig / renameSession / deleteSession`。
  - `sessionMergeService.ts` — `mergeSessions / mergeSessionHistory / mergeSessionData / mergeSessionMetadata / mergeAgentState / extractAgentSessionId / deduplicateByAgentSessionId`；事务粒度保持原样（Store 自己的 better-sqlite3 transaction 不动）。
  - `SessionCache` 内部 = 4 个 service 的 composition，每个公开方法逐个 delegate。
- `hub/src/sync/syncEngine.ts`（722 行）拆为 4 个 sub-facade（按职责，不按生命周期），`SyncEngine` 类保留为 composition + lifecycle owner：
  - `syncEngineSession.ts` / `syncEngineMachine.ts` / `syncEngineMessage.ts` / `syncEngineRpc.ts`（约 180 行 / 各）。
  - `SyncEngine.start / shutdown` 仍是公开入口；shutdown 时 fan-out 到每个 sub-facade 自己的 `shutdown()`。
- `hub/src/sse/sseManager.ts:1` 的 `import type { SyncEvent } from '../sync/syncEngine'` 改为 `import type { SyncEvent } from '@hapi/protocol/types'`（P7 已经把 `SyncEvent` 落在 shared）；`hub/src/sse/sseManager.test.ts:3` 同步。**不**在 hub 本地再建 `events.ts`。
- 新建 `hub/src/utils/scheduler.ts::KeepaliveScheduler`，接口：
  - `scheduler.everyMs(name, ms, fn) → handle`
  - `scheduler.afterMs(name, ms, fn) → handle`
  - `handle.cancel()`
  - `scheduler.shutdown()` —— 取消所有 active handle。
  - `name` 必填，用于日志与测试断言。
- 替换 hub 内所有 **recurring** timer 走 scheduler（DI 注入）：
  - `hub/src/sync/syncEngine.ts:81` inactivityTimer（5s interval）。
  - `hub/src/sse/sseManager.ts:124` heartbeatTimer。
  - `hub/src/socket/terminalRegistry.ts:122` idleTimer。
  - `hub/src/notifications/notificationHub.ts:131` notify timer。
- shutdown 钩子接入：`hub/src/index.ts` 主入口的 `process.on('SIGINT')` / `process.on('SIGTERM')` 调 `scheduler.shutdown()` + `syncEngine.shutdown()`；SIGINT 测试用 vitest fakeTimers + `process.emit('SIGINT')` 断言所有 handle 进入 cancelled 状态。
- `hub/src/web/routes/sessions.ts`（467 行 / 17 handler）按职责切成子目录：
  - `routes/sessions/lifecycle.ts` — `POST /:id/resume`、`POST /:id/abort`、`POST /:id/archive`、`POST /:id/switch`、`PATCH /:id`、`DELETE /:id`。
  - `routes/sessions/config.ts` — `POST /:id/permission-mode`、`POST /:id/model`。
  - `routes/sessions/upload.ts` — `POST /:id/upload`、`POST /:id/upload/delete`。
  - `routes/sessions/read.ts` — `GET /sessions`、`GET /:id`、`GET /:id/slash-commands`、`GET /:id/skills`。
  - `routes/sessions/index.ts` — `createSessionsRoutes(getSyncEngine)` 把 4 个子 app 用 `app.route('/', sub)` 拼起来；外部入口签名零变化。
- 引入 Hono **middleware** 形态的 helper（写入 `c.set`），失败抛 `ApiRouteError`：
  - `parseJsonBody(schema)` — 失败 → `ApiRouteError(400, 'invalid-body', issues)`；成功 → `c.set('body', parsed)`。
  - `withEngine` — 注入 `SyncEngine`；null → `ApiRouteError(503, 'engine-unavailable')`。
  - `withSession(idParam)` — 注入 `Session`；not-found → `ApiRouteError(404, 'not-found')`。
  - `withActiveSession(idParam)` — `withSession` + active 校验。
  - `withMachine(idParam)` — 同上 for machine。
- `ApiRouteError extends HTTPException`（Hono 内置基类）+ `code: string` 字段；`app.onError` 全局 handler 将 ApiRouteError 转为统一 JSON `{ error: { code, message, ...optionalDetails } }`；其它未捕获 throw 走 500 默认。
- 新增 / 改写测试：
  1. `hub/src/utils/scheduler.test.ts`（新文件）— (a) `shutdown()` 后全部 handle cancelled；(b) SIGINT 路径：mock `process.on('SIGINT')` 注册的 handler，触发后所有 timer 清；(c) cancel 后 callback 不再触发；(d) name 重复时不抛但 warn（dev mode 提示）。
  2. `hub/src/sync/sessionRepository.test.ts` / `sessionLivenessService.test.ts` / `sessionConfigService.test.ts` / `sessionMergeService.test.ts`（迁移自既有 `sessionCache.test.ts` / `sessionModel.test.ts` 的相关 case，按 service 拆分）；原 `sessionCache.test.ts` 保留 facade-level smoke。
  3. `hub/src/web/routes/sessions/__tests__/`（按子文件拆既有路由测试）+ `apiRouteError.test.ts`（新文件）— 断言 helper 失败时统一 JSON shape；`parseJsonBody` schema 失败返回 400 + code='invalid-body'；`withSession` 404 + code='not-found'。
- ripgrep + madge guard 追加（详见 D-138）。

**Out of scope:**

- REFW-01 / REFW-02 / REFW-03 web 内部解耦（ToolCard 循环、oversized files、util 上提到 shared）—— **Phase 9**。本 phase 不动 `web/src/`。
- REFC-01 / REFC-02 config 清理（serverUrl alias、`hapi server` 命令、SQLite runtime migration、`_setApiUrl` setter、`loadConfig()` Readonly）—— **Phase 10**。本 phase 不改 Store schema、不动 config 单例形态。
- REFT-01 / REFT-02 / REFT-03 测试空白填补（cursor permission matrix / SSE reconnect / auth route negative）—— **Phase 11**。本 phase 测试只覆盖被本 phase 拆动的代码。
- `cli/` / `shared/` 内容不动。`shared/src/` 的 `SyncEvent` type 已是 P7 D-119 唯一来源，本 phase 仅是 hub 侧切换 import 路径。
- 不加 feature flag、不加 `SessionCache` / `SyncEngine` 两套 API 共存期、不加 path alias —— 一次切干净（与 P2/P4/P5/P6/P7 同款，no backward compat）。
- 不动 `messageService.ts` / `rpcGateway.ts` / `machineCache.ts` / `teams.ts` / `backgroundTasks.ts` / `todos.ts` 等已经合理大小的文件（500 行以下，职责单一），即使其与 SessionCache / SyncEngine 有调用关系。
- 不动 `hub/src/socket/` namespace handler 拓扑；只在 `terminalRegistry.ts` 单点把 idle timer 切到 scheduler。
- 不动 `messages.ts` / `machines.ts` / `permissions.ts` 等其它 routes 文件的拆分结构（它们已 <130 行）；新 helper / `ApiRouteError` **可** 被它们顺手用上（少量替换），但不强制全改。
- 不写 SQLite migration（本 phase 不动 schema）。
- 不动 `hub/src/notifications/` 的 channel 拓扑；只把 `notificationHub.ts:131` 的 timer 改走 scheduler。
- 不重排 `hub/src/index.ts` 主入口的 wiring 顺序；只追加 scheduler 创建 + shutdown 钩子。
- 不收敛 `syncEngine.ts:645,657` 两处 `setTimeout(resolve, 250)` 一次性 retry sleep —— 它们是 promise sleep 而非 keepalive，不进 scheduler。SC#4 措辞「recurring timer」+「keepalive scheduler」覆盖范围明确。

</domain>

<decisions>
## Implementation Decisions

### 1. SessionCache 4 服务拆分（灰区 A）

- **D-129：SessionCache 退化为薄 facade，4 个 service 文件按方法簇切。** 服务边界、方法归属与文件大小预算见 In scope；事务边界（merge 流程的 better-sqlite3 transaction）原样保留在 `sessionMergeService.ts` 内部；Store 句柄**唯一**持有者 = `sessionRepository.ts`，其它 service 通过 repository 取/写 Session 实例。SessionCache 类名与公开方法签名零变化 —— callers（SyncEngine sub-facade、socket handlers、routes）不改 import，git diff 控制在内部。
- **D-130：`SessionCache` 类名保留 1 个 phase，Phase 12 verification 阶段评估是否进一步删名直接暴露 4 个 service。** 本 phase 内：保留 facade 是为了把 surface area 改动锁定在 `hub/src/sync/`，不外溢到 routes / socket handlers / syncEngine。Phase 12 ripgrep `class SessionCache` 命中数 = 1（合法 facade）；Phase 12 之后若所有上游已改为 DI 注入 4 个 service 自身，则可删 facade。本 phase **不**做这步外溢。
- **D-131：merge 流程不抽 transaction helper。** `sessionMergeService.ts::mergeSessionData` 内部仍直接调 `Store.transaction(...)`；不在本 phase 引入 `withTransaction(fn)` 抽象，避免与 P10 REFC-02 DI 改造冲突。

### 2. SyncEngine 4 sub-facade 拆分 + SSE 解耦（灰区 B）

- **D-132：SyncEngine 按职责拆为 4 个 sub-facade。** `syncEngineSession.ts` / `syncEngineMachine.ts` / `syncEngineMessage.ts` / `syncEngineRpc.ts`，约 180 行 / 各。`SyncEngine` 类保留为这 4 个的 composition + lifecycle owner（`start` / `shutdown`）。**不**按生命周期（startup/runtime/shutdown）拆 —— shutdown 钩子分布在每个 sub-facade 内部，按职责切自然吸纳。
- **D-133：`hub/src/sse/sseManager.ts` 的 `SyncEvent` import 切到 `@hapi/protocol/types`。** P7 D-119 已经把 `SyncEvent` 落在 shared 唯一来源；本 phase 是兑现 SC#2「SSE 不再反向依赖 SyncEngine 具体类型」的最后一步。**不**在 `hub/src/sync/` 或 `hub/src/sse/` 内本地再建 `events.ts` —— 与 P7「shared 唯一来源」原则一致。
- **D-134：`SyncEngine` 类名不动；4 个 sub-facade 通过 `syncEngine.sessionFacade.foo()` 还是直通方法 `syncEngine.foo()` 调用，由 planner 选。** 推荐**直通方法**（SyncEngine 公开方法逐个 delegate 到 sub-facade），保持 callers 零改动 —— 与 D-129 SessionCache facade 同款思路；planner 若发现某个 sub-facade 的方法很少在外部被调，可以让 SyncEngine 不暴露而强制走 `syncEngine.machineFacade.x()`（仅当显著提升类型 narrow / DI clarity 时）。

### 3. routes 拆分 + helper middleware + ApiRouteError（灰区 C）

- **D-135：`web/routes/sessions.ts` 按 lifecycle / config / upload / read 四职责切 4 子文件 + `index.ts` 拼装。** `createSessionsRoutes(getSyncEngine)` 函数签名零变化，外部 `server.ts` 不改 import。每个子文件预算 < 250 行。
- **D-136：helper 形态 = Hono middleware，向 `c.set` 写入注入对象。** 不用高阶 wrapper（HOF wraps handler）—— Hono idiom 是 middleware；用 middleware 不破坏链式 `.get/.post` + 允许多 middleware 组合。约定：`withEngine` / `withSession(idParam='id')` / `withActiveSession(idParam='id')` / `withMachine(idParam='id')` / `parseJsonBody(schema)`。Type 上扩 `WebAppEnv['Variables']` 加 `engine`、`session`、`machine`、`body` 字段。
- **D-137：`ApiRouteError extends HTTPException`，统一 JSON shape `{ error: { code, message, details? } }`。** Hono 已有 `HTTPException` 基类（带 `status`），扩 `code: string`（kebab-case，如 `'not-found'` / `'invalid-body'` / `'engine-unavailable'`）+ 可选 `details: unknown`。`hub/src/web/server.ts::createWebApp` 注册 `app.onError(errorHandler)` 把 ApiRouteError 转 JSON；未捕获的 throw 转 500 default。**不**用 `Result<T, E>` 类型 / `c.json({ error })` 手写返回 —— 二者都会回弹回大量样板。

### 4. 集中 KeepaliveScheduler（灰区 D）

- **D-138：新建 `hub/src/utils/scheduler.ts::KeepaliveScheduler`，接口含 interval + timeout。** 接口形态见 In scope。`name` 必填（用于日志 + SIGINT 测试断言全部命中）；**不**加 priority 字段（暂无调度优先级需求，加了就要忍受无 user-facing 价值的复杂度）。**支持** `afterMs`（一次性 timeout）—— 虽然 SC#4 措辞 recurring，但 `notificationHub.ts:131` 的 notify timer 是 timeout 形态 + idle 场景下要被 cancel，把它纳入 scheduler 才能保证 SIGINT 时全清。一次性 `setTimeout(resolve, 250)` retry sleep（`syncEngine.ts:645,657`）**不**入 scheduler（promise sleep 语义，shutdown 时 await 会自然结束）。
- **D-139：DI 注入路径 = 在 `hub/src/index.ts` 主入口创建 `new KeepaliveScheduler()` 单例，传给 SyncEngine / SSEManager / TerminalRegistry / NotificationHub 构造器。** 与 P10 REFC-02「DI 取代 mutable singleton」方向预对齐 —— 不强行做完整 DI 容器，只让 scheduler 这一个依赖显式注入。SSEManager、TerminalRegistry、NotificationHub 已经是 class，构造器加 `scheduler: KeepaliveScheduler` 参数；SyncEngine 同。
- **D-140：shutdown 钩子集中在 `hub/src/index.ts` 主入口。** 注册 `process.on('SIGINT', shutdown)` + `process.on('SIGTERM', shutdown)`，`shutdown` 函数依次调 `scheduler.shutdown()` → `syncEngine.shutdown()`（既有）→ `process.exit(0)`。**不**在每个子系统里各自注册 process 监听 —— 主入口单点收敛便于审计。
- **D-141：SIGINT 测试形态 = vitest fakeTimers + 显式调 shutdown handler。** `hub/src/utils/scheduler.test.ts` 不真的发 SIGINT（process-level mocking 跨 vitest 进程边界不可靠）；而是：(a) 测 `scheduler.shutdown()` 直接调用后所有 handle 进入 cancelled 状态、callback 不再触发；(b) 在 `hub/src/index.test.ts`（或新建 `shutdown.test.ts`）测 SIGINT handler 函数本身：mock scheduler + syncEngine，调用 handler，断言 `scheduler.shutdown` 与 `syncEngine.shutdown` 都被调用。SC#4「a test asserts every timer is cleared on process.exit (SIGINT case included)」由这两个测试合起来满足。

### 5. 切片节奏与 guard（灰区 E + 默认）

- **D-142：4 切片，每片落 `bun typecheck` + `bun run test` 全包绿。**
  1. **Slice 1 — SessionCache 4 拆**（REFH-01）：建 4 个 service 文件，SessionCache 退化 facade；既有 `sessionCache.test.ts` / `sessionModel.test.ts` 按 service 拆 case；callers 不变。**门槛**：`wc -l hub/src/sync/session*.ts` 每文件 < 400；`bun typecheck` + `bun run test:hub` 全绿。
  2. **Slice 2 — KeepaliveScheduler + 4 timer 接入 + SyncEngine 4 sub-facade 拆 + SSE 切 shared type**（REFH-02 + REFH-04）：新建 `hub/src/utils/scheduler.ts` + `scheduler.test.ts`；SyncEngine / SSEManager / TerminalRegistry / NotificationHub 构造器加 `scheduler` 参数；4 个 recurring timer 改走 scheduler；SyncEngine 拆 4 sub-facade；`sseManager.ts:1` + `sseManager.test.ts:3` 的 SyncEvent type import 切到 `@hapi/protocol/types`；`hub/src/index.ts` 接入 scheduler 单例 + SIGINT/SIGTERM handler。**门槛**：`npx madge --circular --extensions ts,tsx hub/src/` 在 hub-内部范围 0 环（当前 1 环）；scheduler.test SIGINT case 通过；ripgrep `import .* from .*sync/syncEngine` 在 `hub/src/sse/` 命中 = 0。
  3. **Slice 3 — sessions.ts 4 拆 + helper middleware + ApiRouteError**（REFH-03）：新建 `hub/src/web/routes/_helpers/` 目录（或 `hub/src/web/middleware/route-helpers.ts` 单文件，researcher 选）；建 `apiRouteError.ts` + `app.onError` handler；按 4 子文件拆 sessions.ts；既有 routes 测试按子文件拆 + 新加 `apiRouteError.test.ts`。**门槛**：`wc -l hub/src/web/routes/sessions/*.ts` 每文件 < 250；`bun run test:hub` 全绿（含路由 contract test）；ripgrep `throw new HTTPException` 在 `hub/src/web/routes/` 命中数受控（推荐：除 helper 内部，其他点都用 `ApiRouteError`）。
  4. **Slice 4 — guard 收口**：`scripts/check-no-cut-agents.sh` 追加 Phase 8 sweep block（D-143 关键词）；脚本中追加 `npx madge --circular --extensions ts,tsx hub/src/ 2>&1 | grep -v 'web/dist' | grep -q "^\d\+)"` 反向断言（推荐写在 `scripts/check-no-circular-hub.sh` 独立脚本，避免 madge 输出污染主 guard）—— researcher / planner 选独立脚本还是合并。phase gate：`bash scripts/check-no-cut-agents.sh` 退出 0；`bun typecheck` + `bun run test` 全绿。
- **D-143：ripgrep + madge zero-tolerance 关键词。** 范围 `hub/src/`（web/dist 排除）：
  1. `import .* from .*['"]\.\./sync/syncEngine['"]` 在 `hub/src/sse/` 0 命中（SC#2 硬验）。
  2. `new SessionCache\(` 在 `hub/src/` 仅 `syncEngine` / `index.ts` / 测试中合法位置命中（researcher 列清单）。
  3. `setInterval\(` / `setTimeout\(` 在 `hub/src/{sse,sync,socket,notifications}/` 中：除 `hub/src/utils/scheduler.ts` 自身 + `syncEngine.ts:645,657` 两处合法 promise sleep（白名单注释锚定）外，0 命中（SC#4 硬验）。
  4. `madge --circular hub/src/` 在 hub-内部范围 0 环（SC#5 硬验）。命令需 ignore `web/dist/`，要么 `madge --exclude` 要么独立 `tsconfig` paths。
  5. `wc -l hub/src/sync/*.ts hub/src/web/routes/sessions*.ts hub/src/web/routes/sessions/*.ts` 每文件 < 400（SC#1 硬验）；`< 250` for `routes/sessions/*.ts`。
- **D-144：本 phase 不动 `messageService.ts` / `rpcGateway.ts` / `machineCache.ts` / `messages.ts` / `machines.ts` 等 ≤500 行的合理大小文件。** 哪怕它们与 SessionCache / SyncEngine 有 import 关系；新 helper / `ApiRouteError` **可** 被 `messages.ts` / `machines.ts` 顺手用一两处（如果 planner 发现明显减重），但不强制全改 —— 避免 phase scope 膨胀。

### Claude's Discretion

- 4 个 SessionCache service 是否各自暴露给 SyncEngine 直接调（而非通过 SessionCache facade），由 planner 在 Slice 2 拆 SyncEngine 时决定 —— 推荐通过 facade，保持 surface area 锁在 `hub/src/sync/`。
- SyncEngine 的 4 sub-facade 是 `syncEngine.session.foo()` 这种字段暴露，还是 `syncEngine.foo()` 直通 delegate，由 planner 选（默认直通，零 caller 改动）。
- 新 helper middleware 放 `hub/src/web/middleware/` 单文件还是 `hub/src/web/routes/_helpers/` 子目录，由 researcher 按依赖关系决定（middleware 目录已有 `auth.ts`，可以并入）。
- `ApiRouteError` 的 `details` 字段是否限定为 Zod `ZodIssue[]`，由 planner 选 —— 推荐 `details: unknown` 保留弹性（Zod issues / 自定义 metadata 共用一个口）。
- KeepaliveScheduler 是否在 dev 模式 log 每个 schedule / cancel（便于调试 timer 泄漏），由 researcher 决定；推荐 dev 模式 console.debug、prod 模式静默。
- SIGINT handler 中是否 await `syncEngine.shutdown()` 的完成才 `process.exit(0)`，由 researcher 决定 —— 推荐 await 但加 5s 总超时（避免 deadlock 导致 ctrl-c 无响应）。
- `hub/src/web/routes/sessions/index.ts` 是否 export 4 个子 app（便于按需 mount）还是只 export `createSessionsRoutes`，由 planner 选（默认后者，外部 API 不变）。
- madge 命令 `npx madge --circular --extensions ts,tsx hub/src/` 在仓库根跑时会把 `web/dist/` 也吃进来（实测 60+ 环全部来自 mermaid bundle）；guard 脚本必须 `--exclude '^\.\./'` 或显式 cwd `hub/src` + 处理输出过滤。researcher 在 Slice 4 给出最终命令形式。

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 项目宪法

- `.planning/PROJECT.md` — Cursor-only 单 agent 定位；移动端 + Tailscale 带宽敏感场景（影响 SSE shutdown 时清 timer 的语义：连接是否要 graceful close 还是直接断 —— D-140 选直接 `process.exit` 后 OS 收 socket）。
- `.planning/REQUIREMENTS.md` §「v1 Requirements」— **REFH-01 / REFH-02 / REFH-03 / REFH-04 映射 Phase 8**；REFW-* 留 Phase 9、REFC-* 留 Phase 10、REFT-* 留 Phase 11。
- `.planning/ROADMAP.md` §「Phase 8: Hub internal decoupling」— **SC#1–#5 是验收锚点**：(SC#1) SessionCache + SyncEngine 拆分到 `hub/src/sync/` 每文件 ≤ ~400 行；(SC#2) `hub/src/sse/` 不 import `SyncEngine` / `@/sync/syncEngine`；(SC#3) `routes/sessions.ts` 按 lifecycle/config/upload/read-only 拆 + helper + ApiRouteError；(SC#4) `hub/src/{sse,sync,socket,notifications}/` 内 setInterval/setTimeout 全走 scheduler + SIGINT 清 timer 测试；(SC#5) `madge` hub 内零环 + `bun typecheck` + `bun run test` 绿。
- `AGENTS.md` — No backward compatibility、TypeScript strict、Bun workspaces、4 空格缩进、必要测试。

### Prior Phase Decisions（关键继承点）

- `.planning/phases/01-cut-non-cursor-agents/01-CONTEXT.md` — D-11~D-13 源码关键词零容忍 + 白名单（本 phase D-143 同款模板）。
- `.planning/phases/02-cut-external-integration-channels/02-CONTEXT.md` — D-22/D-32 删除型 phase 不加兼容 shim（本 phase「不加 facade 兼容期」的同源 —— D-129 SessionCache 退化 facade 是**结构性** facade 而非兼容期 shim）。
- `.planning/phases/03-cut-multi-user-namespace-isolation/03-CONTEXT.md` — D-41 显式失败 vs silent fallback（D-137 `ApiRouteError` 统一 JSON shape 而非 silent 200 + error body 同源）。
- `.planning/phases/05-flavor-consolidation-capability-abstraction/05-CONTEXT.md` — D-84/D-86 ripgrep guard + 4 切片模板（本 phase D-142~D-143 直接复用）；D-82 删除 isXxxFlavor() 单点判定函数（本 phase D-133 删除「sseManager 反向依赖 SyncEngine type」同源「shared 单点」精神）。
- `.planning/phases/06-agent-runtime-shared-kit-mode-hardening/06-CONTEXT.md` — **D-107~D-110 4 切片 + ripgrep + madge guard 模板**（Phase 8 D-142~D-143 直接复用此模板）；D-98~D-100 SessionContext / LocalAdapter / RemoteAdapter / ModeConfig / LaunchPolicy 5 抽象拆 cli/cursor `loop ↔ session ↔ launcher` 循环 —— 本 phase 是它在 hub 侧的对偶拆法（`syncEngine ↔ sessionCache ↔ sseManager` 循环）。
- `.planning/phases/07-wire-contracts-unification-sse-patch-contract/07-CONTEXT.md` — **D-119 `SyncEventSchema` + `SyncEvent` type 在 shared 唯一来源**（D-133 直接消费 P7 这条成果）；D-114 hub HTTP response wrapper 上提 shared（本 phase routes 拆分受益于此 —— 4 子文件都用 shared 的 `SessionsResponse / SessionResponse / SessionAccessResponse`）；D-125 4 切片每片 typecheck+test 绿模板。

### Codebase Maps

- `.planning/codebase/ARCHITECTURE.md` — hub 三大子系统（HTTP / Socket.IO / SSE）的边界与 SyncEngine 在中间的位置 —— Phase 8 拆分要保持这三个出口（routes / socket handlers / sseManager）对 SyncEngine 的调用接口不变。
- `.planning/codebase/STRUCTURE.md` §「hub/src/sync/」§「hub/src/web/」§「hub/src/sse/」§「hub/src/notifications/」§「hub/src/socket/」— 拆分前的目录拓扑。
- `.planning/codebase/STACK.md` — Hono / better-sqlite3 / Socket.IO / Zod 版本；`HTTPException` 来源于 `hono/http-exception`（D-137 `ApiRouteError` extends 锚点）。
- `.planning/codebase/CONCERNS.md` — `sessionCache.ts` 796 行 / `syncEngine.ts` 854 行 / `routes/sessions.ts` 多职责被点名（即本 phase 的清单来源）。

### 本 phase 直接相关源码 / 调用点

**hub/src/sync/（SessionCache + SyncEngine 拆分主战场）：**

- `hub/src/sync/sessionCache.ts:11-693`（774 行）— 拆为 4 个 service + facade（D-129）。方法簇映射见 In scope。
- `hub/src/sync/syncEngine.ts`（722 行）— 拆为 4 个 sub-facade + lifecycle owner（D-132）；`:81` inactivityTimer 改走 scheduler（D-138）。
- `hub/src/sync/eventPublisher.ts` / `messageService.ts` / `rpcGateway.ts` / `machineCache.ts` / `teams.ts` / `backgroundTasks.ts` / `todos.ts` — 不动（D-144），但被新拆 sub-facade 引用关系会改 import path（researcher 列清单）。
- `hub/src/sync/sessionCache.test.ts` / `sessionModel.test.ts` — case 按 service 拆，分到 `sessionRepository.test.ts` / `sessionLivenessService.test.ts` / `sessionConfigService.test.ts` / `sessionMergeService.test.ts`；原文件保留 facade smoke。

**hub/src/sse/（SyncEvent type 切 shared）：**

- `hub/src/sse/sseManager.ts:1` — `import type { SyncEvent } from '../sync/syncEngine'` → `from '@hapi/protocol/types'`（D-133）；`:124` heartbeatTimer 改走 scheduler（D-138）。
- `hub/src/sse/sseManager.test.ts:3` — 同步切 import。

**hub/src/web/（routes 拆分 + helper + ApiRouteError）：**

- `hub/src/web/routes/sessions.ts`（467 行）— 删除原文件，按 lifecycle / config / upload / read 切到 `hub/src/web/routes/sessions/{lifecycle,config,upload,read,index}.ts`（D-135）。
- `hub/src/web/middleware/auth.ts` — 既有 middleware 文件；新 helper（`withEngine` / `withSession` / `withActiveSession` / `withMachine` / `parseJsonBody`）可放此目录或新建 `hub/src/web/middleware/route-helpers.ts`（researcher 选）。
- `hub/src/web/server.ts::createWebApp` — 注册 `app.onError(apiRouteErrorHandler)`（D-137）；`app.route('/api', createSessionsRoutes(...))` 调用签名不变。
- `hub/src/web/types.ts`（或 `WebAppEnv` 定义处）— 扩 `Variables` 加 `engine` / `session` / `machine` / `body` 字段（D-136）。
- `hub/src/web/routes/sessions.test.ts` — 按 4 子文件拆测试；新增 `apiRouteError.test.ts`。

**hub/src/socket/、hub/src/notifications/（timer 接入 scheduler）：**

- `hub/src/socket/terminalRegistry.ts:122` — idle `setTimeout` 改 `scheduler.afterMs`（D-138）；构造器加 `scheduler` 参数。
- `hub/src/notifications/notificationHub.ts:131` — notify `setTimeout` 改 `scheduler.afterMs`；构造器加 `scheduler` 参数。
- `hub/src/socket/terminalRegistry.test.ts` / `hub/src/notifications/notificationHub.test.ts` — 测试 fixture 注入 mock scheduler。

**hub/src/utils/、hub/src/index.ts（scheduler 新建 + 主入口接入）：**

- `hub/src/utils/scheduler.ts`（新文件）— `KeepaliveScheduler` 类 + 接口（D-138）。
- `hub/src/utils/scheduler.test.ts`（新文件）— shutdown / cancel / dup-name 测试（D-141）。
- `hub/src/index.ts` — 主入口加 `new KeepaliveScheduler()` 单例；注入 SyncEngine / SSEManager / TerminalRegistry / NotificationHub 构造器；`process.on('SIGINT'|'SIGTERM', shutdown)` 注册（D-139~D-141）。
- `hub/src/index.test.ts` 或 `hub/src/shutdown.test.ts`（新文件）— SIGINT handler 单元测（D-141）。

**guard / scripts：**

- `scripts/check-no-cut-agents.sh` — 追加 Phase 8 D-143 关键词扫描 block（`hub/src/sse/` 内 SyncEngine import 零容忍 + `hub/src/{sse,sync,socket,notifications}/` 内 setInterval/setTimeout 零容忍 + scheduler / promise-sleep 白名单注释锚定）。
- `scripts/check-no-circular-hub.sh`（新文件，可选；planner 决定是否独立脚本）— `npx madge --circular --extensions ts,tsx hub/src/` + 输出过滤 + 退出码语义化。

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- `hub/src/sync/sessionCache.ts` 方法已自然分四簇（getters/refresh / liveness-event / config-mutation / merge-flow），切割线清晰；4 service 拆分**几乎是 mechanical move**，不重写业务逻辑。
- `hub/src/sync/syncEngine.ts` 已经是「外部入口 + 一堆 sub-area 方法」结构，按职责拆 sub-facade 同样是 mechanical move。
- `hub/src/web/routes/sessions.ts` 17 个 handler **路径前缀全部以 `/sessions/:id/...` 开头**，按 HTTP verb / 业务动作做 grouping 没有歧义（lifecycle / config / upload / read 4 类边界清晰）。
- Hono 已自带 `HTTPException`（`hono/http-exception`），`ApiRouteError` 继承零依赖新增。
- Hono `app.route('/path', subApp)` 是官方推荐的 router 拼装方式（既有 `app.route('/api', createSessionsRoutes(...))` 同款），4 子文件用 `app.route('/', sub)` 拼回 `createSessionsRoutes` 入口零样板。
- `hub/src/web/middleware/auth.ts` 是既有 Hono middleware 范例，新 helper 直接复用此 idiom（`c.set(key, value)` + `await next()` + 失败 `throw`）。
- P6/P7 模板：4 切片节奏、ripgrep + madge guard sweep、no shim / feature-flag 一次切干净 —— 本 phase 直接复用 D-142~D-143 模板。

### Established Patterns

- 拆分型 phase：「单一职责 + facade 锁定 surface area + ripgrep 验收文件大小 / 命名 / import 拓扑」（P6 SessionContext/LocalAdapter/RemoteAdapter 拆 cli/cursor 同款），no feature flag / no shim / no double API period。
- `shared/` 是 wire / type / 跨端共享语义唯一来源（P7 D-119 落地）—— 本 phase D-133 兑现 hub-sse 这条最后的反向依赖。
- 类型 narrow / 接口 narrow 让 TS 编译器暴露所有调用点 —— SessionCache facade 公开方法签名不变 = 调用点零改动；SyncEngine sub-facade 直通 delegate = 调用点零改动；新 helper middleware 类型扩 `WebAppEnv['Variables']` = 路由 handler 内 `c.get('session')` 自动 narrow。
- 切片每片绿色：`bun typecheck` + `bun run test` 全包；最后切片追加 ripgrep + madge guard（P6 D-107 / P7 D-125 节奏一致）。
- DI 注入显式依赖（scheduler 单例传构造器）= P10 REFC-02 方向预对齐；本 phase 不全面 DI 化，只对 scheduler 这条新依赖落地。
- 一次性 promise sleep（`setTimeout(resolve, ms)`）与 recurring keepalive timer 语义区分 = 显式 vs 隐式调度的区分 —— 与 P3 D-41「显式失败 vs silent fallback」同源「显式 vs 隐式」精神。

### Integration Points

- **routes / socket handlers → SyncEngine**：本 phase 不动 SyncEngine 公开方法名；上游零改动。
- **SyncEngine → SessionCache facade**：facade 公开方法名零变化；4 service 是 facade 内部 composition 实现细节。
- **SyncEngine / SSEManager / TerminalRegistry / NotificationHub 构造器 ← KeepaliveScheduler**：本 phase 新增的唯一 DI 注入边界。
- **`hub/src/index.ts` 主入口**：新增 `scheduler` 单例 + `process.on('SIGINT'/'SIGTERM')` 钩子；既有 wiring 顺序不动。
- **`hub/src/web/server.ts::createWebApp`**：新增 `app.onError(apiRouteErrorHandler)`；`createSessionsRoutes` 调用签名不变。
- **shared/ ← hub/src/sse/**：`SyncEvent` type import 路径切换（P7 已有该 type，本 phase 是 hub 侧消费切换）。
- **Store / better-sqlite3 transaction**：不动。sessionMergeService 内部仍按既有 transaction 粒度调用。

</code_context>

<specifics>
## Specific Ideas

- `hub/src/sync/sessionCache.ts:11-693` 的 4 service 拆分边界，按 method-name prefix 已经天然对齐（`get*` + `getOrCreate*` + `refresh*` + `resolve*` → repository；`handle*` + `mark*` + `apply*` + `record*` + `expire*` → liveness；`apply*Config` + `rename*` + `delete*` → config；`merge*` + `extract*` + `deduplicate*` → merge）。researcher 不需要重新设计边界，按方法名簇即可。
- `hub/src/sse/sseManager.ts:1` 这一行 `import type { SyncEvent } from '../sync/syncEngine'` 是 madge 报的 `sync/syncEngine.ts > sse/sseManager.ts` 1 环的**唯一**根因；改成 `from '@hapi/protocol/types'` 后 madge 立即降到 0 环（前提是 P7 的 `SyncEvent` 类型导出已稳定在 `shared/src/types.ts`）。SC#2 + SC#5 一举两得。
- `KeepaliveScheduler.name` 字段 + dev 模式 `console.debug` 在 SIGINT 时输出 cancel list 是个简单调试辅助 —— Tailscale + 长 idle 场景下 timer 泄漏 root cause 通常很难定位，这条小工具收益高（D-138 推荐保留）。
- `hub/src/index.ts` 主入口的 `process.on('SIGINT'|'SIGTERM')` 是否已有既有 handler，researcher 在 Slice 2 开始前 ripgrep 确认 —— 如果已有，本 phase 在既有 handler 内插 `scheduler.shutdown()` 调用，**不**重复注册（避免 listener 累积）。
- Hono `HTTPException` 的 `status` 字段是 `ContentfulStatusCode`（200–599 numeric），`ApiRouteError extends HTTPException` 时把 `code: string` 作为新增字段；`app.onError` 中 `if (err instanceof ApiRouteError)` 分支取 `err.status` + `err.code` + `err.details` 拼 JSON。
- `web/routes/sessions.ts` 17 个 handler 里 `POST /:id/upload` 与 `POST /:id/upload/delete`（D-135 upload 子文件）是当前唯一处理 multipart / binary body 的两条路径；它们不走 `parseJsonBody`，研究 helper 设计时不要把 multipart 也塞进 `parseJsonBody` 抽象。
- `hub/src/sync/syncEngine.ts:81` inactivityTimer 周期 5_000ms 是 hub-内 session active 状态过期检查；切到 scheduler 时 interval 值原样保留（不调参数语义）。
- `hub/src/sync/syncEngine.ts:645,657` 两处 `setTimeout(resolve, 250)` 是 `await new Promise(resolve => setTimeout(resolve, 250))` retry sleep 形态，**不入** scheduler（D-138 + D-143 白名单），但 guard 脚本里要加 line-anchored 注释锚（如 `// scheduler-exempt: promise-sleep retry`）让 ripgrep 跳过。
- madge 在仓库根跑会吃 `web/dist/` 的 60+ 环（mermaid bundle）—— 实测过，本 phase guard 必须 `cd hub` 跑或 `--exclude` 过滤。`scripts/check-no-circular-hub.sh` 可独立封装。

</specifics>

<deferred>
## Deferred Ideas

- **REFW-01 / REFW-02 / REFW-03 web 内部解耦（ToolCard 循环、oversized files、util 上提到 shared）** —— **Phase 9**。本 phase 不动 `web/src/`。
- **REFC-01：SQLite 运行时迁移代码全删 + schema-version mismatch reject + 离线迁移工具入口** —— **Phase 10**。本 phase 不动 Store schema、不动 migration 文件。
- **REFC-02：`loadConfig()` 返回 `Readonly<...>` + DI 取代 `_setApiUrl()` setter** —— **Phase 10**。本 phase scheduler DI 注入是预对齐，但不全面 DI 化（不动 config singleton / 不动其它子系统的构造器 surface）。
- **REFT-01 cursor permission-mode → CLI flag 完整矩阵测试** —— **Phase 11**。
- **REFT-02 SSE reconnect / patch-loss 不变量测试** —— **Phase 11**。本 phase scheduler 的 SIGINT 测试不替代 SSE reconnect 不变量测试（不同领域）。
- **REFT-03 auth 路由 negative cases（bad token / 过期 JWT / replayed JWT / 空 body）** —— **Phase 11**。`ApiRouteError` 的引入让 auth 路由统一 JSON shape 顺手就绪，但 negative case 覆盖留 P11。
- **SessionCache facade 最终删除（直接暴露 4 个 service 给 SyncEngine）** —— **Phase 12 verification 阶段评估**（D-130）。本 phase 保留 facade 锁 surface area。
- **`hub/src/sync/syncEngine.ts:645,657` 两处 retry promise sleep 抽象为 `retryWithDelay(fn, opts)` util** —— 不收敛，本 phase 仅在 guard 中加白名单注释锚。未来如果 retry 模式扩散，可单独 phase 抽 util。
- **既有 `hub/src/web/middleware/auth.ts` 与新 route helper 是否合并到统一 middleware 命名规范** —— researcher 在 Slice 3 决定（合并 vs 平行），不强制本 phase 收敛。
- **SyncEngine / SSEManager / TerminalRegistry / NotificationHub 全面 DI 化（不仅 scheduler 一条依赖）** —— **Phase 10** REFC-02 整体方向；本 phase 仅 scheduler 一条注入。
- **`hub/src/notifications/` 的 channel 拓扑重整（pushService / pushNotificationChannel 等）** —— 不在 v1 milestone 范围；如有需要进 v2 backlog。
- **README / AGENTS / docs / website prose 中提到「SyncEngine 是一个大类」之类的过时描述清理** —— **Phase 12 (CUT-12)**。本 phase 只动源码 + 测试 + guard 脚本。

</deferred>

---

*Phase: 8-Hub internal decoupling*
*Context gathered: 2026-05-22*
