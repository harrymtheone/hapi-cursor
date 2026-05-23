# Phase 4: Cut deployment infrastructure - Context

**Gathered:** 2026-05-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 4 交付的是：删除 HAPI 自带的部署/远程调试基础设施，让项目回到“本机 hub + Tailscale 内网 + Web PWA”这一单人使用路径。

**In scope:** CUT-10 与 CUT-11。物理删除内置 WireGuard/TLS relay tunnel（`hub/src/tunnel/`、`hub/tools/tunwg/`、`hub/scripts/download-tunwg.ts`、`web/src/lib/relay-mode*`、`HAPI_RELAY_*` 配置、tunnel QR/启动展示）以及远程日志上传通道（`DANGEROUSLY_LOG_TO_SERVER_FOR_AI_AUTO_DEBUGGING`、`cli/src/ui/logger.ts` 中的上传逻辑、`doctor` 中的相关提示）。

**Out of scope:** Tailscale 本身不集成、不配置；Phase 10 的通用 config cleanup（`serverUrl` / `webapp*` / runtime migration ladder）不提前做；Phase 12 的 README/docs/website 长篇文案清理不提前做；不新增日志 export、token rotation、外部 tunnel 替代方案或新部署功能。

</domain>

<decisions>
## Implementation Decisions

### 1. Tunnel 删除边界

- **D-49：内置 relay/tunwg/TLS gate 物理删除，不留 feature flag 或 stub。** 删除 `hub/src/tunnel/`、`hub/tools/tunwg/`、`hub/scripts/download-tunwg.ts`、`web/src/lib/relay-mode*`；调用方改为 Tailscale/public URL 的中性语义。
- **D-50：保留 `HAPI_PUBLIC_URL` / local URL 输出。** 删除 relay 不等于删除“告诉手机打开哪个地址”的能力；Tailscale 场景仍可用 `HAPI_PUBLIC_URL` 指向用户自己的内网地址。
- **D-51：删除 tunnel QR 渲染和 `qrcode` 依赖。** Hub 启动日志只打印 local/public URL 文本；不再生成 relay/tunnel URL 的二维码。
- **D-52：删除 relay-mode Web 入口。** Web PWA 只按当前 hub origin 或显式 hub URL 工作；`app.hapi.run` 这类 hosted relay 入口不再支持。

### 2. Config / Settings 收敛

- **D-53：`HAPI_RELAY_*` 与 relay settings 直接从 config/schema 删除。** 不做 `.passthrough()`、不静默忽略旧字段；旧 settings 含 relay 字段时应显式失败，用户手动移除。
- **D-54：`HAPI_PUBLIC_URL` 保留，`HAPI_OFFICIAL_WEB_URL` 的 relay/hosted-web 语义删除或停止使用。** 只保留服务单机 Tailscale 的配置面。
- **D-55：启动配置摘要不保留 relay/tunnel disabled 状态。** 删除相关 env 读取、默认值、source reporting、启动 banner 展示；日志只展示仍然可操作的信息。
- **D-56：本阶段更新当前 relay 字段相关测试和 schema 输入。** 不等 Phase 10，但也不顺手做 Phase 10 的通用 config cleanup。

### 3. 远程日志上传

- **D-57：CLI logger 删除远程上传路径，本地日志保留。** 删除 `DANGEROUSLY_LOG_TO_SERVER_FOR_AI_AUTO_DEBUGGING` 判断和 `HAPI_API_URL` 上传逻辑；保留 console 与 `~/.hapi/logs` 本地文件日志。
- **D-58：`doctor` 删除远程日志开关提示。** 保留本地日志目录、配置和连接状态等仍可操作的诊断信息。
- **D-59：`HAPI_API_URL` 按用途处理，不做字符串误伤。** 只删除服务远程日志、relay 或远程 debug 的使用；如果还有真实 API/config 用途，不因同名直接删除。
- **D-60：不新增替代上报或 export 功能。** 诊断路径保持本地日志 + doctor 输出 + 手动复制错误信息。

### 4. Build / Release Pipeline

- **D-61：`build:single-exe` 不再下载或打包 tunwg。** 从 scripts/package scripts 移除 `download-tunwg` 步骤；single-exe 只构建 web、生成 embedded assets、编译 CLI/hub。
- **D-62：只删除 tunwg runtime asset 面，不重构所有 runtime tools。** 保留 ripgrep、difftastic 等仍被 CLI 使用的 runtime tool / extraction 机制。
- **D-63：清理 tunwg 专属 release/CI/asset surface。** 删除会让 release、cache、checksum 或平台二进制流程下载/打包 tunwg 的逻辑；不改 npm/Homebrew 发布主流程，除非它直接依赖 tunwg。
- **D-64：`bun run build:single-exe` 是本阶段硬门槛。** 验证时必须确认构建过程中没有 tunwg 下载、解压或网络依赖。

### 5. 验证与白名单

- **D-65：硬性 zero-tolerance 关键词为 `tunwg` / `HAPI_RELAY_` / `DANGEROUSLY_LOG_TO_SERVER_FOR_AI_AUTO_DEBUGGING`。** 同时把 `relay-mode` / deleted hosted-web symbols 作为 plan-level sweep 检查，防止 Web relay 残留。
- **D-66：白名单默认只允许 `.planning/codebase/` 与 `CHANGELOG.md`。** 如 planner 需要其它历史文件白名单，必须在 PLAN 中逐项写明原因；不要默认白名单 `docs/` 或 `website/`。
- **D-67：源码注释/JSDoc 本阶段清理，长篇 docs 留 Phase 12。** `cli/`、`hub/`、`web/`、`shared/` 内源码注释/JSDoc 不应保留 relay/tunwg/remote-log 残留；README/docs/website prose 文案由 Phase 12 处理。
- **D-68：推荐 4 个执行切片。** 1) tunnel/web relay 删除；2) config 收敛；3) remote logging 删除；4) build+guard 验证。每片跑 `bun typecheck` + `bun run test`，最终跑 `bun run build:single-exe`。

### Claude's Discretion

- 具体函数/变量命名、文件删除顺序、测试文件拆分由 researcher/planner 按依赖图决定。
- 如果某个 release/CI 命中是否属于 tunwg 专属 surface 不明显，按“是否会下载/打包/引用 tunwg”判断；无关发布主流程不重构。
- 如果 `HAPI_OFFICIAL_WEB_URL` 与其它仍需要的 public URL 行为耦合，优先保留 Tailscale 所需的最小 URL 能力，并在 PLAN 中解释迁移路径。

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 项目宪法

- `.planning/PROJECT.md` — 单人 Tailscale + Cursor-only 定位；明确不依赖 Cloudflare/ngrok/HAPI relay、Telegram、ServerChan、远程日志上报。
- `.planning/REQUIREMENTS.md` — CUT-10 / CUT-11 映射到 Phase 4；Phase 10/12 边界防止 scope creep。
- `.planning/ROADMAP.md` §「Phase 4: Cut deployment infrastructure」— 本阶段 success criteria #1-#5 是验收锚点。
- `AGENTS.md` — No backward compatibility、Bun workspaces、TypeScript strict、必要测试、4 空格缩进。

### Prior Phase Decisions

- `.planning/phases/01-cut-non-cursor-agents/01-CONTEXT.md` — D-01 最小切除、D-11~D-13 源码关键词零容忍 + 白名单、D-14/D-15 小提交 + 每提交测试。
- `.planning/phases/02-cut-external-integration-channels/02-CONTEXT.md` — D-22/D-23 保留抽象不越界重构、D-27~D-29 关键词守卫、D-32 settings 字段直接删且不加兼容 passthrough。
- `.planning/phases/03-cut-multi-user-namespace-isolation/03-CONTEXT.md` — D-41 schema/旧数据处理走显式失败/离线迁移思路、D-46~D-48 可 bisect 切片与零容忍验证节奏。

### Codebase Maps

- `.planning/codebase/STACK.md` — 记录 `tunwg`、`qrcode`、`HAPI_RELAY_*`、`build:single-exe`、runtime tools 与 env 配置面。
- `.planning/codebase/ARCHITECTURE.md` — 记录 hub entrypoint、TunnelManager、single binary deployment、global state 与启动职责。
- `.planning/codebase/INTEGRATIONS.md` — 记录 Relay Tunnel、remote hosting/deployment、env vars、outgoing integrations。

### 本 phase 直接相关源码 / 构建面

- `hub/src/tunnel/` — TunnelManager / TLS gate 删除目标。
- `hub/tools/tunwg/` — bundled tunwg binary 删除目标。
- `hub/scripts/download-tunwg.ts` — tunwg download script 删除目标。
- `hub/src/index.ts` — tunnel manager wiring、startup URL/QR/banner、channel/entrypoint surface。
- `hub/src/configuration.ts`、`hub/src/config/settings.ts`、`hub/src/config/serverSettings.ts` — relay env/default/source/settings schema 删除面。
- `web/src/lib/relay-mode*` — relay-mode Web path 删除目标。
- `cli/src/ui/logger.ts` — remote log upload path 删除目标；local logger 保留。
- `cli/src/ui/doctor.ts` — remote debug/logging toggle 提示删除面。
- `package.json` files、`bun.lock`、release/CI scripts — `download-tunwg`、`qrcode`、tunwg asset references 清理面。

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- `HAPI_PUBLIC_URL` / local URL startup output — 保留为 Tailscale URL 的中性入口，但不能再暗含 relay/hosted-web 语义。
- `~/.hapi/logs` local logging — 保留作为唯一日志诊断路径。
- Existing runtime tool mechanism for `rg` / `difftastic` — 保留；只移除 tunwg 资产。
- Prior ripgrep guard pattern from Phases 1–3 — 复用并追加本阶段关键词/白名单。

### Established Patterns

- 删除型 phase 延续“最小切除”：删实现 + 收敛消费方，不顺手做后续 Phase 的大重构。
- No backward compatibility：旧 settings 字段直接失败，不加迁移 shim 或 silent ignore。
- 每个执行切片应保持 `bun typecheck` + `bun run test` 绿色；最终加 `bun run build:single-exe` 验证。
- Long-form docs cleanup belongs to Phase 12；source comments/JSDoc in touched packages are part of this phase's zero-tolerance cleanup.

### Integration Points

- Hub startup: `hub/src/index.ts` wires configuration, web server, optional tunnel manager, startup banner and URL output.
- Configuration: env/settings/default/source reporting currently exposes relay-related values and must shrink with schema/tests.
- Web relay behavior: `web/src/lib/relay-mode*` and any hosted-web assumptions must disappear with tunnel removal.
- Build pipeline: root/package scripts and release helpers must no longer download, cache, checksum, copy, or embed tunwg.
- CLI diagnostics: `cli/src/ui/logger.ts` and `cli/src/ui/doctor.ts` should converge on local-only diagnostics.

</code_context>

<specifics>
## Specific Ideas

- Keep “手机通过 Tailscale 打开 hub URL” as the mental model; no built-in public relay and no hosted relay Web entry.
- Prefer deletion-first: remove tunnel/logging types and imports, let TypeScript expose all callsites, then collapse callsites to local/Tailscale semantics.
- Do not preserve visible “relay disabled” UI/log state. Removed features should not remain as user-facing ghosts.
- Planner should explicitly call out any extra whitelist beyond `.planning/codebase/` and `CHANGELOG.md`; hidden whitelist creep is not allowed.

</specifics>

<deferred>
## Deferred Ideas

- **General config cleanup** (`serverUrl` / `webapp*` aliases, `hapi server`, runtime SQLite migration ladder) — Phase 10.
- **README/docs/website prose cleanup for relay/tunnel references** — Phase 12.
- **Alternative tunnels / logs export / deployment helper features** — out of scope; not planned for Milestone 1.

</deferred>

---

*Phase: 4-Cut deployment infrastructure*
*Context gathered: 2026-05-21*
