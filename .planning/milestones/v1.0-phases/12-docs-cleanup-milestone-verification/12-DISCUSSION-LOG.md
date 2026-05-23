# Phase 12: Docs cleanup & milestone verification - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-23
**Phase:** 12-Docs cleanup & milestone verification
**Areas discussed:** 灰色地带菜单（用户授权按推荐执行）, AGENTS.md 定位与去留

---

## 灰色地带菜单（A / B / C / D / E）

Claude 在分析阶段提交以下多选菜单：

| Option | Description | Selected |
|--------|-------------|----------|
| A. 文档清理边界 | docs/ 整删 vs 留 Cursor 相关页；AGENTS.md 重建 vs 保持已删；CHANGELOG / refactor.md / SECURITY 怎么处理 | ✓ (按推荐) |
| B. 验收交付形态 | 12-VERIFICATION.md 结构；madge / ripgrep / coverage 怎么落档；Tailscale 场景用 checklist 还是脚本 | ✓ (按推荐) |
| C. ROADMAP 状态对账 | Phase 7/8/9/11 stale [x] 是否本期补修；是否同步 PROJECT.md | ✓ (按推荐，折入 12-04) |
| D. CI / lint 工程化 | 是否本期接入 GitHub Actions；是否引入 lint；coverage 是否成 CI gate | ✓ (按推荐) |
| E. Slice 切分形态 | 拆几个 plan；文档清理与跑测分开 vs 并轨；手动 Tailscale 单独 plan vs milestone-close | ✓ (按推荐) |
| 其他 | 用户自由提 | — |

**User's choice:** 「按照你的推荐来」(全部 5 项一次性授权)
**Notes:** 用户授权 Claude 直接按推荐定方案，免去逐项细问。Claude 在 CONTEXT.md 中固化所有推荐为 D-01 ~ D-12，并把 C（ROADMAP 对账）折入 D-12（12-04-PLAN 内部清单），不单独立 plan。

---

## AGENTS.md 定位与去留

用户在确认推荐后追问：「我想知道为什么存在 agents.md？我们在做的不只是一个『连接工具』吗？而 agent.md 不是一个 rule 相关、agent 相关的东西吗？」

Claude 检查了 git HEAD 的已删 AGENTS.md 内容，确认它是「给在本仓库干活的 AI 编程助手（Cursor IDE / Claude Code / Codex CLI 等）看的仓库导航」，不是产品文档。它跟 `.cursor/rules/` 是同类约定（agents.md 跨工具非正式标准），SC#1 点名它是因为旧版描述了多 agent + Telegram + 多 agent docs 站，与 Cursor-only 现状不符 —— 真实意图是「重写」而非「描述产品本身」。

| Option | Description | Selected |
|--------|-------------|----------|
| 1. 重建为轻量 Cursor-only 版（≤ 100 行） | 保留仓库导航价值，内容仅讲 repo layout / Bun workspace / bun 脚本 / TypeScript strict / Cursor-only 事实；架构图简化为 CLI↔Hub↔Web；兼顾 Cursor IDE + Claude Code + Codex CLI + 未来任意 AI 编辑器 | ✓ |
| 2. 彻底删除 + 改 SC#1 | 只依赖 .cursor/rules/ 与三份 README；非 Cursor 的 AI 助手进来时没入口点；需要改 ROADMAP SC#1 | |
| 3. 保留为极短指针（5–10 行） | 只指向 README + .cursor/rules/；避免文档重复，但保留 SC#1 字面满足 | |

**User's choice:** Option 1（重建轻量 Cursor-only 版）
**Notes:** Claude 在 CONTEXT.md 的 D-01 / D-02 固化此决策；12-02-PLAN 负责具体重建；骨架建议放入 `<specifics>` 段作为 planner 起点参考。

---

## Claude's Discretion

- AGENTS.md 精确目录与小节命名（≤ 100 行、不画 Telegram、不提多 agent 三约束已定）。
- 五篇 README 的「关键模块入口」与「`bun run` 脚本表」精确字段（看包 package.json 后定）。
- `.github/workflows/verify.yml` 的 bun 版本 pin 策略。
- Coverage 跑哪些 scope（cli + web 必跑；hub bun:test 是否能产 coverage 由 planner 实地验）。
- 手动 Tailscale ⑤⑥ 步 kill / 重启的具体手段（SIGINT vs SIGKILL）—— 由 12-04 执行者按现场决定 + 备注栏记录。
- Phase 12 ripgrep guard 块的精确 pattern + 白名单（约束：与前 9 期 guard 块互补不重叠）。

## Deferred Ideas

- 引入 lint（biome / eslint）—— Milestone 2 单独 phase（与 coverage CI gate 一并）。
- Coverage 作为 CI gate —— Milestone 2 设阈值。
- Cursor-only 独立用户文档站 —— 删 docs/ 后若 Milestone 2 真有需求再起独立 phase。
- 自动化端到端集成测试（playwright）—— Phase 11 已 deferred 一次，Phase 12 续 defer；SC#5 手测足够。
- AGENTS.md 反向同步到 .cursor/rules/ —— 漂移成痛点再考虑机械镜像 hook。
- Phase 7/8/9/11 若 12-04 verification 暴露真缺口 SC —— 不在本期回补，转 Milestone 2 backlog。
- GitHub Actions 之外的 CI（GitLab / 自建 runner）—— 单用户 + GitHub 托管，无需多 CI。
- 截图自动压缩 pipeline（oxipng pre-commit hook）—— 频次高再做。
