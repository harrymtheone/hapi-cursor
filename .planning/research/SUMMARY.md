# Project Research Summary

**Project:** HAPI Cursor Edition
**Domain:** Single-user mobile/tablet control surface for Cursor Agent sessions
**Researched:** 2026-05-23
**Confidence:** HIGH overall, with MEDIUM confidence for true per-session Cursor skill/MCP enforcement

## Executive Summary

HAPI Cursor Edition v1.1 is a focused mobile control milestone for an existing Cursor-only, local-first CLI-Hub-Web bridge. Experts would build this by extending the current Bun/TypeScript, Hono, Socket.IO, SSE, SQLite, React, and shared Zod contract architecture, not by adding a second agent runtime, Cursor SDK control plane, MCP supervisor, or global settings editor. The phone/tablet app should become a reliable control and monitoring surface for Cursor sessions: model choice, effort/status visibility, skills/MCP visibility and session policy, approvals, and browser screenshot review.

The recommended approach is contract-first and runtime-first. Add Cursor-specific shared schemas, discover models/skills/MCP servers from the local CLI machine, persist session policy in the Hub, apply accepted runtime config through CLI session RPC before claiming success, and deliver mobile updates through strict SSE patches. Model list discovery should use Cursor CLI commands; skills should be scanned from Cursor-documented directories; MCP config should be treated as read-only inventory for v1.1; screenshots should reuse the existing generated-image pipeline with mobile-specific presentation.

The main risk is building UI that looks finished while Cursor still runs with stale or global state. Model switching must be proven by the next spawned Cursor process arguments and keepalive state. Skill and MCP toggles must not mutate `SKILL.md`, skill folders, `.cursor/mcp.json`, or global Cursor settings from a session screen. If Cursor does not expose stable per-session suppression for skills/MCP servers, v1.1 should still ship honest visibility and HAPI session policy, while clearly labeling enforcement limits and deferring hard isolation until a verified Cursor mechanism exists.

## Key Findings

### Recommended Stack

The existing stack is the right stack. v1.1 should add thin Cursor adapters and shared contracts rather than new infrastructure. Cursor Agent CLI remains the runtime authority; the CLI package remains responsible for local discovery and applying session config; the Hub remains the persistence, validation, and SSE boundary; the Web remains a mobile PWA using TanStack Query and existing session components.

**Core technologies:**
- Cursor Agent CLI `agent`: model discovery/selection, MCP status commands, stream-json source — use documented CLI commands and flags instead of hardcoded model tables or Cursor SDK.
- Bun + TypeScript: strict local runtime and tests — already sufficient for filesystem scanning, process spawning, JSON parsing, and image normalization.
- Hono + Socket.IO + SSE: REST inventory/config endpoints, CLI RPC, and live session list patches — extend the current transport split.
- SQLite through the existing Hub store: session model/effort plus small Cursor session policy JSON — no Postgres, Redis, or external cache.
- React 19 + TanStack Query/Router + Tailwind: mobile controls, cached inventory, and session list chips — no frontend framework change.
- `@hapi/protocol` + Zod: single source of truth for model, skill, MCP, session config, patch, and image metadata contracts.

Critical version requirements are mostly "current repo versions." No new packages are recommended. The existing `yaml` dependency can parse skill frontmatter, and the existing generated-image path can carry Cursor MCP screenshots.

### Expected Features

v1.1 should launch with all five requested feature areas because they reinforce one mobile session-control experience. The MVP is not a settings console; it is a session cockpit.

**Must have (table stakes):**
- Dynamic model list discovery from local Cursor CLI, launch-time model picker, and visible current model per session.
- In-session model switch control with explicit applied, pending, failed, or "applies next turn/session" state.
- Session list status/model/effort badges updated through SSE without full-list refetch.
- Read-only skills list with session-level inherited/enabled/disabled policy state.
- Read-only MCP server list with source/transport/status and session-level inherited/enabled/disabled policy state.
- MCP approval cards that show server, tool, and argument summary without weakening approval semantics.
- Inline browser/MCP screenshot rendering with tap-to-zoom or fullscreen mobile viewing.
- Clear degraded states when model, skill, MCP, or image discovery fails.

**Should have after validation:**
- Project-aware remembered defaults for model/effort and common session policies.
- "Deny and disable this MCP for this session" shortcut from approval cards.
- Session list attention sorting for approval, input, and error states.
- Screenshot actions such as copy/share/open and bounded cleanup.
- Skill/MCP source drill-down explaining why something is available.

**Defer to v2+:**
- Mobile skill authoring or editing.
- Mobile MCP config editing with env/secrets.
- Global Cursor settings toggles from the session screen.
- Trusted MCP auto-approval allowlists.
- Multi-user/team dashboards or non-Cursor agents.
- Full desktop IDE replacement on mobile.
- Real-time screenshot/video streaming.

### Architecture Approach

Keep the existing three-layer architecture and make Cursor session controls first-class within it. Inventory belongs near the CLI because models, skill files, and MCP config are local-machine facts. Policy belongs in the Hub store because session toggles must survive reloads, reconnects, and restarts. Presentation belongs in Web hooks/components backed by shared schemas and SSE convergence.

**Major components:**
1. `shared/` protocol — Cursor model, skill, MCP server, session config, status, patch, and image schemas.
2. CLI Cursor runtime — model/MCP/skill discovery, mutable session config application, Cursor spawn args, keepalive state, and screenshot conversion.
3. Hub routes and `SyncEngine` — validated inventory/config endpoints, active-session RPC, SQLite persistence, and strict SSE patches.
4. Web API/hooks/components — TanStack inventory queries, session config mutations, compact session list chips, settings panels, approval cards, and screenshot viewer.
5. SQLite store — existing scalar model/effort columns plus one small `cursor_config` JSON field for session skill/MCP policy.

The strongest architecture pattern is "inventory vs policy." Cursor owns what exists globally or in the project; HAPI owns what this session prefers or suppresses. Do not blur those two layers.

### Critical Pitfalls

1. **UI-only session config** — Make CLI runtime application the acceptance boundary; tests must prove next Cursor turn/spawn uses the selected model/policy.
2. **Hardcoded Cursor models** — Discover models through local Cursor CLI, cache briefly, include selected unknown models for readability, and surface discovery failures.
3. **Global/session skill conflation** — Never edit skill files for mobile toggles; store HAPI session policy and only apply through verified Cursor mechanisms.
4. **MCP config mutation and secret leakage** — Treat MCP config as read-only inventory, redact secret-bearing fields, avoid `agent mcp enable/disable` for session toggles, and timeout discovery.
5. **Contract drift outside `shared/`** — Add Zod schemas first, keep strict patches, and update CLI/Hub/Web fixtures together.
6. **Keepalive/resume overwriting user choices** — Define Hub-owned session config precedence and test restart, reconnect, handoff, and resume.
7. **Screenshot cards technically render but fail on mobile** — Add source metadata, lazy loading, object URL cleanup, fullscreen/zoom, dimensions, and actionable errors.
8. **Reintroducing deleted abstractions** — Keep every addition Cursor-specific and single-user; run repo guards in the integration phase.

## Implications for Roadmap

Based on research, the roadmap should be phased around runtime correctness first, then the two policy domains, then mobile artifact UX, then final integration. This avoids building panels that cannot actually affect Cursor sessions.

### Phase 1: Cursor Runtime Config Contract

**Rationale:** This must come first because model switching, effort metadata, session list badges, skill policy, and MCP policy all depend on a reliable Web -> Hub -> CLI -> Cursor config path.

**Delivers:** Shared Cursor schemas, dynamic model inventory RPC, completed model route, mutable `runCursor` model/effort state, next-turn spawn arg application, keepalive/session-alive reporting, strict patch tests, and compact model/effort/status session list metadata.

**Addresses:** Session launch model picker, in-session model switch control, status/model/effort badges, model discovery failure states.

**Avoids:** UI-only model switching, hardcoded model lists, shared contract drift, keepalive/resume overwrites.

### Phase 2: Skills Visibility and Session Policy

**Rationale:** Skills are file-discovered and already have partial HAPI plumbing, but session toggles need a clear inventory-vs-policy design before UI work.

**Delivers:** Cursor-documented skill root scanning, nested `SKILL.md` discovery, frontmatter parsing, richer skill summaries, Hub-stored disabled skill policy, session-scoped toggle UI, and resume persistence tests.

**Addresses:** Session-level skills visibility, per-session skill enable/disable overrides, inherited vs overridden state indicators, "why is this available?" explanations.

**Avoids:** Editing skill files, React-local toggle state, false claims about hard skill isolation if Cursor lacks a per-session disable API.

### Phase 3: MCP Inventory and Session Policy

**Rationale:** MCP controls carry the highest safety risk because Cursor commands and config are not documented as session-only, and configs can contain secrets.

**Delivers:** Redacted MCP server inventory from project/global/nested config plus best-effort CLI status, discovery timeouts/stale cache, Hub-stored disabled MCP policy, session toggle UI, MCP approval disclosure, and negative tests for secret redaction/no config writes.

**Addresses:** MCP server list/status, per-session MCP policy, MCP tool disclosure before approval, optional "deny and disable for this session" later.

**Avoids:** Editing `mcp.json`, shelling out to global enable/disable for session toggles, leaking env/headers/auth, blocking chat on broken MCP health checks.

### Phase 4: Mobile Browser Screenshot Display

**Rationale:** Screenshot rendering is comparatively isolated and should build on the existing generated-image path after session controls are stable.

**Delivers:** Cursor MCP image result normalization, generated-image registration for screenshot artifacts, mobile screenshot card metadata, lazy loading, retry/error states, tap-to-open fullscreen/zoom viewer, and mobile viewport tests.

**Addresses:** Browser screenshot rendering in timeline, image-safe mobile layout, screenshot-aware tool card.

**Avoids:** Large base64 payload jank, unusable tiny/clipped screenshots, broken image cards after reload without clear error states.

### Phase 5: Integration Guards and Mobile E2E

**Rationale:** The feature set crosses all packages and depends on reconnect/resume behavior, so the final phase should prove the whole mobile workflow rather than only unit slices.

**Delivers:** End-to-end mobile smoke over Tailscale: create session, pick/switch model, verify session list metadata, toggle skill/MCP policy, handle MCP approval, view browser screenshot, reload PWA, resume session. Run `bun run typecheck`, `bun run test`, `bun run madge:check`, and `bash scripts/check-no-cut-agents.sh`.

**Addresses:** Cross-feature state convergence, phone reload/reconnect, guard compliance, and regressions against v1.0 architecture decisions.

**Avoids:** "Looks done but isn't" failures, deleted abstraction regressions, and unverified mobile usability.

### Phase Ordering Rationale

- Shared contracts and runtime config must precede UI because every requested feature crosses CLI, Hub, Web, persistence, and SSE.
- Model switching and session metadata belong together because both use existing model/effort fields and keepalive/patch flows.
- Skills and MCP should be separate phases because their inventory sources, enforcement uncertainty, and security risks differ.
- Screenshots should follow core controls because they use the existing message/artifact path and have less dependency on session policy.
- Integration should be its own phase because restart, reconnect, resume, and mobile viewport behavior are where these features are most likely to drift.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 1:** Confirm the most parseable Cursor model listing command and whether effort/reasoning effort maps to a stable CLI argument.
- **Phase 2:** Verify whether Cursor Agent supports per-invocation or per-session skill suppression; if not, scope toggles as HAPI policy and UI suppression.
- **Phase 3:** Verify whether any Cursor MCP controls are session-scoped; assume config-level until proven otherwise. Confirm `agent mcp list` output shape and redaction needs.
- **Phase 4:** Confirm actual `cursor-ide-browser` MCP image result shape in Cursor stream-json output and decide whether v1.1 requires durable screenshot history after CLI process exit.

Phases with standard patterns where research can be lighter:
- **Phase 1 contract/SSE/store work:** Existing repo patterns are strong; use shared Zod schemas, strict patches, SQLite columns/JSON, and current RPC flow.
- **Phase 5 guard execution:** Commands and repo guard expectations are already documented.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Official Cursor docs and current repo architecture align; no new dependencies needed. |
| Features | HIGH | Target features map clearly to mobile control needs and Cursor documented surfaces; screenshot UX has slightly less formal documentation. |
| Architecture | HIGH | Existing HAPI package boundaries, session config flow, SSE patches, and generated-image path provide clear extension points. |
| Pitfalls | HIGH | Codebase risks are well evidenced; Cursor per-session enforcement semantics remain the main medium-confidence area. |

**Overall confidence:** HIGH for roadmap structure; MEDIUM for hard enforcement claims around per-session skill and MCP toggles.

### Gaps to Address

- **Per-session skill enforcement:** Planning must verify a supported Cursor mechanism. Without one, ship HAPI session policy, UI suppression, and honest limitation text rather than file mutation.
- **Per-session MCP enforcement:** Planning must verify whether Cursor has a session-scoped allow/deny path. If not, do not call global enable/disable from session toggles.
- **Cursor model list output shape:** Prefer a stable JSON/list command if available; otherwise isolate text parsing in CLI with fixtures and explicit failure states.
- **Effort/reasoning effort mapping:** Only expose effort controls that map to real Cursor CLI behavior; do not invent labels.
- **Screenshot durability:** Decide during Phase 4 whether active-session display is enough or Hub-owned/file-backed assets are required for reload/history.
- **Secret redaction:** MCP API design must define exactly which fields are safe before any web route ships.

## Sources

### Primary (HIGH confidence)
- `.planning/research/STACK.md` — recommended technologies, package choices, Cursor CLI/skills/MCP/image stack decisions.
- `.planning/research/FEATURES.md` — table stakes, differentiators, anti-features, dependencies, MVP scope, and prioritization.
- `.planning/research/ARCHITECTURE.md` — package boundaries, data flows, storage, build order, and phase research flags.
- `.planning/research/PITFALLS.md` — critical pitfalls, security mistakes, performance traps, test/guard recommendations.
- Cursor CLI parameters — `https://cursor.com/docs/cli/reference/parameters.md` — model flags, model listing, MCP commands.
- Cursor CLI MCP docs — `https://cursor.com/docs/cli/mcp.md` — MCP list/status/tool/login/enable/disable behavior and config precedence.
- Cursor MCP docs — `https://cursor.com/docs/mcp` — `mcp.json` scopes, transports, auth, image content, and security notes.
- Cursor skills docs — `https://cursor.com/docs/skills` — skill roots, `SKILL.md` format, metadata, automatic/manual invocation.
- HAPI repo docs and code context — `.planning/PROJECT.md`, `.planning/MILESTONES.md`, `README.md`, package READMEs, shared schemas, session config flow, Cursor launcher/runtime, generated-image components.

### Secondary (MEDIUM confidence)
- Cursor customization docs and plugin reference — useful for rules/skills/MCP mental model and plugin packaging, but not central to v1.1.
- Remote-agent UI ecosystem comparisons — used only to validate expectations around model controls, approvals, session status, and mobile screenshot artifacts.

### Tertiary (LOW confidence)
- Browser/screenshot MCP ecosystem examples — useful for UX expectations only; implementation must validate actual `cursor-ide-browser` output in this environment.

---
*Research completed: 2026-05-23*
*Ready for roadmap: yes*
