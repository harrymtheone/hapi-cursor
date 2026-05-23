---
phase: 08-hub-internal-decoupling
plan: 02
subsystem: hub/{utils,sync,sse,socket,notifications}
tags: [refactor, scheduler, facade-split, di, shutdown, madge-cycle-close]
requirements: [REFH-02, REFH-04]
provides:
  - hub/src/utils/scheduler.ts
  - hub/src/utils/scheduler.test.ts
  - hub/src/sync/syncEngineSession.ts
  - hub/src/sync/syncEngineSessionResume.ts
  - hub/src/sync/syncEngineSessionTypes.ts
  - hub/src/sync/syncEngineMachine.ts
  - hub/src/sync/syncEngineMessage.ts
  - hub/src/sync/syncEngineRpc.ts
  - hub/src/shutdown.test.ts
affects:
  - hub/src/sync/syncEngine.ts
  - hub/src/sse/sseManager.ts
  - hub/src/sse/sseManager.test.ts
  - hub/src/socket/terminalRegistry.ts
  - hub/src/socket/server.ts
  - hub/src/socket/handlers/terminal.test.ts
  - hub/src/socket/handlers/cli/terminalHandlers.test.ts
  - hub/src/notifications/notificationHub.ts
  - hub/src/notifications/notificationHub.test.ts
  - hub/src/index.ts
  - hub/src/sync/sessionModel.test.ts
  - hub/src/sync/aliveEvents.test.ts
tech-stack:
  added: []
  patterns: [central-scheduler, owner-only-handles, facade-composition, di-constructor-injection, named-shutdown-factory]
key-files:
  created:
    - hub/src/utils/scheduler.ts
    - hub/src/utils/scheduler.test.ts
    - hub/src/sync/syncEngineSession.ts
    - hub/src/sync/syncEngineSessionResume.ts
    - hub/src/sync/syncEngineSessionTypes.ts
    - hub/src/sync/syncEngineMachine.ts
    - hub/src/sync/syncEngineMessage.ts
    - hub/src/sync/syncEngineRpc.ts
    - hub/src/shutdown.test.ts
  modified:
    - hub/src/sync/syncEngine.ts
    - hub/src/sse/sseManager.ts
    - hub/src/sse/sseManager.test.ts
    - hub/src/socket/terminalRegistry.ts
    - hub/src/socket/server.ts
    - hub/src/socket/handlers/terminal.test.ts
    - hub/src/socket/handlers/cli/terminalHandlers.test.ts
    - hub/src/notifications/notificationHub.ts
    - hub/src/notifications/notificationHub.test.ts
    - hub/src/index.ts
    - hub/src/sync/sessionModel.test.ts
    - hub/src/sync/aliveEvents.test.ts
decisions:
  - "Session sub-facade further split: resume/handoff/wait extracted into syncEngineSessionResume.ts to keep every hub/src/sync/syncEngine*.ts file under the SC#1 400-line budget"
  - "Session sub-facade constructor takes (sessionCache, machineCache, messageService, rpcGateway, eventPublisher, scheduler) — deviates from the plan's stated 4-param shape because the inherited resume/handoff/applySessionConfig/expireInactive methods need rpcGateway + messageService (sseManager is unused)"
  - "RPC sub-facade gets a narrow onSessionArchived callback instead of a back-reference to the session sub-facade — archiveSession is the only RPC method with a session-state side effect"
  - "createShutdownHandler({ scheduler, syncEngine, notificationHub, sseManager, webServer, syncEngineShutdownTimeoutMs }) factory extracted from main() and exported; syncEngineShutdownTimeoutMs defaults to 5_000 so a hanging syncEngine.shutdown does not block exit"
  - "main() gated on import.meta.main so importing index.ts from shutdown.test.ts does not boot the hub"
metrics:
  duration: ~50 minutes
  completed: 2026-05-23
  tasks_completed: 3
  files_created: 9
  files_modified: 12
  commits: 3
---

# Phase 8 Plan 02: Scheduler + SyncEngine split + SSE cycle close — Summary

Land the central `KeepaliveScheduler`, decompose `SyncEngine` into 4 + 2 sub-facade files, swap `hub/src/sse/sseManager.ts` off its reverse `SyncEngine` import (closing the only madge cycle inside `hub/src/`), and rewire SIGINT/SIGTERM shutdown through an exported factory so unit tests can assert call order without `process.emit('SIGINT')`. Four timer call sites in `hub/src/{sse,sync,socket,notifications}/` now route through the single scheduler; the two whitelisted promise-sleep retries inside `syncEngineSessionResume.ts` are the only remaining direct `setTimeout` calls. REFH-02 + REFH-04 closed.

## Outcome

- `hub/src/utils/scheduler.ts` (118 lines) implements `KeepaliveScheduler` with `everyMs / afterMs / cancel / shutdown / activeCount` (D-138). `name` field is mandatory; duplicates allowed with a dev-mode `console.debug`.
- `hub/src/sync/syncEngine.ts` shrunk from 722 → 396 lines (composition + delegation only). Renamed `stop()` → `shutdown()` (D-132).
- Session bucket fits the SC#1 budget by splitting into `syncEngineSession.ts` (255 lines) + `syncEngineSessionResume.ts` (258 lines) + `syncEngineSessionTypes.ts` (19 lines). Other sub-facades: `syncEngineMachine.ts` 28, `syncEngineMessage.ts` 70, `syncEngineRpc.ts` 152.
- `hub/src/sse/sseManager.ts` imports `SyncEvent` from `@hapi/protocol/types`; `rg "from .*sync/syncEngine" hub/src/sse/` returns 0 lines (SC#2). Closes the only madge cycle.
- `cd hub && npx --no-install madge --circular --extensions ts,tsx --exclude '(^\.\./|web/dist)' src/` reports "No circular dependencies found" (SC#5).
- Single `KeepaliveScheduler` constructed in `hub/src/index.ts`, injected into `SSEManager` (3rd arg), `createSocketServer` options → `TerminalRegistry`, `SyncEngine` (5th arg), `NotificationHub` (3rd arg).
- 4 timer sites routed through the scheduler: `inactivity` (SyncEngineSession), `sse-heartbeat` (SSEManager, lazy create/stop preserved), `terminal-idle:<id>` (TerminalRegistry), `notify:<sessionId>` (NotificationHub debounce).
- `createShutdownHandler` exported from `hub/src/index.ts`; SIGINT/SIGTERM closure calls `scheduler.shutdown()` first, then `notificationHub.stop()`, then awaits `syncEngine.shutdown()` raced with a 5s timeout, then `sseManager.stop()` + `webServer.stop()` + `process.exit(0)`. Existing `process.on('SIGINT' | 'SIGTERM', shutdown)` lines kept verbatim — no new listeners (Pitfall in 08-RESEARCH).
- `bun typecheck` green. `bun run test` green (549 expect calls / 189 tests in hub, full workspace 541+ in cli/web/shared/hub).

## Tasks executed

### Task 1 — KeepaliveScheduler + tests + shutdown handler test scaffold (commit `78d56c6`)

- `hub/src/utils/scheduler.ts` (118 lines). `everyMs` wraps `setInterval`; cancel clears the interval and removes the handle. `afterMs` wraps `setTimeout`; the timeout callback removes the handle before invoking fn so `activeCount` stays truthy. After `cancel()` (or `shutdown()`) the callback MUST NOT fire — invariant tested.
- `hub/src/utils/scheduler.test.ts` (96 lines, 6 cases): shutdown cancels all 3 handles + zeros activeCount, cancel-prevents-callback on afterMs, everyMs fires repeatedly until cancel, duplicate names allowed and independently cancellable, afterMs auto-removes its handle on fire, shutdown is idempotent.
- `hub/src/shutdown.test.ts` (108 lines, 3 cases) scaffolds tests against the `createShutdownHandler` factory exported from `index.ts` in Task 2. Asserts scheduler.shutdown fires before subsystem stops via `mock.invocationCallOrder`, tolerates nullish subsystems (graceful boot-failure shutdown), and races a 30ms timeout so a hanging `syncEngine.shutdown` does not block exit. `process.exit` stubbed per D-141.

### Task 2 — Split SyncEngine into 4 sub-facades; swap SSE SyncEvent import; rename stop→shutdown (commit `6289b53`)

- Created `syncEngineSession.ts` (session lifecycle + delegation to a sub-helper) and `syncEngineSessionResume.ts` (resume / handoff / waitForSessionActive / waitForSessionInactive — both whitelisted promise-sleep retries live here with `// scheduler-exempt: promise-sleep retry` comments). Types shared via `syncEngineSessionTypes.ts`.
- Created `syncEngineMachine.ts`, `syncEngineMessage.ts`, `syncEngineRpc.ts`. `SyncEngineMessage` takes both `messageService` + `sessionCache` because `sendMessage` calls `sessionCache.markMessageQueued`. `SyncEngineRpc` takes a `(payload) => void` `onSessionArchived` callback for the `archiveSession` side effect.
- `syncEngine.ts` rewritten as a 396-line composition + delegation facade. Constructor unchanged (Task 2) — `(store, io, rpcRegistry, sseManager)`. Renamed `stop()` → `shutdown()` (D-132). MessageService callback still routes through `this.recordSessionActivity` so Pitfall 4 (constructor-time callback bound through SyncEngine instance) is preserved.
- `hub/src/sse/sseManager.ts:1` + `hub/src/sse/sseManager.test.ts:3`: `import type { SyncEvent } from '../sync/syncEngine'` → `@hapi/protocol/types`. Closes the only sse → sync cycle. `madge --circular` reports 0 cycles inside `hub/src/`.
- `hub/src/index.ts`: renamed `syncEngine?.stop()` → `syncEngine?.shutdown()`; extracted exported `createShutdownHandler` factory + gated `main()` on `import.meta.main` so importing index.ts in `shutdown.test.ts` does not trigger the boot path. Scheduler arg in this commit is a no-op stub; Task 3 wires the real instance.
- Tests retargeted: `engine.stop()` → `engine.shutdown()`; `(engine as any).rpcGateway` / `.sessionCache` / `.waitForSessionActive` probes rewritten to the new internal paths (`engine.session.resume.rpcGateway`, `engine.session.sessionCache`, `engine.session.resume.waitForSessionActive`).

### Task 3 — Wire KeepaliveScheduler DI; route 4 timer call sites; finalize shutdown closure (commit `ac0a364`)

- `hub/src/index.ts`: `const scheduler = new KeepaliveScheduler()` before VisibilityTracker; threaded into `SSEManager(30_000, visibilityTracker, scheduler)`, `createSocketServer({ ..., scheduler })`, `new SyncEngine(..., scheduler)`, `new NotificationHub(syncEngine, channels, scheduler)`. `createShutdownHandler` now receives the real scheduler.
- `hub/src/sync/syncEngineSession.ts`: `inactivityTimer: NodeJS.Timeout` → `inactivityHandle: SchedulerHandle | null` via `this.scheduler.everyMs('inactivity', 5_000, () => this.expireInactive())`. `shutdown()` calls `this.inactivityHandle?.cancel()`.
- `hub/src/sse/sseManager.ts`: `heartbeatTimer` → `heartbeatHandle: SchedulerHandle | null`. Lazy-create-on-first-connection / lazy-stop-on-last-disconnect semantics preserved — `ensureHeartbeat()` calls `scheduler.everyMs('sse-heartbeat', ...)` only when no handle exists; `stopHeartbeat()` calls `this.heartbeatHandle.cancel()`. Constructor gains `scheduler` as the 3rd positional arg.
- `hub/src/socket/terminalRegistry.ts`: per-entry `idleTimer` field retyped `SchedulerHandle | null`; both `clearTimeout(entry.idleTimer)` sites (in `remove()` + `scheduleIdle()`) become `entry.idleTimer.cancel()`. `scheduleIdle` uses `this.scheduler.afterMs(\`terminal-idle:\${entry.terminalId}\`, this.idleTimeoutMs, fn)`. `TerminalRegistryOptions` now requires `scheduler`.
- `hub/src/socket/server.ts`: `SocketServerDeps` gains `scheduler: KeepaliveScheduler`, passed through to `new TerminalRegistry({ ..., scheduler: deps.scheduler })`.
- `hub/src/notifications/notificationHub.ts`: Pitfall 2 — per-session debounce. `notificationDebounce: Map<string, NodeJS.Timeout>` → `Map<string, SchedulerHandle>`. Constructor gains `scheduler` as the 3rd positional arg; existing `options?` becomes 4th. Cancel-and-replace in `checkForPermissionNotification` uses `existingTimer.cancel()`; debounce schedule uses `scheduler.afterMs(\`notify:\${session.id}\`, this.permissionDebounceMs, fn)`. Cleanup loop in `stop()` iterates handles and calls `cancel()` on each. The same `existingTimer.cancel()` swap is also applied in `clearSessionState`.
- Tests: `SSEManager / SyncEngine / NotificationHub / TerminalRegistry` constructors in `hub/src/sse/sseManager.test.ts`, `hub/src/sync/sessionModel.test.ts` (10 sites), `hub/src/sync/aliveEvents.test.ts` (2 sites), `hub/src/notifications/notificationHub.test.ts` (4 sites), `hub/src/socket/handlers/terminal.test.ts`, `hub/src/socket/handlers/cli/terminalHandlers.test.ts` all updated to pass a fresh `new KeepaliveScheduler()` instance.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking issue] Session sub-facade constructor needs `rpcGateway` + `messageService`**

- Found during: Task 2 (file scaffolding)
- Issue: Plan `<interfaces>` block names the session sub-facade constructor as `(sessionCache, machineCache, publisher, sseManager)`. But the session methods inherited from the original SyncEngine (`resumeSession`, `handoffSessionToLocal`, `applySessionConfig` active branch, `expireInactive`'s messageService sweep) require `rpcGateway` and `messageService`; `sseManager` is never read inside the session sub-facade.
- Fix: Constructor signature became `(sessionCache, machineCache, messageService, rpcGateway, eventPublisher)` — dropped the unused `sseManager` slot and added the two required deps. Documented in the file header.
- Files modified: `hub/src/sync/syncEngineSession.ts`
- Commit: `6289b53`

**2. [Rule 3 - Blocking issue] Session sub-facade exceeded the 400-line SC#1 budget**

- Found during: Task 2 verification (`wc -l hub/src/sync/syncEngine*.ts`)
- Issue: Putting all session-bucket methods in a single `syncEngineSession.ts` yielded 482 lines (over the SC#1 < 400 budget). Stripping comments alone would not reach 400.
- Fix: Extracted `resolveLocalResumeTarget` / `listLocalResumableSessions` / `resumeSession` / `handoffSessionToLocal` / `waitForSessionActive` / `waitForSessionInactive` into a new `syncEngineSessionResume.ts` (258 lines). Shared result types live in `syncEngineSessionTypes.ts` (19 lines). The main `syncEngineSession.ts` (255 lines) holds a `private readonly resume: SyncEngineSessionResume` and delegates the six methods. Both whitelisted promise-sleep retries (`scheduler-exempt: promise-sleep retry`) live in `syncEngineSessionResume.ts`.
- Files modified: `hub/src/sync/syncEngineSession.ts` / `hub/src/sync/syncEngineSessionResume.ts` / `hub/src/sync/syncEngineSessionTypes.ts`
- Commit: `6289b53`

**3. [Rule 2 - Missing critical functionality] `createShutdownHandler` factory needed in Task 2**

- Found during: Task 2 typecheck
- Issue: Task 1 created `hub/src/shutdown.test.ts` against an exported `createShutdownHandler` factory. The plan deferred the factory to Task 3, so typecheck failed between Task 1 commit and Task 3 commit. Plan's Task 1 acceptance criteria allow this gap but mandate Task 2 (`bun typecheck` exits 0).
- Fix: Added the `createShutdownHandler({ scheduler, syncEngine, notificationHub, sseManager, webServer, syncEngineShutdownTimeoutMs })` factory + `ShutdownDeps` export in Task 2 with the scheduler arg as a no-op stub. Task 3 replaced the stub with the real `KeepaliveScheduler` instance. Gated `main()` on `import.meta.main` so test imports do not boot the hub.
- Files modified: `hub/src/index.ts`
- Commit: `6289b53`

**4. [Rule 3 - Blocking issue] `(engine as any).rpcGateway` / `.sessionCache` / `.waitForSessionActive` probes broken after the split**

- Found during: Task 2 first test run (sessionModel.test.ts)
- Issue: `sessionModel.test.ts` overrides `(engine as any).rpcGateway.spawnSession` and `(engine as any).waitForSessionActive` to fake the RPC, and reads `(engine as any).sessionCache` for dedup wiring. After the split these fields no longer exist on the facade.
- Fix: Rewrote each probe to the new internal location:
  - `(engine as any).rpcGateway` → `(engine as any).session.resume.rpcGateway` (after Task 2's further session split; lives inside `SyncEngineSessionResume`).
  - `(engine as any).sessionCache` → `(engine as any).session.sessionCache`.
  - `(engine as any).waitForSessionActive` → `(engine as any).session.resume.waitForSessionActive` (override must be on the resume helper because that's where `resumeSession` actually calls `this.waitForSessionActive`).
- Files modified: `hub/src/sync/sessionModel.test.ts` / `hub/src/sync/aliveEvents.test.ts`
- Commit: `6289b53`

No architectural (Rule 4) changes were required; the plan's structural recipe held with the two file-split + constructor-shape adjustments above.

## Threat Flags

None. The refactor preserves the SyncEngine public surface byte-for-byte (every public method is a direct delegate). The shutdown closure ordering change (scheduler.shutdown first) is strictly safer — no callback fires after the cancel sweep. No new endpoints, auth paths, file access patterns, or schema changes.

## Known Stubs

None. All scheduler call sites are live; the no-op `shutdownScheduler` stub from Task 2 was replaced by the real instance in Task 3.

## Verification

- `bun typecheck` — exit 0
- `cd hub && bun test src/utils/scheduler.test.ts` — 6 pass
- `cd hub && bun test src/shutdown.test.ts` — 3 pass
- `cd hub && bun test src/notifications/notificationHub.test.ts` — 4 pass
- `cd hub && bun test src/sse/sseManager.test.ts` — 3 pass
- `bun run test` — 549 expect calls / 189 hub tests pass (full workspace; cli/web/shared also green)
- `cd hub && npx --no-install madge --circular --extensions ts,tsx --exclude '(^\.\./|web/dist)' src/` — "No circular dependencies found"
- `rg 'from .*sync/syncEngine' hub/src/sse/` — 0 lines (SC#2)
- `rg 'setInterval\(|setTimeout\(' hub/src/{sse,sync,socket,notifications}/ --glob '!**/*.test.ts'` — 2 lines, both inside `hub/src/sync/syncEngineSessionResume.ts` (lines 241 + 254) adjacent to `// scheduler-exempt: promise-sleep retry` comments (SC#4 source side)
- `rg 'scheduler\.everyMs\(|scheduler\.afterMs\(' hub/src/{sse,sync,socket,notifications}/` — 4 matches (`sse-heartbeat`, `inactivity`, `terminal-idle:*`, `notify:*`)
- `rg "process\.on\('SIG(INT|TERM)'" hub/src/` — 2 lines (index.ts:205-206; no new listeners introduced)
- `rg 'new KeepaliveScheduler\(' hub/src/index.ts` — 1 line (single instance constructed in main)
- `rg 'syncEngine\?\.shutdown\(\)' hub/src/index.ts` — covered via `createShutdownHandler` factory; `rg 'syncEngine\?\.stop\(\)' hub/src/index.ts` — 0 lines (rename applied)
- `wc -l hub/src/sync/syncEngine*.ts` — every file < 400 (28, 70, 152, 255, 258, 19, 396)

## Self-Check: PASSED

- File `hub/src/utils/scheduler.ts` — FOUND
- File `hub/src/utils/scheduler.test.ts` — FOUND
- File `hub/src/sync/syncEngineSession.ts` — FOUND
- File `hub/src/sync/syncEngineSessionResume.ts` — FOUND
- File `hub/src/sync/syncEngineSessionTypes.ts` — FOUND
- File `hub/src/sync/syncEngineMachine.ts` — FOUND
- File `hub/src/sync/syncEngineMessage.ts` — FOUND
- File `hub/src/sync/syncEngineRpc.ts` — FOUND
- File `hub/src/shutdown.test.ts` — FOUND
- Commit `78d56c6` — FOUND
- Commit `6289b53` — FOUND
- Commit `ac0a364` — FOUND
