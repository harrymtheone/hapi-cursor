# Codebase Concerns

**Analysis Date:** 2026-05-20

This document catalogs technical debt, fragile areas, security considerations, and performance bottlenecks observed in the HAPI monorepo (`cli/`, `hub/`, `web/`, `shared/`). Many findings cross-reference an existing repo-level refactor brief (`refactor.md`) which already enumerates priority refactors; entries below add file paths, impact, and fix approaches for the planner/executor.

## Tech Debt

### Backward-compat carry-over in CLI settings & DB
- Issue: Legacy field migration paths (`serverUrl` → `apiUrl`, `webapp*` → `publicUrl`), `hapi server` command alias, and runtime SQLite migrations kept "just in case" despite the project policy of "no backward compatibility".
- Files: `cli/src/ui/apiUrlInit.ts`, `cli/src/persistence.ts`, `cli/src/commands/registry.ts`, `hub/src/config/settings.ts`, `hub/src/config/serverSettings.ts`, `hub/src/store/index.ts`, `hub/src/store/migration-v8.test.ts`, `hub/src/store/migration-v9.test.ts`
- Impact: Confuses readers about the canonical config shape; widens config surface area; keeps dead migration code paths lit; ties the runtime to historical schema bugs.
- Fix approach: Drop legacy field reads + alias commands. Replace runtime DB migrations with "version mismatch ⇒ rebuild or refuse to start with offline migration tool". Track the canonical config in `shared/` and let `cli`/`hub` consume only those types.

### Mutable configuration singletons / Proxy
- Issue: Config objects expose `_setApiUrl()`, `_setCliApiToken()`, `_setExtraHeaders()` mutators after construction; an unfinished object is observable mid-init.
- Files: `cli/src/configuration.ts`, `cli/src/ui/apiUrlInit.ts`, `cli/src/ui/tokenInit.ts`, `cli/src/commands/auth.ts`, `hub/src/configuration.ts`, `hub/src/config/cliApiToken.ts`
- Impact: Order-sensitive startup; tests must remember to call setters in the right sequence; race risk if any consumer reads config before `_setCliApiToken` fires; poor DX for adding new fields.
- Fix approach: Replace with a single async `loadConfig()` that returns a frozen, fully-populated object; thread it via dependency injection rather than module-scoped getters.

### Cross-package DTO/Schema duplication
- Issue: HTTP, SSE, and RPC response types are redefined separately in each package; `Machine`, `RunnerState`, and Session response shapes diverge across `cli`, `hub`, and `web`.
- Files: `shared/src/schemas.ts`, `shared/src/types.ts`, `cli/src/api/types.ts`, `web/src/types/api.ts`, `hub/src/web/routes/sessions.ts`, `hub/src/web/routes/machines.ts`, `hub/src/sync/sessionCache.ts`
- Impact: Easy contract drift; bugs surface as runtime parse failures or silent data loss; refactors require touching N copies.
- Fix approach: Promote every wire-shape DTO and Zod schema to `shared/src/schemas.ts`. Have `hub` produce only shared types; `cli`/`web` consume only shared types. Delete in-package mirrors.

### Hub session core does too much
- Issue: `SessionCache` simultaneously handles hydration, schema parsing, todo backfill, keepalive, config persistence, dedup/merge/delete. `SyncEngine` then wraps it. `SSEManager` reverses the dependency by importing `syncEngine` types.
- Files: `hub/src/sync/sessionCache.ts` (796 lines), `hub/src/sync/syncEngine.ts` (854 lines), `hub/src/sync/messageService.ts`, `hub/src/sync/eventPublisher.ts`, `hub/src/sse/sseManager.ts`, `hub/src/sync/machineCache.ts`
- Impact: Hard to reason about correctness; one circular dependency group already detected (per `refactor.md`); changes anywhere risk regressions in dedup/merge.
- Fix approach: Decompose into `sessionRepository`, `sessionLivenessService`, `sessionConfigService`, `sessionMergeService`, `machineLivenessService`, `eventBus`. Add `hub/src/sync/types.ts` so SSE only depends on shared event types.

### Parallel agent runtimes (Claude / Codex / Cursor / OpenCode)
- Issue: Four near-identical sets of `loop.ts`, `session.ts`, `*LocalLauncher.ts`, `*RemoteLauncher.ts`. Three circular-dependency groups in `cli/` per `refactor.md`. `cli/src/codex/codexRemoteLauncher.ts` is 3,139 lines.
- Files: `cli/src/claude/`, `cli/src/codex/`, `cli/src/cursor/`, `cli/src/opencode/`, `cli/src/agent/sessionBase.ts`, `cli/src/agent/loopBase.ts`, `cli/src/agent/runners/runAgentSession.ts`
- Impact: Bug fixes must be reapplied four times; permission-mode mapping diverges; large files exceed reasonable review/edit size; circular imports complicate tree-shaking and tests.
- Fix approach: Extract shared `SessionContext`, `LocalAdapter`, `RemoteAdapter`, `ModeConfig`, `LaunchPolicy` kit. Move agent-mode types into a standalone `modes.ts` to break the `loop ↔ session ↔ launcher` cycle.

### Repetitive Hub route boilerplate
- Issue: Almost every route repeats `requireSyncEngine`, `requireSessionFromParam`, `await c.req.json().catch(() => null)`, generic `'Invalid body'`, and ad-hoc try/catch error mapping.
- Files: `hub/src/web/routes/sessions.ts`, `hub/src/web/routes/messages.ts`, `hub/src/web/routes/git.ts`, `hub/src/web/routes/machines.ts`, `hub/src/web/routes/permissions.ts`, `hub/src/web/routes/auth.ts`, `hub/src/web/routes/bind.ts`, `hub/src/web/routes/events.ts`, `hub/src/web/routes/guards.ts`
- Impact: Inconsistent error semantics; `sessions.ts` already oversized; new endpoints copy the boilerplate and diverge.
- Fix approach: Add `parseJsonBody(schema)`, `withEngine`, `withSession`, `withActiveSession`, `withMachine`, and a common `ApiRouteError`. Split `sessions.ts` into lifecycle / config / upload / read-only files.

### Heuristic web SSE patching
- Issue: `useSSE` mixes connection management, query patching, and the `hasUnknownSessionPatchKeys()` heuristic that decides whether to refetch.
- Files: `web/src/hooks/useSSE.ts` (lines 108, 532-536), `shared/src/sessionSummary.ts`, `hub/src/sync/sessionCache.ts`, `web/src/lib/message-window-store.ts` (1,087 lines)
- Impact: Front-end guesses about server contract; missed fields cause silent stale UI; second message store adds duplication on top of TanStack Query.
- Fix approach: Pick a single contract — either always emit full `SessionSummary`/`MachineSummary`, or define a strict patch schema in `shared/`. Delete the heuristic. Restrict `message-window-store` to chat-window pagination only.

## Known Bugs

### Runner survives stale ghost via PID-only liveness
- Symptoms: After `npm uninstall hapi`, the runner attempts to spawn a new runner on version mismatch but the entrypoint binary is gone; the existing TODOs flag both untested cases.
- Files: `cli/src/runner/controlClient.ts:140` (`checkIfRunnerRunningAndCleanupStaleState`), `cli/src/runner/runner.integration.test.ts:469-473`
- Trigger: Uninstall `hapi` while a runner daemon is alive, or corrupt the runner state file.
- Workaround: Manually `kill` the runner PID and remove the runner state file before reinstall.
- Fix approach: Return a state object (not boolean) from the liveness check; verify the entrypoint binary exists before re-spawn; add the missing integration tests.

### Silent agent-mode fallback in Claude wrapper
- Symptoms: Unknown/unsupported permission mode silently switches without error.
- Files: `cli/src/claude/runClaude.ts:51` (TODO: "Eventually we should error here instead of silently switching")
- Trigger: User passes an unrecognized permission mode through CLI args or remote RPC.
- Workaround: None; behavior is silent.
- Fix approach: Throw on unknown modes once shared mode definitions land in `shared/src/modes.ts`.

### Empty catch blocks swallow errors
- Symptoms: Errors disappear with no log/telemetry on a few code paths.
- Files: `cli/src/persistence.ts` (3 sites), `cli/src/codex/codexRemoteLauncher.ts` (1 site)
- Trigger: I/O failures during persistence or remote launcher fallback.
- Workaround: None at runtime.
- Fix approach: Replace silent catches with at-least `logger.debug(err)` or rethrow when the path is non-recoverable.

## Security Considerations

### CLI API token = bearer for entire hub
- Risk: A single `cliApiToken` (parsed via `parseAccessToken`) plus a 4-hour JWT grants full web/hub access; namespace isolation is enforced by string suffix on the token only.
- Files: `hub/src/web/routes/auth.ts:38-47`, `hub/src/utils/accessToken.ts`, `hub/src/config/cliApiToken.ts`, `hub/src/web/middleware/auth.ts`
- Current mitigation: Constant-time compare (`constantTimeEquals`); JWT signed with HS256; 4h expiry.
- Recommendations: Document threat model; add token rotation API; consider per-namespace tokens with revocation; rate-limit `/auth` to deter brute-force on short tokens; surface a warning when token is configured via env vs file.

### `DANGEROUSLY_LOG_TO_SERVER_FOR_AI_AUTO_DEBUGGING`
- Risk: When enabled, CLI streams unencrypted logs (potentially containing prompts, code, paths) to `HAPI_API_URL`.
- Files: `cli/src/ui/logger.ts:48-56`, `cli/src/ui/doctor.ts:31,120`
- Current mitigation: Off by default; doctor command surfaces status with yellow `ENABLED` warning.
- Recommendations: Add an explicit one-time consent prompt the first time the flag is honoured; redact secrets/tokens client-side before transmit; document retention on receiving server.

### Bypass-permission flags
- Risk: `--dangerously-skip-permissions` (Claude) and `--dangerously-bypass-approvals-and-sandbox` / `--yolo` (Codex) disable agent guard rails entirely.
- Files: `cli/src/commands/claude.ts:49-52,108`, `cli/src/commands/codex.ts:63`, `cli/src/codex/utils/codexCliOverrides.ts:43,107`
- Current mitigation: Names are explicit; only honoured when no other permission mode set.
- Recommendations: Log a prominent banner whenever bypass mode is active; surface state through the hub so remote operators see it; consider an env-level kill switch for shared/team installs.

### Voice route uses caller-provided ElevenLabs API key
- Risk: `/voice/token` accepts `customApiKey` from the JSON body and forwards to ElevenLabs; cached agent IDs are keyed by API-key hash in process memory.
- Files: `hub/src/web/routes/voice.ts:10-16,26-40`
- Current mitigation: API key never persisted to disk; only forwarded.
- Recommendations: Validate body size, rate-limit, redact API key from any logs/error paths, and confirm the cache key hash is collision-resistant (SHA-256 not truncated).

### No rate limiting on hub endpoints
- Risk: Auth, voice, messages, and bind routes have no detected rate limiter (only test files reference `rateLimit`).
- Files: `hub/src/web/routes/*.ts`
- Current mitigation: Bearer JWT required on most routes after `/auth`; CORS/middleware in `hub/src/web/index.ts`.
- Recommendations: Add a per-IP / per-token limiter (e.g. token-bucket middleware) for `/auth`, `/bind`, `/voice/token`, push subscribe, and any externally exposed endpoint.

### `.env` & secret files
- Risk: `.env*` and credential patterns are not read by any source path observed, but operators set `JWT_SECRET`, `TELEGRAM_BOT_TOKEN`, `CLI_API_TOKEN`, etc. via env.
- Files: `hub/src/configuration.ts`, `hub/src/config/serverSettings.ts`, `hub/src/index.ts`
- Current mitigation: Token storage in `cli/hub` data dir with file generation fallback.
- Recommendations: Document the full env var surface in one place; reject startup if `JWT_SECRET` is left at a default/empty value; ensure tokens never appear in error messages or telemetry.

## Performance Bottlenecks

### Oversized hot files harm cold-start and edit perf
- Problem: A handful of files dominate parse/typecheck time and review surface.
- Files: `cli/src/codex/codexRemoteLauncher.ts` (3,139 lines), `web/src/lib/message-window-store.ts` (1,087 lines), `web/src/components/ToolCard/views/_results.tsx` (997 lines), `cli/src/codex/utils/appServerEventConverter.ts` (996 lines), `web/src/components/SessionList.tsx` (990 lines), `cli/src/runner/run.ts` (943 lines), `web/src/chat/reducerTimeline.ts` (925 lines), `cli/src/opencode/utils/opencodeStorageScanner.ts` (912 lines), `web/src/components/AssistantChat/HappyComposer.tsx` (870 lines), `hub/src/sync/syncEngine.ts` (854 lines), `web/src/routes/settings/index.tsx` (847 lines), `hub/src/sync/sessionCache.ts` (796 lines)
- Cause: Lack of decomposition; multi-concern modules.
- Improvement path: Split per `refactor.md` plan; introduce composition boundaries listed under "Hub session core" and "Parallel agent runtimes".

### Repeated heuristic patch invalidation
- Problem: `useSSE` may invalidate session list and detail queries on every event whose key set isn't recognized.
- Files: `web/src/hooks/useSSE.ts:532-536`
- Cause: Heuristic; over-invalidates whenever the server adds a new field.
- Improvement path: Strict shared event schema (see "Heuristic web SSE patching").

### Polling/keepalive timers in hub
- Problem: Multiple `setInterval` keepalive/liveness loops across SSE, terminal registry, sync engine, tunnel, notifications, TLS gate.
- Files: `hub/src/sse/sseManager.ts`, `hub/src/sync/syncEngine.ts`, `hub/src/socket/terminalRegistry.ts`, `hub/src/tunnel/tunnelManager.ts`, `hub/src/tunnel/tlsGate.ts`, `hub/src/notifications/notificationHub.ts`
- Cause: Each subsystem owns its own clock; no central scheduler.
- Improvement path: Centralize timers under a single scheduler with backoff and shutdown semantics; verify all clear on `process.exit`/`disconnect`.

### Duplicate utility implementations
- Problem: Levenshtein distance, base64 size estimation, Cursor permission-mode mapping, query-hook return shape — all duplicated.
- Files: `web/src/hooks/queries/useSkills.ts`, `web/src/hooks/queries/useSlashCommands.ts`, `cli/src/cursor/cursorLocalLauncher.ts`, `cli/src/cursor/cursorRemoteLauncher.ts`, `cli/src/modules/common/handlers/uploads.ts`, `hub/src/web/routes/sessions.ts`
- Cause: Copy-paste reuse instead of shared utility.
- Improvement path: Extract `createApiQuery`, `fuzzyMatch`, `cursorPermissionMode`, `uploadSize` helpers into `shared/`.

## Fragile Areas

### Multi-agent loop ↔ session ↔ launcher cycle
- Files: `cli/src/claude/{loop,session,claudeLocalLauncher,claudeRemoteLauncher}.ts`, `cli/src/codex/{loop,session,codexLocalLauncher,codexRemoteLauncher}.ts`, `cli/src/cursor/`, `cli/src/opencode/`
- Why fragile: Three circular-dependency groups; mode/setter logic duplicated four times; remote/local toggling threads through every file.
- Safe modification: Add behavior in the dedicated agent's local launcher first; verify both local and remote tests; never import sibling agents.
- Test coverage: Each agent has loop tests but cross-agent guarantees (mode mapping, abort/switch, resume, sessionId write-back) lack a single shared contract test.

### ToolCard registry / result renderer cycle
- Files: `web/src/components/ToolCard/views/_all.tsx`, `web/src/components/ToolCard/views/_results.tsx`, `web/src/components/ToolCard/ToolCard.tsx`, `web/src/components/ToolCard/knownTools.tsx`, `web/src/components/ToolCard/views/*View.tsx`
- Why fragile: 11-file circular import group; `_all.tsx` provides types and registers components, `_results.tsx` reverse-imports it.
- Safe modification: Add new tool views by mimicking the closest existing tool; never `import` from `_results.tsx` inside `_all.tsx` or new circulars appear.
- Test coverage: Per-view tests exist; no integration test asserts "all known tools resolve a renderer".

### Mid-session mode switching
- Files: `cli/src/claude/runClaude.ts:51`, `cli/src/agent/loopBase.ts`, `cli/src/agent/sessionBase.ts`
- Why fragile: Silent fallback on unknown mode; permission state must be re-applied across local/remote handoff (`cli/src/agent/localHandoff.ts`).
- Safe modification: Always go through the handoff helpers; never mutate mode state directly on session objects.
- Test coverage: `cli/src/agent/localHandoff.test.ts` and `permissionAdapter.test.ts` cover happy paths; uncovered combinations: bypass + remote, bypass + plan mode toggle.

### Hub SSE × SyncEngine coupling
- Files: `hub/src/sse/sseManager.ts`, `hub/src/sync/syncEngine.ts`, `hub/src/sync/sessionCache.ts`
- Why fragile: SSE imports concrete `syncEngine` types; cache merges are non-trivial; downstream front-end relies on heuristic patch detection.
- Safe modification: Touch one concern at a time; run the `messageService.test.ts` (1,132 lines) and `sessionModel.test.ts` (1,392 lines) suites after every change.
- Test coverage: Strong unit tests for sessionModel and messageService; gap: end-to-end SSE replay under reconnect storms.

## Scaling Limits

### Single SQLite store, single hub process
- Current capacity: One `better-sqlite3` database per hub instance; per-process in-memory caches and timers.
- Files: `hub/src/store/index.ts`, `hub/src/sync/sessionCache.ts`, `hub/src/sync/syncEngine.ts`
- Limit: Multi-instance deploys would diverge cache state and SSE delivery; SQLite write contention with many concurrent agents.
- Scaling path: If multi-tenant: extract a remote primary (Postgres/LiteFS) and broadcast bus (Redis pub/sub) before horizontal scaling.

### SSE fan-out via in-memory map
- Current capacity: Bounded by hub-process FD/memory; one `SSEManager` keeps a Map of subscribers.
- Files: `hub/src/sse/sseManager.ts`
- Limit: Many concurrent web clients per namespace will increase serialization cost on each event.
- Scaling path: Per-event diff schema (see SSE patching), batched flush windows, optional Socket.IO transport for high-rate sessions.

## Dependencies at Risk

### Custom Cloudflare-style tunnel binary
- Risk: `hub/tools/tunwg/` is a vendored binary tunnel with its own TLS gate.
- Files: `hub/src/tunnel/tunnelManager.ts`, `hub/src/tunnel/tlsGate.ts`, `hub/tools/tunwg/`
- Impact: Outage of the tunnel surface degrades remote access; binary must be kept in sync with platform builds.
- Migration plan: Document the protocol; consider falling back to user-managed reverse proxies if the vendored tool is unmaintained.

### `better-sqlite3` native bindings
- Risk: Native bindings break on Bun upgrades or new platforms (Windows arm64, etc.).
- Files: `hub/src/store/index.ts`, `package.json`
- Impact: Hub fails to start with cryptic native errors.
- Migration plan: Keep the abstraction in `hub/src/store/` thin enough to swap for `bun:sqlite` if/when stable.

## Missing Critical Features

### Token rotation / revocation
- Problem: `cliApiToken` rotation requires editing settings and restarting; namespaced tokens cannot be selectively revoked.
- Blocks: Team usage, key compromise response, audit logging.

### Structured config output
- Problem: `hapi runner status` returns boolean; no machine-readable health endpoint covers runner + hub + tunnel state in one shot.
- Files: `cli/src/runner/controlClient.ts:133-140`, `cli/src/ui/doctor.ts`
- Blocks: Reliable monitoring; remote diagnostics.

### Centralized rate limiting
- Problem: No rate limiter on `/auth`, `/voice/token`, push subscribe, bind.
- Blocks: Productionizing public-facing hub deployments.

## Test Coverage Gaps

### Runner uninstall / corruption
- What's not tested: Runner behavior when `hapi` binary is removed mid-session, and when the runner state file is corrupted.
- Files: `cli/src/runner/runner.integration.test.ts:469-473` (explicit TODOs), `cli/src/runner/controlClient.ts`, `cli/src/runner/run.ts`
- Risk: Stuck zombie runner; user-visible "won't start" with no recovery path.
- Priority: Medium.

### Cross-agent permission contract
- What's not tested: A single test matrix asserting Claude/Codex/Cursor/OpenCode all map shared `PermissionMode` to the right CLI flags and respect bypass.
- Files: `cli/src/claude/utils/permissionHandler.test.ts`, `cli/src/codex/utils/permissionHandler.test.ts`, `cli/src/agent/permissionAdapter.test.ts`, `shared/src/modes.ts`
- Risk: Future agents drift; bypass mode behaves inconsistently across agents.
- Priority: High (security-adjacent).

### SSE reconnect / patch-loss invariants
- What's not tested: No test exercises drop-and-resume scenarios verifying that the front-end converges after missed events.
- Files: `web/src/hooks/useSSE.ts`, `hub/src/sse/sseManager.ts`, `hub/src/sync/eventPublisher.ts`
- Risk: Stale UI under flaky networks; silently relies on the heuristic invalidator.
- Priority: High.

### Web layer end-to-end tests
- What's not tested: No web tests configured (`web/`); only unit tests on lib helpers, normalizers, and a handful of components.
- Files: `web/src/**/*.test.ts(x)` (only ~10 files), `web/package.json`
- Risk: UX regressions slip through CI; large components (`SessionChat`, `HappyComposer`, `SessionList`) have no behavioral coverage.
- Priority: Medium.

### Auth route negative cases
- What's not tested: Telegram disabled path, bad initData hash, mismatched namespace separator, expired/replayed JWT.
- Files: `hub/src/web/routes/auth.ts`, `hub/src/web/telegramInitData.ts`, `hub/src/utils/accessToken.ts`
- Risk: Auth regressions land unnoticed.
- Priority: High (security-adjacent).

### Hub native timers cleanup
- What's not tested: That every `setInterval`/`setTimeout` is cleared on hub shutdown.
- Files: `hub/src/tunnel/tunnelManager.ts`, `hub/src/sse/sseManager.ts`, `hub/src/sync/syncEngine.ts`, `hub/src/socket/terminalRegistry.ts`, `hub/src/notifications/notificationHub.ts`, `hub/src/tunnel/tlsGate.ts`
- Risk: Hung Bun process on `Ctrl+C`; flaky integration tests.
- Priority: Low/Medium.

---

*Concerns audit: 2026-05-20*
