# Phase 04: cut-deployment-infrastructure - Research

**Researched:** 2026-05-21
**Domain:** Brownfield TypeScript/Bun feature deletion across hub startup, CLI runtime assets, build scripts, and CLI diagnostics
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
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

### Deferred Ideas (OUT OF SCOPE)
## Deferred Ideas

- **General config cleanup** (`serverUrl` / `webapp*` aliases, `hapi server`, runtime SQLite migration ladder) — Phase 10.
- **README/docs/website prose cleanup for relay/tunnel references** — Phase 12.
- **Alternative tunnels / logs export / deployment helper features** — out of scope; not planned for Milestone 1.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CUT-10 | Delete Cloudflare-style tunnel binary + TLS gate: `hub/src/tunnel/`, `hub/tools/tunwg/`, `hub/scripts/download-tunwg.ts`, all `HAPI_RELAY_*`, and `web/src/lib/relay-mode` related code. [CITED: .planning/REQUIREMENTS.md] | Hub startup, web server relay branch, runtime asset embedding, root build scripts, and package dependencies are all mapped below. [VERIFIED: codebase rg/read + GitNexus] |
| CUT-11 | Delete `DANGEROUSLY_LOG_TO_SERVER_FOR_AI_AUTO_DEBUGGING` remote log stream: `cli/src/ui/logger.ts` upload channel and `doctor` toggle. [CITED: .planning/REQUIREMENTS.md] | Logger internals and doctor display are mapped below; unrelated direct-connect `HAPI_API_URL` uses must remain. [VERIFIED: codebase rg/read + GitNexus] |
</phase_requirements>

## Summary

Phase 04 is a codebase-only deletion phase, not a new deployment feature. The safe plan is to remove the built-in relay/tunwg/TLS path from hub startup and single-exe packaging while preserving the neutral local/public URL path for Tailscale users. [CITED: .planning/phases/04-cut-deployment-infrastructure/04-CONTEXT.md] [VERIFIED: codebase rg/read]

The critical implementation boundary is that `HAPI_API_URL` is not itself a remote-log feature. It is still used by direct CLI-to-hub connection setup, auth output, runner control, auto-start suppression, tests, and docs. Only the `DANGEROUSLY_LOG_TO_SERVER_FOR_AI_AUTO_DEBUGGING` gate, `Logger.sendToRemoteServer`, and the doctor line surfacing that remote-log toggle belong to CUT-11. [VERIFIED: codebase rg/read] [VERIFIED: GitNexus]

**Primary recommendation:** Plan four slices exactly as locked in CONTEXT: (1) delete tunnel/web relay startup surface, (2) remove relay config and settings validation surface, (3) remove remote log upload path, (4) remove tunwg build/runtime assets and add/extend guards, then run `bun typecheck`, `bun run test`, and `bun run build:single-exe`. [CITED: .planning/phases/04-cut-deployment-infrastructure/04-CONTEXT.md]

## Project Constraints (from .cursor/rules/)

- Use Bun runtime, TypeScript strict, and Bun workspaces; do not change the established stack. [CITED: .cursor/rules/gsd-workflow.mdc]
- Keep the deployment model local machine + Tailscale intranet; do not add Cloudflare, ngrok, HAPI relay, Telegram, ServerChan, or ElevenLabs dependencies. [CITED: .cursor/rules/gsd-workflow.mdc]
- Do not preserve backward compatibility for removed config/protocol paths; fail explicitly instead of silently ignoring old shapes. [CITED: .cursor/rules/gsd-workflow.mdc]
- Minimize external dependencies; `tunwg` is explicitly listed as a dependency to remove with CUT phases. [CITED: .cursor/rules/gsd-workflow.mdc]
- Use 4-space indentation, single quotes, existing semicolon style per file, named exports, and `@/*` package aliases. [CITED: .cursor/rules/gsd-workflow.mdc]
- Parse external/IPC payloads with Zod where payload validation is needed; do not introduce untyped code. [CITED: .cursor/rules/gsd-workflow.mdc]
- Never log secrets, tokens, or full message bodies; this is especially relevant while removing remote log upload. [CITED: .cursor/rules/gsd-workflow.mdc]
- Make direct repo edits only inside the active GSD workflow. This research was produced by the GSD phase-researcher workflow. [CITED: .cursor/rules/gsd-workflow.mdc]

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|--------------|----------------|-----------|
| Local hub URL output for Tailscale use | API / Backend (Hub) | Browser / Client | Hub owns listen host/port/public URL and startup display; browser just loads the served PWA. [VERIFIED: codebase rg/read] |
| Built-in relay tunnel deletion | API / Backend (Hub) | Build / Packaging | Hub owns tunnel lifecycle; build/runtime packaging owns tunwg asset embedding and extraction. [VERIFIED: GitNexus] |
| Hosted relay web entry removal | API / Backend (Hub web server) | Browser / Client | `hub/src/web/server.ts` currently branches on `relayMode` to skip static serving and redirect users to official hosted web. [VERIFIED: codebase rg/read] |
| Remote log upload deletion | CLI | API / Backend | CLI logger owns upload behavior; no hub endpoint was found in runtime source for receiving this special path. [VERIFIED: codebase rg/read] |
| Keyword guard enforcement | Build / Scripts | CLI test runtime | Existing root `bun run test` ends with `scripts/check-no-cut-agents.sh`; extending it is the lowest-friction guard location. [VERIFIED: codebase rg/read] |

## Standard Stack

### Core

| Library / Tool | Version | Purpose | Why Standard |
|----------------|---------|---------|--------------|
| Bun | 1.3.14 | Runtime, package manager, test runner, and compile target. [VERIFIED: local shell + package.json] | Existing repo standard; `build:single-exe` and package scripts are Bun-based. [VERIFIED: codebase read] |
| TypeScript | `^5` | Strict typechecking across CLI, hub, web, and shared packages. [VERIFIED: package.json reads] | Existing workspace contract; deletion should rely on typecheck to expose dangling imports. [VERIFIED: codebase read] |
| Vitest / Bun test | Vitest `^4.0.16`, hub uses `bun test` | CLI/web tests use Vitest; hub package test script uses Bun's test runner. [VERIFIED: package.json + vitest configs] | Existing test layout is colocated `*.test.ts` / `*.test.tsx`. [VERIFIED: codebase read] |
| Hono | `^4.11.2` | Hub HTTP API and PWA serving. [VERIFIED: hub/package.json] | Existing web server; the phase removes an option branch, not the server framework. [VERIFIED: codebase read] |
| Socket.IO / SSE | Socket.IO `^4.8.3`, `@socket.io/bun-engine` `^0.1.0` | Realtime CLI/hub/web channels. [VERIFIED: package.json reads] | Must remain untouched; relay deletion is orthogonal to realtime sync. [VERIFIED: architecture docs + codebase read] |

### Supporting

| Library / Tool | Version | Purpose | When to Use |
|----------------|---------|---------|-------------|
| `@hapi/protocol` | workspace `0.1.0` | Shared schemas/types/socket contracts. [VERIFIED: shared/package.json] | Keep imports stable; no shared contract changes are required unless a relay-related type is discovered during implementation. [VERIFIED: codebase rg/read] |
| `tar` | `^7.5.2` | Runtime extraction for ripgrep and difftastic archives. [VERIFIED: cli/package.json] | Keep it; `cli/src/runtime/assets.ts` still unpacks rg/difftastic after tunwg is removed. [VERIFIED: codebase read] |
| Cursor-bundled ripgrep | 15.1.0-cursor5 fallback available | Source guard scanning. [VERIFIED: local shell] | Existing guard script falls back to Cursor's bundled `rg` if system `rg` is missing. [VERIFIED: codebase read + local shell] |

### Removals

| Package / Asset | Current Version | Disposition | Evidence |
|-----------------|-----------------|-------------|----------|
| `qrcode` | `^1.5.4`; npm latest 1.5.4, modified 2025-11-13 | Remove from `hub/package.json` and `bun.lock`; QR output is relay-only per locked decision. [VERIFIED: npm registry + codebase read] |
| `@types/qrcode` | `^1.5.6`; npm latest 1.5.6, modified 2025-10-24 | Remove from `hub/package.json` and `bun.lock`. [VERIFIED: npm registry + codebase read] |
| `hub/tools/tunwg/` | Local asset directory contains `LICENSE`; downloaded binaries are gitignored. | Delete the tracked directory and `.gitignore` tunwg allowances if no longer needed. [VERIFIED: glob + codebase read] |
| `hub/scripts/download-tunwg.ts` | Local Bun script | Delete; root build scripts must not call it. [VERIFIED: codebase read] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Deleting tunnel code | Keep no-op stubs or disabled flags | Rejected by D-49; feature ghosts would violate zero-tolerance keyword checks. [CITED: 04-CONTEXT.md] |
| Keeping QR for public URL | Generate QR for `HAPI_PUBLIC_URL` | Rejected by D-51; this would retain `qrcode` dependency and broaden scope beyond neutral text output. [CITED: 04-CONTEXT.md] |
| Removing all `HAPI_API_URL` | Keep only non-log uses | D-59 requires keeping real direct-connect uses; blind string deletion would break CLI/hub connectivity. [CITED: 04-CONTEXT.md] [VERIFIED: codebase rg/read] |

**Installation:** No new packages. This phase removes packages/assets. [VERIFIED: 04-CONTEXT.md]

```bash
bun remove --cwd hub qrcode @types/qrcode
```

Use `bun remove` or equivalent Bun workspace lockfile update from repo root semantics; verify `hub/package.json` and `bun.lock` no longer reference those packages. [ASSUMED]

## Package Legitimacy Audit

No external packages should be installed in this phase. The package legitimacy gate is not applicable except to confirm removals. [CITED: 04-CONTEXT.md]

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| `qrcode` | npm | Existing package; latest 1.5.4 modified 2025-11-13 | Not checked | Not checked | Not run | REMOVED |
| `@types/qrcode` | npm | Existing package; latest 1.5.6 modified 2025-10-24 | Not checked | Not checked | Not run | REMOVED |

**Packages removed due to slopcheck [SLOP] verdict:** none; no packages are added.
**Packages flagged as suspicious [SUS]:** none; no packages are added.

## Architecture Patterns

### System Architecture Diagram

```text
Before Phase 04

hub start
  -> parse --relay / --no-relay
  -> start web server
      -> if relayMode: skip embedded/static assets and point to official hosted web
      -> otherwise: serve hub-local embedded/static PWA
  -> if relay enabled:
      -> spawn tunwg
      -> wait for TLS
      -> build hosted-web direct access URL
      -> render QR with qrcode

After Phase 04

hub start
  -> load normal config: listen host, listen port, public URL, CORS
  -> start web server
      -> always serve hub-local embedded/static PWA when available
  -> print local URL and HAPI_PUBLIC_URL text
  -> no tunnel process, no hosted relay redirect, no QR, no tunwg assets
```

### Recommended Project Structure

```text
hub/src/
├── index.ts                # Hub startup; remove tunnel manager, relay flag, QR, hosted-web URL wiring
├── web/server.ts           # Always serve local/embedded web assets; remove relayMode branch
└── config/                 # Reject old relay settings fields if they appear

cli/src/
├── runtime/assets.ts       # Keep rg/difftastic extraction; remove tunwg readiness/path/chmod
├── runtime/embeddedAssets.bun.ts # Embed only rg/difftastic assets
├── types/assetImports.d.ts # Remove tunwg module declarations
└── ui/
    ├── logger.ts           # Local file/console logging only
    └── doctor.ts           # No remote-log toggle display

scripts/
└── check-no-cut-agents.sh  # Extend guard with Phase 04 patterns and tight whitelist
```

### Pattern 1: Deletion-first with TypeScript follow-up

**What:** Delete target directories/scripts/imports first, then let `bun typecheck` reveal dangling references. [CITED: 04-CONTEXT.md] [VERIFIED: codebase read]

**When to use:** Use for `hub/src/tunnel/`, `hub/scripts/download-tunwg.ts`, `hub/tools/tunwg/`, and `qrcode` removal. [CITED: 04-CONTEXT.md]

**Example:**

```typescript
// Source: hub/src/index.ts before deletion [VERIFIED: codebase read]
// Remove imports and all branches that depend on these values.
import { TunnelManager } from './tunnel'
import { waitForTunnelTlsReady } from './tunnel/tlsGate'
import QRCode from 'qrcode'
```

### Pattern 2: Preserve neutral direct-connect config

**What:** Keep `HAPI_PUBLIC_URL`, local URL output, and direct-connect `HAPI_API_URL`; remove only relay/hosted-web semantics. [CITED: 04-CONTEXT.md]

**When to use:** Hub startup and CLI diagnostics. [VERIFIED: codebase rg/read]

**Example:**

```typescript
// Source: hub/src/index.ts before deletion [VERIFIED: codebase read]
console.log('[Web] Hub listening on :' + config.listenPort)
console.log('[Web] Local:  http://localhost:' + config.listenPort)
// Keep this style of neutral URL output; do not rebuild directAccessUrl for app.hapi.run.
```

### Pattern 3: Existing guard extension

**What:** Extend `scripts/check-no-cut-agents.sh` instead of inventing a second guard script. [VERIFIED: codebase read]

**When to use:** Final validation for `tunwg`, `HAPI_RELAY_`, dangerous remote-log flag, plus plan-level sweep for `relay-mode` / hosted web symbols. [CITED: 04-CONTEXT.md]

**Example:**

```bash
# Source: scripts/check-no-cut-agents.sh pattern [VERIFIED: codebase read]
PATTERN='\b(claude|codex|gemini|opencode|telegram|serverchan|elevenlabs|grammy)\b'
# Planner should add a Phase-04 guard pattern rather than broadening old whitelists.
```

### Anti-Patterns to Avoid

- **Leaving disabled tunnel state:** Do not keep `Tunnel: disabled`, `--no-relay`, no-op `TunnelManager`, or empty `hub/src/tunnel/index.ts`; D-49/D-55 require physical deletion and no disabled-state banner. [CITED: 04-CONTEXT.md]
- **Blind `HAPI_API_URL` deletion:** `HAPI_API_URL` remains direct-connect config in CLI config, runner control, auth status, auto-start, and docs; only remote-log upload use is in scope. [CITED: 04-CONTEXT.md] [VERIFIED: codebase rg/read]
- **Removing all runtime asset code:** `rg` and `difftastic` archives remain required by CLI modules; only tunwg asset readiness, embedding, and path declarations should go. [CITED: 04-CONTEXT.md] [VERIFIED: codebase read]
- **Whitelisting docs broadly for Phase 04 keywords:** D-66 allows `.planning/codebase/` and `CHANGELOG.md` by default; extra whitelist entries need explicit PLAN justification. [CITED: 04-CONTEXT.md]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Replacement tunnel | New Cloudflare/ngrok/Tailscale integration or helper | No replacement; user-managed Tailscale + `HAPI_PUBLIC_URL` | Phase explicitly removes built-in deployment infrastructure and does not configure Tailscale. [CITED: 04-CONTEXT.md] |
| Log export/upload | New upload endpoint, export command, or "removed feature" UX | Local `~/.hapi/logs`, doctor output, manual sharing | D-60 rejects alternative reporting features. [CITED: 04-CONTEXT.md] |
| Custom scanner | New Node scanner script for final guard | Existing `scripts/check-no-cut-agents.sh` with `rg` fallback | Existing `bun run test` already runs the guard and Cursor-bundled `rg` exists. [VERIFIED: codebase read + local shell] |
| Broad build refactor | New asset pipeline abstraction | Existing `cli/src/runtime/assets.ts` and `embeddedAssets.bun.ts` minus tunwg | D-62 says retain non-tunwg runtime tool/extraction mechanism. [CITED: 04-CONTEXT.md] |

**Key insight:** This phase is safer when treated as a subtractive graph cleanup, not an infrastructure redesign. [ASSUMED]

## Runtime State Inventory

| Category | Items Found | Action Required |
|----------|-------------|-----------------|
| Stored data | `~/.hapi/settings.json` currently supports `listenHost`, `listenPort`, `publicUrl`, `corsOrigins`, VAPID keys, CLI token, and owner/machine fields; no relay fields are defined in current `Settings` / `ServerSettings`. Unknown fields are preserved by raw JSON read/write, and existing server settings rejection currently covers `webappHost`, `webappPort`, `webappUrl`. [VERIFIED: codebase read] | Add relay-field rejection only if implementation finds legacy relay settings keys in settings surfaces; do not silently ignore old relay settings if present. [CITED: 04-CONTEXT.md] |
| Live service config | No external relay service configuration should remain in git-managed code after `HAPI_RELAY_*`, `--relay`, hosted web, and tunwg surfaces are deleted. Actual user shell profiles, pm2, launchd, or systemd entries may still contain `hapi hub --relay`, but live machine config was not enumerated in this research. [ASSUMED] | Planner should add a manual note/check if the user runs long-lived service managers; not a code edit unless repo scripts contain `--relay`. |
| OS-registered state | Repository docs include service-manager examples with `hapi hub --relay`, but Phase 12 owns long-form docs. No repo-owned OS registration files were found in source scope. [VERIFIED: codebase rg/read] | Do not edit docs prose in Phase 04 unless it is inline source/JSDoc; optional manual cleanup of local service manager commands is outside repo plan. |
| Secrets/env vars | `HAPI_RELAY_API`, `HAPI_RELAY_AUTH`, `HAPI_RELAY_FORCE_TCP`, `HAPI_OFFICIAL_WEB_URL`, and `DANGEROUSLY_LOG_TO_SERVER_FOR_AI_AUTO_DEBUGGING` are env surfaces tied to relay/remote logging; `HAPI_API_URL` remains a legitimate direct-connect CLI env var. [VERIFIED: codebase rg/read] | Remove relay/remote-log env reads and doctor exposure; keep direct-connect `HAPI_API_URL` reads. |
| Build artifacts | `hub/tools/tunwg/LICENSE` is tracked; actual per-platform tunwg binaries are gitignored. `~/.hapi/runtime/<version>/tools/tunwg/` may exist from prior single-exe runs. `dist-exe/` or compiled binaries may contain old assets if already built. [VERIFIED: glob + codebase read] [ASSUMED for local runtime/build artifact existence] | Delete source assets and build script references; planner should recommend clean rebuild or deletion of stale `dist-exe/`/runtime assets only if verification sees stale output. |

## Common Pitfalls

### Pitfall 1: Breaking direct-connect by deleting `HAPI_API_URL`

**What goes wrong:** CLI can no longer connect to a non-default hub URL. [VERIFIED: codebase rg/read]

**Why it happens:** CUT-11 mentions `HAPI_API_URL` because the remote-log upload path uses it, but the same env var is also direct-connect configuration. [CITED: 04-CONTEXT.md] [VERIFIED: codebase rg/read]

**How to avoid:** Remove `HAPI_API_URL` only from remote-log upload logic in `cli/src/ui/logger.ts`; keep config, auth, runner, auto-start, and normal doctor URL display if still useful. [CITED: 04-CONTEXT.md]

**Warning signs:** Failing `cli/src/commands/auth.test.ts`, runner control failures, or unexpected deletion of `apiUrl` settings comments. [VERIFIED: codebase rg/read]

### Pitfall 2: Leaving tunwg in compiled runtime asset path

**What goes wrong:** `bun run build:single-exe` still requires downloaded tunwg binaries or embeds `hub/tools/tunwg/*`. [VERIFIED: codebase read]

**Why it happens:** Tunwg is referenced in three places: root build script download step, `cli/src/runtime/embeddedAssets.bun.ts`, and `cli/src/runtime/assets.ts` readiness/path/chmod helpers. [VERIFIED: codebase rg/read]

**How to avoid:** Remove all three layers atomically in the build/runtime slice while preserving `ripgrep` and `difftastic` archive handling. [CITED: 04-CONTEXT.md] [VERIFIED: codebase read]

**Warning signs:** `build:single-exe` output mentions `download:tunwg`, missing `hub/tools/tunwg/*`, or runtime readiness checks for `tools/tunwg`. [VERIFIED: codebase read]

### Pitfall 3: Keeping relay-mode hosted web branch

**What goes wrong:** The hub still supports hosted relay web entry by passing `relayMode` / `officialWebUrl` to `startWebServer`. [VERIFIED: codebase read]

**Why it happens:** `hub/src/web/server.ts` has a self-contained `relayMode` branch that returns early and does not serve embedded/static assets. [VERIFIED: codebase read]

**How to avoid:** Remove `relayMode` and `officialWebUrl` options from `createWebApp` / `startWebServer`, and update the only caller in `hub/src/index.ts`. [VERIFIED: GitNexus]

**Warning signs:** Remaining strings `relayMode`, `officialWebUrl`, `app.hapi.run`, `--relay`, or `--no-relay` in runtime source. [VERIFIED: codebase rg/read]

### Pitfall 4: Guard whitelist creep

**What goes wrong:** Final zero-match scans pass because docs or broad directories were silently whitelisted. [ASSUMED]

**Why it happens:** Prior guard script has many whitelists for earlier phases; Phase 04 has tighter default whitelist rules. [VERIFIED: codebase read] [CITED: 04-CONTEXT.md]

**How to avoid:** Add a Phase 04 pattern and whitelist only `.planning/codebase/` and `CHANGELOG.md` by default; if other entries are necessary, list them explicitly in PLAN. [CITED: 04-CONTEXT.md]

**Warning signs:** Whitelist includes `docs/**`, `website/**`, `README.md`, or broad package globs for Phase 04 keywords. [CITED: 04-CONTEXT.md]

## Code Examples

Verified patterns from current codebase:

### Current hub relay wiring to remove

```typescript
// Source: hub/src/index.ts [VERIFIED: codebase read]
const relayApiDomain = process.env.HAPI_RELAY_API || 'relay.hapi.run'
const relayFlag = resolveRelayFlag(process.argv)
const officialWebUrl = process.env.HAPI_OFFICIAL_WEB_URL || 'https://app.hapi.run'
```

### Current hosted relay web branch to remove

```typescript
// Source: hub/src/web/server.ts [VERIFIED: codebase read]
if (options.relayMode) {
    const officialUrl = options.officialWebUrl || 'https://app.hapi.run'
    app.get('/', (c) => {
        return c.html(`<!DOCTYPE html>
```

### Current remote-log upload path to remove

```typescript
// Source: cli/src/ui/logger.ts [VERIFIED: codebase read]
if (process.env.DANGEROUSLY_LOG_TO_SERVER_FOR_AI_AUTO_DEBUGGING
  && process.env.HAPI_API_URL) {
  this.dangerouslyUnencryptedServerLoggingUrl = process.env.HAPI_API_URL
  console.log(chalk.yellow('[REMOTE LOGGING] Sending logs to server for AI debugging'))
}
```

### Current runtime asset shape to preserve minus tunwg

```typescript
// Source: cli/src/runtime/assets.ts [VERIFIED: codebase read]
const archives = [
    `difftastic-${platformDir}.tar.gz`,
    `ripgrep-${platformDir}.tar.gz`
];
```

## State of the Art

| Old Approach | Current Approach for This Fork | When Changed | Impact |
|--------------|--------------------------------|--------------|--------|
| Built-in WireGuard/TLS relay using downloaded `tunwg` | User-managed Tailscale plus local hub/PWA and `HAPI_PUBLIC_URL` | Phase 04 planned 2026-05-21 [CITED: 04-CONTEXT.md] | Removes external relay dependency and build-time binary download. [CITED: 04-CONTEXT.md] |
| Hosted `app.hapi.run` relay-mode PWA entry | Hub serves embedded/static web PWA from current origin or explicit hub URL | Phase 04 planned 2026-05-21 [CITED: 04-CONTEXT.md] | Removes official hosted-web coupling from runtime source. [CITED: 04-CONTEXT.md] |
| CLI remote log stream gated by dangerous env flag | Local file/console logs only | Phase 04 planned 2026-05-21 [CITED: 04-CONTEXT.md] | Avoids unencrypted upstream log upload risk. [VERIFIED: codebase read] |

**Deprecated/outdated:**
- `--relay` / `--no-relay`: remove from runtime source and guard; long-form docs cleanup is Phase 12. [CITED: 04-CONTEXT.md]
- `HAPI_RELAY_*`: remove env reads and docs/comments in source; no compatibility shim. [CITED: 04-CONTEXT.md]
- `DANGEROUSLY_LOG_TO_SERVER_FOR_AI_AUTO_DEBUGGING`: remove entirely outside allowed historical docs. [CITED: 04-CONTEXT.md]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `bun remove --cwd hub qrcode @types/qrcode` is the preferred command shape for removing hub dependencies and updating `bun.lock`. | Standard Stack | Low: executor can use an equivalent Bun workspace lockfile update if this command shape differs. |
| A2 | Existing local service-manager registrations may contain `hapi hub --relay`, but repo research did not enumerate actual user OS state. | Runtime State Inventory | Medium: user may need a manual post-code cleanup if a launchd/systemd/pm2 entry still passes `--relay`. |
| A3 | Treating this as subtractive graph cleanup is safer than infrastructure redesign. | Don't Hand-Roll | Low: locked decisions already reject replacement features. |
| A4 | Stale built artifacts or runtime dirs may contain old tunwg assets if built before Phase 04. | Runtime State Inventory | Low: source verification remains authoritative; stale artifacts can be deleted during validation if encountered. |

## Open Questions (RESOLVED)

1. **Should old `--relay` CLI args fail or be ignored after deletion?**
   - What we know: D-49/D-55 reject stubs and disabled-state UX; `hub/src/index.ts` currently parses the args itself. [CITED: 04-CONTEXT.md] [VERIFIED: codebase read]
   - What's unclear: Whether the command parser exposes these flags elsewhere; no separate command-definition flag was found during targeted source search. [VERIFIED: codebase rg/read]
   - Recommendation: Remove `resolveRelayFlag`; if args are still passed, they should have no special code path. Do not add a compatibility error unless typecheck/tests reveal command-level validation that needs a clear message. [ASSUMED]
   - RESOLVED: Remove the special relay parser/path and do not add a compatibility stub or user-facing disabled relay state. If a process receives `--relay` or `--no-relay` after deletion, those arguments must have no relay behavior; implementation should not recreate relay-specific parsing just to fail or warn.

2. **Should `HAPI_OFFICIAL_WEB_URL` be removed entirely from runtime source?**
   - What we know: It is only found in hub relay/hosted-web startup wiring during targeted source search. [VERIFIED: codebase rg/read]
   - What's unclear: Whether docs or generated schema references need Phase 04 cleanup beyond source comments; Phase 12 owns long-form docs. [CITED: 04-CONTEXT.md]
   - Recommendation: Remove runtime use from `hub/src/index.ts` and `hub/src/web/server.ts`; leave long-form prose docs for Phase 12 unless source comments/JSDoc are involved. [CITED: 04-CONTEXT.md]
   - RESOLVED: Remove runtime relay/hosted-web usage of `HAPI_OFFICIAL_WEB_URL` entirely from `hub/src/index.ts` and `hub/src/web/server.ts`. Long-form README/docs/website prose cleanup remains Phase 12 unless source comments or JSDoc are touched during this phase.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Bun | Typecheck, tests, build, package scripts | Yes | 1.3.14 | None needed |
| Node.js | GSD graph tooling and some scripts | Yes | v22.22.0 | None needed |
| git | Status/diff/commit flow | Yes | 2.34.1 | None needed |
| System `rg` | Manual source scanning | No | - | Cursor-bundled `rg` 15.1.0-cursor5 is present and used by existing guard fallback |
| slopcheck | Package legitimacy for new installs | No | - | Not needed because no packages are installed |
| Graphify planning graph | Semantic planning graph context | Disabled / absent | - | Used codebase docs, GitNexus, and source reads instead |

**Missing dependencies with no fallback:** none for research. Final implementation should confirm `bun run test:guard` can reach the Cursor-bundled `rg` fallback. [VERIFIED: local shell + codebase read]

**Missing dependencies with fallback:** system `rg` is missing, but `/usr/share/cursor/resources/app/node_modules/@vscode/ripgrep/bin/rg` exists and reports 15.1.0-cursor5. [VERIFIED: local shell]

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest `^4.0.16` for CLI/web, Bun test for hub, shell guard for cut keywords. [VERIFIED: package.json + config reads] |
| Config file | `cli/vitest.config.ts`, `web/vitest.config.ts`; hub has no Vitest config and uses `bun test`. [VERIFIED: glob/read] |
| Quick run command | `bun typecheck && bun run test` |
| Full suite command | `bun typecheck && bun run test && bun run build:single-exe` |

### Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| CUT-10 | No runtime source imports or starts `TunnelManager`, `waitForTunnelTlsReady`, `qrcode`, relay envs, hosted-web relay branch, or tunwg runtime assets. | typecheck + guard + build | `bun typecheck && bun run test:guard && bun run build:single-exe` | Partial: guard exists; Phase 04 patterns need adding. [VERIFIED: codebase read] |
| CUT-10 | Old relay settings fields fail explicitly if present. | unit | `cd hub && bun test src/config/serverSettings.test.ts` | Exists; add relay field case if implementation defines legacy keys. [VERIFIED: codebase read] |
| CUT-11 | Logger writes local file/console only and never fetches `HAPI_API_URL` for remote upload. | unit | `cd cli && bun run test src/ui/logger.test.ts --runInBand` | Missing; Wave 0 gap. [VERIFIED: glob] |
| CUT-11 | Doctor no longer surfaces dangerous remote-log toggle but preserves useful local diagnostics. | unit/snapshot-lite | `cd cli && bun run test src/ui/doctor.test.ts --runInBand` | Missing; Wave 0 gap. [VERIFIED: glob] |

### Sampling Rate

- **Per task commit:** `bun typecheck && bun run test`
- **Per wave merge:** `bun typecheck && bun run test`
- **Phase gate:** `bun typecheck && bun run test && bun run build:single-exe` plus explicit zero-match scans for Phase 04 patterns.

### Wave 0 Gaps

- [ ] `cli/src/ui/logger.test.ts` - covers CUT-11 local-only logging and no remote `fetch`.
- [ ] `cli/src/ui/doctor.test.ts` - covers CUT-11 doctor output without dangerous remote-log toggle.
- [ ] `hub/src/config/serverSettings.test.ts` - add old relay-field rejection cases if old relay settings keys are represented in settings validation.
- [ ] `scripts/check-no-cut-agents.sh` - extend guard for `tunwg`, `HAPI_RELAY_`, `DANGEROUSLY_LOG_TO_SERVER_FOR_AI_AUTO_DEBUGGING`; add plan-level sweep for `relay-mode`, `relayMode`, hosted-web symbols, and `download-tunwg`.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|------------------|
| V2 Authentication | Yes | Preserve existing `CLI_API_TOKEN` and JWT auth; do not alter auth in this phase. [VERIFIED: architecture docs + codebase read] |
| V3 Session Management | Yes | Preserve existing hub session and SSE/socket behavior; tunnel removal should not affect session state. [VERIFIED: architecture docs] |
| V4 Access Control | Yes | Preserve existing CLI/web auth middleware and socket checks. [VERIFIED: architecture docs] |
| V5 Input Validation | Yes | Existing config parsing and settings validation; reject unsupported old settings explicitly. [VERIFIED: codebase read] |
| V6 Cryptography | Yes | Remove WireGuard/TLS relay code rather than replacing crypto; keep JWT secret/VAPID key flows untouched. [VERIFIED: codebase read] |
| V9 Communications | Yes | Post-phase remote access is user-managed Tailscale plus local hub URLs; no bundled public relay. [CITED: .planning/PROJECT.md] |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Accidental secret exfiltration through remote logs | Information Disclosure | Remove `DANGEROUSLY_LOG_TO_SERVER_FOR_AI_AUTO_DEBUGGING` gate and `fetch` upload path; never add replacement upload. [CITED: 04-CONTEXT.md] [VERIFIED: codebase read] |
| Public relay exposure contrary to Tailscale-only threat model | Information Disclosure / Spoofing | Delete `tunwg`, relay envs, hosted-web relay branch, and QR direct access URL. [CITED: 04-CONTEXT.md] |
| Stale relay config silently accepted | Security Misconfiguration | Explicitly reject unsupported relay settings if present; no passthrough or silent ignore. [CITED: 04-CONTEXT.md] |
| Token leak in startup QR/direct URL | Information Disclosure | Remove QR/direct hosted URL generation containing `token: config.cliApiToken`. [VERIFIED: codebase read] |

## Sources

### Primary (HIGH confidence)

- `.planning/phases/04-cut-deployment-infrastructure/04-CONTEXT.md` - locked decisions D-49 through D-68, scope, and deferred work.
- `.planning/REQUIREMENTS.md` - CUT-10 and CUT-11 requirement text.
- `.planning/ROADMAP.md` - Phase 04 success criteria and dependency on Phase 03.
- `.planning/PROJECT.md` - local-first single-user Tailscale positioning and permanent out-of-scope features.
- `.cursor/rules/gsd-workflow.mdc` - actionable project constraints, conventions, and stack summary.
- Code reads: `hub/src/index.ts`, `hub/src/web/server.ts`, `hub/src/tunnel/*`, `hub/scripts/download-tunwg.ts`, `hub/src/config/*`, `cli/src/ui/logger.ts`, `cli/src/ui/doctor.ts`, `cli/src/runtime/assets.ts`, `cli/src/runtime/embeddedAssets.bun.ts`, `cli/src/types/assetImports.d.ts`, root and package `package.json` files.
- GitNexus queries/context/impact - tunnel startup, remote logging, `main`, `Logger`, `ensureRuntimeAssets`, `startWebServer`.
- Local shell probes - Bun 1.3.14, Node v22.22.0, git 2.34.1, system `rg` missing, Cursor-bundled `rg` 15.1.0-cursor5 present.

### Secondary (MEDIUM confidence)

- `npm view qrcode version time.modified` and `npm view @types/qrcode version time.modified` - verified current registry versions before removal.
- `.planning/codebase/STACK.md`, `.planning/codebase/ARCHITECTURE.md`, `.planning/codebase/INTEGRATIONS.md` - codebase maps generated 2026-05-20; useful but potentially slightly stale after Phases 1-3.

### Tertiary (LOW confidence)

- Runtime state assumptions about user-local systemd/launchd/pm2 registrations and stale built artifacts; codebase research cannot verify machine-local registrations without broader host inspection.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - package files, configs, and local tool probes verify the stack and build/test commands.
- Architecture: HIGH - GitNexus and source reads identify the relevant startup, runtime asset, and logger graphs.
- Pitfalls: HIGH for code-level pitfalls; MEDIUM for runtime state pitfalls because host-local service registrations were not enumerated.

**Research date:** 2026-05-21
**Valid until:** 2026-06-20 for codebase-local deletion research; re-run source searches if Phase 04 starts after other phases modify hub startup, CLI runtime assets, or logger/doctor.
