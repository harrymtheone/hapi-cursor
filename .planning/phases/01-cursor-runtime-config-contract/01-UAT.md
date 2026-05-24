---
status: complete
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
  - .planning/phases/01-cursor-runtime-config-contract/01-18-SUMMARY.md
  - .planning/phases/01-cursor-runtime-config-contract/01-19-SUMMARY.md
  - .planning/phases/01-cursor-runtime-config-contract/01-20-SUMMARY.md
  - .planning/phases/01-cursor-runtime-config-contract/01-21-SUMMARY.md
started: 2026-05-24T14:06:18Z
updated: 2026-05-24T14:32:55Z
---

## Current Test

[testing complete]

## Tests

### 1. Cold Start Smoke Test
expected: Kill any running hub/web/runner service if needed, then start the app from scratch. The Hub boots without errors, the SQLite store opens with the current schema, the Web PWA loads, and the primary sessions view/API returns live session data instead of a migration, schema, or startup failure.
result: pass

### 2. Real Model Discovery UI
expected: Open the mobile PWA new-session panel with an online local runner selected. The model selector keeps Auto (unspecified) available, fetches runtime-owned raw Cursor model ids from the selected machine, shows loading/empty/safe retry states when appropriate, and never shows a static fallback catalog, raw stderr, or process output.
result: pass

### 3. Explicit Model Launch
expected: Choose a discovered raw Cursor model id in the new-session panel and start a real Cursor session. The launch should not fall back to Auto, the session/composer metadata should show that raw model id, and the request path should send only the selected model with no unsupported effort/modelReasoningEffort field.
result: pass

### 4. In-Session Model Switch Truth
expected: In an idle existing session, open the composer model selector, choose another discovered raw Cursor model id, and send the next message. The composer should show neutral "applies next message" feedback without timeline spam or optimistic label flicker; the next Cursor resume call should actually use the selected model, while the visible current-model label should remain honest until the Hub-delivered session update confirms it.
result: pass

### 5. Effort Metadata Is Display-Only
expected: New-session and composer UI should not expose effort/modelReasoningEffort controls or send unsupported effort payloads. Existing effort metadata may appear only as read-only session/runtime information, and any effort-only runtime config attempt should return a safe failed/unsupported status without persisting unsupported effort as applied config.
result: pass

### 6. Mobile Session Status And Viewed Completion
expected: With multiple sessions visible, running/thinking sessions show a spinner, idle connected sessions show gray/inactive state, waiting/error/completed states use the compact accessible indicators, and status changes for non-selected sessions still update while one chat is open. A completed session turns green until opened/viewed, then gray; after page refresh/reconnect/refetch, viewed completions stay gray while a new completion marker becomes green again.
result: pass

## Summary

total: 6
passed: 6
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

[none yet]
