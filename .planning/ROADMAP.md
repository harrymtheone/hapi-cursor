# Roadmap: HAPI Cursor Edition — Milestone 1 (Refactor & Slim-Down)

## Overview

Milestone 1 is a pure refactor + cleanup milestone on a brownfield fork. The journey: first **shrink** the codebase by deleting four non-Cursor agent runtimes and three external integration surfaces (Telegram bot, ElevenLabs voice, ServerChan push), then **collapse** multi-user namespacing and deployment-tunnel infrastructure that single-user Tailscale usage doesn't need, then **rebuild** the abstractions that Milestone 2 (Cursor incremental features) will depend on — a populated flavor capability table, a shared agent runtime kit, a single wire-contract source in `shared/`, a decomposed hub sync layer, decomposed web components, immutable config, and a focused test suite. The milestone closes with documentation cleanup and end-to-end verification on a real Tailscale + phone session.

Phases execute sequentially. Big deletions go first so every downstream refactor touches a smaller surface. Verification is the final gate — `bun typecheck`, `bun run test`, `madge` cycle scans, ripgrep absence checks, and one manual Tailscale scenario.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Cut non-Cursor agents** — Delete Claude / Codex / Gemini+ACP / OpenCode runtimes, hooks, commands, and CI (completed 2026-05-20)
- [x] **Phase 2: Cut external integration channels** — Delete Telegram bot, ElevenLabs voice route, ServerChan push channel (completed 2026-05-21)
- [x] **Phase 3: Cut multi-user namespace isolation** — Remove `CLI_API_TOKEN:<namespace>` suffix, user platform field, namespace-aware cache keys (completed 2026-05-21)
- [x] **Phase 4: Cut deployment infrastructure** — Delete tunwg tunnel, TLS gate, `HAPI_RELAY_*` env vars, remote log upload stream (completed 2026-05-21)
- [x] **Phase 5: Flavor consolidation + capability abstraction** — Collapse `AgentFlavor` to `'cursor'` only; populate capability table; remove all hardcoded `flavor ===` branches (completed 2026-05-22)
- [ ] **Phase 6: Agent runtime shared kit + mode hardening** — Extract `SessionContext / LocalAdapter / RemoteAdapter / ModeConfig / LaunchPolicy`; break `loop ↔ session ↔ launcher` cycle; throw on unknown mode
- [ ] **Phase 7: Wire contracts unification & SSE patch contract** — `shared/` becomes the only source of `Session / Machine / Message / RunnerState`; delete heuristic SSE patch detection
- [ ] **Phase 8: Hub internal decoupling** — Split `SessionCache` + `SyncEngine`; route template helpers + `ApiRouteError`; central keepalive scheduler
- [ ] **Phase 9: Web internal decoupling** — Break ToolCard 11-file cycle; split oversized files (SessionList, message-window-store, reducerTimeline, settings, HappyComposer); promote util duplicates to `shared/`
- [ ] **Phase 10: Config cleanup** — Drop `serverUrl`/`webapp` aliases + `hapi server` command + runtime SQLite migrations; `loadConfig()` returns frozen object; DI replaces `_setApiUrl()` setters
- [ ] **Phase 11: Test gap fill** — Cursor permission contract matrix; SSE reconnect / patch-loss invariants; auth route negative cases
- [ ] **Phase 12: Docs cleanup & milestone verification** — Cursor-only README/AGENTS/docs; delete `website/`; full `bun typecheck` + `bun run test` + `madge` + ripgrep absence + manual Tailscale scenario

## Phase Details

### Phase 1: Cut non-Cursor agents
**Goal**: Repository contains only Cursor-agent code; Claude, Codex, Gemini (+ACP), and OpenCode runtimes are fully removed.
**Depends on**: Nothing (first phase)
**Requirements**: CUT-01, CUT-02, CUT-03, CUT-04
**Success Criteria** (what must be TRUE):
  1. `bun typecheck` and `bun run test` both pass after deleting `cli/src/claude/`, `cli/src/codex/`, `cli/src/gemini/`, `cli/src/opencode/`, and `cli/src/agent/backends/`
  2. ripgrep across `cli/`, `hub/`, `web/`, `shared/` finds zero matches for `claude` / `codex` / `gemini` / `opencode` outside whitelisted paths. **Whitelist for Phase 1:** `.planning/codebase/`, `CHANGELOG.md`, and `shared/src/flavors.ts` (the `AgentFlavor` union literal is Phase-5-owned territory — see Phase 5 SC#1 for the final narrowing to `'cursor'`). If research/planning surfaces additional `shared/` files whose flavor literals are structurally tied to the union type (e.g. `shared/src/modes.ts`, `shared/src/models.ts`), they may be added to this whitelist in the phase PLAN with an explicit Phase-5 hand-off note.
  3. `cli/src/commands/registry.ts` no longer references `claudeCommand` / `codexCommand` / `geminiCommand` / `opencodeCommand`; default subcommand resolves to Cursor
  4. GitHub workflow files `codex-pr-review.yml` and `codex-mention-response.yml` are removed; Claude `hookForwarder` and `cli/src/codex/happyMcpStdioBridge.ts` are removed
  5. `package.json` files no longer declare `@anthropic-ai/*` or any non-Cursor agent SDK dependency; `bun.lock` regenerated
**Plans**: 5 plans
- [x] 01-01-PLAN.md — Wave 0 (A1/A2/A4/Q3 + ripgrep guard scaffold) + CUT-01 Claude removal
- [x] 01-02-PLAN.md — CUT-02 Codex removal + GitHub workflows + wire-symbol renames
- [x] 01-03-PLAN.md — CUT-03 Gemini + ACP backend + dead shared abstractions
- [x] 01-04-PLAN.md — CUT-04 OpenCode removal
- [x] 01-05-PLAN.md — Final cleanup: registry.ts fallback, codexSlashCommands rename, tighten ripgrep whitelist, bun.lock regen

### Phase 2: Cut external integration channels
**Goal**: Telegram bot, ElevenLabs voice route, and ServerChan push channel are fully removed from hub, web, and shared.
**Depends on**: Phase 1
**Requirements**: CUT-06, CUT-07, CUT-08
**Success Criteria** (what must be TRUE):
  1. `bun typecheck` and `bun run test` both pass after deleting `hub/src/telegram/`, `hub/src/web/telegramInitData.ts`, `hub/src/web/routes/bind.ts`, `hub/src/web/routes/voice.ts`, `hub/src/serverchan/`, `web/src/realtime/`, `shared/src/voice.ts`
  2. ripgrep finds zero matches for `telegram` / `serverchan` / `elevenlabs` / `grammy` across `cli/`, `hub/`, `web/`, `shared/` outside whitelisted history paths
  3. `package.json` files no longer declare `grammy` or `@elevenlabs/react`; the notification channel array in `hub/src/index.ts` no longer references Telegram or ServerChan channels
  4. Env vars `TELEGRAM_BOT_TOKEN` / `TELEGRAM_NOTIFICATION` / `SERVERCHAN_SENDKEY` / `SERVERCHAN_NOTIFICATION` are not read anywhere in the codebase
  5. `/api/auth` no longer accepts a Telegram `initData` path; `bun run test` covers only the access-token authentication branch
**Plans**: 6 plans
- [x] 02-01-PLAN.md — CUT-06 hub-side: delete hub/src/telegram/, telegramInitData, bind, auth schema collapse, grammy dep, settings TELEGRAM_* fields
- [x] 02-02-PLAN.md — CUT-06 web-side: delete useTelegram, collapse useAuthSource/useAuth/usePlatform, strip Telegram WebApp from main/router/sw/App + components + i18n + CSS
- [x] 02-03-PLAN.md — CUT-07: delete hub voice route, web/src/realtime/, voice-context, shared/src/voice.ts, @elevenlabs/react dep, settings Voice Assistant section, voice i18n keys
- [x] 02-04-PLAN.md — CUT-08: delete hub/src/serverchan/, ServerChan channel registration, settings serverChan* fields
- [x] 02-05-PLAN.md — Final cleanup: CLI residuals (TerminalManager + notify), hub banner scrub, extend ripgrep guard PATTERN with telegram|serverchan|elevenlabs|grammy, bun.lock regen
- [x] 02-06-PLAN.md — VERIFICATION gap closure: HI-01 fetchVoiceToken, HI-02 /api/bind auth bypass, HI-03 web/src/lib/languages.ts

### Phase 3: Cut multi-user namespace isolation
**Goal**: Hub treats every CLI/web connection as belonging to one user; the namespace concept is removed from auth, sockets, store, and caches.
**Depends on**: Phase 2
**Requirements**: CUT-09
**Success Criteria** (what must be TRUE):
  1. `bun typecheck` and `bun run test` both pass after dropping namespace from `parseAccessToken`, socket handshake (`socket.data.namespace`), JWT payload (`ns` field), and every store/cache method signature
  2. ripgrep finds zero matches for `namespace` / `:ns` in `cli/src/`, `hub/src/`, `web/src/`, `shared/src/` outside whitelisted history paths
  3. `CLI_API_TOKEN` parsing no longer splits on `:`; the token is treated as a single opaque secret
  4. SQLite store queries no longer scope rows by `namespace`; the `users` table `platform` column is removed via an offline migration tool entry; in-memory cache keys no longer include namespace
  5. `bun run test` exercises auth + session + machine flows without any namespace test fixture
**Plans**: 7 plans
- [x] 03-01-PLAN.md — Opaque token parsing/config and `/api/cli/*` bearer token comparison
- [x] 03-02-PLAN.md — Namespace-free store/cache/SyncEngine facades while old internals temporarily coexist
- [x] 03-03-PLAN.md — Atomic web auth/routes plus EventPublisher/SSE/SyncEngine namespace contract cleanup
- [x] 03-04-PLAN.md — Atomic Socket.IO server/data/CLI handler cleanup plus visibility and push delivery
- [x] 03-05-PLAN.md — Shared Session/SyncEvent/socket contracts plus CLI/web mirrors without namespace
- [x] 03-06-PLAN.md — Runtime schema v10, user-store deletion, namespace-free store SQL, and offline v9-to-v10 migration
- [x] 03-07-PLAN.md — Final `namespace|:ns` source guard and full validation gate

### Phase 4: Cut deployment infrastructure
**Goal**: Hub no longer ships a built-in WireGuard/TLS tunnel binary or an upstream remote-log upload channel.
**Depends on**: Phase 3
**Requirements**: CUT-10, CUT-11
**Success Criteria** (what must be TRUE):
  1. `bun typecheck` and `bun run test` both pass after deleting `hub/src/tunnel/`, `hub/tools/tunwg/`, `hub/scripts/download-tunwg.ts`, and `web/src/lib/relay-mode*`
  2. ripgrep finds zero matches for `tunwg` / `HAPI_RELAY_` / `DANGEROUSLY_LOG_TO_SERVER_FOR_AI_AUTO_DEBUGGING` across the repo (whitelist: `.planning/codebase/`, `CHANGELOG.md`)
  3. `cli/src/ui/logger.ts` no longer forwards logs to `HAPI_API_URL`; `cli/src/ui/doctor.ts` no longer surfaces the remote-log toggle
  4. `bun run build:single-exe` succeeds without any tunwg download or extraction step; QR-code rendering for tunnel URL removed from `hub/src/index.ts`
  5. Documentation references to relay/tunnel features removed from inline JSDoc and code comments (deferred prose docs handled in Phase 12)
**Plans**: 4 plans
- [x] 04-01-PLAN.md — Tunnel and hosted relay-web runtime deletion
- [x] 04-02-PLAN.md — Relay config/settings/env convergence
- [x] 04-03-PLAN.md — Remote logging and doctor cleanup
- [x] 04-04-PLAN.md — Build/runtime assets, lockfile, guard, and final gate

### Phase 5: Flavor consolidation + capability abstraction
**Goal**: `shared/src/flavors.ts` describes Cursor as the only flavor with an extensible, populated capability set; every capability check reads from this table.
**Depends on**: Phase 4 (and structurally Phase 1)
**Requirements**: CUT-05, REFA-01
**Success Criteria** (what must be TRUE):
  1. `AgentFlavor` type narrows to the literal `'cursor'`; ripgrep finds zero references to `'claude' | 'codex' | 'gemini' | 'opencode'` or to capability rows for those flavors
  2. `cursor` capability set in `shared/src/flavors.ts` is non-empty and covers the capability slots needed by current Cursor code paths (e.g. permission-mode set, model list source, RPC tools)
  3. Adding a new Cursor capability requires only an entry in `shared/src/flavors.ts` — ripgrep finds zero `if (flavor ===` / `switch (flavor)` comparisons or hardcoded capability gates anywhere in `cli/`, `hub/`, `web/`
  4. `bun typecheck` and `bun run test` both pass; capability lookup helper has a focused unit test
**Plans**: 8 plans
- [x] 05-01-PLAN.md — Slice 1a (shared add): FlavorCapabilities type + Record-shaped FLAVOR_CAPS + lookup helpers + rewritten 23-case flavors.test.ts (SC#4 seed)
- [x] 05-02-PLAN.md — Slice 2a (web ToolCard): PermissionFooter capability-driven tone, delete Codex* renderer files + registry purge, drop acceptEdits UI
- [x] 05-03-PLAN.md — Slice 2b (web NewSession/AssistantChat/SessionList): AgentType narrow to 'cursor', delete codex/claude option files, FLAVOR_BADGES single-row
- [x] 05-04-PLAN.md — Slice 2c (web chat/lib/hooks/api): capability-driven getContextBudgetTokens, AGENT_MESSAGE_PAYLOAD_TYPE constant adoption, delete useCodexModels + setCollaborationMode
- [x] 05-05-PLAN.md — Slice 3a (cli): slashCommands capability lookup, runner Cursor default, delete CodexDisplay + Codex skills path, rename Claude-named helpers
- [x] 05-06-PLAN.md — Slice 3b (hub): syncEngine degenerate-ternary collapse, hub-route defaults to 'cursor', machines.ts Zod enum narrow, test fixtures Cursor-only
- [x] 05-07-PLAN.md — Slice 1b (shared delete — closes the door): AgentFlavor narrow to 'cursor', delete non-cursor *_PERMISSION_MODES + CodexCollaborationMode*, narrow AgentFlavorSchema, delete SessionSchema.collaborationMode
- [x] 05-08-PLAN.md — Slice 4 (guard + final verification): shrink Phase-5-territory whitelist, line-anchored AGENT_MESSAGE_PAYLOAD_TYPE post-filter, PHASE5_IDENTIFIER_PATTERN sweep, FLAVOR_BRANCH sweep

### Phase 6: Agent runtime shared kit + mode hardening
**Goal**: Cursor local and remote launchers share a single runtime kit; the `loop ↔ session ↔ launcher` circular-dependency group is broken; unknown permission modes throw.
**Depends on**: Phase 5
**Requirements**: REFA-02, REFA-05
**Success Criteria** (what must be TRUE):
  1. `SessionContext / LocalAdapter / RemoteAdapter / ModeConfig / LaunchPolicy` exist as a shared module under `cli/src/agent/`; `cursorLocalLauncher` and `cursorRemoteLauncher` import from it instead of duplicating permission-mode mapping
  2. `madge` (or equivalent) reports zero circular dependencies in `cli/src/cursor/`; mode types live in a dedicated `modes.ts` module that does not import from `loop.ts` / `session.ts` / launcher files
  3. Unknown permission mode raises a typed error with the offending mode name; ripgrep finds zero TODOs of the form `// Eventually we should error here instead of silently switching`
  4. New tests cover mid-session `bypass + remote` and `bypass + plan` switches plus the unknown-mode error path; existing `bun run test` suite stays green
  5. `bun typecheck` passes; no `cursorLocalLauncher` ↔ `cursorRemoteLauncher` copy-paste detected by ripgrep on permission-mode mapping
**Plans**: 4 plans
- [x] 06-01-PLAN.md — Extract `cli/src/cursor/modes.ts` leaf module + redirect imports; break the 3 madge cycles in `cli/src/cursor` (completed 2026-05-22)
- [ ] 06-02-PLAN.md — Add `UnknownPermissionModeError` to `shared/src/modes.ts`; create `cli/src/agent/modeConfig.ts` + unit tests; upgrade `runCursor.ts::resolvePermissionMode` throw class
- [ ] 06-03-PLAN.md — Converge both launchers onto `modeConfig.permissionModeToCursorArgs`; delete `permissionModeToAgentArgs` + `as string` casts; export `buildAgentArgs`; stamp 4 SC#1 JSDoc anchors
- [ ] 06-04-PLAN.md — Add mid-session yolo + plan switch tests (remote + local); extend `scripts/check-no-cut-agents.sh` with Phase 6 ripgrep + madge guard; pin `madge` devDep

### Phase 7: Wire contracts unification & SSE patch contract
**Goal**: `shared/` is the only source of `Session / Machine / Message / RunnerState` DTOs and SSE event payloads; the web client no longer guesses about the server contract.
**Depends on**: Phase 6
**Requirements**: REFA-03, REFA-04
**Success Criteria** (what must be TRUE):
  1. `Session`, `Machine`, `Message`, `RunnerState`, and their Zod schemas are defined exactly once, in `shared/src/schemas.ts`; ripgrep finds zero duplicate interface/type declarations in `cli/src/api/types.ts`, `web/src/types/api.ts`, `hub/src/web/routes/`, or `hub/src/sync/sessionCache.ts`
  2. `hasUnknownSessionPatchKeys()` and any heuristic patch-key detection are removed from `web/src/hooks/useSSE.ts`; SSE events emit either a full `SessionSummary`/`MachineSummary` or a strict patch schema defined in `shared/` (the chosen path is documented in code)
  3. Front-end SSE event handlers consume the canonical schema directly; TanStack Query cache updates derive from the schema without any "fallback to refetch list" branch
  4. `bun typecheck` and `bun run test` both pass; new tests exercise the SSE handler against a strictly typed event stream
**Plans**: TBD

### Phase 8: Hub internal decoupling
**Goal**: Hub sync layer is decomposed into single-responsibility services; SSE no longer reverse-depends on `SyncEngine`; every recurring timer goes through a shared scheduler that is fully cleared on shutdown.
**Depends on**: Phase 7
**Requirements**: REFH-01, REFH-02, REFH-03, REFH-04
**Success Criteria** (what must be TRUE):
  1. `SessionCache` (was 796 lines) is replaced by `sessionRepository / sessionLivenessService / sessionConfigService / sessionMergeService`; `SyncEngine` (was 854 lines) is decomposed; no file in `hub/src/sync/` exceeds ~400 lines
  2. `hub/src/sse/` imports only from `shared/` for event types — ripgrep finds zero `import { SyncEngine }` or `import .* from '@/sync/syncEngine'` inside `hub/src/sse/`
  3. `hub/src/web/routes/sessions.ts` is split by responsibility (lifecycle / config / upload / read-only); every route file uses `parseJsonBody(schema) / withEngine / withSession / withActiveSession / withMachine` helpers and surfaces errors as a unified `ApiRouteError`
  4. All `setInterval` / `setTimeout` usage in `hub/src/{sse,sync,socket,notifications}/` goes through a single keepalive scheduler; a test asserts every timer is cleared on `process.exit` (SIGINT case included)
  5. `madge` reports zero circular dependencies inside `hub/src/`; `bun typecheck` and `bun run test` both pass
**Plans**: TBD

### Phase 9: Web internal decoupling
**Goal**: Web circular dependencies are broken, oversized files are decomposed, and duplicated utilities live in `shared/` instead of being copy-pasted across packages.
**Depends on**: Phase 8
**Requirements**: REFW-01, REFW-02, REFW-03
**Success Criteria** (what must be TRUE):
  1. `madge` reports zero cycles inside `web/src/components/ToolCard/`; an integration test asserts every known tool in `knownTools.tsx` resolves to a renderer (no missing-view fallback)
  2. None of `SessionList.tsx`, `message-window-store.ts`, `reducerTimeline.ts`, `routes/settings/index.tsx`, or `AssistantChat/HappyComposer.tsx` exceeds ~500 lines after decomposition; each split unit has a focused colocated test
  3. Levenshtein distance, base64 size estimation, Cursor permission-mode mapping, and the `createApiQuery` hook factory live in `shared/`; ripgrep finds zero duplicate implementations in `cli/` or `web/`
  4. `madge` reports zero cycles inside `web/src/`; `bun typecheck` and `bun run test` both pass
**Plans**: TBD
**UI hint**: yes

### Phase 10: Config cleanup
**Goal**: Backward-compat config aliases, the `hapi server` command alias, and all runtime SQLite migration paths are dropped; both CLI and Hub expose config as a frozen value loaded once at startup.
**Depends on**: Phase 9
**Requirements**: REFC-01, REFC-02
**Success Criteria** (what must be TRUE):
  1. ripgrep finds zero matches for `serverUrl` / `webapp(Url|Host|Origin)` legacy field reads, zero `hapi server` command alias, and zero callsites of `_setApiUrl()` / `_setCliApiToken()` / `_setExtraHeaders()` in `cli/` or `hub/`
  2. SQLite store rejects schema-version mismatches at startup with an explicit error pointing users to an offline migration tool; runtime `migration-vN.ts` source files are removed (their tests stay only if they cover the offline tool)
  3. CLI `loadConfig()` and Hub `loadConfig()` each return a `Readonly<...>` (or `Object.freeze`d) result; consumers receive config via dependency injection — no module-level mutable singleton remains
  4. `bun typecheck` and `bun run test` both pass; a new test verifies that mutating a returned config object throws in strict mode
**Plans**: TBD

### Phase 11: Test gap fill
**Goal**: Cursor permission contract, SSE reconnect invariants, and auth route negative cases are covered by automated tests.
**Depends on**: Phase 10
**Requirements**: REFT-01, REFT-02, REFT-03
**Success Criteria** (what must be TRUE):
  1. A single Cursor permission contract matrix test asserts every `PermissionMode → Cursor CLI flag` row; adding a new mode without a matrix row fails the test
  2. A new SSE reconnect / patch-loss invariant test simulates dropped events plus reconnection; the front-end query cache converges to the authoritative server state within a bounded retry budget
  3. Auth route negative-case tests cover bad token, expired JWT, replayed JWT, and empty body — every case returns the expected 4xx status without leaking secrets in the response body or logs
  4. `bun run test` is green; coverage for `cli/src/cursor/`, `hub/src/web/routes/auth.ts`, `hub/src/sse/`, and `web/src/hooks/useSSE.ts` does not regress versus Phase 10
**Plans**: TBD

### Phase 12: Docs cleanup & milestone verification
**Goal**: Documentation reflects the Cursor-only post-cut codebase, and all Milestone 1 acceptance checks pass end-to-end.
**Depends on**: Phase 11
**Requirements**: CUT-12, VRFY-01, VRFY-02, VRFY-03, VRFY-04
**Success Criteria** (what must be TRUE):
  1. Root `README.md`, `AGENTS.md`, `cli/README.md`, `hub/README.md`, `web/README.md` describe Cursor as the only supported agent — no Claude / Codex / Gemini / OpenCode mentions; `website/` directory is deleted; `docs/` retains only Cursor-relevant pages
  2. `bun typecheck` and `bun run test` are both green; lint is green if a linter is configured (lint is currently not enforced — surface that fact in the verification report)
  3. `madge` reports zero circular dependencies across `cli/`, `hub/`, and `web/` (intra-package and cross-package)
  4. ripgrep finds zero matches for `claude` / `codex` / `gemini` / `opencode` / `telegram` / `serverchan` / `elevenlabs` / `tunwg` / `namespace` in non-historical files (whitelist: `.planning/codebase/` snapshots, `CHANGELOG.md`, git history)
  5. Manual Tailscale + Cursor scenario passes end-to-end: local `hapi runner` + hub running; phone on Tailscale opens the Web PWA, creates a new Cursor session, completes one round of interaction, the hub is killed and restarted, session state recovers, and the next round of interaction continues successfully
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11 → 12

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Cut non-Cursor agents | 5/5 | Complete   | 2026-05-20 |
| 2. Cut external integration channels | 6/6 | Complete   | 2026-05-21 |
| 3. Cut multi-user namespace isolation | 7/7 | Complete   | 2026-05-21 |
| 4. Cut deployment infrastructure | 4/4 | Complete   | 2026-05-21 |
| 5. Flavor consolidation + capability abstraction | 7/8 | In Progress|  |
| 6. Agent runtime shared kit + mode hardening | 0/TBD | Not started | - |
| 7. Wire contracts unification & SSE patch contract | 0/TBD | Not started | - |
| 8. Hub internal decoupling | 0/TBD | Not started | - |
| 9. Web internal decoupling | 0/TBD | Not started | - |
| 10. Config cleanup | 0/TBD | Not started | - |
| 11. Test gap fill | 0/TBD | Not started | - |
| 12. Docs cleanup & milestone verification | 0/TBD | Not started | - |

---
*Roadmap created: 2026-05-20 (Milestone 1 — Refactor & Slim-Down)*
