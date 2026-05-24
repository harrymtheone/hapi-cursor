---
phase: 01-cursor-runtime-config-contract
reviewed: 2026-05-24T02:54:38Z
depth: standard
files_reviewed: 14
files_reviewed_list:
  - cli/src/cursor/runCursor.ts
  - cli/src/cursor/runCursor.test.ts
  - hub/src/sync/syncEngineSession.ts
  - hub/src/sync/syncEngineSession.test.ts
  - hub/src/sync/sessionLivenessService.ts
  - hub/src/sync/sessionLivenessService.test.ts
  - hub/src/sync/sessionConfigService.ts
  - hub/src/sync/sessionConfigService.test.ts
  - hub/src/sync/sessionActivity.ts
  - hub/src/sync/syncEngineMessage.ts
  - hub/src/sync/rpcGateway.ts
  - hub/src/web/routes/sessions/config.ts
  - hub/src/web/routes/machines.ts
  - shared/src/sessionSummary.ts
findings:
  critical: 0
  warning: 2
  info: 1
  total: 3
status: issues_found
---

# Phase 01: Code Review Report

**Reviewed:** 2026-05-24T02:54:38Z
**Depth:** standard
**Files Reviewed:** 14
**Status:** issues_found

## Summary

Re-reviewed Phase 01 gap-closure work from plans **01-16** (effort-only runtime config returns `failed`) and **01-17** (`isStaleCompletion` guard for late `turn-completed` after `markMessageQueued`). The prior review’s **CR-01** (late ready re-persisting completion) and **WR-01** (effort-only success-like acknowledgements) are addressed in code and covered by new regression tests. No new blockers were found in those changes.

Two residual robustness gaps remain: a time-bounded grace window still allows stale completion after 15s, and combined effort+permissionMode payloads can still return success-like `applied` while silently ignoring unsupported effort fields.

## Narrative Findings (AI reviewer)

### Prior review disposition (plans 01-16 / 01-17)

| Prior ID | Topic | Status |
|---|---|---|
| CR-01 | Late `turn-completed` after new work | **Fixed** — `isStaleCompletion` in `sessionLivenessService.ts:179-181`; regression at `sessionLivenessService.test.ts:219-264` |
| WR-01 | Effort-only success-like apply | **Fixed** — `failed` branches in `runCursor.ts:66-78` and `syncEngineSession.ts:197-205`; tests in `runCursor.test.ts:83-130`, `syncEngineSession.test.ts:102-152` |

## Warnings

### WR-01: Stale turn-completed can still win after the 15s grace window

**File:** `hub/src/sync/sessionLivenessService.ts:7`, `hub/src/sync/sessionLivenessService.ts:179-204`

**Issue:** Plan 01-17 correctly demotes delayed `turn-completed` while `thinking === true` and `pendingThinkingUntilBySessionId > Date.now()`. After `QUEUED_MESSAGE_THINKING_GRACE_MS` (15_000 ms) elapses, the guard no longer applies. A very late ready event from the previous turn can still call `setSessionTurnCompletionMarker`, set `thinking = false`, and emit `statusKind: 'completed'`, recreating the race that CR-01 fixed only inside the grace window. Plan 01-17 explicitly deferred turn/message sequence correlation.

**Fix:** Extend hardening with a monotonic turn or message sequence on `markMessageQueued` and reject `turn-completed` activities whose sequence is older than the latest queued work. Short-term mitigation: lengthen grace only if product accepts the tradeoff; prefer sequence correlation.

### WR-02: Effort fields bundled with permissionMode still return success-like `applied`

**File:** `cli/src/cursor/runCursor.ts:66-79`, `hub/src/sync/syncEngineSession.ts:189-218`

**Issue:** Effort-only payloads correctly return `status: 'failed'` when no `permissionMode` is present (01-16). If a caller sends `{ effort: 'high', permissionMode: 'plan' }` (or inactive Hub equivalent with supported `permissionMode`), the unsupported-effort branch is skipped because `permissionMode !== undefined`, and the handler returns `{ applied: { permissionMode } }` / inactive `status: 'applied'`. Effort is not applied and not reported as failed. Public HTTP routes only expose separate permission and model endpoints today, but the shared `set-session-config` / `applySessionConfig` contract can still mislead internal or future callers.

**Fix:** When unsupported effort keys are present, return `failed` (or a structured partial result) unless `model` is also being applied. Example for CLI:

```typescript
const hasUnsupportedEffortRequest =
    Object.prototype.hasOwnProperty.call(config, 'effort')
    || Object.prototype.hasOwnProperty.call(config, 'modelReasoningEffort');
if (hasUnsupportedEffortRequest && !hasModelConfigRequest) {
    return CursorRuntimeConfigApplyResultSchema.parse({
        status: 'failed',
        model: state.currentModel ?? null,
        modelReasoningEffort: null,
        effort: null,
        reason: 'unknown'
    });
}
```

Apply permission mode only when effort keys are absent, or document and test explicit partial-apply semantics.

## Info

### IN-01: Runner alive payloads can still persist effort metadata

**File:** `hub/src/sync/sessionLivenessService.ts:69-88`, `hub/src/socket/handlers/cli/sessionHandlers.ts:16-25`

**Issue:** Spawn and Web paths block unsupported effort, but `handleSessionAlive` still writes `modelReasoningEffort` and `effort` when the runner includes them. This is likely intentional display metadata, not a config-apply acknowledgement bug. Worth confirming it cannot contradict the “effort unsupported for runtime config” product story on the session list.

**Fix:** No change required if metadata is read-only display; otherwise gate effort persistence the same way as spawn/config apply.

---

_Reviewed: 2026-05-24T02:54:38Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
