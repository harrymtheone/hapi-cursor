# Codebase Structure

**Analysis Date:** 2026-05-20

## Directory Layout

```
hapi-cursor/
├── cli/                       # CLI binary that wraps coding agents
│   ├── bin/                   # Published bin shim
│   ├── npm/                   # Per-platform npm distributions
│   ├── scripts/               # Build scripts (exe packaging)
│   ├── src/                   # CLI TypeScript sources
│   ├── tools/                 # Vendored helper binaries (ripgrep etc.)
│   ├── local-client-launcher.ts  # All-in-one binary entry shim
│   ├── package.json
│   ├── tsconfig.json
│   └── vitest.config.ts
├── hub/                       # Local server: HTTP, Socket.IO, SSE, Telegram
│   ├── scripts/               # Asset/tunnel download + cleanup
│   ├── src/                   # Hub TypeScript sources
│   ├── tools/                 # Embedded asset generator
│   ├── package.json
│   └── tsconfig.json
├── web/                       # React 19 PWA (Vite + TanStack)
│   ├── public/                # Static PWA assets (icons, manifest)
│   ├── src/                   # Web TypeScript sources
│   ├── index.html             # Vite entry HTML
│   ├── package.json
│   ├── tsconfig.json
│   ├── tailwind.config.ts
│   ├── postcss.config.cjs
│   ├── vite.config.ts
│   └── vitest.config.ts
├── shared/                    # Cross-package protocol (`@hapi/protocol`)
│   ├── src/                   # Types, schemas, socket event names
│   ├── package.json
│   └── tsconfig.json
├── docs/                      # VitePress user docs site
├── website/                   # Marketing site (Vite)
├── scripts/                   # Repo-wide dev scripts
├── .github/                   # CI workflows
├── .planning/                 # GSD planning artifacts (this folder)
├── AGENTS.md                  # Agent-facing repo guide
├── CONTRIBUTING.md
├── README.md
├── SECURITY.md
├── LICENSE
├── refactor.md
├── bun.lock                   # Single workspace lockfile
├── package.json               # Bun workspace root
└── tsconfig.base.json         # Shared TS config (strict, @/* alias)
```

## Directory Purposes

**`cli/`:**
- Purpose: CLI that wraps Claude/Codex/Cursor/Gemini/OpenCode, connects to the hub.
- Contains: TypeScript sources, exe build scripts, vendored tool binaries.
- Key files: `cli/src/index.ts`, `cli/src/commands/registry.ts`, `cli/package.json`.

**`cli/src/api/`:**
- Purpose: Socket.IO + REST client to the hub; versioned updates and RPC.
- Contains: `api.ts`, `apiSession.ts`, `apiMachine.ts`, `auth.ts`, `versionedUpdate.ts`, `rpc/`.

**`cli/src/{claude,codex,cursor,gemini,opencode}/`:**
- Purpose: Per-agent integration. Each has `runX.ts` (subcommand entry), `loop.ts` (event pump), `session.ts` (state), and `xxxLocal.ts` / `xxxRemote.ts` launchers.

**`cli/src/agent/`:**
- Purpose: Cross-agent abstractions (ACP backend, session factory, runner lifecycle, message converter, permission adapter).
- Key files: `AgentRegistry.ts`, `sessionBase.ts`, `loopBase.ts`, `backends/acp/`.

**`cli/src/commands/`:**
- Purpose: One file per CLI subcommand (`auth`, `codex`, `cursor`, `doctor`, `gemini`, `hub`, `mcp`, `notify`, `opencode`, `resume`, `runner`).
- Key file: `registry.ts` (subcommand map + default to claude).

**`cli/src/modules/common/`:**
- Purpose: Shared tool handlers and base classes used by every flavor.
- Contains: `handlers/` (bash, git, ripgrep, files, slash commands, skills, uploads), `launcher/BaseLocalLauncher.ts`, `remote/RemoteLauncherBase.ts`, `permission/BasePermissionHandler.ts`, `session/BaseSessionScanner.ts`, `hooks/generateHookSettings.ts`.

**`cli/src/modules/{difftastic,ripgrep,watcher}/`:**
- Purpose: Wrappers around vendored binaries / fs watcher.

**`cli/src/runner/`:**
- Purpose: Background daemon process. Owns sessions across CLI restarts; exposes local HTTP control.
- Key files: `run.ts`, `controlServer.ts`, `controlClient.ts`, `worktree.ts`, `runnerIdentity.ts`.

**`cli/src/ui/`:**
- Purpose: Terminal UI (Ink-based) + diagnostics.
- Key files: `ink/`, `doctor.ts`, `logger.ts`, `messageFormatterInk.ts`, `terminalState.ts`.

**`cli/src/terminal/`:**
- Purpose: PTY management for remote terminal feature (`TerminalManager.ts`).

**`cli/src/runtime/`, `cli/src/parsers/`, `cli/src/utils/`, `cli/src/constants/`, `cli/src/types/`:**
- Purpose: Embedded asset access, special-command parsing, generic helpers (process spawn, async iterables, locks), constants, ambient types.

**`hub/`:**
- Purpose: Local hub server (HTTP, Socket.IO, SSE, optional Telegram + tunnel).
- Key files: `hub/src/index.ts`, `hub/src/configuration.ts`, `hub/package.json`.

**`hub/src/web/`:**
- Purpose: Hono HTTP app, route modules, auth middleware, embedded asset serving.
- Contains: `server.ts` (entry), `routes/` (one file per resource), `middleware/auth.ts`, `embeddedAssets.ts`, `telegramInitData.ts`.

**`hub/src/socket/`:**
- Purpose: Socket.IO server + namespaces.
- Contains: `server.ts` (entry), `handlers/cli/` (per-domain handlers: session, machine, terminal, rpc), `handlers/terminal.ts`, `rpcRegistry.ts`, `terminalRegistry.ts`, `socketTypes.ts`.

**`hub/src/sync/`:**
- Purpose: Stateful core (session/machine/message/rpc caches + event publishing).
- Key files: `syncEngine.ts` (façade), `sessionCache.ts`, `machineCache.ts`, `messageService.ts`, `rpcGateway.ts`, `eventPublisher.ts`, `backgroundTasks.ts`, `todos.ts`, `teams.ts`.

**`hub/src/store/`:**
- Purpose: SQLite persistence via better-sqlite3.
- Key files: `index.ts` (Store facade), `sessionStore.ts`, `messageStore.ts`, `machineStore.ts`, `userStore.ts`, `pushStore.ts`, `versionedUpdates.ts`, schema migrations (`migration-vN.test.ts`).

**`hub/src/sse/`:**
- Purpose: Server-Sent Events manager (`sseManager.ts`).

**`hub/src/notifications/`, `hub/src/push/`, `hub/src/serverchan/`, `hub/src/telegram/`:**
- Purpose: Pluggable notification channels.
- Files: `notifications/notificationHub.ts`, `push/pushService.ts`, `push/pushNotificationChannel.ts`, `serverchan/channel.ts`, `telegram/bot.ts`, `telegram/callbacks.ts`, `telegram/renderer.ts`.

**`hub/src/config/`:**
- Purpose: Secret/setting persistence (CLI API token, JWT secret, VAPID keys, owner id, server settings).

**`hub/src/tunnel/`:**
- Purpose: Optional WireGuard/TLS relay tunnel (`tunnelManager.ts`, `tlsGate.ts`).

**`hub/src/visibility/`, `hub/src/utils/`, `hub/src/types/`:**
- Purpose: Client visibility tracking, access-token + crypto helpers, ambient types.

**`web/src/`:**
- Purpose: React PWA source.
- Key files: `main.tsx` (entry), `App.tsx` (shell), `router.tsx` (TanStack Router tree), `index.css`, `sw.ts` (service worker).

**`web/src/routes/`:**
- Purpose: Page-level route components.
- Contains: `sessions/file.tsx`, `sessions/files.tsx`, `sessions/terminal.tsx`, `settings/`.

**`web/src/components/`:**
- Purpose: Reusable UI components.
- Notable: `SessionChat.tsx`, `SessionList.tsx`, `NewSession/`, `AssistantChat/` (composer + thread), `ToolCard/`, `Terminal/`, `SessionFiles/`, `DiffView.tsx`, `CodeBlock.tsx`, `LoginPrompt.tsx`, `WorkspaceBrowser.tsx`, `assistant-ui/`, `ui/`.

**`web/src/hooks/`:**
- Purpose: React hooks (queries, mutations, platform, theme, sse, etc.).
- Subdirs: `queries/` (TanStack Query fetchers), `mutations/` (TanStack mutations).
- Notable: `useSSE.ts`, `useAuth.ts`, `useAuthSource.ts`, `useTerminalSocket.ts`, `useTheme.ts`, `usePushNotifications.ts`.

**`web/src/chat/`:**
- Purpose: Chat reducer + normalizers (turn agent stream events into displayable timeline).
- Notable: `reducer.ts`, `reducerEvents.ts`, `reducerTimeline.ts`, `reducerTools.ts`, `normalize.ts`, `outline.ts`, `presentation.ts`.

**`web/src/realtime/`:**
- Purpose: ElevenLabs voice session + realtime client tools.
- Notable: `RealtimeSession.ts`, `RealtimeVoiceSession.tsx`, `voiceConfig.ts`, `hooks/`.

**`web/src/api/`, `web/src/lib/`, `web/src/utils/`, `web/src/types/`, `web/src/test/`:**
- Purpose: API client (`api/client.ts`, `api/voice.ts`), app context + query client + i18n + helpers, generic utils, shared types, test setup.

**`shared/src/`:**
- Purpose: Source-of-truth protocol types and schemas.
- Files: `types.ts`, `schemas.ts`, `socket.ts`, `messages.ts`, `flavors.ts`, `models.ts`, `modes.ts`, `resume.ts`, `sessionSummary.ts`, `utils.ts`, `version.ts`, `voice.ts`, `index.ts`.

**`docs/`:**
- Purpose: VitePress documentation site, embedded into the website build at deploy time.

**`website/`:**
- Purpose: Marketing site (separate Vite project).

**`scripts/dev/`:**
- Purpose: Local dev helper scripts.

**`.planning/`:**
- Purpose: GSD planning workspace.
- Generated: Partially (codebase/ maps regenerated by `/gsd-map-codebase`).
- Committed: Yes.

## Key File Locations

**Entry Points:**
- `cli/src/index.ts` — CLI bin entry; `void runCli()`.
- `cli/src/commands/runCli.ts` — Argv parsing + subcommand dispatch.
- `cli/local-client-launcher.ts` — All-in-one binary launcher.
- `hub/src/index.ts` — Hub process entry; wires every subsystem.
- `web/src/main.tsx` — React root + service worker registration.
- `web/index.html` — Vite HTML host.
- `docs/.vitepress/` — Docs site.

**Configuration:**
- `package.json` — Workspace + scripts.
- `tsconfig.base.json` — Strict TS + path alias `@/*`.
- `cli/tsconfig.json`, `hub/tsconfig.json`, `web/tsconfig.json`, `shared/tsconfig.json` — Per-package configs.
- `web/vite.config.ts`, `web/tailwind.config.ts`, `web/postcss.config.cjs`, `web/vitest.config.ts` — Web build/test.
- `cli/vitest.config.ts`, `cli/bunfig.toml` — CLI build/test.
- `hub/src/configuration.ts` — Hub runtime config loader.
- `cli/src/configuration.ts` — CLI runtime config loader.

**Core Logic:**
- `hub/src/sync/syncEngine.ts` — Stateful core for sessions/messages/RPC.
- `hub/src/sync/sessionCache.ts`, `hub/src/sync/messageService.ts`, `hub/src/sync/rpcGateway.ts` — Sub-components of SyncEngine.
- `hub/src/store/index.ts` — Persistence facade.
- `hub/src/web/server.ts` — HTTP app composition.
- `hub/src/socket/server.ts` — Socket.IO namespaces + auth.
- `cli/src/api/apiSession.ts`, `cli/src/api/apiMachine.ts` — CLI↔hub session/machine clients.
- `cli/src/agent/sessionBase.ts`, `cli/src/agent/loopBase.ts` — Cross-agent base classes.
- `web/src/router.tsx` — Web route tree.
- `web/src/chat/reducer.ts` — Chat timeline state machine.

**Testing:**
- Vitest configs: `cli/vitest.config.ts`, `hub` runs via root `bun run test:hub` (Bun's vitest), `web/vitest.config.ts`.
- Test fixtures: `cli/src/agent/backends/acp/__fixtures__/`, ad-hoc within `__tests__/` folders (e.g. `cli/src/codex/__tests__/`).

## Naming Conventions

**Files:**
- TypeScript modules: `camelCase.ts` (e.g. `sessionCache.ts`, `runCli.ts`).
- React components: `PascalCase.tsx` (e.g. `SessionChat.tsx`, `WorkspaceBrowser.tsx`).
- Tests: co-located `*.test.ts` / `*.test.tsx` next to the file under test.
- Integration tests: `*.integration.test.ts` (e.g. `cli/src/runner/runner.integration.test.ts`).
- Per-flavor entry: `run<Flavor>.ts` (`runClaude.ts`, `runCodex.ts`, `runCursor.ts`, `runGemini.ts`, `runOpencode.ts`).
- Per-flavor pieces: `<flavor>Local.ts`, `<flavor>LocalLauncher.ts`, `<flavor>RemoteLauncher.ts`, plus `loop.ts` and `session.ts`.

**Directories:**
- All lowercase: `cli/src/api`, `hub/src/sync`, `web/src/hooks`.
- Plural for collections of similar items: `routes/`, `handlers/`, `components/`, `hooks/queries/`, `hooks/mutations/`.
- Domain-grouped React components get a PascalCase folder: `web/src/components/NewSession/`, `web/src/components/AssistantChat/`, `web/src/components/ToolCard/`, `web/src/components/SessionFiles/`, `web/src/components/Terminal/`.

**Hooks:** `useXxx.ts` (e.g. `useSSE.ts`, `useAuth.ts`, `useSendMessage.ts`).

**Routes:** Files in `hub/src/web/routes/` are named after the resource (`sessions.ts`, `messages.ts`, `permissions.ts`, `machines.ts`, `git.ts`, `cli.ts`, `events.ts`, `voice.ts`, `auth.ts`, `bind.ts`, `push.ts`). Each exports a `createXxxRoutes(...)` factory.

**Store sub-stores:** `xxxStore.ts` + companion `xxx.ts` (e.g. `sessionStore.ts` + `sessions.ts`) — Store class plus row types/helpers.

## Where to Add New Code

**New CLI subcommand:**
- Primary code: `cli/src/commands/<name>.ts` (export `CommandDefinition`).
- Register: add to `COMMANDS` in `cli/src/commands/registry.ts`.
- Tests: `cli/src/commands/<name>.test.ts`.
- README: update `cli/README.md` commands section.

**New agent flavor:**
- Primary code: `cli/src/<flavor>/{run<Flavor>.ts,loop.ts,session.ts,<flavor>Local.ts,<flavor>LocalLauncher.ts,<flavor>RemoteLauncher.ts}`.
- Shared base: extend bases in `cli/src/agent/` and reuse handlers from `cli/src/modules/common/`.
- Flavor enum: extend `shared/src/flavors.ts`.

**New CLI RPC handler (e.g. new tool):**
- Implementation: `cli/src/modules/common/handlers/<name>.ts`.
- Register: add to `cli/src/modules/common/registerCommonHandlers.ts`.
- Hub-side type: add to `hub/src/sync/rpcGateway.ts` (request/response types) and expose via a route in `hub/src/web/routes/`.

**New REST endpoint:**
- Implementation: `hub/src/web/routes/<resource>.ts` exporting `createXxxRoutes(getSyncEngine)`.
- Register: `app.route('/api', createXxxRoutes(...))` in `hub/src/web/server.ts::createWebApp`.
- Tests: `hub/src/web/routes/<resource>.test.ts`.

**New Socket.IO event:**
- Type names: `shared/src/socket.ts`.
- Hub handler: `hub/src/socket/handlers/cli/<domain>Handlers.ts` (or new file, then register in `cli/index.ts`).
- CLI emitter: `cli/src/api/apiSession.ts` (or `apiMachine.ts`).

**New web route:**
- Page component: `web/src/routes/<area>/<name>.tsx` or `web/src/components/<PageName>.tsx`.
- Wire route: add `createRoute({ getParentRoute, path, component })` in `web/src/router.tsx`, then add to `routeTree`.

**New web component:**
- Reusable: `web/src/components/<Name>.tsx` (or a `web/src/components/<Group>/` folder for composite UI).
- Tests: co-located `<Name>.test.tsx`.

**New data hook:**
- Query: `web/src/hooks/queries/use<Name>.ts` using `useQuery` + `queryKeys`.
- Mutation: `web/src/hooks/mutations/use<Name>.ts`.

**New notification channel:**
- Implementation: `hub/src/<channel>/channel.ts` implementing `NotificationChannel` (`hub/src/notifications/notificationTypes.ts`).
- Wire: push into `notificationChannels` array in `hub/src/index.ts`.

**New shared type:**
- Add to `shared/src/types.ts` and (if validated) `shared/src/schemas.ts`; re-export from `shared/src/index.ts`.

**New SQLite table / migration:**
- Migration: `hub/src/store/migration-vN.ts` + `migration-vN.test.ts`.
- Sub-store: `hub/src/store/<name>Store.ts` + row types in `<name>.ts`; surface via `hub/src/store/index.ts`.

**New utility:**
- CLI: `cli/src/utils/<name>.ts`.
- Hub: `hub/src/utils/<name>.ts`.
- Web: `web/src/utils/<name>.ts` or `web/src/lib/<name>.ts` (lib for app-context-aware helpers).

## Special Directories

**`cli/tools/`:**
- Purpose: Vendored helper binaries (ripgrep, difftastic) bundled into the single exe.
- Generated: No (vendored).
- Committed: Yes.

**`cli/npm/`:**
- Purpose: Per-platform npm publish artifacts (one subdir per OS/arch).
- Generated: Partially (release pipeline).
- Committed: Yes.

**`hub/src/web/embeddedAssets.generated.d.ts`:**
- Purpose: Generated type for the embedded web asset map used by the single-exe build.
- Generated: Yes (`bun run generate:embedded-web-assets`).
- Committed: Yes.

**`web/public/`:**
- Purpose: Static PWA assets served as-is by Vite (icons, manifest).
- Generated: No.
- Committed: Yes.

**`web/dist/` (and `cli/dist/`, `hub/dist/`):**
- Purpose: Build outputs.
- Generated: Yes.
- Committed: No (gitignored).

**`node_modules/`:**
- Purpose: Bun-managed dependencies.
- Generated: Yes.
- Committed: No.

**`.planning/`:**
- Purpose: GSD planning artifacts including this codebase map.
- Generated: Partially.
- Committed: Yes.

**`docs/.vitepress/dist/`:**
- Purpose: Built docs site, copied into `website/dist/public/docs` by `build:site`.
- Generated: Yes.
- Committed: No.

---

*Structure analysis: 2026-05-20*
