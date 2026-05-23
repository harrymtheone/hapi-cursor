# Phase 11: Test gap fill - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-23
**Phase:** 11-Test gap fill
**Areas discussed:** Phase-7 跨期依赖、矩阵机制、SSE 测试形态、Auth 负面用例、不泄密强制、覆盖率非回归
**Discussion style:** 用户选择「按照你的推荐来」—— Claude 一次性给出全部六个灰色地带的推荐决定，用户隐式确认。

---

## A — Phase 7 跨期依赖冲突 (REFT-02)

| Option | Description | Selected |
|--------|-------------|----------|
| A1 | 推迟 REFT-02 到 Phase 7 完成后 | |
| A2 | 现在写，断言中间 patch shape（会被 Phase 7 重写）| |
| A3 | 现在写，但只断言"重连后最终一致性"，避开 patch shape | ✓ |
| A4 | 把 Phase 7 的 SSE patch 工作并入 Phase 11 | |

**Claude 推荐：A3**
**Rationale:** Phase 11 在 ROADMAP 顺序中先于 Phase 7 完成，不能阻塞。A3 让本期测试在 Phase 7 改写 useSSE 后依然有效，因为断言对象是 query cache 的最终内容，而不是 patch contract 的具体形态。Phase 7 SC#4 已声明会单独加严格 patch schema 测试，二者职责分明、不重叠。

---

## B — REFT-01 矩阵的"新增 mode 必失败"机制

| Option | Description | Selected |
|--------|-------------|----------|
| B1 | 仅运行期 `Object.keys` 对齐校验 | |
| B2 | 仅 TypeScript `satisfies Record<PermissionMode, ...>` 穷尽 | |
| B3 | 双保险：B2 编译期 + B1 运行期 | ✓ |
| B4 | 单独跑一个 codegen 步骤，从类型生成行 | |

**Claude 推荐：B3**
**Rationale:** B2 单独不够 —— 加 mode 又加 row 但 spec 错写会被 `satisfies` 通过；B1 单独不够 —— 漏 row 是运行时才发现，且 IDE 没提示。双保险成本极低（多写两行运行期断言）。文件单独命名 `permissionMatrix.test.ts` 与现有 `modeConfig.test.ts` 互补不重叠。

---

## C — REFT-02 SSE 测试形态

| Option | Description | Selected |
|--------|-------------|----------|
| C1 | 起真 hub + jsdom EventSource integration | |
| C2 | 单元测 + MockEventSource + `vi.useFakeTimers` | ✓ |
| C3 | playwright e2e | |

**Claude 推荐：C2**
**Rationale:** C1 在 jsdom 下 EventSource 行为不稳，且需要 hub 启动管理，flaky 风险高。C3 需要引入 playwright + 端口管理，超出"补测试"范围。C2 与现有 `useSSE.test.tsx` 模式一致，可控、快、稳。Retry budget 数字由 researcher 从 useSSE.ts 真实实现读出，不在 CONTEXT 里猜测。

---

## D — REFT-03 Auth 负面用例覆盖面

| Option | Description | Selected |
|--------|-------------|----------|
| D1 | 新增 JWT replay 检测机制（黑名单/nonce）并测之 | |
| D2 | 不加新机制，"replayed" 解读为"过期后重放仍被拒"，分 route + middleware 两层测 | ✓ |
| D3 | 只测 route 层，middleware 视为依赖项不重复测 | |

**Claude 推荐：D2**
**Rationale:** PROJECT.md 明确"单用户 Tailscale、清晰胜于过度防御"。引入 replay-detection 是新功能而非补测试，超 scope，应进 Milestone 2 backlog（已在 Deferred 记录）。两层分别测保证职责清晰：route 层只管 body 校验 + token 校验，middleware 层管 JWT 校验。`jose` 现有 `exp` 校验已天然覆盖"过期后重放"语义。

---

## E — 不泄密 secret 的强制方式

| Option | Description | Selected |
|--------|-------------|----------|
| E1 | 只靠 code review，不自动 | |
| E2 | 响应体 + 日志捕获 + grep secret 子串，封装 helper | ✓ |
| E3 | 静态扫描（rg）保证错误返回 string literal 集合内 | |

**Claude 推荐：E2**
**Rationale:** E1 不可持续；E3 过于严格、阻碍后续合理错误信息扩展。E2 行为驱动、轻量、未来加任何错误路径都套同款 helper 即可。helper 名 `assertNoSecretLeak`，位置由 planner 定。

---

## F — SC#4 覆盖率非回归衡量

| Option | Description | Selected |
|--------|-------------|----------|
| F1 | 本期落 CI 覆盖率门禁 + baseline 文件 | |
| F2 | 本期只采 baseline 记入 DISCUSSION-LOG，CI 门禁留 Phase 12 决定 | ✓ |
| F3 | 完全不测覆盖率，只靠测试用例数判断 | |

**Claude 推荐：F2**
**Rationale:** Milestone 1 是 refactor + cleanup，加 CI gate 是新基础设施工作，超 scope。F2 仍满足 SC#4 "不回归" 的事实校验（人工对比数字），同时给 Phase 12 verification 留决策空间。F3 太弱，违反 SC#4 措辞。

---

## Claude's Discretion

以下交给 researcher / planner：
- Slice 切分顺序（推荐 REFT-01 → REFT-03 → REFT-02 → guard + coverage 收尾）
- `MockEventSource` 注入边界（monkey-patch vs dependency seam）
- `assertNoSecretLeak` helper 安放位置（`hub/src/test-utils/` 或 `hub/src/web/test-utils/`）
- Phase-11 guard 块的精确 ripgrep pattern，要求与 Phase 5 / 6 / 10 不重叠
- REFT-01 矩阵 expected args 的真实字面量（由 researcher 读 `permissionModeToCursorArgs` 填入）
- REFT-02 retry budget 真实数字（由 researcher 读 `useSSE.ts` 填入）

## Deferred Ideas

- JWT replay-detection 机制（黑名单 / nonce / single-use）—— 与项目方针冲突，开 SEC-* requirement 进 Milestone 2 backlog
- SSE 真实集成测试（起真 hub + 真 EventSource）—— 留待 playwright 引入时统一设计
- CI 覆盖率门禁 —— Phase 12 verification 决定
- `useSSE.ts` 抽出可测性常量 —— 仅在 D-182 触发时做最小 export-only 改动
- 共享 `test-utils/` 包 —— `assertNoSecretLeak` 首次只服务 REFT-03，跨包共享留待后续

---

## Phase 10 Coverage Baseline (captured 2026-05-23)

Captured from: `main` @ 9c58af9
Capture mode: worktree (clean — `/tmp/hapi-baseline-cov` worktree created at detached HEAD `9c58af9`, removed on completion; active checkout untouched)

| Scope | Line Coverage | Source command |
|-------|---------------|----------------|
| cli/src/cursor/ | unavailable — `@vitest/coverage-v8` not installed in `cli/package.json` (`MISSING DEPENDENCY` from `vitest run --coverage`) | `cd cli && bun run vitest run --coverage --coverage.reporter=text --coverage.include='src/cursor/**'` |
| cli/src/agent/ | unavailable — `@vitest/coverage-v8` not installed in `cli/package.json` (`MISSING DEPENDENCY` from `vitest run --coverage`) | `cd cli && bun run vitest run --coverage --coverage.reporter=text --coverage.include='src/agent/**'` |
| hub/src/web/routes/auth.ts | 18.18% lines (0.00% funcs) — uncovered lines 12–47 | `cd hub && bun test --coverage` |
| hub/src/sse/ | 79.82% lines (57.14% funcs) — only file is `sseManager.ts`; uncovered lines 63–67, 108, 114–118, 127–131, 136–141 | `cd hub && bun test --coverage` |
| web/src/hooks/useSSE.ts | unavailable — `@vitest/coverage-v8` not installed in `web/package.json` (`MISSING DEPENDENCY` from `vitest run --coverage`) | `cd web && bun run vitest run --coverage --coverage.reporter=text --coverage.include='src/hooks/useSSE.ts'` |

Notes:
- hub coverage uses `bun:test`'s built-in coverage (TESTING.md § Coverage notes hub has no preconfigured provider) — numbers are the `% Lines` / `% Funcs` columns from its text report. Per D-188, no CI gate is added; numbers are advisory only.
- cli + web both declare `provider: 'v8'` in their `vitest.config.ts` but do NOT include `@vitest/coverage-v8` as a dependency on `main` @ 9c58af9. Installing the missing package was out of scope (would mutate `main` install state and was not the planned action). Per RESEARCH § Open Question #3 fallback: "If any scope's number cannot be obtained, write `unavailable — <reason>`. Plan 11-05 will then declare Phase 11 numbers the new baseline."
- Plan 11-05 (SC#4 non-regression check) MUST treat the three `unavailable` scopes as "Phase 11 numbers become the new baseline" rather than asserting non-regression against a missing baseline. The two captured hub scopes (`auth.ts` 18.18%, `sseManager.ts` 79.82%) DO have a real baseline and must not regress.
