---
phase: 01-cursor-runtime-config-contract
reviewed: 2026-05-24T02:21:08Z
depth: standard
files_reviewed: 39
files_reviewed_list:
  - cli/src/api/api.ts
  - cli/src/api/apiMachine.ts
  - cli/src/api/types.ts
  - cli/src/cursor/runCursor.ts
  - cli/src/modules/common/rpcTypes.ts
  - cli/src/runner/run.ts
  - hub/src/socket/handlers/cli/index.ts
  - hub/src/socket/handlers/cli/sessionHandlers.ts
  - hub/src/store/index.ts
  - hub/src/store/sessionStore.ts
  - hub/src/store/sessions.ts
  - hub/src/store/types.ts
  - hub/src/sync/messageService.ts
  - hub/src/sync/rpcGateway.ts
  - hub/src/sync/sessionActivity.ts
  - hub/src/sync/sessionCache.ts
  - hub/src/sync/sessionConfigService.ts
  - hub/src/sync/sessionLivenessService.ts
  - hub/src/sync/sessionLivenessService.test.ts
  - hub/src/sync/sessionModel.test.ts
  - hub/src/sync/sessionRepository.ts
  - hub/src/sync/syncEngine.ts
  - hub/src/sync/syncEngineRpc.ts
  - hub/src/sync/syncEngineSession.ts
  - hub/src/sync/syncEngineSessionResume.ts
  - hub/src/web/middleware/route-helpers.ts
  - hub/src/web/routes/machines.ts
  - hub/src/web/routes/sessions/config.ts
  - shared/src/schemas.ts
  - shared/src/sessionSummary.ts
  - web/src/api/client.ts
  - web/src/components/AssistantChat/HappyComposer.tsx
  - web/src/components/AssistantChat/StatusBar.tsx
  - web/src/components/AssistantChat/useHappyComposerHandlers.ts
  - web/src/components/AssistantChat/useHappyComposerState.ts
  - web/src/components/SessionChat.tsx
  - web/src/hooks/mutations/useSessionActions.ts
  - web/src/hooks/mutations/useSpawnSession.ts
  - web/src/hooks/useSSE.ts
  - web/src/router.tsx
findings:
  critical: 1
  warning: 1
  info: 0
  total: 2
status: issues_found
---

# Phase 01: Code Review Report

**Reviewed:** 2026-05-24T02:21:08Z
**Depth:** standard
**Files Reviewed:** 39
**Status:** issues_found

## Summary

Reviewed Phase 01 gap-closure changes from plans 01-11 through 01-15, with collaborator checks around session-config routes, SSE convergence, ready-event classification, and session-cache behavior. The unsupported spawn effort surface is mostly removed, and durable completion markers are plumbed through store/schema/summary, but one race can still make new work look completed and persist that stale marker.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: Late ready events can re-persist completion after new work starts

**File:** `hub/src/sync/sessionLivenessService.ts:119-149`, `hub/src/sync/sessionLivenessService.ts:178-201`

**Issue:** `markMessageQueued()` correctly clears `turnCompletionMarker`, marks the active session as thinking, and sets a pending-thinking grace window when new user work starts. But `recordSessionActivity(..., { kind: 'turn-completed' })` unconditionally writes a new durable completion marker, flips `thinking` to false, and deletes the pending-thinking guard. If a ready event from the prior turn arrives after the user has queued the next turn, the stale ready event wins: the row becomes completed/unread again and the cleared marker is re-persisted. That violates the gap-closure invariant that new work clears the durable completion marker and returns the row to thinking/running.

**Fix:**
```typescript
if (activity.kind === 'turn-completed') {
    const pendingUntil = this.repository.pendingThinkingUntilBySessionId.get(sessionId) ?? 0
    if (session?.thinking && pendingUntil > Date.now()) {
        this.repository.store.sessions.touchSessionUpdatedAt(sessionId, nextUpdatedAt)
        session.updatedAt = Math.max(session.updatedAt, nextUpdatedAt)
        return
    }
}
```
Add a regression test: complete a turn, call `markMessageQueued()`, then deliver a ready/turn-completed activity and assert `thinking` remains true and both in-memory/store `turnCompletionMarker` stay null. A stronger long-term fix is to correlate ready markers to a turn/message sequence instead of relying only on timestamps.

## Warnings

### WR-01: Unsupported effort-only config requests are acknowledged as successful

**File:** `cli/src/cursor/runCursor.ts:64-76`, `hub/src/sync/syncEngineSession.ts:188-209`

**Issue:** Active runner config handling decides whether to return a runtime apply result only from `model`; an effort-only or modelReasoningEffort-only payload falls through to `{ applied: { permissionMode } }`. The inactive Hub path similarly sets `hasRuntimeConfigRequest` for unsupported effort fields and returns `status: 'applies-next-run'` even though it intentionally strips those fields from persistence. That prevents storage divergence, but it still tells callers the unsupported request succeeded or will apply next run. If any internal caller or future route reaches this public `applySessionConfig` contract with effort-only input, UI state can treat unsupported effort as accepted.

**Fix:** Detect unsupported effort fields explicitly and return a safe no-op/rejection instead of `applied` or `applies-next-run`. For example, active runner handling can return a parsed `failed` result with the current model/effort values, and the inactive Hub branch can throw or return `failed` when `model` and `permissionMode` are absent but effort fields are present. Add active and inactive tests that assert the response status is not success-like for unsupported effort-only payloads.

---

_Reviewed: 2026-05-24T02:21:08Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
