# Phase 3: cut-multi-user-namespace-isolation - Context

**Gathered:** 2026-05-21
**Status:** Ready for planning

> **承接 Phase 1/2 决策（不再问）：** 继续沿用「最小切除」、No backward compatibility、源码关键词零容忍、按可 bisect 的小提交推进、每个提交单独跑 `bun typecheck` + `bun run test` 的工作方式。本 phase 只决定 namespace 切除边界，不借机做 Phase 8/10/11 的重构。

<domain>
## Phase Boundary

Phase 3 交付的是：Hub 把所有 CLI/Web 连接视为同一个 owner，`namespace` 不再是协议、鉴权、Socket.IO、SSE、SQLite store、cache 或测试 fixture 的一部分。

**In scope（Phase 3 必须完成）：** CUT-09。删除 `CLI_API_TOKEN:<namespace>` 后缀语法、JWT `ns` 字段、`socket.data.namespace`、namespace-aware cache/store 方法、SQLite namespace 列/索引/查询、`users.platform` 多平台绑定形态，以及相关测试 fixture。

**Out of scope：**
- Auth negative-case 矩阵（bad token、expired/replayed JWT、empty body）——Phase 11 (REFT-03)
- Hub route helper / `ApiRouteError` 抽象——Phase 8 (REFH-03)
- Runtime SQLite migration ladder 总清理——Phase 10 (REFC-01)
- Token rotation / revocation / rate limiting——永久或后续安全专项；当前单人 Tailscale 场景不引入
- 文档站与营销文案中的历史 namespace 提及——Phase 12 (CUT-12 / VRFY-03)

</domain>

<decisions>
## Implementation Decisions

### 1. Token / JWT / middleware 契约收敛

- **D-34：`CLI_API_TOKEN` 是单个 opaque secret。** `parseAccessToken()` 不再按 `:` 拆分，不返回 `baseToken + namespace`；`foo:bar` 这种 token 字符串本身就是完整 token，必须 constant-time compare 整串。
- **D-35：JWT payload 保留 owner 身份，删除 namespace。** `/api/auth` 继续用 `getOrCreateOwnerId()` 生成 `uid`，但 `SignJWT({ uid, ns })` 收敛为只签 `{ uid }`；`hub/src/web/middleware/auth.ts` 和 terminal Socket.IO JWT parser 同步删除 `ns` schema 与 `c.set('namespace')` / `socket.data.namespace`。
- **D-36：Web/Hono env 不再暴露 namespace。** `WebAppEnv` variables 只保留 `userId`（以及未来 route 真正需要的变量）；route handlers 不再从 `c.get('namespace')` 取作用域。
- **D-37：不保留 `DEFAULT_NAMESPACE` 兼容常量。** 没有 `default` namespace fallback、没有隐藏 shim、没有 deprecated parsing branch。

### 2. SQLite / Store / User 表处理

- **D-38：sessions / machines / push_subscriptions 物理去 namespace。** 删除表 schema 中的 `namespace` 列、namespace indexes、`UNIQUE(namespace, endpoint)` 这类约束，改为单人语义下的唯一约束（例如 push endpoint 直接唯一）。
- **D-39：store API 删除 namespace 参数。** `getSessionsByNamespace` / `getMachineByNamespace` / `resolveSessionAccess(sessionId, namespace)` / `deleteSession(id, namespace)` 等方法收敛为无 namespace 版本；access-denied because namespace mismatch 这个错误分支删除。
- **D-40：UserStore / users 表整条删除，除非 research 发现仍有非 Telegram 活用。** Phase 2 已删 Telegram bind/auth，owner 身份由 `hub/src/config/ownerId.ts` 负责；当前 `users.platform/platform_user_id/namespace` 形态是多平台绑定残留，不应收敛成一个新抽象。
- **D-41：schema 处理走“新 schema + 离线迁移入口”，不加 runtime 兼容迁移。** 本 phase 可以为 CUT-09 提供窄范围 offline migration entry（按 ROADMAP SC#4），但 `Store` 启动路径不新增“旧 namespace schema 自动升级”的兼容逻辑；Phase 10 仍负责清理整个 runtime migration ladder。

### 3. Cache / Sync / SSE / Socket.IO 路由

- **D-42：SyncEvent 删除 `namespace` 字段。** `shared/src/schemas.ts` 的 `SessionEventBaseSchema.namespace`、`EventPublisher.resolveNamespace()`、`SyncEngine.resolveNamespace()` 这条链路删除；事件不再被 enrichment 成 `{ ...event, namespace }`。
- **D-43：SSE 保留 session/machine 相关性过滤，不再 namespace 过滤。** `SSESubscription` 不含 namespace；`broadcast()` 对 `message-received` 仍可按 `sessionId` 过滤，对 machine/session detail 订阅仍按 id 过滤，`connection-changed` 继续全局发送。
- **D-44：Socket.IO `/cli` 鉴权只验证 token，不写 namespace。** CLI socket data 删除 namespace；CLI handlers 调 `getOrCreateSession` / `getOrCreateMachine` 时不再传 namespace。
- **D-45：Terminal access 只检查 session 是否存在/active，不做 namespace mismatch。** `/terminal` JWT 只验证 `uid`；terminal open/ready/write path 不再产生 `namespace-missing` / namespace access-denied。

### 4. 执行切片与验证

- **D-46：推荐 4 个 commits。**
  1. `feat(phase-03): remove namespace from auth contract` — `accessToken` parsing、JWT payload、web middleware、Socket.IO auth/socket data、相关 auth/socket tests
  2. `feat(phase-03): collapse namespace-scoped store and cache` — sessions/machines/push/users schema + store APIs + `SessionCache`/`MachineCache`/`SyncEngine` namespace method cleanup
  3. `feat(phase-03): remove namespace event routing` — `SyncEvent` schema、`EventPublisher`、`SSEManager`、routes、terminal/push/message/session handlers
  4. `chore(phase-03): update tests and namespace guard` — test fixtures、deleted namespace tests、ripgrep guard keyword `namespace|:ns` with explicit whitelist, `bun.lock` only if needed
- **D-47：每个 commit 单独通过 `bun typecheck` + `bun run test`。** 如果某个 commit 必须暂时破坏测试才能跨协议边界，planner 要重新拆分，不能把红灯留到最终清理。
- **D-48：ripgrep 零容忍范围 = `cli/src/` / `hub/src/` / `web/src/` / `shared/src/`。** 本 phase 关键词为 `namespace` / `:ns`；白名单只允许 `.planning/codebase/`、`CHANGELOG.md`、必要历史 docs，和 planner 明确说明的 false positive（例如 unrelated `process.platform` 不算）。

### Claude's Discretion

- 用户明确选择“按照推荐做决定”。Planner/researcher 可自行决定具体函数命名（例如 `getSessions()` 是否直接替代 `getSessionsByNamespace()`）、测试文件拆分、offline migration entry 的文件名/位置，但不得保留 namespace shim 或 default namespace 兼容层。
- 如 research 发现 `users` 表仍被某个非 Telegram 活路径使用，优先把该路径改到 owner config / JWT `uid`，只有在删除不可行时才保留最小 owner-only 数据结构，并在 PLAN 中显式解释。

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 项目宪法

- `.planning/PROJECT.md` — 单人 Tailscale + Cursor-only 定位；明确“不做多用户 / namespace 隔离”
- `.planning/REQUIREMENTS.md` — CUT-09 映射到 Phase 3；Phase 11/12 边界防止测试/文档 scope creep
- `.planning/ROADMAP.md` §「Phase 3: Cut multi-user namespace isolation」— success criteria #1-#5 是本 phase 验收锚点
- `AGENTS.md` — No backward compatibility、Bun workspace、TypeScript strict、4 空格缩进

### Prior Phase Decisions

- `.planning/phases/01-cut-non-cursor-agents/01-CONTEXT.md` — D-01 最小切除、D-11~D-13 ripgrep 零容忍 + 白名单、D-14/D-15 commit/test 节奏
- `.planning/phases/02-cut-external-integration-channels/02-CONTEXT.md` — D-24 auth 收敛、D-25 auth negative tests 留 Phase 11、D-30/D-31 小提交 + per-commit test、D-32 settings 不加兼容 passthrough

### Codebase Maps

- `.planning/codebase/ARCHITECTURE.md` — 当前架构图明确 CLI auth 使用 `CLI_API_TOKEN[:ns]`，SSE/EventPublisher/Store 以 namespace 分流
- `.planning/codebase/STACK.md` — Bun/Socket.IO/Hono/JWT/Zod/SQLite 技术栈与命令
- `.planning/codebase/CONCERNS.md` — namespace 是单 token 多租户残留；auth negative tests 与 route helper 属后续 phase

### 本 phase 直接相关源码

- `hub/src/utils/accessToken.ts` — `DEFAULT_NAMESPACE`、`parseAccessToken()` 后缀解析删除目标
- `hub/src/web/routes/auth.ts` — JWT `ns` 删除；`parsedToken.namespace` 删除
- `hub/src/web/middleware/auth.ts` — `WebAppEnv.namespace`、JWT payload `ns` 删除
- `hub/src/socket/server.ts` — CLI socket `socket.data.namespace`、terminal JWT `ns` 删除
- `hub/src/socket/socketTypes.ts`、`hub/src/socket/handlers/cli/*.ts`、`hub/src/socket/handlers/terminal.ts` — socket data / handler namespace 参数清理
- `hub/src/sync/{syncEngine,sessionCache,machineCache,eventPublisher}.ts` — namespace-scoped cache methods、event namespace resolution 删除
- `hub/src/sse/sseManager.ts` — subscription namespace 与 broadcast namespace filtering 删除
- `hub/src/web/routes/{sessions,machines,events,push,cli,guards}.ts` — route-level `c.get('namespace')` 删除
- `hub/src/store/{index,types,sessions,machines,pushSubscriptions,pushStore,users,userStore,sessionStore,machineStore,versionedUpdates}.ts` — schema/store namespace columns, queries, method signatures, users table cleanup
- `shared/src/{schemas,socket}.ts` — `Session.namespace` / `SyncEvent.namespace` / `SocketErrorReason` namespace variants 删除
- `cli/src/api/{api,types}.ts` — token/header assumptions and namespace-shaped API types cleanup
- `hub/src/**/*namespace*.test.ts` and namespace-bearing tests — delete or rewrite fixtures to owner-only/session-only semantics

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- `hub/src/config/ownerId.ts` — owner identity source for JWT `uid`; replaces any need for `users` table owner lookup
- Existing JWT middleware in `hub/src/web/middleware/auth.ts` — keep bearer-token shape; only narrow payload schema
- Existing `SSEManager` sessionId/machineId filters — keep these relevance filters after namespace removal
- Existing Phase 1/2 ripgrep guard approach — extend with namespace terms rather than inventing a new verification system

### Established Patterns

- Hub route handlers currently read `namespace` from Hono context and call `SyncEngine.*ByNamespace`; this should collapse to plain `getSessions()` / `getMachine()` / `resolveSessionAccess(sessionId)`
- Store layer wraps raw SQL modules with small classes (`SessionStore`, `MachineStore`, `PushStore`, `UserStore`); remove namespace at both class signature and SQL helper levels
- Shared schemas are source of truth for runtime validation; removing `Session.namespace` and event namespace must happen in `shared/` and then propagate to hub/cli/web tests
- SQLite startup already rejects schema mismatches; do not add a new runtime compatibility branch for namespace removal

### Integration Points

- **Auth:** `hub/src/utils/accessToken.ts` → `hub/src/web/routes/auth.ts` → JWT → `hub/src/web/middleware/auth.ts`
- **CLI socket:** `hub/src/socket/server.ts` authenticates CLI token and passes socket data into `hub/src/socket/handlers/cli/`
- **Session/machine state:** CLI socket handlers call `SyncEngine`, which delegates to `SessionCache` / `MachineCache` / Store
- **Realtime fan-out:** `EventPublisher` enriches events with namespace and `SSEManager` filters by namespace; both sides must be changed together
- **Persistence:** `Store.createSchema()` and SQL helpers define the durable namespace shape; tests under `hub/src/store/` are likely the highest-signal regression checks

</code_context>

<specifics>
## Specific Ideas

- Preferred implementation style is deletion-first: remove the namespace field from types/schemas, let TypeScript expose all callsites, then fix callsites by collapsing to owner-only/session-only semantics.
- Do not rename unrelated `process.platform` / UI “platform” concepts. CUT-09 targets `users.platform` and namespace-aware user binding, not browser/device platform detection.
- `SocketErrorReason = 'namespace-missing' | 'access-denied' | 'not-found'` should likely drop `namespace-missing`; `access-denied` may remain only if there is another real authorization branch after namespace removal.
- `connection-changed` events can stay globally visible because there is only one owner.
- If push subscriptions currently use `UNIQUE(namespace, endpoint)`, collapse to `UNIQUE(endpoint)`; duplicate cleanup belongs in the offline migration entry, not runtime hot path.

</specifics>

<deferred>
## Deferred Ideas

- **Auth negative-case tests** — Phase 11 (REFT-03)
- **Route helper / API error unification** — Phase 8 (REFH-03)
- **Full runtime migration cleanup** — Phase 10 (REFC-01)
- **Docs/website historical namespace cleanup** — Phase 12 (CUT-12 / VRFY-03)
- **Token rotation / per-device revocation / rate limiting** — out of scope for single-user Tailscale v1

</deferred>

---

*Phase: 03-cut-multi-user-namespace-isolation*
*Context gathered: 2026-05-21*
