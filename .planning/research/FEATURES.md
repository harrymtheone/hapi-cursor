# Feature Research

**Domain:** Single-user mobile/tablet PWA for remote Cursor Agent control
**Researched:** 2026-05-23
**Confidence:** HIGH for model, skills, MCP, and session metadata behavior; MEDIUM for browser screenshot UX because Cursor's browser MCP surface is less formally documented than the CLI features.

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = phone/tablet control feels weaker than desktop Cursor.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Session launch model picker | Cursor CLI exposes `--model`, `--list-models`, and `agent models`; a remote launcher should not force the desktop default when the phone is the control surface. | MEDIUM | On new session, show current default plus available models from the local Cursor CLI. Persist last selected model per project/workspace if cheap, but keep "Auto/default" as the safe option. Test: launching with a selected model records the model in session metadata and passes it to the Cursor process. |
| In-session model switch control | The project goal explicitly requires session-level model switching, and remote-control users need to correct an underpowered or over-expensive model without abandoning the session. | HIGH | Treat as a session control with visible state, not just a composer command. If Cursor only supports model at process start for a path, UX should say "applies on next turn/relaunch" rather than silently pretending. Test: switch request updates desired model, sends the right control path, and timeline shows success/failure. |
| Compact model/effort/status metadata in session list | Mobile users scan sessions before opening them; status and model answer "which one needs me?" and "what is this costing/using?" | MEDIUM | Show one-line badges: working/waiting/approval/error/ended, model, effort if known. Avoid verbose details in the list; tap opens detail. Existing SSE session patches are the right delivery path. Test: list updates without full refetch when a session changes model/status/effort. |
| Session-level skills visibility | Cursor discovers skills from project and user skill directories and lets Agent decide when relevant; mobile needs to show what the session can use. | MEDIUM | Display discovered skills with name, scope/source, auto/manual mode, and short description. Default state should mirror Cursor's automatic behavior. Test: skills from project/user locations appear read-only, with invalid/missing metadata marked clearly. |
| Per-session skill enable/disable override | Phone control needs a lightweight way to stop a noisy or risky skill for one session without editing files on the dev machine. | HIGH | Toggle should mean "hide/suppress for this HAPI session" rather than rewriting `SKILL.md` or changing global Cursor settings. Default to inherited/auto. Test: disabling one skill affects only the target session and is visible in subsequent prompts/control payloads. |
| MCP server list with connection status | Cursor CLI has `agent mcp list`, `enable`, `disable`, `login`, and `list-tools`; remote users expect at least the same top-level visibility. | MEDIUM | Show server identifier, source (project/global/nested if available), transport, enabled/disabled, connected/error/auth-needed. Do not expose env values. Test: known servers render with status and stale/error states are distinguishable. |
| Per-session MCP server enable/disable override | MCP tools can be powerful or noisy; phone users need a per-task safety switch without changing project config. | HIGH | Like skills, prefer session overlay semantics. The mobile toggle should not rewrite `.cursor/mcp.json` unless the user is deliberately in a settings/admin screen, which is out of scope. Test: disabling a server removes/blocks tools for that session and does not affect other sessions. |
| MCP tool disclosure before approval | Cursor asks for MCP approval by default and shows tool arguments; mobile approval cards must preserve that trust boundary. | MEDIUM | Approval UI should show server, tool, arguments summary, and whether the server is session-enabled. Do not make server toggle imply auto-approval. Test: approval card includes MCP server/tool identity and deny remains available. |
| Browser screenshot rendering in timeline | If `cursor-ide-browser` or similar MCP produces images, phone/tablet users need to see them inline instead of downloading opaque artifacts. | MEDIUM | Render image attachments in message/tool cards with tap-to-zoom, pan, metadata, and fallback download/open. Compress/thumbnail for list/timeline performance. Test: base64/file screenshot result displays on mobile viewport and survives reload if persisted. |
| Image-safe mobile layout | Browser screenshots are often wide desktop captures; mobile UI must make them legible without breaking chat flow. | MEDIUM | Use contained preview, fullscreen lightbox, pinch/zoom or pan, orientation-friendly sizing, and alt metadata. Test: large screenshot does not overflow the viewport or cause composer/session controls to disappear. |
| Clear error and unavailable states | These features depend on local Cursor CLI discovery, skill file parsing, MCP process status, and image payload handling; failures are expected. | LOW | Show "could not list models", "auth required", "server disconnected", "skill metadata invalid", and "image unavailable" as actionable states. Test: failed discovery paths do not block existing chat/session use. |

### Differentiators (Competitive Advantage)

Features that set the product apart. Not required for a basic remote wrapper, but valuable for the project's core value: phone/tablet control close to desktop Cursor.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| One-screen "session cockpit" | A phone user can see current state, model, effort, skills, MCP servers, approvals, and last screenshot without digging through settings. | HIGH | Keep it compact: chips and bottom sheets, not desktop-style panels. Test: common actions fit one-handed on a phone width. |
| Inherited vs overridden state indicators | Prevents confusion between Cursor defaults and HAPI session-local changes. | MEDIUM | Use states like `Inherited`, `Enabled for this session`, `Disabled for this session`. Test: removing override returns to discovered Cursor state. |
| "Why is this available?" explanations | Skills/MCP are context-sensitive; showing source and trigger helps users trust agent behavior remotely. | MEDIUM | For skills: source directory and `paths`/manual-only metadata. For MCP: config source and server transport/status. Avoid exposing secrets. |
| Project-aware defaults | Remember preferred model, effort, and safe MCP/skill toggles per workspace to reduce repeated phone setup. | MEDIUM | Useful after table stakes work. Keep reset/clear simple because single-user local data is acceptable. |
| Quick downgrade/upgrade model action | Mobile rescue action: switch from expensive/slow model to cheaper/faster, or escalate a stuck session. | MEDIUM | Present as explicit model control with timeline note. Avoid hidden automatic model switching. |
| Screenshot-aware tool card | Browser screenshots become a first-class artifact with timestamp, source tool, open-in-new-tab, copy/share affordances, and "ask agent about this screenshot" prompt shortcut. | MEDIUM | Differentiates from terminal-tail-only remote UIs. Keep image storage bounded. |
| Attention routing in session list | Sessions needing approval/input bubble to the top and surface push-notification parity in-app. | LOW | Builds on existing Web Push, SSE, approvals, and session list. Test: approval-needed session sorts/highlights consistently. |
| Safe temporary MCP suppression from approval card | When an MCP tool surprises the user, the same approval surface can deny once and optionally disable that server for this session. | MEDIUM | Valuable on mobile because changing settings mid-task is clumsy. Keep "deny once" as default. |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem useful but would pull the milestone away from single-user mobile remote control.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Mobile skill authoring/editing | Users may want to fix a skill when they notice bad behavior. | Editing multi-file workflow packages on a phone is error-prone and already declared out of scope. It also requires write semantics, validation, and conflict handling. | Read-only skill visibility plus per-session enable/disable; edit skills in Cursor IDE. |
| Mobile MCP config editing with env/secrets | Server is disabled or needs an API key, so editing config sounds convenient. | Exposes secret handling and config mutation in a phone UI; easy to leak env values or break local setup. | Show status, source, auth-needed/error, and session toggle. Use desktop Cursor/terminal for config changes. |
| Global enable/disable toggles from session screen | A global toggle feels simpler than explaining session overlays. | Violates expectation that one experimental mobile task should not change desktop Cursor behavior or other HAPI sessions. | Session-local override with a clear inherited/default state. Put true global settings out of v1.1 scope. |
| Auto-approve all MCPs as a convenience toggle | Fewer phone taps during long-running tasks. | Cursor treats MCP approval like terminal command approval; hiding it behind a broad mobile toggle weakens the safety model. | Keep explicit approvals; maybe allow per-session trusted allowlist later after deeper security review. |
| Multi-user/team dashboards | Remote agent dashboards often market collaboration and multi-session team visibility. | This project is explicitly single-user over Tailscale; adding collaboration reintroduces auth, namespace, rate-limit, and privacy complexity removed in v1.0. | Optimize for one owner, many personal sessions. |
| Support non-Cursor agents again | Other remote-agent tools support many CLIs. | Directly conflicts with Cursor-only fork strategy and guardrails. | Use Cursor-specific controls deeply instead of generic lowest-common-denominator controls. |
| Full desktop IDE replacement on mobile | Phone users may ask for diffs, file editing, terminal multiplexing, and settings parity. | Huge scope and poor mobile ergonomics; existing project has intentionally deferred mobile diff/approval editing. | Treat mobile as control, monitoring, approval, model/skill/MCP steering, and screenshot review surface. |
| Real-time screenshot streaming/video | Looks impressive for browser automation. | High bandwidth/storage cost over mobile, likely unnecessary for task steering, and can degrade PWA responsiveness. | Store/render discrete screenshots produced by MCP tools; add manual refresh/request later if proven useful. |
| Hidden automatic model/skill/MCP optimization | The app could infer the best model/tools. | Users need trust and reproducibility for coding-agent actions; invisible changes make debugging harder. | Make state visible and user-controlled; offer explicit quick actions. |

## Feature Dependencies

```text
Existing remote session launch/resume
    ├──requires──> Session launch model picker
    │                   └──enhances──> In-session model switch control
    ├──requires──> Session metadata persistence
    │                   └──requires──> Session list status/model/effort badges
    └──requires──> Session-level control channel
                        ├──requires──> Skill session overrides
                        └──requires──> MCP session overrides

Existing SSE client updates
    ├──requires──> Live session list metadata updates
    └──requires──> Live MCP/skill/status refresh feedback

Existing approval/control surface
    ├──requires──> MCP tool disclosure before approval
    └──enhances──> Safe temporary MCP suppression from approval card

Existing timeline/messages
    └──requires──> Browser screenshot rendering
                         └──requires──> Image-safe mobile layout

Existing Web Push
    └──enhances──> Attention routing for approval/input sessions

Existing hub/CLI sync and RPC gateway
    ├──requires──> Cursor CLI model discovery
    ├──requires──> Cursor CLI MCP discovery/status
    └──requires──> Local skills filesystem discovery
```

### Dependency Notes

- **Model picker requires Cursor CLI discovery:** Cursor's documented CLI exposes model selection and model listing. HAPI should query the local CLI rather than hardcoding a model list that will drift.
- **Session model switching requires explicit runtime semantics:** If Cursor's active process cannot actually switch model mid-stream, the roadmap should split "desired next turn model" from "restart/resume with model" instead of building a misleading toggle.
- **Skill and MCP toggles require a session overlay model:** Cursor has project/global discovery and settings. HAPI's phone UI should layer per-session enable/disable state on top of that, not mutate files or global Cursor settings.
- **Session list metadata depends on strict patch contracts:** v1.0 already hardened SSE session patches; CURS-04 should extend that contract for status, effort, and model rather than triggering list refetches.
- **Screenshot display depends on timeline artifact handling:** The web app already renders timeline/tool cards; CURS-05 should add image artifact normalization, thumbnails, and fullscreen viewing there.
- **MCP controls depend on approval UI:** Enabling a server means the agent can see/use it, not that every tool call is auto-approved. Approval remains a separate safety gate.

## MVP Definition

### Launch With (v1.1)

Minimum viable milestone slice for the requested Cursor mobile features.

- [ ] Model list discovery from local Cursor CLI, launch-time model picker, and visible current model per session.
- [ ] Model switch control with honest state: applied, pending, failed, or applies-on-next-session.
- [ ] Session list badges for status, model, and effort, updated through SSE without full-list refetch.
- [ ] Read-only skills list with per-session inherited/enabled/disabled state.
- [ ] Read-only MCP server list with status/source/transport and per-session inherited/enabled/disabled state.
- [ ] MCP approval cards that show server/tool identity and arguments summary.
- [ ] Inline screenshot rendering for browser/image MCP results, with tap-to-zoom mobile viewer.
- [ ] Clear unavailable/error states for model, skills, MCP, and image discovery failures.

### Add After Validation (v1.1.x)

Features to add once core behavior is proven on phone/tablet.

- [ ] Project-aware remembered defaults for model/effort and frequently used skill/MCP overrides.
- [ ] "Deny and disable this MCP for this session" shortcut from MCP approval cards.
- [ ] Session list attention sorting for approval/input/error states.
- [ ] Screenshot artifact actions: copy/share/open, ask-agent-about-this-image prompt helper, and bounded cleanup policy.
- [ ] Skill/MCP source drill-down showing relevant `paths`, manual-only setting, config source, and tool inventory.

### Future Consideration (v2+)

Features to defer until the v1.1 control surface proves useful.

- [ ] Global Cursor settings editor for skills/MCP servers; defer because desktop Cursor/terminal are better for durable config changes.
- [ ] Mobile diff/file-edit approval flows; defer until model/skill/MCP control is stable.
- [ ] Trusted per-session MCP auto-run allowlist; requires deeper security and audit design.
- [ ] Active screenshot request/refresh controls for browser MCP sessions; start with rendering artifacts the agent already produces.

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Session list status/model/effort badges | HIGH | MEDIUM | P1 |
| Launch model picker | HIGH | MEDIUM | P1 |
| In-session model switch control | HIGH | HIGH | P1 |
| Skills visibility | HIGH | MEDIUM | P1 |
| Per-session skill toggles | HIGH | HIGH | P1 |
| MCP server visibility | HIGH | MEDIUM | P1 |
| Per-session MCP toggles | HIGH | HIGH | P1 |
| MCP approval disclosure | HIGH | MEDIUM | P1 |
| Browser screenshot inline display | HIGH | MEDIUM | P1 |
| Screenshot fullscreen/mobile viewer | HIGH | MEDIUM | P1 |
| Project-aware remembered defaults | MEDIUM | MEDIUM | P2 |
| Approval-card MCP suppression shortcut | MEDIUM | MEDIUM | P2 |
| Screenshot action menu | MEDIUM | MEDIUM | P2 |
| Session attention sorting | MEDIUM | LOW | P2 |
| Global settings/config editor | LOW | HIGH | P3 |
| MCP auto-approve allowlist | MEDIUM | HIGH | P3 |
| Real-time screenshot streaming | LOW | HIGH | P3 |

**Priority key:**
- P1: Must have for v1.1 because it directly serves CURS-01..05.
- P2: Should have once the main flow is stable.
- P3: Defer; either risky, too broad, or not aligned with single-user mobile control.

## Competitor Feature Analysis

| Feature | Cursor CLI/Desktop Baseline | Comparable Remote Agent UIs | HAPI v1.1 Approach |
|---------|-----------------------------|-----------------------------|--------------------|
| Model selection | Cursor CLI documents `--model`, `--list-models`, and `agent models`. | Remote-agent style tools commonly expose model/mode controls, favorites, and remembered choices. | Dynamic model list from local Cursor CLI; launch picker plus visible session model and explicit switch control. |
| MCP management | Cursor CLI documents `agent mcp list`, `list-tools`, `login`, `enable`, and `disable`; Cursor uses project/global/nested config precedence. | Remote UIs usually focus on approvals/status more than deep MCP config. | Show MCP server status and session-local toggles; keep config editing out of mobile. |
| Skills | Cursor discovers file-backed skills automatically and lets Agent decide or manual `/skill-name` invoke. | Generic remote UIs often lack first-class skill visibility. | Make discovered skills visible and controllable per session, which is a strong Cursor-specific differentiator. |
| Session status | Cursor sessions can be listed/resumed; remote dashboards emphasize idle/working/waiting/approval/error states. | Session-center style tools highlight status and attention states heavily. | Compact mobile badges and attention routing tied to existing SSE/push/approval surfaces. |
| Browser screenshots | MCP/browser tools commonly return screenshots, but mobile clients often treat them as raw artifacts. | Browser bridge tools expose screenshot capture; image display quality varies. | First-class mobile image artifact display in timeline with fullscreen review. |

## Sources

- Cursor CLI Parameters: `https://cursor.com/docs/cli/reference/parameters` — HIGH confidence for model flags, command list, and MCP subcommands.
- Cursor CLI MCP: `https://cursor.com/docs/cli/mcp` — HIGH confidence for MCP list/status/tool/login/enable/disable behavior and config precedence.
- Cursor Agent Skills: `https://cursor.com/docs/skills` — HIGH confidence for skill discovery locations, metadata, automatic/manual invocation, and file format.
- Cursor Learn: Customizing Agents: `https://cursor.com/learn/customizing-agents` — MEDIUM confidence for user-facing distinction between rules, skills, MCP, and CLI tools.
- HAPI Cursor Edition project docs: `.planning/PROJECT.md`, `README.md`, `web/README.md` — HIGH confidence for current project scope, shipped features, constraints, and explicit out-of-scope items.
- Remote-agent and AI-agent-session-center ecosystem search results — LOW/MEDIUM confidence, used only as comparative evidence that remote coding-agent UIs emphasize model/mode controls, notifications, approvals, and visible session status.
- Browser/screenshot MCP ecosystem search results — LOW/MEDIUM confidence, used only to shape screenshot UX expectations; implementation should validate against the actual `cursor-ide-browser` tool result shape in this repo/environment.

---
*Feature research for: Cursor mobile features in HAPI Cursor Edition*
*Researched: 2026-05-23*
