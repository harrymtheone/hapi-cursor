---
gsd_state_version: 1.0
milestone: v1.1
milestone_name: Cursor mobile features
status: gaps_found
stopped_at: Phase 01 verification found implementation gaps
last_updated: "2026-05-23T17:46:31Z"
last_activity: 2026-05-23
progress:
  total_phases: 5
  completed_phases: 0
  total_plans: 10
  completed_plans: 10
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-23 after v1.1 milestone start)

**Core value:** 让 Cursor Agent 在手机端达到与桌面 Cursor IDE 等同的可用性
**Current focus:** Phase 01 — cursor-runtime-config-contract gap closure

## Current Position

Phase: 01 (cursor-runtime-config-contract) — GAPS FOUND
Plan: 10 of 10
Status: Verification gaps found
Last activity: 2026-05-23

Progress: [██████████] 100%

## Performance Metrics

**Velocity:**

- Total plans completed: 3
- Average duration: 4min
- Total execution time: 0.18 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1. Cursor Runtime Config Contract | 3/8 | 11min | 4min |
| 2. Skills Visibility and Session Policy | TBD | - | - |
| 3. MCP Inventory and Session Policy | TBD | - | - |
| 4. Mobile Screenshot Display | TBD | - | - |
| 5. Integration Guards and Mobile E2E | TBD | - | - |

**Recent Trend:**

- Last 5 plans: 01-01 (2min), 01-02 (4min), 01-05 (5min)
- Trend: baseline

*Updated after each plan completion*

| Phase 01 P05 | 5min | 2 tasks | 9 files |
| Phase 01 P03 | 6min | 2 tasks | 10 files |
| Phase 01 P04 | 6min | 2 tasks | 8 files |
| Phase 01 P06 | 10min | 2 tasks | 9 files |
| Phase 01 P07 | 6min | 2 tasks | 8 files |
| Phase 01 P08 | 8min | 2 tasks | 13 files |
| Phase 01 P09 | 4min | 2 tasks | 5 files |
| Phase 01 P10 | 8min | 2 tasks | 16 files |

## Accumulated Context

### Decisions

Full decision log archived in `PROJECT.md` Key Decisions table and per-phase `DISCUSSION-LOG.md` files under `.planning/milestones/v1.0-phases/`.

Recent decisions affecting current work:

- v1.1 reset numbering starts at Phase 1 for this milestone.
- Runtime config comes first so model/effort/session metadata is real before policy and UI surfaces depend on it.
- Skills and MCP are separate phases because their discovery, enforcement, and safety risks differ.
- Integration/quality requirements close the milestone in Phase 5 after feature slices exist.
- [Phase 01]: Use enumerated safe runtime config failure reasons so raw Cursor CLI stderr cannot enter normal UI contracts.
- [Phase 01]: Keep Cursor model ids as unconstrained non-empty strings instead of shipping a static model catalog.
- [Phase 01]: Run Cursor model discovery only through local agent models and return safe categorized failures. — Preserves runtime truth and avoids static model catalogs.
- [Phase 01]: Expose model discovery as a machine-scoped RPC because discovery happens before session launch. — A session-scoped handler cannot serve the new-session panel before launch.
- [Phase 01]: Preserve auto launch failures while labeling explicit selected runtime rejection with selected-runtime-config-rejected. — Selected config rejection must be clear without silently falling back to auto.
- [Phase 01]: Report active model and effort changes as applies-next-run until HAPI has a proven hot-switch control path. — Preserves runtime truthfulness until a verified control path exists.
- [Phase 01]: Preserve permission-mode config on the existing applied response path while model and effort use the shared status contract. — Avoids widening the shared schema after a CRITICAL file-level impact check.
- [Phase 01]: Inactive model route requests persist metadata as applies-next-run state through the engine path. — Inactive sessions cannot acknowledge active runtime changes, but metadata can be queued for the next run.
- [Phase 01]: Keep machine-scoped Cursor model discovery behind the authenticated Hub machine route and delegate through SyncEngine/RpcGateway. — Preserves architecture and avoids direct Hub shell execution.
- [Phase 01]: Cache Cursor model discovery results for 30000ms per machine id and sanitize rejected request errors. — Prevents repeated runtime discovery and keeps raw transport details out of UI state.
- [Phase 01]: Keep auto as a selector-only sentinel and pass undefined unless the user selects a discovered raw Cursor model id. — Preserves unspecified launches and prevents sending auto as a model id.
- [Phase 01]: Map only selected-runtime-config-rejected to launch rejection copy. — Web does not parse stderr or generic process output to infer runtime rejection.
- [Phase 01]: Preserve Hub truth for Web model switching by returning CursorRuntimeConfigApplyResult through ApiClient.setModel and useSessionActions.setModel.
- [Phase 01]: Keep model switch feedback in SessionChat composer/status state rather than chat timeline messages.
- [Phase 01]: Map runtime failure reasons through localized safe copy before rendering switch status.
- [Phase 01]: Use runtimeModelSwitchSupported as the authoritative hot-switch capability gate for composer model selector access.
- [Phase 01]: Keep the composer model box read-only by default and open selector only when runtime support, approved options, and idle state are all true.
- [Phase 01]: Preserve failed model switch retry targets in composer switch state instead of adding timeline events.
- [Phase 01]: Derive session-list attention state from shared statusKind/completionMarker/errorMarker summary fields. — Session rows need a compact live status source while model/effort remain composer-adjacent.
- [Phase 01]: Keep completed-session read state local to Web and keyed by session id plus completion marker. — Read state is local UI state, and the marker key lets later completed results become unread again.
- [Phase 01]: Merge strict SSE status marker patches directly into TanStack summary caches without adding malformed-event refetch fallback. — Preserves strict patch rejection while keeping runtime status fields live.
- [Phase 01]: Use session machine id as the live-session Cursor model discovery key. — Keeps composer runtime options tied to the authenticated machine-scoped discovery path.
- [Phase 01]: Expose live composer model switching only for ok, non-empty Cursor discovery results. — Loading, error, missing machine id, and empty discovery states remain truthfully unavailable.
- [Phase 01]: Preserve Auto as a null selector sentinel while passing raw Cursor model ids through the live composer selector. — Prevents synthesizing static catalog values or sending the literal "auto".
- [Phase 01]: Treat active runner liveness as connection state only; real turn work is thinking, waiting, or background-task activity. — Prevents idle connected Cursor sessions from rendering as busy spinners.
- [Phase 01]: Classify existing role-wrapped agent ready events as turn-completed activity instead of adding a new CLI event type. — Uses the existing trusted ready-event path and avoids widening the wire protocol.
- [Phase 01]: Keep completed-marker read state local to Web; Hub only emits completionMarker values for runtime truth. — Read/viewed state is local UI state while completion markers are runtime status truth.

### Pending Todos

None yet.

### Blockers / Concerns

No blockers. Research flags remain for phase planning: Cursor model list output, per-session skill enforcement, per-session MCP enforcement, and screenshot result shape.

## Deferred Items

Items acknowledged and carried forward from previous milestone close:

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| Code quality | `reducerTimeline.ts` decomposition | Non-blocking carry-forward | v1.0 close |
| Shared contract | Cursor permission-mode helper promotion to `shared/` | Non-blocking carry-forward | v1.0 close |
| Quality gate | Lint not enforced in CI | Covered by v1.1 QUAL-01 | v1.0 close |
| Backlog | M2-BL-01..10 | Review during phase planning as needed | v1.0 close |

## Session Continuity

Last session: 2026-05-23T17:01:49.093Z
Stopped at: Completed 01-10-PLAN.md
Resume file: None

---

*Note: v1.0 detail lives in `.planning/milestones/v1.0-phases/` and milestone archives. v1.1 execution should use `.planning/ROADMAP.md` as the active phase source.*
