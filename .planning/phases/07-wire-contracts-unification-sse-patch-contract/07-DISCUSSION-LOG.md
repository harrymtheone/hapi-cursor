# Phase 7: Wire contracts unification & SSE patch contract — Discussion Log

**Date:** 2026-05-22
**Mode:** discuss (Chinese), user-driven "按你的推荐来" 全程

## 灰区表（呈现）

Phase 7 boundary 由 ROADMAP SC#1–#4 + REFA-03/04 锁定。承袭 P5/P6 决策（Cursor-only / no shim / 4 切片 / ripgrep + madge guard / `EnhancedMode` 不上提 shared）后，4 个灰区呈现给用户：

- **A. SSE patch 契约**（SC#2 二选一）：严格 patch schema / 全量 SessionSummary 推送 / 混合（升级事件 union）
- **B. canonical schema 上提范围**（SC#1）：多选 — Machine+RunnerState / Message / narrow metadata+agentState / drop z.unknown in SyncEvent / 不 narrow metadata
- **C. wire 字面量遗债**（P5 D-70/D-81 锚定）：全删 / 只删 flavor 字段 + AGENT_MESSAGE_PAYLOAD_TYPE rename / 都保留 / 只改 AGENT_MESSAGE_PAYLOAD_TYPE
- **D. 测试 + guard**（默认）：useSSE 单测 / hub contract test / ripgrep zero-tolerance 关键词

用户首轮选 「按推荐来」决定 4 项 ALL；二轮再 3 个 detailed AskQuestion 也全部「按推荐来」。

## 最终决策（→ CONTEXT D-111 ~ D-128）

### A. SSE patch 契约 → patch_strict（严格 patch schema 在 shared/）
- 依据：移动端 + Tailscale 带宽敏感（PROJECT.md 核心场景）；与 P5 D-72「带值能力表」严格列举思路同源；hub 现状已按字段 patch，全量化要重写 emit 路径。
- 落地：`SessionPatchSchema` `.strict()` 全字段 `.optional()`；`MachinePatchSchema` 仅 inactivate；`SyncEventSchema` `data` 字段 `z.unknown` → `z.union([SessionSchema, SessionPatchSchema])` 等。

### B. canonical schema 上提 → machine + message + drop_unknown + narrow_metadata（4 项全选）
- `Machine / MachineMetadata / RunnerState` 上提（SC#1 点名）
- `Message wire`（UserMessage / AgentMessage / MessageContent / MessageMeta）上提（SC#1 点名）
- `SyncEventSchema` 中 3 类事件 `data: z.unknown` → 强类型 union（SC#2 硬锁）
- cli `CreateSessionResponseSchema` 内联 `metadata: z.unknown` / `agentState: z.unknown` narrow 到 shared 强类型（SC#1 cli 不再有自己的 narrow 副本）
- `RunnerState.status / shutdownSource` 的 `z.union([enum, string])` 宽松形状本 phase **不** narrow，留 Phase 10（D-115）

### C. wire 字面量 → drop_flavor_keep_payload
- 删除 `MetadataSchema.flavor` 字段（兑现 P5 D-70 + P5 RESEARCH §"Wire-layer narrow safety" §1 收回临时保留）
- `AGENT_MESSAGE_PAYLOAD_TYPE = 'codex'` rename 为 `'cursor'`（兑现 P5 D-81 锚定）
- 老 SQLite 数据解码失败接受为 Phase 10 REFC-01 schema-version reject 兜底；本 phase **不**写 in-place 迁移代码
- `scripts/check-no-cut-agents.sh` 中 `AGENT_MESSAGE_PAYLOAD_TYPE` 白名单 + Phase-5 territory `'codex'` 例外删除；`'codex'` 字面量在 `cli/src hub/src web/src shared/src` 严格 0 命中

### D. 测试 + guard → 默认
- 切片 4 片（D-125），每片 `bun typecheck` + `bun run test` 绿
- 3 类测试（D-127）：shared schema 单测 / `web/src/hooks/useSSE.test.tsx` strictly typed event stream / hub broadcast contract test
- ripgrep zero-tolerance 关键词（D-126）：`hasUnknownSessionPatchKeys` / `getSessionPatch` in web hooks / `interface Machine`+`type Machine =` in cli|web / `RunnerStateSchema|MachineMetadataSchema` in cli|web / `'codex'` 全包 / metadata `flavor:` 写入
- 本 phase **不**跑 `build:single-exe`、**不**新增 `madge --circular hub/src/`（留 Phase 8）（D-128）

## Claude 的 discretion 项

- shared 中新 schema 放 `schemas.ts` / 新建 `wire.ts` / 复用 `messages.ts` 由 researcher 选
- `SessionPatchSchema` 是 `.strict().partial()` 还是显式 `.optional()` 写法由 planner 选
- `session-added.data` 是否强制 = `SessionSchema`（不允 patch）由 researcher 选（推荐强制）
- useSSE parse 失败是否上报到 `onError` callback 由 researcher 选
- `eventPublisher.emit` 入口是否 dev 模式 `SyncEventSchema.parse()` 自检由 planner 选（推荐加）
- `RunnerState.status / shutdownSource` 顺手 narrow 与否由 researcher 视生产值情况决定
- `SessionsResponse / SessionResponse` 等 wrapper 上提具体清单由 researcher 按 ripgrep 平行 type 命中确定

## Deferred Ideas

见 CONTEXT.md `<deferred>` —— REFH-01/02/03/04 留 Phase 8；REFW-01/02/03 留 Phase 9；REFC-01/02 + RunnerState narrow 留 Phase 10；REFT-01/02/03 留 Phase 11；CUT-12 prose 清理留 Phase 12；CURS-01~05 v2 能力本 phase **不**预留 schema 字段（避免过度抽象，与 P5 D-74 同源）。

## Scope Creep / Redirects

无 — 用户全程「按你的推荐来」，未提出新能力。

## Anchors / Cross-References

- P5 D-70 / D-172（deferred）→ Phase 7 D-122（删 flavor 字段）
- P5 D-81 / D-188（deferred）→ Phase 7 D-123（AGENT_MESSAGE_PAYLOAD_TYPE rename）
- P5 RESEARCH §"Wire-layer narrow safety" §1 → Phase 7 D-122（收回临时保留）
- P5 D-86 / P6 D-107 → Phase 7 D-125（4 切片节奏复用）
- P5 D-84 / P6 D-108 → Phase 7 D-126（ripgrep guard 复用）
- P6 D-97 → Phase 7 out-of-scope（EnhancedMode 不上提）
- ROADMAP Phase 7 SC#1–#4 → Phase 7 In scope 5 条 + D-127 测试

---

*Phase: 7-Wire contracts unification & SSE patch contract*
*Discussion log: 2026-05-22*
