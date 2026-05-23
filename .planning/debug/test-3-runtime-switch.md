---
status: diagnosed
trigger: "UAT Test 3 gap: composer in-session model switching expected truthful applied/pending/failed/applies-next-run state with no new chat timeline messages; actual visible UI/status message is 'Switching unavailable for this runtime'. Goal: find_root_cause_only."
created: 2026-05-24T00:26:00+08:00
updated: 2026-05-24T00:45:00+08:00
---

## Current Focus

hypothesis: "SessionChat never supplies runtimeModelSwitchSupported or availableModelOptions to HappyComposer, so useHappyComposerState defaults runtime support to false and StatusBar renders the read-only unavailable hint before any model switch request can reach the API."
test: "Trace all references to runtimeModelSwitchSupported, availableModelOptions, and switchingUnavailable across Web, then compare with backend applySessionConfig behavior."
expecting: "If confirmed, only tests/harnesses pass these props; production SessionChat and router do not, while backend/CLI would return applies-next-run if a model request were sent."
next_action: "Return root-cause-only diagnosis to orchestrator; do not apply fixes."

## Symptoms

expected: "In idle and busy sessions, requesting model changes from the composer should truthfully show applied, pending, failed, or applies-next-run in the composer model box, and should not create new chat timeline messages."
actual: "Visible UI/status message: Switching unavailable for this runtime"
errors: "None reported beyond the visible UI/status message."
reproduction: "Test 3 in .planning/phases/01-cursor-runtime-config-contract/01-UAT.md during live mobile/web verification."
started: "Discovered during UAT for phase 01-cursor-runtime-config-contract."

## Eliminated

- hypothesis: "The visible message is a backend or CLI runtime failure response from the model switch API."
  evidence: "StatusBar renders the exact localized string when canOpenModelSelector is false and no modelSwitchState exists. SessionChat handleModelChange would set modelSwitchState to applying before calling ApiClient.setModel, which would suppress the read-only hint."
  timestamp: 2026-05-24T00:45:00+08:00

## Evidence

- timestamp: 2026-05-24T00:34:00+08:00
  checked: ".planning/phases/01-cursor-runtime-config-contract/01-UAT.md and .planning/STATE.md"
  found: "UAT Test 3 expected composer-local applied/pending/failed/applies-next-run status and observed 'Switching unavailable for this runtime'. STATE records runtimeModelSwitchSupported as the authoritative composer selector gate and says active model/effort changes should report applies-next-run until a proven hot-switch path exists."
  implication: "The UI should allow a truthful switch request path when runtime support is known; 'unavailable' is only correct when the authoritative gate is false or absent."
- timestamp: 2026-05-24T00:36:00+08:00
  checked: "web/src/components/AssistantChat/useHappyComposerState.ts"
  found: "runtimeModelSwitchSupported defaults to false, hasRuntimeModelOptions requires availableModelOptions.length > 0, and canOpenModelSelector requires onModelChange && runtimeModelSwitchSupported && hasRuntimeModelOptions && idle && !controlsDisabled."
  implication: "If SessionChat omits either runtimeModelSwitchSupported or availableModelOptions, the composer model selector is always closed even when the session is idle."
- timestamp: 2026-05-24T00:38:00+08:00
  checked: "web/src/components/SessionChat.tsx and web/src/router.tsx"
  found: "SessionChat passes model, modelReasoningEffort, effort, modelSwitchState, and onModelChange to HappyComposer, but does not pass runtimeModelSwitchSupported or availableModelOptions. The router also passes no discovery/capability props into SessionChat."
  implication: "Production session chat cannot satisfy the authoritative runtime switch gate; the gate remains closed by default."
- timestamp: 2026-05-24T00:39:00+08:00
  checked: "workspace references for runtimeModelSwitchSupported and availableModelOptions"
  found: "Only HappyComposer/useHappyComposerState props and tests reference runtimeModelSwitchSupported. useCursorModels is used by NewSession, but not by SessionChat or router."
  implication: "The discovered model list and runtime support signal are not wired into the live session composer."
- timestamp: 2026-05-24T00:41:00+08:00
  checked: "web/src/components/AssistantChat/StatusBar.tsx and locale strings"
  found: "StatusBar sets showReadOnlyHint = !canOpenModelSelector && !modelSwitchLabel and renders t('composer.model.switchingUnavailable'), whose English text is exactly 'Switching unavailable for this runtime'."
  implication: "The reported UI text is generated locally from the closed selector gate, not from a switch mutation result."
- timestamp: 2026-05-24T00:43:00+08:00
  checked: "hub/src/web/routes/sessions/config.ts, hub/src/sync/syncEngineSession.ts, cli/src/cursor/runCursor.ts"
  found: "If a model request is sent, Hub calls applySessionConfig. Active sessions route through RPC to CLI applyCursorSessionConfig, which returns CursorRuntimeConfigApplyResult status 'applies-next-run' for model/modelReasoningEffort/effort requests. Inactive sessions also return 'applies-next-run'."
  implication: "The backend/CLI contract can produce the UAT-allowed applies-next-run state; the UI gate prevents users from reaching it."

## Resolution

root_cause: "The live composer switch UI is permanently gated off because SessionChat does not provide the authoritative runtimeModelSwitchSupported capability or any discovered availableModelOptions to HappyComposer. useHappyComposerState therefore falls back to runtimeModelSwitchSupported=false and hasRuntimeModelOptions=false, making canOpenModelSelector false. StatusBar then renders the read-only fallback 'Switching unavailable for this runtime' before any model switch request can call ApiClient.setModel, so the backend's truthful applies-next-run response is never surfaced."
fix: "Not applied; goal is find_root_cause_only."
verification: "Static trace confirmed the reported text is rendered by StatusBar's read-only gate, production SessionChat/router omit both required gate inputs, and backend/CLI would return applies-next-run if the request path were invoked."
files_changed: []
