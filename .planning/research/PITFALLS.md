# Pitfalls Research

**Domain:** Cursor mobile control features for HAPI Cursor Edition
**Researched:** 2026-05-23
**Confidence:** HIGH for codebase integration risks; MEDIUM for Cursor CLI behavior that must be rechecked during implementation

## Critical Pitfalls

### Pitfall 1: Treating Session Config as a UI-Only Setting

**What goes wrong:**
The mobile UI appears to switch model, effort, skills, or MCP servers, but the next Cursor turn still runs with stale runtime state. This is especially likely for CURS-01 because the current web and hub layers already expose model fields, while the live Cursor handler only applies permission mode.

**Why it happens:**
Existing plumbing is partial: `SessionConfigService` persists and broadcasts model/effort fields, `SessionPatchSchema` accepts them, and the composer has model handlers. But `runCursor` currently stores `currentModel` as an immutable startup value and its `set-session-config` RPC path only applies `permissionMode`. A roadmap phase that stops at REST + SSE will produce optimistic UI without real agent behavior.

**How to avoid:**
Make runtime application the acceptance boundary. Update the session RPC handler, message queue mode hashing, keepalive payload, and `CursorRemoteLauncher` spawn args together. For model changes, verify the next queued message spawns `agent -p ... --model <selected>` or intentionally returns a clear unsupported/error state. For effort and reasoning effort, only expose values that are proven to map to Cursor CLI behavior.

**Warning signs:**
- Tests only assert REST responses or TanStack cache updates.
- `set-session-config` returns `{ applied: { permissionMode } }` but omits model/effort.
- A model dropdown changes labels, but `buildAgentArgs()` tests do not cover changed model values after session start.
- `session-alive` reverts the UI to the old model after the next keepalive.

**Phase to address:**
Phase 1: Session Runtime Config Contract. This should precede all mobile UI work.

---

### Pitfall 2: Hardcoding Cursor Models Instead of Discovering Them

**What goes wrong:**
The phone UI offers stale or invalid model names. Users can select a model that Cursor no longer accepts, or miss newly available models. The failure appears only on the next turn and is hard to distinguish from a normal agent failure on mobile.

**Why it happens:**
Cursor CLI exposes current model discovery through `agent models` / `--list-models`, while the existing web model options intentionally return an empty list unless custom options are provided. The milestone explicitly requires dynamic local Cursor CLI discovery, not baked-in `sonnet / opus / composer / auto` labels.

**How to avoid:**
Add a machine-scoped RPC for model discovery, not a web-only constant. Cache briefly with explicit refresh, normalize `auto/default/null`, and include the currently selected model even if it is no longer in the latest list so old sessions remain readable. Validate model selection against the discovered list unless the CLI reports discovery failure, in which case expose a degraded state and block arbitrary input.

**Warning signs:**
- New model names appear in `web/src/components/AssistantChat/modelOptions.ts`.
- Tests use only fake static arrays and never exercise a CLI discovery failure.
- The UI lets users type arbitrary model strings.
- Model errors surface only as generic `Cursor Agent failed` messages in chat.

**Phase to address:**
Phase 1: Session Runtime Config Contract, with CLI discovery included before CURS-01 UI polish.

---

### Pitfall 3: Conflating Global Cursor Skills with Session-Level Skill Toggles

**What goes wrong:**
The mobile app claims to enable or disable one skill for one HAPI session, but the implementation mutates global/project skill files or Cursor-wide settings. A quick mobile toggle then changes desktop Cursor behavior, affects unrelated sessions, or is lost when the session resumes.

**Why it happens:**
Cursor skills are file-discovered from project and user directories, can be nested/scoped, and can disable automatic invocation via skill metadata. The repo already has a `listSkills` RPC shape, but no session-level skill policy in shared contracts. It is tempting to reuse filesystem changes because skills are file-based, but the requested feature is session-level visibility/toggle control, not authoring or editing skills.

**How to avoid:**
Represent session skill policy as HAPI-owned session config, separate from Cursor's skill source of truth. Read skills from Cursor-discovered locations for display, but apply toggles at turn construction time through a deterministic prompt/config layer that says which skills are allowed, disabled, or explicitly visible for this HAPI session. Do not write `SKILL.md` or skill frontmatter from mobile.

**Warning signs:**
- Mobile code edits `.cursor/skills/`, `.agents/skills/`, or user skill directories.
- Toggle state lives only in React local state.
- Skill toggles are stored in machine metadata instead of session state.
- Resuming a session loses disabled skills.

**Phase to address:**
Phase 2: Skills Visibility and Session Policy.

---

### Pitfall 4: Implementing MCP Toggles by Editing `mcp.json`

**What goes wrong:**
A phone toggle changes global/project MCP availability for every Cursor session, breaks editor-side MCP setup, or accidentally exposes secrets in hub/web payloads. A failed MCP server can also block the session list or composer if the UI waits on live MCP health too aggressively.

**Why it happens:**
Cursor CLI uses the same MCP configuration as the editor and supports `agent mcp list`, `list-tools`, `enable`, and `disable`. Cursor MCP config may include command args, env interpolation, headers, OAuth/static auth, and multiple scopes. HAPI is local-first and single-user, but it should still avoid becoming an MCP config editor or secret relay.

**How to avoid:**
Treat Cursor MCP config as read-only inventory for v1.1. For session-level toggles, keep a HAPI session policy that filters/approves MCP use for a session without rewriting `.cursor/mcp.json` or `~/.cursor/mcp.json`. Redact command args/env/headers in web responses. Design discovery as best-effort with timeout and cached stale data; failed MCP discovery should show "unavailable" not block chat.

**Warning signs:**
- Web responses include raw MCP `env`, `headers`, `auth`, or full command strings.
- Implementation shells out to `agent mcp enable/disable` for a per-session toggle.
- MCP list fetch runs on every render or every SSE heartbeat.
- Tests only cover happy-path stdio servers, not OAuth/HTTP/SSE or broken servers.

**Phase to address:**
Phase 3: MCP Inventory and Session Policy.

---

### Pitfall 5: Expanding Wire Contracts Outside `shared/`

**What goes wrong:**
CLI, hub, and web each gain slightly different shapes for models, skills, MCP servers, screenshot blocks, or session metadata. The feature works in one path but fails after reconnect, resume, cache patching, or test fixture updates.

**Why it happens:**
v1.0 deliberately made `shared/` the only wire contract source and strict `SessionPatchSchema` rejects unknown patch keys. CURS-01..05 all require new cross-package contracts, so local type definitions will fight the existing architecture.

**How to avoid:**
Add Zod schemas and exported protocol types in `shared/` first, then consume them in CLI, hub, and web. Keep strict patching. For new session summary fields, update `SessionSchema`, `SessionPatchSchema`, `SessionSummary` derivation, SSE tests, hub fixtures, and web cache patchers together.

**Warning signs:**
- New `type SkillSummary` or `type McpServer` appears only under `web/src/types`.
- `SessionPatchSchema` is loosened with `.passthrough()` or unknown-key fallbacks.
- Test fixtures duplicate fields by hand in multiple packages.
- A feature requires full session refetch because patch support was skipped.

**Phase to address:**
Phase 1: Session Runtime Config Contract, then enforced in every feature phase.

---

### Pitfall 6: Letting Keepalive and Resume Overwrite User Choices

**What goes wrong:**
The user switches model or toggles a skill/MCP server, sees success, then a later keepalive, reconnect, local/remote handoff, or resume silently restores old state.

**Why it happens:**
Session state is updated from multiple places: REST config routes, CLI `set-session-config` RPC, `session-alive`, `bootstrapExistingSession`, and resume target resolution. Existing liveness logic writes model/effort when payload fields are present, and resume preserves selected fields. New settings must define the same precedence rules.

**How to avoid:**
Define a single ownership rule: web requests update hub session config, hub requests active CLI application, CLI keepalive reports applied runtime state, and hub only accepts keepalive fields that reflect the active runtime. For resume, pass session config into spawned/resumed sessions and test round trips through hub restart and phone reconnect.

**Warning signs:**
- `session-alive` sends stale `model` from startup.
- Resume code passes model but not skill/MCP policy.
- Handoff tests cover permission mode but not model/skills/MCP.
- A field is persisted but absent from liveness broadcasts.

**Phase to address:**
Phase 1: Session Runtime Config Contract, with regression tests reused by Phases 2 and 3.

---

### Pitfall 7: Treating Browser Screenshots as Generic Generated Images Only

**What goes wrong:**
cursor-ide-browser screenshots technically render, but are hard to use on a phone: tiny, clipped, memory-heavy, impossible to zoom, or indistinguishable from ordinary generated images. Large base64 payloads can also make chat normalization and mobile scrolling feel broken.

**Why it happens:**
The web already has a generated-image pipeline that fetches blobs and renders `<img>` with a max height. Cursor MCP can return images as context, and browser screenshot tools may return full-page PNGs that are much wider/taller than normal generated images. Reusing the existing card without mobile affordances under-delivers CURS-05.

**How to avoid:**
Keep the shared image block, but add screenshot-aware presentation metadata when the source tool is cursor-ide-browser/browser screenshot. Provide tap-to-open, pan/zoom or full-screen viewing, dimensions/file size display, retry/error states, and object URL cleanup. Add size caps or downscaling decisions at the CLI/hub boundary if images are too large for mobile.

**Warning signs:**
- Only desktop viewport screenshots are tested.
- The image card has no full-screen or zoom path.
- Full-page screenshots are loaded eagerly in long chat history.
- Blob errors display raw `HTTP 500` without actionable context.

**Phase to address:**
Phase 4: Mobile Browser Screenshot Display.

---

### Pitfall 8: Reintroducing Deleted Multi-Agent or Multi-User Abstractions

**What goes wrong:**
Small feature additions bring back flavor branching, namespace-like policy layers, non-Cursor agent names, or SaaS-style authorization just to support settings. This increases maintenance cost and may trip repo guards.

**Why it happens:**
Skills and MCP are naturally multi-tool concepts, and model switching examples often mention other agent ecosystems. The repo has strong v1.0 decisions: Cursor-only, single-user, Tailscale-only, no namespace, no other agent runtimes, no backward compatibility.

**How to avoid:**
Keep every new contract anchored to `cursor` and single-user local control. Add capability checks through the existing cursor-only `FLAVOR_CAPS` pattern when needed, but do not generalize toward deleted agents. Run `scripts/check-no-cut-agents.sh` as part of each feature phase.

**Warning signs:**
- New files mention removed agent/runtime/channel names.
- New auth scopes, namespace columns, or per-user toggle tables appear.
- Feature code adds abstractions "for future agents".
- MCP/skill policies are keyed by user instead of session.

**Phase to address:**
All phases, enforced by Phase 5: Integration Guards and Mobile E2E.

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Static model list in web | Fast CURS-01 demo | Stale model choices and confusing runtime failures | Never for final; only acceptable in a throwaway spike |
| Session-level skill toggles stored in local React state | No schema/store work | Lost on refresh/resume and impossible to apply in CLI | Never |
| Editing `.cursor/mcp.json` for session toggles | Uses Cursor's existing enable/disable commands | Mutates global/project behavior and risks leaking secrets | Never for session-level control |
| Full session refetch for every new metadata field | Avoids patch plumbing | Slow mobile list, battery/network waste, regressions from v1.0 strict SSE work | Only as temporary debug instrumentation |
| Reusing generated-image card unchanged for screenshots | Minimal CURS-05 code | Poor mobile usability and memory pressure | Acceptable only for first proof-of-data-flow test |
| Adding web-only types for new contracts | Faster UI compile | CLI/hub/web contract drift | Never |

## Integration Gotchas

Common mistakes when connecting the new surfaces to Cursor and the existing HAPI layers.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Cursor model selection | Calling REST `setModel` but not updating live `runCursor` state | Apply model in the session RPC handler and verify next agent spawn args |
| Cursor model discovery | Shipping hardcoded names | Discover through local Cursor CLI (`agent models` / `--list-models`) via machine RPC, cache, and handle failure |
| Cursor skills | Treating skill files as toggle storage | Read discovered skills for display; store HAPI session policy separately |
| Cursor MCP | Shelling out to `agent mcp enable/disable` for per-session toggles | Use Cursor MCP commands for inventory/diagnostics, not HAPI session policy mutation |
| SSE patches | Adding fields without shared schema updates | Extend `shared` schemas and web patchers in the same phase |
| Resume/handoff | Passing only permission mode | Pass and verify the full runtime config/policy set |
| Screenshot images | Assuming all images fit message cards | Add mobile screenshot viewer behavior and lazy loading |

## Performance Traps

Patterns that work on a desktop but feel broken on phone/tablet.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Running model/MCP/skill discovery on render | Slow sidebar, spinners, battery drain | Query with TanStack cache, manual refresh, bounded RPC timeout | Immediately on mobile over Tailscale |
| Broadcasting full sessions for every config heartbeat | Session list jank and unnecessary SSE traffic | Use strict patches for small field changes | Several active sessions or flaky reconnect |
| Loading screenshot blobs eagerly in chat history | Scroll stalls, memory pressure, tab reloads | Lazy load visible images; revoke object URLs; offer full-screen fetch on demand | Long sessions with multiple screenshots |
| Large full-page screenshots with no cap | Blank images or mobile browser OOM | Capture dimensions/size metadata, downscale when needed, show download/open fallback | High-DPI full-page browser captures |
| Blocking chat on MCP health checks | Composer unavailable because one MCP server hangs | Discovery timeout + stale cache + degraded labels | Any broken OAuth/remote MCP server |

## Security Mistakes

Domain-specific security issues beyond general web security.

| Mistake | Risk | Prevention |
|---------|------|------------|
| Returning raw MCP config to web | Secrets in `env`, headers, auth, command args exposed through browser/devtools | Redact all secret-bearing fields; expose only name, source, transport, status, tool summaries |
| Running arbitrary MCP management commands from web input | Command injection or accidental global config mutation | Use fixed command argv, validated identifiers, no shell, and prefer read-only inventory |
| Treating Tailscale as permission to skip validation | Bad local requests can still corrupt session state | Keep Zod validation and shared schemas for all new routes |
| Persisting screenshots indefinitely without thought | Sensitive browser state remains in chat storage/cache | Reuse existing generated image access controls; consider expiry/cleanup and clear source labels |
| Auto-approving all MCPs to make toggles feel easy | Unexpected tool execution and local data exposure | Keep approval semantics explicit; session toggles should reduce available tools, not silently increase approvals |

## UX Pitfalls

Common mobile experience mistakes for these features.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Model switch has no applied/pending/error state | User cannot tell whether next turn uses new model | Show selected, applied, and failed states tied to CLI acknowledgement |
| Skills/MCP lists show too much raw technical detail | Phone UI becomes a config dump | Show concise name/status/toggle first; details behind disclosure |
| Session list metadata overcrowds title row | Hard to scan sessions on phone | Use compact chips for status/model/effort and wrap lower-priority fields |
| Hidden stale data after reconnect | User trusts wrong status/model | Mark stale discovery data and provide refresh |
| Screenshot card lacks zoom/open controls | Screenshot is technically visible but useless | Tap-to-open viewer with zoom/pan and dimensions |
| Errors only appear in console | Mobile user sees silent failure | Surface route/RPC errors as inline toasts or card states |

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **CURS-01 model switching:** UI changes model label, but next Cursor process spawn was not asserted with changed `--model`.
- [ ] **CURS-01 discovery:** Model list loads from static web options, not local Cursor CLI discovery.
- [ ] **CURS-02 skills:** Skills are listed, but toggles do not affect the next turn or persist through resume.
- [ ] **CURS-02 skills:** Toggle implementation edits skill files or global settings.
- [ ] **CURS-03 MCP:** MCP list displays configured servers, but secrets are not redacted in API responses.
- [ ] **CURS-03 MCP:** Session toggle calls global `agent mcp enable/disable`.
- [ ] **CURS-04 session list metadata:** Detail view updates, but `SessionSummary`/SSE patch path does not update the sidebar.
- [ ] **CURS-04 status:** Runner/session status is inferred only from `thinking`, not active/lifecycle/runner state.
- [ ] **CURS-05 screenshots:** Images render in chat, but no mobile zoom/full-screen path exists.
- [ ] **Integration:** Hub restart + phone reconnect + resume not tested with model/skill/MCP policy.
- [ ] **Guards:** `bun run typecheck`, `bun run test`, `bun run madge:check`, and `scripts/check-no-cut-agents.sh` not run for the final integration phase.

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| UI-only model switch | MEDIUM | Move model ownership into shared session config; update live RPC handler; add spawn-arg regression test |
| Static invalid model list shipped | LOW | Replace options source with CLI discovery; keep selected unknown model as read-only current value |
| Global MCP config mutated by session toggle | HIGH | Stop writing config; restore user/project `mcp.json` from git/backup; migrate desired state into session policy |
| Skill files edited by mobile | MEDIUM | Revert file edits; create HAPI-owned policy store; add guard/test preventing writes from toggle route |
| Contract drift across packages | MEDIUM | Delete duplicate local types; add shared schemas; run typecheck/tests package-wide |
| Screenshot card unusable on phone | LOW/MEDIUM | Add source metadata and mobile viewer; lazy load old screenshot blobs |
| Secret leaked in MCP response | HIGH | Redact immediately, rotate affected token if needed, add negative tests asserting secret absence |

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| UI-only session config | Phase 1: Session Runtime Config Contract | Unit/integration test: web config request updates hub, active CLI runtime, keepalive, and next spawn args |
| Stale hardcoded model list | Phase 1: Session Runtime Config Contract | Machine RPC test for discovery success/failure; UI uses discovered options |
| Skill global/session conflation | Phase 2: Skills Visibility and Session Policy | Resume test proves per-session skill policy persists without editing skill files |
| MCP config mutation/secrets | Phase 3: MCP Inventory and Session Policy | API tests assert redaction and no writes to `mcp.json`; broken MCP discovery degrades gracefully |
| Shared contract drift | Phase 1 and every feature phase | New fields live in `shared`; strict schema tests reject unknown fields |
| Keepalive/resume overwrite | Phase 1, reused in Phases 2-3 | Handoff/resume/reconnect integration tests cover full config and policy |
| Mobile screenshot usability | Phase 4: Mobile Browser Screenshot Display | Mobile viewport tests for screenshot card, zoom/open path, loading/error states |
| Reintroduced deleted surfaces | Phase 5: Integration Guards and Mobile E2E | `check-no-cut-agents.sh`, `madge:check`, typecheck/test, and manual Tailscale phone E2E |

## Recommended Guard and Test Additions

| Guard/Test | Why It Matters | Phase |
|------------|----------------|-------|
| `buildAgentArgs()` mid-session model regression | Prevents CURS-01 from being a label-only feature | Phase 1 |
| `set-session-config` contract test for model/effort/policy | Proves CLI actually acknowledges applied config | Phase 1 |
| SSE patch convergence test with new metadata fields | Protects mobile sidebar after reconnect/patch loss | Phase 1 and Phase 4 |
| Skill policy persistence test across resume | Prevents session toggles from becoming local UI state | Phase 2 |
| MCP API redaction negative test | Prevents local secrets from reaching web payloads | Phase 3 |
| MCP discovery timeout/error test | Prevents one broken server from blocking mobile control | Phase 3 |
| Screenshot mobile viewport/component test | Ensures CURS-05 is usable on phone/tablet, not just rendered | Phase 4 |
| Manual Tailscale phone E2E script update | Validates real mobile UX under the deployment model | Phase 5 |
| Repo guard run: no deleted agents/channels | Keeps v1.0 scope decisions durable | Phase 5 |

## Sources

- Project context: `.planning/PROJECT.md` and `.planning/MILESTONES.md` (HIGH confidence)
- Repo constraints: `AGENTS.md` (HIGH confidence)
- Existing code surfaces reviewed: shared schemas, session config/liveness, web session list/chat, Cursor launcher/runtime, generated-image rendering (HIGH confidence)
- Cursor CLI parameters: `https://cursor.com/docs/cli/reference/parameters.md` (HIGH confidence)
- Cursor CLI MCP commands: `https://cursor.com/docs/cli/mcp.md` (HIGH confidence)
- Cursor MCP configuration, transports, images, and security notes: `https://cursor.com/docs/mcp` (HIGH confidence)
- Cursor Agent Skills discovery and metadata: `https://cursor.com/docs/skills` (HIGH confidence)

---
*Pitfalls research for: Cursor mobile features in HAPI Cursor Edition*
*Researched: 2026-05-23*
