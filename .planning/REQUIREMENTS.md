# Requirements: HAPI Cursor Edition

**Defined:** 2026-05-23
**Milestone:** v1.1 Cursor mobile features
**Core Value:** 让 Cursor Agent 在手机端达到与桌面 Cursor IDE 等同的可用性

## v1.1 Requirements

Requirements for v1.1. Each maps to exactly one roadmap phase.

### Runtime & Models

- [x] **CURS-01**: User can discover available Cursor models from the local Cursor CLI before launch, with a clear failure state.
- [ ] **CURS-02**: User can start a Cursor session with selected model/effort and see those values persisted in session metadata.
- [x] **CURS-03**: User can request an in-session model switch and see applied, pending, failed, or applies-next-run state backed by real CLI runtime behavior.
- [x] **CURS-04**: User can scan session status, model, and effort from the mobile session list, updated live through strict patches.

### Skills

- [ ] **SKIL-01**: User can view discovered Cursor skills with source, invocation mode, description, and invalid metadata states.
- [ ] **SKIL-02**: User can set session-level inherited, enabled, or disabled skill policy without editing skill files or global Cursor config.
- [ ] **SKIL-03**: User can see whether skill policy is hard-enforced by Cursor or only represented as HAPI session policy.

### MCP

- [ ] **MCP-01**: User can view redacted MCP server inventory with source, transport, status, auth/error state, and no secrets.
- [ ] **MCP-02**: User can set session-level inherited, enabled, or disabled MCP policy without mutating `mcp.json` or global Cursor MCP state.
- [ ] **MCP-03**: User can review MCP approval cards showing server, tool, argument summary, and policy state without changing approval semantics.
- [ ] **MCP-04**: User can continue a session when MCP discovery times out or fails, with stale/error state shown.

### Screenshots

- [ ] **SHOT-01**: User can view `cursor-ide-browser` or image MCP results inline as mobile screenshot cards.
- [ ] **SHOT-02**: User can open, zoom/pan, retry, and understand errors for screenshots without breaking the mobile timeline.

### Integration & Quality

- [ ] **INTG-01**: Session model, skill, and MCP policy survives PWA reload, SSE reconnect, hub restart, and session resume.
- [ ] **INTG-02**: Maintainer can verify v1.1 with typecheck, tests, madge, no-cut-agent guard, and a real/mobile E2E flow.
- [ ] **QUAL-01**: Maintainer can run a first-class lint gate or an explicit documented no-lint decision for this milestone.
- [ ] **QUAL-02**: Maintainer can generate cli/web coverage by installing the missing Vitest coverage provider and can decide CI thresholds.
- [ ] **QUAL-03**: Maintainer can run a Playwright-style E2E smoke or documented equivalent for the mobile flow.
- [ ] **QUAL-04**: Maintainer improves or explicitly re-baselines `sseManager` coverage from the v1.0 79.82% line baseline.

## Future Requirements

Deferred until v1.1 proves the core mobile control surface.

### Session Defaults

- **PREF-01**: User can define project-aware remembered defaults for model, effort, and frequent skill/MCP overrides.
- **PREF-02**: User can quickly downgrade or upgrade model from a compact rescue action.
- **PREF-03**: User can sort or highlight sessions by attention state, such as approval needed, input needed, or error.

### MCP Safety Enhancements

- **MCPF-01**: User can choose "deny and disable this MCP for this session" from an MCP approval card.
- **MCPF-02**: User can configure a trusted per-session MCP auto-run allowlist after a deeper security review.

### Screenshot Enhancements

- **SHOTF-01**: User can copy, share, open, or ask the agent about a screenshot artifact.
- **SHOTF-02**: User can request or refresh an active browser screenshot, beyond rendering artifacts the agent already produced.
- **SHOTF-03**: Maintainer can apply automatic screenshot compression if manual E2E evidence becomes routine.

### Documentation & Automation

- **DOCF-01**: Maintainer can publish a Cursor-only standalone user docs site if v1.1 creates enough onboarding material to need one.
- **DOCF-02**: Maintainer can synchronize `AGENTS.md` and `.cursor/rules/` via script or hook if rule drift becomes painful.
- **CIF-01**: Maintainer can support non-GitHub CI only if the project moves away from GitHub-hosted workflows.

## Out of Scope

Explicitly excluded from v1.1.

| Feature | Reason |
|---------|--------|
| Mobile skill authoring or editing | Skill files are maintained from Cursor IDE or terminal; phone UI should expose visibility and policy only. |
| Mobile MCP config/secrets editing | Secret-bearing config belongs in desktop/terminal workflows, not mobile session controls. |
| Global Cursor settings toggles from the session screen | v1.1 policy must be session-local and must not surprise desktop Cursor or other sessions. |
| Trusted MCP auto-approval in v1.1 | Approval semantics stay explicit until a separate security design exists. |
| Non-Cursor agent support | Conflicts with the Cursor-only fork strategy and repo guards. |
| Multi-user/team dashboards | Conflicts with the single-user Tailscale deployment model. |
| Full mobile IDE replacement | v1.1 is a control and review surface, not mobile file editing/diff review. |
| Real-time screenshot/video streaming | Discrete MCP screenshot artifacts are enough for this milestone; streaming risks mobile performance and storage complexity. |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| CURS-01 | Phase 1 | Complete |
| CURS-02 | Phase 1 | Pending |
| CURS-03 | Phase 1 | Complete |
| CURS-04 | Phase 1 | Complete |
| SKIL-01 | Phase 2 | Pending |
| SKIL-02 | Phase 2 | Pending |
| SKIL-03 | Phase 2 | Pending |
| MCP-01 | Phase 3 | Pending |
| MCP-02 | Phase 3 | Pending |
| MCP-03 | Phase 3 | Pending |
| MCP-04 | Phase 3 | Pending |
| SHOT-01 | Phase 4 | Pending |
| SHOT-02 | Phase 4 | Pending |
| INTG-01 | Phase 5 | Pending |
| INTG-02 | Phase 5 | Pending |
| QUAL-01 | Phase 5 | Pending |
| QUAL-02 | Phase 5 | Pending |
| QUAL-03 | Phase 5 | Pending |
| QUAL-04 | Phase 5 | Pending |

**Coverage:**
- v1.1 requirements: 19 total
- Mapped to phases: 19
- Unmapped: 0

---
*Requirements defined: 2026-05-23*
*Last updated: 2026-05-23 after v1.1 roadmap creation*
