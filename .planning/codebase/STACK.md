# Technology Stack

**Analysis Date:** 2026-05-20

## Languages

**Primary:**
- TypeScript ^5 (strict) - All workspace packages (`cli/`, `hub/`, `web/`, `shared/`, `website/`, `docs/`)
- TSX/React 19 - Web PWA (`web/src/`) and terminal UI components (`cli/src/ui/ink/`)

**Secondary:**
- Shell scripts (Bun-runnable `.ts`) - Build/release tooling (`cli/scripts/`, `hub/scripts/`, repo `scripts/`)
- YAML - GitHub Actions workflows (`.github/workflows/`)

## Runtime

**Environment:**
- Bun 1.3.14 (`packageManager` in `cli/package.json`, runtime target for hub and CLI)
- Node.js types ">=25" (`@types/node` declared in cli/hub devDependencies; Bun-native APIs used heavily)
- Browser (Chromium/Safari/Firefox) for `web/` PWA, also runs as Telegram Mini App

**Package Manager:**
- Bun (workspaces declared in root `package.json`: `cli`, `shared`, `hub`, `web`, `website`, `docs`)
- Lockfile: `bun.lock` (present, ~540 KB)
- `@hapi/protocol` workspace package (`shared/`) consumed via `workspace:*` by cli/hub/web

## Frameworks

**Core (Hub - `hub/`):**
- Hono ^4.11.2 - HTTP server (`hub/src/web/server.ts`)
- Socket.IO ^4.8.3 + `@socket.io/bun-engine` ^0.1.0 - CLI ↔ Hub realtime (`hub/src/socket/server.ts`)
- `bun:sqlite` (built-in) - Persistence (`hub/src/store/index.ts`)
- grammy ^1.38.4 - Telegram Bot framework (`hub/src/telegram/bot.ts`)
- jose ^6.1.3 - JWT signing/verification (`hub/src/web/middleware/auth.ts`)
- web-push ^3.6.7 - VAPID Web Push (`hub/src/push/pushService.ts`)
- qrcode ^1.5.4 - Terminal QR code for tunnel URL (`hub/src/index.ts`)
- Zod ^4.2.1 - Runtime validation (all `hub/src/**/*.ts` schemas)

**Core (CLI - `cli/`):**
- Ink ^6.6.0 + React ^19.2.3 - Terminal UI (`cli/src/ui/ink/`)
- Fastify ^5.6.2 + `fastify-type-provider-zod` 6.1.0 - Local runner HTTP control server (`cli/src/runner/controlServer.ts`)
- socket.io-client ^4.8.3 - Hub connection (`cli/src/api/apiSession.ts`)
- axios ^1.13.2 - REST calls to hub (`cli/src/api/api.ts`)
- `@modelcontextprotocol/sdk` ^1.25.1 - MCP server/client (`cli/src/codex/happyMcpStdioBridge.ts`)
- cross-spawn ^7.0.6 - Cross-platform process spawning (`cli/src/utils/spawnHappyCLI.ts`)
- ps-list ^9.0.0 - Process listing (runner diagnostics)
- chalk ^5.6.2 - Terminal coloring
- yaml ^2.8.2 - Slash-command frontmatter parsing (`cli/src/modules/common/slashCommands.ts`)
- tar ^7.5.2 - Runtime asset extraction
- Zod ^4.2.1 - Runtime validation

**Core (Web - `web/`):**
- React ^19.2.3 + React DOM ^19.2.3
- `@tanstack/react-router` ^1.143.6 - Routing (`web/src/router.tsx`)
- `@tanstack/react-query` ^5.90.12 + devtools - Server state (`web/src/hooks/queries/`, `web/src/hooks/mutations/`)
- `@assistant-ui/react` ^0.11.53 + `@assistant-ui/react-markdown` ^0.11.9 - Chat surface (`web/src/components/AssistantChat/`, `web/src/chat/`)
- `@radix-ui/react-dialog` ^1.1.15, `@radix-ui/react-slot` ^1.2.4 - Headless UI primitives
- `@xterm/xterm` ^6.0.0 + addons (`canvas`, `fit`, `web-links`) - Terminal viewer (`web/src/components/Terminal/`)
- `@elevenlabs/react` ^0.13.0 - Voice assistant client (`web/src/realtime/`)
- shiki ^3.20.0 + `@shikijs/langs` / `@shikijs/themes` - Code highlighting
- mermaid ^11.12.0 - Diagram rendering in chat
- katex ^0.16.45 + rehype-katex + remark-math + remark-gfm - Markdown math/GFM
- socket.io-client ^4.8.3 - SSE fallback / terminal websockets (`web/src/hooks/useTerminalSocket.ts`)
- diff ^8.0.2 - Diff rendering (`web/src/components/DiffView.tsx`)
- class-variance-authority ^0.7.1 + clsx ^2.1.1 + tailwind-merge ^3.4.0 - Styling utilities
- `@lobehub/icons` ^5.4.0 - Provider/model icons

**Build/Bundle:**
- Vite ^7.3.0 + `@vitejs/plugin-react` ^5.1.2 - Web build (`web/vite.config.ts`)
- Tailwind CSS ^4.1.18 + `@tailwindcss/postcss` ^4.1.18 + autoprefixer + postcss - Styling pipeline
- `vite-plugin-pwa` ^1.2.0 (workbox-* ^7.4.0) - Service worker + manifest (custom `web/src/sw.ts`, `injectManifest` strategy)
- `bun build --target bun` - Hub bundling (`hub/package.json` `build`)
- `bun build --compile` (via `cli/scripts/build-executable.ts`) - Single-file CLI executables across `bun-darwin-x64`, `bun-darwin-arm64`, `bun-linux-x64-baseline`, `bun-linux-arm64`, `bun-windows-x64`
- VitePress ^1.6.4 - Docs site (`docs/`)

**Testing:**
- Vitest ^4.0.16 - CLI/hub/web test runner (`*.test.ts` colocated with sources)
- `bun test` - Hub test command (uses Bun's built-in runner; see `hub/package.json` `"test": "bun test"`)
- `@testing-library/react` ^16.3.0 + `@testing-library/jest-dom` ^6.6.3 + jsdom ^26.1.0 - Web component tests
- Playwright 1.49.1 (root devDependency) - E2E (currently no test files committed)

## Key Dependencies

**Critical:**
- `@hapi/protocol` (workspace) - Shared Zod schemas, types, Socket.IO event contracts (`shared/src/socket.ts`, `shared/src/schemas.ts`, `shared/src/types.ts`)
- `zod` ^4.2.1 - Single validation library across all packages (declared in cli, hub, web, shared)
- `bun:sqlite` (built-in) - Persistence; `better-sqlite3` is **not** used despite AGENTS.md mention
- Socket.IO suite - CLI ↔ Hub transport
- Hono - Hub HTTP framework
- React 19 - Web + CLI Ink UI

**Infrastructure:**
- `tunwg` (external Go binary, downloaded at build time via `hub/scripts/download-tunwg.ts` into `hub/tools/tunwg/`) - WireGuard+TLS relay tunnel client; spawned by `hub/src/tunnel/tunnelManager.ts`
- `ripgrep` (`rg`) - Bundled binary in `cli/src/modules/ripgrep/`, called by `cli/src/modules/ripgrep/index.ts` (path: `runtime/tools/unpacked/rg`)
- `difftastic` (`difft`) - Bundled binary in `cli/src/modules/difftastic/`
- React DevTools Core ^7.0.1 (devDependency) - Ink debugging
- concurrently ^9.2.1 - Runs `dev:hub` + `dev:web` together

**Optional native binaries (CLI):**
- `@twsxtd/hapi-darwin-arm64`, `@twsxtd/hapi-darwin-x64`, `@twsxtd/hapi-linux-arm64`, `@twsxtd/hapi-linux-x64`, `@twsxtd/hapi-win32-x64` at version 0.18.1 - Platform-specific prebuilt single-exe shipped via npm `optionalDependencies` (see `cli/scripts/prepare-npm-packages.ts`)

## Configuration

**TypeScript:**
- Root: `tsconfig.base.json` - ESNext target/module, `moduleResolution: "bundler"`, strict, ES2022 lib
- Per-package: `cli/tsconfig.json`, `hub/tsconfig.json`, `web/tsconfig.json`, `shared/tsconfig.json` - extend base
- Path alias `@/*` → `./src/*` per package (Vite alias in `web/vite.config.ts`; Bun resolves natively for hub/cli)

**Environment:**
- Hub config: `hub/src/configuration.ts` (env > `~/.hapi/settings.json` > defaults; auto-persists)
  - `HAPI_HOME` (default `~/.hapi`), `DB_PATH` (default `{HAPI_HOME}/hapi.db`)
  - `HAPI_LISTEN_HOST` (default `127.0.0.1`), `HAPI_LISTEN_PORT` (default `3006`), `HAPI_PUBLIC_URL`
  - `CORS_ORIGINS` (comma-separated; supports `*`)
  - `CLI_API_TOKEN` (auto-generated 32-byte token; persisted to `settings.json`)
  - `TELEGRAM_BOT_TOKEN`, `TELEGRAM_NOTIFICATION` (default true)
  - `SERVERCHAN_SENDKEY`, `SERVERCHAN_NOTIFICATION` (default true) - Server酱 push
  - `HAPI_RELAY_API` (default `relay.hapi.run`), `HAPI_RELAY_AUTH`, `HAPI_RELAY_FORCE_TCP`
  - `VAPID_SUBJECT` (default `mailto:admin@hapi.run`)
  - `HAPI_OFFICIAL_WEB_URL` (default `https://app.hapi.run`)
- Hub generated secrets stored under `{HAPI_HOME}/`:
  - `jwt-secret.json` (32 random bytes, `0600`) - `hub/src/config/jwtSecret.ts`
  - VAPID keys in `settings.json` - `hub/src/config/vapidKeys.ts`
  - Owner UUID in `settings.json` - `hub/src/config/ownerId.ts`
- Web build: `VITE_BASE_URL` (default `/`), `VITE_HUB_PROXY` (default `http://127.0.0.1:3006`)
- CLI dev env files (gitignored, present in `cli/` per scripts): `.env.dev-local-server`, `.env.integration-test`

**Linting/Formatting:**
- Not detected (no `.eslintrc*`, `.prettierrc*`, `biome.json`, or `eslint.config.*` in repo root or workspaces — except `website/` uses prettier)
- 4-space indentation per `AGENTS.md`

**Build:**
- Root `package.json`:
  - `bun run dev` - concurrently runs hub + web
  - `bun run build` - cli + hub + web sequentially
  - `bun run build:single-exe` - downloads tunwg → builds web → embeds web assets into hub → compiles single-exe via Bun
  - `bun run typecheck` - all three packages
  - `bun run test` - all three packages
- Web outputs `dist/`; hub embeds via `hub/scripts/generate-embedded-web-assets.ts` → `hub/src/web/embeddedAssets.generated.ts` (gitignored)

## Platform Requirements

**Development:**
- Bun 1.3.14+ installed globally (used as runtime, package manager, test runner, bundler)
- Linux x64/arm64, macOS x64/arm64, or Windows x64
- For relay/tunnel: outbound UDP (WireGuard) or TCP fallback to `relay.hapi.run`

**Production:**
- Distributed as Bun-compiled single executables via npm (`@twsxtd/hapi` + platform-suffixed optional deps) and Homebrew (formula updater: `cli/scripts/update-homebrew-formula.ts`)
- Local-first: runs on the user's developer machine; hub binds `127.0.0.1:3006` by default
- Web PWA hosted at `https://app.hapi.run` (GitHub Pages) when running in `--relay` mode; otherwise served from hub's embedded assets

---

*Stack analysis: 2026-05-20*
