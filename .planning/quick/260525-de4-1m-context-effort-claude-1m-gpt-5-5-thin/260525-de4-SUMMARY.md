---
quick_id: 260525-de4
status: complete
---

# Quick Task 260525-de4 — Summary

## Fixes

1. **Context UI** — 272K / 1M chip group (like Effort), not a single checkbox.
2. **Claude 1M off** — Unchecking no longer leaves `context1m` undefined; `false` selects standard-context variants when Cursor lists them. Opus 4.7 discovery is all-1M labels today, so 272K stays disabled if no standard variant exists.
3. **Thinking** — Option probes merge current effort/context/fast selection. GPT-5.5: Cursor `agent models` has no `-thinking` ids; Thinking row hidden when unsupported.

## Verification

- `vitest` cursorModelFamilies + ModelPickerOverlay — 39 passed
