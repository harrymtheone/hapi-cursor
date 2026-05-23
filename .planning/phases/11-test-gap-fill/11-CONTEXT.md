# Phase 11: Test gap fill - Context

**Gathered:** 2026-05-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 11 关闭三条测试空白带，**只补测试 + 守卫，不动产品代码语义**：

- **REFT-01：** 一份 Cursor `PermissionMode → CLI flag` 完整矩阵测试，覆盖 `default / plan / ask / yolo` 全部行；任何人新增 `PermissionMode` 又忘了补矩阵行 → 编译期或运行期立刻失败。
- **REFT-02：** 一份 SSE 重连 / patch-loss **收敛不变量**测试 —— 模拟事件丢失 + 重连，断言前端 query cache 在 bounded retry budget 内收敛到 server 端权威 `SessionSummary` / `MachineSummary`。
- **REFT-03：** `hub/src/web/routes/auth.ts` 与 `hub/src/web/middleware/auth.ts` 负面用例 —— bad token / expired JWT / replayed (post-expiry) JWT / 空 body / 篡改签名 / 缺少 header / 错误 alg —— 全部返回预期 4xx 且不向响应体或日志泄漏 secret。
- 末尾追加 ripgrep / typecheck guard block 到 `scripts/check-no-cut-agents.sh`，与 Phase 10 同款 cadence。

**In scope:**

- `cli/src/agent/permissionMatrix.test.ts`（新文件）— 类型穷尽 + 运行期键比对 + 行级 args 断言。
- `web/src/hooks/useSSE.test.tsx` 扩展 —— 加入"丢事件 + 重连 → 收敛"用例，使用 MockEventSource + `vi.useFakeTimers`。
- `hub/src/web/routes/auth.test.ts`（新文件，bun:test）— 通过 `app.request()` 测 route 层 4xx。
- `hub/src/web/middleware/auth.test.ts`（新文件，bun:test）— 测 middleware 层对 JWT 异常的拒绝。
- 共享 helper `assertNoSecretLeak(res, capturedLogs, secrets[])` —— 用于 REFT-03 所有用例。
- Phase 11 guard 块（追加至 `scripts/check-no-cut-agents.sh`）。
- coverage baseline 数字采集（一次性，记入 DISCUSSION-LOG.md）。

**Out of scope:**

- **不**实现任何 JWT replay-detection 机制（黑名单 / nonce / 单次使用）—— 单用户 Tailscale + 4h 过期已满足项目方针。"Replayed JWT" 只验证"过期后重放仍被拒绝"。
- **不**引入真起 hub + 真 EventSource 的 integration test。REFT-02 全程单元 + Mock。
- **不**新增 CI 覆盖率门禁。Coverage 非回归靠人工对照 Phase 10 末态 baseline。
- **不**重写 `useSSE.ts` 现有 patch contract —— Phase 7（SSE 严格 schema）会改写，本期测试以最终状态收敛为断言，避免与 Phase 7 重叠。
- 不动 Phase 7 / 8 / 9 仍在 in-progress 的产品改动。

**已知依赖风险（surface 到 plan）：**

- ROADMAP 上 Phase 11 `Depends on: Phase 10`，但实际上 REFT-02 的 SSE 行为契约由 Phase 7 收紧。Phase 7 当前 1/4 完成。**缓解策略**：REFT-02 测试只断言"重连后 cache === server 权威状态"，不断言中间 patch shape。Phase 7 自己的 SC#4 已声明它会加严格 patch schema 的测试，二者不重叠。
- Phase 8 仍会重排 `hub/src/sse/`、Phase 9 会再拆 web 内部。本期测试落在不会被 8 / 9 移动的入口（useSSE hook、auth route 顶层），降低后续 churn。

</domain>

<decisions>
## Implementation Decisions

### 1. REFT-01 — Permission matrix mechanism

- **D-176：双保险穷尽。** 矩阵用 `satisfies Record<PermissionMode, ExpectedSpec>` 字面量，漏一行 `PermissionMode` 联合中的 mode → TypeScript 编译失败（`bun typecheck` 拦截）。同时运行期 `expect(Object.keys(MATRIX).sort()).toEqual((['default','plan','ask','yolo'] satisfies PermissionMode[]).sort())` 作为对"加了 mode 又加 row 但 spec 错写"的二次防线。
- **D-177：矩阵驱动 args 断言。** 对矩阵每一行调用 `permissionModeToCursorArgs(row.mode)`，与该行的 `expectedArgs: string[]` 完全相等比较。不接受"包含"或"开头匹配"等弱断言。
- **D-178：单独文件，单一职责。** 新建 `cli/src/agent/permissionMatrix.test.ts`，保持现有 `cli/src/agent/modeConfig.test.ts` 专注 `UnknownPermissionModeError` 与一般行为测试。矩阵文件是 REFT-01 的唯一履约文件，便于审计与未来改 mode 时的"必读"指引。
- **D-179：守卫追加。** `scripts/check-no-cut-agents.sh` 末尾新增 Phase-11 块：ripgrep 强制 `permissionMode` 相关分支不得在 `cli/src/cursor/` 与 `cli/src/agent/` 之外出现 hardcoded 比较（与 Phase 5 / Phase 6 守卫互补，不重复 pattern）。

### 2. REFT-02 — SSE 重连测试形态

- **D-180：单元 + MockEventSource，不起真 hub。** 在 jsdom 环境下注入一个由测试控制的 `MockEventSource`（实现 `addEventListener / dispatchEvent / readyState / close`），用 `vi.useFakeTimers` 推进退避计时。集成测试不在本期范围。
- **D-181：以最终一致性为不变量。** 用例脚本：
  1. 建立连接 → server emit 一组 SSE 事件 → cache 收敛到 state A。
  2. 强制 `error` 事件断线 → fake-timers 推进过重连退避。
  3. 重连期间 server 又发若干事件，故意"丢掉"其中一条。
  4. 重连成功后 server 推一份权威 `SessionSummary[]` snapshot（或当前 useSSE 触发的 refetch 路径）→ 断言 cache === server snapshot。
- **D-182：retry budget 数字由 researcher 从 `useSSE.ts` 现存实现读出。** 不在 CONTEXT 里硬编码。当前实现里如有 `BACKOFF_MS` / `MAX_RETRIES` 字面量，测试直接 import 这些常量比较；如果没有，researcher 报告实际行为，planner 决定要不要在 `useSSE.ts` 抽常量出来（仅为可测性，不改语义）。
- **D-183：测试断言 Phase-7 安全。** 不断言 `hasUnknownSessionPatchKeys` 是否被调用、不断言"refetch 列表"还是"打补丁"。只断言最终 cache 内容。Phase 7 改写 useSSE 后这些用例应当仍然通过（除非 Phase 7 改变了"最终一致"语义本身，那时由 Phase 7 PR 同步更新）。

### 3. REFT-03 — Auth 负面用例

- **D-184：不引入 replay-detection。** "Replayed JWT" 解读为"同一 JWT 在 4h 过期后再次出示仍被拒绝"，由 `jose` 现有 `exp` 校验保证。不新增黑名单 / nonce / single-use 机制 —— 与项目方针「单用户 Tailscale、无向后兼容、清晰胜于过度防御」一致。
- **D-185：两层分别测，不耦合。**
  - `hub/src/web/routes/auth.test.ts`（bun:test，`app.request()`）覆盖：`{}` 空 body → 400、缺 `accessToken` 字段 → 400、`accessToken` 非字符串 → 400、坏 token → 401、合法 token → 200 + JWT 结构合法。
  - `hub/src/web/middleware/auth.test.ts`（bun:test）覆盖：缺 `Authorization` header → 401、Bearer 但 token 空 → 401、过期 JWT（`exp` 已过）→ 401、篡改签名 → 401、错误 `alg`（如 `none` / `RS256`）→ 401、`uid` 与 `ownerId` 不符 → 401。
- **D-186：不泄密自动断言。** 共享 helper `assertNoSecretLeak(responseBody, capturedLogs, secrets)`：
  - `expect(responseBody).not.toContain(token)` 对每个 secret。
  - `spyOn(console, 'error' | 'warn' | 'log').mockImplementation(...)` 捕获测试期间所有日志输出，遍历断言不含 secret 子串。
  - 每个 REFT-03 失败用例都套这个 helper，保证错误响应只暴露通用提示（`'Invalid body'` / `'Invalid access token'`）。
- **D-187：JWT 构造工厂集中。** 在 `hub/src/web/middleware/auth.test.ts` 顶部以 `make*` 模式提供 `makeValidJwt / makeExpiredJwt / makeTamperedJwt / makeWrongAlgJwt` 工厂（用 `jose.SignJWT`），按 TESTING.md 惯例 module-local。

### 4. 覆盖率与质量门

- **D-188：本期不加 CI 覆盖率门禁。** Plan 收尾跑 `cd cli && bun run vitest run --coverage`，把 `cli/src/cursor/` + `cli/src/agent/` + `hub/src/web/routes/auth.ts` + `hub/src/sse/` + `web/src/hooks/useSSE.ts` 的行覆盖率数字记入 DISCUSSION-LOG.md。Phase 10 最末点作为对比 baseline（如可获取）。CI 集成留给 Phase 12 verification 决定。
- **D-189：每个 slice 独立绿。** 沿用 Phase 10 / Phase 9 的 cadence —— REFT-01 → REFT-03 → REFT-02 → guard sweep + coverage snapshot，每个 slice 独立通过 `bun typecheck` + `bun run test` 后再进下一个。
- **D-190：测试不引入新 production 代码。** 唯一例外：若 `useSSE.ts` 的退避常量需要 export 出来供测试 import，可以做"只 export、不改值"的最小改动，并在 PLAN.md 明示。任何其他 production 改动 → 视为 scope creep，开 issue 留给后续 phase。

### Claude's Discretion

- Slice 切分顺序（推荐：REFT-01 先 → REFT-03 中 → REFT-02 后 → guard + coverage 收尾，因为 REFT-02 风险最高、最依赖 researcher 阅读 useSSE 当前实现细节）由 planner 自主调整。
- `MockEventSource` 究竟全局 monkey-patch `globalThis.EventSource` 还是通过 useSSE 的 dependency seam 注入，由 researcher 看完 `useSSE.ts` 后给 planner 建议，二者皆可。
- `assertNoSecretLeak` 放在 `hub/src/test-utils/` 还是 `hub/src/web/test-utils/` 由 planner 决定（hub 当前是否已有 test-utils 目录，scout 阶段没有翻到）。
- Phase-11 guard 块的精确 ripgrep pattern 由 planner 设计；要求是与 Phase 5 / 6 / 10 现有块**不重叠**。

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project scope and requirements

- `.planning/PROJECT.md` — 项目方针：Cursor-only、单用户 Tailscale、无向后兼容、清晰胜于过度防御 —— 直接背书 D-184「不加 replay detection」。
- `.planning/REQUIREMENTS.md` §REFT-01 / REFT-02 / REFT-03 — Phase 11 的三条履约项原始描述（含中文意图）。
- `.planning/ROADMAP.md` §Phase 11 — Success Criteria 四条：矩阵覆盖 + 新 mode 必失败、SSE 重连 bounded budget 内收敛、Auth 负面 4xx 且不泄密、`bun run test` 绿 + 覆盖率不回归。
- `.planning/ROADMAP.md` §Phase 7 — REFT-02 跨阶段依赖风险来源（Phase 7 改写 useSSE patch contract）。

### Prior phase decisions to carry forward

- `.planning/phases/10-config-cleanup/10-CONTEXT.md` D-160 ~ D-175 — 沿用「一次切干净 + guard sweep + slice 独立绿」cadence。
- `.planning/phases/09-web-internal-decoupling/09-CONTEXT.md` D-157 / D-158 — slice + 末尾 guard 模式参考。
- `.planning/phases/06-agent-runtime-shared-kit-mode-hardening/` —— Phase 6 已落地 `modeConfig.ts` + `UnknownPermissionModeError`，REFT-01 矩阵建立在其上。
- `.planning/phases/05-flavor-consolidation-capability-abstraction/` —— Phase 5 已落 `FLAVOR_CAPS.cursor.permissionModes`（capability 表），REFT-01 矩阵的"期望集"应与 capability 表一致。

### Codebase maps

- `.planning/codebase/TESTING.md` — **必读**。三种 runner 分布（cli/web=Vitest、hub/shared=bun:test）、co-located `*.test.ts(x)`、`vi.mock + vi.hoisted` 模式、`:memory:` Store、`<I18nProvider>` 包裹、`as unknown as T` 局部 mock、`make*` factory、anti-patterns（不用 setTimeout 等状态、不跨 runner import）—— REFT-01/02/03 全部测试文件必须遵守。
- `.planning/codebase/STRUCTURE.md` — 三包目录形态，帮 planner 决定 `assertNoSecretLeak` helper 的安放位置。
- `.planning/codebase/ARCHITECTURE.md` — Hub `routes/` + `middleware/` + `sse/` 的关系；useSSE ↔ TanStack Query cache 的更新边界。
- `.planning/codebase/CONVENTIONS.md` — TypeScript strict、named exports、constructor DI；约束新建测试与 helper 的写法。

### Source-of-truth files for downstream research

- `cli/src/agent/modeConfig.ts` — `permissionModeToCursorArgs` 实现，REFT-01 矩阵 SUT。
- `cli/src/agent/modeConfig.test.ts` — 现有错误路径测试，REFT-01 新文件要与之**互补不重叠**。
- `cli/src/cursor/modes.ts` — `PermissionMode` 类型与 `CursorPermissionMode` re-export，REFT-01 类型穷尽源头。
- `shared/src/flavors.ts` — `FLAVOR_CAPS.cursor.permissionModes` capability 表，REFT-01 的"期望全集"与之对齐。
- `web/src/hooks/useSSE.ts` + `web/src/hooks/useSSE.test.tsx` — REFT-02 SUT 与现有测试基线；retry budget 实际数字源。
- `hub/src/web/routes/auth.ts` — REFT-03 route 层 SUT（49 行，已读过）。
- `hub/src/web/middleware/auth.ts` — REFT-03 middleware 层 SUT。
- `scripts/check-no-cut-agents.sh` — Phase-11 guard 块的追加位置。

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- `cli/src/agent/modeConfig.ts::permissionModeToCursorArgs` + `UnknownPermissionModeError` 已存在（Phase 6 落地），REFT-01 矩阵直接以它为 SUT，无需新建任何 production 代码。
- `cli/src/agent/modeConfig.test.ts` 已存在，REFT-01 新文件 `permissionMatrix.test.ts` 仅补"完整矩阵 + 类型穷尽"维度，不重写错误路径用例。
- `web/src/hooks/useSSE.test.tsx` 已存在（Phase 7 Slice 1 在其上扩展过 `backgroundTaskCount` 回归），REFT-02 在同文件追加"丢事件 + 重连 → 收敛"`describe` 块即可，沿用现有 setup。
- `hub/src/web/routes/cli.test.ts` / `machines.test.ts` / `messages.test.ts` 已演示了 hub 路由测试的 bun:test 模式（`app.request()`），REFT-03 `auth.test.ts` 照搬同款骨架。
- `hub/src/store/index.ts` `:memory:` Store 模式来源；REFT-03 测试若需要 Store 走 `:memory:`，遵循 TESTING.md 的约束。

### Established Patterns

- 「一次切干净 + slice 独立绿 + 末尾 guard sweep」—— 沿用 Phase 5 / 6 / 9 / 10 节奏。
- `vi.hoisted(() => vi.fn())` + `beforeEach mock reset` —— Vitest 那一侧（cli / web）必须遵守。
- `bun:test` 用 `mock(impl)` 与 `spyOn(...).mockRestore()` —— hub 一侧必须遵守，且禁止跨 runner import（TESTING.md anti-pattern）。
- `make*` 模块局部工厂、`as unknown as T` 局部 mock、`<I18nProvider>` 包裹 —— 测试新文件必须按此风格起手。

### Integration Points

- REFT-01：测试只 import `cli/src/agent/modeConfig.ts` + `cli/src/cursor/modes.ts` 的类型，无 runtime 集成边界。
- REFT-02：MockEventSource 注入边界由 researcher 决定（globalThis monkey-patch vs useSSE 内部 EventSource factory seam），但**绝不**改 useSSE 的语义。
- REFT-03 route：`createAuthRoutes(jwtSecret, cliApiToken, ownerId)` 三参数显式构造，配合 Hono `app.request()` —— 与 Phase 10 frozen config / DI 风格天然契合，无需额外脚手架。
- REFT-03 middleware：`hub/src/web/middleware/auth.ts` 当前用 `jose` 验 JWT；测试直接构造各种坏 JWT 调中间件即可，不需要起 server。
- Guard sweep：`scripts/check-no-cut-agents.sh` 末尾已有 Phase 5 / 6 / 9 / 10 块（按 ROADMAP 推断），Phase 11 块紧跟其后，由 planner 设计精确 pattern 后接入。

</code_context>

<specifics>
## Specific Ideas

- **REFT-01 矩阵期望行（初稿，planner 可调）：**
  - `default` → `[]`（或 cursor CLI 默认无 flag —— researcher 从 `permissionModeToCursorArgs` 实际读出）
  - `plan` → 对应 plan 模式 flag
  - `ask` → 对应 ask 模式 flag
  - `yolo` → 对应 yolo / bypass 模式 flag
  - 期望值**必须**与 `permissionModeToCursorArgs` 真实返回完全一致，researcher 阶段填实。
- **REFT-02 必含用例：**
  - `it('SSE 重连成功后 query cache 收敛到 server 权威 SessionSummary')`
  - `it('单次 SSE 事件丢失 + 后续事件继续 → cache 收敛到最新事件而非中间态')`
  - `it('达到 retry budget 上限后停止重连并暴露 error state')`
  - `it('正常断线 → 重连一次成功 → 不影响后续事件处理')`
- **REFT-03 必含用例（按层归类）：**
  - Route：`POST /auth` 空 body → 400；`{ accessToken: '' }` → 401；`{ accessToken: 'wrong' }` → 401；非 JSON body → 400；合法 token → 200 + 返回 JWT 可被解码。
  - Middleware：无 header → 401；`Bearer ` 后空 → 401；过期 JWT → 401；篡改签名 → 401；`alg: 'none'` 伪造 → 401；`uid != ownerId` → 401。
  - 所有失败用例：`assertNoSecretLeak(res.text(), capturedLogs, [cliApiToken, jwtSecret.toString('base64')])`。
- **CI / guard 注意：**
  - 不要在 guard pattern 里写 `permissionMode` 三个原始字母 —— 会扫到测试文件本身。用 `if \(\s*flavor\s*===` / `switch\s*\(\s*permissionMode\s*\)` 这种结构性 pattern。
  - guard 块标题用 `# Phase 11 — REFT guards`，与现有块保持视觉一致。

</specifics>

<deferred>
## Deferred Ideas

- **JWT replay-detection（黑名单 / nonce / single-use token）** —— 与 PROJECT.md 单用户 Tailscale 方针冲突，本期明确不做。如未来真需要（多设备并发 + token 泄露场景），起一个独立的 SEC-* requirement 进 Milestone 2 + roadmap backlog。
- **SSE 真实集成测试（起真 hub + 真 EventSource）** —— 本期不做。Phase 12 VRFY-05 的"手动 Tailscale 端到端"已覆盖人工层面；自动化 integration 留待引入 playwright 时一并设计。
- **CI 覆盖率门禁** —— 本期只采 baseline。Phase 12 verification 决定是否落 CI gate。
- **`useSSE.ts` 抽出可测性常量** —— 仅当 D-182 触发"researcher 报告退避值为 hardcoded 字面量、不方便测试"时考虑；本期不主动重构。
- **共享 test-utils 包** —— 当前 `assertNoSecretLeak` 只服务 REFT-03，下沉到 `hub/src/test-utils/`。如果未来 CLI / Web 也需要类似 helper，再考虑提到 `shared/test-utils/`。

</deferred>

---

*Phase: 11-Test gap fill*
*Context gathered: 2026-05-23*
