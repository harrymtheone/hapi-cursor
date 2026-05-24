---
title: Implement model picker UX (family filter + composer)
date: 2026-05-25
priority: high
---

# Todo: Model picker UX implementation

## Prerequisites

- Read `.planning/notes/model-picker-ux-design.md`
- Sketches: `.planning/sketches/model-picker-ux/`
- Requirement: **CURS-05** in `.planning/REQUIREMENTS.md`

## Tasks

### 1. Shared model-family utilities (`web/src/lib/cursorModelFamilies.ts`)

- [ ] Parse `CursorModelSummary[]` into families (key, displayName, variants[])
- [ ] Map Options state → raw `model.id` (or null if invalid)
- [ ] Map raw id → family + options for display on composer trigger
- [ ] Unit tests with fixtures from real `agent models` samples (opus/composer/codex lines)

### 2. Visibility preference hook (`web/src/hooks/useVisibleModelFamilies.ts`)

- [ ] `localStorage` keys: `hapi-visible-model-families`, optional `hapi-visible-model-families-configured`
- [ ] Default: unset = all families visible
- [ ] `setVisibleFamilies`, `clearFilter`, `isFamilyVisible(key)`
- [ ] Tests for read/write/migration

### 3. Settings sub-route `/settings/models`

- [ ] Register route in `web/src/router.tsx`
- [ ] `ModelsSettingsPage`: search, family checkboxes, save, empty/discovery error states
- [ ] `useCursorModels` for online runner discovery
- [ ] i18n `settings.models.*`
- [ ] Add single drill-down row on Settings index (`settings/index.tsx`)

### 4. New session — Auto only

- [ ] Remove `ModelSelector` from `NewSession/index.tsx` and related state (`model`, discovery props)
- [ ] Ensure `spawnSession` never sends `model` (Auto)
- [ ] Update `NewSession.test.tsx`, delete or slim `ModelSelector.test.tsx` if component removed

### 5. Composer — Cursor-style picker

- [ ] New `ModelPickerOverlay` (or refactor `HappyComposerOverlays`) — primary menu + Edit Options panel
- [ ] Filter options by `useVisibleModelFamilies` ∩ session machine discovery
- [ ] Keep Auto; wire `onModelChange` with composed raw id
- [ ] "Manage visible models…" navigates to `/settings/models`
- [ ] Update `HappyComposer` tests, `StatusBar` model open behavior

### 6. Documentation and UAT

- [ ] Update Phase 1 UAT items 2–3 in `.planning/phases/01-cursor-runtime-config-contract/01-UAT.md` (or add polish UAT doc)
- [ ] Note CURS-02 launch wording: model selection moves to in-session only

### 7. Verification

- [ ] `bun run typecheck`
- [ ] `bun run test` (web vitest for touched files)
- [ ] Manual: Settings filter → composer list; Options compose valid id; new session Auto

## Suggested plan boundary

Single plan **01-22** or **02-00-polish** — Web-only, no Hub protocol change unless family metadata later moves server-side.
