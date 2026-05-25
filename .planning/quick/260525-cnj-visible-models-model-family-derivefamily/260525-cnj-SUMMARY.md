---
quick_id: 260525-cnj
status: complete
---

# Quick Task 260525-cnj — Summary

**Task:** 修复 visible models 设置页重复显示同名 model family（deriveFamilyKey 对 gpt-5.x 分组过细）

## What changed

- `deriveFamilyKey` now rolls plain `gpt-{version}-*` effort variants into `gpt-{version}`.
- Added `gpt-{version}-codex-max` family key (before generic codex rule).
- `gpt-{version}-mini|nano` stay as separate size-tier families.

## Verification

- `vitest run src/lib/cursorModelFamilies.test.ts` — 13 passed
- Live `agent models`: 24 families, 0 duplicate display names (was 36 / 4 dupes)

## Commits

Code commit created by orchestrator after this summary.
