# Phase 2: Skills Visibility and Session Policy - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-26
**Phase:** 2-skills-visibility-and-session-policy
**Mode:** `--auto` (all gray areas auto-selected)
**Areas discussed:** Discovery scope, Inventory schema, Policy storage, Enforcement model, UI placement, Composer integration

---

## Discovery scope

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal (keep `.agents/skills` top-level only) | Smallest diff; misses Cursor `.cursor/skills` and nested skills | |
| **Cursor-aligned roots + nested `SKILL.md`** | Scan `.cursor/skills` + `.agents/skills`, project and user, nested files, project-over-user dedup | ✓ |
| Full filesystem walk of repo | Highest coverage; risk noise and perf cost | |

**User's choice:** Cursor-aligned roots + nested `SKILL.md` (recommended default)
**Notes:** `[auto]` Aligns with ROADMAP/research deliverables and SKIL-01 source visibility.

---

## Inventory schema & invalid states

| Option | Description | Selected |
|--------|-------------|----------|
| Keep `{ name, description? }` only | Minimal; cannot satisfy SKIL-01 source/mode/invalid | |
| **Rich `SkillSummary` in `shared/`** | source, invocationMode, valid/invalidReason, pathHint | ✓ |
| Hide invalid skills | Cleaner list; fails SKIL-01 | |

**User's choice:** Rich shared schema + show invalid rows (recommended default)

---

## Policy storage

| Option | Description | Selected |
|--------|-------------|----------|
| React localStorage only | Fast; fails resume/pitfall 3 | |
| Machine metadata | Wrong scope; affects all sessions | |
| **Session metadata + Hub API + strict patch** | Matches model/effort pattern; resume-safe | ✓ |

**User's choice:** Session metadata + Hub API (recommended default)

---

## Enforcement model

| Option | Description | Selected |
|--------|-------------|----------|
| Edit skill files / Cursor global config from mobile | Violates out-of-scope; pitfall 3 | |
| **HAPI session policy (prompt/composer layer)** | Honest until CLI suppress API proven | ✓ |
| Assume Cursor hard-enforcement without proof | Misleading UI (SKIL-03 failure) | |

**User's choice:** HAPI session policy with honest badges (recommended default)
**Notes:** Plan-phase research must verify Cursor CLI per-session suppression.

---

## UI placement

| Option | Description | Selected |
|--------|-------------|----------|
| Settings only | Policy feels global; violates session-local requirement | |
| Session only | Works in chat; weak browse-without-session | |
| **Session policy sheet + Settings read-only catalog** | Policy in session; discovery browse at `/settings/skills` | ✓ |

**User's choice:** Dual surface (recommended default)

---

## Composer integration

| Option | Description | Selected |
|--------|-------------|----------|
| Ignore policy in `$` autocomplete | Policy UI becomes decorative | |
| **Filter disabled skills from suggestions** | Policy affects real compose UX | ✓ |
| Block sends containing disabled `$skill` | Stronger; defer unless cheap | |

**User's choice:** Filter autocomplete (recommended default)

---

## Claude's Discretion

- Nested walk details, path redaction, route shape, preamble wording, component layout, i18n keys.

## Deferred Ideas

- Skill file editing, global skill settings, MCP policy (Phase 3), cross-session policy profiles.
