---
quick_id: 260525-ctq
status: complete
---

# Quick Task 260525-ctq — Summary

**Task:** 缩小 chat session 模型选择弹窗，对齐 Cursor Desktop 紧凑样式

## Changes

- Split overlays: status-bar model pill → model picker only; gear → permission mode only.
- Narrow popups (`260px` / `240px`), right/left aligned like Cursor.
- Model list: checkmark rows, click to select, compact Edit link; removed bulky Select buttons.
- Reduced padding, `text-xs`, lower maxHeight.

## Verification

- `vitest run` on ModelPickerOverlay, HappyComposer, useHappyComposerState — 45 passed
