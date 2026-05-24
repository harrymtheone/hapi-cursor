# Roadmap: HAPI Cursor Edition

## Overview

v1.1 turns the existing Cursor-only Tailscale PWA into a stronger mobile control surface. The milestone starts by making Cursor runtime configuration observable and real, then adds honest session-local policy controls for skills and MCP, then renders browser/image MCP screenshots well on mobile, and finally proves the full flow across reload, reconnect, restart, resume, and the repo's quality gates.

## Milestone

- **v1.1 Cursor mobile features** - Reset numbering starts at Phase 1 for this milestone.
- **Granularity:** fine
- **Requirement coverage:** 20 / 20 v1.1 requirements mapped

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions, if needed later

- [x] **Phase 1: Cursor Runtime Config Contract** - Users can discover, choose, switch, and monitor Cursor model/effort state from mobile. (UAT gaps reopened — gap-closure plans 18-21 added 2026-05-24)
- [x] **Phase 01.1: Model picker UX (CURS-05)** - Family visibility filter, Auto-only new sessions, Cursor Desktop-style in-session model picker. (INSERTED) (completed 2026-05-24)
- [ ] **Phase 2: Skills Visibility and Session Policy** - Users can inspect Cursor skills and set honest session-level skill policy without editing skill files.
- [ ] **Phase 3: MCP Inventory and Session Policy** - Users can inspect redacted MCP servers, set session policy, and understand MCP approvals without mutating global config.
- [ ] **Phase 4: Mobile Screenshot Display** - Users can view and inspect Cursor/browser image MCP results as mobile-friendly screenshot cards.
- [ ] **Phase 5: Integration Guards and Mobile E2E** - The full v1.1 mobile flow survives lifecycle events and passes the milestone quality gates.

## Phase Details

### Phase 1: Cursor Runtime Config Contract

**Goal**: Users can discover available Cursor runtime options, start sessions with selected model/effort, switch models in-session with truthful state, and scan live status from the mobile session list.
**Depends on**: Nothing (first phase)
**Requirements**: CURS-01, CURS-02, CURS-03, CURS-04
**Success Criteria** (what must be TRUE):

  1. User can discover available Cursor models from the local Cursor CLI before launch and sees a clear failure state when discovery fails.
  2. User can start a Cursor session with selected model and effort, then see those values persisted in session metadata.
  3. User can request an in-session model switch and see whether it applied, is pending, failed, or applies on the next run based on real CLI runtime behavior.
  4. User can scan each session's status, model, and effort from the mobile session list as live strict patches arrive.

**Plans**: 21 plans
Plans:
**Wave 1**

- [x] 01-01-PLAN.md — Shared Cursor runtime config schemas and contracts
- [x] 01-09-PLAN.md — Gap closure: live composer runtime switch options
- [x] 01-10-PLAN.md — Gap closure: idle and completion status markers
- [x] 01-11-PLAN.md — Gap closure: reject unsupported effort at Hub spawn boundary
- [x] 01-16-PLAN.md — Gap closure: flip effort-only set-session-config to failed (CURS-02 / WR-01)
- [x] 01-17-PLAN.md — Gap closure: guard late turn-completed after markMessageQueued (CURS-04 / CR-01)
- [x] 01-18-PLAN.md — Gap closure: CLI hot model switch + Web copy + status semantics (CURS-03 / UAT Test 3)
- [x] 01-19-PLAN.md — Gap closure: SessionList global SSE subscription (CURS-04 / UAT Test 5 part 1)
- [x] 01-20-PLAN.md — Gap closure: viewed completion markers localStorage persistence (CURS-04 / UAT Test 5 part 2)
- [x] 01-21-PLAN.md — Gap closure: preserve viewed completion markers during refresh loading render (CURS-04 / UAT Test 6)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 01-02-PLAN.md — CLI launch model and effort wiring
- [x] 01-05-PLAN.md — Selected runtime config launch rejection handling
- [x] 01-14-PLAN.md — Gap closure: block unsupported effort in session-config persistence

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 01-03-PLAN.md — Machine-scoped Cursor model discovery
- [x] 01-15-PLAN.md — Gap closure: remove unsupported effort from CLI runner spawn contract

**Wave 4** *(blocked on Wave 3 completion)*

- [x] 01-04-PLAN.md — Hub model discovery route and RPC wiring
- [x] 01-12-PLAN.md — Gap closure: remove unsupported Web effort mutation
- [x] 01-13-PLAN.md — Gap closure: persist completion markers across refetch

**Wave 5** *(blocked on Wave 4 completion)*

- [x] 01-06-PLAN.md — Web model switch state propagation

**Wave 6** *(blocked on Wave 5 completion)*

- [x] 01-07-PLAN.md — Composer runtime model status UI
- [x] 01-08-PLAN.md — Compact session-list status indicators

**UI hint**: yes

### Phase 01.1: Model picker UX — family visibility filter, Auto-only new sessions, Cursor-style composer picker (CURS-05) (INSERTED)

**Goal:** Users configure which Cursor model families appear in chat, start new sessions on Auto without launch-time model UI, and switch models in-session with a Cursor Desktop-style picker (family + Edit → Options) that still submits one raw runtime model id.
**Requirements**: CURS-05
**Depends on:** Phase 1
**Design**: `.planning/notes/model-picker-ux-design.md`, `.planning/todos/pending/model-picker-ux-implementation.md`, `.planning/sketches/model-picker-ux/` (Variant A)
**Plans:** 3/3 plans complete

**Success Criteria** (what must be TRUE):

  1. User can open Settings → Visible models (`/settings/models`), search and enable/disable model **families** (stored in localStorage); unset filter means all families visible.
  2. User starts a new chat session without choosing a model; spawn uses Auto (no `ModelSelector` on new session).
  3. User switches models in Composer via primary menu (Auto + enabled families) and Edit → Options (Thinking / Fast / Context / Effort), composing a valid raw model id without separate effort API fields.
  4. Composer offers “Manage visible models…” linking to the same settings sub-route.

Plans:

**Wave 1**

- [x] 01.1-01-PLAN.md — Family parser + visible-families localStorage hook (foundation)

**Wave 2** *(depends on 01.1-01)*

- [x] 01.1-02-PLAN.md — `/settings/models` route + Auto-only new session

**Wave 3** *(depends on 01.1-01, 01.1-02)*

- [x] 01.1-03-PLAN.md — ModelPickerOverlay + StatusBar family labels + UAT updates

### Phase 2: Skills Visibility and Session Policy

**Goal**: Users can understand which Cursor skills are available and set session-level skill policy without changing skill files or global Cursor configuration.
**Depends on**: Phase 1
**Requirements**: SKIL-01, SKIL-02, SKIL-03
**Success Criteria** (what must be TRUE):

  1. User can view discovered Cursor skills with source, invocation mode, description, and clear invalid metadata states.
  2. User can set a session skill policy to inherited, enabled, or disabled without editing `SKILL.md` files or global Cursor config.
  3. User can see whether each skill policy is hard-enforced by Cursor or only represented as HAPI session policy.

**Plans**: TBD
**UI hint**: yes

### Phase 3: MCP Inventory and Session Policy

**Goal**: Users can safely inspect MCP availability, set session-level MCP policy, and review MCP approval context without leaking secrets or changing global MCP state.
**Depends on**: Phase 2
**Requirements**: MCP-01, MCP-02, MCP-03, MCP-04
**Success Criteria** (what must be TRUE):

  1. User can view a redacted MCP server inventory with source, transport, status, auth/error state, and no exposed secrets.
  2. User can set session MCP policy to inherited, enabled, or disabled without mutating `mcp.json` or global Cursor MCP state.
  3. User can review MCP approval cards showing server, tool, argument summary, and policy state without changing approval semantics.
  4. User can continue a session when MCP discovery times out or fails, with stale/error state shown instead of blocking the chat.

**Plans**: TBD
**UI hint**: yes

### Phase 4: Mobile Screenshot Display

**Goal**: Users can view Cursor browser and image MCP results as reliable, inspectable screenshot artifacts in the mobile timeline.
**Depends on**: Phase 3
**Requirements**: SHOT-01, SHOT-02
**Success Criteria** (what must be TRUE):

  1. User can view `cursor-ide-browser` or image MCP results inline as mobile screenshot cards.
  2. User can open a screenshot into a larger viewer and zoom or pan without breaking the mobile timeline.
  3. User can retry failed screenshot loads and understand screenshot errors from the card or viewer.

**Plans**: TBD
**UI hint**: yes

### Phase 5: Integration Guards and Mobile E2E

**Goal**: The complete v1.1 mobile control surface remains correct across reload, reconnect, restart, resume, and the repo's verification gates.
**Depends on**: Phase 4
**Requirements**: INTG-01, INTG-02, QUAL-01, QUAL-02, QUAL-03, QUAL-04
**Success Criteria** (what must be TRUE):

  1. Session model, skill policy, and MCP policy survive PWA reload, SSE reconnect, hub restart, and session resume.
  2. Maintainer can verify v1.1 with typecheck, tests, madge, the no-cut-agent guard, and a real or mobile E2E flow.
  3. Maintainer can run a first-class lint gate or point to an explicit documented no-lint decision for this milestone.
  4. Maintainer can generate cli/web coverage with the missing Vitest coverage provider installed and decide whether CI thresholds are needed.
  5. Maintainer can run a Playwright-style mobile E2E smoke or documented equivalent, including an explicit `sseManager` coverage improvement or re-baseline.

**Plans**: TBD
**UI hint**: yes

## Coverage Map

| Requirement | Phase |
|-------------|-------|
| CURS-01 | Phase 1 |
| CURS-02 | Phase 1 |
| CURS-03 | Phase 1 |
| CURS-04 | Phase 1 |
| SKIL-01 | Phase 2 |
| SKIL-02 | Phase 2 |
| SKIL-03 | Phase 2 |
| MCP-01 | Phase 3 |
| MCP-02 | Phase 3 |
| MCP-03 | Phase 3 |
| MCP-04 | Phase 3 |
| SHOT-01 | Phase 4 |
| SHOT-02 | Phase 4 |
| INTG-01 | Phase 5 |
| INTG-02 | Phase 5 |
| QUAL-01 | Phase 5 |
| QUAL-02 | Phase 5 |
| QUAL-03 | Phase 5 |
| QUAL-04 | Phase 5 |

**Coverage:** 20 / 20 v1.1 requirements mapped. No orphaned requirements. No duplicate mappings.

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Cursor Runtime Config Contract | 21/21 | Complete   | 2026-05-24 |
| 2. Skills Visibility and Session Policy | 0/TBD | Not started | - |
| 3. MCP Inventory and Session Policy | 0/TBD | Not started | - |
| 4. Mobile Screenshot Display | 0/TBD | Not started | - |
| 5. Integration Guards and Mobile E2E | 0/TBD | Not started | - |

---

_Roadmap reset for v1.1 Cursor mobile features: 2026-05-23_
