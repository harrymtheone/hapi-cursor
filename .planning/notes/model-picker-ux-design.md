---
title: Model picker UX — family filter and Cursor-style composer
date: 2026-05-25
context: gsd-explore before next milestone phase; extends Phase 1 runtime config contract
---

# Model picker UX design

## Problem

Phase 1 surfaces every raw Cursor model id from `agent models` in a flat `<select>` (new session) or radio list (composer). Ids like `claude-4.6-opus-high-thinking-fast` are hard to scan on mobile. Cursor Desktop uses a two-level pattern: pick a model family, then Edit → Options for Thinking, Fast, Context, and Effort.

## Goals

1. **Global visibility filter** at model-family granularity so the composer list stays short.
2. **New sessions always Auto** — no launch-time model control.
3. **In-session switching** matches Desktop: primary menu + Options sub-panel; still submits one raw model id.

## Non-goals

- Separate Hub/CLI fields for `effort` / `modelReasoningEffort` (Phase 1 UAT: display-only metadata; dimensions encoded in model id).
- Static model catalog in protocol — discovery remains runtime-owned via `agent models`.
- Per-machine visibility profiles in v1 (single global family list; intersect with machine discovery at runtime).

## Decisions (locked)

| Topic | Decision |
|-------|----------|
| Visibility granularity | **Model family** (e.g. Opus 4.7), not each raw variant |
| Storage | `localStorage`, key `hapi-visible-model-families` — string array of stable family keys |
| Unconfigured default | **Empty / missing key = all families visible** until user saves a filter in Settings |
| Settings entry | One row on Settings index → dedicated **`/settings/models`** sub-route (no inline mega-section) |
| New session | Remove `ModelSelector`; `spawnSession` omits `model` (Auto) |
| Composer | Replace flat `HappyComposerOverlays` model list with nested picker + Edit → Options |
| Auto | Always available in composer; not part of family filter |
| Runtime submit | Compose valid raw id from family + options; send only `model` string |

## Information architecture

```
Settings index
  └─ "Visible models" row (summary: "6 selected" or "All models")
       └─ /settings/models
            ├─ Search
            ├─ Bulk: Select common (optional) / Clear filter
            ├─ Grouped checkboxes by family (from discovery on online runner)
            └─ Footer help text

New session panel
  └─ (no model block)

Composer status / model control
  ├─ Trigger: current family + option summary (e.g. "Opus 4.7 · Medium · Thinking")
  ├─ Primary menu: Auto + enabled families (+ search)
  ├─ Per-row Edit → Options flyout: Thinking, Fast, Context, Effort
  └─ Footer link: "Manage visible models…" → /settings/models
```

## Model family grouping

Input: `CursorModelSummary[]` from `getCursorModels(machineId)`.

- **Display name**: prefer CLI `label` tokenization (e.g. `Opus 4.7 1M Medium Thinking Fast` → family `Opus 4.7`, context `1M`, effort `Medium`, flags `Thinking`/`Fast`).
- **Stable key**: normalized slug from family display name + major version (e.g. `opus-4.7`) or derived from id prefix heuristics (`claude-opus-4-7-*` → `claude-opus-4-7`).
- **Variants**: all discovered ids belonging to the family; Options UI enables only combinations that exist in that set.

Composition: given family + option toggles/choices, resolve to exactly one `model.id` or show disabled state if no matching variant.

## Machine scope

- Discovery is **machine-scoped** (existing `useCursorModels(api, machineId)`).
- Visibility preference is **global** (one list in localStorage).
- Effective composer list: `families(discovered) ∩ visibleFamilies` (or all families if filter unset).
- Settings `/settings/models` should discover against a chosen online runner (default: first online machine, or last-used) with retry/empty states matching Phase 1 discovery UX.

## Phase 1 / UAT impact

| Former UAT expectation | New behavior |
|------------------------|--------------|
| Test 2: model selector on new-session panel | Remove; discovery still used for Settings + composer |
| Test 3: explicit model launch from new session | New sessions use Auto; explicit model only via in-session switch before/after first message per product choice |
| Test 5: no effort controls | Unchanged — Options map to raw ids only |

Recommend a short **Phase 1 polish** plan or pre–Phase 2 slice: Web-only + localStorage + family parser module; minimal protocol change.

## Open implementation notes

- Track whether user has **ever saved** a filter (`hapi-visible-model-families-configured: true`) vs empty array meaning "all" vs "none".
- For "all visible" default: omit key or use sentinel; do not require visiting Settings first.
- i18n keys under `settings.models.*` and `composer.modelPicker.*`.
- Reuse `FloatingOverlay` / existing settings section patterns for visual consistency.

## References

- `web/src/components/NewSession/ModelSelector.tsx` — to remove from new session
- `web/src/components/AssistantChat/HappyComposerOverlays.tsx` — to replace model section
- `web/src/routes/settings/index.tsx` — add drill-down row
- `cli/src/cursor/modelDiscovery.ts` — discovery source
- `.planning/phases/01-cursor-runtime-config-contract/01-UAT.md` — update tests 2–3 when implementing
