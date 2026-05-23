# Phase 1: Cursor Runtime Config Contract - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md - this log preserves the alternatives considered.

**Date:** 2026-05-23
**Phase:** 1-Cursor Runtime Config Contract
**Areas discussed:** 模型列表来源与展示, 启动配置契约, 会话内模型切换语义, session 列表信息密度

---

## 模型列表来源与展示

**User's choices:**
- Trust only local Cursor CLI/runtime discovery. No built-in fallback model list.
- Trigger discovery when the new-session panel opens.
- On discovery failure, show a short safe reason, retry, and allow auto/unspecified model.
- Preserve raw model id as primary display value, with only light labels/grouping.

**Notes:** The user clarified that discovery failure means discovery as a whole failed or found no models. A single selected model failing later belongs to launch/switch failure handling.

---

## 启动配置契约

**User's choices:**
- Default model/effort is auto/unspecified.
- Show effort only when Cursor discovery or verified runtime behavior confirms support.
- Display chosen model/effort near the chat input. Do not show model in the session list.
- If selected config is rejected at launch, fail clearly and do not silently fallback.

**Notes:** This intentionally revises the current roadmap wording for CURS-04. The session list still shows status, but not model/effort.

---

## 会话内模型切换语义

**User's choices:**
- If hot switching is supported, the model information box can open into a selector. If not, it is read-only.
- Show applying/applied/failed inside the model information box.
- Disable switching while the agent is busy, thinking, or running tools.
- Do not add switch events to the chat timeline.

**Notes:** Runtime truth is more important than offering a control that might only appear to work.

---

## session 列表信息密度

**User's choices:**
- Use icons/dots for status: spinner for running/thinking, yellow dot for waiting input/approval, red dot for error, green dot for unread completed result.
- Keep visible rows compact: icon/dot only, with hover/accessibility labels.
- After the user opens a completed result, green becomes gray.
- Waiting input and waiting approval both map to one yellow dot.

**Notes:** The session list is a scan surface for attention/status, not a model metadata surface.

---

## Claude's Discretion

- Verify Cursor CLI model discovery and hot-switch behavior before locking exact API shape.
- Prefer the existing shared `Session` fields and strict SSE patch path where possible.

## Deferred Ideas

None.
