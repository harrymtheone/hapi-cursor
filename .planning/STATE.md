---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: planning
stopped_at: Phase 12 context gathered
last_updated: "2026-05-23T05:23:28.148Z"
last_activity: 2026-05-23
progress:
  total_phases: 12
  completed_phases: 11
  total_plans: 55
  completed_plans: 55
  percent: 92
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-20)

**Core value:** 让 Cursor Agent 在手机端达到与桌面 Cursor IDE 等同的可用性
**Current focus:** Phase 12 — docs cleanup & milestone verification

## Current Position

Phase: 12
Plan: Not started
Status: Ready to plan
Last activity: 2026-05-23

Progress: [██████████] 100%

## Performance Metrics

**Velocity:**

- Total plans completed: 56
- Average duration: —
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| — | — | — | — |
| 01 | 5 | - | - |
| 02 | 6 | - | - |
| 04 | 4 | - | - |
| 05 | 8 | - | - |
| 06 | 4 | - | - |
| 07 | 4 | - | - |
| 08 | 4 | - | - |
| 09 | 4 | - | - |
| 10 | 4 | - | - |
| 11 | 5 | - | - |

**Recent Trend:**

- Last 5 plans: —
- Trend: —

*Updated after each plan completion*
| Phase 02 P01 | 5min | 4 tasks | 19 files |
| Phase 02 P02 | 6min | 2 tasks | 17 files |
| Phase 02 P03 | 7min | 3 tasks | 28 files |
| Phase 02 P04 | 5min | 2 tasks | 6 files |
| Phase 02 P06 | 3min | 3 tasks | 3 files |
| Phase 03 P01 | 3min 20s | 2 tasks | 8 files |
| Phase 03 P02 | 6min 24s | 3 tasks | 12 files |
| Phase 03 P03 | 5min 25s | 2 tasks | 15 files |
| Phase 03 P04 | 5min 31s | 2 tasks | 16 files |
| Phase 03 P05 | 5min 13s | 2 tasks | 10 files |
| Phase 03 P06 | 2min | 3 tasks | 12 files |
| Phase 03 P07 | 2min 49s | 1 tasks | 6 files |
| Phase 04 P01 | 2min | 2 tasks | 5 files |
| Phase 04 P02 | 2 min | 2 tasks | 3 files |
| Phase 04 P03 | 21 min | 2 tasks | 4 files |
| Phase 04 P04 | 8 min | 3 tasks | 19 files |
| Phase 05 P01 | 5min | 2 tasks | 2 files |
| Phase 05 P02 | 8min | 2 tasks | 16 files |
| Phase 05 P03 | 10min | 3 tasks | 27 files |
| Phase 05 P04 | 25min | 3 tasks | 35 files |
| Phase 05 P05 | 8min | 3 tasks | 24 files |
| Phase 05 P06 | 12min | 2 tasks | 11 files |
| Phase 05 P07 | 8min | 3 tasks | 10 files |
| Phase 05 P08 | 6min | 3 tasks | 6 files |
| Phase 06 P01 | 4min | 2 tasks | 4 files |
| Phase 06 P06-02 | 8min | 4 tasks | 5 files |
| Phase 06 P06-03 | 7min | 3 tasks | 6 files |
| Phase 06 P06-04 | 8min | 3 tasks | 3 files |
| Phase 07 P07-01 | 25min | 3 tasks | 24 files |
| Phase 07 P02 | 3min 26s | 4 tasks | 3 files |
| Phase 07 P03 | 11min | 7 tasks | 25 files |
| Phase 07 P04 | 5min 24s | 3 tasks | 6 files |
| Phase 08 P08-02 | 50m | 3 tasks | 21 files |
| Phase 08 P03 | 30min | 3 tasks | 17 files |
| Phase 08 P08-04 | 10m | 2 tasks | 2 files |
| Phase 09 P09-01 | 4min | 5 tasks | 14 files |
| Phase 09 P02 | 18 | 4 tasks | 25 files |
| Phase 09 P03 | 12min | 3 tasks | 22 files |
| Phase 9 P4 | 10 | 3 tasks | 6 files |
| Phase 10-config-cleanup P01 | 10min | 4 tasks | 7 files |
| Phase 11-test-gap-fill P01 | 4 | 1 tasks | 1 files |
| Phase 11 P02 | 5min | 1 tasks | 2 files |
| Phase 11 P03 | 8min | 3 tasks | 3 files |
| Phase 11 P05 | 8min | 2 tasks | 3 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Fork over upstream contribution: Cursor-only direction conflicts with upstream multi-agent goal
- Milestone 1 = full refactor + slim-down before any new feature work — owner is explicit on "不计较 token / 时间成本, 只要清晰正确"
- Big deletions go first (Phases 1–4) so every downstream refactor touches less surface area
- Flavor capability abstraction (REFA-01) folded into Phase 5 alongside CUT-05 — both edit `shared/src/flavors.ts`
- Documentation cleanup (CUT-12) is folded into the final verification phase since the VRFY-03 ripgrep check depends on docs being clean
- [Phase ?]: D-30 commit #1: hub-side Telegram bot removed, /api/auth collapsed to access-token-only
- [Phase ?]: Phase 02 commit #2 (D-30): web-side Telegram WebApp platform removed; web /api/auth client now strictly { accessToken }.
- [Phase 02]: D-30 commit #4 (CUT-08): ServerChan push channel deleted; notificationChannels reduced to [PushNotificationChannel] length 1 (D-22 confirmed); SERVERCHAN_* env reads gone.
- [Phase 02]: P06 closes 02-VERIFICATION High-severity gaps: HI-01 (web fetchVoiceToken), HI-02 (hub /api/bind auth bypass), HI-03 (web languages.ts) — Phase 2 ready for verifier rerun.
- [Phase 03]: Plan 01 makes CLI_API_TOKEN an opaque secret: parser/config/CLI bearer auth compare whole tokens, and colons are token data rather than namespace separators.
- [Phase 03]: Plan 01 leaves explicit transitional default namespace constants only at deferred JWT/socket/store consumers until Plans 03-03 and 03-04 cut those contracts atomically.
- [Phase 03]: Plan 02 adds owner-only store/cache/SyncEngine facade overloads while legacy namespace overloads remain temporarily for Plans 03-03 through 03-06.
- [Phase 03]: Plan 02 push owner-only facade writes through the current physical namespace column as a temporary storage detail until Plan 03-06 removes the column and endpoint-only uniqueness lands.
- [Phase 03]: Plan 03 narrows web JWTs and WebAppEnv to owner-only { uid } identity; Hono routes and guards no longer read namespace.
- [Phase 03]: Plan 03 removes namespace enrichment/filtering from EventPublisher and SSE subscriptions while keeping all/sessionId/machineId relevance filters.
- [Phase 03]: Plan 03 keeps a temporary owner visibility scope until Plan 03-04 removes remaining visibility/push namespace APIs.
- [Phase 03]: Plan 04 removes SocketData namespace writes/reads; CLI and terminal sockets now authorize by opaque token/JWT uid plus session or machine existence.
- [Phase 03]: Plan 04 collapses visibility and push fallback to global owner-only delivery over all current push subscriptions.
- [Phase 03]: Plan 05 deletes namespace from shared Session/SyncEvent/socket contracts and CLI mirrors; store namespace columns remain internal until Plan 03-06.
- [Phase 03]: Plan 06 cuts runtime SQLite store to schema v10 with no namespace columns/indexes or users table; old v9 namespace-shaped DBs require the offline migration script.
- [Phase 03]: Plan 06 adds `hub/scripts/migrate-namespace-isolation.ts` for explicit-path v9-to-v10 migration, preserving sessions/machines/messages and deduping push subscriptions by endpoint.
- [Phase 03]: Plan 07 adds a fail-closed namespace source guard over `cli/src`, `hub/src`, `web/src`, and `shared/src`; explicit source scan and full suite pass.
- [Phase 04]: Plan 01 removed hub built-in tunnel startup, TLS gate, relay CLI/env reads, token-bearing QR/direct URL output, and hosted relay-web serving.
- [Phase 04]: `HAPI_PUBLIC_URL` remains the neutral Tailscale/public URL output path; remaining CUT-10 work continues in Plans 04-02 through 04-04.
- [Phase 04]: Kept HAPI_PUBLIC_URL as the only public URL config path while legacy relay settings fail through old-field validation. — Plan 04-02 converged relay config/settings without compatibility shims.
- [Phase 04]: Plan 03 removed the dangerous remote-log upload path outright while preserving local logger output and legitimate HAPI_API_URL direct-connect diagnostics. — CUT-11 and D-57 through D-60 require deleting remote uploads without breaking direct CLI-to-hub configuration.
- [Phase 04]: Removed the legacy tunnel binary from the single-exe and embedded runtime asset pipeline while preserving ripgrep and difftastic archive extraction. — Task 04-04-01 required deleting only the tunnel-specific runtime asset code; shared runtime extraction stayed intact.
- [Phase 04]: Phase 04 guard exclusions are planning-only for deployment-infrastructure residue; docs, website, README, and runtime source are not whitelisted. — The plan required fail-closed zero-tolerance scans and explicitly prohibited broad docs or source whitelists.
- [Phase ?]: [Phase 05]: Plan 01 promoted FLAVOR_CAPS to Record<AgentFlavor, FlavorCapabilities> with cursor row populated per D-73 + getCapabilities/getCapability lookup helpers; placeholder non-cursor rows preserve legacy hasCapability semantics until Slice 1b (plan 05-07) narrows AgentFlavor.
- [Phase 05]: Plan 02 purged Codex* renderer surface from web/src/components/ToolCard/ (≈1500 LoC across 3 deleted files + 11 modified) and migrated PermissionFooter from isCodexFamilyFlavor to getCapability(flavor, 'permissionToneCopy'); knownTools.tsx + knownTools.test.tsx purged under Rule 3 (not in plan files_modified but imported codexAgents.ts directly).
- [Phase 05]: Plan 03 collapsed NewSession + AssistantChat + SessionList web subtrees to cursor-only (~1500 LoC removed across 14 deleted + 13 modified files); narrowed AgentType to 'cursor', dropped CodexCollaborationMode consumers from StatusBar + HappyComposer + SessionChat, collapsed SessionList FLAVOR_BADGES to single cursor row; slice-wide \b(claude|codex|gemini|opencode)\b ripgrep gate green across the four target directories.
- [Phase 05]: Plan 04 collapsed remaining web non-component layers (chat reducers/normalizers/types, lib utilities/locales, hooks/api client, router default) to cursor-only (~1700 LoC removed across 2 deleted + 33 modified files). Rewrote getContextBudgetTokens against getCapability, deleted useCodexModels + setCollaborationMode + setModelReasoningEffort, narrowed api/client agent + permission unions to cursor + CursorPermissionMode, replaced bare 'codex' payload-type literals with AGENT_MESSAGE_PAYLOAD_TYPE imports; slice-wide ripgrep gate over web/src/ now zero-hit.
- [Phase 05]: Plan 06 collapsed hub/src to cursor-only (~11 files modified): syncEngine.resolveFlavor returns 'cursor' constant, resolveAgentResumeId collapses to cursorSessionId, spawnSession default param narrowed to 'cursor'; rpcGateway agent param narrowed; deleted extractTodosFromClaudeOutput (dead — cursor uses AGENT_MESSAGE_PAYLOAD_TYPE); web/routes/sessions/permissions/machines defaults collapsed to 'cursor'; deleted /sessions/:id/effort endpoint (Claude-only); machines.ts Zod spawn agent narrowed to z.literal('cursor'); test fixtures rewritten to cursor + AGENT_MESSAGE_PAYLOAD_TYPE; removed 4 `.skip`'d Claude resume-recovery tests. Slice gate `rg -ni '\\b(claude|codex|gemini|opencode)\\b' hub/src/` zero hits.
- [Phase 05]: Plan 07 (slice 1b, "close the door") narrowed shared/ to cursor-only at the type+Zod level: AgentFlavor='cursor' literal (SC#1, D-69); deleted CLAUDE/CODEX/GEMINI/OPENCODE_PERMISSION_MODES + CodexCollaborationMode* surface from modes.ts; PERMISSION_MODES collapsed to 4 cursor modes; FLAVOR_CAPS+FLAVOR_LABELS reduced to single row; isCodexFamilyFlavor deleted (D-82); AgentFlavorSchema=z.literal('cursor'); SessionSchema/LocalResumeTargetSchema.collaborationMode deleted; MetadataSchema.flavor kept as z.string().nullish() (wire narrow safety §1); AGENT_MESSAGE_PAYLOAD_TYPE='codex' retained with JSDoc "wire-protocol legacy literal" anchor for guard post-filter (D-81). Cascade fixes in cli BasePermissionHandler (dead safe-yolo/read-only branches), hub sessionModel.test (bypassPermissions→yolo), web useSSE (collaborationMode patch key). Slice gate `bun typecheck && bun run test` green (532 tests).
- [Phase 05]: Plan 05 collapsed cli/src to cursor-only (~24 files, 1 deleted: ui/ink/CodexDisplay.tsx). slashCommands.ts/skills.ts rewritten as capability-driven (getCapability for user/project dirs; ~/.agents/skills only); runner/run.ts spawns 'cursor' binary as constant + drops --effort + drops CLAUDE_CODE_OAUTH_TOKEN env path; api/types.ts free of CodexCollaborationMode (cascaded to api.ts/apiSession.ts/sessionBase.ts/2 test fixtures); renamed sendClaudeSessionMessage → sendAgentSessionMessage and formatAttachmentsForClaude → formatAttachmentsForAgent. All phase-1-whitelisted cli files (agent/serverUtils/*, ui/logger.ts, ui/ink/RemoteModeDisplay.tsx, runner/README.md) scrubbed; `rg -ni '\\b(claude|codex|gemini|opencode)\\b' cli/src/` now zero-hit.
- [Phase 06]: Plan 01 extracted `cli/src/cursor/modes.ts` as a leaf module re-exporting `PermissionMode` (= `CursorPermissionMode`) and `EnhancedMode`; deleted the duplicate type defs from `loop.ts` and swapped `session.ts` + `runCursor.ts` type imports from `./loop` to `./modes`. The session→loop reverse edge is gone; `npx madge --circular --extensions ts,tsx cli/src/cursor` collapses from 3 cycles to 0 (REFA-05 / SC#2). Launcher files intentionally untouched — they still use a local string-typed helper (migration scheduled for Plan 06-03 when the shared `modeConfig` lands). `bun typecheck` + `bun run test` (532) green.
- [Phase 05]: Plan 08 (slice 4 — phase gate) collapsed `scripts/check-no-cut-agents.sh` Phase-5 territory whitelist to zero entries; added line-anchored post-filter for `AGENT_MESSAGE_PAYLOAD_TYPE = 'codex' as const` at `shared/src/modes.ts:9` (D-85; survives line-position drift via JSDoc-anchored content match); added `PHASE5_IDENTIFIER_PATTERN` sibling-block sweep (rejects `isCodexFamilyFlavor` / `CodexCollaborationMode` / `getCodexCollaboration*` / `(CLAUDE|CODEX|GEMINI|OPENCODE)_PERMISSION_MODES` in `cli/src hub/src web/src shared/src`); added `PHASE5_BRANCH_PATTERN` sibling-block sweep with `=== 'cursor'` + `typeof flavor ===` post-filters (rejects non-cursor `flavor === '<literal>'` branches). Cross-plan corrections (Rule 1): narrowed `permissionToneCopy: 'cursor' | 'codex'` to `'cursor'` in `shared/src/flavors.ts:24`; swapped `'claude'` literals to `'unknown-flavor'` in `shared/src/flavors.test.ts` cases 14 + 17. Final phase gate `bun typecheck && bun run test && bash scripts/check-no-cut-agents.sh` exits 0 (532 tests); SC#1–#4 all met; `05-VALIDATION.md` `nyquist_compliant: true`.
- [Phase ?]: [Phase 07]: Plan 01 (Slice 1) lifted Machine/RunnerState/MachineMetadata/Message wire schemas + new SessionPatchSchema/MachinePatchSchema (strict) into shared/src/schemas.ts; tightened SyncEventSchema.data on session-added/session-updated/machine-updated; deleted MetadataSchema.flavor (Pitfall #1: stays default-strip not strict); flipped AGENT_MESSAGE_PAYLOAD_TYPE to 'cursor'; created shared/src/responses.ts. Slice 1 absorbed slice-2/3 cascades (hub flavor reads, web flavor display reads, hub emit-shape conformance, hub local interface Machine collision) as Rule-3 deviations to keep workspace gate green; slices 07-02 + 07-03 should be re-scoped per SUMMARY's deviations section. 532 tests green.
- [Phase 07]: Plan 02 added runtime hub broadcast contract proof for SessionCache and MachineCache emits; removed hub-local machineMetadataSchema in favor of shared MachineMetadataSchema with read-site fallbacks; added non-blocking dev/test SyncEventSchema self-check in EventPublisher.emit. Full gate `bun typecheck && bun run test` passed (CLI 237, Hub 155 incl. 6 new contract tests, Web 532, guard green).
- [Phase 07]: Plan 03 collapsed CLI/web wire mirrors onto shared protocol schemas/types, removed remaining CLI writer-side flavor plumbing, and rewrote `useSSE` to parse `SyncEventSchema` directly. Malformed SSE events now log/drop without fallback invalidation; `SessionSummary.backgroundTaskCount` updates list/detail cache directly; `SessionList` no longer renders flavor badges. Full gate `bun typecheck && bun run test` passed (CLI 237, Hub 155, Web 541, guard green).
- [Phase 07]: Guard checks target declarations/usages while preserving top-level resume-target flavor — The D-126 guard must enforce REFA-03/REFA-04 without flagging legitimate LocalResumeTarget/ResumableSession flavor fields.
- [Phase 07]: Strip hub metadata flavor fixtures before enabling D-126 — The completed wire contract deletes metadata.flavor, so remaining hub test fixtures were old contract residue that would make the new zero-tolerance guard fail.
- [Phase ?]: Session sub-facade split further into syncEngineSessionResume.ts to satisfy SC#1 <400 line budget
- [Phase ?]: createShutdownHandler factory exported; main() gated on import.meta.main; shutdown awaits syncEngine.shutdown() raced with 5s timeout
- [Phase ?]: Phase 8 guard scripts installed: standalone scripts/check-no-circular-hub.sh + Phase-8 D-143 zero-tolerance block in scripts/check-no-cut-agents.sh tail-invoking the madge guard for a single phase-gate command
- [Phase 09]: Plan 1 dedups estimateBase64Bytes to shared/src/uploads.ts (cli + hub callsites swapped) and dedups levenshteinDistance to web/src/lib/fuzzyMatch.ts (web-only per D-155 shared-boundary rule).
- [Phase 09]: Plan 1 abstracts createApiQuery factory in web/src/hooks/queries/_factory.ts now that 3 shape-A consumers exist (useSessions/useSession/useMachines); shape-A' and shape-B hooks remain unmigrated per Slice-1 scope.
- [Phase 09]: Plan 1 introduces table-driven ToolCard.integration.test.tsx asserting every Object.keys(knownTools) entry renders without hitting the unknown-fallback testid + negative-control sentinel; anchor lives on knownTools.tsx WrenchIcon path wrapped in a span (icons.tsx only forwards className).
- [Phase 09]: Plan 1 adds scripts/check-no-circular-web.sh mirroring the Phase-8 hub guard; madge reports 0 cycles inside web/src/.
- [Phase ?]: Phase 09 Plan 2: message-window-store split into 5 sub-modules + 28-line facade; SessionList split into 4 hooks + 4 sub-components + icons support; public surfaces preserved verbatim, pre-existing tests pass unmodified.
- [Phase 09]: Plan 3 collapses settings/index.tsx (758 → 47), HappyComposer.tsx (669 → 178), and ToolCard/views/_results.tsx (687 → 175 dispatcher) to thin orchestrators. Public surfaces preserved (settings default export, HappyComposer named export, _results.tsx re-exports of extractTextFromResult + getMutationResultRenderMode). REFW-02 closed; bun typecheck + bun run test all green; pre-existing 09-02 typecheck slip in SessionListItem.test.tsx fixed inline (Rule 3).
- [Phase ?]: Phase 9 closed: single-command gate green; 7 D-158 sub-checks active; pre-existing messageWindow* madge cycles fixed via trim-helper extraction + persistence registrar inversion.
- [Phase ?]: Plan 10-01: retired CLI commands fail hard via RETIRED_COMMANDS with repair message (D-160)
- [Phase ?]: Plan 10-01: CLI hub launcher writes HAPI_LISTEN_HOST/PORT (env names the hub actually reads)
- [Phase ?]: Plan 10-01: Phase-10 guard block — alias+migration-v* active; legacy-field/setter/singleton staged for Plan 04
- [Phase ?]: Phase 10 baseline: hub auth.ts 18.18%, sseManager.ts 79.82%; cli+web scopes unavailable on main (missing @vitest/coverage-v8) — plan 11-05 sets new baseline for those three
- [Phase ?]: [Phase 11]: Plan 03 closes REFT-03 with 16 tests (6 route + 10 middleware) and shared assertNoSecretLeak helper; wrong-alg fixture uses HS512 re-sign; orchestrator overrides (empty-string accessToken -> 401, drop uid != ownerId case, replace with no-uid-payload case) applied.
- [Phase ?]: [Phase 11]: Plan 05 closes phase — guard appended (REFT-01 + cross-runner); coverage non-regression GREEN (auth.ts 18.18->100.00, sseManager held 79.82); v8-coverage scopes declared new unavailable baseline

### Pending Todos

None yet.

### Blockers/Concerns

None yet.

## Deferred Items

Items acknowledged and carried forward from previous milestone close:

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| *(none — first milestone)* | | | |

## Session Continuity

Last session: 2026-05-23T05:23:28.144Z
Stopped at: Phase 12 context gathered
Resume file: .planning/phases/12-docs-cleanup-milestone-verification/12-CONTEXT.md
