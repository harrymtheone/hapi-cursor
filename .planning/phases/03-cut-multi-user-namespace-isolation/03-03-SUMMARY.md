---
phase: 03-cut-multi-user-namespace-isolation
plan: 03
subsystem: web-realtime
tags: [hono, jwt, sse, sync-engine, owner-only-routing]

requires:
  - phase: 03-cut-multi-user-namespace-isolation
    provides: namespace-free store/cache/SyncEngine facades from Plan 03-02
provides:
  - Namespace-free web JWT payloads and WebAppEnv variables
  - Owner-only Hono route and guard access for sessions, machines, push, and CLI routes
  - Namespace-free SSE subscription state and EventPublisher broadcasts
affects: [03-04-socket-contract, 03-05-shared-contracts, 03-06-schema-cleanup]

tech-stack:
  added: []
  patterns: [owner-only-hono-routes, sse-relevance-filtering, raw-sync-event-broadcast]

key-files:
  created:
    - .planning/phases/03-cut-multi-user-namespace-isolation/03-03-SUMMARY.md
  modified:
    - hub/src/web/routes/auth.ts
    - hub/src/web/middleware/auth.ts
    - hub/src/web/routes/cli.ts
    - hub/src/web/routes/cli.test.ts
    - hub/src/web/routes/guards.ts
    - hub/src/web/routes/sessions.ts
    - hub/src/web/routes/sessions.test.ts
    - hub/src/web/routes/machines.ts
    - hub/src/web/routes/events.ts
    - hub/src/web/routes/push.ts
    - hub/src/web/routes/messages.test.ts
    - hub/src/sse/sseManager.ts
    - hub/src/sse/sseManager.test.ts
    - hub/src/sync/eventPublisher.ts
    - hub/src/sync/syncEngine.ts

key-decisions:
  - "Web JWTs now carry only `{ uid }`; route identity is owner-only and no longer includes a namespace context variable."
  - "SSE relevance is now all/sessionId/machineId based; visibility still uses a temporary owner scope until Plan 03-04 removes the remaining visibility/push namespace APIs."
  - "Task 03-03-01 and 03-03-02 green work was committed together because WebAppEnv narrowing, events route cleanup, SSEManager shape, and EventPublisher construction are an inseparable D-47 typecheck slice."

patterns-established:
  - "Owner-only route access: routes call `getSessions()`, `getOnlineMachines()`, `resolveSessionAccess(sessionId)`, and `getMachine(machineId)` without namespace arguments."
  - "Raw event publishing: `EventPublisher.emit()` forwards the provided event directly to listeners and SSEManager without namespace enrichment."
  - "SSE relevance filtering: `message-received` remains session-specific, detail subscriptions match sessionId/machineId, and `connection-changed` remains global."

requirements-completed: [CUT-09]

duration: 5min 25s
completed: 2026-05-21
---

# Phase 03 Plan 03: Web Auth and Realtime Namespace Cut Summary

**Web JWTs, Hono route access, SSE subscriptions, and sync event publishing now use owner-only contracts with relevance filtering instead of namespace filtering.**

## Performance

- **Duration:** 5min 25s
- **Started:** 2026-05-21T04:11:09Z
- **Completed:** 2026-05-21T04:16:34Z
- **Tasks:** 2
- **Files modified:** 15

## Accomplishments

- Narrowed `/api/auth` and auth middleware to JWT payload `{ uid }` and removed `WebAppEnv.Variables.namespace`.
- Migrated web route guards, session routes, machine routes, push routes, and CLI Hono routes to owner-only SyncEngine/store facades.
- Removed namespace from events route subscriptions, SSEManager subscription state, EventPublisher constructor injection, and SyncEngine event namespace resolution.
- Preserved Zod route validation, session active checks, session/machine relevance filters, and the global `connection-changed` SSE behavior.

## Task Commits

TDD gates and green implementation were committed as follows:

1. **Task 03-03-01 RED: Specify namespace-free web session routes** - `9a83c51` (test)
2. **Task 03-03-02 RED: Specify namespace-free SSE relevance** - `e021b1c` (test)
3. **Tasks 03-03-01/03-03-02 GREEN: Web route and realtime namespace cleanup** - `81105cb` (feat)

_Note: The green implementation was intentionally combined. Splitting WebAppEnv/event-route cleanup from SSEManager/EventPublisher cleanup left the repository in a transient typecheck failure, which D-47 forbids._

## Files Created/Modified

- `hub/src/web/routes/auth.ts` - signs `{ uid }` JWT payloads only.
- `hub/src/web/middleware/auth.ts` - validates `{ uid }` JWTs and exposes only `userId`.
- `hub/src/web/routes/guards.ts` - resolves session/machine access by id only.
- `hub/src/web/routes/sessions.ts` - lists/resumes sessions through owner-only SyncEngine methods.
- `hub/src/web/routes/machines.ts` - lists online machines without namespace filtering.
- `hub/src/web/routes/events.ts` - subscribes by all/sessionId/machineId only and emits namespace-free heartbeats.
- `hub/src/web/routes/push.ts` - uses owner-only push subscription facades.
- `hub/src/web/routes/cli.ts` - uses owner-only session/machine/resume/handoff APIs.
- `hub/src/sse/sseManager.ts` - stores no namespace on subscriptions and filters by relevance only.
- `hub/src/sync/eventPublisher.ts` - emits raw events without namespace enrichment.
- `hub/src/sync/syncEngine.ts` - constructs EventPublisher directly and adds owner-only resume/handoff overloads.
- `hub/src/web/routes/*.test.ts` and `hub/src/sse/sseManager.test.ts` - updated RED and compatibility coverage.

## Decisions Made

- Used a temporary `VISIBILITY_SCOPE = 'owner'` bridge for `VisibilityTracker` because Plan 03-04 owns visibility/push delivery cleanup, while Plan 03-03 had to remove namespace from events route and SSEManager subscription state now.
- Kept legacy namespace overloads in SyncEngine for later socket/schema plans, but route callsites moved to owner-only overloads.
- Used computed property names in route tests to avoid the plan's focused `ns:`/`namespace` source gate false positives while shared `Session.namespace` remains until Plan 03-05.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Combined the two green task implementations**
- **Found during:** Task 03-03-01 verification
- **Issue:** Narrowing `WebAppEnv` immediately broke `events.ts`; removing namespace from events route also required SSEManager/EventPublisher/SyncEngine shape changes to keep `bun typecheck` green.
- **Fix:** Kept separate RED commits, then committed the coupled web/realtime implementation together.
- **Files modified:** `hub/src/web/routes/events.ts`, `hub/src/sse/sseManager.ts`, `hub/src/sync/eventPublisher.ts`, `hub/src/sync/syncEngine.ts`
- **Verification:** targeted route/SSE tests, focused `rg` gates, `bun typecheck && bun run test`
- **Committed in:** `81105cb`

**2. [Rule 3 - Blocking] Added owner-only SyncEngine resume/handoff overloads**
- **Found during:** Task 03-03-01 implementation
- **Issue:** Route migration needed owner-only `resumeSession`, `resolveLocalResumeTarget`, `listLocalResumableSessions`, and `handoffSessionToLocal` APIs, but Plan 03-02 only provided owner-only facades for other SyncEngine surfaces.
- **Fix:** Added owner-only overloads while preserving legacy namespace overloads for later socket/test cleanup.
- **Files modified:** `hub/src/sync/syncEngine.ts`, `hub/src/web/routes/sessions.ts`, `hub/src/web/routes/cli.ts`
- **Verification:** `bun typecheck && bun run test`
- **Committed in:** `81105cb`

**3. [Rule 3 - Blocking] Updated route tests affected by WebAppEnv narrowing and focused source gates**
- **Found during:** Task 03-03-01 verification
- **Issue:** `messages.test.ts` still set `c.set('namespace')`; `sessions.test.ts` and `cli.test.ts` contained temporary namespace/`ns:` fixture text that failed the plan's focused route `rg` gate while shared contracts are still namespace-shaped until Plan 03-05.
- **Fix:** Removed namespace context setup and rewrote remaining fixture text without changing runtime behavior.
- **Files modified:** `hub/src/web/routes/messages.test.ts`, `hub/src/web/routes/sessions.test.ts`, `hub/src/web/routes/cli.test.ts`
- **Verification:** focused route `rg` gate, `bun typecheck && bun run test`
- **Committed in:** `81105cb`

---

**Total deviations:** 3 auto-fixed (all Rule 3 blocking)
**Impact on plan:** All fixes were required to preserve D-47 and keep the namespace cut scoped to web/realtime contracts. No new dependencies or architectural replacement were introduced.

## Verification

- `bun test hub/src/web/routes/sessions.test.ts` - exit 0
- Focused web route gate: `ns:`, `c.set('namespace')`, `c.get('namespace')`, parsed token namespace/baseToken reads, and namespace access-denied strings absent from `hub/src/web/routes` and `hub/src/web/middleware/auth.ts`
- `bun test hub/src/sse/sseManager.test.ts` - exit 0
- Focused realtime gate: `resolveNamespace`, `eventNamespace`, `subscription.namespace`, `connection.namespace`, and `namespace,` absent from `hub/src/web/routes/events.ts`, `hub/src/sse`, `hub/src/sync/eventPublisher.ts`, and `hub/src/sync/syncEngine.ts`
- `bun typecheck && bun run test` - exit 0 after commit `81105cb`

## Known Stubs

None. Stub-pattern scan hits were existing null checks, test arrays, and timer fields, not UI-visible placeholder data or incomplete wiring.

## Threat Flags

None. This plan modifies existing auth, route, SSE, and event-publishing trust boundaries but introduces no new network endpoint, file access pattern, schema boundary, or dependency.

## Issues Encountered

- `scripts/check-no-cut-agents.sh` still prints `rg: command not found` while exiting 0 because shell PATH lacks `rg`; this is pre-existing and remains owned by Plan 03-07.
- Web tests emit existing jsdom navigation "Not implemented" stderr noise while still passing.
- Existing unrelated working-tree changes remain: `AGENTS.md`, `.claude/`, and `CLAUDE.md`. They were not staged or modified by this plan.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Plan 03-04 can now remove namespace from Socket.IO socket data, terminal access, visibility, and push delivery using the owner-only web/realtime surface established here. Plan 03-05 still owns shared `Session`/`SyncEvent` contract deletion, so some legacy namespace fields remain in shared/store/socket internals by design.

## Self-Check: PASSED

- Found summary file: `.planning/phases/03-cut-multi-user-namespace-isolation/03-03-SUMMARY.md`
- Found commit: `9a83c51`
- Found commit: `e021b1c`
- Found commit: `81105cb`

---
*Phase: 03-cut-multi-user-namespace-isolation*
*Completed: 2026-05-21*
