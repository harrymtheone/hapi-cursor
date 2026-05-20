# External Integrations

**Analysis Date:** 2026-05-20

## APIs & External Services

**AI Coding Agents (wrapped, not API-called):**
- Claude Code - Wrapped via spawned subprocess and Claude SDK (`cli/src/claude/sdk/query.ts`, `cli/src/claude/claudeLocal.ts`, `cli/src/claude/claudeRemote.ts`); hooks bridge in `cli/src/commands/hookForwarder.ts`
- Codex (OpenAI) - App-server JSON-RPC client over stdio (`cli/src/codex/codexAppServerClient.ts`, `cli/src/codex/appServerTypes.ts`); session loop in `cli/src/codex/loop.ts`
- Gemini - ACP (Agent Communication Protocol) backend (`cli/src/agent/backends/`, `cli/src/gemini/`)
- Cursor Agent - Local launcher (`cli/src/cursor/`)
- OpenCode - Storage scanner + launcher (`cli/src/opencode/opencodeStorageScanner.ts`)
- Auth/credentials for each agent are the user's own (CLI does not store/transmit provider API keys)

**Voice Assistant:**
- ElevenLabs Conversational AI - Token minting + agent provisioning in `hub/src/web/routes/voice.ts`
  - Base URL: `ELEVENLABS_API_BASE` from `@hapi/protocol/voice` (`shared/src/voice.ts`)
  - Auth: `xi-api-key` header; user supplies own API key (POST body `customApiKey`) or uses server-configured key
  - Client SDK: `@elevenlabs/react` ^0.13.0 (`web/src/realtime/RealtimeSession.ts`)

**Telegram:**
- Telegram Bot API - via grammy ^1.38.4 (`hub/src/telegram/bot.ts`)
  - SDK/Client: `grammy`
  - Auth: `TELEGRAM_BOT_TOKEN` env var (from `@BotFather`)
  - Used for: permission-request notifications, ready-event notifications, callback handling (`hub/src/telegram/callbacks.ts`)
  - Telegram Mini App init-data validation: `hub/src/web/telegramInitData.ts` (HMAC of bot token)

**Server酱 (ServerChan):**
- ServerChan push channel - `hub/src/serverchan/channel.ts`
  - Auth: `SERVERCHAN_SENDKEY` env var
  - Used for: HAPI-Ready notifications (Chinese-language message text)
  - Sends via HTTP POST to ServerChan's send endpoint

**Relay Tunnel:**
- Custom HAPI relay (`relay.hapi.run` by default) - Spawns `tunwg` binary (`hub/src/tunnel/tunnelManager.ts`)
  - Protocol: WireGuard + TLS (E2E encrypted)
  - Binary: bundled per-platform under `hub/tools/tunwg/tunwg-<platform>` (downloaded via `hub/scripts/download-tunwg.ts`)
  - Config envs: `HAPI_RELAY_API`, `HAPI_RELAY_AUTH`, `HAPI_RELAY_FORCE_TCP`
  - TLS readiness gate: `hub/src/tunnel/tlsGate.ts`
- Alternative self-hosted tunnels (documented, not bundled): Cloudflare Tunnel, Tailscale (see `docs/guide/installation.md`)

## Data Storage

**Databases:**
- SQLite (single file, default `~/.hapi/hapi.db`) - `hub/src/store/index.ts`
  - Client: `bun:sqlite` (built-in Bun module)
  - PRAGMAs: WAL, NORMAL synchronous, foreign keys on, 5s busy_timeout
  - File mode `0600`; data dir `0700`
  - Schema version: 9 (migration ladder v1→v9 in `hub/src/store/index.ts`)
  - Tables: `sessions`, `machines`, `messages`, `users`, `push_subscriptions`
  - No ORM; raw prepared statements per store (`SessionStore`, `MachineStore`, `MessageStore`, `UserStore`, `PushStore`)

**File Storage:**
- Local filesystem only (under `~/.hapi/` data dir)
- Settings JSON: `~/.hapi/settings.json` (`hub/src/config/settings.ts`)
- JWT secret: `~/.hapi/jwt-secret.json` (`hub/src/config/jwtSecret.ts`)
- Runtime tools (per CLI version): `~/.hapi/runtime/<version>/tools/...` (ripgrep, difftastic, tunwg)
- Uploads/attachments: temp dirs created by `cli/src/modules/common/handlers/uploads.ts`

**Caching:**
- In-memory only (`hub/src/sync/sessionCache.ts`, `hub/src/sync/machineCache.ts`)
- ElevenLabs agent-ID cache by API-key hash: in-memory `Map` in `hub/src/web/routes/voice.ts`
- Browser PWA cache via Workbox (`web/src/sw.ts`, `workbox-precaching` + `workbox-strategies` + `workbox-expiration` + `workbox-routing`)

## Authentication & Identity

**Web/Mini App ↔ Hub:**
- JWT (HS256) via `jose` (`hub/src/web/middleware/auth.ts`)
  - Secret: 32 random bytes generated at first boot, stored in `~/.hapi/jwt-secret.json` (mode `0600`)
  - Payload: `{ uid: number, ns: string }` (user id + namespace)
  - Header: `Authorization: Bearer <jwt>` (or `?token=` query for `/api/events` SSE)
- Login flows (`hub/src/web/routes/auth.ts`):
  1. **Access Token** - User supplies `CLI_API_TOKEN[:<namespace>]`; constant-time compared to configured token
  2. **Telegram initData** - HMAC-validated against bot token, creates/looks up user row keyed by `(platform='telegram', platform_user_id)`
- Binding telegram → access-token: `hub/src/web/routes/bind.ts`

**CLI ↔ Hub (Socket.IO + REST):**
- Shared secret `CLI_API_TOKEN` (auto-generated 32-char token at first hub launch; printed once)
- Stored on CLI side via `cli/src/api/auth.ts` (reads from `configuration.cliApiToken`)
- Namespace suffix syntax: `CLI_API_TOKEN:<namespace>` for multi-user isolation

**Hub identity:**
- Owner UUID generated and persisted in `settings.json` via `hub/src/config/ownerId.ts`

## Monitoring & Observability

**Error Tracking:**
- None (no Sentry/Datadog/Rollbar integration detected)

**Logs:**
- Hub: `hono/logger` middleware on every request (`hub/src/web/server.ts`); console output otherwise
- CLI: Custom file + console logger (`cli/src/ui/logger.ts`); rotates under `~/.hapi/logs/`
- No structured logging framework (winston/pino) in use

**Metrics:**
- Not detected

## CI/CD & Deployment

**Hosting:**
- CLI distributed via npm (`@twsxtd/hapi`) with platform optional deps and via Homebrew
- Web PWA served from hub's embedded assets (single-exe mode) OR from `https://app.hapi.run` (GitHub Pages, relay mode)
- Hub runs locally on user machine; not deployed centrally

**CI Pipeline (`.github/workflows/`):**
- `test.yml` - Test runs
- `release.yml` - Release pipeline (npm publish + asset upload)
- `webapp.yml` - Web app build/deploy (GitHub Pages)
- `codex-pr-review.yml` - Automated PR review by Codex agent on `pull_request_target`
- `codex-mention-response.yml` - Bot responds when `@tiann` mentioned in issue/PR comments
- `issue-auto-response.yml` - Auto-triage new issues
- Release helper script: `cli/scripts/release-all.ts`; Homebrew formula updater: `cli/scripts/update-homebrew-formula.ts`

## Environment Configuration

**Required env vars (hub, all auto-default if absent):**
- None strictly required; `CLI_API_TOKEN` is auto-generated on first run

**Optional/runtime env vars:**
- `CLI_API_TOKEN`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_NOTIFICATION`, `SERVERCHAN_SENDKEY`, `SERVERCHAN_NOTIFICATION`
- `HAPI_LISTEN_HOST`, `HAPI_LISTEN_PORT`, `HAPI_PUBLIC_URL`, `CORS_ORIGINS`
- `HAPI_HOME`, `DB_PATH`
- `HAPI_RELAY_API`, `HAPI_RELAY_AUTH`, `HAPI_RELAY_FORCE_TCP`
- `VAPID_SUBJECT`, `HAPI_OFFICIAL_WEB_URL`
- CLI: `DEV`, `HAPI_HTTP_MCP_URL`
- Web build: `VITE_BASE_URL`, `VITE_HUB_PROXY`

**Secrets location:**
- `~/.hapi/settings.json` (mode-protected dir `0700`) holds CLI token, VAPID keys, owner UUID
- `~/.hapi/jwt-secret.json` (mode `0600`) holds JWT signing secret
- `.env` files gitignored (CLI dev: `cli/.env.dev-local-server`, `cli/.env.integration-test`)
- No external secret manager (Vault/SSM/etc.) integration

## Webhooks & Callbacks

**Incoming:**
- Telegram bot updates - long-polling via grammy (`hub/src/telegram/bot.ts`); no webhook URL configured
- Claude Code hooks - forwarded by `cli/src/commands/hookForwarder.ts` (CLI subcommand that Claude invokes)
- MCP STDIO bridge - exposes a single `change_title` tool to agents (`cli/src/codex/happyMcpStdioBridge.ts`); proxies to hub's HTTP MCP server

**Outgoing:**
- Web Push notifications - VAPID-signed payloads to user-agent push services (`hub/src/push/pushService.ts`, `hub/src/push/pushNotificationChannel.ts`)
- ServerChan push - HTTPS POST per ready/end event (`hub/src/serverchan/channel.ts`)
- Telegram message sends - via grammy Bot API
- ElevenLabs API calls (token mint + agent CRUD) - from `hub/src/web/routes/voice.ts`

## Realtime Transports

**CLI ↔ Hub:**
- Socket.IO (websocket primary, polling fallback) via `@socket.io/bun-engine` on hub, `socket.io-client` on CLI
- Mounted at `/socket.io/` (`hub/src/web/server.ts`)

**Hub → Web:**
- Server-Sent Events at `/api/events` (`hub/src/sse/sseManager.ts`, `hub/src/web/routes/events.ts`, consumed by `web/src/hooks/useSSE.ts`)
- 30-second heartbeat; visibility-aware via `hub/src/visibility/visibilityTracker.ts`

**Web ↔ Hub (terminal):**
- Socket.IO websocket for live terminal streaming (`web/src/hooks/useTerminalSocket.ts`, `hub/src/socket/terminalRegistry.ts`)

## Git Integration

- Read-only git status/diff exposed through hub `/api/sessions/:id/git-*` routes (`hub/src/web/routes/git.ts`)
- Backed by RPC from hub to CLI's `cli/src/modules/common/handlers/` (which shells out to local `git`)
- Worktree management for runner-spawned sessions: `cli/src/runner/worktree.ts`

---

*Integration audit: 2026-05-20*
