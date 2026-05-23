---
status: diagnosed
trigger: "Phase 01-cursor-runtime-config-contract UAT Test 4: mobile session list status indicators. Expected: running, thinking, waiting, error, completed unread, and viewed-completed rows each show one compact accessible status indicator with correct color/spinner behavior; model/effort text absent inline; viewed completed becomes gray. Actual: creating a blank session immediately shows busy spinner; after agent output completes, the status indicator remains busy spinner and does not switch to green."
created: 2026-05-24T00:27:00+08:00
updated: 2026-05-24T00:49:00+08:00
---

## Current Focus
<!-- OVERWRITE on each update - reflects NOW -->

hypothesis: Session-list "running" is incorrectly derived from runner liveness (`active`) instead of agent turn activity/completion, so an idle connected Cursor session stays a spinner and turn completion never becomes an unread completed marker.
test: Compare keepalive/thinking semantics, summary status precedence, hub completion propagation, and Web SSE cache updates.
expecting: If true, a newly connected blank session has active=true/thinking=false and maps to running, while an agent turn completion only sets thinking=false and has no completion marker path unless the whole runner exits.
next_action: Record root cause and return diagnose-only result.

## Symptoms
<!-- Written during gathering, then IMMUTABLE -->

expected: Mobile session list rows for running, thinking, waiting, error, completed unread, and viewed-completed states should each show exactly one compact accessible status indicator with correct color or spinner behavior. Model/effort text should not appear inline. Viewed completed rows should become gray.
actual: Creating a blank session immediately shows the busy spinning indicator. After agent output completes, the row still shows the busy spinning indicator instead of switching to the green completed/unread indicator.
errors: None reported beyond visible UI state.
reproduction: Test 4 in .planning/phases/01-cursor-runtime-config-contract/01-UAT.md during live mobile/web verification.
started: Discovered during UAT for phase 01-cursor-runtime-config-contract.

## Eliminated
<!-- APPEND only - prevents re-investigating -->

## Evidence
<!-- APPEND only - facts discovered -->

- timestamp: 2026-05-24T00:27:00+08:00
  checked: Common bug patterns
  found: Symptom maps to "Wrong data displayed" and likely State Management or Data Shape/API Contract categories.
  implication: First hypotheses should test stale UI/cache state and mismatched summary status fields.
- timestamp: 2026-05-24T00:31:00+08:00
  checked: shared/src/sessionSummary.ts and shared/src/sessionSummary.test.ts
  found: Completed and error status are derived only from Session.endReason, with completionMarker/errorMarker set from updatedAt only when statusKind is completed/error. Tests cover synthetic Session objects with endReason set.
  implication: Real runtime completion requires the hub to populate Session.endReason or send explicit statusKind/completionMarker patches.
- timestamp: 2026-05-24T00:33:00+08:00
  checked: web/src/components/SessionList/SessionListItem.tsx and web/src/hooks/useSSE.ts
  found: The row spinner renders only for statusKind running/thinking. useSSE can converge to completed only when a session-updated patch contains statusKind:"completed" plus completionMarker, or when a full Session payload yields toSessionSummary with endReason:"completed".
  implication: The Web layer is capable of rendering green completed dots, but only if the completion status reaches the cache through the expected contract.
- timestamp: 2026-05-24T00:36:00+08:00
  checked: CLI runner lifecycle and apiSession session-end emission
  found: Cursor runner sets sessionEndReason to "completed" on normal loop exit and sends socket event session-end with { sid, time, reason }.
  implication: The CLI supplies the completion truth; the loss occurs after the CLI emits it.
- timestamp: 2026-05-24T00:39:00+08:00
  checked: hub/src/sync/sessionLivenessService.ts, hub/src/sync/sessionCache.ts, hub/src/sync/syncEngineSession.ts
  found: SyncEngineSession accepts a reason-bearing payload, but SessionCache narrows handleSessionEnd to { sid, time }, and SessionLivenessService.handleSessionEnd ignores reason and emits only { active:false, thinking:false, backgroundTaskCount:0 }. SyncEngineSession separately emits session-ended with reason.
  implication: The live session-updated event never contains statusKind/completionMarker/errorMarker or a full Session with endReason, so the summary cache cannot become completed/unread.
- timestamp: 2026-05-24T00:41:00+08:00
  checked: hub store/session repository and Web SSE session-ended handling
  found: Hub session storage/schema/repository have no endReason field, and Web useSSE has no session-ended handling branch. Repository-created Session objects therefore cannot carry endReason into toSessionSummary, and the separate session-ended event is ignored by the session-list cache.
  implication: Completed/error summary states are unreachable in real hub/Web flow despite being represented in shared types and component tests.
- timestamp: 2026-05-24T00:43:00+08:00
  checked: Focused tests
  found: bun test hub/src/sync/sessionLivenessService.test.ts shared/src/sessionSummary.test.ts passed. The liveness test explicitly expects only active/thinking false on session end, while the summary test only covers synthetic endReason.
  implication: Existing tests confirm the split contract and miss the end-to-end handoff from real session-end reason to completion marker.
- timestamp: 2026-05-24T00:48:00+08:00
  checked: cli/src/agent/sessionBase.ts and cli/src/cursor/cursorRemoteLauncher.ts
  found: AgentSessionBase sends keepAlive immediately and every 2 seconds with the current thinking flag. CursorRemoteLauncher sets thinking true while a queued agent process runs, then sets thinking false and emits ready after the turn completes; the session object remains alive/active while waiting for more messages.
  implication: A blank connected session and a completed-but-still-open session are both active=true/thinking=false. The current status derivation treats both as running.

## Resolution
<!-- OVERWRITE as understanding evolves -->

root_cause: SessionSummary.statusKind conflates runner liveness with work activity. getSessionStatusKind maps any active session to "running" after only thinking and waiting checks, but Cursor sessions send keepAlive immediately and remain active while idle between prompts. Turn completion only flips thinking back to false and emits ready; it does not end the session. Separately, the completed marker implementation is tied to Session.endReason/session termination, but the hub does not persist endReason and Web ignores the separate session-ended event. Therefore a blank connected session and a just-finished turn both remain active=true/thinking=false and render the busy spinner, while the green unread completion marker is unreachable for normal live turn completion.
fix:
verification: Diagnosed only. Focused existing tests pass but demonstrate missing coverage for real session-end reason -> completion marker convergence.
files_changed: []
