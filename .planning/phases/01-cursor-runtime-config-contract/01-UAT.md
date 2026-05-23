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
  - .planning/phases/01-cursor-runtime-config-contract/01-VERIFICATION.md
started: 2026-05-23T16:15:22Z
updated: 2026-05-23T16:32:07Z
---

## Current Test

[testing complete]

## Tests

### 1. Real Model Discovery UI
expected: Open the mobile PWA new-session panel with a local runner connected. The model selector shows raw Cursor model ids from the local Cursor runtime, keeps Auto (unspecified) available, and shows safe retry/error copy if discovery is unavailable.
result: pass

### 2. 真实指定模型启动
expected: 从移动端 UI 选择一个已发现的明确模型并启动真实 Cursor 会话。会话应正常启动，不回退到 Auto，并且会话详情或 composer 元数据显示该模型，且在持久化和实时更新后仍保持一致。
result: pass

### 3. 运行中模型切换状态真实性
expected: 在会话空闲时和忙碌时分别从 composer 请求模型切换。composer 模型框应真实显示 applied、pending、failed 或 applies-next-run，不应为切换结果新增聊天时间线消息。
result: issue
reported: "Switching unavailable for this runtime"
severity: major

### 4. 移动端会话状态扫描
expected: 检查移动端会话列表中的 running、thinking、waiting、error、completed unread 和 viewed-completed 状态。每行应只显示一个紧凑且可访问的状态指示器，颜色或 spinner 行为正确，模型/effort 文本不出现在行内，已查看完成状态变为灰色。
result: issue
reported: "创建一个空白会话，状态标识直接就是忙碌中（旋转标识）。agent输出完成之后，状态标识还是忙碌中（旋转标识），不会切换到绿色标识。"
severity: major

## Summary

total: 4
passed: 2
issues: 2
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "在会话空闲时和忙碌时分别从 composer 请求模型切换。composer 模型框应真实显示 applied、pending、failed 或 applies-next-run，不应为切换结果新增聊天时间线消息。"
  status: failed
  reason: "User reported: Switching unavailable for this runtime"
  severity: major
  test: 3
  root_cause: "The live session composer never receives runtimeModelSwitchSupported or discovered availableModelOptions. useHappyComposerState defaults runtime switch support to false, so canOpenModelSelector stays false and StatusBar renders the unavailable message before requests reach the Hub/CLI model config path."
  artifacts:
    - path: "web/src/components/SessionChat.tsx"
      issue: "Does not pass runtime support or discovered model options into HappyComposer."
    - path: "web/src/components/AssistantChat/useHappyComposerState.ts"
      issue: "Requires runtimeModelSwitchSupported and non-empty availableModelOptions, defaulting missing support to false."
    - path: "web/src/components/AssistantChat/StatusBar.tsx"
      issue: "Displays the reported unavailable string when the selector gate is closed."
    - path: "cli/src/cursor/runCursor.ts"
      issue: "Backend model config path can truthfully return applies-next-run, but frontend gate prevents reaching it."
  missing:
    - "Wire a real session-scoped runtime support signal into SessionChat -> HappyComposer."
    - "Wire discovered model options into the live session composer path."
    - "Allow current Cursor model requests to surface the existing applies-next-run result when hot switching is unsupported."
  debug_session: ".planning/debug/test-3-runtime-switch.md"
- truth: "检查移动端会话列表中的 running、thinking、waiting、error、completed unread 和 viewed-completed 状态。每行应只显示一个紧凑且可访问的状态指示器，颜色或 spinner 行为正确，模型/effort 文本不出现在行内，已查看完成状态变为灰色。"
  status: failed
  reason: "User reported: 创建一个空白会话，状态标识直接就是忙碌中（旋转标识）。agent输出完成之后，状态标识还是忙碌中（旋转标识），不会切换到绿色标识。"
  severity: major
  test: 4
  root_cause: "SessionSummary.statusKind treats runner liveness as busy work. getSessionStatusKind maps any active session to running, but Cursor sessions keep active=true while idle between prompts. Normal turn completion only flips thinking=false and keeps the session alive; completion markers are tied to session termination instead of assistant/result turn completion."
  artifacts:
    - path: "shared/src/sessionSummary.ts"
      issue: "Conflates active runner keepalive with running work."
    - path: "cli/src/agent/sessionBase.ts"
      issue: "Sends keepalive immediately and regularly, making blank connected sessions active."
    - path: "cli/src/cursor/cursorRemoteLauncher.ts"
      issue: "Marks turn completion as thinking=false/ready without ending the session."
    - path: "web/src/hooks/useSSE.ts"
      issue: "Only applies completed markers when explicit statusKind/completionMarker patches arrive."
  missing:
    - "Redefine list status around turn activity and unread result markers, not process liveness alone."
    - "Treat active=true with thinking=false and no pending work as idle/ready instead of spinner-running."
    - "Emit or derive a completion marker from assistant/result turn completion so live completed output can become green unread."
  debug_session: ".planning/debug/session-list-spinner-stuck.md"
