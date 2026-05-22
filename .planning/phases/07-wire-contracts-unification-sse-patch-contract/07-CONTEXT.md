# Phase 7: Wire contracts unification & SSE patch contract - Context

**Gathered:** 2026-05-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 7 交付的是：把 `Session / Machine / Message / RunnerState` 与 SSE 事件 payload 的**单一定义点**收敛到 `shared/src/`；用**严格 patch schema** 替换 `web/src/hooks/useSSE.ts` 中的启发式 `hasUnknownSessionPatchKeys()` 整列表 refetch；同时清掉两个 wire 字面量遗债（`MetadataSchema.flavor` 字段、`AGENT_MESSAGE_PAYLOAD_TYPE = 'codex'`）。映射 **REFA-03 + REFA-04**。

**In scope:**

- `shared/src/schemas.ts` 成为 `Session / Machine / MachineMetadata / RunnerState / Message wire (UserMessage / AgentMessage / MessageContent / MessageMeta)` 的唯一 Zod schema + TS type 来源；cli `cli/src/api/types.ts`、web `web/src/types/api.ts`、hub `hub/src/sync/machineCache.ts` 等三处平行定义全部改为 re-export（或直接消费）shared 类型，**零重复 interface/type declaration**。
- `shared/src/schemas.ts` 新增 `SessionPatchSchema` + `MachinePatchSchema`（严格枚举所有可 patch 字段，含 `backgroundTaskCount`），`SyncEventSchema` 中 `session-added / session-updated / machine-updated` 三类事件的 `data` 字段从 `z.unknown().optional()` 改为强类型 union：「`Session` 全量 | `SessionPatchSchema` 严格 patch」（同样 Machine 一侧），用 discriminator/refinement 区分。
- `hub/src/sync/sessionCache.ts`、`hub/src/sync/machineCache.ts`、`hub/src/sync/eventPublisher.ts` 发出的 `publisher.emit({...})` 全部 conform 到新 schema（broadcast 前可 dev 模式 `z.parse` 兜一道），不再自由塞字段。
- `web/src/hooks/useSSE.ts` 中 `SessionPatch` 本地 type、`getSessionPatch()`、`hasUnknownSessionPatchKeys()`、`isSessionRecord()`、`isMachineRecord()`、`isInactiveMachinePatch()`、`isMachineMetadata()` 全部删除；改为 `SyncEventSchema.safeParse(parsed)` 后按 discriminator 走；TanStack Query cache 更新**不再**包含「fallback to refetch list」分支（`queueSessionListInvalidation` / `queueSessionDetailInvalidation` / `queueMachinesInvalidation` 在 schema 解析成功路径上不被调用）。解析失败一律 console.error + drop，不 refetch。
- `MetadataSchema.flavor: z.string().nullish()` 字段删除；hub 写 metadata 时不再写 flavor；cli 写 metadata 时不再写 flavor；web `SessionMetadataSummary.flavor` 字段删除；`hub/src/notifications/sessionInfo.ts::getFlavorLabel` 等仅服务展示的调用点同步收敛（Cursor-only 后无需 label 分流）。
- `shared/src/modes.ts::AGENT_MESSAGE_PAYLOAD_TYPE` 从 `'codex' as const` 改名为 `'cursor' as const`；所有引用点（`hub/src/sync/todos.ts`、`hub/src/sync/sessionModel.test.ts`、cli 写 message wire 处）的字面量同步变更；`scripts/check-no-cut-agents.sh` 的 `AGENT_MESSAGE_PAYLOAD_TYPE` 行级白名单 + `wire-protocol legacy literal — owned by Phase 7` JSDoc 锚点删除。
- 新增测试：
  1. `shared/src/schemas.test.ts`（或扩 `flavors.test.ts`）—— `SessionPatchSchema` / `MachinePatchSchema` / `SyncEventSchema` 强类型枚举覆盖（每个 patch 字段一行断言，未知字段拒绝）；
  2. `web/src/hooks/useSSE.test.tsx` —— 在 strictly typed event stream 下跑：(a) 全量 session-added/updated、(b) 各种 patch（含 `backgroundTaskCount` 单字段 patch）、(c) `machine-updated` patch、(d) `session-removed` / `messages-consumed` / `message-cancelled` 路径都正确触发 cache mutation，且解析失败时不触发 invalidate；
  3. `hub/src/sse/sseManager.test.ts` 或 `hub/src/sync/sessionCache.test.ts` —— 断言所有 `publisher.emit` 的 payload 都通过 `SyncEventSchema.safeParse`（contract test）。
- ripgrep + madge guard 追加（详见 D-119）。

**Out of scope:**

- REFH-01 / REFH-02 hub 内部解耦（`SessionCache` 796 行 / `SyncEngine` 854 行拆分、SSE 不再反向依赖 SyncEngine 具体类型）—— **Phase 8**。本 phase 只动 wire schema + emit 形状，不拆 SessionCache/SyncEngine 文件；SSE 路径上「不再 `import { SyncEngine }`」也是 Phase 8 才硬验。
- REFH-03 hub 路由模板抽象（`parseJsonBody / withEngine / withSession / withActiveSession / withMachine` + `ApiRouteError` + 拆 `sessions.ts`）—— **Phase 8**。本 phase 不重排 `hub/src/web/routes/sessions.ts` 的职责切分，只把里面 ad-hoc 定义的 response shape 上提 shared（如 `SessionsResponse / SessionResponse / MachinesResponse`）。
- REFW-01 ToolCard 循环依赖、REFW-02 oversized files 拆分、REFW-03 Levenshtein / base64 / permission-mode mapping / `createApiQuery` 上提 —— **Phase 9**。本 phase 不动 ToolCard、不拆 `message-window-store.ts`。
- REFC-01 SQLite 运行时迁移删除、schema-version mismatch reject、`hapi server` 命令别名清理 —— **Phase 10**。本 phase **不**写 SQLite migration：`AGENT_MESSAGE_PAYLOAD_TYPE` rename 与 `metadata.flavor` 字段删除产生的「老 message 解码失败 / 老 metadata 有 flavor 但 schema 拒绝」问题接受为 Phase 10 schema-version reject 的天然兜底（D-116），不在本 phase 写 in-place 迁移代码。
- REFC-02 mutable config singleton → `Readonly<...>` 改造 —— **Phase 10**。
- REFT-01 cursor permission-mode → CLI flag 完整矩阵测试 —— **Phase 11**。本 phase 只补 SSE / schema 三类测试。
- CURS-01~05 v2 Cursor 增量能力 —— **Milestone 2**。
- README / AGENTS / docs / website prose 中 `'codex'` 提及清理 —— **Phase 12 (CUT-12)**。本 phase 只动源码 + 测试 + guard 脚本。
- 不加 feature flag、`.passthrough()` 兼容层、wire 字段 alias、`AGENT_MESSAGE_PAYLOAD_TYPE` 双写迁移期。一次切干净（与 P2/P4/P5/P6 同款）。
- 不动 `cli/src/cursor/modes.ts::EnhancedMode` 上提：Phase 6 D-97 已决断它是 cli-runtime concept，不入 `shared/`。

</domain>

<decisions>
## Implementation Decisions

### 1. canonical schema 单一定义点（灰区 B：上提范围）

- **D-111：`Machine + MachineMetadata + RunnerState` 上提到 `shared/src/schemas.ts`。** 当前 `cli/src/api/types.ts:32-88` 定义 `MachineMetadataSchema / RunnerStateSchema / Machine` 完整 Zod + TS；`web/src/types/api.ts:50-77` 平行定义 `RunnerState / Machine` 纯 TS；`hub/src/sync/machineCache.ts:18` 第三处 `export interface Machine`。三份并存正是 SC#1 ripgrep 命中目标。上提后：cli 改为 `import { Machine, RunnerState, MachineMetadata } from '@hapi/protocol/schemas'`；web `web/src/types/api.ts` 删除本地 Machine/RunnerState，从 `@hapi/protocol/types` re-export；hub `machineCache.ts` 改为 re-export `import type { Machine } from '@hapi/protocol/types'`（仅保留 cache 的内存 mutation 行为，类型不在本文件定义）。
- **D-112：Message wire 上提到 `shared/src/schemas.ts`。** `cli/src/api/types.ts:152-189` 的 `MessageMetaSchema / UserMessageSchema / AgentMessageSchema / MessageContentSchema` 上提，cli 改为 re-export。`shared/src/messages.ts` 已存在，researcher 选 `schemas.ts` 或 `messages.ts` 哪个更贴语义（建议 `messages.ts`，避免 `schemas.ts` 单文件爆炸）；本 phase 不强约束放哪个文件，但**必须**在 `shared/` 内单点。
- **D-113：cli `CreateSessionResponseSchema` 的 `metadata: z.unknown().nullable()` / `agentState: z.unknown().nullable()` narrow 到 shared `MetadataSchema` / `AgentStateSchema`。** 当前 cli `CreateSessionResponseSchema`（`cli/src/api/types.ts:102-122`）出于历史原因把 metadata/agentState 当 unknown 解码、调用方再二次 narrow；shared `SessionSchema` 已是强类型。本 phase 顺手对齐：`cli/src/api/types.ts` 删除 `CreateSessionResponseSchema` 内联 Zod，改为 `z.object({ session: SessionSchema })`，与 `GetSessionResponseSchema` 共用。该 narrow 会让 cli 端调用 `parse()` 时 metadata / agentState 字段错误（如旧 worker / runner 传未知字段）暴露 —— 这是预期收益。
- **D-114：`SessionsResponse / SessionResponse / MessagesResponse / MachinesResponse / SpawnResponse` 等 hub HTTP response shape 上提到 `shared/`。** 当前 `web/src/types/api.ts` 与 `hub/src/web/routes/` 各自定义这些 wrapper；上提后 cli/hub/web 三端共用，下一 phase 路由重构（REFH-03）少 churn。本 phase 只上提**已存在且形状稳定**的 wrapper（sessions / session / messages / machines / spawn / push-vapid），不动 git / file-search / list-directory / upload 等可能在 Phase 8/9 重构的；researcher 按 ripgrep `=== '` / 平行 type 命中清单确定具体集合。
- **D-115：Phase 7 不 narrow `RunnerState.status` / `shutdownSource` 中残留的 `z.union([z.enum(...), z.string()])` 宽松形状。** 这两处当前是 cli 侧为兼容 unknown 旧版本保留的「枚举 ∪ 任意字符串」union（`cli/src/api/types.ts:60,65`）。本 phase 上提时**原样上提**，narrow 留 Phase 10 REFC-01 schema-version-bump 时一并做（届时旧版本可直接拒绝启动）。

### 2. SSE patch 契约严格化（灰区 A：核心二选一）

- **D-116：选「严格 patch schema」路径（vs 全量 SessionSummary 推送）。** SC#2 二选一：(α) `SessionPatchSchema` 在 `shared/` 定义；(β) 永远推全量 `SessionSummary`。选 α 因为：(1) hub 当前 `sessionCache.ts` 已经按字段 patch，全量化要重写 emit 路径 + 加序列化成本；(2) Cursor session 一个 patch 5–10 字节 vs 全量 SessionSummary 几百字节，移动端 + Tailscale + 长 idle 场景带宽敏感（PROJECT.md 核心场景）；(3) 严格 schema 等同于「带值能力表」思路（P5 D-72）—— wire 也走「严格列举」而非「unknown + 启发式」。
- **D-117：`SessionPatchSchema` 在 shared 定义为 `z.object({...}).strict()`，字段集 = hub `sessionCache.ts` 现存所有 emit 字段的并集。** 从 `hub/src/sync/sessionCache.ts` 扫到的字段（必须全覆盖，否则 hub broadcast 会 strict-mode 拒绝）：
  - `active: boolean`
  - `activeAt: number`
  - `thinking: boolean`
  - `updatedAt: number`
  - `permissionMode: PermissionMode`
  - `model: string | null`
  - `modelReasoningEffort: string | null`
  - `effort: string | null`
  - `backgroundTaskCount: number`（**当前 useSSE.ts 不认识 → hasUnknownSessionPatchKeys = true → 触发整列表 refetch**；这是 SC#2 的活靶子）
  - 全部 `.optional()`（patch 语义：只传变化的字段）。
- **D-118：`MachinePatchSchema` 在 shared 定义为 `z.object({ active: z.literal(false), activeAt: z.number().optional() }).strict()`。** 当前 useSSE.ts `isInactiveMachinePatch` 只认 `active === false` 形态的 patch；其它情况要么走 `isMachineRecord` 全量、要么走 `queueMachinesInvalidation` refetch。本 phase 把这个语义形式化：machine patch **只**用于 inactivate 通知；其它 machine 变化一律走全量 `Machine`。这与 D-117「sessions 走 patch」形成对称：session 高频/小字段 → patch；machine 低频/状态简单 → 全量 + 单一 deactivate patch。researcher 若发现 `machineCache.ts` 有更多 patch 字段需求，扩 schema 字段集但保持 `.strict()`。
- **D-119：`SyncEventSchema` 中 `session-added` / `session-updated` 的 `data` 字段类型 = `z.union([SessionSchema, SessionPatchSchema])`；`machine-updated` 的 `data` = `z.union([MachineSchema, MachinePatchSchema, z.null()])`。** 不再 `z.unknown().optional()`。useSSE 解析后用「`'metadata' in data` / `'id' in data`」简单形状判全量 vs patch，**不**再做模糊兜底。`session-added` 严格要求全量（patch 无意义）—— researcher 评估是否进一步分裂 union 为「`session-added` 必全量 + `session-updated` 才允 patch」（推荐分裂，更严格但 hub 侧改动更小，因为现状 `session-added` 已是全量）。
- **D-120：useSSE 解析失败处理 = console.error + drop event，不 refetch。** 当前「未知字段触发整列表 refetch」是兜底但等价于「contract 失败时数据库压力 +1」。新合约下：hub 必须发合法 event，发不合法 = bug；web 静默重连 / 健康检查会兜底真实丢包（SSE reconnect path 不动）。SC#3 「no fallback to refetch list」即此。
- **D-121：`getSessionPatch` / `hasUnknownSessionPatchKeys` / `isSessionRecord` / `isMachineRecord` / `isInactiveMachinePatch` / `isMachineMetadata` / `hasRecordShape` 七个 useSSE.ts 本地 narrow 函数全部删除。** 替换为 shared schema `safeParse` 出的 typed branch。`upsertSessionSummary / patchSessionSummary / patchSessionDetail / removeSessionSummary / upsertMachine / removeMachine` 等 cache mutator 保留（这些是 React Query 侧职责），但其入参类型从 ad-hoc `SessionPatch` type 换为 shared `z.infer<typeof SessionPatchSchema>`。

### 3. wire 字面量遗债（灰区 C：P5 D-81 / P5 D-172 锚定本 phase）

- **D-122：删除 `MetadataSchema.flavor` 字段（shared/src/schemas.ts:49）。** Cursor-only 已 narrow 类型（P5 D-69），wire 上保留 `flavor` 字段已无信息量；写入的代码（hub `syncEngine` / cli `sessionFactory` 等）同步删 flavor 写入；读取的代码（hub `notifications/sessionInfo.ts::getFlavorLabel` 等）同步收敛。`web/src/types/api.ts::SessionMetadataSummary.flavor` 字段一并删除。**SQLite 老 metadata 行**中 `flavor` 字段不会再被解码（strict schema 拒绝未知字段），属可接受 —— P5 RESEARCH 已把 `MetadataSchema.flavor: z.string().nullish()` 标为「wire 面向后兼容保留」，本 phase 明确**收回这条临时保留**。Phase 10 REFC-01 schema-version reject 会自然兜上 SQLite 不匹配场景（D-116 同款思路）。
- **D-123：`AGENT_MESSAGE_PAYLOAD_TYPE` 从 `'codex' as const` 改名为 `'cursor' as const`（shared/src/modes.ts:9）。** P5 D-81 已锚定本 phase 执行。同步动作：
  - JSDoc 锚点 `wire-protocol legacy literal — owned by Phase 7; do not change` 删除（任务已完成）；新 JSDoc 改为 `wire-tag for cursor agent message envelope`。
  - `hub/src/sync/todos.ts` / `hub/src/sync/sessionModel.test.ts` 等使用 `AGENT_MESSAGE_PAYLOAD_TYPE` 常量的代码**无需改动**（值变了，import 不变）。
  - **SQLite 中已存的 message 行 `content.type === 'codex'`** 在 rename 后会被新 schema 拒绝（discriminator 不匹配）。接受：单用户、no backward compat、Phase 10 REFC-01 schema-version reject 会强制用户走离线迁移工具或清库重启。本 phase **不**写 in-place SQLite 迁移代码。
  - cli 写 message 处一并切到新常量字面量（多数已通过 `AGENT_MESSAGE_PAYLOAD_TYPE` 间接引用，researcher 扫剩余 hard-coded `'codex'` 字符串）。
- **D-124：删除 `scripts/check-no-cut-agents.sh` 中 `AGENT_MESSAGE_PAYLOAD_TYPE` post-filter 与 Phase-5 territory `'codex'` 白名单。** D-123 之后 `'codex'` 字面量在 `cli/src/ hub/src/ web/src/ shared/src/` 中应零命中（除 `AGENT_MESSAGE_PAYLOAD_TYPE` 已改名 = 不命中）。Phase 7 guard 在原 sweep 上**严格化**：`'codex'` 出现 = 失败，不再有「但 wire literal 例外」。

### 4. 切片与执行节奏（灰区 D 默认）

- **D-125：4 切片，每片落 `bun typecheck` + `bun run test`（cli/hub/web/shared 全包）绿。**
  1. **shared schema 上提 + patch schema 新增（"准备弹药"）**：在 `shared/src/schemas.ts`（或 `messages.ts`）新增 `MachineSchema / MachineMetadataSchema / RunnerStateSchema / SessionPatchSchema / MachinePatchSchema`；`SessionSchema` 不动；`SyncEventSchema` 中 `data` 字段从 `z.unknown` 改为 union（D-119）；上提 `Message wire` 系列 schema；`AGENT_MESSAGE_PAYLOAD_TYPE` 改名 `'cursor'`；`MetadataSchema.flavor` 字段删除；shared 单元测试（D-127）落地。**门槛**：`bun typecheck` + `bun run test` 全绿。本切片 shared 单点编译通过 = 后续 cli/hub/web 收敛弹药就绪。
  2. **hub broadcast 收敛 + emit 合约对齐**：`hub/src/sync/sessionCache.ts` / `machineCache.ts` / `eventPublisher.ts` 的 `publisher.emit({...})` 全部 conform 新 schema；可选在 `eventPublisher.emit` 入口加 dev 模式 `SyncEventSchema.parse()`（生产模式跳过避免开销）；hub 删除 metadata flavor 写入；hub `routes/sessions.ts` 等 response wrapper 改用 shared。**门槛**：hub 测试套（含新加的 contract test）全绿；ripgrep `flavor` 在 `hub/src/` 命中清单 = 0（除 PROJECT.md 引用 + machineCache 历史 import 已删）。
  3. **cli + web 重复定义收敛**：`cli/src/api/types.ts` 删除本地 `Machine / RunnerState / MachineMetadata / MessageContent / UserMessage / AgentMessage / MessageMeta`，全部 re-export shared；`CreateSessionResponseSchema` narrow（D-113）；cli 写 metadata 处删 flavor；`web/src/types/api.ts` 删除本地 `Machine / RunnerState / SessionMetadataSummary.flavor`，re-export shared；`web/src/hooks/useSSE.ts` 删除 7 个本地 narrow（D-121），改 `SyncEventSchema.safeParse`；useSSE 测试（D-127）落地。**门槛**：`bun typecheck` + `bun run test` 全绿；ripgrep `interface Machine|export type Machine|RunnerStateSchema|MachineMetadataSchema` 在 `cli/src/ web/src/` 命中清单 = 0；ripgrep `hasUnknownSessionPatchKeys|getSessionPatch|isSessionRecord|isMachineRecord` 在 `web/src/` 命中清单 = 0。
  4. **guard 收口 + 字面量清理**：`scripts/check-no-cut-agents.sh` 删除 `AGENT_MESSAGE_PAYLOAD_TYPE` 行级白名单（D-124）；追加 Phase 7 guard 关键词（D-126）；`shared/src/modes.ts` 的 P5 D-81 JSDoc 锚点替换为新文本（D-123）；hub contract test（D-127#3）落地。**门槛**：`bash scripts/check-no-cut-agents.sh` 退出 0；所有 D-126 关键词零命中；`bun typecheck` + `bun run test` 全绿。
- **D-126：ripgrep zero-tolerance 关键词（追加进 `scripts/check-no-cut-agents.sh`）。** 范围 `cli/src/ hub/src/ web/src/ shared/src/`：
  1. `hasUnknownSessionPatchKeys` —— 0 命中（identifier + import 全部清掉）。
  2. `getSessionPatch` 在 `web/src/hooks/` 命中数 = 0（避免重新引入 ad-hoc patch narrow）。
  3. `interface Machine\b` / `^export type Machine =` 在 `cli/src/ web/src/ hub/src/` 命中数 = 0（仅 `hub/src/sync/machineCache.ts` 内部 cache wrapper 可命中 `class MachineCache` 不算）。
  4. `RunnerStateSchema` / `MachineMetadataSchema` 在 `cli/src/ web/src/` 0 命中（定义仅在 shared）。
  5. `'codex'` 字面量在 `cli/src/ hub/src/ web/src/ shared/src/` 0 命中（D-124 严格化，无白名单）。
  6. `flavor` 字段写入在 `cli/src/ hub/src/` 0 命中（metadata 字段层面 —— researcher 列调用清单，guard 仅扫源码字符串 `flavor:` + `.flavor =`）。
- **D-127：测试范围 = 3 类。**
  1. **shared schema unit tests**：`SessionPatchSchema` / `MachinePatchSchema` strict 行为（未知字段拒绝）；`SyncEventSchema` 每个 event type discriminator + `data` union 解析（含全量 + patch 两路径）；`MessageContentSchema` discriminator 解析；`Machine / RunnerState` 上提后 cli 既有测试（`cli/src/api/*.test.ts`）全绿不需改。
  2. **`web/src/hooks/useSSE.test.tsx`**（新文件 —— 当前 useSSE 无单测）：mock EventSource，喂入 strictly typed JSON 事件序列；断言 (a) 全量 `session-added` upsert summary 与 detail；(b) `backgroundTaskCount` 单字段 patch 仅 mutate cache、**不** invalidate；(c) 各 session-updated patch 字段全覆盖；(d) `machine-updated` 全量 + inactivate patch 两路径；(e) 解析失败的 event 不 mutate / 不 invalidate / 不 throw（log 即可）。这是 SC#4「new tests exercise the SSE handler against a strictly typed event stream」的直接落点。
  3. **hub broadcast contract test**：`hub/src/sse/sseManager.test.ts` 或 `hub/src/sync/sessionCache.test.ts` 中加 `it('all publisher.emit payloads conform to SyncEventSchema')`：mock `SSEManager.broadcast`，跑一遍代表性场景（session active/inactive、thinking、background task delta、permission mode 切换、machine activate/inactivate），每个 emit 的 payload 都 `SyncEventSchema.parse()` 不抛。
- **D-128：本 phase 不跑 `build:single-exe`、不跑 madge 新增 guard。** Phase 7 是 wire schema + emit 收敛，没 runtime asset 变更；既有 `madge --circular cli/src/cursor`（P6 D-108#4）保留即可，**不**新增 `madge --circular hub/src/` 验收（那是 Phase 8 REFH-02 的硬验）。

### Claude's Discretion

- shared 中新 schema 放 `schemas.ts` 还是新建 `wire.ts` / 复用 `messages.ts`，由 researcher 按文件大小 + 语义就近原则决定；本 phase 不强约束位置，只约束「shared 单点」。
- `SessionPatchSchema` 是 `z.object({...}).strict().partial()` 还是显式所有字段 `.optional()` 写法（语义等价但报错信息不同），由 planner 选；推荐显式 `.optional()` 写法以便单字段断言（`schema.shape.backgroundTaskCount`）。
- `SyncEventSchema` 中 `session-added` 的 `data` 是否强制 = `SessionSchema`（不允许 patch），由 researcher 评估 hub 现状决定（推荐强制：`session-added` 没有「之前的状态」可 patch，逻辑上必全量）。
- useSSE 解析失败后是否上报到 `onError` callback（而非纯 log），由 researcher 决定（推荐：dev 模式 `console.error` + 抛到 `onError`；prod 模式静默 drop，等下次 event 覆盖）。
- hub `eventPublisher.emit` 入口是否加 dev 模式 `SyncEventSchema.parse()` 自检（生产跳过），由 planner 决定；推荐加，避免「web 升级 schema 而 hub 落后」时 silent broken。
- cli `RunnerState.status` / `shutdownSource` 的 `z.union([z.enum, z.string])` 宽松形状 narrow 时机：D-115 说留 Phase 10，但如果 researcher 发现 cli 内部根本没产生过非枚举值，本 phase 顺手 narrow 也可，加入 PLAN.md 决策。
- `SessionsResponse / SessionResponse / MessagesResponse / MachinesResponse / SpawnResponse` 等 wrapper 上提的具体清单（D-114）由 researcher 按 ripgrep 平行 type 命中清单确定；本 phase 至少做 sessions/session/messages/machines 四个核心 wrapper。

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 项目宪法

- `.planning/PROJECT.md` — Cursor-only 单 agent 定位；移动端 + Tailscale 带宽敏感场景（D-116 选 patch 而非全量的依据）。
- `.planning/REQUIREMENTS.md` §「v1 Requirements」— **REFA-03 / REFA-04 映射 Phase 7**；REFH-01/02/03/04 留 Phase 8、REFW-01/02/03 留 Phase 9、REFC-01/02 留 Phase 10、REFT-01/02/03 留 Phase 11、CUT-12 留 Phase 12。
- `.planning/ROADMAP.md` §「Phase 7: Wire contracts unification & SSE patch contract」— **SC#1–#4 是验收锚点**：(SC#1) Session/Machine/Message/RunnerState 在 shared/src/schemas.ts 唯一定义、cli/src/api/types.ts + web/src/types/api.ts + hub/src/web/routes/ + hub/src/sync/sessionCache.ts 零重复 declaration；(SC#2) `hasUnknownSessionPatchKeys` 删除、SSE 走「全量 SessionSummary/MachineSummary 或严格 patch schema」二选一（D-116 已选 patch）；(SC#3) 前端 SSE handler 消费 canonical schema、TanStack Query cache 更新无「fallback to refetch list」分支；(SC#4) bun typecheck + bun run test 绿 + 新加 strictly typed event stream test。
- `AGENTS.md` — No backward compatibility、TypeScript strict、Bun workspaces、4 空格缩进、必要测试。

### Prior Phase Decisions（关键继承点）

- `.planning/phases/01-cut-non-cursor-agents/01-CONTEXT.md` — D-11~D-13 源码关键词零容忍 + 白名单、D-14/D-15 小提交 + 每提交测试。
- `.planning/phases/02-cut-external-integration-channels/02-CONTEXT.md` — D-22/D-32 删除型 phase 不加兼容 shim（Phase 7 一次切干净 wire 字面量遗债的依据）。
- `.planning/phases/03-cut-multi-user-namespace-isolation/03-CONTEXT.md` — D-41 显式失败 vs silent fallback（D-120 useSSE 解析失败 = drop + log，不 refetch 的同源思路）。
- `.planning/phases/04-cut-deployment-infrastructure/04-CONTEXT.md` — D-65~D-67 源码级 zero-tolerance + 白名单、长篇 docs 留 Phase 12。
- `.planning/phases/05-flavor-consolidation-capability-abstraction/05-CONTEXT.md` — **D-70「彻底删除 wire/session 上的 flavor 字段 → Phase 7」**、**D-81「AGENT_MESSAGE_PAYLOAD_TYPE = 'codex' 改名 → Phase 7」**、D-84/D-86 ripgrep guard + 4 切片节奏。Phase 5 `<deferred>` 第 1/2 项点名本 phase 兑现。
- `.planning/phases/05-flavor-consolidation-capability-abstraction/05-RESEARCH.md` §「Wire-layer narrow safety」§1 — `MetadataSchema.flavor: z.string().nullish()` 标为「面向后兼容临时保留」，本 phase D-122 收回这条保留。
- `.planning/phases/06-agent-runtime-shared-kit-mode-hardening/06-CONTEXT.md` — D-97 `EnhancedMode` 留 cli-runtime 不上提（Phase 7 sclamp 范围避雷点）、D-107~D-110 4 切片 + ripgrep + madge guard 模板（Phase 7 D-125~D-126 直接复用此模板）。

### Codebase Maps

- `.planning/codebase/ARCHITECTURE.md` — cli/hub/web 三端 wire 流向（CLI ↔ Hub Socket.IO，Hub ↔ Web SSE，Web ↔ Hub Socket.IO terminal）。
- `.planning/codebase/STACK.md` — `shared/src/` 在 `@hapi/protocol` workspace 中的位置；Hono / Zod / TanStack Query 在各端的版本。
- `.planning/codebase/INTEGRATIONS.md` — Cursor agent CLI 调用界面，与 wire schema 的边界。

### 本 phase 直接相关源码 / 调用点

**shared/（schema 新增 + 字面量动）：**
- `shared/src/schemas.ts` — 新增 `MachineSchema / MachineMetadataSchema / RunnerStateSchema / SessionPatchSchema / MachinePatchSchema`；`SyncEventSchema` 中 3 类 event `data` 字段 union 化（D-119）；删除 `MetadataSchema.flavor` 字段（D-122）。
- `shared/src/modes.ts:9` — `AGENT_MESSAGE_PAYLOAD_TYPE` 值改 `'cursor' as const`；JSDoc 锚点更新（D-123）。
- `shared/src/messages.ts` — Message wire schema 上提目标（researcher 选 schemas.ts 还是这里，D-112）。
- `shared/src/types.ts` — re-export 新 schema/types；导出表对齐。
- `shared/src/schemas.test.ts`（新文件 或 扩 `flavors.test.ts`）— D-127#1 新单测。

**hub/（broadcast 收敛 + flavor 字段写入清理 + response wrapper 收敛）：**
- `hub/src/sync/sessionCache.ts` — 全部 `publisher.emit({...})` payload conform `SessionPatchSchema`（含 `backgroundTaskCount` patch）；删 metadata flavor 写入。
- `hub/src/sync/machineCache.ts` — `Machine` interface 改为 re-export shared；`publisher.emit` payload conform `MachinePatchSchema`（D-118）。
- `hub/src/sync/eventPublisher.ts` — 可选加 dev 模式 `SyncEventSchema.parse()` 自检（Claude's Discretion）。
- `hub/src/sync/syncEngine.ts:11,31` — `import type` from `@hapi/protocol/types` 对齐新 schema；re-export 形状不变；删除残留 flavor 写入路径。
- `hub/src/notifications/sessionInfo.ts` — `getFlavorLabel` 调用 + metadata flavor 读取收敛（删调用即可，Cursor-only 无 label 分流）。
- `hub/src/web/routes/sessions.ts` / `machines.ts` / `messages.ts` — `SessionsResponse / SessionResponse / MachinesResponse / MessagesResponse` wrapper 改 import shared 新定义（D-114）。
- `hub/src/sse/sseManager.test.ts` 或 `hub/src/sync/sessionCache.test.ts` — D-127#3 broadcast contract test。

**cli/（types 收敛 + 写入清理）：**
- `cli/src/api/types.ts:32-88` — 删除本地 `MachineMetadataSchema / RunnerStateSchema / Machine`，全部 re-export shared。
- `cli/src/api/types.ts:102-122` — `CreateSessionResponseSchema` 内联 schema 删除，改为 `z.object({ session: SessionSchema })`（D-113）。
- `cli/src/api/types.ts:152-189` — `MessageMetaSchema / UserMessageSchema / AgentMessageSchema / MessageContentSchema` re-export shared（D-112）。
- `cli/src/agent/sessionFactory.ts` 等写 metadata 的入口 — 删除 metadata flavor 字段写入（D-122）。
- `cli/src/api/apiSession.ts` / `apiMachine.ts` — `import type` 调整到新 shared 来源。

**web/（重复定义清理 + useSSE 重写）：**
- `web/src/types/api.ts:50-77` — 删除本地 `Machine / RunnerState`，从 `@hapi/protocol/types` re-export。
- `web/src/types/api.ts:26-40` — `SessionMetadataSummary` 删除 `flavor` 字段（D-122）。
- `web/src/hooks/useSSE.ts` — 删除 `SessionPatch` 本地 type + 7 个 narrow 函数（D-121）；`handleSyncEvent` 改 `SyncEventSchema.safeParse(parsed)` + discriminator branch；删除「未知字段触发整列表 refetch」分支（D-120）。
- `web/src/hooks/useSSE.test.tsx`（新文件）— D-127#2 strictly typed event stream test。
- `web/src/types/api.ts:240` — `SyncEvent` re-export 对齐新 union 形态。

**guard / scripts：**
- `scripts/check-no-cut-agents.sh:13,84,91,96` — 删除 `AGENT_MESSAGE_PAYLOAD_TYPE` 行级白名单 + Phase-5 territory `'codex'` 例外；追加 Phase 7 D-126 关键词扫描（`hasUnknownSessionPatchKeys` / `getSessionPatch` in web/src/hooks/ / `interface Machine` in cli|web / `RunnerStateSchema` in cli|web / `'codex'` 全包零容忍 / metadata `flavor:` 写入扫描）。

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- `shared/src/schemas.ts` 已有完整 `SessionSchema` + `SyncEventSchema` discriminatedUnion 骨架 —— 本 phase 只在既有 union 中**收窄** `data` 字段（unknown → 强类型 union），不重写 union 结构。
- `cli/src/api/types.ts::MachineMetadataSchema` / `RunnerStateSchema` 已是完整 Zod，上提到 shared 几乎是 cut-paste（注意 `workspaceRoot` ↔ `workspaceRoots` 的 `.transform` 行为保留）。
- `cli/src/api/types.ts::UserMessageSchema / AgentMessageSchema / MessageContentSchema` 已是 discriminatedUnion-ready，上提到 shared 零结构改动。
- `web/src/hooks/useSSE.ts` 中 `upsertSessionSummary / patchSessionSummary / patchSessionDetail / upsertMachine` 等 cache mutator 是稳定的 React Query 操作，本 phase 保留这些函数本体、只换其入参类型来源。
- P5/P6 模板：4 切片节奏、ripgrep + madge guard sweep、no shim/feature-flag 一次切干净 —— 本 phase 直接复用 D-125~D-126 模板。
- `scripts/check-no-cut-agents.sh` 是既有可执行 guard 脚本，本 phase 在它上面追加 D-126 sweep block（不新建脚本）。

### Established Patterns

- 删除型 / 收敛型 phase：「最小切除 + 一次切干净 + ripgrep zero-tolerance」（P2/P4/P5/P6 一脉），no feature flag / no shim / no field alias。
- `shared/` 是 wire / type / 跨端共享语义唯一来源（cli-runtime concept 留 cli/，P6 D-97）；本 phase 严格在 wire 层动手。
- 类型 narrow 让 TS 编译器暴露所有调用点 —— 按 narrow 后编译报错驱动收敛清单（P4/P5/P6 同款工作流）。`CreateSessionResponseSchema` narrow（D-113）+ `SyncEvent.data` 收紧（D-119）都会触发批量编译失败 → 按清单收敛。
- 切片每片绿色：`bun typecheck` + `bun run test` 全包；最后切片追加 ripgrep guard（与 P5 D-86 / P6 D-107 节奏一致）。
- discriminator union schema 优先 `.strict()`，未知字段抛错（vs `.passthrough()` 容忍）—— 与 D-120「parse 失败 = drop + log，不 refetch」同源「显式失败 vs silent fallback」(P3 D-41)。

### Integration Points

- **Hub → Web SSE**：`hub/src/sync/eventPublisher.ts::emit` 是出口，本 phase 在此对齐 schema（可选 dev parse 自检）；`hub/src/sse/sseManager.ts::broadcast` 是通道，不动。
- **Hub → CLI Socket.IO**：通道形状本 phase 不动；只有 Machine/Session/Message DTO 类型来源换为 shared。
- **Web SSE 接收**：`web/src/hooks/useSSE.ts::handleSyncEvent` 是唯一入口，本 phase 改的就是这里。
- **TanStack Query 缓存形态**：`web/src/lib/query-keys.ts`、cache mutator 本身不动；只是入参类型来源换。
- **SQLite store 写入**：本 phase 不动 store schema 与表结构；只动「写入 metadata 时不再写 flavor」「写入 message 时 type 字段从 'codex' → 'cursor'」两条数据路径。老数据解码失败由 Phase 10 schema-version reject 兜底（D-116 / D-123）。
- **既有 P5/P6 source guard**：`scripts/check-no-cut-agents.sh` 在本 phase 4# 切片追加新 sweep + 删除 `AGENT_MESSAGE_PAYLOAD_TYPE` 白名单。

</code_context>

<specifics>
## Specific Ideas

- `web/src/hooks/useSSE.ts:104-110` 的 `hasUnknownSessionPatchKeys` 函数体能直接定位为「热补丁兜底」—— 它的 known keys 集合 `['active','thinking','activeAt','updatedAt','model','modelReasoningEffort','effort','permissionMode']` 漏了 `backgroundTaskCount`，所以 hub `sessionCache.ts:283` 的单字段 backgroundTaskCount patch 在 web 端总是触发整列表 refetch。这是 SC#2 最直观的 "活靶子"，PLAN 中应该把这个 case 明确列为「Phase 7 解决的代表性 bug」。
- `hub/src/sync/sessionCache.ts` 中 emit patch 的字段子集随场景变化（如 `recordSessionActivity` 只 emit `updatedAt`；`onPermissionModeChanged` emit 4 字段；`applyBackgroundTaskDelta` 只 emit `backgroundTaskCount`）—— `SessionPatchSchema` 必须全字段 `.optional()` 覆盖这些 strict 子集，researcher 在切片 1 完成后在 hub 侧做一次完整 emit 字段集枚举（grep `publisher.emit({` 全列），与 schema 字段集对账。
- `shared/src/schemas.ts::SessionSchema` 已含 `permissionMode: PermissionModeSchema.optional()`（P5 P07 narrow 后）—— `SessionPatchSchema` 的 `permissionMode` 也用 `PermissionModeSchema`，自动跟随 P5/P6 narrow 不需要本 phase 介入。
- `web/src/types/api.ts:240` 的 `export type SyncEvent = ProtocolSyncEvent` 是 re-export 一行，本 phase 不动；变化的是 `ProtocolSyncEvent` 自身。
- `MetadataSchema.flavor: z.string().nullish()` 当前是 wire 上唯一保留的「historical compat」字段（P5 RESEARCH §"Wire-layer narrow safety" §1 明确标注）。本 phase D-122 的核心 narrative 之一就是「收回 P5 临时保留」，PLAN 引用 P5 RESEARCH 锚点。
- `AGENT_MESSAGE_PAYLOAD_TYPE = 'codex' as const` rename 的副作用 = SQLite 中已存 cursor message 行 `content.type === 'codex'` 在 strict discriminator 下解码失败。这是「项目策略 no backward compat」+「单用户本地 SQLite，可清库重启」的典型情境，PLAN 中作为已知 known-issue + Phase 10 兜底文档化，不写迁移代码。

</specifics>

<deferred>
## Deferred Ideas

- **REFH-01 / REFH-02：`SessionCache`（796 行）与 `SyncEngine`（854 行）拆分；SSE 不再 `import { SyncEngine }`（只依赖 shared 事件类型）** —— **Phase 8**。本 phase 只动 emit 形状，不拆文件、不动 SSE 与 SyncEngine 之间的 import 拓扑。
- **REFH-03：hub `parseJsonBody / withEngine / withSession / withActiveSession / withMachine` helper + `ApiRouteError` + `sessions.ts` 按职责拆** —— **Phase 8**。本 phase 顺手上提 response wrapper（D-114），但路由文件本身不拆。
- **REFH-04：集中 keepalive 调度器（SSE / SyncEngine / terminalRegistry / notificationHub 的 setInterval 收敛 + 全部清理）** —— **Phase 8**。本 phase `hub/src/sse/sseManager.ts:124` 的 `setInterval(heartbeat)` 留原样。
- **REFW-01：ToolCard 11 文件循环依赖打破 + 所有 tool resolves to renderer 集成测试** —— **Phase 9**。
- **REFW-02：oversized files 拆分（SessionList 990 / message-window-store 1087 / reducerTimeline 925 / settings 847 / HappyComposer 870）** —— **Phase 9**。本 phase **不**动 `message-window-store.ts`，即使 useSSE 中有 `ingestIncomingMessages / removeOptimisticMessage` 调用关系。
- **REFW-03：Levenshtein / base64 / Cursor permission-mode mapping / `createApiQuery` 上提到 shared** —— **Phase 9**。本 phase 只上提 wire schema，不收敛 util 函数。
- **REFC-01：SQLite 运行时迁移代码全删 + schema-version mismatch reject + 离线迁移工具入口** —— **Phase 10**。本 phase `AGENT_MESSAGE_PAYLOAD_TYPE` rename 与 `metadata.flavor` 删除产生的老数据解码失败问题，明确**接受 Phase 10 schema-version reject 兜底**（D-116 / D-123）。
- **REFC-02：`loadConfig()` 返回 `Readonly<...>` + DI 取代 `_setApiUrl()` setter** —— **Phase 10**。
- **REFT-01 cursor permission-mode → CLI flag 完整矩阵测试** —— **Phase 11**。本 phase 只补 3 类 schema/SSE 测试。
- **REFT-02 SSE reconnect / patch-loss 不变量测试** —— **Phase 11**（与本 phase 测试关系密切但 Phase 11 owned）。本 phase 不写 reconnect 场景测；D-127#2 只测「strictly typed event stream 下的 happy path + parse-failure drop」。
- **REFT-03 auth 路由 negative cases（bad token / 过期 JWT / replayed JWT / 空 body）** —— **Phase 11**。
- **`RunnerState.status` / `shutdownSource` 的 `z.union([z.enum, z.string])` 宽松形状 narrow 到纯 enum** —— **Phase 10**（默认；如果 researcher 在本 phase 发现无生产值需保留，可顺手做，加入 PLAN）。
- **README / AGENTS / docs / website 中 `'codex'` 提及清理** —— **Phase 12 (CUT-12)**。本 phase 只动源码 + 测试 + guard 脚本，不动 prose 文档。
- **CURS-01~05 v2 能力（model 切换 / skills toggle / MCP servers / agent status / browser screenshot）** —— **Milestone 2**。本 phase wire schema 设计**不**预留这些字段（避免过度抽象，与 P5 D-74 同源「不塞当前无调用方的未来字段」）；未来加字段时扩 schema 即可。

</deferred>

---

*Phase: 7-Wire contracts unification & SSE patch contract*
*Context gathered: 2026-05-22*
