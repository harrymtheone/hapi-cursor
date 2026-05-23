# Phase 5 — Discussion Log

**Date:** 2026-05-22
**Mode:** discuss (default), language = 中文
**Participants:** owner + Claude

人类参考用，下游 agent（researcher / planner）只读 CONTEXT.md。

## Discussion Flow

### Setup

- Phase 5 目标已锁（CUT-05 + REFA-01）。
- 加载 prior context：PROJECT.md / REQUIREMENTS.md / STATE.md / Phase 1–4 CONTEXT.md。
- Phase 1 Plan 02 / 03 / 04 留下显式记录：`shared/src/{flavors,modes,resume,voice}.ts` 的 non-cursor literals 是 **Phase-5-owned 白名单**，本 phase 必须一次清完。
- 没有 SPEC.md / 没有 todos 命中 / 没有 `.continue-here.md` blocking 反模式 / 没有 checkpoint。

### Codebase Scout 关键发现

| 文件 | 残留点 |
|---|---|
| `shared/src/flavors.ts` | `AgentFlavor` 全 5 union；`FLAVOR_CAPS` cursor 行是空 set；`isCodexFamilyFlavor()` 仍存在 |
| `shared/src/modes.ts` | `AgentFlavor` 类型定义；`CLAUDE_/CODEX_/GEMINI_/OPENCODE_PERMISSION_MODES`；`getPermissionModesForFlavor` 4 个 if 分支；`AGENT_MESSAGE_PAYLOAD_TYPE = 'codex'` wire 字面量 |
| `shared/src/flavors.test.ts` | 整个文件覆盖 claude/codex/gemini/opencode 用例 |
| `web/src/chat/modelConfig.ts` | `flavor === 'codex'` / `flavor === 'claude'` 两个分支算 context window |
| `web/src/components/ToolCard/PermissionFooter.tsx` | `isCodexFamilyFlavor` 调用 + `isCodexSession` 决定权限文案分支 |
| `cli/src/modules/common/slashCommands.ts` | `case 'claude'` / `case 'codex'` 选 commands 目录 |
| `hub/src/sync/syncEngine.ts` | `flavor === 'cursor' ? flavor : 'cursor'` 退化分支 |
| `hub/src/notifications/sessionInfo.ts` | `getFlavorLabel` / `isKnownFlavor` 调用（保留，语义不变） |

### 灰区识别 + 选项

5 块灰区呈递给 owner：

- **A) `AgentFlavor` 类型 / `flavor` 字段命运**：保留类型壳 + 字段 / 删字段保类型 / 全删
- **B) Capability 表 shape & 覆盖槽位**：`Set<flag>` vs `Record<key, value>`；要覆盖哪些 capability key
- **C) `shared/src/modes.ts` 清理范围**：本 phase 一并清 vs 留 Phase 6
- **D) wire 字面量 `'codex'` 与 `isCodexFamilyFlavor` 的处理**
- **E) ripgrep 守卫关键词 + 切片 + 测试策略**

### Owner 选择

> "直接按照你的推荐来"

Claude 按 prior decisions（最小切除、no backward compat、不顺手做后续 phase）拍板 5 块灰区，写入 CONTEXT.md。

### 拍板要点（详见 CONTEXT.md `<decisions>`）

| 灰区 | 决议 | 关键依据 |
|---|---|---|
| A | 保留 `AgentFlavor` 类型 narrow 到 `'cursor'` + 保留 wire/session 上 `flavor` 字段（D-69~D-71） | 删字段是 wire-level 重构，蔓延到 Phase 7 范围 |
| B | 升级到 `Record<AgentFlavor, FlavorCapabilities>`，capability 单元从 flag set 改为带值对象（D-72~D-76） | SC#3 隐含「调用点禁止内联条件」；带值能力是必需 |
| C | 本 phase 一并清 modes.ts non-cursor 常量与分支（D-77~D-80） | SC#3 + Phase 6 是 mode hardening 不是常量清理 |
| D | wire 字面量 `'codex'` 留 Phase 7；`isCodexFamilyFlavor` 本 phase 删（D-81~D-83） | 字面量改名跨包；helper 是单纯调用点 |
| E | zero-tolerance 关键词 = `'claude'/'codex'/'gemini'/'opencode'` 字面量 + `flavor === 非 cursor` + `isCodexFamilyFlavor`；4 切片；flavors.test 重写 cursor + unknown 兜底（D-84~D-88） | 沿用 Phase 1–4 ripgrep guard 节奏 |

## Deferred Ideas Captured

- 彻底删 `flavor` 字段 → Phase 7
- `AGENT_MESSAGE_PAYLOAD_TYPE = 'codex'` wire 字面量改名 → Phase 7
- Mode 类型独立 + 未知 mode 抛错 → Phase 6 (REFA-05)
- Cursor permission-mode → CLI flag 完整矩阵测试 → Phase 11 (REFT-01)
- README/docs/website 命名清理 → Phase 12 (CUT-12)
- CURS-01 model 切换 capability 槽落值 → Milestone 2

## Claude's Discretion 留给 researcher / planner

- Capability 字段命名（`permissionToneCopy` 等是占位名）
- `FlavorCapabilities` 类型放 `flavors.ts` 还是新文件
- `cli/src/modules/common/slashCommands.ts` 中 Cursor 是否真有用户 / 项目级 slash commands 目录路径要填进 capability
- `PermissionFooter::isCodexSession` 中 `toolName.startsWith('Codex')` 兜底是否保留（按 Phase 1 残留情况）
- 若 researcher 发现额外的硬编码 capability（model 列表 fallback、CLI 二进制路径等），应一并并入 capability 表

## Notes

- 全程使用中文讨论。
- Owner 一次性放权，没有逐项 deep-dive；CONTEXT.md 中的所有决议属于 Claude 按 prior decisions 推断的方案，researcher / planner 若发现冲突应回标 owner。
