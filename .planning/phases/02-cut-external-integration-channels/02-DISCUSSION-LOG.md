# Phase 2: Cut external integration channels - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-21
**Phase:** 2-cut-external-integration-channels
**Areas discussed:** Web Telegram WebApp 平台分支抜除深度, realtime/voice 删除范围, notification channel 抽象, auth 路由收敛, ripgrep 白名单边界, 提交粒度, settings schema / CLI 残留

---

## Web 端 Telegram WebApp 平台分支抜除深度

| Option | Description | Selected |
|--------|-------------|----------|
| A | 强耦合都删 + `usePlatform` 收敛为 `'pwa' \| 'browser'`（保留抽象） | ✓ |
| B | 激进——连 `usePlatform` 也删，需要时 inline `matchMedia('(display-mode: standalone)')` | |
| C | 保守——telegram 分支换 noop，抽象原状保留（会被 ripgrep 拦） | |

**User's choice:** A（推荐）
**Notes:** 项目定位是 PWA 直接在 Tailscale 内网访问；`usePlatform` 抽象本身有意义（PWA vs 浏览器区分仍需要），不必整删。`useAuthSource.ts` 收敛为单 source = access-token，与 auth 路由收敛联动（D-18 / D-24）。

---

## `web/src/realtime/` 与 ElevenLabs 删除范围

| Option | Description | Selected |
|--------|-------------|----------|
| A | 整目录删 + 消费侧拔语音按钮/状态（默认） | ✓ |
| B | research 阶段先逐文件清点非 voice 引用，避免误删 | |
| C | 只删 elevenlabs / voice route，保留 realtime 抽象（为未来其他 realtime 场景预留） | |

**User's choice:** A（推荐）
**Notes:** scout 阶段确认所有 realtime 消费方都服务于语音功能；不存在非 voice 用法。composer 拔按钮后 UI 自然收敛，不补 placeholder。

---

## notification channel 抽象

| Option | Description | Selected |
|--------|-------------|----------|
| C | 保留 channel 抽象，只删 telegram + serverchan 实现（与 D-01 一致） | ✓ |
| A | 折叠抽象，notificationHub 直接调 web push（跨 Phase 8 边界） | |

**User's choice:** C（推荐）
**Notes:** 抽象本身很轻；Phase 8 (REFH-04) 才正式做 hub 内部解耦，那时若 channel 抽象仍多余再一并处理。本 phase 不跨边界。

---

## auth 路由收敛

| Option | Description | Selected |
|--------|-------------|----------|
| A | 删所有 telegram 分支 + body schema 收敛 + 不引新负向测试（留 Phase 11） | ✓ |
| B | 同 A 但顺手加 bad-token / expired JWT 负向测试（跨 Phase 11 边界） | |

**User's choice:** A（推荐）
**Notes:** 与 D-01 / D-07 一致，本 phase 不引新测试；Phase 11 (REFT-03) 专门做 auth 路由 negative case 覆盖。

---

## ripgrep 白名单边界

| Option | Description | Selected |
|--------|-------------|----------|
| A | 追加 `website/` + `docs/public/schemas/settings.schema.json` 到白名单，PLAN 中显式列出 | ✓ |
| B | 本 phase 顺手清 website locales 中 telegram/voice 字段（跨 Phase 12 一部分） | |
| C | 本 phase 顺手删 `website/` 整目录（提前干 CUT-12，明显跨边界） | |

**User's choice:** A（推荐）
**Notes:** `website/` 整目录 Phase 12 删；`docs/public/schemas/settings.schema.json` 是 docs 副产物，Phase 10 / Phase 12 联动处理。本 phase 守恪边界，白名单显式列出避免 silent skip。

---

## 提交粒度

| Option | Description | Selected |
|--------|-------------|----------|
| B | 5 commits（CUT-06 拆 hub-side / web-side） | ✓ |
| A | 沿用 Phase 1 4 commits (3 CUT + 1 清理) | |
| C | 交给 planner 决定（CONTEXT 仅记 D-14 原则） | |

**User's choice:** B（推荐）
**Notes:** CUT-06 在 hub-side（物理删目录 + 鉴权分支）与 web-side（平台分支重写 + UI 收敛）影响面差异大；拆开 bisect 友好。其余 CUT 沿用一条一 commit。

---

## settings schema / serverSettings 字段 + CLI 残留

| Option | Description | Selected |
|--------|-------------|----------|
| A | 全删 + 不加兼容兜底（符合 no backcompat）；CLI 残留进清理 commit | ✓ |
| B | 删字段但临时加 Zod `.passthrough()` 等 Phase 10（软兼容违背原则） | |

**User's choice:** A（推荐）
**Notes:** 与 PROJECT.md「No backward compatibility」原则一致；旧 settings.json 启动 schema 校验失败 → 用户手动 migrate；不在本 phase 加迁移工具（Phase 10 REFC-01 统一处理）。

---

## Claude's Discretion

- 每个 commit 内部的文件删除顺序（按依赖图自底向上）
- `useAuthSource.ts` / `useTelegram.ts` 是删整文件还是保留空 shell（以 typecheck 是否通过为唯一硬约束；推荐整删）
- `usePlatform.ts` 内部实现细节
- channel 注册删除的具体实现形式（数组项删 vs feature flag）——倾向直接删
- composer voice 按钮拔除后是否补 placeholder——推荐不补
- hub `index.ts` 启动 banner 中关于 Telegram bind URL 的输出清理（零容忍下应清）

## Deferred Ideas

- notification channel 抽象折叠 → Phase 8 (REFH-04)
- auth 路由 negative case 覆盖 → Phase 11 (REFT-03)
- settings.json 旧字段迁移工具 → Phase 10 (REFC-01)
- `website/` 删除 + `docs/` 清理 → Phase 12 (CUT-12)
- hub `auth.ts` helper / `ApiRouteError` 重构 → Phase 8 (REFH-03)
- composer 系统 speech-to-text 替代入口 → 不规划（移动端系统已够用）
