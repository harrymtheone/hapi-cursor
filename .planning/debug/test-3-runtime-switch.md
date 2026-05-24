---
session: test-3-runtime-switch
phase: 01-cursor-runtime-config-contract
test: 3
status: diagnosed
updated: 2026-05-24T03:35:00Z
---

# Debug: Test 3 – Runtime model switch is not actually applied

## Symptom

User UAT report:
- Selecting a new model on an existing session shows `Applies next run`.
- Two visible behaviors of the "current model" label in the composer:
  1. Label switches to the new model name.
  2. Label flickers to the new model and reverts to the original.
- In both cases, asking the LLM ("what model are you?") confirms the **actual model in use is still the original model**.

Three-way consistency at session creation is fine (selected model = displayed model = actual LLM). The bug is **only on in-session switching**.

## Hypothesis (proven below)

The UI is allowed to surface a model-switch result (`applies-next-run`), and Hub persists the new model name into session metadata so it can render in the composer label, **but the CLI never updates the `--model` argument it actually passes to `agent` on the next message**. Therefore the next `agent` invocation continues to use the original model.

## Evidence from prior spike (agent-transcripts/f150696b)

User and prior agent verified empirically that Cursor CLI does support next-turn model switching in the same chat:

- Initial run: `agent -p "..." --model composer-2.5-fast …`
  - `system.init.model = "Composer 2.5 Fast"`, `session_id = bdfd9c25-…`
- Second run, same session: `agent -p "..." --resume bdfd9c25-… --model gpt-5.5-medium …`
  - `system.init.model = "GPT-5.5 272K Medium"`, `session_id = bdfd9c25-…`

So switching is technically possible by re-spawning `agent` with `--resume <same_id>` + new `--model`. **The hot-switch path is real; HAPI just isn't using it.**

## Root cause walk-through

1. `cli/src/cursor/runCursor.ts:147` — `currentModel` is captured once at startup as `const`:

```147:147:cli/src/cursor/runCursor.ts
    const currentModel = opts.model;
```

2. `cli/src/cursor/runCursor.ts:82-88` — `applyCursorSessionConfig()` returns `applies-next-run` for model changes but does **not** mutate `currentModel`, and there is no `syncModel` analog to the existing `syncPermissionMode`:

```82:89:cli/src/cursor/runCursor.ts
    return CursorRuntimeConfigApplyResultSchema.parse({
        status: 'applies-next-run',
        model: config.model,
        modelReasoningEffort: null,
        effort: null,
        reason: 'unknown'
    });
```

```183:194:cli/src/cursor/runCursor.ts
    session.rpcHandlerManager.registerHandler('set-session-config', async (payload: unknown) => {
        return applyCursorSessionConfig(payload, {
            currentPermissionMode,
            currentModel: currentModel ?? null,
            currentModelReasoningEffort: null,
            currentEffort: null,
            syncPermissionMode: (mode) => {
                currentPermissionMode = mode;
                syncSessionMode();
            }
        });
    });
```

3. `cli/src/cursor/session.ts:14,53` — `CursorSession.model` is `readonly`, set at construction:

```12:57:cli/src/cursor/session.ts
export class CursorSession extends AgentSessionBase<EnhancedMode> {
    readonly cursorArgs?: string[];
    readonly model?: string;
    …
    this.model = opts.model;
```

4. `cli/src/cursor/cursorRemoteLauncher.ts:96-103` — every next message rebuilds args from **`session.model`** (the readonly), not from `batch.mode.model` carried by the queue:

```96:103:cli/src/cursor/cursorRemoteLauncher.ts
            const args = buildAgentArgs({
                message,
                cwd: session.path,
                sessionId: cursorSessionId,
                mode: agentMode,
                model: session.model,
                yolo
            });
```

5. The queue does carry `mode.model`, but it’s populated from the same stale `currentModel`:

```168:175:cli/src/cursor/runCursor.ts
    session.onUserMessage((message, localId) => {
        const enhancedMode: EnhancedMode = {
            permissionMode: currentPermissionMode ?? 'default',
            model: currentModel
        };
```

### Why the UI label still changes

Hub's `SyncEngineSession.applySessionConfig` writes the new `model` into the session cache when the status is `applied` or `applies-next-run` (see Plan 01-05 summary), so SessionList/composer get a `session-updated` patch with the new model name. That patch flows into `StatusBar`'s big label. But because the CLI side never re-spawns `agent` with the new `--model`, the LLM continues to answer as the original model. The "flicker" variant happens when the optimistic local state collides with a subsequent `session-updated` patch.

## Root cause summary

The Phase 1 spike (transcript `f150696b`) proved Cursor CLI supports "same-session next-message model switch" via `--resume <id> --model <new>`. Plan 01-09 implemented the **UI gate and call site only**: discovery wiring, selector unlock, `setModel` mutation. It did **not** implement the **CLI mutation path** that the spike validated. The shipped semantic is dishonest: UI says the model has changed (or will change), Hub persists the new model name, but the next `agent` spawn keeps the old `--model`.

## Files involved

- `cli/src/cursor/runCursor.ts` – `currentModel` constant; `applyCursorSessionConfig` returns `applies-next-run` but never mutates `currentModel`; no `syncModel` analog to `syncPermissionMode`.
- `cli/src/cursor/session.ts` – `model` is `readonly`; no setter.
- `cli/src/cursor/cursorRemoteLauncher.ts` – `buildAgentArgs(..., model: session.model, ...)` uses the readonly snapshot instead of the latest `mode.model` from the message queue.
- `hub/src/sync/syncEngineSession.ts` – persists new model into metadata on `applies-next-run`, which is what makes the UI label change without the runtime actually switching.

## Suggested fix direction (for plan-phase --gaps)

1. Make `currentModel` mutable in `runCursor.ts`; add a `syncModel(model: string | null)` analog to `syncPermissionMode`; update it inside `applyCursorSessionConfig` on `applies-next-run`/`applied` paths.
2. Expose `CursorSession.setModel(model: string | null)` (drop `readonly`) and wire it from `syncModel` so the launcher source-of-truth changes for the next message.
3. In `cursorRemoteLauncher.runMainLoop`, use `batch.mode.model` (already on the queue) as the authoritative per-turn model, with `session.model` as fallback only.
4. Change the Hub/CLI apply-result for the model branch from `applies-next-run` to a more honest "applies on next message" semantic, since remote mode re-spawns `agent` per message. UI copy should say something like "Applies next message" instead of `Applies next run`.
5. Keep the composer label honest: until a `session-updated` patch confirms the new model has taken effect (or until the next message has been sent), show the **currently-effective** model prominently and the **pending target** as a secondary label. Avoid the flicker by not optimistically swapping the big label.
6. Add a regression test that posts `set-session-config { model: 'X' }` to a remote-mode session and asserts that the **next** `buildAgentArgs` call includes `--model X` while keeping `--resume <same_id>`.
