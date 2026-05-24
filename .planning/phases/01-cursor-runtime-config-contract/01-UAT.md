---
status: diagnosed
phase: 01-cursor-runtime-config-contract
source:
  - .planning/phases/01-cursor-runtime-config-contract/01-01-SUMMARY.md
  - .planning/phases/01-cursor-runtime-config-contract/01-02-SUMMARY.md
  - .planning/phases/01-cursor-runtime-config-contract/01-03-SUMMARY.md
  - .planning/phases/01-cursor-runtime-config-contract/01-04-SUMMARY.md
  - .planning/phases/01-cursor-runtime-config-contract/01-05-SUMMARY.md
  - .planning/phases/01-cursor-runtime-config-contract/01-06-SUMMARY.md
  - .planning/phases/01-cursor-runtime-config-contract/01-07-SUMMARY.md
  - .planning/phases/01-cursor-runtime-config-contract/01-08-SUMMARY.md
  - .planning/phases/01-cursor-runtime-config-contract/01-09-SUMMARY.md
  - .planning/phases/01-cursor-runtime-config-contract/01-10-SUMMARY.md
  - .planning/phases/01-cursor-runtime-config-contract/01-11-SUMMARY.md
  - .planning/phases/01-cursor-runtime-config-contract/01-12-SUMMARY.md
  - .planning/phases/01-cursor-runtime-config-contract/01-13-SUMMARY.md
  - .planning/phases/01-cursor-runtime-config-contract/01-14-SUMMARY.md
  - .planning/phases/01-cursor-runtime-config-contract/01-15-SUMMARY.md
  - .planning/phases/01-cursor-runtime-config-contract/01-16-SUMMARY.md
  - .planning/phases/01-cursor-runtime-config-contract/01-17-SUMMARY.md
started: 2026-05-24T02:59:59Z
updated: 2026-05-24T03:35:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Real Model Discovery UI
expected: Open the mobile PWA new-session panel with a local runner connected. The model selector should keep Auto (unspecified) available, show raw Cursor runtime model ids discovered from the selected online runner, and show safe retry/error copy if discovery is unavailable. There should be no static fallback model catalog and no raw stderr or process output in the UI.
result: pass

### 2. 真实指定模型启动
expected: 从移动端 UI 选择一个已发现的明确模型并启动真实 Cursor 会话。会话应正常启动，不回退到 Auto；会话详情或 composer 元数据显示该 raw model id；自动模式不发送 model，明确选择时只发送 model，不发送 unsupported effort 字段。
result: pass

### 3. 运行中模型切换状态真实性
expected: 在已有会话空闲时打开 composer 模型框，应能看到 Auto 和已发现的 raw Cursor model ids；选择明确模型后，composer 状态应真实显示 applied、pending、failed 或 applies-next-run。切换结果不应新增聊天时间线消息；如果 runtime 不支持热切换，应显示 applies-next-run 或安全失败状态，而不是泛化的 unavailable 门禁。
result: issue
reported: "创建 session 时选择的模型、chat 中显示的模型、实际调用的模型一致。chat 中支持切换模型，点击切换后会显示 applies next run，但出现两种表现：一种是当前模型名称切换成新模型，直接询问 LLM 表明实际调用仍是最初模型；另一种是当前模型只变化一瞬间然后变回最初模型，直接询问 LLM 表明实际调用仍是最初模型。"
severity: major

### 4. Effort Metadata Is Display-Only
expected: 新建会话和运行中 composer 不应提供或发送 unsupported effort/modelReasoningEffort 修改入口。已有 session/runtime 中的 effort metadata 可以只读显示；如果尝试 unsupported effort-only runtime config，系统应返回安全 failed/unsupported 状态，不应把它持久化为已应用配置。
result: pass

### 5. 移动端会话状态与完成标记
expected: 检查移动端会话列表中的 idle、thinking/running、waiting、error、completed unread 和 viewed-completed 状态。空白但已连接的会话应显示 idle/灰色而不是旋转忙碌；agent 输出完成后应出现绿色 unread completed 标记；打开查看后变灰；刷新、重连或列表 refetch 后完成标记仍保持；发送新消息后旧完成标记清除并回到新工作状态。
result: issue
reported: "1. 在 agent running 的时候，正确切换到 spinner。如果保持在当前 chat session，spinner 正确切换到灰色点。如果切换到其他 chat session，spinner 不会自动切换，即使 agent 任务完成。2. 当页面有多个 chat session 的时候，进入一个 chat session 可以正确地将绿色点变成灰色点。一旦刷新页面，除了当前 chat session 的所有灰色点又变成了绿色点。"
severity: major

## Summary

total: 5
passed: 3
issues: 2
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "在已有会话空闲时打开 composer 模型框，应能看到 Auto 和已发现的 raw Cursor model ids；选择明确模型后，composer 状态应真实显示 applied、pending、failed 或 applies-next-run。切换结果不应新增聊天时间线消息；如果 runtime 不支持热切换，应显示 applies-next-run 或安全失败状态，而不是泛化的 unavailable 门禁。"
  status: failed
  reason: "User reported: 创建 session 时选择的模型、chat 中显示的模型、实际调用的模型一致。chat 中支持切换模型，点击切换后会显示 applies next run，但出现两种表现：一种是当前模型名称切换成新模型，直接询问 LLM 表明实际调用仍是最初模型；另一种是当前模型只变化一瞬间然后变回最初模型，直接询问 LLM 表明实际调用仍是最初模型。"
  severity: major
  test: 3
  root_cause: "Plan 01-09 wired the UI selector and Hub metadata persistence for in-session model switch, but the CLI runner path never adopts the new model. `currentModel` in cli/src/cursor/runCursor.ts is captured as a const at startup; `applyCursorSessionConfig()` returns status `applies-next-run` for model changes but does not mutate `currentModel` (no `syncModel` analog to `syncPermissionMode`). `CursorSession.model` is `readonly`. cursorRemoteLauncher's `buildAgentArgs(..., model: session.model, ...)` reuses the readonly snapshot instead of the per-turn `mode.model` carried by the message queue. Hub persists the new model into session metadata on `applies-next-run`, so the composer label flips (or flickers), but the next `agent` re-spawn keeps the original `--model`, so the actual LLM never changes. The Phase 1 spike (agent-transcripts/f150696b) already proved that `agent -p ... --resume <same_session_id> --model <new>` switches the live model on the next turn, but that path is not exercised by the implementation."
  artifacts:
    - path: "cli/src/cursor/runCursor.ts"
      issue: "`currentModel` is `const`; `applyCursorSessionConfig()` returns `applies-next-run` for model changes but never mutates `currentModel` and has no `syncModel` callback (compare `syncPermissionMode` at lines 189-192)."
    - path: "cli/src/cursor/session.ts"
      issue: "`readonly model?: string;` set at construction; no setter, so the launcher cannot read a freshly chosen model."
    - path: "cli/src/cursor/cursorRemoteLauncher.ts"
      issue: "`buildAgentArgs({ ..., model: session.model, ... })` uses the readonly construction-time model instead of `batch.mode.model` from the message queue, so each next `agent -p ... --resume <id>` spawn keeps the old `--model`."
    - path: "hub/src/sync/syncEngineSession.ts"
      issue: "Persists the requested model into session metadata on `applies-next-run`, which feeds the StatusBar label and creates the impression of a successful switch while the CLI is still running the old model."
  missing:
    - "Make `currentModel` mutable in runCursor.ts and add a `syncModel(model)` analog to `syncPermissionMode`; update it on `applies-next-run`/`applied` model branches inside `applyCursorSessionConfig`."
    - "Expose `CursorSession.setModel(model)` (drop `readonly`) and have `syncModel` call it so the launcher source-of-truth is updated for the next turn."
    - "In cursorRemoteLauncher.runMainLoop, prefer `batch.mode.model` (already on the queue) over `session.model` for `buildAgentArgs(...)` so each next message uses the latest chosen model with the same `--resume <session_id>`."
    - "Change the model-branch apply-result semantic from `applies-next-run` to a `applies-next-message` style status (and update Web copy accordingly) since remote mode re-spawns `agent` per message; alternatively, return `applied` after the next successful spawn confirms the new model in `system.init.model`."
    - "Keep the composer's primary model label tied to the currently-effective runtime model. Display the pending/target model as a secondary label so the big label does not flip or flicker until a `session-updated` patch confirms the new model is in use."
    - "Add a regression test: post `set-session-config { model: 'X' }` to a remote-mode session and assert the next `buildAgentArgs` call contains `--model X` plus `--resume <same_session_id>`."
  debug_session: ".planning/debug/test-3-runtime-switch.md"
- truth: "检查移动端会话列表中的 idle、thinking/running、waiting、error、completed unread 和 viewed-completed 状态。空白但已连接的会话应显示 idle/灰色而不是旋转忙碌；agent 输出完成后应出现绿色 unread completed 标记；打开查看后变灰；刷新、重连或列表 refetch 后完成标记仍保持；发送新消息后旧完成标记清除并回到新工作状态。"
  status: failed
  reason: "User reported: 1. 在 agent running 的时候，正确切换到 spinner。如果保持在当前 chat session，spinner 正确切换到灰色点。如果切换到其他 chat session，spinner 不会自动切换，即使 agent 任务完成。2. 当页面有多个 chat session 的时候，进入一个 chat session 可以正确地将绿色点变成灰色点。一旦刷新页面，除了当前 chat session 的所有灰色点又变成了绿色点。"
  severity: major
  test: 5
  root_cause: "Two independent gaps. (1) web/src/App.tsx narrows the SSE subscription to `{ sessionId: selectedSessionId }` whenever a chat session is open, so the Hub only streams events for that session. session-updated patches for other sessions (status going running→idle or completed) never reach the client while the user is inside any one session, so the SessionList shows stale spinners until the user navigates back to a list-only route. (2) web/src/components/SessionList.tsx stores `viewedCompletionMarkers` as plain React `useState` initialized to `{}`. On page refresh the map starts empty; only the currently selected session is re-marked via the effect at lines 103-111. Every other completed session is treated as unread (green) because its marker is no longer in the map. The team intentionally chose to keep viewed/read state local (Plan 01-08 SUMMARY), but never added browser-side persistence to survive refresh/reload."
  artifacts:
    - path: "web/src/App.tsx"
      issue: "`eventSubscription` uses `{ sessionId: selectedSessionId }` when a session page is open; only `{ all: true }` keeps the global session list converging."
    - path: "web/src/hooks/useSSE.ts"
      issue: "Single EventSource per `subscriptionKey`. When the subscription narrows to one session id, list-level session-updated patches for other sessions are not delivered."
    - path: "web/src/components/SessionList.tsx"
      issue: "`viewedCompletionMarkers` is React-only state with no localStorage/IndexedDB persistence; only the currently selected session is auto-restored on mount."
  missing:
    - "Keep a global session-list status feed alive even while a chat session is open: either always subscribe to `{ all: true }` (and let the open-session view add a second subscription) or have the Hub include list-status patches on session-scoped streams."
    - "Persist `viewedCompletionMarkers` to localStorage (or IndexedDB) keyed by `{ sessionId, completionMarker }`; restore on SessionList mount before rendering rows; prune entries whose session is gone."
    - "Add a regression test for stale list status: simulate a `session-updated { statusKind: 'completed' }` event arriving while the user is on a session page, assert the SessionList row reflects the new status."
    - "Add a regression test for viewed-marker persistence: seed localStorage with viewed markers, mount SessionList, assert sessions render as viewed (gray) without manual click."
  debug_session: ".planning/debug/session-list-spinner-stuck.md"
