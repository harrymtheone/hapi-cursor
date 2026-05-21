# Phase 03: cut-multi-user-namespace-isolation - Research

**Researched:** 2026-05-21
**Domain:** TypeScript/Bun auth contract, Socket.IO routing, Hono routes, SSE fan-out, SQLite schema/store cleanup
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### 1. Token / JWT / middleware 契约收敛

- **D-34：`CLI_API_TOKEN` 是单个 opaque secret。** `parseAccessToken()` 不再按 `:` 拆分，不返回 `baseToken + namespace`；`foo:bar` 这种 token 字符串本身就是完整 token，必须 constant-time compare 整串。
- **D-35：JWT payload 保留 owner 身份，删除 namespace。** `/api/auth` 继续用 `getOrCreateOwnerId()` 生成 `uid`，但 `SignJWT({ uid, ns })` 收敛为只签 `{ uid }`；`hub/src/web/middleware/auth.ts` 和 terminal Socket.IO JWT parser 同步删除 `ns` schema 与 `c.set('namespace')` / `socket.data.namespace`。
- **D-36：Web/Hono env 不再暴露 namespace。** `WebAppEnv` variables 只保留 `userId`（以及未来 route 真正需要的变量）；route handlers 不再从 `c.get('namespace')` 取作用域。
- **D-37：不保留 `DEFAULT_NAMESPACE` 兼容常量。** 没有 `default` namespace fallback、没有隐藏 shim、没有 deprecated parsing branch。

#### 2. SQLite / Store / User 表处理

- **D-38：sessions / machines / push_subscriptions 物理去 namespace。** 删除表 schema 中的 `namespace` 列、namespace indexes、`UNIQUE(namespace, endpoint)` 这类约束，改为单人语义下的唯一约束（例如 push endpoint 直接唯一）。
- **D-39：store API 删除 namespace 参数。** `getSessionsByNamespace` / `getMachineByNamespace` / `resolveSessionAccess(sessionId, namespace)` / `deleteSession(id, namespace)` 等方法收敛为无 namespace 版本；access-denied because namespace mismatch 这个错误分支删除。
- **D-40：UserStore / users 表整条删除，除非 research 发现仍有非 Telegram 活用。** Phase 2 已删 Telegram bind/auth，owner 身份由 `hub/src/config/ownerId.ts` 负责；当前 `users.platform/platform_user_id/namespace` 形态是多平台绑定残留，不应收敛成一个新抽象。
- **D-41：schema 处理走“新 schema + 离线迁移入口”，不加 runtime 兼容迁移。** 本 phase 可以为 CUT-09 提供窄范围 offline migration entry（按 ROADMAP SC#4），但 `Store` 启动路径不新增“旧 namespace schema 自动升级”的兼容逻辑；Phase 10 仍负责清理整个 runtime migration ladder。

#### 3. Cache / Sync / SSE / Socket.IO 路由

- **D-42：SyncEvent 删除 `namespace` 字段。** `shared/src/schemas.ts` 的 `SessionEventBaseSchema.namespace`、`EventPublisher.resolveNamespace()`、`SyncEngine.resolveNamespace()` 这条链路删除；事件不再被 enrichment 成 `{ ...event, namespace }`。
- **D-43：SSE 保留 session/machine 相关性过滤，不再 namespace 过滤。** `SSESubscription` 不含 namespace；`broadcast()` 对 `message-received` 仍可按 `sessionId` 过滤，对 machine/session detail 订阅仍按 id 过滤，`connection-changed` 继续全局发送。
- **D-44：Socket.IO `/cli` 鉴权只验证 token，不写 namespace。** CLI socket data 删除 namespace；CLI handlers 调 `getOrCreateSession` / `getOrCreateMachine` 时不再传 namespace。
- **D-45：Terminal access 只检查 session 是否存在/active，不做 namespace mismatch。** `/terminal` JWT 只验证 `uid`；terminal open/ready/write path 不再产生 `namespace-missing` / namespace access-denied。

#### 4. 执行切片与验证

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

### Deferred Ideas (OUT OF SCOPE)

- **Auth negative-case tests** — Phase 11 (REFT-03)
- **Route helper / API error unification** — Phase 8 (REFH-03)
- **Full runtime migration cleanup** — Phase 10 (REFC-01)
- **Docs/website historical namespace cleanup** — Phase 12 (CUT-12 / VRFY-03)
- **Token rotation / per-device revocation / rate limiting** — out of scope for single-user Tailscale v1
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CUT-09 | 删除 namespace 多用户隔离：`CLI_API_TOKEN:<namespace>` 后缀语法、user 表 platform 字段、所有 namespace-aware 缓存键、相关测试。 | 当前 `namespace` 分布已由 `rg` 定位到 `hub/src`、`shared/src`、`cli/src`、`web/src` 的 auth/socket/store/cache/SSE/test surface；`users` 活用检查显示只有 store 自身引用，支持按 D-40 删除整条 store/table。 [VERIFIED: codebase rg] |
</phase_requirements>

## Summary

Phase 03 是删除协议维度的迁移，不需要引入新依赖；标准做法是从 wire/schema 类型源头删除 `namespace`，让 TypeScript 暴露所有调用点，再按 auth → store/cache → event routing → tests/guard 的顺序收敛。当前 `namespace` 不只是字段名，它同时参与 token parsing、JWT payload、Hono context variables、Socket.IO socket data、SQLite schema/index/queries、versioned update helper、SSE subscription filtering、terminal access 判断和测试 fixture。 [VERIFIED: codebase read + rg]

最重要的实现边界：`CLI_API_TOKEN` 必须成为整串 opaque secret；因此不仅要改 `hub/src/utils/accessToken.ts`，还要删除 `hub/src/config/cliApiToken.ts` 里“token 不能包含 `:`”的校验，否则 `foo:bar` 仍会被配置层拒绝，违背 D-34。 [VERIFIED: codebase read]

**Primary recommendation:** deletion-first：先删除 shared/session/event/socket 中的 namespace 类型，再修 hub store/cache/routes/socket，再清 CLI mirror 和 tests，最后扩展 `scripts/check-no-cut-agents.sh` 的 guard。 [VERIFIED: codebase structure]

## Project Constraints (from .cursor/rules/)

- `.cursor/rules/` 不存在；无额外 workspace rules。 [VERIFIED: Glob]
- `AGENTS.md` 约束：Bun workspaces；TypeScript strict；4 空格缩进；Zod 做 runtime validation；No backward compatibility；必要测试即可；从 repo root 运行 `bun typecheck` / `bun run test`。 [VERIFIED: AGENTS.md]
- 项目内 `.claude/skills/` 与 `.agents/skills/` 不存在；无 project-defined skills 需要套用。 [VERIFIED: Glob]

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Opaque CLI token authentication | API / Backend | CLI config | Hub owns token validation and constant-time compare; CLI only forwards configured token as bearer/socket auth secret. [VERIFIED: `hub/src/web/routes/auth.ts`, `hub/src/socket/server.ts`, `cli/src/api/auth.ts`] |
| Web JWT identity | API / Backend | Browser / Client | Hub signs and verifies `{ uid }`; browser stores/uses token but should not receive namespace-scoped claims. [VERIFIED: `hub/src/web/routes/auth.ts`, `hub/src/web/middleware/auth.ts`] |
| CLI Socket.IO session/machine registration | API / Backend | CLI runtime | Hub authenticates `/cli`, joins session/machine rooms, and calls store/cache; CLI sends `sessionId`/`machineId` but should not carry namespace. [VERIFIED: `hub/src/socket/server.ts`, `hub/src/socket/handlers/cli/index.ts`] |
| Store/cache ownership | Database / Storage | API / Backend | SQLite schema and store methods currently scope sessions/machines/push by namespace; single-owner semantics belong in one physical schema with direct primary-key lookup. [VERIFIED: `hub/src/store/index.ts`, `hub/src/store/sessions.ts`, `hub/src/store/machines.ts`, `hub/src/store/pushSubscriptions.ts`] |
| SSE fan-out relevance | API / Backend | Browser / Client | Server should keep sessionId/machineId/all filters and remove namespace filtering; clients already subscribe by all/session/machine query shape. [VERIFIED: `hub/src/sse/sseManager.ts`, `hub/src/web/routes/events.ts`] |
| Terminal session access | API / Backend | Browser / CLI sockets | Terminal socket should validate JWT uid and session active/exists, then route through session room; namespace mismatch checks are obsolete. [VERIFIED: `hub/src/socket/handlers/terminal.ts`, `hub/src/socket/server.ts`] |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Bun | 1.3.14 installed | Runtime, workspace scripts, `bun:test`, `bun:sqlite`. | Repo scripts and hub store use Bun directly; no replacement required. [VERIFIED: env probe + `package.json` + `hub/src/store/index.ts`] |
| TypeScript | `^5` in workspaces | Strict compile gate. | `bun typecheck` is Phase SC#1 and AGENTS command. [VERIFIED: package.json] |
| Hono | `^4.11.2` declared; registry latest 4.12.21 modified 2026-05-19 | Web API routes/middleware. | Existing hub routes use Hono context variables and middleware; keep Hono, narrow `WebAppEnv`. [VERIFIED: npm registry + `hub/package.json` + codebase] |
| jose | `^6.1.3` declared; registry latest 6.2.3 modified 2026-04-27 | `SignJWT` / `jwtVerify`. | Existing JWT contract uses jose; phase only removes `ns` from payload. [VERIFIED: npm registry + `hub/package.json` + codebase] |
| socket.io | `^4.8.3` declared; registry latest 4.8.3 modified 2025-12-23 | `/cli` and `/terminal` namespaces. | Existing socket namespaces stay; only `SocketData.namespace` and checks are deleted. [VERIFIED: npm registry + `hub/package.json` + codebase] |
| Zod | `^4.2.1` declared; registry latest 4.4.3 modified 2026-05-04 | Runtime payload schemas. | Shared schemas and route bodies use Zod; remove `namespace` fields at schema source. [VERIFIED: npm registry + package.json + codebase] |
| Vitest / Bun test | Vitest `^4.0.16` in CLI; hub uses `bun test`; registry latest Vitest 4.1.7 modified 2026-05-20 | Automated tests. | Repo already has package-level test scripts; no test framework change. [VERIFIED: npm registry + package.json] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `bun:sqlite` | Bun built-in | SQLite store, schema migration tests. | Continue using existing store; planner should not introduce another DB/migration dependency. [VERIFIED: `hub/src/store/index.ts`] |
| ripgrep (`rg`) | available | Final zero-keyword guard. | Extend existing guard script with `namespace|:ns` and explicit whitelist. [VERIFIED: env probe + `scripts/check-no-cut-agents.sh`] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Existing store functions | New repository abstraction | Out of scope; Phase 8 owns hub route/helper and sync refactors. [VERIFIED: CONTEXT D-41 / Deferred Ideas] |
| Existing runtime schema init | Runtime compatibility migration | Explicitly forbidden by D-41; use new schema plus offline migration entry only. [VERIFIED: CONTEXT D-41] |
| Existing Hono context | New auth/session helper | Out of scope; Phase 8 owns route helper abstraction. [VERIFIED: CONTEXT Deferred Ideas] |

**Installation:** no new packages. [VERIFIED: phase scope + package audit]

## Package Legitimacy Audit

No external packages are installed by this phase. Package legitimacy gate is not applicable. [VERIFIED: phase scope]

## Architecture Patterns

### System Architecture Diagram

```mermaid
flowchart LR
    CLI[CLI / runner] -->|Bearer or socket auth token: opaque CLI_API_TOKEN| HubAuth[Hub auth middleware]
    Web[Web PWA] -->|POST /api/auth accessToken| AuthRoute[Auth route]
    AuthRoute -->|constant-time compare whole token| Owner[ownerId config]
    AuthRoute -->|JWT { uid }| Web
    HubAuth --> Routes[Hono routes]
    CLI -->|/cli Socket.IO| CliSocket[CLI socket handlers]
    Web -->|/terminal Socket.IO JWT { uid }| Terminal[Terminal handlers]
    Routes --> Sync[SyncEngine]
    CliSocket --> Sync
    Terminal --> Rooms[Socket.IO rooms by sessionId]
    Sync --> Cache[SessionCache / MachineCache]
    Cache --> Store[SQLite sessions / machines / push_subscriptions]
    Sync --> Events[EventPublisher]
    Events --> SSE[SSEManager]
    SSE -->|all/sessionId/machineId filters only| Web
```

### Recommended Project Structure

```text
hub/src/
├── utils/accessToken.ts              # return trimmed opaque token/null only
├── web/middleware/auth.ts            # JWT payload schema { uid }
├── socket/server.ts                  # socket auth without namespace socket data
├── socket/handlers/                  # access by id/existence/active only
├── sync/                             # cache/store methods without namespace params
├── sse/sseManager.ts                 # no namespace subscription/filter
├── store/                            # schema + query signatures without namespace
└── scripts/ or store/offline-*       # narrow offline namespace schema migration entry
shared/src/
├── schemas.ts                        # Session/SyncEvent no namespace
└── socket.ts                         # SocketErrorReason no namespace-missing
cli/src/api/
├── api.ts
└── types.ts                          # no Session.namespace mirror
```

### Pattern 1: Delete at Type Source First

**What:** Remove `namespace` from `shared/src/schemas.ts` `SessionSchema` and `SyncEventSchema`, and remove `SocketErrorReason = 'namespace-missing'` from `shared/src/socket.ts`; then follow TypeScript errors through hub/cli/web. [VERIFIED: codebase]

**When to use:** This phase changes a wire contract used across workspaces, so source-of-truth schema edits expose downstream mirrors. [VERIFIED: AGENTS.md + codebase]

**Example:**

```typescript
// Source: shared/src/schemas.ts [VERIFIED: codebase]
export const SessionSchema = z.object({
    id: z.string(),
    seq: z.number(),
    // namespace removed here; downstream Session type follows
})
```

### Pattern 2: Collapse Access Checks to Existence

**What:** Replace `resolveSessionAccess(sessionId, namespace)` with `resolveSessionAccess(sessionId)` returning only `{ ok: true } | { ok: false; reason: 'not-found' }`, unless a separate active-state check is needed. [VERIFIED: `SessionCache.resolveSessionAccess` current implementation]

**When to use:** Any route or socket handler that currently maps namespace mismatch to 403 must collapse to 404/not-found or active-state errors because multi-user access boundaries are removed. [VERIFIED: CONTEXT D-39/D-45]

**Example:**

```typescript
// Source: hub/src/web/routes/guards.ts pattern to rewrite [VERIFIED: codebase]
const access = engine.resolveSessionAccess(sessionId)
if (!access.ok) {
    return c.json({ error: 'Session not found' }, 404)
}
```

### Pattern 3: Keep Relevance Filters, Remove Tenant Filters

**What:** `SSEManager.shouldSend()` should keep `connection.all`, `sessionId`, `machineId`, and `connection-changed` behavior, but delete namespace comparison. [VERIFIED: `hub/src/sse/sseManager.ts`]

**When to use:** Real-time updates still need per-view relevance; they no longer need tenant isolation. [VERIFIED: CONTEXT D-43]

### Anti-Patterns to Avoid

- **Keeping `DEFAULT_NAMESPACE`:** forbidden by D-37; it hides residual namespace logic and will fail zero-keyword guard. [VERIFIED: CONTEXT]
- **Runtime migration ladder expansion inside `Store.initSchema()`:** forbidden by D-41; add an offline entry and new schema, do not auto-upgrade old DBs on startup. [VERIFIED: CONTEXT + `hub/src/store/index.ts`]
- **Leaving `cli/src/api/types.ts` private mirror behind:** CLI validates hub responses with its own schemas; shared deletion alone will not remove CLI `Session.namespace`. [VERIFIED: `cli/src/api/types.ts`]
- **Treating all `platform` as target:** only `users.platform` is CUT-09; `process.platform`, machine metadata platform, locale “Unknown platform” are false positives and must not be rewritten for this phase. [VERIFIED: CONTEXT Specific Ideas + rg]
- **Dropping session/machine filters from SSE:** would over-broadcast to detail views; only namespace filters go away. [VERIFIED: CONTEXT D-43]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Token comparison | Manual string equality | Existing `constantTimeEquals()` | Current auth already uses constant-time compare; keep it and compare whole token. [VERIFIED: `hub/src/web/routes/auth.ts`, `hub/src/socket/server.ts`] |
| JWT handling | Custom JWT parsing/signing | Existing jose `SignJWT` / `jwtVerify` | Current stack already handles signing/verification; only payload schema changes. [VERIFIED: codebase + npm registry] |
| Request/body validation | Ad hoc parsing | Existing Zod schemas | Existing route/socket code uses Zod throughout; keep strict schemas. [VERIFIED: codebase] |
| SQLite migrations | Generic migration framework | Existing `bun:sqlite` + narrow offline script | No package install needed; runtime compatibility migration is out of scope. [VERIFIED: `hub/src/store/index.ts` + CONTEXT D-41] |
| Keyword guard | New scanning tool | Existing `scripts/check-no-cut-agents.sh` plus `rg` | Existing test guard runs in `bun run test`; extend rather than duplicate. [VERIFIED: `package.json`, guard script] |

**Key insight:** this phase removes a dimension, not a feature surface. Custom abstractions would increase blast radius; direct deletion plus compiler/test feedback is safer. [VERIFIED: codebase shape + CONTEXT]

## Runtime State Inventory

| Category | Items Found | Action Required |
|----------|-------------|-----------------|
| Stored data | SQLite DB path defaults to `{HAPI_HOME}/hapi.db`; `sessions`, `machines`, `users`, and `push_subscriptions` currently store `namespace`; `users` stores `platform/platform_user_id/namespace`; `push_subscriptions` has `UNIQUE(namespace, endpoint)`. [VERIFIED: `hub/src/configuration.ts`, `hub/src/store/index.ts`] | Add new schema without namespace/users; provide offline migration entry that rebuilds affected tables, preserves sessions/machines/messages/push data under single-owner semantics, deduplicates push endpoint rows, drops users, and bumps `PRAGMA user_version`. [VERIFIED: CONTEXT D-38/D-40/D-41] |
| Live service config | No external service config for namespace found in repo-scoped code; auth/config lives in env/settings, not remote service UI. [VERIFIED: rg] | None for namespace. Keep `CLI_API_TOKEN` env/settings as opaque value; remove colon rejection. [VERIFIED: `hub/src/config/cliApiToken.ts`] |
| OS-registered state | No systemd/launchd/pm2/task registration files or code paths with namespace found in scoped source. [VERIFIED: rg + Glob scripts] | None. |
| Secrets/env vars | `CLI_API_TOKEN` may contain old `base:namespace` values; current `hub/src/config/cliApiToken.ts` rejects any colon, which must be removed so the entire value is treated as the secret. [VERIFIED: `hub/src/config/cliApiToken.ts`] | Code edit only; do not split existing env/settings tokens. Planner should include a test for colon-bearing token accepted as opaque when hub config token matches exactly. [VERIFIED: CONTEXT D-34] |
| Build artifacts | No namespace-bearing build artifacts detected in source tree; `bun.lock` may change only if dependencies change, but no new dependency is planned. [VERIFIED: Glob/package review] | None unless tests/build generation changes unexpectedly. |

## Common Pitfalls

### Pitfall 1: Half-removing Token Parsing

**What goes wrong:** `parseAccessToken()` stops returning namespace, but config still rejects `:` or routes still compare only `baseToken`. [VERIFIED: codebase]
**Why it happens:** token parsing and config validation live in different modules. [VERIFIED: `hub/src/utils/accessToken.ts`, `hub/src/config/cliApiToken.ts`]
**How to avoid:** replace `parseAccessToken(raw)` with `parseAccessToken(raw): string | null` or inline trim helper; compare returned whole token to `configuration.cliApiToken`. [VERIFIED: CONTEXT D-34]
**Warning signs:** `rg "baseToken|DEFAULT_NAMESPACE|lastIndexOf\\(':')" hub/src` still hits. [VERIFIED: codebase]

### Pitfall 2: Store Method Signatures Stay Namespace-shaped

**What goes wrong:** schema drops namespace but `updateVersionedField()` or store wrapper methods still require namespace params, causing SQL errors or dead parameters. [VERIFIED: `hub/src/store/versionedUpdates.ts`, `hub/src/store/sessionStore.ts`]
**Why it happens:** versioned update helper centralizes `WHERE id = @id AND namespace = @namespace`. [VERIFIED: codebase]
**How to avoid:** change `VersionedUpdateArgs` and all session/machine update functions in the same slice as store schema. [VERIFIED: codebase]
**Warning signs:** `rg "namespace" hub/src/store` still hits after store commit. [VERIFIED: rg]

### Pitfall 3: Removing Namespace Filtering Also Removes View Filtering

**What goes wrong:** SSE starts sending every message to every detail subscription. [VERIFIED: `SSEManager.shouldSend` current logic]
**Why it happens:** namespace and relevance filters are adjacent in `shouldSend()`. [VERIFIED: codebase]
**How to avoid:** delete only event/connection namespace checks; keep `message-received` sessionId filtering, `connection.all`, and machine/session id matching. [VERIFIED: CONTEXT D-43]
**Warning signs:** `message-received` branch no longer checks `connection.sessionId === event.sessionId`. [VERIFIED: codebase]

### Pitfall 4: Tests Keep Fixture Namespace Fields

**What goes wrong:** runtime code is clean, but tests keep `namespace: 'default'` objects and fail the ripgrep guard. [VERIFIED: rg files_with_matches]
**Why it happens:** many tests build full `Session` fixtures manually. [VERIFIED: `hub/src/web/routes/sessions.test.ts`, `cli/src/api/api.extraHeaders.test.ts`]
**How to avoid:** update fixtures after shared schema removal; delete `hub/src/store/namespace.test.ts` or rewrite it to single-owner store behavior. [VERIFIED: rg]

### Pitfall 5: False-positive `platform` Cleanup

**What goes wrong:** unrelated OS/browser/machine platform fields are renamed or removed. [VERIFIED: rg]
**Why it happens:** ROADMAP mentions `users.platform`, but broad `platform` matches appear in CLI terminal, machine metadata, UI locale, and web haptics. [VERIFIED: rg]
**How to avoid:** only delete `hub/src/store/users.ts`, `userStore.ts`, `StoredUser`, users table/indexes, and `Store.users`; do not touch `process.platform` or machine metadata `platform`. [VERIFIED: codebase + CONTEXT]

## Code Examples

### Opaque Token Parse

```typescript
// Source: derived from hub/src/utils/accessToken.ts target behavior [VERIFIED: codebase + CONTEXT D-34]
export function parseAccessToken(raw: string): string | null {
    const trimmed = raw.trim()
    return trimmed.length > 0 ? trimmed : null
}
```

### JWT Payload Without Namespace

```typescript
// Source: hub/src/web/middleware/auth.ts target behavior [VERIFIED: codebase + CONTEXT D-35]
const jwtPayloadSchema = z.object({
    uid: z.number()
})
```

### Single-owner Access Check

```typescript
// Source: hub/src/sync/sessionCache.ts target behavior [VERIFIED: codebase + CONTEXT D-39]
resolveSessionAccess(sessionId: string):
    | { ok: true; sessionId: string; session: Session }
    | { ok: false; reason: 'not-found' } {
    const session = this.sessions.get(sessionId) ?? this.refreshSession(sessionId)
    return session ? { ok: true, sessionId, session } : { ok: false, reason: 'not-found' }
}
```

### SSE Relevance Filter After Namespace Removal

```typescript
// Source: hub/src/sse/sseManager.ts target behavior [VERIFIED: codebase + CONTEXT D-43]
private shouldSend(connection: SSEConnection, event: SyncEvent): boolean {
    if (event.type === 'message-received') {
        return connection.all || connection.sessionId === event.sessionId
    }
    if (event.type === 'connection-changed') return true
    if (connection.all) return true
    if ('sessionId' in event && connection.sessionId === event.sessionId) return true
    if ('machineId' in event && connection.machineId === event.machineId) return true
    return false
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `CLI_API_TOKEN:<namespace>` | Whole `CLI_API_TOKEN` is opaque shared secret | Phase 03 planned decision D-34 | Token strings containing `:` must be accepted if exact secret matches. [VERIFIED: CONTEXT] |
| JWT `{ uid, ns }` | JWT `{ uid }` | Phase 03 planned decision D-35 | Web/terminal middleware no longer sets namespace context. [VERIFIED: CONTEXT] |
| SQLite tenant columns/indexes | Single-owner tables keyed by ids/endpoints | Phase 03 planned decision D-38 | Store queries update by primary id; push uniqueness by endpoint. [VERIFIED: CONTEXT] |
| Runtime compatibility schema migrations | New schema + offline migration entry | Phase 03 planned decision D-41 | Do not add auto-upgrade branch in `Store.initSchema()`. [VERIFIED: CONTEXT] |
| SSE namespace filter + relevance filter | Relevance filter only | Phase 03 planned decision D-43 | Keep session/machine subscription semantics. [VERIFIED: CONTEXT] |

**Deprecated/outdated:**

- `DEFAULT_NAMESPACE`, `ParsedAccessToken.baseToken`, `ParsedAccessToken.namespace`: delete, no shim. [VERIFIED: `hub/src/utils/accessToken.ts` + CONTEXT]
- `SocketErrorReason = 'namespace-missing'`: delete; access errors become not-found or existing non-namespace errors. [VERIFIED: `shared/src/socket.ts` + CONTEXT]
- `UserStore` / `users` table: delete because no non-store callsites remain after Phase 2. [VERIFIED: rg]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Offline migration entrypoint is fixed as `hub/scripts/migrate-namespace-isolation.ts`. [RESOLVED] | Recommended Project Structure | Low; no existing offline migration convention was found, and the phase now names the script explicitly. |

## Open Questions (RESOLVED)

1. **Offline migration exact entrypoint name — RESOLVED**
   - Decision: create `hub/scripts/migrate-namespace-isolation.ts` as the narrow CUT-09 offline migration entrypoint. [RESOLVED]
   - Rationale: Phase requires an offline migration entry and forbids runtime compatibility migration; no existing offline migration script convention exists. [VERIFIED: CONTEXT D-41, Glob + rg]
   - Planner impact: Plan 03-02 owns this file and verifies `Store.initSchema()` does not import or invoke it.

2. **Schema version bump target — RESOLVED**
   - Decision: bump store schema version from 9 to 10 in Phase 03. [RESOLVED]
   - Rationale: namespace-free physical schema should reject old v9 DBs at runtime while the offline script migrates v9 data to v10; Phase 10 still owns general runtime migration ladder cleanup. [VERIFIED: CONTEXT D-41/Phase 10 boundary]
   - Planner impact: Plan 03-02 owns `SCHEMA_VERSION = 10`, `PRAGMA user_version = 10` in the offline script, and synthetic v9-to-v10 migration coverage.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Bun | Typecheck/test/runtime | yes | 1.3.14 | none needed [VERIFIED: env probe] |
| Node | GSD tooling / scripts | yes | v22.22.0 in Cursor helper | none needed [VERIFIED: env probe] |
| npm | Registry version checks | yes | 10.9.7 | none needed [VERIFIED: env probe] |
| ripgrep | zero-keyword guard | yes | installed | none needed [VERIFIED: env probe] |
| ctx7 | docs lookup fallback | no | — | use codebase/package registry for this codebase-only phase [VERIFIED: shell probe] |
| gsd-sdk | phase init | yes | 1.42.3 | none needed [VERIFIED: init/env probe] |

**Missing dependencies with no fallback:** none. [VERIFIED: env probe]

**Missing dependencies with fallback:** `ctx7` missing; this phase is codebase-only and does not require external API docs beyond current package/version checks. [VERIFIED: shell probe]

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | `bun test` for hub; Vitest for CLI/Web; root orchestrates all. [VERIFIED: package.json] |
| Config file | `cli/vitest.config.ts`, `web/vitest.config.ts`; hub has no separate Vitest config. [VERIFIED: Glob + package.json] |
| Quick run command | `bun typecheck && bun run test` per D-47, or narrower package commands during development. [VERIFIED: CONTEXT + package.json] |
| Full suite command | `bun typecheck && bun run test` from repo root. [VERIFIED: AGENTS.md + package.json] |

### Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| CUT-09 | Colon-bearing token is opaque and exact-match only; no `baseToken`/namespace split. | unit | `bun test hub/src/utils/accessToken.test.ts hub/src/web/routes/auth*.test.ts` | partial: `accessToken.test.ts` exists; auth route test may need creation/update. [VERIFIED: Glob + codebase] |
| CUT-09 | Web JWT and terminal JWT accept `{ uid }`, reject namespace payload dependency. | unit/integration | `bun test hub/src/socket/handlers/terminal.test.ts hub/src/web/routes/*.test.ts` | partial: terminal route tests exist; auth negative matrix deferred. [VERIFIED: Glob + CONTEXT] |
| CUT-09 | Store schema has no namespace/users and queries update by id only. | unit | `bun test hub/src/store/namespace.test.ts hub/src/store/migration-v*.test.ts` after rewrite/rename | exists but must be rewritten/deleted. [VERIFIED: Glob] |
| CUT-09 | Session/machine cache and SyncEngine no namespace method signatures. | unit | `bun test hub/src/sync/sessionModel.test.ts hub/src/sync/aliveEvents.test.ts` | exists; fixtures need namespace removal. [VERIFIED: Glob + rg] |
| CUT-09 | SSE sends by all/sessionId/machineId only; no namespace filter. | unit | `bun test hub/src/sse/sseManager.test.ts` | exists; namespace fixture rewrite needed. [VERIFIED: Glob + rg] |
| CUT-09 | CLI API response schemas and mapping no longer expect `Session.namespace`. | unit | `bun test cli/src/api/api.extraHeaders.test.ts cli/src/agent/sessionFactory.test.ts` | exists; fixtures need namespace removal. [VERIFIED: Glob + rg] |
| CUT-09 | Guard finds zero `namespace` / `:ns` in target dirs outside explicit false positives. | guard | `bun run test:guard` | exists as `scripts/check-no-cut-agents.sh`; pattern update needed. [VERIFIED: package.json + guard script] |

### Sampling Rate

- **Per task commit:** `bun typecheck && bun run test` because D-47 requires every commit green. [VERIFIED: CONTEXT]
- **Per wave merge:** `rg -n "namespace|:ns" cli/src hub/src web/src shared/src` with planner whitelist, then `bun typecheck && bun run test`. [VERIFIED: ROADMAP SC#2]
- **Phase gate:** Full suite green plus zero-keyword guard green before `/gsd-verify-work`. [VERIFIED: ROADMAP SC#1/#2]

### Wave 0 Gaps

- [ ] Rewrite `hub/src/utils/accessToken.test.ts` for opaque token semantics, including `foo:bar` exact token accepted by auth callers. [VERIFIED: current test opposite behavior]
- [ ] Add or update auth route tests for JWT payload `{ uid }` only. [VERIFIED: `hub/src/web/routes/auth.ts` currently signs `{ uid, ns }`]
- [ ] Rewrite/delete `hub/src/store/namespace.test.ts` into single-owner store tests. [VERIFIED: Glob + rg]
- [ ] Update `scripts/check-no-cut-agents.sh` pattern and whitelist comments for Phase 03. [VERIFIED: guard script]
- [ ] Decide offline migration entry path/name before implementation starts. [ASSUMED]

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|------------------|
| V2 Authentication | yes | `CLI_API_TOKEN` exact constant-time compare; JWT signed with jose HS256. [VERIFIED: codebase] |
| V3 Session Management | yes | Web JWT expiration remains 4h; payload narrows to `{ uid }`; terminal socket validates same payload. [VERIFIED: `hub/src/web/routes/auth.ts`, `hub/src/socket/server.ts`] |
| V4 Access Control | reduced | Namespace-based tenant access control is intentionally removed; remaining controls are session existence/active checks. [VERIFIED: CONTEXT D-45] |
| V5 Input Validation | yes | Zod schemas for auth body, JWT payload, Socket.IO payloads, route bodies. [VERIFIED: codebase] |
| V6 Cryptography | yes | Existing `node:crypto` owner/token generation and jose JWT; no hand-rolled crypto. [VERIFIED: `hub/src/config/ownerId.ts`, `hub/src/config/cliApiToken.ts`, `hub/src/web/routes/auth.ts`] |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Token parsing ambiguity (`base:namespace` vs opaque secret) | Spoofing | Treat token as one string and constant-time compare whole value. [VERIFIED: CONTEXT D-34] |
| JWT claim drift between web and terminal middleware | Spoofing / Elevation | Define identical `{ uid }` Zod schema in both paths or share a helper if trivial. [VERIFIED: current duplicated schemas in `auth.ts` and `server.ts`] |
| Over-broadcasting SSE after namespace removal | Information Disclosure | Preserve sessionId/machineId/all relevance filtering. [VERIFIED: CONTEXT D-43] |
| SQLite migration data loss | Tampering / DoS | Offline migration should rebuild tables in transaction and preserve messages/session references. [ASSUMED] |

## Sources

### Primary (HIGH confidence)

- `.planning/phases/03-cut-multi-user-namespace-isolation/03-CONTEXT.md` — locked decisions D-34 through D-48, scope, deferred ideas. [VERIFIED: ReadFile]
- `.planning/REQUIREMENTS.md` — CUT-09 definition and milestone constraints. [VERIFIED: ReadFile]
- `.planning/ROADMAP.md` — Phase 03 success criteria. [VERIFIED: ReadFile]
- `AGENTS.md` — repo commands and coding constraints. [VERIFIED: ReadFile]
- `hub/src/utils/accessToken.ts`, `hub/src/web/routes/auth.ts`, `hub/src/web/middleware/auth.ts`, `hub/src/socket/server.ts` — auth/JWT/socket namespace chain. [VERIFIED: ReadFile]
- `hub/src/store/*`, `hub/src/sync/*`, `hub/src/sse/sseManager.ts`, `shared/src/schemas.ts`, `shared/src/socket.ts`, `cli/src/api/*` — namespace store/cache/event/wire surfaces. [VERIFIED: ReadFile + rg]
- `scripts/check-no-cut-agents.sh`, root/package package scripts — existing guard/test architecture. [VERIFIED: ReadFile]
- npm registry checks for `hono`, `jose`, `socket.io`, `zod`, `vitest` current versions. [VERIFIED: npm registry]

### Secondary (MEDIUM confidence)

- Environment probes for Bun/Node/npm/rg/gsd-sdk availability. [VERIFIED: shell probe]

### Tertiary (LOW confidence)

- Offline migration script naming/path recommendation; no existing project convention found. [ASSUMED]

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — this phase uses existing repo stack and no new packages; versions verified from package files and npm registry. [VERIFIED: package.json + npm registry]
- Architecture: HIGH — namespace data flow is directly visible in auth/socket/store/cache/SSE code. [VERIFIED: codebase]
- Pitfalls: HIGH — pitfalls map to concrete current callsites and tests. [VERIFIED: rg + ReadFile]
- Offline migration placement: LOW — requirement is locked, but exact script location is discretionary and no existing offline migration tool exists. [ASSUMED]

**Research date:** 2026-05-21
**Valid until:** 2026-06-20 for codebase findings; rerun npm version checks if dependency updates land before implementation.
