---
phase: 01-cursor-runtime-config-contract
reviewed: 2026-05-23T17:40:00Z
depth: standard
files_reviewed: 68
files_reviewed_list:
  - cli/src/api/apiMachine.test.ts
  - cli/src/api/apiMachine.ts
  - cli/src/cursor/modelDiscovery.test.ts
  - cli/src/cursor/modelDiscovery.ts
  - cli/src/cursor/runCursor.test.ts
  - cli/src/cursor/runCursor.ts
  - cli/src/modules/common/rpcTypes.ts
  - cli/src/runner/run.test.ts
  - cli/src/runner/run.ts
  - hub/src/index.ts
  - hub/src/socket/handlers/cli/index.ts
  - hub/src/socket/handlers/cli/sessionHandlers.ts
  - hub/src/socket/server.ts
  - hub/src/sync/rpcGateway.ts
  - hub/src/sync/sessionActivity.test.ts
  - hub/src/sync/sessionActivity.ts
  - hub/src/sync/sessionCache.ts
  - hub/src/sync/sessionConfigService.test.ts
  - hub/src/sync/sessionConfigService.ts
  - hub/src/sync/sessionLivenessService.test.ts
  - hub/src/sync/sessionLivenessService.ts
  - hub/src/sync/sessionModel.test.ts
  - hub/src/sync/syncEngine.ts
  - hub/src/sync/syncEngineRpc.ts
  - hub/src/sync/syncEngineSession.test.ts
  - hub/src/sync/syncEngineSession.ts
  - hub/src/web/routes/machines.test.ts
  - hub/src/web/routes/machines.ts
  - hub/src/web/routes/sessions/__tests__/_fixtures.ts
  - hub/src/web/routes/sessions/__tests__/config.test.ts
  - hub/src/web/routes/sessions/config.ts
  - shared/src/responses.ts
  - shared/src/schemas.test.ts
  - shared/src/schemas.ts
  - shared/src/sessionSummary.test.ts
  - shared/src/sessionSummary.ts
  - shared/src/types.ts
  - web/src/api/client.ts
  - web/src/components/AssistantChat/HappyComposer.test.tsx
  - web/src/components/AssistantChat/HappyComposer.tsx
  - web/src/components/AssistantChat/StatusBar.test.tsx
  - web/src/components/AssistantChat/StatusBar.tsx
  - web/src/components/AssistantChat/useHappyComposerHandlers.ts
  - web/src/components/AssistantChat/useHappyComposerState.test.ts
  - web/src/components/AssistantChat/useHappyComposerState.ts
  - web/src/components/NewSession/ModelSelector.test.tsx
  - web/src/components/NewSession/ModelSelector.tsx
  - web/src/components/NewSession/NewSession.test.tsx
  - web/src/components/NewSession/index.tsx
  - web/src/components/SessionChat.test.tsx
  - web/src/components/SessionChat.tsx
  - web/src/components/SessionList.directory-action.test.tsx
  - web/src/components/SessionList.test.ts
  - web/src/components/SessionList.tsx
  - web/src/components/SessionList/SessionListItem.test.tsx
  - web/src/components/SessionList/SessionListItem.tsx
  - web/src/hooks/mutations/useSessionActions.test.ts
  - web/src/hooks/mutations/useSessionActions.ts
  - web/src/hooks/mutations/useSpawnSession.test.tsx
  - web/src/hooks/mutations/useSpawnSession.ts
  - web/src/hooks/useCursorModels.test.tsx
  - web/src/hooks/useCursorModels.ts
  - web/src/hooks/useSSE.test.tsx
  - web/src/hooks/useSSE.ts
  - web/src/lib/locales/en.ts
  - web/src/lib/locales/zh-CN.ts
  - web/src/router.tsx
  - web/src/types/api.ts
findings:
  critical: 2
  warning: 1
  info: 0
  total: 3
status: issues_found
---

# Phase 01: Code Review Report

**Reviewed:** 2026-05-23T17:40:00Z
**Depth:** standard
**Files Reviewed:** 68
**Status:** issues_found

## Summary

Reviewed the Cursor runtime config contract across CLI, hub, shared schemas, and web. The implementation moves model/effort fields through several layers, but two core behaviors still break: non-model runtime config is silently dropped at launch, and the new unread-completion session-list state is not durable across authoritative session refreshes.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: Cursor launch drops selected effort/runtime fields

**File:** `cli/src/runner/run.ts:914-932`

**Issue:** `SpawnSessionOptions` and the hub RPC path carry `effort` and `modelReasoningEffort`, and failures for either value are classified as selected-runtime-config failures. But `buildCliArgs()` only emits `--model` and permission/yolo flags, so explicit effort selections and resumed sessions with stored `modelReasoningEffort`/`effort` start Cursor without those selected runtime settings. This violates the runtime-config contract and makes the UI/store claim a config was selected while the spawned Cursor process runs with defaults.

**Fix:** Either pass the supported Cursor CLI flags here, or remove/reject unsupported fields before they are persisted and before `toSafeSpawnFailure()` treats them as selected runtime config. Add `buildCliArgs()` coverage for model, effort, modelReasoningEffort, and resumed-session inputs.

```typescript
if (options.modelReasoningEffort) {
    args.push('--model-reasoning-effort', options.modelReasoningEffort)
}
if (options.effort) {
    args.push('--effort', options.effort)
}
```

### CR-02: Unread completion state is lost on session refetch

**File:** `hub/src/sync/sessionLivenessService.ts:196-208`, `shared/src/sessionSummary.ts:31-44`

**Issue:** Turn completion is emitted only as a transient `session-updated` patch with `statusKind: 'completed'` and `completionMarker`. The persisted session state is only touched via `updatedAt`; no durable completion marker or status is stored. When the web refetches `/api/sessions` after a reload, reconnect convergence, or a query invalidation, `toSessionSummary()` recomputes status from the stored `Session` and only returns `completed` when `endReason === 'completed'`. A normal turn-ready event does not set that end reason, so unread-complete rows revert to `idle/viewed` and the UAT state disappears.

**Fix:** Persist the turn-completion marker/status in the session model or another durable per-session field, have `toSessionSummary()` derive from that durable value, and clear it when new work starts (`markMessageQueued()` already emits the right live clear patch). Add a test that emits a ready event, then rebuilds summaries through the route/`toSessionSummary()` path and still sees `statusKind: 'completed'` with the marker.

## Warnings

### WR-01: Effort mutation is exposed in web but has no hub route and is not wired from the composer

**File:** `web/src/api/client.ts:358-363`, `hub/src/web/routes/sessions/config.ts:51-68`, `web/src/components/AssistantChat/HappyComposer.tsx:50-57`

**Issue:** `ApiClient.setEffort()` posts to `/api/sessions/:id/effort`, and `SessionChat` passes an `onEffortChange` prop toward the composer, but the hub config routes only register `/permission-mode` and `/model`. `HappyComposer` also drops `onEffortChange` when constructing handlers, so any future effort control will either be unreachable or fail with 404 once wired. This is a partially implemented public contract and there is no route/client test that would catch it.

**Fix:** Add an `/api/sessions/:id/effort` route that validates `effort: string | null` and calls `engine.applySessionConfig(session.id, { effort })`, return the same `CursorRuntimeConfigApplyResult` shape as model changes, wire `onEffortChange` through the composer handlers if the control is intended, and add route plus hook tests. If effort switching is not intended, remove the exposed client/hook props and route the display-only value as read-only metadata.

---

_Reviewed: 2026-05-23T17:40:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
