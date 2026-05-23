# Phase 3: cut-multi-user-namespace-isolation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-21
**Phase:** 03-cut-multi-user-namespace-isolation
**Areas discussed:** Token/JWT contract collapse, SQLite and users table shape, Realtime event routing, Execution slices and tests

---

## Gray Area Selection

| Option | Description | Selected |
|--------|-------------|----------|
| Token/JWT 契约收敛 | `CLI_API_TOKEN:<namespace>` 是否直接变成单个 opaque token；JWT/Web middleware 是否完全去掉 `ns`/`namespace` | ✓ |
| SQLite 与 users 表处理 | sessions/machines/push 是否物理删 namespace 列；`users.platform`/UserStore 是整表删除还是收敛为 owner-only | ✓ |
| 事件与实时通道过滤 | SSE/EventPublisher/terminal/socket 里 namespace 过滤删除后，用 session/machine 过滤还是直接全局广播 | ✓ |
| 提交与测试切片 | 继续沿用前两阶段的最小切除 + ripgrep 零容忍，还是把 schema/测试/守卫拆得更细 | ✓ |

**User's choice:** “按照你的推荐做决定”
**Notes:** User delegated all gray-area decisions to Claude's recommendation. Claude selected all four because each changes downstream planning shape.

---

## Token/JWT Contract Collapse

| Option | Description | Selected |
|--------|-------------|----------|
| Keep default namespace compatibility | Keep `DEFAULT_NAMESPACE` and silently map all connections to it | |
| Remove namespace entirely | Treat `CLI_API_TOKEN` as one opaque secret; JWT payload drops `ns`; middleware/socket data drops namespace | ✓ |
| Let Claude decide | Delegate to recommendation | ✓ |

**User's choice:** Approved Claude recommendation.
**Notes:** No compatibility shim. A token containing `:` is just a token string, not token + namespace.

---

## SQLite And Users Table Shape

| Option | Description | Selected |
|--------|-------------|----------|
| Leave inert default columns | Keep namespace columns with `'default'` values to reduce edits | |
| Physically remove namespace columns and user binding storage | Delete namespace columns/indexes/queries and remove `users`/`UserStore` unless research finds a live non-Telegram use | ✓ |
| Let Claude decide | Delegate to recommendation | ✓ |

**User's choice:** Approved Claude recommendation.
**Notes:** Owner identity should come from `ownerId` config/JWT `uid`, not user platform bindings. Runtime compatibility migrations are not part of this phase except a narrow offline migration entry if needed for CUT-09.

---

## Realtime Event Routing

| Option | Description | Selected |
|--------|-------------|----------|
| Broadcast everything to all clients | Remove all filtering now that there is one owner | |
| Keep session/machine filters without namespace | Remove namespace filtering but preserve subscription relevance filters | ✓ |
| Let Claude decide | Delegate to recommendation | ✓ |

**User's choice:** Approved Claude recommendation.
**Notes:** This keeps mobile/web updates scoped to relevant session or machine views without pretending there are multiple tenants.

---

## Execution Slices And Tests

| Option | Description | Selected |
|--------|-------------|----------|
| Single large deletion commit | Do all namespace deletion in one commit | |
| Four focused commits with per-commit verification | Auth/JWT/socket, store/cache/schema, event/routes/terminal, tests/guard | ✓ |
| Let Claude decide | Delegate to recommendation | ✓ |

**User's choice:** Approved Claude recommendation.
**Notes:** Continues Phase 1/2 practice: minimal cut, bisectable commits, `bun typecheck` + `bun run test` per commit, ripgrep guard update.

---

## Claude's Discretion

- User delegated all Phase 3 gray-area decisions to Claude's recommendation.
- Planner/researcher may choose exact function names, test file grouping, and offline migration entry placement.
- Planner/researcher may not preserve a default namespace compatibility layer.

## Deferred Ideas

- Auth negative-case test matrix remains Phase 11.
- Route helper and API error unification remain Phase 8.
- Full runtime SQLite migration cleanup remains Phase 10.
- Documentation/website historical namespace cleanup remains Phase 12.
- Token rotation, revocation, and rate limiting remain out of scope for single-user Tailscale v1.
