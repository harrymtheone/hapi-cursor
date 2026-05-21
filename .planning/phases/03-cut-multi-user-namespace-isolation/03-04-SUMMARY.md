---
phase: 03-cut-multi-user-namespace-isolation
plan: 04
subsystem: socket-push
tags: [socket-io, terminal, push, sse, visibility, namespace-cut]

requires:
  - phase: 03-cut-multi-user-namespace-isolation
    provides: owner-only web routes, SSE subscriptions, and SyncEngine facades from Plan 03-03
provides:
  - Namespace-free Socket.IO auth data contract for CLI and terminal sockets
  - Owner-only CLI socket access resolvers for sessions and machines
  - Terminal socket routing by active session and session room only
  - Global visible-connection tracking and owner-only push delivery
affects: [03-05-shared-contracts, 03-06-schema-cleanup, 03-07-namespace-guard]

tech-stack:
  added: []
  patterns: [owner-only-socket-access, global-visibility-tracking, owner-only-push-delivery]

key-files:
  created:
    - .planning/phases/03-cut-multi-user-namespace-isolation/03-04-SUMMARY.md
  modified:
    - hub/src/socket/server.ts
    - hub/src/socket/socketTypes.ts
    - hub/src/socket/handlers/terminal.ts
    - hub/src/socket/handlers/terminal.test.ts
    - hub/src/socket/handlers/cli/index.ts
    - hub/src/socket/handlers/cli/types.ts
    - hub/src/socket/handlers/cli/sessionHandlers.ts
    - hub/src/socket/handlers/cli/machineHandlers.ts
    - hub/src/visibility/visibilityTracker.ts
    - hub/src/push/pushNotificationChannel.ts
    - hub/src/push/pushNotificationChannel.test.ts
    - hub/src/push/pushService.ts
    - hub/src/notifications/notificationHub.test.ts
    - hub/src/sse/sseManager.ts
    - hub/src/sse/sseManager.test.ts
    - hub/src/web/routes/events.ts

key-decisions:
  - "Socket.IO auth now validates whole opaque tokens and stores no namespace authority on socket data."
  - "Terminal sockets resolve CLI routing from session rooms and active-session state only."
  - "Visibility and push delivery are global owner flows; visible SSE clients receive toast fallback before browser push."

patterns-established:
  - "SocketData carries user identity only; no namespace field is written by CLI or terminal middleware."
  - "CLI socket resolvers use direct `getSession()` and `getMachine()` existence checks instead of namespace-scoped lookups."
  - "Push delivery uses `PushService.send(payload)` over all current subscriptions and removes expired endpoints directly."

requirements-completed: [CUT-09]

duration: 5min 31s
completed: 2026-05-21
---

# Phase 03 Plan 04: Socket and Push Namespace Cut Summary

**Socket.IO auth, terminal routing, visible-client tracking, and push fallback now run as single-owner flows without socket or push namespace lookups.**

## Performance

- **Duration:** 5min 31s
- **Started:** 2026-05-21T04:18:45Z
- **Completed:** 2026-05-21T04:24:16Z
- **Tasks:** 2
- **Files modified:** 16

## Accomplishments

- Removed `SocketData.namespace`, `/cli` namespace writes, terminal JWT `ns` parsing, and terminal session namespace checks.
- Migrated CLI socket access resolvers to direct session/machine existence lookups and owner-only versioned update facades.
- Collapsed visibility tracking to a global visible-connection set and changed push delivery to all current subscriptions with direct expired-endpoint cleanup.
- Removed the temporary visibility scope from SSE manager and events route callsites so toast fallback is global.

## Task Commits

Each TDD task was committed atomically:

1. **Task 03-04-01 RED: Specify namespace-free terminal sockets** - `5585609` (test)
2. **Task 03-04-01 GREEN: Remove socket namespace data** - `f122f66` (feat)
3. **Task 03-04-02 RED: Specify owner-only push delivery** - `c81c60f` (test)
4. **Task 03-04-02 GREEN: Collapse push visibility delivery** - `03f9a77` (feat)

## Files Created/Modified

- `hub/src/socket/server.ts` - narrows terminal JWT payloads to `{ uid }` and stops writing socket namespace data.
- `hub/src/socket/socketTypes.ts` - removes `namespace` from `SocketData`.
- `hub/src/socket/handlers/terminal.ts` - routes terminal open/write/resize/close by session rooms and active-session state only.
- `hub/src/socket/handlers/cli/index.ts` - resolves session and machine access with owner-only id lookups.
- `hub/src/socket/handlers/cli/sessionHandlers.ts` - uses owner-only versioned session metadata/state update facades.
- `hub/src/socket/handlers/cli/machineHandlers.ts` - uses owner-only versioned machine metadata/state update facades.
- `hub/src/visibility/visibilityTracker.ts` - tracks global visible subscriptions.
- `hub/src/push/pushNotificationChannel.ts` - uses global visible-client toast fallback and owner-only push sending.
- `hub/src/push/pushService.ts` - sends to all subscriptions and deletes expired endpoints directly.
- `hub/src/sse/sseManager.ts` and `hub/src/web/routes/events.ts` - remove the temporary owner visibility scope from Plan 03-03.
- Focused socket, push, SSE, and notification tests were updated for owner-only behavior.

## Decisions Made

- Kept session room relevance for terminal routing; deleting namespace did not broaden terminal writes beyond the matched session room.
- Updated `SSEManager.sendToast()` to take only the toast event because Plan 03-04 removed the last caller-owned visibility scope.
- Left physical store/schema namespace cleanup to Plan 03-06; this plan removed socket/push authority and callsite dependencies without changing SQLite schema.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Removed temporary visibility scope callsites outside the push files**
- **Found during:** Task 03-04-02 verification
- **Issue:** `VisibilityTracker` could not become truly global while `SSEManager` and the events visibility route still passed the Plan 03-03 temporary owner scope.
- **Fix:** Updated `SSEManager.registerConnection()`, `SSEManager.sendToast()`, its focused test, and the events visibility route to use scope-free visibility APIs.
- **Files modified:** `hub/src/sse/sseManager.ts`, `hub/src/sse/sseManager.test.ts`, `hub/src/web/routes/events.ts`
- **Verification:** focused push/SSE tests, focused push visibility `rg` gate, `bun typecheck && bun run test`
- **Committed in:** `03f9a77`

---

**Total deviations:** 1 auto-fixed (Rule 3 blocking)
**Impact on plan:** Required to fully remove the temporary namespace-like visibility scope introduced by Plan 03-03. No new abstractions, dependencies, or schema changes were introduced.

## Verification

- Task 03-04-01: `bun test hub/src/socket/handlers/terminal.test.ts` - exit 0.
- Task 03-04-01 focused gate: no matches for `socket.data.namespace`, `namespace?:`, `parsedToken.(baseToken|namespace)`, `namespace-missing`, `session.namespace`, namespace access-denied text, or `ByNamespace` in the planned socket files.
- Task 03-04-02: `bun test hub/src/push/pushNotificationChannel.test.ts hub/src/notifications/notificationHub.test.ts hub/src/sse/sseManager.test.ts` - exit 0.
- Task 03-04-02 focused gate: no matches for `namespace`, `sendToNamespace`, `ByNamespace`, or `session.namespace` in `hub/src/visibility`, `hub/src/push`, or `hub/src/notifications`.
- Final D-47 gate after task commits: `bun typecheck && bun run test` - exit 0.

## Known Stubs

None. Stub-pattern scan hits were test arrays, empty test objects, and existing null timer/session fields; no UI-visible placeholder data or incomplete data wiring was introduced.

## Threat Flags

None. The plan modified existing socket auth, terminal routing, SSE visibility, and push delivery trust boundaries but introduced no new endpoint, file access path, dependency, or schema boundary.

## Issues Encountered

- `scripts/check-no-cut-agents.sh` still prints `rg: command not found` while exiting 0 because shell PATH lacks `rg`; focused gates used Cursor's bundled ripgrep binary. This is pre-existing and remains owned by Plan 03-07.
- Web tests still emit existing jsdom navigation "Not implemented" stderr noise while passing.
- Existing unrelated working-tree changes remain: `AGENTS.md`, `.claude/`, and `CLAUDE.md`. They were not staged or modified by this plan.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Plan 03-05 can now delete namespace from shared `Session` / `SyncEvent` / socket contracts and CLI/web mirrors. Plan 03-06 still owns the physical SQLite namespace columns, old store namespace methods, and offline v9-to-v10 migration.

## Self-Check: PASSED

- Found summary file: `.planning/phases/03-cut-multi-user-namespace-isolation/03-04-SUMMARY.md`
- Found commit: `5585609`
- Found commit: `f122f66`
- Found commit: `c81c60f`
- Found commit: `03f9a77`

---
*Phase: 03-cut-multi-user-namespace-isolation*
*Completed: 2026-05-21*
