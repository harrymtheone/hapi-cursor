# Stack Research

**Domain:** Cursor mobile session-control features for HAPI Cursor Edition v1.1  
**Researched:** 2026-05-23  
**Confidence:** HIGH for Cursor CLI/MCP/skills documented APIs; MEDIUM for exact semantics of per-session skill/MCP disabling because Cursor documents discovery and global/config toggles, not a dedicated per-session disable API.

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Cursor Agent CLI `agent` | User-installed current CLI | Model listing, model selection, MCP status/enable/disable, stream-json event source | v1.1 should extend the existing CLI wrapper instead of introducing Cursor SDK or a second agent transport. Official CLI parameters include `--model`, `--list-models`, `agent models`, `agent mcp list`, `agent mcp enable`, and `agent mcp disable`. |
| Bun + TypeScript | Bun 1.3.14, TS 5.x | Runtime, scripts, strict shared contracts | Existing repo standard. File scanning, JSON parsing, `spawn`, base64 image handling, and SQLite persistence need no additional runtime. |
| Hono + Socket.IO + SSE | Hono 4.11.2, Socket.IO 4.8.3 | Hub REST routes, CLI RPC, mobile realtime updates | Keep current split: REST for list/read/toggle endpoints, CLI RPC for machine/session-local state, SSE strict patches for session list metadata. |
| SQLite through existing store | Existing `better-sqlite3` store | Persist selected model, effort, session skill toggles, session MCP toggles | Session metadata already carries `model`, `modelReasoningEffort`, `effort`, and strict patch fields. Store small preference objects in the existing session/config surface; do not add a new database or cache. |
| React 19 + TanStack Query/Router + Tailwind | React 19.2.3, TanStack Query 5.90.12, Router 1.143.6, Tailwind 4.1.18 | Mobile UI for model picker, skills/MCP toggles, session list chips, screenshot cards | Existing web stack already handles API cache invalidation, SSE convergence, mobile layout, and assistant-ui integration. New features are forms/cards, not a new frontend framework problem. |
| `@hapi/protocol` + Zod | Zod 4.2.1 | Shared wire contracts | Add models, skills, MCP server descriptors, and toggle payload schemas here first. This preserves the v1.0 decision that shared contracts are the single source of truth and keeps SSE patches strict. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `yaml` | 2.8.2, already in `cli` | Parse `SKILL.md` YAML frontmatter | Use only in the CLI-side skills scanner. Cursor skills are filesystem-local to the dev machine, so the CLI is the right boundary for discovery. No new frontmatter parser needed. |
| `@modelcontextprotocol/sdk` | 1.25.1, already in `cli` | Existing HAPI MCP bridge | Keep for the HAPI bridge. Do not use it to reimplement Cursor's MCP registry; Cursor already owns MCP config and status. |
| Node/Bun `fs`, `path`, `os`, `child_process` | Built in | Read skills/MCP config and spawn Cursor CLI subcommands | Preferred for all new discovery adapters. The data is local and small. |
| Existing generated image pipeline | In repo | Serve Cursor MCP screenshots to mobile | Reuse `generatedImages`, `readGeneratedImage`, `/generated-images/:id`, and `GeneratedImageCard`. Cursor MCP image content is base64 + MIME; converting it to the existing generated-image payload avoids a new media store. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| `bun run typecheck` | Contract and package type safety | Required after adding shared schemas and API client methods. |
| `bun run test` | CLI/web/hub regression suite plus guard | Add focused tests around Cursor CLI arg construction, model list parsing, skills scanning, MCP config parsing, session patch fields, and screenshot normalization. |
| `bun run madge:check` | Circular dependency guard | Important for new web panels because v1.0 intentionally reached 0 cycles. |
| `bash scripts/check-no-cut-agents.sh` | Repo guard | New docs/code must not reintroduce removed agent/runtime literals. |

## Feature-Specific Stack Decisions

### CURS-01: Cursor Session Model Switching

Use the Cursor CLI model APIs, not a hardcoded model table.

| Need | Stack/API | Integration Point | Rationale |
|------|-----------|-------------------|-----------|
| Dynamic model list | `agent models` or `agent --list-models` via CLI-side spawn | New CLI RPC handler, hub route, TanStack Query hook | Cursor's documented CLI exposes model listing. Dynamic discovery avoids stale model IDs and matches the milestone requirement. |
| Start/resume with selected model | Existing `--model <model>` arg | `cursorLocal`, `buildAgentArgs`, runner spawn payload | Already partially wired. Finish by making the selected model part of queued per-turn session config, not a launch-only constant. |
| Active remote session switch | Existing `set-session-config` RPC plus next-turn `--model` | `runCursor` / `CursorRemoteLauncher` / `MessageQueue2<EnhancedMode>` | Remote mode uses print-mode turns, so applying `--model` on the next spawned turn fits current architecture. No need for an always-on Cursor process protocol. |
| UI model picker | Existing composer model controls and `availableModelOptions` | `modelOptions.ts`, session route, session list chips | The web UI already expects custom model options and hides model controls until `supportsModelChange` is true. Flip the Cursor capability once dynamic models exist. |

Do not add the Cursor TypeScript/Python SDK for this. The app is already a local CLI wrapper, and the SDK would introduce a second control plane for a feature the CLI exposes directly.

### CURS-02: Skills Visibility and Session-Level Skill Toggles

Use filesystem discovery plus HAPI session preferences.

| Need | Stack/API | Integration Point | Rationale |
|------|-----------|-------------------|-----------|
| List visible skills | Scan documented skill roots: `.agents/skills/`, `.cursor/skills/`, `~/.agents/skills/`, `~/.cursor/skills/`, plus compatibility roots if needed | CLI RPC `listSkills`; existing hub/web skills route can be extended | Cursor docs state skills are auto-discovered from these directories and each skill is a directory containing `SKILL.md`. CLI-side scan sees the same local filesystem as Cursor Agent. |
| Parse metadata | Existing `yaml` dependency for YAML frontmatter | Small CLI utility returning `{ name, description, source, path, invocationMode }` | Official frontmatter fields are `name`, `description`, `paths`, `disable-model-invocation`, and `metadata`. |
| Session-level toggles | Store HAPI session preference `{ skillName, enabled }`; apply as prompt/session policy | Shared schema + SQLite session config + composer/session settings UI | Cursor documents automatic skill invocation and `disable-model-invocation` in skill files, but not a per-session disable API. Do not mutate user skill files. Treat v1.1 toggles as HAPI session preferences and explicit agent instructions unless later research finds an official per-session API. |
| Manual invocation hints | Cursor slash invocation `/skill-name` | Mobile UI copy/autocomplete | Skills can be manually invoked from slash search. Surface disabled/manual state clearly so the user understands what HAPI is controlling. |

Important limitation: a HAPI toggle cannot honestly promise to stop Cursor from discovering a globally available skill unless HAPI edits/moves that skill or Cursor adds a documented per-session disable mechanism. The roadmap should phrase the v1.1 deliverable as "mobile visibility and session preference/toggle" rather than "hard isolation from Cursor skill discovery" unless deeper phase research proves otherwise.

### CURS-03: MCP Server List and Session-Level Toggles

Use Cursor-owned MCP config and CLI commands. Do not build an MCP registry.

| Need | Stack/API | Integration Point | Rationale |
|------|-----------|-------------------|-----------|
| List configured servers | Read `.cursor/mcp.json` and `~/.cursor/mcp.json`; optionally call `agent mcp list` for status | CLI machine/session RPC, hub route, web settings panel | Cursor docs define project/global `mcp.json` with `mcpServers`. Reading config gives stable names and transport metadata without scraping UI. |
| Server status | `agent mcp list` | CLI-side best-effort parser with fallback to config-only status | Official CLI exposes status listing, but docs do not specify JSON output. Keep parser isolated and tolerant. |
| Enable/disable server | `agent mcp enable <name>` / `agent mcp disable <name>` or slash `/mcp enable|disable <name>` | CLI RPC for machine/global state; session preference table for HAPI UI state | Cursor documents these commands. Confirm during implementation whether they mutate global/project state or only active chat state. Until verified, avoid presenting them as strict per-session isolation. |
| Per-session desired state | Persist HAPI session MCP preferences and apply before next remote turn where possible | `set-session-config`, `MessageQueue2<EnhancedMode>`, runner resume flow | Matches current turn-spawn architecture. If Cursor CLI commands are global, require explicit UI wording because toggling affects Cursor's configured server state. |

Do not add another MCP client, server supervisor, OAuth layer, or marketplace integration. Cursor owns MCP execution and auth; HAPI only needs to show and steer what Cursor already knows.

### CURS-04: Session List Status, Effort, and Model Metadata

Use existing session fields and strict SSE patches.

| Need | Stack/API | Integration Point | Rationale |
|------|-----------|-------------------|-----------|
| Model and effort chips | Existing `SessionSchema.model`, `modelReasoningEffort`, `effort` | `SessionListItem`, composer footer, session patch tests | These fields already exist in shared schemas and are included in `SessionPatchSchema`. |
| Agent status | Existing `active`, `thinking`, `backgroundTaskCount`, lifecycle metadata | Session list view model | Avoid adding a separate status bus. Derive display status from established session fields unless Cursor CLI exposes a richer state later. |
| Realtime updates | Existing SSE `session-updated` strict patch | `useSSE` and TanStack cache | v1.0 specifically hardened this path for new metadata fields. Extend tests rather than creating a second live channel. |

No stack addition needed. This is a UI/view-model and contract-completeness task.

### CURS-05: Mobile Display for `cursor-ide-browser` Screenshots

Reuse Cursor MCP image output and the existing generated-image flow.

| Need | Stack/API | Integration Point | Rationale |
|------|-----------|-------------------|-----------|
| Detect screenshot image output | Cursor MCP tool responses can include `{ type: "image", data: base64, mimeType }` | `cursorEventConverter` tool result normalization | Cursor docs explicitly describe MCP image content as base64 data with MIME type. |
| Persist/read image | Existing in-memory generated image registry plus file RPC | CLI writes base64 to temp/session file, registers image id; hub reads via existing generated-image RPC | Keeps binary transfer out of JSON message bodies after normalization and reuses current authenticated image endpoint. |
| Render on mobile | Existing `GeneratedImageCard` | Assistant message normalization and ToolCard rendering | The web app already has image card UI with object URLs and mobile max-height constraints. |

Do not add S3, object storage, a screenshot microservice, canvas/chart libraries, or image-processing packages. The screenshot is already base64 image data; Bun/Node buffers are sufficient.

## Installation

No new packages recommended for v1.1.

```bash
# No dependency additions expected.
bun install
```

If implementation proves `agent mcp list` output is too unstable to parse, first look for a documented Cursor JSON output flag or machine-readable config file. Add a parser dependency only if Cursor starts emitting non-JSON structured data that cannot be handled safely with existing tools.

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Cursor CLI subcommands and args | Cursor SDK | Only if v1.1 expands into programmatic cloud/local agent lifecycle outside the existing CLI wrapper. Current requirements are exposed by CLI docs. |
| CLI-side filesystem scan for skills | Cursor plugin marketplace API | Only if the product later installs/manages remote skills. v1.1 only needs visibility/toggles for locally discovered skills. |
| Read `mcp.json` + call `agent mcp` | Implement an MCP client/registry in HAPI | Only if HAPI becomes an MCP host. It should not; Cursor is the MCP host. |
| Existing SQLite session preferences | Postgres/Redis/config service | Never for current single-user Tailscale deployment. The data is tiny and local. |
| Existing generated image card | New screenshot viewer dependency | Only if future screenshots require annotation/editing. v1.1 display is an `<img>` problem. |
| Existing REST + SSE | New realtime channel for metadata | Only if metadata becomes high-frequency streaming. Model/effort/status/toggles are low-frequency state changes. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Cursor SDK packages (`@cursor/sdk`, `cursor-sdk`) | Adds another agent lifecycle and auth abstraction while the app is already built around `agent` CLI processes. | Cursor CLI `agent` commands and existing wrapper/RPC. |
| Hardcoded model list | Cursor model IDs change and availability depends on account/CLI. | `agent models` / `--list-models` with a small cache and manual refresh. |
| Editing skill files for toggles | `disable-model-invocation` is source metadata, not a session preference. Mutating user/global skills from mobile is surprising. | Store HAPI session preferences and inject explicit policy; flag hard-disable as unsupported until Cursor exposes an API. |
| Rewriting global MCP config silently | `agent mcp enable/disable` and settings toggles may affect more than one HAPI session. | Show scope clearly, persist desired session state separately, and verify command semantics during implementation. |
| New MCP server supervisor | Cursor already manages MCP server execution and failure isolation. | Query Cursor config/status; let Cursor run servers. |
| External binary/blob storage | Screenshots are local, transient, and single-user. | Existing generated-image registry and authenticated hub route. |
| Platform re-architecture | v1.0 validated Bun/Hono/Socket.IO/SSE/SQLite/React/Tailscale. | Thin adapters and shared schemas inside the current architecture. |

## Stack Patterns by Variant

**If the session is remote/headless:**
- Apply model and MCP/skill preferences before the next spawned `agent -p --output-format stream-json --resume <id>` turn.
- Because remote mode already creates one Cursor CLI process per turn, per-turn args and prompt policy are natural integration points.

**If the session is local/interactive:**
- Treat mobile config changes as persisted preferences and apply on next remote handoff/resume unless a documented slash-command injection path exists.
- Because the current local launcher hands control to the user's terminal process, mobile should not assume it can safely drive stdin for live slash commands without explicit implementation work.

**If a Cursor capability is undocumented or only exposed through UI settings:**
- Prefer read-only visibility plus honest UI wording.
- Because undocumented config mutation is the highest risk area for v1.1 and can surprise the single user by changing their Cursor IDE state.

## Version Compatibility

| Package/API | Compatible With | Notes |
|-------------|-----------------|-------|
| `agent --model`, `agent models`, `--list-models` | Existing `cursorLocal` / `buildAgentArgs` | Official CLI parameters support model selection and listing. Existing code already passes `--model`; missing work is dynamic discovery and active-session update semantics. |
| `agent mcp list/enable/disable` | Cursor MCP config in `.cursor/mcp.json` and `~/.cursor/mcp.json` | Official CLI exposes these commands. Need implementation-time validation of output shape and toggle scope. |
| Cursor skills directories | CLI filesystem scanning with `yaml` | Official docs list skill roots and frontmatter fields. HAPI should scan only the Cursor-relevant roots needed for v1.1 product behavior. |
| MCP image content | Existing generated-image display | Cursor docs specify base64 image `data` and `mimeType` in MCP tool response content. |
| `SessionPatchSchema` | Existing `useSSE` patch convergence tests | `model`, `modelReasoningEffort`, `effort`, `permissionMode`, and `backgroundTaskCount` already patch. Add fields only through `shared/` strict schemas. |

## Sources

- Cursor CLI parameters — `https://cursor.com/docs/cli/reference/parameters.md` — verified `--model`, `--list-models`, `agent models`, `agent mcp list`, `agent mcp enable`, `agent mcp disable`, `--plugin-dir`, `--approve-mcps`. Confidence: HIGH.
- Cursor slash commands — `https://cursor.com/docs/cli/reference/slash-commands.md` — verified `/model`, `/mcp list`, `/mcp enable`, `/mcp disable`, `/rules`, `/commands`. Confidence: HIGH.
- Cursor MCP docs — `https://cursor.com/docs/mcp.md` — verified `mcp.json` locations, stdio/HTTP/SSE transports, config interpolation, settings toggles, and MCP image content shape. Confidence: HIGH.
- Cursor skills docs — `https://cursor.com/docs/skills.md` — verified skill directories, `SKILL.md` format, `paths`, and `disable-model-invocation`. Confidence: HIGH.
- Cursor plugin reference — `https://cursor.com/docs/reference/plugins.md` — verified plugin skill/MCP packaging and discovery. Confidence: MEDIUM for v1.1 relevance; useful only if `--plugin-dir` becomes part of later implementation.
- Project context — `.planning/PROJECT.md`, `.planning/config.json`, `README.md`, package manifests, and current Cursor wrapper/session code. Confidence: HIGH.

---
*Stack research for: v1.1 Cursor mobile features*  
*Researched: 2026-05-23*
