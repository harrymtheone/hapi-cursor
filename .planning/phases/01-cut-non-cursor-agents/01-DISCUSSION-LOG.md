# Phase 1: Cut non-Cursor agents - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-20
**Phase:** 1-cut-non-cursor-agents
**Areas discussed:** 删除边界与后续 Phase 分工、测试文件处理策略、默认子命令解析、ripgrep 白名单与零容忍范围、删除提交粒度

---

## 1. 删除边界 vs. Phase 5/6 的分工

| Option | Description | Selected |
|--------|-------------|----------|
| A | 最小切除——只删四个目录 + commands + workflow + SDK 依赖，`cli/src/agent/` 与 `shared/` 中 flavor-aware 代码保留 union type、清理消费分支；类型/抽象收敛留 Phase 5/6 | ✓ |
| B | 顺手把可达引用全清——删除 + 移除 `cli/src/agent/` 中"Cursor 路径不再用到"的代码，不动 union type；Phase 5 再窄化类型 | |
| C | 激进——Phase 1 直接连 `AgentFlavor` union 一起收敛到 `'cursor'`，偷跑 Phase 5 的 CUT-05 | |

**User's choice:** A（推荐方案）
**Notes:** 冲突点被点明：A 与 ripgrep 4A「严格零容忍」在 `shared/src/flavors.ts` 上互斥。提议解法 = 把 `shared/src/flavors.ts` 加入 ripgrep 白名单（Phase 5 领地），其他业务消费按 Cursor 单分支重写。如执行中发现 `shared/src/modes.ts` / `shared/src/models.ts` 也含 union 字面量需保留，由 PLAN 显式追加白名单。

---

## 2. 测试文件处理策略

| Option | Description | Selected |
|--------|-------------|----------|
| A | 纯删——和源文件一起删，跨 flavor 测试改成只跑 Cursor 用例 | ✓ |
| B | 保留有价值的测试断言——挑出通用断言（如 permissionAdapter / messageConverter）改造 | |
| C | 让 Claude 在执行时按"价值"判断，逐文件决定（默认删，特别有价值才迁移） | |

**User's choice:** A（推荐方案）
**Notes:** Phase 1 是删除型 phase；新测试由 Phase 11 (REFT-01 ~ 03) 补齐。跨 flavor 共享测试按"剥离非 Cursor 用例"处理，不为已删 flavor 保留 mocked fixture。

---

## 3. 默认子命令解析

| Option | Description | Selected |
|--------|-------------|----------|
| A | `hapi` 直接进 `hapi cursor`（保留交互式 Cursor 会话作为默认） | |
| B | `hapi` 打印 help（更显式但改变用户习惯） | |
| C | `hapi` 行为不变，只是 fallback target 变成 cursor | ✓ |

**User's choice:** C（用户主动选择，与推荐不同）
**Notes:** 保留现有 default routing 路径结构，仅 fallback target 改为 Cursor。其他子命令结构不变。不加 deprecation warning（项目原则「No backward compatibility」）。

---

## 4. ripgrep 白名单与零容忍范围

| Option | Description | Selected |
|--------|-------------|----------|
| A | 严格零容忍——所有源码字面（含注释、错误信息）改写或删除 | ✓ |
| B | 字面零容忍 + 例外白名单（用 `// rg-allow:` pragma 标注） | |
| C | 只在 import / type / identifier 层零容忍——字符串字面值不强查 | |

**User's choice:** A（推荐方案）
**Notes:** 与决策 1A 的冲突解法 = `shared/src/flavors.ts` 进白名单（Phase 5 领地的合法例外）。CI 加 ripgrep 守卫脚本避免回归。白名单变更必须显式记入 PLAN。

---

## 5. 删除提交粒度

| Option | Description | Selected |
|--------|-------------|----------|
| A | 一次性大提交——`feat(phase-01): cut non-Cursor agents` 单 commit | |
| B | 按 requirement 拆分——每个 CUT-01/02/03/04 一个 commit + 1 个清理 commit（约 5 个） | ✓ |
| C | 按删除维度拆分——源目录 / commands / workflow + package / shared 引用清理（约 4 个） | |

**User's choice:** B（推荐方案）
**Notes:** 每个 commit 单独通过 `bun typecheck` + `bun run test`；bisect 与回滚友好。如某 CUT 内部还需再拆，由 planner 决定。

---

## Claude's Discretion

- 每个 CUT commit 内部的文件删除顺序（按依赖图自底向上）
- ripgrep 守卫脚本的具体实现形式（独立 shell script / `bun run test` 内嵌 / GitHub Actions step）
- `cli/src/agent/` 中具体哪些文件需要内部清理 vs. 等 Phase 6（以 `bun typecheck` 通过为唯一硬约束）
- 是否在 `cli/src/commands/registry.ts` 中加 deprecation warning（默认不加，遵循「No backward compatibility」）

## Deferred Ideas

- AgentFlavor union 收敛到 `'cursor'` → Phase 5 (CUT-05 + REFA-01)
- `cli/src/agent/` 共享 runtime 套件抽象（SessionContext / LocalAdapter / …） → Phase 6 (REFA-02)
- 未知 permission mode 抛错 + mid-session mode 切换覆盖测试 → Phase 6 (REFA-05)
- Cursor 单 flavor permission contract 测试矩阵 → Phase 11 (REFT-01)
- README / AGENTS / docs / website 文案清理 → Phase 12 (CUT-12)
- `hapi claude` 等已删命令的 deprecation hint → 不做（项目原则）
