---
phase: 01-cursor-runtime-config-contract
plan: 18
subsystem: cursor-runtime
tags: [cursor, runtime-config, hot-switch, model, web, i18n]
dependency_graph:
  requires:
    - 01-05-SUMMARY.md (status enum lock — applies-next-run final)
    - 01-06-SUMMARY.md (Web model switch state propagation)
    - 01-09-SUMMARY.md (live composer runtime options + canOpenModelSelector gate)
  provides:
    - cli/src/cursor/runCursor.ts (mutable currentModel + syncModel callback)
    - cli/src/cursor/session.ts (CursorSession.setModel setter; model no longer readonly)
    - cli/src/cursor/cursorRemoteLauncher.ts (runMainLoop reads batch.mode.model ?? session.model)
    - web/src/components/AssistantChat/StatusBar.tsx (previousModel-gated BIG label)
    - web/src/components/SessionChat.tsx (previousModel capture + reset-on-confirm effect)
    - web/src/lib/locales/{en,zh-CN}.ts (composer.model.appliesNextMessage)
  affects:
    - web/src/components/AssistantChat/HappyComposer.test.tsx (locale literal sync)
tech-stack:
  added: []
  patterns:
    - "Optional state-mutation callback (`syncModel?`) mirrored on the `applyCursorSessionConfig` contract, analog of `syncPermissionMode`."
    - "Setter on session (`CursorSession.setModel`) mirrored after `setPermissionMode` for runtime model mutation."
    - "Per-turn `EnhancedMode.model` preference in `runMainLoop` with `session.model` fallback."
    - "UI-only gate (`previousModel`) preventing optimistic BIG-label flicker until Hub-delivered `session-updated` confirms."
key-files:
  created: []
  modified:
    - cli/src/cursor/runCursor.ts
    - cli/src/cursor/session.ts
    - cli/src/cursor/cursorRemoteLauncher.ts
    - cli/src/cursor/runCursor.test.ts
    - cli/src/cursor/cursorRemoteLauncher.test.ts
    - web/src/components/AssistantChat/StatusBar.tsx
    - web/src/components/AssistantChat/StatusBar.test.tsx
    - web/src/components/SessionChat.tsx
    - web/src/components/SessionChat.test.tsx
    - web/src/components/AssistantChat/HappyComposer.test.tsx
    - web/src/lib/locales/en.ts
    - web/src/lib/locales/zh-CN.ts
decisions:
  - "Web-side `previousModel` gate (not Hub-side schema change) closes UAT Test 3 flicker — meets goal with no shared-schema widening or hub plumbing."
  - "Shared `CursorRuntimeConfigApplyResult` status enum left unchanged ('applies-next-run' preserved); the rename is locale-only ('Applies next message' / '下一条消息生效')."
  - "Optional `syncModel?` (not required) on `applyCursorSessionConfig` state so the seven pre-existing test cases keep typechecking; production always supplies it from the set-session-config handler."
metrics:
  duration: ~12m
  completed: 2026-05-24
---

# Phase 01 Plan 18: Truthful In-Session Cursor Model Switch Summary

One-liner: Closed UAT Test 3 / CURS-03 by making the CLI runner actually apply the newly selected `--model` on the next `agent --resume` spawn, and by gating the Web composer BIG label on a captured `previousModel` so it stops flipping ahead of the model that answered the most recent turn.

## What changed

### CLI runtime (Task 2 — feat d5eebc2)

- `applyCursorSessionConfig` gained an OPTIONAL `syncModel?: (model: string | null) => void` callback on its `state` contract. The model branch now invokes `state.syncModel?.(config.model ?? null)` before returning the parsed `applies-next-run` result. Kept optional so the seven pre-existing unit cases keep typechecking and passing without modification.
- `runCursor` changed `const currentModel = opts.model` → `let currentModel: string | undefined = opts.model`. The `set-session-config` RPC handler now passes a `syncModel` callback that (a) mutates `currentModel` and (b) calls `sessionWrapperRef.current?.setModel(model)` so the launcher's source-of-truth is updated.
- `CursorSession.model` is no longer `readonly`; new `setModel = (model: string | null) => { this.model = model ?? undefined }` arrow-property setter mirrors `setPermissionMode`.
- `cursorRemoteLauncher.runMainLoop` now builds agent args with `model: batch.mode.model ?? session.model` so the next `agent -p ... --resume <same_session_id> --model <new>` spawn picks up the per-turn model that the queue carried.

### Web composer (Task 3 — feat 9d4f4b8)

- `ModelSwitchState` gained optional `previousModel?: string | null`.
- `StatusBar.modelLabel` is now gated: while `modelSwitchState.status` is one of `applying | pending | applies-next-run` AND `previousModel !== undefined`, the BIG label and `aria-label` use `previousModel`; for `idle | applied | failed` it falls back to `props.model`. The Auto-fallback rule (`t('newSession.model.autoUnspecified')`) applies to both inputs.
- `SessionChat.handleModelChange` captures `previousModel = props.session.model ?? null` BEFORE initiating the switch and carries it through every `setModelSwitchState(...)` call (applying, post-`setModel` resolved state, AND catch-branch failure).
- `SessionChat` gained a tight reset effect that drops `modelSwitchState` back to `{ status: 'idle' }` once the Hub-delivered `session.model` patch equals `modelSwitchState.targetModel` — the gate releases atomically with no in-between flicker.
- Locale rename: `composer.model.appliesNextRun` → `composer.model.appliesNextMessage`. en = "Applies next message"; zh-CN = "下一条消息生效". No backward-compat key kept (per AGENTS.md / single-user policy).

### Tests (Task 1 RED — test 864640f; carried through Tasks 2/3)

- CLI (Vitest): `syncModel` callback case + sentry (permission-only payload does not call syncModel); `CursorSession.setModel` mutation case; `buildAgentArgs` per-turn `mode.model` precedence with `--resume` preserved.
- Web (Vitest): big-label-stays-on-previousModel under `applies-next-run` / `applying` even when `props.model` has already optimistically flipped to the target; atomic transition to the target on `idle`; locale rename rendered in both en and zh-CN; `handleModelChange` captures `previousModel: 'cursor-old'` and forwards it through `modelSwitchState`.
- Pre-existing tests updated to (a) the renamed copy and (b) carry `previousModel` in `modelSwitchState` equality assertions: `web/src/components/AssistantChat/{StatusBar,HappyComposer}.test.tsx`, `web/src/components/SessionChat.test.tsx`.

## Why this closes UAT Test 3

Root cause from `.planning/debug/test-3-runtime-switch.md`: `currentModel` captured as `const`, `CursorSession.model` readonly, `cursorRemoteLauncher` reading `session.model`, no `syncModel` plumbing → the next `agent` spawn always re-resolved to the original model. Hub already persisted the new model on `applies-next-run`, which is what made the composer label flicker while the LLM kept answering as the original model.

This plan exercises the Phase 1 spike (`agent-transcripts/f150696b`) that proved `agent -p ... --resume <same_session_id> --model <new>` truly switches the live model on the next turn, and pairs it with a Web-only gate on the BIG label so the visible label stays honest until Hub confirms.

## Deviations from Plan

### Auto-fixed Issues

1. **[Rule 1 — Test sync] Updated pre-existing test literals to the renamed locale key and to carry the new `previousModel` field.**
   - Found during: Task 3 GREEN test run.
   - Issue: Pre-existing tests (`HappyComposer.test.tsx:168`, `StatusBar.test.tsx:94`, and three SessionChat equality assertions) referenced `'Applies next run'` and `modelSwitchState` shapes without `previousModel`, causing test failures after Task 3.
   - Fix: Updated the literals to `'Applies next message'` and added `previousModel: 'cursor-old'` to the existing equality assertions matching the new contract.
   - Files modified: `web/src/components/AssistantChat/HappyComposer.test.tsx`, `web/src/components/AssistantChat/StatusBar.test.tsx`, `web/src/components/SessionChat.test.tsx`.
   - Commit: 9d4f4b8.

### Plan-vs-implementation notes

- The plan said "reset to `{ status: 'idle' }` immediately after `setModel` resolves with `status: 'applied'`". After confirming the pre-existing test at `SessionChat.test.tsx` line ~188 explicitly asserts `{ status: 'applied', targetModel: 'cursor-next' }` is forwarded to the composer (and `applied` is rare for Cursor's `applies-next-run` path anyway), we kept the `applied` state populated rather than resetting to idle. The `applies-next-run` → idle transition is now driven entirely by the `useEffect` reset path watching `props.session.model === modelSwitchState.targetModel`. This eliminates the flicker without breaking the contract that `applied` is observable.

## Authentication gates

None. No package installs. No user secrets touched.

## Self-Check: PASSED

- `cli/src/cursor/runCursor.ts` — FOUND (modified; `syncModel?` field, optional-chained call site, registration in `set-session-config` handler).
- `cli/src/cursor/session.ts` — FOUND (modified; `readonly` removed, `setModel` setter added).
- `cli/src/cursor/cursorRemoteLauncher.ts` — FOUND (modified; `batch.mode.model ?? session.model`).
- `web/src/components/AssistantChat/StatusBar.tsx` — FOUND (modified; `previousModel` field + gated `modelLabel`).
- `web/src/components/SessionChat.tsx` — FOUND (modified; capture + reset effect).
- `web/src/lib/locales/en.ts`, `web/src/lib/locales/zh-CN.ts` — FOUND (locale rename).
- Commit 864640f — FOUND in `git log --oneline -5`.
- Commit d5eebc2 — FOUND.
- Commit 9d4f4b8 — FOUND.

## Verification commands run

- `cd cli && bun run test -- runCursor cursorRemoteLauncher` — PASS (16 tests).
- `cd web && bun run test -- StatusBar SessionChat HappyComposer` — PASS (41 tests).
- `bun run typecheck` — PASS (cli + web + hub).
- `bash scripts/check-no-cut-agents.sh` — PASS (Phase 10/11/12 guards green).
- `bun run madge:check` — PASS (no circular dependency).
- `bun run test` (full repo) — 278 passed / 12 failed; the 12 failures are all in `hub/src/runner/runner.integration.test.ts` (pre-existing runner-infra `Hook timed out` failures unrelated to this plan; see Deferred Issues).

## Deferred Issues

- `hub/src/runner/runner.integration.test.ts` — 12 integration tests timing out in `beforeEach` (hook timeout 10000ms). Pre-existing, unrelated to runtime-config / model-switch surface area. Out of scope for this plan; tracked as a runner-infra concern.

## Gitnexus

- Pre-edit `impact` (upstream) findings: `applyCursorSessionConfig` LOW, `buildAgentArgs` LOW, `CursorSession` MEDIUM, `StatusBar` HIGH. All edits were additive (new optional fields / new setter / per-turn arg preference); no signature-breaking changes for upstream callers.
- Post-edit `detect_changes` (repo: hapi-cursor): `changed_count: 0, affected_count: 0, risk_level: low` (the analyzer hasn't reindexed the new diff but no symbols were renamed or removed — only additive mutations).
