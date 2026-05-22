# Phase 8: Hub internal decoupling - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-22
**Phase:** 08-hub-internal-decoupling
**Areas discussed:** SessionCache 拆分, SyncEngine + SSE, routes/helper/ApiRouteError, KeepaliveScheduler, 切片节奏
**Language:** 中文（用户请求）

---

## Area A — SessionCache 4 服务拆分边界

| Option | Description | Selected |
|--------|-------------|----------|
| 4 个独立 service + SessionCache 退化为薄 facade | 公开 API 零变化，callers 不改 import | ✓ |
| 4 个独立 service + 直接删 SessionCache（callers 改 DI） | surface area 外溢；与 P10 DI 改造冲突 | |
| 拆 2 个（read vs write）粒度更粗 | 不满足 ~400 行/file SC#1 | |

**User's choice:** 全部接受推荐方案（D-129/D-130/D-131）
**Notes:** facade 名保留 1 phase，Phase 12 verification 评估是否进一步删；merge 流程事务粒度原样（Store transaction 不抽 helper）—— 避免与 P10 REFC-02 DI 改造冲突。

---

## Area B — SyncEngine 拆分 + SSE 解耦

| Option | Description | Selected |
|--------|-------------|----------|
| 按职责拆 4 sub-facade (session/machine/message/rpc) | shutdown 钩子按职责吸纳 | ✓ |
| 按生命周期拆 (startup/runtime/shutdown) | 代码量不均；shutdown 分布在每职责内 | |
| sseManager SyncEvent type 切到 `@hapi/protocol/types` | P7 已落地 shared 唯一来源 | ✓ |
| 在 hub 本地新建 `events.ts` 中转 | 违反 shared 单点 | |

**User's choice:** 推荐方案（D-132/D-133/D-134）
**Notes:** sseManager 切 import 是 madge 1 环（`syncEngine > sseManager`）的唯一根因，一步降到 0 环。SyncEngine sub-facade 直通方法 delegate 或字段暴露由 planner 选（默认直通，零 caller 改动）。

---

## Area C — routes 拆分 + helper + ApiRouteError

| Option | Description | Selected |
|--------|-------------|----------|
| sessions.ts 按 lifecycle/config/upload/read 4 子文件拆 | 路径前缀同源、职责清晰 | ✓ |
| 按 HTTP verb 拆（GET vs POST vs DELETE...） | 跨业务上下文混淆 | |
| helper = Hono middleware + c.set | Hono idiom; 链式 .get/.post 不破坏 | ✓ |
| helper = 高阶 wrapper (HOF wraps handler) | 类型推导差；样板多 | |
| ApiRouteError extends HTTPException | 复用 Hono 内置基类 | ✓ |
| ApiRouteError 新建独立 class（不继承） | 重新实现 toResponse 样板 | |
| 统一 JSON shape `{ error: { code, message, details? } }` | 与 P3 D-41 显式失败精神同源 | ✓ |
| Result<T, E> 类型返回 | 样板膨胀；与 Hono async handler 风格不符 | |

**User's choice:** 推荐方案（D-135/D-136/D-137）
**Notes:** upload / upload/delete 两条 multipart 路径不走 `parseJsonBody` —— helper 设计不要把 multipart 也吃进去。新 helper 位置由 researcher 决定（合入既有 `hub/src/web/middleware/auth.ts` 同目录或独立 `route-helpers.ts`）。

---

## Area D — 集中 KeepaliveScheduler

| Option | Description | Selected |
|--------|-------------|----------|
| 新建 `hub/src/utils/scheduler.ts::KeepaliveScheduler`, interval+timeout 都吃 | 覆盖 notify timer 的 timeout 形态 | ✓ |
| Interval-only scheduler | notify timer 漏掉，SIGINT 时清不干净 | |
| scheduler 单例 DI 注入构造器 | 与 P10 REFC-02 DI 方向预对齐 | ✓ |
| scheduler 全局 module-level singleton import | 与 P10 DI 改造冲突 | |
| shutdown 钩子集中在 hub/src/index.ts | 单点收敛、便于审计 | ✓ |
| 每子系统各自注册 process listener | listener 累积；难审计 | |
| 一次性 promise sleep 也入 scheduler | 语义错配；shutdown 时 await 自然结束 | |
| promise sleep 保留 + 白名单注释锚 | 显式区分 recurring vs sleep | ✓ |
| SIGINT 测试 = vitest fakeTimers + 直接调 handler 函数 | process-level mock 跨 vitest 进程不可靠 | ✓ |
| 真的发 SIGINT 信号 | 进程边界问题 | |

**User's choice:** 推荐方案（D-138~D-141）
**Notes:** name 字段必填（dev 模式调试 timer 泄漏）；priority 不加（YAGNI）。SIGINT handler 内 `await syncEngine.shutdown()` 加 5s 总超时（推荐，避免 ctrl-c 无响应）—— researcher 决定。

---

## Area E — 切片节奏 + guard

| Option | Description | Selected |
|--------|-------------|----------|
| Slice 1: SessionCache 拆 → Slice 2: scheduler+SyncEngine 拆+SSE 切 → Slice 3: routes 拆 → Slice 4: guard | scheduler 第二片就绪供后续；routes 拆放第三片避免重排两次 | ✓ |
| scheduler 最后建 | 后续切片要回头改 timer 接入 | |
| 一切片全做 | 风险集中、回滚困难、违反 P6/P7 节奏 | |
| 每切片 `bun typecheck + bun run test` 绿 + Slice 4 guard 收口 | P5/P6/P7 同模板 | ✓ |
| madge guard 独立脚本 vs 合并 check-no-cut-agents.sh | 输出过滤 web/dist 干扰主 guard | researcher 选 |

**User's choice:** 推荐方案（D-142/D-143/D-144）
**Notes:** Slice 2 合并 scheduler + SyncEngine 拆 + SSE 切 import —— 三者高度耦合（SyncEngine inactivityTimer 走 scheduler；sseManager 切 shared type 后 syncEngine 拆分不会再触发 sseManager 改动）。Slice 4 guard 关键词见 D-143。`messageService.ts / rpcGateway.ts / machineCache.ts` 不动 —— phase scope 锁定。

---

## Claude's Discretion

- 4 SessionCache service 是否各自暴露给 SyncEngine 直接调（绕 facade）—— 默认 facade，planner 决定。
- SyncEngine sub-facade 字段暴露 vs 直通 delegate —— 默认直通。
- 新 helper middleware 放 `middleware/` 还是 `routes/_helpers/` —— researcher 决定。
- `ApiRouteError.details` 类型（`ZodIssue[]` vs `unknown`）—— 默认 `unknown`。
- KeepaliveScheduler dev 模式 log —— 推荐 console.debug；prod 静默。
- SIGINT handler `await syncEngine.shutdown()` 超时窗口 —— 推荐 5s。
- `routes/sessions/index.ts` 是否 export 4 子 app —— 默认仅 export `createSessionsRoutes`。
- madge guard 命令形式（`--exclude` vs `cd hub/src/`）—— researcher 在 Slice 4 给出最终形式。

## Deferred Ideas

见 CONTEXT.md `<deferred>` 段；要点：REFW-01/02/03 → P9；REFC-01/02 → P10；REFT-01/02/03 → P11；SessionCache facade 删除 → P12 评估；`syncEngine.ts:645,657` retry sleep util 抽象 → 不收敛；hub 全面 DI 化 → P10。
