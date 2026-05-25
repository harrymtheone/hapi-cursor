---
quick_id: 260525-cnj
description: 修复 visible models 设置页重复显示同名 model family（deriveFamilyKey 对 gpt-5.x 分组过细）
---

# Quick Plan: Fix duplicate GPT family keys

## Task 1: Fix `deriveFamilyKey` for plain GPT models

**Files:** `web/src/lib/cursorModelFamilies.ts`

**Action:**
- After existing claude/composer rules, add ordered GPT rules:
  - `gpt-{ver}-codex-max-*` → `gpt-{ver}-codex-max`
  - `gpt-{ver}-codex-*` → `gpt-{ver}-codex` (existing, must run after codex-max)
  - `gpt-{ver}-mini|nano` → `gpt-{ver}-mini|nano`
  - `gpt-{ver}-*` effort variants → `gpt-{ver}` (two-segment base)
- Keep fallback `parts.slice(0, 3)` for unknown vendors.

**Verify:** `cd web && bunx vitest run src/lib/cursorModelFamilies.test.ts -x`

**Done:** Live `agent models` grouping has no duplicate display names for GPT-5.1/5.2/5.4/5.5.

## Task 2: Extend tests

**Files:** `web/src/lib/cursorModelFamilies.test.ts`

**Action:** Add fixtures for `gpt-5.2`, `gpt-5.2-high`, `gpt-5.4-mini-medium`, `gpt-5.1-codex-max-medium`; assert single family per version and distinct mini/nano families.

**Verify:** same vitest command

**Done:** Tests pass.
