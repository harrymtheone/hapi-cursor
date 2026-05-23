# Phase 1: Cursor Runtime Config Contract - Context

**Gathered:** 2026-05-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 1 delivers the Cursor runtime config contract for mobile control: discover available Cursor models from the local Cursor runtime, start sessions with explicit model/effort only when the user chooses them, represent whether in-session model switching is genuinely available, and show high-signal session status in the mobile UI.

Important requirement correction from discussion: model/effort should be visible near the chat input/model control, not in the session list. This intentionally revises the original CURS-04 wording that said the mobile session list should show model/effort.

</domain>

<decisions>
## Implementation Decisions

### Model Discovery
- **D-01:** The trusted source for available models is the local Cursor CLI/runtime discovery result only. Do not ship an internal fallback list of common model names.
- **D-02:** Trigger model discovery when the new-session panel opens. Use a short cache, and show discovery failure directly inside the selector.
- **D-03:** If discovery fails overall or returns no usable models, show a short safe reason, a retry action, and allow the user to continue with "auto/unspecified model". Do not expose raw stderr in the normal mobile UI.
- **D-04:** Display the raw Cursor model id as the primary value. Lightweight labels or grouping are acceptable, but HAPI must not rename models in a way that hides the real id.

### Launch Config
- **D-05:** Default new-session runtime config is "auto/unspecified". Only pass and persist model/effort when the user explicitly chooses them.
- **D-06:** Treat effort as a Cursor runtime/model capability, not a HAPI-owned promise. Show effort controls only when Cursor discovery or verified runtime behavior confirms support; otherwise keep effort as auto/unspecified and do not invent common options.
- **D-07:** Model/effort chosen for a session should be visible near the chat input/model control. The session list should not show model.
- **D-08:** If Cursor rejects a selected model/effort at launch, fail clearly and explain that the selected config was not accepted. Do not silently fallback to another model or auto mode.

### In-Session Model Switching
- **D-09:** If true hot switching is available, the model information box can be clicked open as a selector. If true hot switching is not available, the box is read-only and cannot be opened.
- **D-10:** Switching feedback belongs inside the same model information box: applying, applied, failed. Failed state can expose a short reason and retry.
- **D-11:** Disable switching while the agent is busy, thinking, or running tools. Show that switching is available once the session is idle.
- **D-12:** Do not insert model-switch success/failure events into the chat timeline. Keep the timeline clean and update only the model information box/status.

### Session List Status
- **D-13:** The session list should use compact status indicators, not model/effort text. Running and thinking use spinner-style icons. Waiting for input and waiting for approval both use one yellow dot. Error uses a red dot. Completed/unread result uses a green dot.
- **D-14:** Status labels should be visually hidden or available through hover/accessibility labels. Normal mobile list rows should show only the icon/dot unless an error needs a short visible hint.
- **D-15:** A completed session shows green only while the completed result is unread. After the user opens/views it, the indicator becomes gray.
- **D-16:** If input and approval are both pending, show one yellow dot. The UI does not need separate priority or stacked indicators.

### Claude's Discretion
- Researcher/planner should verify the real Cursor CLI model discovery and hot-switch behavior before choosing final API shape.
- Planner may choose the smallest code path that preserves the decisions above, especially around existing `Session` fields and strict SSE patches.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Planning Source
- `.planning/PROJECT.md` - Project positioning, single-user Tailscale context, Cursor-only milestone goals, and no-backward-compatibility stance.
- `.planning/REQUIREMENTS.md` - v1.1 requirement source. Note that this context revises the Phase 1 interpretation of CURS-04: status remains in the session list, but model/effort belongs near the chat input/model control.
- `.planning/ROADMAP.md` - Active v1.1 phase boundary and success criteria for Phase 1.

### Codebase Maps
- `.planning/codebase/STACK.md` - Current stack and shared protocol package constraints.
- `.planning/codebase/ARCHITECTURE.md` - CLI -> Hub -> Web flow, session model, SSE pattern, and versioned update constraints.
- `.planning/codebase/INTEGRATIONS.md` - Cursor runtime wrapping and local-only integration context.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `shared/src/schemas.ts` already defines `Session.model`, `Session.modelReasoningEffort`, `Session.effort`, and strict `SessionPatchSchema` fields for live updates.
- `hub/src/sync/sessionConfigService.ts` already applies and persists model/effort/permissionMode changes, then emits a `session-updated` event.
- `hub/src/sync/rpcGateway.ts` already has `requestSessionConfig()` for web/hub -> CLI config requests.
- `cli/src/cursor/runCursor.ts` already registers a `set-session-config` RPC handler for Cursor sessions.
- `cli/src/cursor/cursorRemoteLauncher.ts` and `cli/src/cursor/cursorLocal.ts` already pass `--model` when a model is supplied.
- `web/src/hooks/useSSE.ts` already merges strict session patches, including effort/model-related fields.

### Established Patterns
- Shared protocol changes should be made in `shared/` first, then consumed atomically by CLI, Hub, and Web.
- Session config state should flow through existing session fields and strict SSE patches rather than ad hoc web-only state.
- Hub route handlers should go through `SyncEngine`/services rather than direct store writes.
- Mobile UI should remain honest about Cursor runtime behavior. Do not imply hot switching or effort support until verified.

### Integration Points
- Model discovery likely needs a CLI/runner-facing capability or RPC surfaced to Web when the new-session panel opens.
- Launch config should connect through existing runner spawn/session creation paths that already accept model/effort-like fields.
- The chat input/model control area is the canonical UI location for model/effort display and switching.
- Session list work should focus on attention/status indicators only, not model/effort display.

</code_context>

<specifics>
## Specific Ideas

- Model selector default label should effectively mean "auto" or "unspecified", not a hidden concrete model.
- The model information box is both status display and selector only when hot switching is proven available.
- Status indicator palette: spinner for running/thinking, yellow dot for waiting input/approval, red dot for error, green dot for unread completed result, gray after viewed.

</specifics>

<deferred>
## Deferred Ideas

None - discussion stayed within phase scope.

</deferred>

---

*Phase: 1-Cursor Runtime Config Contract*
*Context gathered: 2026-05-23*
