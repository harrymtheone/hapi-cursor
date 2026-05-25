# Phase 01.2 — Fix durable tool call projection in Hub

Inserted after Phase 01.1 (2026-05-25). Source: live bug investigation of result-only tool cards rendering as generic `Tool` entries in Web.

## Problem

Web currently reconstructs tool cards by pairing `tool-call` start messages with `tool-call-result` messages inside the loaded message window. If pagination, reload, reconnect, or event conversion leaves only the result-side message visible, Web falls back to a generic `Tool` placeholder because the result payload does not carry enough tool identity.

## Goal

Hub maintains a canonical tool call projection keyed by `callId`, preserving raw/standardized messages while exposing merged tool call state for stable Web rendering.

## Success Criteria

1. Hub persists raw/standardized agent messages as today and additionally maintains merged tool call state by `callId`.
2. A completed tool call projection includes tool name, input, status, result/error, created/start/completion timestamps, and enough metadata for Web tool cards.
3. Web can render correct tool name/input/result after refresh, SSE reconnect, or pagination when the visible message window contains only the result-side message.
4. Existing normal start+result tool rendering remains unchanged, including grouped tool activity.

## Next

`/gsd-spec-phase 01.2 --text`
