# Phase 12: Docs cleanup & milestone verification - Context

**Gathered:** 2026-05-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 12 是 Milestone 1（Refactor & Slim-Down）的**收官 phase**，做两件事：

1. **Docs cleanup (CUT-12):** 把文档面收敛到 Cursor-only 后的真实形态 —— 删掉历史多 agent / Telegram / website / 多 agent 文档站留下的"叙事谎言"，让任何后续的 AI 编程助手 + 人类读者看到的描述与代码保持一致。
2. **Milestone verification (VRFY-01~04):** 跑完整的自动化 gate（typecheck / test / madge / ripgrep absence / guard script）并加做一个**真机 Tailscale 端到端**手测，落档单一 `12-VERIFICATION.md` 作为 Milestone 1 正式封盘证据。

**In scope:**

- 删除 `website/` 整目录（marketing 站，与 Cursor-only 主仓无关）
- 删除 `docs/` 整目录（旧多 agent VitePress 文档站；Cursor-only 后无统一文档站需求，单一 README 承担）
- 删除根 `refactor.md`（milestone 启动期临时笔记；先 grep 引用再删）
- 清理根 `package.json` workspaces + `bun.lock` 中对 `website` / `docs` 的引用
- **重建 `AGENTS.md`** 为 Cursor-only 轻量版（≤ 100 行），作为给 AI 编程助手（Cursor IDE / Claude Code / Codex CLI / 任意未来 AI 编辑器）的仓库导航；定位 = 仓库元数据，不是产品文档
- 重写根 `README.md`（卖点 = Cursor Agent 手机端达到桌面 IDE 等同可用性 + 单用户 Tailscale quickstart）
- 重写 `cli/README.md` / `hub/README.md` / `web/README.md`（从 0 起；定位、安装、`bun run` 脚本表、关键模块入口、test 怎么跑）
- 扩展 `scripts/check-no-cut-agents.sh` ripgrep guard，防 `website/` / `docs/superpowers` / `docs/guide` 等路径回流
- 新增 GitHub Actions workflow `.github/workflows/verify.yml`：`bun install → bun typecheck → bun run test → bun run madge:check → bash scripts/check-no-cut-agents.sh`
- 在 root `package.json` 加 `"madge:check": "madge --circular --extensions ts,tsx cli/src hub/src web/src"`（CI 与本地共用入口）
- 手动 Tailscale + Cursor + 手机端到端场景（SC#5 全步骤）+ 截图证据
- 写 `12-VERIFICATION.md`（结构见 D-04）
- 修 ROADMAP stale `[x]` 漂移（Phase 7/8/9/11 复选框对账，与 commit history / STATE.md 对齐）
- PROJECT.md Key Decisions 追加 Milestone 1 收尾条目
- `CHANGELOG.md` 顶部追加 Milestone 1 条目
- STATE.md 翻页到 Milestone 1 complete

**Out of scope:**

- **不**引入 lint（biome / eslint）—— Phase 11 SC 已显式标注 lint 未配置；引入 lint 是新工程，不属于"清理 + 验收"语义；进 deferred → Milestone 2
- **不**把 coverage 作为 CI gate —— 沿用 Phase 11 D-188：本期手动采、记入 VERIFICATION.md；CI 化 coverage 推到 Milestone 2 与 lint 一并
- **不**改动任何 production 代码（`cli/src/` `hub/src/` `web/src/` `shared/src/`）—— 本期是 docs + scripts + workflows + verification，不动产品语义
- **不**起独立 Cursor-only 用户文档站 —— 删 `docs/` 后若未来真需要再开独立 phase
- **不**做 Phase 7 / 8 / 9 残留 plan 的产品改动 —— 如 commit history 与 ROADMAP `[x]` 漂移确实暴露未完成功能，记入 `12-VERIFICATION.md` Outstanding 段，转入 Milestone 2 backlog；本期只对账，不补功能
- **不**写自动化端到端集成测试 —— SC#5 本就是"人 + 手机 + 真 Tailscale"，自动化收益低；Phase 11 deferred 已声明留给未来 playwright phase

**已知依赖与风险：**

- **ROADMAP 与 STATE.md 不一致：** ROADMAP `[x]` 显示 Phase 7 (1/4)、Phase 8 (1/4)、Phase 9 (3/4)、Phase 11 (3/5)，但 STATE.md 与 commit history 显示全部 phase / 55 plans 完成。本期 12-04-PLAN 内对账后以 commit history 为准修 ROADMAP，并在 VERIFICATION.md Outstanding 段如实记录任何真有缺口的 SC。
- **`AGENTS.md` 当前为 git `D` 状态（已删未提交）：** 本期重建覆盖。
- **`docs/` 与 `website/` 各有独立 `package.json` + `node_modules`：** 删除前确认它们不在 root workspace 中被消费（grep `workspaces` 与 `import .*docs/` / `import .*website/`）；如有外部链接（README 中指向 `docs/guide` 的 anchor）一并清理。
- **`refactor.md` 引用：** 删除前必须 `rg refactor.md` 全仓扫一遍，确认无 README / CONTRIBUTING / planning 文档引用它。

</domain>

<decisions>
## Implementation Decisions

### 1. AGENTS.md 定位与重建

- **D-01：AGENTS.md 重建为 Cursor-only 轻量版（≤ 100 行）。** 定位是「给在本仓库干活的 AI 编程助手（Cursor IDE / Claude Code / Codex CLI / 未来任意 AI 编辑器）看的仓库导航」，**不是产品文档**。内容仅含：一句产品定位（Cursor Agent 手机端连接工具）、repo layout（cli/hub/web/shared 四包 + 删除的 website/docs 不再提）、Bun workspace 与脚本入口、TypeScript strict、`@/*` 路径别名、`bun typecheck` + `bun run test` 怎么跑、跨 runner 测试约束（Vitest cli+web、bun:test hub+shared）、`.cursor/rules/` 与 `.planning/` 的存在与作用。架构图简化为 CLI ↔ Hub ↔ Web 三框，不画 Telegram / 多 agent。
- **D-02：AGENTS.md 不重复 `.cursor/rules/`。** 仓库已有 `.cursor/rules/gitnexus.mdc` 等 Cursor 专属规则；AGENTS.md 只在底部一行指针：「Cursor IDE 用户：同时参考 `.cursor/rules/`」。其它 AI 工具读 AGENTS.md 一篇即可上手。

### 2. 文档面整体策略

- **D-03：删 > 改。** `website/`、`docs/`、`refactor.md` 一次整体删除（不做内容 scrub），五篇 README + AGENTS.md 从 0 重写（不做行级 scrub）。理由：旧文档结构本身就是多 agent 时代的 dead weight，行级 scrub 一定留死角，与项目方针「无向后兼容、清晰胜于过度防御」一致。

### 3. 验收交付形态

- **D-04：单一 `12-VERIFICATION.md` 作为 Milestone 1 收官报告，结构固定：**

  ```
  ## Automated gates
    - bun typecheck（粘贴尾段输出 + exit code）
    - bun run test（cli / hub / web / shared 各 runner 数字 + 总和）
    - madge --circular（cli/src hub/src web/src 各一行 "0 cycles" 或具体环路列表）
    - scripts/check-no-cut-agents.sh（exit 0 + 各 Phase guard 块标题清单）
    - ripgrep absence sweep（SC#4 keyword：claude / codex / gemini / opencode / telegram / serverchan / elevenlabs / tunwg / namespace —— 各一行 "0 hits" + 白名单解释）

  ## Coverage snapshot (vs Phase 11 baseline)
    - 表格：scope → before (Phase 11 末态) → after → delta

  ## Manual Tailscale scenario
    - 完整 checklist（D-05）+ 执行人 + 执行时间戳 + 关键截图相对路径

  ## ROADMAP reconciliation
    - Phase 7/8/9/11 stale [x] 修正前后对照
    - 如有真缺口的 SC 行：明示

  ## Outstanding (Milestone 2 backlog)
    - 转入 Milestone 2 的延期事项索引（lint、coverage CI gate、playwright 集成测试等）

  ## Sign-off
    - Milestone 1 PASS / PARTIAL PASS / FAIL + 一句话 rationale
  ```

- **D-05：手动 Tailscale 场景 = 强制 checklist，不写自动化脚本。** Checklist 步骤逐字序列化 SC#5：① 本地起 `hapi runner` + `hapi hub` → ② 手机（同 Tailnet）打开 Web PWA → ③ PWA 新建 Cursor session → ④ 完成一轮交互（用户消息 + agent 响应） → ⑤ kill hub 进程 → ⑥ 重启 hub → ⑦ session 状态恢复（消息历史 + active machine 列表）→ ⑧ 继续一轮交互成功。每步留 ✅/❌ + 一行备注栏 + 时间戳。
- **D-06：截图存放规范。** `.planning/phases/12-docs-cleanup-milestone-verification/manual-tailscale/` 目录，命名 `step-{n}-{slug}.png`（例 `step-04-first-round-response.png`）。`12-VERIFICATION.md` Manual Tailscale 段以相对路径引用。

### 4. CI / lint / 覆盖率

- **D-07：本期接入 GitHub Actions（最小可信版）。** 新增 `.github/workflows/verify.yml`，触发 = push 到任意分支 + PR。Job 步骤：`actions/checkout@v4` → `oven-sh/setup-bun@v1`（pin 仓库当前 `bun` 版本）→ `bun install --frozen-lockfile` → `bun typecheck` → `bun run test` → `bun run madge:check` → `bash scripts/check-no-cut-agents.sh`。所有 gate 已 local-runnable，CI 化只是把人肉门变成 push 门，零额外设计成本。
- **D-08：不引入 lint。** 进 deferred → Milestone 2 单独 phase（与 coverage CI gate 一并），避免本期 scope 膨胀。VERIFICATION.md 在 Automated gates 段如实标注「lint not configured — deferred to Milestone 2」。
- **D-09：覆盖率不做 CI gate，本期只采 baseline。** 沿用 Phase 11 D-188 决策。在 12-04-PLAN 收尾跑一次 `bun run vitest run --coverage`（cli + web） + hub bun:test coverage（若 bun 支持，否则标注 unavailable），与 `.planning/phases/11-*/11-DISCUSSION-LOG.md` 中的 Phase 11 末态数字对照。delta 出现回归 → 不阻塞 Milestone 收尾，但在 VERIFICATION.md Outstanding 段如实记录并标 Milestone 2 优先级。
- **D-10：`madge:check` script 化。** 在 root `package.json` 加 `"madge:check": "madge --circular --extensions ts,tsx cli/src hub/src web/src"`。CI 与本地共用同一入口；Phase 8/9 已有的 `scripts/check-no-circular-hub.sh` / `check-no-circular-web.sh` 保留不动（它们是 phase guard，不重复）。

### 5. Slice 切分（推荐 4 个 plan）

- **D-11：四 plan 切分，每 plan 独立绿。** 沿用 Phase 5/6/9/10/11「一次切干净 + slice 独立绿 + 末尾 guard sweep」cadence：
  - **12-01-PLAN — 文档面整删 + ripgrep guard 扩展。** `website/` + `docs/` + `refactor.md` 整体删除 + workspaces/lockfile/inline 引用扫干净 + `scripts/check-no-cut-agents.sh` 追加 D-126 风格 Phase-12 guard 块（禁 `website/` / `docs/superpowers` / `docs/guide` 路径再回来 + 禁 `refactor.md`）。`bun typecheck` + `bun run test` 在 plan 收尾跑过。
  - **12-02-PLAN — 5 篇 README + AGENTS.md 从 0 重写。** 顺序：根 README → AGENTS.md → cli/hub/web README 三连。每篇收尾按 README 步骤本地实际走一遍（quickstart 真跑、`bun run` 脚本逐条 invoke 验证），把不一致就地修正。
  - **12-03-PLAN — CI 工程化。** root `package.json` 加 `madge:check` + 新 `.github/workflows/verify.yml` + PR 上验证 CI green（必要时本 plan 自己的 commit 就是触发 PR）。
  - **12-04-PLAN — Milestone 1 收官。** 跑全套自动 gate → 采 coverage snapshot → 执行手动 Tailscale 场景 → 写 `12-VERIFICATION.md` → 对账 ROADMAP stale `[x]` → 追加 PROJECT.md Key Decisions + CHANGELOG.md Milestone 1 条目 → STATE.md 翻页 → Milestone 1 sign-off。
- **D-12：12-04 内显式包含 ROADMAP 对账（不再单独立 plan）。** Phase 7/8/9/11 复选框漂移以 commit history 为权威修正。若发现真缺口 SC 行（即代码里某 SC 实际未达成）→ VERIFICATION.md Outstanding 段记录 + 入 Milestone 2 backlog，不在本期回头补。

### Claude's Discretion

- AGENTS.md 的精确目录与小节命名，由 12-02 planner 自定（约束：≤ 100 行、不画 Telegram、不提多 agent）。
- 五篇 README 的「关键模块入口」与「`bun run` 脚本表」精确字段，由 12-02 planner 读完 `cli/package.json` 等再定。
- `.github/workflows/verify.yml` 的 bun 版本 pin 策略（pin commit sha vs 版本号），由 12-03 planner 看仓库现状决定。
- Coverage 跑哪些 scope（cli + web 是必跑；hub bun:test 是否能产 coverage 由 12-04 planner 实地验证）由 planner 决定，结果如实记。
- 手动 Tailscale 场景的 ⑤ ⑥ 步「kill / 重启」具体手段（SIGINT vs SIGKILL；是否 `pkill -9`）由 12-04 执行者按现场情况决定，但必须在 VERIFICATION.md 备注栏记录。
- Phase 12 ripgrep guard 块的精确 pattern 与白名单清单，由 12-01 planner 设计（约束：与 Phase 1/2/3/4/5/6/9/10/11 现有块互补不重叠）。

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project scope and requirements

- `.planning/PROJECT.md` — 项目方针：Cursor-only、单用户 Tailscale、无向后兼容、清晰胜于过度防御、不计较 token / 时间成本只要清晰正确。本期所有删 > 改、不引入 lint、不加 coverage CI gate 等决策均背书于此。
- `.planning/REQUIREMENTS.md` §CUT-12 / VRFY-01 / VRFY-02 / VRFY-03 / VRFY-04 — Phase 12 的五条履约项原始定义。
- `.planning/ROADMAP.md` §Phase 12 — Success Criteria 五条：① Cursor-only 文档面 + 删 `website/` + `docs/` 保留 Cursor 相关；② typecheck + test 全绿，lint 状态如实暴露；③ madge 三 scope 零环；④ ripgrep 九 keyword 零命中（白名单：`.planning/codebase/` snapshots、`CHANGELOG.md`、git history）；⑤ 真机 Tailscale + Cursor + 手机端到端 + hub 重启恢复。
- `.planning/ROADMAP.md` §Progress 表 + §Phase 7/8/9/11 Plans 列表 — ROADMAP 对账（D-12）的真实数据源；以本表为目标对照对象。
- `.planning/STATE.md` — Milestone / phase 完成状态权威；与 ROADMAP `[x]` 漂移对账时以 STATE + commit history 为准。

### Prior phase decisions to carry forward

- `.planning/phases/11-test-gap-fill/11-CONTEXT.md` D-188 / D-189 — 「本期不加 CI coverage 门禁，留给 Phase 12 verification 决定」+ 「每个 slice 独立绿」cadence；本期 D-09 直接继承（仍不加 gate）。
- `.planning/phases/11-test-gap-fill/11-DISCUSSION-LOG.md` — Phase 11 末态 coverage baseline 数字源，D-09 对照对象。
- `.planning/phases/10-config-cleanup/10-CONTEXT.md` D-160 ~ D-175 — 「一次切干净 + guard sweep + slice 独立绿」cadence。
- `.planning/phases/09-web-internal-decoupling/09-CONTEXT.md` D-157 / D-158 — slice + 末尾 guard 模式参考；本期 12-01 guard 块设计参考。
- `.planning/phases/07-wire-contracts-unification-sse-patch-contract/` D-126 — Phase guard 块「declarations/usages 与 legitimate 顶层字段区分」模式，12-01 ripgrep guard 设计借鉴。
- 历史 AGENTS.md（git HEAD 已删版）—— 重建时**反面教材**：不要再写「Wraps Claude/Codex」、Telegram 架构图、`docs/guide` 引用；新版形态参考其元数据章节（repo layout / Bun workspaces / TypeScript strict / Shared rules）但内容 Cursor-only。

### Codebase maps

- `.planning/codebase/STRUCTURE.md` — 三包（cli / hub / web）+ shared 目录形态；五篇 README 重写时必读，决定每篇「关键模块入口」段。
- `.planning/codebase/STACK.md` — Bun + TypeScript strict + Vitest (cli/web) + bun:test (hub/shared) 全栈快照；AGENTS.md 与 README 表述基础。
- `.planning/codebase/ARCHITECTURE.md` — CLI ↔ Hub ↔ Web 三方关系；AGENTS.md 简化架构图与根 README quickstart 引用对象。
- `.planning/codebase/TESTING.md` — 三种 runner 分布、co-located `*.test.ts(x)`、跨 runner 禁忌；AGENTS.md「测试怎么跑」段必读。
- `.planning/codebase/CONVENTIONS.md` — TypeScript strict、named exports、constructor DI；AGENTS.md「shared rules」段对齐。
- `.planning/codebase/INTEGRATIONS.md` — 当前外部集成清单；用于交叉验证文档中是否还残留已删的 Telegram / ElevenLabs / ServerChan / tunwg / 多 agent 描述。

### Source-of-truth files for downstream research / planning

- `scripts/check-no-cut-agents.sh` — Phase-12 guard 块的追加位置；末尾已累积 Phase 1/2/3/4/5/6/9/10/11 块。
- `scripts/check-no-circular-hub.sh` / `scripts/check-no-circular-web.sh` — Phase 8/9 madge guard，保留不动；与本期新 root `madge:check` script 并存。
- `package.json`（root）— `madge:check` script 新增点 + workspaces 列表清理点（删 `website` / `docs`）。
- `bun.lock`（root）— 删 `website` / `docs` workspace 后必须 regen。
- `README.md` / `cli/README.md` / `hub/README.md` / `web/README.md` — 五篇重写对象。
- `AGENTS.md` — 重建对象（当前 git `D` 状态，HEAD 版可作反面参考）。
- `CHANGELOG.md` — 12-04 顶部追加 Milestone 1 条目。
- `cli/package.json` / `hub/package.json` / `web/package.json` — README 的「`bun run` 脚本表」字段来源。
- `website/` 全树 — 12-01 整删对象（删前 grep 确认 root workspaces 与 README 不引用）。
- `docs/` 全树 — 12-01 整删对象（同上）。
- `refactor.md` — 12-01 整删对象（删前 `rg refactor.md` 全仓扫一遍）。

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- `.planning/codebase/*.md`（6 篇）已是新鲜的 Cursor-only 代码快照，AGENTS.md 与 README 重写可直接基于这些事实，无需再做单独 codebase scout。
- `scripts/check-no-cut-agents.sh` 已建立 Phase 1~11 guard 块模式（每块独立 ripgrep + 退出码合流），12-01 Phase-12 块沿用此架构。
- Phase 8 `scripts/check-no-circular-hub.sh` + Phase 9 `scripts/check-no-circular-web.sh` 已存在；本期 `madge:check` script 是它们的 root 级 thin wrapper，三者职责互补不重叠。
- `oven-sh/setup-bun@v1` GitHub Action 是社区标准，无需自研 CI 脚手架。

### Established Patterns

- 「一次切干净 + slice 独立绿 + 末尾 guard sweep」—— 沿用 Phase 5/6/9/10/11。
- 「删 > 改」处理多 agent 历史 —— 沿用 Phase 1/2/3/4 cut phase 节奏。
- Phase guard 块以 ripgrep + 显式白名单实现 fail-closed —— 沿用 D-126 等模式。
- Markdown 文档 4-space indentation + 简短 telegraph 风格在 HEAD AGENTS.md 有先例，本期 AGENTS.md 重建可沿用风格（产品事实层 Cursor-only 化）。

### Integration Points

- **删 `website/` / `docs/` ↔ root workspaces：** 删前必查 root `package.json` `workspaces` 字段、`bun.lock` 内对 `website` / `docs` 的引用、所有 README 内 `docs/guide` / `website/` 链接。
- **AGENTS.md ↔ `.cursor/rules/`：** AGENTS.md 在底部一行指针指向 `.cursor/rules/`，不重复内容。
- **CI workflow ↔ `scripts/check-no-cut-agents.sh`：** workflow 直接 `bash scripts/check-no-cut-agents.sh`，guard 块新增（包括本期 Phase-12 块）自动被 CI 拾取，无需 workflow 改动。
- **`madge:check` ↔ Phase 8/9 hub+web guard scripts：** root script 是 CI 单入口；phase guard scripts 仍可被 phase 本地手测使用；二者不互相 invoke。
- **手动 Tailscale 截图目录 ↔ git：** `.planning/phases/12-*/manual-tailscale/*.png` 进 git，作为 VERIFICATION 证据；如截图过大（>1MB）由 12-04 执行者用 `oxipng` 或 `pngquant` 压缩后再 commit。

</code_context>

<specifics>
## Specific Ideas

- **AGENTS.md 重建骨架（建议；planner 可调）：**

  ```
  # AGENTS.md
  Work style: telegraph; noun-phrases ok; drop grammar.

  Short guide for AI coding agents in this repo. Read root README first, then package READMEs as needed.

  ## What this repo is
  HAPI Cursor Edition — mobile/web remote control for the Cursor coding agent.
  Single user, Tailscale-deployed. Not a multi-agent platform.

  ## Repo layout
  cli/     - CLI binary, Cursor agent wrapper, runner
  hub/     - HTTP + Socket.IO + SSE server, SQLite persistence
  web/     - React PWA for remote control
  shared/  - Common types, Zod schemas, utilities

  ## Architecture
  CLI ──Socket.IO── Hub ──SSE/REST── Web (PWA)

  ## Commands
  - bun install                         # repo root, Bun workspaces
  - bun typecheck                       # all packages
  - bun run test                        # all packages (Vitest in cli/web, bun:test in hub/shared)
  - bun run madge:check                 # circular dependency guard
  - bash scripts/check-no-cut-agents.sh # historical-residue guard

  ## Rules
  - No backward compatibility (single-user, no install base)
  - TypeScript strict; no untyped code
  - Pragmatism over over-engineering; necessary tests only
  - Path alias @/* per package (./src/*)
  - 4-space indentation
  - Don't reintroduce: claude / codex / gemini / opencode / telegram / serverchan / elevenlabs / tunwg / namespace

  ## See also
  - .cursor/rules/  (Cursor IDE 专属规则)
  - .planning/      (GSD 工作目录 — 不要改)
  ```

- **`.github/workflows/verify.yml` 必含步骤（建议；planner 可调）：**

  ```yaml
  name: verify
  on:
    push:
    pull_request:
  jobs:
    verify:
      runs-on: ubuntu-latest
      steps:
        - uses: actions/checkout@v4
        - uses: oven-sh/setup-bun@v1
          with:
            bun-version: <pin to current repo bun version>
        - run: bun install --frozen-lockfile
        - run: bun typecheck
        - run: bun run test
        - run: bun run madge:check
        - run: bash scripts/check-no-cut-agents.sh
  ```

- **手动 Tailscale checklist 模板（建议）：**

  ```markdown
  ### Manual Tailscale + Cursor + Phone scenario
  Executed by: <name>
  Date / time: <ISO timestamp>

  | # | Step | Result | Notes / Screenshot |
  |---|------|--------|--------------------|
  | 1 | 本地起 `hapi runner` | ✅/❌ | step-01-runner-up.png |
  | 2 | 本地起 `hapi hub` (Tailscale 可达) | ✅/❌ | step-02-hub-up.png |
  | 3 | 手机（同 Tailnet）打开 PWA | ✅/❌ | step-03-pwa-loaded.png |
  | 4 | PWA 新建 Cursor session | ✅/❌ | step-04-session-created.png |
  | 5 | 完成一轮交互（消息 + 响应） | ✅/❌ | step-05-first-round.png |
  | 6 | kill hub 进程（手段：__________） | ✅/❌ | step-06-hub-killed.txt (terminal capture) |
  | 7 | 重启 hub | ✅/❌ | step-07-hub-restarted.png |
  | 8 | session 状态恢复（消息历史 + machine 列表） | ✅/❌ | step-08-state-recovered.png |
  | 9 | 继续一轮交互成功 | ✅/❌ | step-09-second-round.png |

  Overall: PASS / FAIL
  Rationale: <一句话>
  ```

- **ROADMAP 对账（12-04 执行清单）：**
  - Phase 7：commit history 显示 07-02 / 07-03 / 07-04 plan 已 ship（grep `07-02-PLAN.md` 等的 final commit），但 ROADMAP `[ ]`。修为 `[x]` + 补 `completed` 日期。
  - Phase 8：同上对 08-02 / 08-03 / 08-04 三 plan。
  - Phase 9：09-04 同上。
  - Phase 11：11-04 / 11-05 同上（commit history 已显示 `feat(11-05)` 与 `docs(phase-11): complete phase execution`）。
  - Progress 表「Plans Complete」列同步更新。
  - 若任一 SC（特别是 SC#4 ripgrep 各 keyword）在实地 verification 中被命中 → SC 行单独 mark 失败 + Outstanding 段详述。

</specifics>

<deferred>
## Deferred Ideas

- **引入 lint（biome / eslint）** —— 与本期「清理 + 验收」语义无关，是新工程。Milestone 2 单独 phase 处理（与下一条 coverage CI gate 一并）。
- **Coverage 作为 CI gate** —— 本期只采 baseline 进 VERIFICATION.md。Milestone 2 与 lint 一同设计 CI 门禁阈值。
- **Cursor-only 独立用户文档站** —— 删 `docs/` 后若 Milestone 2 真有需求（例如 onboarding 资料增多），起独立 phase 设计；本期不预测。
- **自动化端到端集成测试（playwright / 真起 hub + 真 EventSource）** —— Phase 11 已 deferred；Phase 12 SC#5 手测覆盖足够。引入 playwright 是独立 phase 工程量。
- **`AGENTS.md` 反向同步到 `.cursor/rules/`** —— 若未来发现规则漂移成痛点，再考虑用 hook / script 把 AGENTS.md 内容机械镜像进 `.cursor/rules/`；本期 AGENTS.md 与 `.cursor/rules/` 是松耦合互补关系。
- **Phase 7/8/9/11 若 verification 暴露真缺口 SC** —— 转入 Milestone 2 backlog，由 Milestone 2 第一个 phase 决定是否回补。本期 12-04 仅记录，不回头补功能（守住「不动 production 代码」边界）。
- **GitHub Actions 之外的 CI（GitLab / 自建 runner）** —— 项目方针单用户 + GitHub 托管，无需多 CI。如未来迁移再独立 phase。
- **截图自动压缩 pipeline** —— 如果未来 manual Tailscale 场景频繁执行，再考虑加 pre-commit hook 自动 oxipng；本期手工压缩即可。

</deferred>

---

*Phase: 12-Docs cleanup & milestone verification*
*Context gathered: 2026-05-23*
