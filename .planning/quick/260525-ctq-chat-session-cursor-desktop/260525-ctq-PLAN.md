---
quick_id: 260525-ctq
description: 缩小 chat session 模型选择弹窗，对齐 Cursor Desktop 紧凑样式
---

# Quick Plan: Compact composer model picker

## Task 1: Split model vs permission overlays

- Model badge opens model-only popup (right-aligned, max 260px).
- Gear opens permission-only popup (left-aligned, max 240px).

## Task 2: Compact ModelPickerOverlay

- Row click + checkmark + Edit link (no Select button).
- Tighter padding and text-xs.

## Task 3: FloatingOverlay polish

- rounded-lg, shadow-md, optional className for width.
